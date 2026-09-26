import type { AgentContext, AgentDefinition, AgentResult } from '../types.js';
import type { CodeIndex } from '../../analysis/codeIndex.js';
import { tryRun } from '../../utils/exec.js';
import { codeEvidence, parseStackFrames } from '../../analysis/evidenceParse.js';
import { evidence, finding, signal } from '../types.js';
import type { Evidence, Finding, Signal } from '../../types/index.js';
import { q } from '../../utils/format.js';

/**
 * Test Agent
 * ──────────
 * Discovers the test runner, executes the suite, and reports which tests fail
 * and which source files those failures implicate. It also reports the
 * coverage gap: the set of reported symptoms that no test exercises.
 */
export const testAgent: AgentDefinition = {
  id: 'test',
  title: 'Test Agent',
  stage: 'investigation',
  parallelGroup: 'investigation',
  blocking: false,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const index = ctx.index;
    const findings: Finding[] = [];
    const signals: Signal[] = [];

    findings.push(inventory(index));

    const testScript = pickTestScript(index);
    if (!testScript) {
      signals.push(signal({
        kind: 'coverage-gap',
        statement: 'The project exposes no test script, so no automated check can corroborate a hypothesis.',
        subject: 'no-test-runner',
        source: 'test',
        weight: 0.4,
        evidence: [],
        detail: { scripts: Object.keys(index.scripts) },
      }));
      findings.push(finding({
        agent: 'test',
        title: 'No runnable test suite detected',
        summary: `package.json scripts: ${Object.keys(index.scripts).join(', ') || 'none'}`,
        severity: 'medium',
        confidence: 1,
        impact: 'Verification will have no automated signal to work from.',
        files: index.files.has('package.json') ? ['package.json'] : [],
        functions: [],
        evidence: [],
        signals: [],
      }));
      return { findings, signals };
    }

    ctx.note(`running ${q(testScript.command)} with runner "${index.testRunner}"`);
    const run = await tryRun(testScript.command, { cwd: index.root });
    const parsed = parseTestOutput(run.stdout + run.stderr, run.exitCode);
    ctx.note(`${parsed.passed} passed / ${parsed.failed} failed in ${Math.round(run.durationMs)}ms`);

    // Build the evidence bundle.
    const outputTail = (run.stdout + run.stderr).split('\n').slice(-60).join('\n');
    const runEvidence: Evidence[] = [
      evidence({
        kind: 'test',
        description: `${q(testScript.command)} exited with code ${run.exitCode}`,
        snippet: outputTail.slice(0, 1200),
        source: 'test',
      }),
    ];

    findings.push(finding({
      agent: 'test',
      title: `Test suite baseline — ${parsed.total} test(s), ${parsed.failed} failing`,
      summary: [
        `command: ${testScript.command}`,
        `runner: ${index.testRunner}`,
        `exit code: ${run.exitCode} in ${Math.round(run.durationMs)}ms`,
        parsed.failed > 0 ? `failing: ${parsed.failedNames.slice(0, 10).join(', ')}` : 'no failures',
      ].join('\n'),
      severity: parsed.failed > 0 ? 'high' : 'info',
      confidence: 1,
      impact: 'The failing set is the strongest single piece of evidence available to this investigation.',
      files: parsed.failureFiles.slice(0, 20),
      functions: [],
      evidence: runEvidence,
      signals: [],
    }));

    if (parsed.failed > 0) {
      const failingFiles = [...new Set(parsed.failureFiles)];
      const failingSymbols = [...new Set(parsed.failureSymbols)];

      signals.push(signal({
        kind: 'test-failing',
        statement: `${parsed.failed} test(s) fail on the baseline: ${parsed.failedNames.slice(0, 6).join(' · ')}`,
        subject: failingFiles[0] ?? 'tests',
        source: 'test',
        weight: 0.8,
        evidence: runEvidence,
        detail: {
          command: testScript.command,
          failedNames: parsed.failedNames,
          total: parsed.total,
          passed: parsed.passed,
          files: failingFiles,
          symbols: failingSymbols,
        },
      }));

      for (const file of failingFiles.slice(0, 10)) {
        signals.push(signal({
          kind: 'test-failing',
          statement: `Failing test stack frames implicate ${file}`,
          subject: file,
          source: 'test',
          weight: 0.7,
          evidence: runEvidence,
          detail: { file },
        }));
      }

      // Map failing test files onto the production code they exercise.
      const ev: Evidence[] = [];
      const relatedSource: string[] = [];
      for (const testFile of failingFiles.slice(0, 6)) {
        for (const imported of importsOf(index, testFile)) {
          relatedSource.push(imported);
          ev.push(codeEvidence('test', testFile, 1, `Failing suite ${q(testFile)} imports ${imported}`, `import ... from '${imported}'`));
        }
      }
      if (relatedSource.length > 0) {
        findings.push(finding({
          agent: 'test',
          title: 'Production code exercised by the failing suites',
          summary: [...new Set(relatedSource)].slice(0, 12).join('\n'),
          severity: 'high',
          confidence: 0.85,
          impact: 'A change to any of these files is what a fix must target, and what regression testing must re-check.',
          files: [...new Set(relatedSource)],
          functions: failingSymbols,
          evidence: ev,
          signals: [],
        }));
      }
    }

    /* --- coverage gap: does any test exercise the reported symptom? --- */
    const symptomTokens = symptomKeywords(ctx);
    const matchingTests = index.tests.filter((t) =>
      symptomTokens.some((token) => t.name.toLowerCase().includes(token)));

    if (matchingTests.length === 0) {
      signals.push(signal({
        kind: 'coverage-gap',
        statement: `No existing test mentions ${symptomTokens.slice(0, 3).map((t) => `${q(t)}`).join(', ')} — the reported failure is not covered by the suite.`,
        subject: symptomTokens[0] ?? 'uncovered',
        source: 'test',
        weight: 0.5,
        evidence: runEvidence,
        detail: { keywords: symptomTokens, totalTests: parsed.total },
      }));
      findings.push(finding({
        agent: 'test',
        title: 'The reported failure is not covered by any test',
        summary: `The suite has ${parsed.total} tests; none references ${symptomTokens.slice(0, 4).join(', ')}. This is why the defect reached production.`,
        severity: 'medium',
        confidence: 0.8,
        impact: 'A regression test is required to prevent this class of defect returning.',
        files: [],
        functions: [],
        evidence: runEvidence,
        signals: [],
      }));
    } else {
      signals.push(signal({
        kind: 'symbol-located',
        statement: `Existing coverage for the reported area: ${matchingTests.slice(0, 5).map((t) => `${t.name} (${t.file}:${t.line})`).join(', ')}`,
        subject: matchingTests[0].name,
        source: 'test',
        weight: 0.6,
        evidence: runEvidence,
        detail: { tests: matchingTests.map((t) => ({ name: t.name, file: t.file, line: t.line })) },
      }));
    }

    return { findings, signals };
  },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** What the suite currently covers, before anything is run. */
function inventory(index: CodeIndex) {
  const byFile = new Map<string, number>();
  for (const t of index.tests) byFile.set(t.file, (byFile.get(t.file) ?? 0) + 1);
  const ev: Evidence[] = [...byFile.entries()].slice(0, 20).map(([file, count]) =>
    codeEvidence('test', file, 1, `${count} test case(s) in ${file}`, file));

  return finding({
    agent: 'test',
    title: `Test inventory — ${index.tests.length} test case(s) in ${byFile.size} file(s)`,
    summary: [...byFile.entries()].map(([file, count]) => `${count}  ${file}`).join('\n') || 'No test cases were found.',
    severity: 'info',
    confidence: 0.95,
    impact: 'Baseline coverage map used later to judge whether a fix is protected by a test.',
    files: [...byFile.keys()],
    functions: [],
    evidence: ev,
    signals: [],
  });
}


export interface TestScript {
  name: string;
  command: string;
}

export function pickTestScript(index: CodeIndex): TestScript | null {
  for (const preferred of ['test', 'test:unit', 'test:ci']) {
    const script = index.scripts[preferred];
    if (script) return { name: preferred, command: `npm run ${preferred}` };
  }
  const anyTest = Object.entries(index.scripts).find(([name]) => /^test\b/.test(name));
  if (anyTest) return { name: anyTest[0], command: `npm run ${anyTest[0]}` };
  return null;
}

export interface ParsedTests {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  failedNames: string[];
  failureFiles: string[];
  failureSymbols: string[];
  timedOut: boolean;
}

/** Understands TAP and the default `spec` reporter. */
export function parseTestOutput(output: string, exitCode: number): ParsedTests {
  const result: ParsedTests = {
    total: 0, passed: 0, failed: 0, skipped: 0,
    failedNames: [], failureFiles: [], failureSymbols: [], timedOut: false,
  };

  // TAP counters
  const counters: Record<string, number> = {};
  for (const m of output.matchAll(/^#\s+(tests|pass|fail|skipped|todo)\s+(\d+)\s*$/gm)) {
    counters[m[1]] = Number(m[2]);
  }

  const tapResults: { ok: boolean; name: string }[] = [];
  for (const m of output.matchAll(/^(not ok|ok)\s+(\d+)\s+-\s+(.+)$/gm)) {
    tapResults.push({ ok: m[1] === 'ok', name: m[3].trim() });
  }

  if (tapResults.length > 0) {
    for (const r of tapResults) {
      if (r.ok) result.passed += 1;
      else { result.failed += 1; result.failedNames.push(r.name); }
    }
    result.total = counters.tests ?? result.passed + result.failed;
    result.skipped = counters.skipped ?? 0;
  } else {
    // spec reporter
    for (const m of output.matchAll(/^\s*[✔✓]\s+(.+?)(?:\s+\(\d+[\d.]*m?s\))?\s*$/gm)) {
      result.passed += 1;
    }
    for (const m of output.matchAll(/^\s*[✖✗x]\s+(.+?)(?:\s+\(\d+[\d.]*m?s\))?\s*$/gm)) {
      result.failed += 1;
      result.failedNames.push(m[1].trim());
    }
    for (const m of output.matchAll(/^\s*-\s+(.+?)(?:\s+\(\d+[\d.]*m?s\))?\s*$/gm)) {
      result.skipped += 1;
    }
    result.total = counters.tests ?? result.passed + result.failed + result.skipped;
  }

  // If the runner reported nothing parseable but exited non-zero, say so honestly.
  if (result.total === 0 && exitCode !== 0) {
    result.total = 1;
    result.failed = 1;
    result.failedNames.push(`<suite exited with code ${exitCode} and produced no parseable results>`);
  }

  for (const frame of parseStackFrames(output)) {
    if (!/\.[cm]?[jt]sx?$/.test(frame.file)) continue;
    result.failureFiles.push(frame.file);
    if (frame.symbol && frame.symbol !== '<anonymous>') result.failureSymbols.push(frame.symbol);
  }
  for (const m of output.matchAll(/file:\/\/[^\s)]*?\/([A-Za-z0-9_./-]+\.[cm]?[jt]sx?):(\d+):(\d+)/g)) {
    const rel = m[1].replace(/^.*?\/(insightboard|src|server|web|test)\//, '$1/');
    if (/\.[cm]?[jt]sx?$/.test(rel) && !result.failureFiles.includes(rel)) result.failureFiles.push(rel);
  }

  result.failureFiles = [...new Set(result.failureFiles)];
  result.failureSymbols = [...new Set(result.failureSymbols)];
  return result;
}

function importsOf(index: CodeIndex, testFile: string): string[] {
  const out = new Set<string>();
  for (const edge of index.importEdges) {
    if (edge.from !== testFile) continue;
    if (!edge.specifier.startsWith('.')) continue;
    if (index.files.has(edge.to)) out.add(edge.to);
  }
  return [...out];
}

/** The concrete nouns from the bug report, used to look for existing coverage. */
function symptomKeywords(ctx: AgentContext): string[] {
  const text = [ctx.bug.title, ctx.bug.description, ctx.bug.actualBehavior].join(' ');
  const out = new Set<string>();
  for (const m of text.matchAll(/\b([a-z][A-Za-z0-9_]{3,})\b/g)) {
    const word = m[1].toLowerCase();
    if (['this', 'that', 'with', 'from', 'have', 'been', 'they', 'when', 'what', 'then', 'than', 'into', 'also', 'only', 'some', 'each', 'every', 'which', 'there', 'their', 'about', 'would', 'could', 'should', 'after', 'before', 'while', 'because'].includes(word)) continue;
    out.add(word);
  }
  for (const attachment of ctx.evidence) {
    for (const err of ctx.expectations.missingProperties) out.add(err.name.toLowerCase());
    void attachment;
  }
  return [...out].slice(0, 60);
}

export { parseTestOutput as __parseTestOutput, symptomKeywords };

