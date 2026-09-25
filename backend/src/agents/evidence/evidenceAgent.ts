import type { AgentDefinition, AgentContext, AgentResult } from '../types.js';
import type { EvidenceAttachment } from '../../types/index.js';import {
  extractQuotedIdentifiers, findDatabaseErrors, findJsonParseErrors, findUndefinedInPaths,
  logEvidence, parseLogLines, parseRuntimeErrors, parseStackFrames,
} from '../../analysis/evidenceParse.js';
import { evidence, finding, signal } from '../types.js';
import type { Evidence, Finding, Signal } from '../../types/index.js';
import { q } from '../../utils/format.js';

/**
 * Documentation / Evidence Agent
 * ────────────────────────────────
 * Turns the bug report and every attachment into structured facts.
 * It asserts nothing about the code — it only reports what the evidence says,
 * which is what lets the root-cause engine weigh runtime truth against
 * static inference.
 */
export const evidenceAgent: AgentDefinition = {
  id: 'evidence',
  title: 'Documentation / Evidence Agent',
  stage: 'investigation',
  parallelGroup: 'investigation',
  blocking: false,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const findings: Finding[] = [];
    const signals: Signal[] = [];

    const report = await analyseReport(ctx);
    findings.push(report.finding);
    signals.push(...report.signals);

    for (const attachment of ctx.evidence) {
      const result = await analyseAttachment(ctx, attachment);
      findings.push(...result.findings);
      signals.push(...result.signals);
    }

    return { findings, signals };
  },
};

async function analyseReport(ctx: AgentContext) {
  const evidenceList: Evidence[] = [];
  const signals: Signal[] = [];
  const text = [
    ctx.bug.title,
    ctx.bug.description,
    ctx.bug.expectedBehavior,
    ctx.bug.actualBehavior,
    ...ctx.bug.reproSteps,
  ].join('\n');

  // Quoted identifiers in a report are often the field names under dispute.
  for (const identifier of extractQuotedIdentifiers(text)) {
    evidenceList.push(evidence({
      kind: 'report',
      description: `Bug report names the identifier ${q(identifier)}`,
      snippet: identifier,
      source: 'evidence',
    }));
  }

  if (ctx.bug.reproCommand) {
    signals.push(signal({
      kind: 'symbol-located',
      statement: `Reporter supplied a reproduction command: ${ctx.bug.reproCommand}`,
      subject: ctx.bug.reproCommand,
      source: 'evidence',
      weight: 0.6,
      evidence: [evidence({
        kind: 'report',
        description: 'Reproduction command from the bug report',
        snippet: ctx.bug.reproCommand,
        source: 'evidence',
      })],
      detail: { reproCommand: ctx.bug.reproCommand },
    }));
  }

  if (ctx.bug.lastKnownGoodRef) {
    signals.push(signal({
      kind: 'symbol-located',
      statement: `Reporter believes the last known good state is ${ctx.bug.lastKnownGoodRef}`,
      subject: ctx.bug.lastKnownGoodRef,
      source: 'evidence',
      weight: 0.5,
      evidence: [evidence({
        kind: 'report',
        description: 'Last known good reference from the bug report',
        snippet: ctx.bug.lastKnownGoodRef,
        source: 'evidence',
      })],
      detail: { lastKnownGoodRef: ctx.bug.lastKnownGoodRef },
    }));
  }

  const finding: Finding = {
    id: '',
    agent: 'evidence',
    title: 'Bug report parsed',
    summary: `"${ctx.bug.title}" — severity ${ctx.bug.severity}, ${ctx.bug.reproSteps.length} reproduction steps, ${ctx.evidence.length} attachments.`,
    severity: 'info',
    confidence: 1,
    impact: 'Defines the symptom the investigation must explain.',
    files: [],
    functions: [],
    evidence: evidenceList.length > 0 ? evidenceList : [evidence({
      kind: 'report',
      description: 'Bug report body',
      snippet: ctx.bug.actualBehavior.slice(0, 300),
      source: 'evidence',
    })],
    signals: [],
    durationMs: 0,
  };

  return { finding, signals };
}

async function analyseAttachment(ctx: AgentContext, attachment: EvidenceAttachment) {
  const findings: Finding[] = [];
  const signals: Signal[] = [];
  const text = attachment.excerpt;

  /* ---- runtime errors ---- */
  const runtimeErrors = parseRuntimeErrors(text);
  for (const err of runtimeErrors) {
    const frames = parseStackFrames(text);
    const ev: Evidence[] = [
      logEvidence('evidence', attachment.name, 0, `Runtime error: ${err.message}`, err.raw),
    ];
    for (const frame of frames.slice(0, 4)) {
      ev.push(evidence({
        kind: 'log',
        description: `Stack frame in ${frame.symbol} at ${frame.file}:${frame.line}`,
        snippet: frame.raw.trim(),
        location: { file: frame.file, line: frame.line, symbol: frame.symbol },
        source: 'evidence',
      }));
    }

    const signalsForError: Signal[] = [];
    if (err.kind === 'null-property-access' && err.subject) {
      signalsForError.push(signal({
        kind: 'runtime-null-access',
        statement: `Runtime TypeError: reading '${err.subject}' of an undefined value — the value read to get there was never present.`,
        subject: err.subject,
        source: 'evidence',
        weight: 0.9,
        evidence: ev,
        detail: {
          property: err.subject,
          frames: frames.map((f) => ({ file: f.file, line: f.line, symbol: f.symbol })),
        },
      }));
    }
    if (err.kind === 'not-a-function' && err.subject) {
      signalsForError.push(signal({
        kind: 'runtime-null-access',
        statement: `Runtime TypeError: ${err.subject} is not a function — the imported or fetched value has the wrong shape.`,
        subject: err.subject,
        source: 'evidence',
        weight: 0.8,
        evidence: ev,
        detail: { symbol: err.subject },
      }));
    }
    if (err.kind === 'generic-error' && /json/i.test(err.message)) {
      signalsForError.push(signal({
        kind: 'runtime-null-access',
        statement: `Runtime error: ${err.message}`,
        subject: 'json-parse',
        source: 'evidence',
        weight: 0.5,
        evidence: ev,
        detail: { message: err.message },
      }));
    }

    // Frames that point at project files are the strongest localisation we have.
    for (const frame of frames) {
      if (!/\.[cm]?[jt]sx?$/.test(frame.file)) continue;
      signalsForError.push(signal({
        kind: 'symbol-located',
        statement: `Runtime stack points at ${frame.file}:${frame.line} in ${frame.symbol}()`,
        subject: frame.file,
        source: 'evidence',
        weight: 0.7,
        evidence: ev,
        detail: { file: frame.file, line: frame.line, symbol: frame.symbol },
      }));
    }

    findings.push(finding({
      agent: 'evidence',
      title: `Runtime error in ${attachment.name}`,
      summary: err.message.slice(0, 220),
      severity: 'high',
      confidence: 0.95,
      impact: 'Observed production failure. Any hypothesis must explain this exact error.',
      files: [...new Set(frames.map((f) => f.file))],
      functions: [...new Set(frames.map((f) => f.symbol))],
      evidence: ev,
      signals: signalsForError,
    }));
    signals.push(...signalsForError);
  }

  /* ---- literal `undefined` inside request paths ---- */
  const undefinedPaths = findUndefinedInPaths(text);
  if (undefinedPaths.length > 0) {
    const ev = undefinedPaths.slice(0, 4).map((p) =>
      logEvidence('evidence', attachment.name, p.line, `Request path contains a literal \`undefined\` segment: ${p.path}`, p.path));
    signals.push(signal({
      kind: 'env-undeclared',
      statement: `A request went to "${undefinedPaths[0].path}" — an interpolated configuration value was undefined at runtime.`,
      subject: 'undefined-in-url',
      source: 'evidence',
      weight: 0.95,
      evidence: ev,
      detail: { paths: undefinedPaths.map((p) => p.path) },
    }));
    findings.push(finding({
      agent: 'evidence',
      title: 'Request URL built from an undefined value',
      summary: `Logged request paths include "${undefinedPaths[0].path}", so a value interpolated into the URL was undefined.`,
      severity: 'high',
      confidence: 0.9,
      impact: 'All browser traffic to the API is misrouted, which explains a fully empty dashboard.',
      files: [],
      functions: [],
      evidence: ev,
      signals: [],
    }));
  }

  /* ---- JSON parse failure (an HTML body reaching response.json) ---- */
  const jsonErrors = findJsonParseErrors(text);
  if (jsonErrors.length > 0) {
    const ev = jsonErrors.slice(0, 3).map((e) =>
      logEvidence('evidence', attachment.name, e.line, 'response.json() received a non-JSON body', e.raw));
    const accompanying = parseLogLines(text).filter((l) => l.status === 404).slice(0, 3);
    signals.push(signal({
      kind: 'env-undeclared',
      statement: 'response.json() threw on an HTML body, so the request resolved to the static file server instead of the API.',
      subject: 'html-body-to-json',
      source: 'evidence',
      weight: 0.75,
      evidence: ev,
      detail: { notFoundCount: accompanying.length },
    }));
    findings.push(finding({
      agent: 'evidence',
      title: 'JSON parse failure on a 404 HTML response',
      summary: 'The client called response.json() on an HTML error page.',
      severity: 'high',
      confidence: 0.85,
      impact: 'The UI swallows the real HTTP failure and reports a confusing SyntaxError instead.',
      files: [],
      functions: [],
      evidence: ev,
      signals: [],
    }));
  }

  /* ---- database errors ---- */
  const dbErrors = findDatabaseErrors(text);
  for (const dbErr of dbErrors) {
    const frames = parseStackFrames(text);
    const columnMatch = /no such column:\s*(\S+?)(?:\s*$|\s*\n)/i.exec(dbErr.message);
    const tableMatch = /no such table:\s*(\S+?)(?:\s*$|\s*\n)/i.exec(dbErr.message);
    const subject = columnMatch?.[1] ?? tableMatch?.[1] ?? dbErr.message;
    const column = columnMatch ? stripTableQualifier(columnMatch[1]) : null;
    const table = tableMatch?.[1] ?? (columnMatch ? qualifierOf(columnMatch[1]) : null);

    const ev: Evidence[] = [logEvidence('evidence', attachment.name, dbErr.line, `Database error: ${dbErr.message}`, dbErr.raw)];
    let columnHint = 'The statement was rejected.';
    if (column) columnHint = `Column ${q(column)}${table ? ` on table ${q(table)}` : ''} does not exist.`;
    else if (table) columnHint = `Table ${q(table)} does not exist.`;
    for (const frame of frames) {
      if (!/\.[cm]?[jt]sx?$/.test(frame.file)) continue;
      ev.push(evidence({
        kind: 'log',
        description: `Database call originates at ${frame.file}:${frame.line} in ${frame.symbol}()`,
        snippet: frame.raw.trim(),
        location: { file: frame.file, line: frame.line, symbol: frame.symbol },
        source: 'evidence',
      }));
    }

    const dbSignals: Signal[] = [signal({
      kind: 'db-column-missing',
      statement: `Database rejected the query: ${dbErr.message}`,
      subject: column ?? subject,
      source: 'evidence',
      weight: 0.95,
      evidence: ev,
      detail: {
        column,
        table,
        message: dbErr.message,
        frames: frames.filter((f) => /\.[cm]?[jt]sx?$/.test(f.file)).map((f) => ({ file: f.file, line: f.line, symbol: f.symbol })),
      },
    })];

    findings.push(finding({
      agent: 'evidence',
      title: `Database error: ${dbErr.message}`,
      summary: `The database rejected a statement. ${columnHint}`,
      severity: 'high',
      confidence: 0.95,
      impact: 'The affected endpoint returns HTTP 500 for every request.',
      files: [...new Set(frames.filter((f) => /\.[cm]?[jt]sx?$/.test(f.file)).map((f) => f.file))],
      functions: [...new Set(frames.map((f) => f.symbol))],
      evidence: ev,
      signals: dbSignals,
    }));
    signals.push(...dbSignals);
  }

  /* ---- HTTP status summary ---- */
  const statuses = parseLogLines(text).filter((l) => typeof l.status === 'number');
  const serverErrors = statuses.filter((l) => (l.status ?? 0) >= 400);
  if (serverErrors.length > 0) {
    const byPath = new Map<string, number>();
    for (const l of serverErrors) {
      const key = `${l.status} ${l.path ?? l.raw.slice(0, 40)}`;
      byPath.set(key, (byPath.get(key) ?? 0) + 1);
    }
    const ev = [...byPath.entries()].slice(0, 6).map(([key, count]) =>
      logEvidence('evidence', attachment.name, 0, `${count}× ${key}`, key));
    findings.push(finding({
      agent: 'evidence',
      title: 'HTTP failures observed in access log',
      summary: [...byPath.keys()].join(' · '),
      severity: 'high',
      confidence: 0.9,
      impact: 'Users are served errors rather than data.',
      files: [],
      functions: [],
      evidence: ev,
      signals: [],
    }));
  }

  if (findings.length === 0) {
    findings.push(finding({
      agent: 'evidence',
      title: `Reviewed ${attachment.name}`,
      summary: `No machine-extractable signal in ${attachment.name} (${attachment.bytes} bytes).`,
      severity: 'info',
      confidence: 1,
      impact: 'Attachment contributes context only.',
      files: [],
      functions: [],
      evidence: [evidence({
        kind: 'log',
        description: `Attachment ${attachment.name} (${attachment.kind})`,
        snippet: attachment.excerpt.slice(0, 240),
        source: 'evidence',
      })],
      signals: [],
    }));
  }

  return { findings, signals };
}

function stripTableQualifier(name: string): string {
  return name.includes('.') ? name.split('.').pop() as string : name;
}

function qualifierOf(name: string): string | null {
  return name.includes('.') ? (name.split('.')[0] as string) : null;
}

