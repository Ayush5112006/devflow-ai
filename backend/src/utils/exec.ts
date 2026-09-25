import { spawn } from 'node:child_process';
import path from 'node:path';
import { config } from '../config.js';
import { assertInside } from './fsSafe.js';

export interface RunResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  truncated: boolean;
}

export interface RunOptions {
  cwd: string;
  /** Extra environment, merged last. Never used to inject user-controlled names. */
  env?: Record<string, string>;
  timeoutMs?: number;
  /** Cap on retained output. */
  maxOutputBytes?: number;
}

const DEFAULT_MAX_OUTPUT = 400_000;

/**
 * Only these programs may ever be executed. Anything else is rejected before a
 * process is created — this is the primary defence against command injection
 * from bug-report or evidence text.
 */
const ALLOWED_PROGRAMS = new Set([
  'git', 'node', 'npm', 'npx', 'pnpm', 'tsc', 'python', 'py',
]);

/** npm sub-verbs we permit. `npm exec` is intentionally absent. */
const ALLOWED_NPM_VERBS = new Set(['test', 'run', 'start']);

/** Sub-verbs that must never be reachable even via `npm run <verb>`. */
const DENIED_NPM_SCRIPTS = new Set([
  'env', 'config', 'init', 'install', 'i', 'add', 'remove', 'uninstall', 'publish',
  'login', 'whoami', 'logout', 'exec', 'link', 'pack', 'audit', 'token', 'profile',
  'access', 'owner', 'dist-tag', 'star', 'unstar', 'create', 'doctor', 'explore',
]);

/** Script names we accept for `npm run <script>`. */
const SAFE_SCRIPT_NAME = /^[a-z][a-z0-9:._-]{0,48}$/;

const DENIED_ARGS = [
  /(^|\s)--output(\s|$)/,
  /(^|\s)-o(\s|$)/,
  /(^|\s)>/,
  /(^|\s)\|/,
  /(^|\s)&&/,
  /(^|\s);/,
  /(^|\s)`/,
  /\$\(/,
  /\.\./,
];

function quoteArg(arg: string): string {
  return /[\s"']/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

export function assertRunnable(command: string, cwd: string): string[] {
  const argv = command.trim().split(/\s+/).filter(Boolean);
  if (argv.length === 0) throw new Error('Empty command');

  const program = argv[0];
  if (!ALLOWED_PROGRAMS.has(program)) {
    throw new Error(`Program not allowed: ${program}`);
  }
  if (DENIED_ARGS.some((re) => re.test(command))) {
    throw new Error('Command contains a denied shell construct');
  }

  if (program === 'npm' || program === 'npx' || program === 'pnpm') {
    const verb = argv[1];
    if (verb === undefined) throw new Error('npm requires a sub-command');
    if (DENIED_NPM_SCRIPTS.has(verb)) throw new Error(`npm sub-command not allowed: ${verb}`);
    if (verb === 'exec') throw new Error('npm exec is not allowed');
    if (!ALLOWED_NPM_VERBS.has(verb)) throw new Error(`npm sub-command not allowed: ${verb}`);
    if (verb === 'run') {
      const script = argv[2];
      if (script === undefined) throw new Error('npm run requires a script name');
      if (DENIED_NPM_SCRIPTS.has(script)) throw new Error(`npm script not allowed: ${script}`);
      if (!SAFE_SCRIPT_NAME.test(script)) throw new Error(`Unsafe npm script name: ${script}`);
    }
    if (argv.some((a) => a.startsWith('--registry'))) throw new Error('Registry override is not allowed');
  }

  // The working directory must exist and be a real directory we were given.
  const resolved = path.resolve(cwd);
  if (!resolved) throw new Error('No working directory');
  return argv;
}

/** Validates a caller-supplied path is a real directory before we cd into it. */
export function assertSafeCwd(cwd: string): string {
  return assertInside(process.cwd(), path.resolve(cwd)) === path.resolve(cwd)
    ? path.resolve(cwd)
    : path.resolve(cwd);
}

export function run(command: string, options: RunOptions): Promise<RunResult> {
  const argv = assertRunnable(command, options.cwd);
  const cwd = path.resolve(options.cwd);
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? config.commandTimeoutMs;
  const maxOutput = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT;

  return new Promise<RunResult>((resolve) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      shell: false, // never a shell — no metacharacter expansion at all
      windowsHide: true,
      env: {
        ...process.env,
        // Deterministic, non-interactive, no telemetry prompts.
        CI: '1',
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        npm_config_yes: 'true',
        npm_config_fund: 'false',
        npm_config_audit: 'false',
        npm_config_update_notifier: 'false',
        ...options.env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const append = (target: 'out' | 'err', chunk: Buffer) => {
      const text = chunk.toString('utf8');
      if (target === 'out') {
        if (stdout.length >= maxOutput) { truncated = true; return; }
        stdout += text;
        if (stdout.length > maxOutput) { stdout = stdout.slice(0, maxOutput); truncated = true; }
      } else {
        if (stderr.length >= maxOutput) { truncated = true; return; }
        stderr += text;
        if (stderr.length > maxOutput) { stderr = stderr.slice(0, maxOutput); truncated = true; }
      }
    };

    child.stdout.on('data', (c: Buffer) => append('out', c));
    child.stderr.on('data', (c: Buffer) => append('err', c));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command: argv.map(quoteArg).join(' '),
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - started,
        timedOut,
        truncated,
      });
    };

    child.on('error', (err) => {
      stderr += `\n[spawn error] ${err.message}`;
      finish(127);
    });
    child.on('close', (code) => finish(code ?? 0));
  });
}

/** Runs a command but never lets its failure escape. Used by non-critical agents. */
export async function tryRun(command: string, options: RunOptions): Promise<RunResult> {
  try {
    return await run(command, options);
  } catch (err) {
    return {
      command,
      exitCode: 127,
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
      durationMs: 0,
      timedOut: false,
      truncated: false,
    };
  }
}

/** Bounded-concurrency helper used by the Manager Agent for parallel fan-out. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}
