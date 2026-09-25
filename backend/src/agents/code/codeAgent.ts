import type { AgentContext, AgentDefinition, AgentResult } from '../types.js';
import type { CodeIndex, IndexedFile } from '../../analysis/codeIndex.js';
import { codeEvidence, parseRuntimeErrors, parseStackFrames } from '../../analysis/evidenceParse.js';
import { evidence, finding, signal } from '../types.js';
import type { Evidence, Finding, Signal } from '../../types/index.js';
import { readTextFile } from '../../utils/fsSafe.js';
import path from 'node:path';
import { q } from '../../utils/format.js';

/**
 * Code Investigation Agent
 * ────────────────────────
 * Reads the repository and reports: where the reported symbols live, how
 * execution reaches them, what they depend on, and which failure points are
 * unguarded. It never proposes a fix — that is the root-cause engine's job.
 */
export const codeAgent: AgentDefinition = {
  id: 'code',
  title: 'Code Investigation Agent',
  stage: 'investigation',
  parallelGroup: 'investigation',
  blocking: false,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const index: CodeIndex = ctx.index;
    const findings: Finding[] = [];
    const signals: Signal[] = [];

    /* --- 1. Localise the symbols named in the report and the logs --- */
    const targets = collectTargets(ctx, index);
    ctx.note(`localised ${targets.length} code target(s) from report and logs`);

    if (targets.length > 0) {
      const ev: Evidence[] = [];
      const files: string[] = [];
      const functions: string[] = [];

      for (const target of targets.slice(0, 25)) {
        const located = locateInIndex(index, target.name);
        if (located.length === 0) continue;
        for (const def of located.slice(0, 4)) {
          const file = index.files.get(def.file);
          if (!file) continue;
          const snippet = (file.lines[def.line - 1] ?? '').trim();
          ev.push(codeEvidence(
            'code',
            def.file,
            def.line,
            `Symbol ${q(def.name)} found in ${def.file}:${def.line}`,
            snippet,
            def.name,
          ));
          files.push(def.file);
          functions.push(def.name);
        }
        signals.push(signal({
          kind: 'symbol-located',
          statement: `${q(target.name)} is defined in ${located.length} place(s), first at ${located[0].file}:${located[0].line}.`,
          subject: target.name,
          source: 'code',
          weight: 0.55 * target.weight,
          evidence: ev.slice(-3),
          detail: {
            name: target.name,
            why: target.why,
            locations: located.slice(0, 6).map((d) => ({ file: d.file, line: d.line, kind: d.kind })),
          },
        }));
      }

      if (ev.length > 0) {
        findings.push(finding({
          agent: 'code',
          title: `Located ${new Set(functions).size} reported symbol(s) in the repository`,
          summary: [...new Set(functions)].slice(0, 12).join(', '),
          severity: 'medium',
          confidence: 0.8,
          impact: 'These are the only code locations the reported symptom can originate from.',
          files: [...new Set(files)],
          functions: [...new Set(functions)],
          evidence: ev,
          signals: [],
        }));
      }
    }

    /* --- 2. Build the call path into each target --- */
    const pathFinding = await tracePaths(ctx, index, targets);
    if (pathFinding) findings.push(pathFinding);

    /* --- 3. Audit error handling on the implicated code --- */
    const gaps = await auditErrorHandling(ctx, index, targets);
    findings.push(...gaps.findings);
    signals.push(...gaps.signals);

    /* --- 4. Property chains read on the implicated values --- */
    const chains = await analysePropertyChains(ctx, index, targets);
    findings.push(...chains.findings);
    signals.push(...chains.signals);

    return { findings, signals };
  },
};

/* ------------------------------------------------------------------ */
/* Target discovery                                                   */
/* ------------------------------------------------------------------ */

interface Target {
  name: string;
  why: string;
  weight: number;
}

function collectTargets(ctx: AgentContext, index: CodeIndex): Target[] {
  const seen = new Map<string, Target>();
  const add = (name: string, why: string, weight: number) => {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) return;
    if (/^(undefined|null|NaN|object|string|number|boolean)$/i.test(name)) return;
    const existing = seen.get(name);
    if (existing) { existing.weight = Math.max(existing.weight, weight); return; }
    seen.set(name, { name, why, weight });
  };

  // Symbols named by stack frames carry the most weight.
  for (const attachment of ctx.evidence) {
    for (const frame of parseStackFrames(attachment.excerpt)) {
      if (frame.symbol && frame.symbol !== '<anonymous>') {
        add(frame.symbol, `stack frame in ${attachment.name}`, 1);
      }
    }
    for (const err of parseRuntimeErrors(attachment.excerpt)) {
      if (err.subject && /^[A-Za-z_$][\w$]*$/.test(err.subject)) {
        add(err.subject, `named in runtime error in ${attachment.name}`, 0.95);
      }
    }
  }

  // Identifiers quoted in the report.
  const reportText = [ctx.bug.title, ctx.bug.description, ctx.bug.actualBehavior].join('\n');
  for (const m of reportText.matchAll(/[`'"]([A-Za-z_$][\w$]{2,})[`'"]/g)) {
    add(m[1], 'quoted in the bug report', 0.8);
  }

  // Function names that the report refers to in prose.
  for (const m of ctx.bug.description.matchAll(/\b([a-z][A-Za-z0-9_]{4,})\(\)/g)) {
    add(m[1], 'mentioned in the bug report', 0.7);
  }

  // A wildcard: the deepest-implemented file in the report's own vocabulary.
  void index;
  return [...seen.values()].sort((a, b) => b.weight - a.weight);
}

function locateInIndex(index: CodeIndex, name: string) {
  const direct = index.symbols.get(name) ?? [];
  if (direct.length > 0) return direct;
  // Fall back to a case-insensitive / partial match so we still localise.
  const lower = name.toLowerCase();
  const out: CodeIndex['symbols'] extends Map<string, infer V> ? V : never = [];
  for (const [symbol, defs] of index.symbols) {
    if (symbol.toLowerCase() === lower) out.push(...defs);
  }
  return out.slice(0, 4);
}

/* ------------------------------------------------------------------ */
/* 2. Call-path tracing                                               */
/* ------------------------------------------------------------------ */

async function tracePaths(
  ctx: AgentContext,
  index: CodeIndex,
  targets: Target[],
): Promise<Finding | null> {
  const files = new Set<string>();
  const functions = new Set<string>();
  const ev: Evidence[] = [];
  const edges: string[] = [];

  for (const target of targets.slice(0, 8)) {
    const defs = locateInIndex(index, target.name);
    if (defs.length === 0) continue;
    for (const def of defs.slice(0, 2)) {
      const callers = findCallers(index, def.name);
      functions.add(def.name);
      files.add(def.file);
      edges.push(`${def.name}() ← ${callers.length} caller(s): ${callers.slice(0, 4).map((c) => `${c.file}`).join(', ') || 'none found'}`);
      ev.push(codeEvidence('code', def.file, def.line, `Definition of ${def.name}()`, (index.files.get(def.file)?.lines[def.line - 1] ?? '').trim(), def.name));
      for (const caller of callers.slice(0, 3)) {
        ev.push(codeEvidence('code', caller.file, caller.line, `${def.name}() is called from ${caller.file}:${caller.line}`, caller.snippet));
        files.add(caller.file);
        functions.add(caller.symbol ?? '<anonymous>');
      }
    }
  }

  if (edges.length === 0) return null;
  ctx.note(`traced ${edges.length} execution path(s) into the reported symbols`);

  return finding({
    agent: 'code',
    title: 'Execution path into the reported symbols',
    summary: edges.slice(0, 6).join('\n'),
    severity: 'medium',
    confidence: 0.75,
    impact: 'Shows which entry points can reach the failing code, and therefore what a fix could break.',
    files: [...files],
    functions: [...functions],
    evidence: ev,
    signals: [],
  });
}

function findCallers(index: CodeIndex, symbol: string): { file: string; line: number; snippet: string; symbol: string | null }[] {
  const out: { file: string; line: number; snippet: string; symbol: string | null }[] = [];
  const re = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`);
  for (const file of index.files.values()) {
    if (!/\.[cm]?[jt]sx?$/.test(file.rel)) continue;
    if (file.rel.includes('.test.') || file.rel.includes('.spec.')) continue;
    for (let i = 0; i < file.lines.length; i += 1) {
      const text = file.blanked.split('\n')[i] ?? '';
      if (!re.test(text)) continue;
      // Skip the declaration itself.
      if (new RegExp(`(?:function|class)\\s+${symbol}\\b`).test(text)) continue;
      if (new RegExp(`(?:const|let|var)\\s+${symbol}\\s*=`).test(text)) continue;
      out.push({ file: file.rel, line: i + 1, snippet: (file.lines[i] ?? '').trim().slice(0, 200), symbol: null });
      if (out.length > 40) return out;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. Error-handling audit                                            */
/* ------------------------------------------------------------------ */

async function auditErrorHandling(
  ctx: AgentContext,
  index: CodeIndex,
  targets: Target[],
): Promise<{ findings: Finding[]; signals: Signal[] }> {
  const findings: Finding[] = [];
  const signals: Signal[] = [];
  const targetFiles = new Set<string>();

  for (const target of targets) {
    for (const def of locateInIndex(index, target.name)) targetFiles.add(def.file);
  }

  const ev: Evidence[] = [];
  for (const rel of targetFiles) {
    const file = index.files.get(rel);
    if (!file) continue;
    // A catch block with an empty or comment-only body swallows the failure.
    const emptyCatch = /catch\s*(?:\(([^)]*)\))?\s*\{\s*(?:\/\/[^\n]*\s*)*\}/g;
    for (let i = 0; i < file.lines.length; i += 1) {
      const text = file.lines[i] ?? '';
      const m = emptyCatch.exec(text);
      emptyCatch.lastIndex = 0;
      if (!m) continue;
      ev.push(codeEvidence('code', rel, i + 1, 'Empty catch block swallows an error without recording it', text.trim()));
    }
    // A try block around an await with no catch is fine; a bare `.catch(() => {})` is not.
    if (/\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/.test(file.source)) {
      ev.push(codeEvidence('code', rel, 1, 'Promise rejection handler discards the error silently', '.catch(() => {})'));
    }
  }

  if (ev.length > 0) {
    signals.push(signal({
      kind: 'error-handling-gap',
      statement: `${ev.length} error-handling gap(s) in the implicated files — failures are dropped without evidence.`,
      subject: 'error-handling',
      source: 'code',
      weight: 0.35,
      evidence: ev,
      detail: { files: [...targetFiles] },
    }));
    findings.push(finding({
      agent: 'code',
      title: 'Error handling gaps on the implicated path',
      summary: `${ev.length} swallowed or unrecorded failure path(s) near the reported symbols.`,
      severity: 'low',
      confidence: 0.7,
      impact: 'Explains why the failure surfaced as a blank UI rather than a visible error.',
      files: [...targetFiles],
      functions: [],
      evidence: ev,
      signals: [],
    }));
  }

  return { findings, signals };
}

/* ------------------------------------------------------------------ */
/* 4. Property-chain analysis on the implicated values                 */
/* ------------------------------------------------------------------ */

async function analysePropertyChains(
  ctx: AgentContext,
  index: CodeIndex,
  targets: Target[],
): Promise<{ findings: Finding[]; signals: Signal[] }> {
  const findings: Finding[] = [];
  const signals: Signal[] = [];

  // Which identifiers does the runtime error say were missing?
  const missing: { name: string; file?: string; line?: number; from: string }[] = [];
  for (const attachment of ctx.evidence) {
    for (const err of parseRuntimeErrors(attachment.excerpt)) {
      if (err.kind === 'null-property-access' && err.subject) {
        missing.push({ name: err.subject, from: attachment.name });
      }
    }
    for (const frame of parseStackFrames(attachment.excerpt)) {
      if (/\.[cm]?[jt]sx?$/.test(frame.file)) {
        missing.push({ name: frame.symbol, file: frame.file, line: frame.line, from: attachment.name });
      }
    }
  }

  const targetFiles = new Set<string>();
  for (const target of targets) {
    for (const def of locateInIndex(index, target.name)) {
      targetFiles.add(def.file);
      if (def.line) targetFiles.add(def.file);
    }
  }
  for (const m of missing) if (m.file) targetFiles.add(m.file);

  const ev: Evidence[] = [];
  for (const rel of [...targetFiles].slice(0, 30)) {
    const file = index.files.get(rel);
    if (!file || !/\.[cm]?[jt]sx?$/.test(rel)) continue;
    await readTextFile(path.join(index.root, rel)).catch(() => undefined);
    const lines = file.blanked.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const text = lines[i] ?? '';
      if (/^\s*(?:import|export)\b/.test(text)) continue;
      // Focus on reads of a dotted chain: `x.y` or `x?.y`.
      for (const m of text.matchAll(/\b([A-Za-z_$][\w$]*)\s*(?:\?\s*\.\s*|\.\s*)([A-Za-z_$][\w$]*)\s*(?:\?\s*\.\s*|\.\s*)?([A-Za-z_$][\w$]*)?/g)) {
        const [, base, second, third] = m;
        if (['console', 'window', 'document', 'JSON', 'Math', 'this', 'process'].includes(base)) continue;
        const chain = [base, second, third].filter(Boolean) as string[];
        if (chain.length < 2) continue;
        if (chain.some((p) => /^(length|prototype|constructor|toString|then|call|apply|bind)$/.test(p))) continue;

        // Is this chain the one that failed at runtime?
        const isFailurePath = missing.some((mm) => chain.includes(mm.name) || chain[chain.length - 1] === mm.name);
        if (!isFailurePath) continue;

        ev.push(codeEvidence('code', rel, i + 1, `Reads ${q(chain.join('.'))} in the failing path`, text.trim().slice(0, 200)));
      }
    }
    if (ev.length > 60) break;
  }

  if (ev.length > 0) {
    const chains = [...new Set(ev.map((e) => (e.snippet ?? '').match(/`([\w.?]+)`/)?.[1] ?? '').filter(Boolean))];
    ctx.note(`found ${ev.length} property read(s) on the failing path`);
    signals.push(signal({
      kind: 'api-field-missing',
      statement: `Failing path reads ${chains.slice(0, 4).map((c) => `${q(c)}`).join(', ')} — these are the fields the runtime proved absent.`,
      subject: chains[0] ?? 'unknown',
      source: 'code',
      weight: 0.8,
      evidence: ev.slice(0, 8),
      detail: { chains },
    }));
    findings.push(finding({
      agent: 'code',
      title: 'Property reads on the confirmed failing path',
      summary: chains.slice(0, 10).join(' · '),
      severity: 'high',
      confidence: 0.8,
      impact: 'Each of these reads is a place the value can be missing; the runtime error tells us which one actually was.',
      files: [...new Set(ev.map((e) => e.location?.file).filter(Boolean) as string[])],
      functions: [],
      evidence: ev,
      signals: [],
    }));
  }

  return { findings, signals };
}

/** Exposed for the change-plan generator, which reuses the caller search. */
export { findCallers, locateInIndex, collectTargets };
export type { Target, IndexedFile };

