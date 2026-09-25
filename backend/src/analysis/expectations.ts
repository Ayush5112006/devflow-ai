import type { EvidenceAttachment } from '../types/index.js';
import {
  findDatabaseErrors, findJsonParseErrors, findUndefinedInPaths, parseRuntimeErrors, parseStackFrames,
} from './evidenceParse.js';

/**
 * A single, shared reading of the evidence bundle.
 *
 * Every investigation agent needs the same facts — which property the runtime
 * said was missing, which files the stack pointed at, which column the
 * database rejected. Parsing once and sharing the result keeps the agents
 * consistent with each other, which is what makes corroboration meaningful.
 */
export interface EvidenceExpectation {
  /** Property names the runtime error said could not be read. */
  missingProperties: { name: string; attachment: string }[];
  /** Symbols and locations named by stack frames. */
  frames: { symbol: string; file: string; line: number; column: number; attachment: string }[];
  /** Request paths seen in logs. */
  requestPaths: { path: string; status?: number; attachment: string; line: number }[];
  /** Paths containing a literal `undefined` / `null` / `NaN` segment. */
  malformedPaths: { path: string; attachment: string; line: number }[];
  /** Database errors, with the column/table they name. */
  databaseErrors: { message: string; column: string | null; table: string | null; attachment: string; line: number }[];
  /** response.json() consumed a non-JSON body. */
  jsonParseFailures: { attachment: string; line: number }[];
  /** Generic error names (TypeError, SyntaxError, ReferenceError…). */
  errorNames: string[];
  /** All identifier-looking tokens quoted anywhere in the evidence. */
  quotedIdentifiers: string[];
  /** Line-level evidence text, keyed by attachment, for snippet lookups. */
  textByAttachment: Map<string, string>;
}

export function deriveExpectations(evidence: EvidenceAttachment[]): EvidenceExpectation {
  const out: EvidenceExpectation = {
    missingProperties: [],
    frames: [],
    requestPaths: [],
    malformedPaths: [],
    databaseErrors: [],
    jsonParseFailures: [],
    errorNames: [],
    quotedIdentifiers: [],
    textByAttachment: new Map(),
  };

  for (const attachment of evidence) {
    const text = attachment.excerpt;
    out.textByAttachment.set(attachment.name, text);

    for (const err of parseRuntimeErrors(text)) {
      if (err.errorName) out.errorNames.push(err.errorName);
      if (err.kind === 'null-property-access' && err.subject) {
        out.missingProperties.push({ name: err.subject, attachment: attachment.name });
      }
    }

    for (const frame of parseStackFrames(text)) {
      if (!/\.[cm]?[jt]sx?$|\.html$/.test(frame.file)) continue;
      out.frames.push({ ...frame, attachment: attachment.name });
    }

    for (const p of findUndefinedInPaths(text)) {
      out.malformedPaths.push({ ...p, attachment: attachment.name });
    }

    for (const line of text.split(/\r?\n/)) {
      const m = /(?:^|\s)(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/\S*?)(?:\s+(\d{3})\b)?/.exec(line.trim());
      if (m) {
        out.requestPaths.push({ path: m[2], status: m[3] ? Number(m[3]) : undefined, attachment: attachment.name, line: 0 });
      }
    }

    for (const dbErr of findDatabaseErrors(text)) {
      const column = /no such column:\s*(\S+)/i.exec(dbErr.message)?.[1] ?? null;
      const table = /no such table:\s*(\S+)/i.exec(dbErr.message)?.[1] ?? null;
      out.databaseErrors.push({
        message: dbErr.message,
        column: column ? (column.includes('.') ? (column.split('.').pop() as string) : column) : null,
        table: table ?? (column && column.includes('.') ? (column.split('.')[0] as string) : null),
        attachment: attachment.name,
        line: dbErr.line,
      });
    }

    for (const j of findJsonParseErrors(text)) {
      out.jsonParseFailures.push({ attachment: attachment.name, line: j.line });
    }

    for (const m of text.matchAll(/['"`]([A-Za-z_$][\w$.-]{1,60})['"`]/g)) {
      out.quotedIdentifiers.push(m[1]);
    }
  }

  out.missingProperties = uniqueBy(out.missingProperties, (m) => m.name);
  out.errorNames = [...new Set(out.errorNames)];
  out.quotedIdentifiers = [...new Set(out.quotedIdentifiers)];
  out.frames = uniqueBy(out.frames, (f) => `${f.file}:${f.line}`);
  out.requestPaths = uniqueBy(out.requestPaths, (r) => r.path);
  out.malformedPaths = uniqueBy(out.malformedPaths, (m) => m.path);
  out.databaseErrors = uniqueBy(out.databaseErrors, (d) => d.message);
  out.jsonParseFailures = uniqueBy(out.jsonParseFailures, (j) => `${j.attachment}:${j.line}`);

  return out;
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
