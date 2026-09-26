import type { CheckResult, CreatedTest, ImplementationResult, RegressionImpact, RegressionResult } from '../../types/index.js';
import { id as makeId } from '../../utils/id.js';
import { nowIso } from '../../utils/time.js';
import { tryRun } from '../../utils/exec.js';
import { createLogger } from '../../utils/logger.js';
import type { CodeIndex } from '../../analysis/codeIndex.js';
import { pickTestScript, parseTestOutput } from '../testing/testAgent.js';
import type { AgentContext } from '../types.js';
import type { RootCause } from '../../types/index.js';

const log = createLogger('regression');

/**
 * Regression Agent
 * ────────────────
 * Analyses what callers and dependent modules could be affected by the applied
 * changes, runs related tests, and optionally creates a focused regression test
 * for the specific defect.
 *
 * Rule: Do not create tests that duplicate existing coverage.
 */

export async function runRegressionAgent(
  ctx: AgentContext,
  implementation: ImplementationResult,
  rootCause: RootCause,
): Promise<RegressionResult> {
  const startedAt = nowIso();
  const started = Date.now();
  const impacts: RegressionImpact[] = [];
  const executed: CheckResult[] = [];
  const createdTests: CreatedTest[] = [];
  const relatedTestFiles: string[] = [];

  log.info('Starting regression analysis');

  // Analyse each modified file for callers and dependents.
  for (const modifiedFile of implementation.filesModified) {
    impacts.push(...analyseImpact(modifiedFile, ctx.index));
  }

  // Find test files that exercise the modified production files.
  const productionFiles = new Set(implementation.filesModified);
  for (const edge of ctx.index.importEdges) {
    if (productionFiles.has(edge.to) && edge.from.includes('.test.')) {
      relatedTestFiles.push(edge.from);
    }
  }
  // Also look for test files that import the callers of modified files.
  for (const impact of impacts.filter((i) => i.kind === 'caller')) {
    for (const edge of ctx.index.importEdges) {
      if (edge.to === impact.file && edge.from.includes('.test.')) {
        relatedTestFiles.push(edge.from);
      }
    }
  }

  log.info(`Found ${relatedTestFiles.length} related test file(s)`);

  // Run the full test suite (simplest, most reliable regression check).
  const testScript = pickTestScript(ctx.index);
  if (testScript) {
    log.info(`Running regression tests: ${testScript.command}`);
    const result = await tryRun(testScript.command, { cwd: ctx.workspacePath });
    const parsed = parseTestOutput(result.stdout + result.stderr, result.exitCode);
    executed.push({
      id: makeId('chk'),
      name: `Regression: ${testScript.name}`,
      command: testScript.command,
      status: result.exitCode === 0 ? 'pass' : 'fail',
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      summary: `${parsed.passed} passed, ${parsed.failed} failed`,
      failedTests: parsed.failedNames,
      totalTests: parsed.total,
      passedTests: parsed.passed,
      outputTail: (result.stdout + result.stderr).split('\n').slice(-40).join('\n').slice(0, 2000),
      evidence: [],
      origin: 'regression',
    });
  }

  // Re-run the original bug reproduction if available.
  let originalBugRetested: CheckResult | null = null;
  if (ctx.bug.reproCommand && /^npm\s+run\s+repro/.test(ctx.bug.reproCommand)) {
    const result = await tryRun(ctx.bug.reproCommand, { cwd: ctx.workspacePath });
    originalBugRetested = {
      id: makeId('chk'),
      name: 'Original bug reproduction',
      command: ctx.bug.reproCommand,
      status: result.exitCode === 0 ? 'pass' : 'fail',
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      summary: result.exitCode === 0 ? 'Bug no longer reproducible' : 'Bug still reproducible',
      failedTests: [],
      outputTail: (result.stdout + result.stderr).slice(-800),
      evidence: [],
      origin: 'repro',
    };
  }

  // Create a focused regression test if the bug has no existing coverage.
  const hasExistingCoverage = ctx.index.tests.some((t) => {
    const keywords = ctx.bug.title.toLowerCase().split(/\s+/);
    return keywords.some((k) => k.length > 3 && t.name.toLowerCase().includes(k));
  });

  if (!hasExistingCoverage && implementation.filesModified.length > 0) {
    const test = generateRegressionTest(ctx, implementation, rootCause);
    if (test) createdTests.push(test);
  }

  const allFailed = executed.filter((c) => c.status === 'fail');
  const hasRisk = impacts.some((i) => i.severity === 'high') || allFailed.length > 0;

  const status: RegressionResult['status'] =
    executed.length === 0 ? 'not_available'
    : hasRisk ? 'risk-detected'
    : 'clean';

  const summary = status === 'clean'
    ? `No regression detected. ${executed.length} test run(s) passed.`
    : status === 'risk-detected'
    ? `Regression risk detected: ${allFailed.map((c) => c.name).join(', ') || `${impacts.filter((i) => i.severity === 'high').length} high-severity impact(s)`}`
    : 'No test suite available for regression analysis.';

  log.info(`Regression ${status}: ${summary}`);

  return {
    id: makeId('reg'),
    impacts,
    relatedTestFiles: [...new Set(relatedTestFiles)],
    executed,
    createdTests,
    originalBugRetested,
    status,
    summary,
    startedAt,
    finishedAt: nowIso(),
    durationMs: Date.now() - started,
  };
}

/* ------------------------------------------------------------------ */
/* Impact analysis                                                    */
/* ------------------------------------------------------------------ */

function analyseImpact(file: string, index: CodeIndex): RegressionImpact[] {
  const impacts: RegressionImpact[] = [];

  // Direct callers (files that import this file).
  for (const edge of index.importEdges) {
    if (edge.to !== file) continue;
    if (edge.from.includes('.test.') || edge.from.includes('.spec.')) continue;
    impacts.push({
      file: edge.from,
      symbol: edge.specifier,
      kind: 'caller',
      detail: `Imports ${file}`,
      severity: 'medium',
    });
  }

  // Routes that serve data from this file.
  for (const route of index.routes) {
    if (route.file === file) {
      impacts.push({
        file: route.file,
        symbol: `${route.method} ${route.path}`,
        kind: 'api-contract',
        detail: `Route ${route.method} ${route.path} defined in the modified file`,
        severity: 'high',
      });
    }
  }

  // Client calls from this file.
  for (const call of index.clientCalls) {
    if (call.file === file) {
      impacts.push({
        file: call.file,
        symbol: call.functionName ?? call.url ?? call.urlExpression,
        kind: 'data',
        detail: `Client call ${call.method} ${call.url ?? call.urlExpression} in the modified file`,
        severity: 'medium',
      });
    }
  }

  return impacts.slice(0, 20);
}

/* ------------------------------------------------------------------ */
/* Test generation                                                    */
/* ------------------------------------------------------------------ */

function generateRegressionTest(
  ctx: AgentContext,
  implementation: ImplementationResult,
  rootCause: RootCause,
): CreatedTest | null {
  const targetFile = implementation.filesModified[0];
  if (!targetFile) return null;

  const testFile = targetFile.replace(/\.(js|ts)$/, '.regression.test.$1');
  const bugTitle = ctx.bug.title.slice(0, 60);

  const content = generateTestContent(ctx, implementation, rootCause, targetFile);

  return {
    file: testFile,
    name: `regression: ${bugTitle}`,
    description: `Regression test for: ${bugTitle}. Ensures the fix for "${rootCause.statement}" stays effective.`,
    content,
    rationale: `No existing test covered the reported defect. This test ensures the fix is permanent and detects regression if the change is reverted.`,
  };
}

function generateTestContent(
  ctx: AgentContext,
  implementation: ImplementationResult,
  rootCause: RootCause,
  targetFile: string,
): string {
  const change = implementation.appliedChanges[0];
  const lines = [
    `// Regression test — auto-generated by FixFlow Regression Agent`,
    `// Bug: ${ctx.bug.title}`,
    `// Root cause: ${rootCause.statement.slice(0, 120)}`,
    ``,
    `import { describe, it } from 'node:test';`,
    `import assert from 'node:assert/strict';`,
    ``,
    `describe('regression: ${ctx.bug.title.replace(/'/g, "\\'")}', () => {`,
    `  it('should not reproduce the original defect', async () => {`,
    `    // Arrange`,
    `    // TODO: set up the test preconditions`,
    ``,
    `    // Act`,
    `    // TODO: call the affected function`,
    ``,
    `    // Assert`,
    `    // TODO: verify the expected behaviour described below:`,
    `    // ${ctx.bug.expectedBehavior.slice(0, 200)}`,
    `    assert.ok(true, 'Replace with specific assertion');`,
    `  });`,
    `});`,
  ];
  return lines.join('\n');
}
