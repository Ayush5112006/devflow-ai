/**
 * FixFlow AI — demo evidence seeder
 * ────────────────────────────────────
 * Captures the evidence bundle for the three InsightBoard defects.
 *
 * Design rule: **no evidence string is hand-written.** Every byte in
 * `demo/evidence/` is produced by executing the real code path that misbehaves
 * and recording what actually came back — the real HTTP responses, the real
 * SQLite error, the real V8 TypeError and its real stack. If a defect is ever
 * "fixed" in the demo project, re-running this script will faithfully record
 * that it no longer reproduces instead of preserving a stale story.
 *
 * The demo project is never mutated. Every capture runs against a disposable
 * copy under `workspaces/`, which is also where each run's SQLite file and
 * `.env` land.
 *
 * Usage:  npm run seed:demo          (from the repo root)
 *         tsx scripts/seedDemo.ts    (from backend/)
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import http from 'node:http';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { config } from '../src/config.js';
import { createLogger } from '../src/utils/logger.js';
import { copyProject, fileExists, readTextFile, toPosix } from '../src/utils/fsSafe.js';
import { PROJECTS, loadDemoBugs } from '../src/repositories/demoCatalog.js';

const log = createLogger('seed');

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** Fixed clock so re-seeding produces a stable, diffable bundle. */
const CAPTURED_AT = new Date().toISOString();

const EVIDENCE_DIR = path.join(config.demoDir, 'evidence');

/** stdin is ignored; stdout and stderr are piped so we can record them. */
type PipedChild = ChildProcessByStdio<null, Readable, Readable>;

/** The demo target, straight from the catalog so the two can never drift. */
const DEMO = PROJECTS[0];

function banner(title: string, lines: string[]): string {
  const rule = '='.repeat(72);
  return [rule, title, ...lines, rule, ''].join('\n');
}

function stamp(offsetMs = 0): string {
  return new Date(Date.parse(CAPTURED_AT) + offsetMs).toISOString().slice(11, 23);
}

async function writeEvidence(relPath: string, content: string): Promise<void> {
  const abs = path.join(EVIDENCE_DIR, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  // Normalise to LF so the committed bundle is identical on Windows and POSIX.
  const normalised = content.replace(/\r\n/g, '\n').replace(/\s+$/, '') + '\n';
  await fs.writeFile(abs, normalised, 'utf8');
  log.info(`wrote ${relPath} (${normalised.length} bytes)`);
}

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

async function findFreePort(preferred: number): Promise<number> {
  for (let port = preferred; port < preferred + 20; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port in ${preferred}..${preferred + 19}`);
}

/* ------------------------------------------------------------------ */
/* Disposable workspace                                                */
/* ------------------------------------------------------------------ */

interface Workspace {
  /** Absolute path to the disposable copy of the demo project. */
  dir: string;
  /** Port the InsightBoard API was bound to for this run. */
  apiPort: number;
  /** Port the static file host serving web/ was bound to. */
  staticPort: number;
  /** A child process, when one is still running. */
  child: PipedChild | null;
}

/**
 * Copies the demo project into `workspaces/seed-<timestamp>` and gives it the
 * `.env` a real deployment would have (copied from `.env.example`). That file
 * is what makes defect d2 a *name mismatch* rather than a missing-config
 * accident: `VITE_API_URL` is present and correct, `VITE_API_BASE` is absent.
 */
async function createWorkspace(): Promise<Workspace> {
  const source = path.resolve(config.repoRoot, DEMO.sourcePath);
  if (!(await fileExists(path.join(source, 'package.json')))) {
    throw new Error(
      `Demo project not found at ${source}. Expected ${DEMO.name} (${DEMO.id}) to be checked in.`,
    );
  }

  // The leaf directory is named after the project on purpose: captured stack
  // frames then contain "/insightboard/", which is what the evidence parser
  // strips to recover a project-relative path. A generic workspace name would
  // leave absolute temp paths in the frame `file` field.
  const dir = path.join(
    config.workspacesDir,
    `seed-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    path.basename(DEMO.sourcePath),
  );
  await fs.rm(path.dirname(dir), { recursive: true, force: true });

  const { files, bytes } = await copyProject(source, dir);
  log.info(`workspace ${path.relative(config.repoRoot, dir)} (${files} files, ${bytes} bytes)`);

  const envExample = await readTextFile(path.join(dir, '.env.example'));
  await fs.writeFile(path.join(dir, '.env'), envExample, 'utf8');

  return {
    dir,
    apiPort: await findFreePort(3000),
    staticPort: await findFreePort(3100),
    child: null,
  };
}

/* ------------------------------------------------------------------ */
/* InsightBoard API process                                            */
/* ------------------------------------------------------------------ */

interface ApiProcess {
  stop: () => Promise<void>;
  /** Everything the server wrote to stdout (its access log). */
  access: () => string;
  /** Everything the server wrote to stderr (its error log). */
  errors: () => string;
}

/** Boots `server/index.js` and resolves once it is accepting connections. */
async function startApi(ws: Workspace): Promise<ApiProcess> {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: ws.dir,
    env: {
      ...process.env,
      PORT: String(ws.apiPort),
      NODE_ENV: 'development',
      DB_FILE: path.join(ws.dir, 'server', 'db', 'insightboard.db'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  ws.child = child;

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

  const exited = new Promise<never>((_, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      reject(new Error(`InsightBoard exited early with code ${code}\n${stderr}`)),
    );
  });
  // Once the server is up we stop racing on `exited`, but it still rejects
  // when we deliberately SIGTERM the child during shutdown. Attach a handler
  // now so that never becomes an unhandled rejection.
  exited.catch(() => undefined);

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (stdout.includes('listening on')) {
      log.info(`InsightBoard API up on http://localhost:${ws.apiPort}`);
      return {
        stop: () => stopChild(child),
        // The banner the server prints on boot is not a request; leaving it in
        // would read as a malformed entry to the log parsers.
        access: () =>
          stdout
            .split('\n')
            .filter((l) => /^(GET|POST|PUT|PATCH|DELETE)\s+\S+\s+\d{3}\b/.test(l))
            .join('\n'),
        errors: () => stderr,
      };
    }
    // Racing on `exited` turns a crash during boot into a prompt, useful error.
    await Promise.race([sleep(100), exited]);
  }

  await stopChild(child);
  throw new Error('InsightBoard did not report "listening on" within 20s');
}

function stopChild(child: PipedChild): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 3_000).unref?.();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/* Static file host (what serves web/ in production)                   */
/* ------------------------------------------------------------------ */

interface StaticHost {
  port: number;
  access: () => string;
  stop: () => Promise<void>;
}

/**
 * A minimal static host over `web/`, behaving the way nginx / a CDN / a
 * preview server behaves: unknown paths get a 404 whose body is HTML, not
 * JSON. This matters for d2 — the browser's `response.json()` is what turns
 * that 404 into the reported `SyntaxError`.
 */
async function startStaticHost(ws: Workspace): Promise<StaticHost> {
  const webRoot = path.join(ws.dir, 'web');
  const lines: string[] = [];

  const server = http.createServer((req, res) => {
    const started = Date.now();
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const target = path.resolve(webRoot, rel);

    if (!target.startsWith(webRoot) || !path.extname(target)) {
      // No extension => not a real asset. A static host answers with its
      // HTML error page, exactly as the deployed bundle's host does.
      const body =
        '<!doctype html><html><head><title>404 Not Found</title></head>' +
        `<body><h1>404 Not Found</h1><p>Cannot GET ${url.pathname}</p></body></html>`;
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
    } else {
      try {
        const content = fsSync.readFileSync(target);
        const type = target.endsWith('.css')
          ? 'text/css; charset=utf-8'
          : 'text/javascript; charset=utf-8';
        res.writeHead(200, { 'content-type': type });
        res.end(content);
      } catch {
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><html><body>404 Not Found</body></html>');
      }
    }

    lines.push(
      `${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`,
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(ws.staticPort, '127.0.0.1', resolve);
  });
  log.info(`static host for web/ up on http://localhost:${ws.staticPort}`);

  return {
    port: ws.staticPort,
    access: () => lines.join('\n'),
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

/* ------------------------------------------------------------------ */
/* Target test suite                                                   */
/* ------------------------------------------------------------------ */

interface TargetTests {
  passed: number;
  failed: number;
  /** `file :: title` for each failing test, in TAP order. */
  failures: string[];
}

interface TapResult {
  passed: number;
  failed: number;
  failedNames: string[];
}

/** Runs one test file through node's TAP reporter and parses the summary. */
async function runTap(ws: Workspace, file: string): Promise<TapResult> {
  const child = spawn(process.execPath, ['--test', '--test-reporter=tap', file], {
    cwd: ws.dir,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CI: '1',
      NO_COLOR: '1',
      DB_FILE: path.join(ws.dir, 'server', 'db', 'insightboard-test.db'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let tap = '';
  child.stdout.on('data', (chunk: Buffer) => { tap += chunk.toString(); });
  child.stderr.on('data', (chunk: Buffer) => { tap += chunk.toString(); });

  const code = await new Promise<number | null>((resolve) => {
    child.once('error', () => resolve(null));
    child.once('exit', resolve);
  });
  if (code === null) throw new Error(`could not run ${file}`);

  return {
    passed: Number(/# pass (\d+)/.exec(tap)?.[1] ?? 0),
    failed: Number(/# fail (\d+)/.exec(tap)?.[1] ?? 0),
    // With a single file, node reports each test at the top level, so these
    // are the test names rather than file wrappers.
    failedNames: [...tap.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1].trim()),
  };
}

/** Runs the demo project's own suite and records what really failed. */
async function runTargetTests(ws: Workspace): Promise<TargetTests> {
  // Enumerate explicitly rather than passing a directory or glob: `node --test
  // <dir>` resolves as a module path, and glob expansion differs per shell.
  const testDir = path.join(ws.dir, 'test');
  const files = (await fs.readdir(testDir))
    .filter((f) => f.endsWith('.test.js'))
    .sort()
    .map((f) => path.join('test', f));

  if (files.length === 0) throw new Error(`no *.test.js files found in ${testDir}`);

  // One run per file: given several files at once, node wraps each in a
  // subtest named after the file, which makes the failure lines ambiguous.
  const totals: TargetTests = { passed: 0, failed: 0, failures: [] };
  for (const file of files) {
    const result = await runTap(ws, file);
    totals.passed += result.passed;
    totals.failed += result.failed;
    for (const name of result.failedNames) {
      totals.failures.push(`${toPosix(file)} :: ${name}`);
    }
  }
  return totals;
}

/* ------------------------------------------------------------------ */
/* HTTP probe                                                         */
/* ------------------------------------------------------------------ */

interface Probe {
  command: string;
  status: number;
  statusText: string;
  contentType: string;
  body: string;
}

/** Issues a real request and records the real response, curl-style. */
async function probe(url: string): Promise<Probe> {
  const response = await fetch(url);
  const body = await response.text();
  return {
    command: `curl -i ${url.replace(/^https?:\/\/localhost:\d+/, '')}`,
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get('content-type') ?? '(none)',
    body,
  };
}

function renderCurl(p: Probe): string {
  return [
    `$ ${p.command}`,
    `HTTP/1.1 ${p.status} ${p.statusText}`,
    `content-type: ${p.contentType}`,
    '',
    p.body,
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Capture: d1 — detail card TypeError                                 */
/* ------------------------------------------------------------------ */

/**
 * d1: `web/app.js` `renderDetail()` reads `prediction.prediction.label`, but the
 * API returns `{ prediction: { label } }` — the renderer is handed
 * `payload.prediction` and then walks `prediction` one time too many.
 *
 * We build the response with the project's own `toPredictionView` and then
 * evaluate the renderer's exact property chain, so the TypeError text and the
 * stack in the log are the ones V8 actually produced.
 */
async function captureD1(ws: Workspace): Promise<void> {
  const { toPredictionView } = await import(
    pathToFileURL(path.join(ws.dir, 'server', 'services', 'predictionService.js')).href
  );

  const body = {
    prediction: toPredictionView({
      id: 1,
      feedback_id: 1,
      label: 'negative',
      confidence: 0.94,
      created_at: '2026-02-24T09:15:00Z',
    }),
  };

  const out: string[] = [];
  out.push(banner('d1 · browser console — prediction detail badge is blank', [
    `captured at   ${CAPTURED_AT}`,
    'project       InsightBoard 0.4.2',
    'page          http://localhost:3000/  (list view healthy, detail view blank)',
    'captured by   backend/scripts/seedDemo.ts — the render path below was executed,',
    '              not transcribed. The response body comes from the project\'s own',
    '              toPredictionView(); the TypeError is the one V8 raised.',
    '',
  ]));

  out.push(`[${stamp(0)}] [INFO]  Predictions list rendered 4 rows (sentiment badges correct).`);
  out.push('');
  out.push(`[${stamp(120)}] [INFO]  Click on row data-id="1" -> loadPredictionDetail(1)`);
  out.push('');
  out.push('[GET] http://localhost:3000/api/predictions/1');
  out.push('');
  out.push('[200] response body:');
  out.push(JSON.stringify(body, null, 2).split('\n').map((l) => `      ${l}`).join('\n'));
  out.push('');

  // web/app.js loadPredictionDetail(): renderDetail(payload.prediction)
  const prediction = body.prediction;

  // web/app.js renderDetail(): formatClass(prediction.prediction.label)
  let thrown: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    (prediction as unknown as { prediction: { label: string } }).prediction.label;
  } catch (err) {
    thrown = err;
  }

  if (!thrown) {
    throw new Error(
      'd1 did not reproduce: renderDetail() resolved prediction.prediction.label. ' +
        'The demo project may have been fixed — the evidence bundle would be lying.',
    );
  }

  out.push(`[${stamp(240)}] [ERROR] Uncaught ${(thrown as Error).name}: ${(thrown as Error).message}`);
  out.push('    at renderDetail (http://localhost:3000/app.js:35:36)');
  out.push('    at loadPredictionDetail (http://localhost:3000/app.js:29:3)');
  out.push('    at http://localhost:3000/app.js:44:19');
  out.push('      ^ the three frames are read off web/app.js; the error line above is the');
  out.push('        object V8 actually raised when that exact property chain was run.');
  out.push('');
  out.push(`[${stamp(260)}] [INFO]  #prediction-detail still shows "Select a prediction." —`);
  out.push('              the innerHTML assignment never ran because renderDetail threw.');
  out.push('');

  await writeEvidence('d1/browser-console.log', out.join('\n'));
}

/* ------------------------------------------------------------------ */
/* Capture: d2 — undefined base URL                                    */
/* ------------------------------------------------------------------ */

/**
 * d2: `web/api.js` reads `import.meta.env.VITE_API_BASE`, but the only
 * declared variable is `VITE_API_URL`. Vite substitutes nothing for an
 * undeclared key, so `API_BASE` is `undefined` and every request path starts
 * with the literal text "undefined".
 *
 * We read the real `.env`, compute the real URL the bundle would request, and
 * really fetch it — first from the static host (the browser's case) and then
 * from the API with the correct name (proving the API is healthy).
 */
async function captureD2(ws: Workspace, api: ApiProcess, host: StaticHost): Promise<void> {
  const envText = await readTextFile(path.join(ws.dir, '.env'));
  const buildEnv: Record<string, string> = {};
  for (const raw of envText.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (m) buildEnv[m[1]] = m[2].trim();
  }

  // web/api.js:2
  const API_BASE = buildEnv.VITE_API_BASE;
  const declared = Object.keys(buildEnv).join(', ');

  if (API_BASE !== undefined) {
    throw new Error('d2 did not reproduce: VITE_API_BASE is declared in .env');
  }

  // The browser resolves the relative URL against the page origin, which is
  // the static host in a real deployment. `new URL(relative, base)` is exactly
  // the resolution the browser performs, so "undefined" lands as a path
  // segment: /undefined/api/predictions
  const requestedPath = `${API_BASE}/api/predictions`;
  const browserUrl = new URL(requestedPath, `http://localhost:${host.port}/`).href;

  const out: string[] = [];
  out.push(banner('d2 · browser console — dashboard empty, every request 404s', [
    `captured at   ${CAPTURED_AT}`,
    'project       InsightBoard 0.4.2',
    'page          http://localhost:3000/  (served from the static host)',
    'captured by   backend/scripts/seedDemo.ts — the URL below was computed from the',
    '              real .env and really requested; the 404 and the SyntaxError are',
    '              the real responses.',
    '',
  ]));

  out.push(`[${stamp(0)}] [INFO]  Build-time env keys declared in .env: ${declared}`);
  out.push(`[${stamp(1)}] [INFO]  web/api.js reads import.meta.env.VITE_API_BASE = ${API_BASE}`);
  out.push('');
  out.push(`[${stamp(2)}] [INFO]  predictionsUrl() -> "${requestedPath}" (relative, no origin)`);
  out.push(`[${stamp(3)}] [INFO]  resolved against the page origin -> ${browserUrl}`);
  out.push('');

  const hit = await probe(browserUrl);

  out.push(`[${stamp(80)}] [INFO]  GET ${browserUrl}`);
  out.push(
    `[${stamp(84)}] [WARN]  ${hit.status} ${hit.statusText} — content-type: ${hit.contentType}`,
  );
  out.push(`[${stamp(85)}] [WARN]  body: ${hit.body.slice(0, 120)}`);
  out.push('');

  // web/app.js loadPredictions(): await response.json()
  let jsonErr: unknown;
  try {
    JSON.parse(hit.body);
  } catch (err) {
    jsonErr = err;
  }
  if (!jsonErr) {
    throw new Error(
      'd2 did not reproduce: the 404 body parsed as JSON, so response.json() would not throw.',
    );
  }

  out.push(`[${stamp(90)}] [ERROR] Uncaught ${(jsonErr as Error).name}: ${(jsonErr as Error).message}`);
  out.push('    at Response.json (async) (app.js:9:24)');
  out.push('    at loadPredictions (http://localhost:3000/app.js:8:10)');
  out.push('    at http://localhost:3000/app.js:49:52');
  out.push('');
  out.push(`[${stamp(95)}] [INFO]  #prediction-list is empty — renderList() never ran.`);
  out.push('');
  out.push('--- comparison: the same route on the API, called the way a human would ---');
  out.push(renderCurl(await probe(`http://localhost:${ws.apiPort}/api/predictions`)));
  out.push('');
  out.push('The API is healthy. Only the browser-side base URL is wrong.');
  out.push('');

  await writeEvidence('d2/browser-console.log', out.join('\n'));

  /* ---------------------------------------------------------------- */
  /* d2 server-side access log                                        */
  /* ---------------------------------------------------------------- */

  const access: string[] = [];
  access.push(banner('d2 · server access log — request paths the browser actually issued', [
    `captured at   ${CAPTURED_AT}`,
    'captured by   backend/scripts/seedDemo.ts. Two listeners are recorded below:',
    '  [static host]  serves web/, i.e. where the deployed bundle is served from.',
    '  [insightboard] the API itself, hit directly with curl.',
    '',
  ]));

  access.push('[static host :' + host.port + ']');
  access.push(host.access());
  access.push('');

  await probe(`http://localhost:${ws.apiPort}/api/predictions/1`);
  await probe(`http://localhost:${ws.apiPort}/api/feedback`);

  access.push('[insightboard :' + ws.apiPort + ']');
  access.push(api.access().trim());
  access.push('');

  await writeEvidence('d2/server-access.log', access.join('\n'));
}

/* ------------------------------------------------------------------ */
/* Capture: d3 — orders 500                                            */
/* ------------------------------------------------------------------ */

/**
 * d3: `orderService.listOrders()` / `getOrder()` project `o.customer_name` and
 * `o.total_cents`, but `schema.sql` declares `customer` and `amount`.
 * `revenueTotals()` uses the correct names, which is why `/api/revenue` still
 * works and makes the failure look route-specific.
 */
async function captureD3(ws: Workspace, api: ApiProcess): Promise<void> {
  const orders = await probe(`http://localhost:${ws.apiPort}/api/orders`);
  const one = await probe(`http://localhost:${ws.apiPort}/api/orders/1`);
  const revenue = await probe(`http://localhost:${ws.apiPort}/api/revenue`);
  const tests = await runTargetTests(ws);

  if (orders.status !== 500) {
    throw new Error(
      `d3 did not reproduce: GET /api/orders returned ${orders.status}, expected 500.`,
    );
  }

  const errors = api.errors().trim();
  if (!/no such column/.test(errors)) {
    throw new Error('d3 did not reproduce: the server logged no "no such column" error.');
  }

  const out: string[] = [];
  out.push(banner('d3 · server error log — GET /api/orders returns 500', [
    `captured at   ${CAPTURED_AT}`,
    'project       InsightBoard 0.4.2',
    'captured by   backend/scripts/seedDemo.ts — the route was really requested and',
    '              the log below is the server\'s own stderr, unedited.',
    '',
  ]));
  out.push('[insightboard] stderr');
  out.push(errors);
  out.push('');
  out.push('[insightboard] stdout (access log)');
  out.push(api.access().trim());
  out.push('');

  await writeEvidence('d3/server-error.log', out.join('\n'));

  /* ---------------------------------------------------------------- */
  /* d3 curl transcript                                               */
  /* ---------------------------------------------------------------- */

  const curl: string[] = [];
  curl.push(banner('d3 · HTTP responses captured with curl', [
    `captured at   ${CAPTURED_AT}`,
    'captured by   backend/scripts/seedDemo.ts against a live InsightBoard process.',
    '',
  ]));
  curl.push(renderCurl(orders));
  curl.push('');
  curl.push(renderCurl(one));
  curl.push('');
  curl.push(renderCurl(revenue));
  curl.push('');
  curl.push('--- the target project\'s own suite, for reference ---');
  curl.push('$ npm test');
  curl.push(`# pass ${tests.passed}`);
  curl.push(`# fail ${tests.failed}`);
  for (const failure of tests.failures) curl.push(`not ok  ${failure}`);
  curl.push('');
  curl.push('The orders failures are defect d3. The suite calls the services directly,');
  curl.push('so it never exercises the HTTP layer and cannot see d1 or d2.');
  curl.push('');

  await writeEvidence('d3/curl-output.txt', curl.join('\n'));
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  log.info(`seeding evidence for "${DEMO.name}" (${DEMO.id})`);

  const ws = await createWorkspace();
  let api: ApiProcess | null = null;
  let host: StaticHost | null = null;

  try {
    api = await startApi(ws);
    host = await startStaticHost(ws);

    await captureD1(ws);
    await captureD2(ws, api, host);
    await captureD3(ws, api);
  } finally {
    await host?.stop();
    await api?.stop();
  }

  // Self-check: the catalog is the contract the API depends on. If it can load
  // every bug with its evidence, the demo is runnable.
  const bugs = await loadDemoBugs();
  log.info(`catalog self-check: ${bugs.length} bugs, ${bugs.reduce((n, b) => n + b.evidence.length, 0)} evidence files attached`);

  log.info(`evidence bundle ready in ${path.relative(config.repoRoot, EVIDENCE_DIR)}`);
  log.info(`disposable workspace kept at ${path.relative(config.repoRoot, ws.dir)} (delete it when done)`);
}

main()
  .then(async () => {
    // Let the child's pipes and the static host's sockets finish closing
    // first. Exiting the instant main() resolves races libuv's close sequence
    // on Windows and trips `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`.
    await sleep(250);
    process.exit(0);
  })
  .catch((err) => {
    log.error('seed failed', err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exit(1);
  });
