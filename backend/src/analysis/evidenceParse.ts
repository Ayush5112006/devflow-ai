import { STACK_FRAME, RUNTIME_ERROR_PATTERNS, HTTP_LINE } from './patterns.js';
import type { Evidence } from '../types/index.js';
import { evidence } from '../agents/types.js';

export interface ParsedFrame {
  symbol: string;
  location: string;
  file: string;
  line: number;
  column: number;
  raw: string;
}

export interface ParsedRuntimeError {
  kind: string;
  errorName: string;
  message: string;
  /** Property or symbol named in the message, when present. */
  subject: string;
  raw: string;
  offset: number;
}

export interface ParsedLogLine {
  line: number;
  raw: string;
  method?: string;
  path?: string;
  status?: number;
  level?: string;
  timestamp?: string;
}

/** Splits any evidence blob into individual lines with 1-based numbers. */
export function splitLines(text: string): { line: number; raw: string }[] {
  return text.split(/\r?\n/).map((raw, i) => ({ line: i + 1, raw }));
}

export function parseStackFrames(text: string): ParsedFrame[] {
  const frames: ParsedFrame[] = [];
  STACK_FRAME.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STACK_FRAME.exec(text)) !== null) {
    const location = m[2];
    // Only keep frames that point at a file we could actually look at.
    if (!/\.[cm]?[jt]sx?$|\.html$|\.vue$|\.svelte$/.test(location)) continue;
    const file = location.replace(/^file:\/\//, '').replace(/^.*\/insightboard\//, '');
    frames.push({
      symbol: (m[1] ?? '').replace(/^async\s+/, '') || '<anonymous>',
      location,
      file,
      line: Number(m[3]),
      column: Number(m[4]),
      raw: m[0],
    });
  }
  return frames;
}

export function parseRuntimeErrors(text: string): ParsedRuntimeError[] {
  const out: ParsedRuntimeError[] = [];
  for (const pattern of RUNTIME_ERROR_PATTERNS) {
    // These patterns are intentionally non-global; scan line by line so one
    // hit per line is collected and `exec` can never spin on lastIndex.
    for (const { line, raw } of splitLines(text)) {
      const m = pattern.re.exec(raw);
      if (!m) continue;
      const detail = pattern.capture(m);
      out.push({
        kind: pattern.kind,
        errorName: detail.errorName ?? m[1] ?? '',
        message: (m[0].trim() || detail.message || '').slice(0, 300),
        subject: detail.property ?? detail.symbol ?? detail.object ?? detail.message ?? '',
        raw: m[0].trim(),
        offset: line,
      });
    }
  }
  return dedupeBy(out, (e) => `${e.kind}|${e.message}`);
}

export function parseLogLines(text: string): ParsedLogLine[] {
  return splitLines(text).map(({ line, raw }) => {
    const out: ParsedLogLine = { line, raw };
    const trimmed = raw.trim();
    const level = /^\[?(\w{3,7})\]?\s/.exec(trimmed);
    if (level && /error|warn|info|debug|trace/i.test(level[1])) out.level = level[1].toLowerCase();
    const ts = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/.exec(trimmed);
    if (ts) out.timestamp = ts[1];
    const bracketTs = /^\[(\d{2}:\d{2}:\d{2}\.\d+)\]/.exec(trimmed);
    if (bracketTs) out.timestamp = bracketTs[1];
    const http = HTTP_LINE.exec(trimmed);
    if (http) {
      out.method = http[1];
      out.path = http[2];
      out.status = Number(http[3]);
      return out;
    }
    // `GET /undefined/api/predictions 404 1ms` without a leading verb-only match
    const loose = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)\s+(\d{3})\b/.exec(trimmed);
    if (loose) {
      out.method = loose[1];
      out.path = loose[2];
      out.status = Number(loose[3]);
    }
    return out;
  });
}

/** Request paths seen in a log, in order of appearance. */
export function extractRequestPaths(text: string): { path: string; status?: number; line: number }[] {
  const out: { path: string; status?: number; line: number }[] = [];
  for (const { line, raw } of parseLogLines(text)) {
    const m = /(?:^|\s)(\/(?:[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%{}$-]*)*))(?=\s|$)/.exec(raw);
    if (!m) continue;
    out.push({ path: m[1], status: undefined, line });
  }
  return out;
}

/** Words that look like identifiers inside quoted spans of free text. */
export function extractQuotedIdentifiers(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/['"`]([A-Za-z_$][\w$.-]{1,60})['"`]/g)) {
    const token = m[1];
    if (/^(https?|GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(token)) continue;
    out.add(token);
  }
  return [...out];
}

/** The literal word `undefined` appearing inside a URL path — a strong smell. */
export function findUndefinedInPaths(text: string): { path: string; line: number }[] {
  const out: { path: string; line: number }[] = [];
  for (const { line, raw } of parseLogLines(text)) {
    const m = /\/(?:undefined|null|NaN)(?:\/[^\s]*)?/.exec(raw);
    if (m) out.push({ path: m[0], line });
  }
  return out;
}

/** Phrases that start a database/driver error message. */
const DB_ERROR_TRIGGER = /\b(no such column|no such table|no such function|no such index|constraint failed|datatype mismatch|foreign key constraint failed|unique constraint failed|duplicate key value|permission denied|database is locked|column \S+ does not exist|table \S+ does not exist|ER_NO_SUCH_TABLE|ER_BAD_FIELD_ERROR|ER_DUP_ENTRY|SQLITE_ERROR|SQLITE_CONSTRAINT)\b/i;

/**
 * SQL / driver error text, e.g. `no such column: o.customer_name`.
 * The detail after the trigger phrase is kept, because the column or table
 * name the database complains about is what identifies the defect.
 */
export function findDatabaseErrors(text: string): { message: string; line: number; raw: string }[] {
  const out: { message: string; line: number; raw: string }[] = [];
  for (const { line, raw } of splitLines(text)) {
    const m = DB_ERROR_TRIGGER.exec(raw);
    if (!m) continue;
    const rest = raw.slice(m.index + m[0].length);
    // The detail ends at the first structural delimiter of a log/JSON line.
    const detail = rest.replace(/^[\s:=]+/, '').split(/["'`;,}\]]/)[0].trim().slice(0, 200);
    const message = detail ? `${m[0]}: ${detail}` : m[0];
    out.push({ message, line, raw: raw.trim().slice(0, 300) });
  }
  return out;
}

export function findJsonParseErrors(text: string): { line: number; raw: string }[] {
  const out: { line: number; raw: string }[] = [];
  for (const { line, raw } of splitLines(text)) {
    if (/SyntaxError:\s*Unexpected token|is not valid JSON|Failed to parse JSON/i.test(raw)) {
      out.push({ line, raw: raw.trim().slice(0, 300) });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Evidence construction                                               */
/* ------------------------------------------------------------------ */

export function logEvidence(
  source: Evidence['source'],
  attachmentName: string,
  line: number,
  description: string,
  snippet: string,
): Evidence {
  return evidence({
    kind: 'log',
    description: `${description} (${attachmentName}:${line})`,
    snippet: snippet.slice(0, 400),
    source,
  });
}

export function codeEvidence(
  source: Evidence['source'],
  file: string,
  line: number,
  description: string,
  snippet: string,
  symbol?: string,
): Evidence {
  return evidence({
    kind: 'code',
    description,
    snippet: snippet.trim().slice(0, 400),
    location: { file, line, symbol },
    source,
  });
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
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

export { dedupeBy };
