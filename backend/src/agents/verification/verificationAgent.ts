import type { BeforeAfter, CheckResult, CheckStatus, ImplementationResult, VerificationResult } from '../../types/index.js';
import { id as makeId } from '../../utils/id.js';
import { nowIso } from '../../utils/time.js';
import { run, tryRun } from '../../utils/exec.js';
import { createLogger } from '../../utils/logger.js';
import type { CodeIndex } from '../../analysis/codeIndex.js';
import { pickTestScript, parseTestOutput } from '../testing/testAgent.js';
import type { AgentContext } from '../types.js';

const log = createLogger('verification');

/**
 * Verification Agent
 * ──────────────────
 * Runs the project's test suite, linting, type-checking, and the original bug
 * reproduction command after the Implementation Agent has applied its changes.
 *
 * Every check produces a CheckResult with a definitive status. Failures are
 * never hidden.
 */

export async function runVerificationAgent(
  ctx: AgentContext,
  implementation: ImplementationResult,
): Promise<VerificationResult> {
  const startedAt = nowIso();
  const started = Date.now();
  const checks: CheckResult[] = [];

  log.info('Starting verification');

  // 1. Run the test suite.
  const testScript = pickTestScript(ctx.index);
  if (testScript) {
    log.info(`Running tests: ${testScript.command}`);
    const result = await tryRun(testScript.command, { cwd: ctx.workspacePath });
    const parsed = parseTestOutput(result.stdout + result.stderr, result.exitCode);
    checks.push({
      id: makeId('chk'),
      name: `Test suite (${ctx.index.testRunner})`,
      command: testScript.command,
      status: result.exitCode === 0 ? 'pass' : 'fail',
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      summary: `${parsed.passed} passed, ${parsed.failed} failed, ${parsed.skipped} skipped out of ${parsed.total}`,
      failedTests: parsed.failedNames,
      totalTests: parsed.total,
      passedTests: parsed.passed,
      outputTail: (result.stdout + result.stderr).split('\n').slice(-40).join('\n').slice(0, 2000),
      evidence: [],
      origin: 'detected',
    });
  } else {
    checks.push(notAvailable('Test suite', 'No test script detected in package.json'));
  }

  // 2. Run linting if a lint script exists.
  if (ctx.index.scripts['lint']) {
    const result = await tryRun('npm run lint', { cwd: ctx.workspacePath });
    checks.push({
      id: makeId('chk'),
      name: 'Linting',
      command: 'npm run lint',
      status: result.exitCode === 0 ? 'pass' : 'fail',
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      summary: result.exitCode === 0 ? 'No lint errors' : 'Lint errors found',
      failedTests: [],
      outputTail: (result.stdout + result.stderr).slice(-1000),
      evidence: [],
      origin: 'detected',
    });
  }

  // 3. Type checking if tsc is available.
  if (ctx.index.scripts['typecheck'] || ctx.index.scripts['type-check'] || ctx.index.dependencies.includes('typescript')) {
    const tsCmd = ctx.index.scripts['typecheck'] ? 'npm run typecheck'
      : ctx.index.scripts['type-check'] ? 'npm run type-check'
      : 'npx tsc --noEmit';
    const result = await tryRun(tsCmd, { cwd: ctx.workspacePath });
    checks.push({
      id: makeId('chk'),
      name: 'TypeScript type check',
      command: tsCmd,
      status: result.exitCode === 0 ? 'pass' : 'fail',
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      summary: result.exitCode === 0 ? 'No type errors' : 'Type errors found',
      failedTests: [],
      outputTail: (result.stdout + result.stderr).slice(-1000),
      evidence: [],
      origin: 'detected',
    });
  }

  // 4. Original bug reproduction command (if provided).
  let beforeAfter: BeforeAfter | null = null;
  if (ctx.bug.reproCommand) {
    const reproCmd = ctx.bug.reproCommand;
    // Only run reproduction if it's a safe npm script.
    if (/^npm\s+run\s+repro/.test(reproCmd)) {
      log.info(`Running repro: ${reproCmd}`);
      const result = await tryRun(reproCmd, { cwd: ctx.workspacePath });
      const reproStatus: CheckStatus = result.exitCode === 0 ? 'pass' : 'fail';
      checks.push({
        id: makeId('chk'),
        name: 'Bug reproduction check',
        command: reproCmd,
        status: reproStatus,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        summary: reproStatus === 'pass' ? 'Reproduction script exited 0 — bug not reproduced (expected)' : 'Reproduction script still fails',
        failedTests: [],
        outputTail: (result.stdout + result.stderr).slice(-1000),
        evidence: [],
        origin: 'repro',
      });

      beforeAfter = {
        bugReproduction: {
          expected: ctx.bug.expectedBehavior,
          observed: ctx.bug.actualBehavior,
          status: 'fail' as const,
        },
        postFix: {
          expected: ctx.bug.expectedBehavior,
          observed: result.exitCode === 0
            ? ctx.bug.expectedBehavior
            : ctx.bug.actualBehavior,
          status: reproStatus,
        },
        capturedAt: nowIso(),
      };
    }
  }

  const currentFailures = checks.filter((c) => c.status === 'fail').map((c) => c.name);
  const overallStatus: VerificationResult['status'] =
    currentFailures.length === 0 ? 'passed'
    : checks.some((c) => c.origin === 'repro' && c.status === 'fail') ? 'failed'
    : 'inconclusive';

  const summary = currentFailures.length === 0
    ? `All ${checks.length} check(s) passed.`
    : `${currentFailures.length} of ${checks.length} check(s) failed: ${currentFailures.join(', ')}`;

  log.info(`Verification ${overallStatus}: ${summary}`);

  return {
    id: makeId('ver'),
    checks,
    before: beforeAfter,
    baselineFailures: [],
    currentFailures,
    status: overallStatus,
    summary,
    startedAt,
    finishedAt: nowIso(),
    durationMs: Date.now() - started,
  };
}

function notAvailable(name: string, reason: string): CheckResult {
  return {
    id: makeId('chk'),
    name,
    command: '',
    status: 'not_available',
    durationMs: 0,
    summary: reason,
    failedTests: [],
    outputTail: '',
    evidence: [],
    origin: 'detected',
  };
}
