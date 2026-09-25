import path from 'node:path';
import { config } from '../config.js';
import { readTextFile, walkProject, toPosix } from '../utils/fsSafe.js';
import {
  CLASS_METHOD, CLIENT_CALL_PATTERNS, CREATE_TABLE, ENV_ACCESS_PATTERNS, ENV_DECL_PATTERN,
  FRAMEWORK_IMPORTS, FRAMEWORK_SIGNATURES, FUNCTION_PATTERNS, IMPORT_FROM, MONGOOSE_FIELD,
  PREPARED_SQL, PRISMA_FIELD, REQUIRE_CALL, ROUTE_PATTERNS, SEMANTIC_GROUPS, SEQUELIZE_FIELD,
  STOPWORDS, TEST_PATTERNS,
} from './patterns.js';
import {
  blankNonCode, lineAt, matchBrace, matchParen, objectKeys,
  type FunctionRange, type ObjectKey,
} from './lexer.js';
import type { ExecutionPathEdge, ProjectComponent, ProjectLayer, ProjectMap } from '../types/index.js';
import { nowIso } from '../utils/time.js';
import { id } from '../utils/id.js';

/* ------------------------------------------------------------------ */
/* Shapes                                                             */
/* ------------------------------------------------------------------ */

export interface IndexedFile {
  rel: string;
  layer: ProjectLayer;
  language: string;
  bytes: number;
  source: string;
  /** Comments and string bodies blanked. Use for braces, parens and chains. */
  blanked: string;
  /** Comments blanked, string bodies kept. Use for URL/path/keyword matching. */
  code: string;
  lines: string[];
}

export interface SymbolDef {
  name: string;
  kind: 'function' | 'class' | 'method' | 'component' | 'constant';
  file: string;
  line: number;
  exported: boolean;
}

export interface EnvRef {
  name: string;
  file: string;
  line: number;
  accessor: string;
  snippet: string;
}

export interface EnvDeclaration {
  name: string;
  file: string;
  line: number;
  value: string;
}

export interface RouteDef {
  id: string;
  framework: string;
  method: string;
  path: string;
  file: string;
  line: number;
  handler: string | null;
  /** Top-level keys the handler actually sends. */
  responseKeys: ObjectKey[];
  /** Where the response payload literal starts. */
  responseLiteralLine: number | null;
  envRefs: EnvRef[];
  /** SQL statements executed inside the handler range. */
  sql: string[];
}

export interface PropertyAccess {
  /** e.g. ['data', 'prediction'] */
  chain: string[];
  file: string;
  line: number;
  snippet: string;
}

export interface ClientCall {
  id: string;
  client: string;
  method: string;
  file: string;
  line: number;
  urlExpression: string;
  url: string | null;
  /** How `url` was derived, so findings can explain themselves. */
  urlSource: 'literal' | 'helper' | 'template-base' | 'unknown';
  /** `name@file:line` of the URL builder that was inlined, when applicable. */
  helper: string | null;
  envRefs: EnvRef[];
  /** Enclosing function range, used to scope property accesses. */
  functionName: string | null;
  functionStart: number;
  functionEnd: number;
  /** Property accesses found within the enclosing function. */
  accesses: PropertyAccess[];
  /** Response variable names assigned from the call, when detectable. */
  responseVars: string[];
}

export interface TableDef {
  name: string;
  file: string;
  line: number;
  columns: { name: string; type: string; line: number }[];
  source: 'sql' | 'orm';
}

export interface ModelDef {
  name: string;
  file: string;
  line: number;
  fields: { name: string; type: string; line: number }[];
  orm: string;
}

export interface QueryRef {
  file: string;
  line: number;
  sql: string;
  tables: string[];
  /** Every column the statement touches, regardless of table. */
  columns: string[];
  /** Per-table attribution, so `f.customer` is not blamed on `predictions`. */
  columnRefs: SqlColumnRef[];
}

export interface TestDef {
  name: string;
  file: string;
  line: number;
  kind: 'test' | 'suite';
}

export interface ImportEdge {
  from: string;
  to: string;
  specifier: string;
  line: number;
}

export interface CodeIndex {
  root: string;
  generatedAt: string;
  files: Map<string, IndexedFile>;
  fileCount: number;
  totalBytes: number;
  languageBreakdown: Record<string, number>;
  truncated: boolean;
  routes: RouteDef[];
  clientCalls: ClientCall[];
  symbols: Map<string, SymbolDef[]>;
  envRefs: EnvRef[];
  envDeclarations: EnvDeclaration[];
  tables: TableDef[];
  models: ModelDef[];
  queries: QueryRef[];
  tests: TestDef[];
  importEdges: ImportEdge[];
  packageManager: string;
  scripts: Record<string, string>;
  dependencies: string[];
  frameworks: string[];
  testRunner: string;
  entryPoints: { name: string; command: string; file?: string }[];
}

/* ------------------------------------------------------------------ */
/* Layer + language classification                                     */
/* ------------------------------------------------------------------ */

const LANGUAGE_BY_EXT: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.json': 'JSON', '.jsonc': 'JSON', '.sql': 'SQL', '.md': 'Markdown', '.mdx': 'Markdown',
  '.yml': 'YAML', '.yaml': 'YAML', '.html': 'HTML', '.css': 'CSS', '.py': 'Python',
  '.rb': 'Ruby', '.go': 'Go', '.java': 'Java', '.txt': 'Text', '.env': 'Dotenv',
};

const CONFIG_FILES = new Set([
  'package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js', 'next.config.js',
  'next.config.mjs', 'tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js',
  'eslint.config.js', '.eslintrc', '.eslintrc.js', '.eslintrc.json', 'jest.config.js',
  'vitest.config.ts', 'vitest.config.js', 'playwright.config.ts', 'Dockerfile',
  'docker-compose.yml', 'schema.prisma', 'Makefile', '.env', '.env.example', '.env.local',
  '.env.development', '.env.production', '.env.test', 'README.md', '.gitignore',
]);

function classifyLayer(rel: string): ProjectLayer {
  const lower = rel.toLowerCase();
  const base = path.basename(lower);
  const ext = path.extname(lower);

  if (ext === '.sql' || /(^|\/)(db|database|migrations?|schema|seeds?)(\/|$)/.test(lower) || base === 'schema.prisma') {
    return 'database';
  }
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(base) || /(^|\/)(__tests__|tests?|spec|e2e)(\/|$)/.test(lower)) {
    return 'tests';
  }
  if (ext === '.md' || ext === '.mdx' || ext === '.txt') return 'docs';
  if (ext === '.json' || ext === '.yml' || ext === '.yaml' || base.startsWith('.') || ext === '.css' || ext === '.html') {
    return 'config';
  }
  if (base.endsWith('.config.ts') || base.endsWith('.config.js') || base.endsWith('.config.mjs')) return 'config';
  if (/(^|\/)(scripts|tools|bin)(\/|$)/.test(lower)) return 'scripts';
  if (/(^|\/)(client|web|ui|frontend|app_public|public)(\/|$)/.test(lower)) return 'frontend';
  if (/(^|\/)(server|backend|api|services?|src\/routes?)(\/|$)/.test(lower)) return 'backend';
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'backend';
  return 'other';
}

function languageOf(rel: string): string {
  const ext = path.extname(rel).toLowerCase();
  if (LANGUAGE_BY_EXT[ext]) return LANGUAGE_BY_EXT[ext];
  const base = path.basename(rel);
  if (base.startsWith('.env')) return 'Dotenv';
  if (base === 'Dockerfile') return 'Dockerfile';
  return ext.replace('.', '').toUpperCase() || 'Text';
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function collectEnvRefs(file: IndexedFile): EnvRef[] {
  const refs: EnvRef[] = [];
  const lines = file.source.split('\n');
  for (const pattern of ENV_ACCESS_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(file.source)) !== null) {
      const line = lineAt(file.source, m.index);
      refs.push({
        name: m[1],
        file: file.rel,
        line,
        accessor: m[0].replace(m[1], '').replace(/\.$/, ''),
        snippet: (lines[line - 1] ?? '').trim().slice(0, 200),
      });
    }
  }
  return refs;
}

function collectSymbols(file: IndexedFile): SymbolDef[] {
  const out: SymbolDef[] = [];
  const lines = file.blanked.split('\n');

  for (const pattern of FUNCTION_PATTERNS.slice(0, 2)) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(file.blanked)) !== null) {
      const line = lineAt(file.blanked, m.index);
      if (m[1] === '_' || m[1] === 'React') continue;
      const text = lines[line - 1] ?? '';
      out.push({
        name: m[1],
        kind: /^[A-Z]/.test(m[1]) && /\.jsx?$/.test(file.rel) ? 'component' : 'function',
        file: file.rel,
        line,
        exported: /export/.test(text),
      });
    }
  }

  FUNCTION_PATTERNS[2].lastIndex = 0;
  let cm: RegExpExecArray | null;
  while ((cm = FUNCTION_PATTERNS[2].exec(file.blanked)) !== null) {
    out.push({
      name: cm[1],
      kind: 'class',
      file: file.rel,
      line: lineAt(file.blanked, cm.index),
      exported: /export/.test(lines[lineAt(file.blanked, cm.index) - 1] ?? ''),
    });
  }

  CLASS_METHOD.lastIndex = 0;
  let mm: RegExpExecArray | null;
  while ((mm = CLASS_METHOD.exec(file.blanked)) !== null) {
    const name = mm[1];
    if (['constructor', 'if', 'for', 'while', 'switch', 'catch', 'return', 'function'].includes(name)) continue;
    out.push({ name, kind: 'method', file: file.rel, line: lineAt(file.blanked, mm.index), exported: false });
  }

  const seen = new Set<string>();
  return out.filter((s) => {
    const k = `${s.kind}:${s.name}:${s.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function collectTests(file: IndexedFile): TestDef[] {
  const out: TestDef[] = [];
  if (file.layer !== 'tests' && !/\.(test|spec)\./.test(file.rel)) return out;
  for (const pattern of TEST_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(file.blanked)) !== null) {
      out.push({
        name: m[2],
        file: file.rel,
        line: lineAt(file.blanked, m.index),
        kind: pattern.source.startsWith('\\bdescribe') || m[0].startsWith('describe') ? 'suite' : 'test',
      });
    }
  }
  return out;
}

function collectImports(file: IndexedFile): ImportEdge[] {
  const out: ImportEdge[] = [];
  const dir = path.posix.dirname(file.rel);
  IMPORT_FROM.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMPORT_FROM.exec(file.blanked)) !== null) {
    out.push({ from: file.rel, to: '', specifier: m[1], line: lineAt(file.blanked, m.index), dir } as ImportEdge & { dir: string });
  }
  REQUIRE_CALL.lastIndex = 0;
  while ((m = REQUIRE_CALL.exec(file.blanked)) !== null) {
    out.push({ from: file.rel, to: '', specifier: m[1], line: lineAt(file.blanked, m.index), dir } as ImportEdge & { dir: string });
  }
  return out;
}

/**
 * Finds the offset of the first object-literal argument of a response sink.
 * Handles both `res.json(payload)` and `res.json(200, payload)`.
 */
function findPayloadObject(source: string, blanked: string, fromOffset: number): number | null {
  const open = blanked.indexOf('(', fromOffset);
  if (open === -1) return null;
  const close = matchParen(blanked, open);
  const end = close === -1 ? blanked.length : close;

  let depth = 0;
  let argStart = open + 1;
  for (let i = open + 1; i <= end; i += 1) {
    const c = blanked[i];
    if (c === '(' || c === '[' || c === '{') {
      if (depth === 0 && c === '{') {
        // First object literal at the top level of the argument list.
        let k = i;
        while (k < end && /\s/.test(blanked[k])) k += 1;
        if (k === i) return i;
      }
      depth += 1;
    } else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
    } else if (c === ',' && depth === 0) {
      argStart = i + 1;
    }
  }
  void source;
  void argStart;
  return null;
}

function collectRoutes(file: IndexedFile, fnRanges: FunctionRange[]): RouteDef[] {
  const out: RouteDef[] = [];
  if (!/\.[cm]?[jt]sx?$/.test(file.rel)) return out;

  const framework = FRAMEWORK_IMPORTS.find((f) => f.re.test(file.source))?.name ?? 'http-router';
  const seen = new Set<string>();

  for (const { re } of ROUTE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    // `code` keeps string bodies so the path literal is still visible; offsets
    // are identical to `blanked`, which stays the source of truth for braces.
    while ((m = re.exec(file.code)) !== null) {
      // Generic pattern: 1 = object, 2 = method, 3 = quote, 4 = path.
      // Next pattern:     1 = HTTP verb.
      const isNext = m[4] === undefined;
      const method = (m[2] ?? m[1] ?? 'GET').toUpperCase();
      const routePath = isNext ? '/(next-app-router)' : m[4];
      const line = lineAt(file.blanked, m.index);
      const afterArgs = m.index + m[0].length;

      // ---- locate the handler and its brace-matched body ------------------
      const callOpen = file.code.indexOf('(', m.index);
      const callClose = callOpen === -1 ? -1 : matchParen(file.blanked, callOpen);
      const args = callOpen === -1 || callClose === -1
        ? ''
        : splitArguments(file.source, file.blanked, callOpen, callClose).rest;
      const tail = callClose === -1
        ? file.code.slice(afterArgs, afterArgs + 300)
        : file.code.slice(callClose + 1, callClose + 301);
      // Inline handlers live *inside* the call: `.get('/x', (req, res) => { ... })`
      const inlineInArgs = /^\s*,?\s*(?:async\s+)?(?:function\s*\([^)]*\)\s*\{|\([^)]*\)\s*(?::[^=]*?)?=>\s*\{|[A-Za-z_$][\w$]*\s*=>\s*\{)/.test(args);
      const inlineAfter = /^\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::[^=]*?)?=>|[A-Za-z_$][\w$]*\s*=>)\s*\{/.test(tail);
      const namedInArgs = /^\s*,?\s*(?:async\s+)?(?:function\s+)?([A-Za-z_$][\w$]*)\s*$/.exec(args.trim());
      const named = /^\s*,?\s*(?:async\s+)?(?:function\s+)?([A-Za-z_$][\w$]*)\s*(?=[,)])/.exec(tail);

      let handler: string | null = null;
      let bodyStartOffset: number | null = null;
      let bodyEndOffset: number | null = null;
      let handlerStart = line;
      let handlerEnd = file.lines.length;

      if (inlineInArgs || inlineAfter) {
        const searchFrom = inlineInArgs ? callOpen : afterArgs;
        const brace = file.blanked.indexOf('{', searchFrom);
        if (brace !== -1) {
          bodyStartOffset = brace;
          bodyEndOffset = matchBrace(file.blanked, brace);
          handler = namedInArgs?.[1] ?? named?.[1] ?? '(inline handler)';
        }
      } else if (namedInArgs?.[1] || named?.[1]) {
        handler = namedInArgs?.[1] ?? named?.[1] ?? null;
        const range = handler ? fnRanges.find((r) => r.name === handler) : undefined;
        if (range) {
          bodyStartOffset = file.blanked.indexOf('{', range.startOffset);
          bodyEndOffset = range.endOffset;
          handlerStart = range.startLine;
          handlerEnd = range.endLine;
        }
      } else if (callClose === -1) {
        const brace = file.blanked.indexOf('{', afterArgs);
        if (brace !== -1) {
          bodyStartOffset = brace;
          bodyEndOffset = matchBrace(file.blanked, brace);
        }
      }

      const bodyFrom = bodyStartOffset ?? 0;
      const bodyTo = bodyEndOffset === null || bodyEndOffset === -1 ? file.blanked.length : bodyEndOffset;
      const handlerBody = file.blanked.slice(bodyFrom, bodyTo);

      // Response payload keys, from every sink in the handler so that both the
      // success and the error shape are represented.
      const responseKeys: ObjectKey[] = [];
      const responseLiteralLines: number[] = [];
      const sinkRe = /\b(?:res|reply|response|ctx)\s*\.\s*(?:json|send|end|body)\s*\(|\breturn\s*\{/g;
      let sink: RegExpExecArray | null;
      while ((sink = sinkRe.exec(handlerBody)) !== null) {
        const abs = bodyFrom + sink.index;
        const payload = findPayloadObject(file.source, file.blanked, abs);
        if (payload === null) continue;
        const keys = objectKeys(file.source, file.blanked, payload);
        if (keys.length === 0) continue;
        for (const k of keys) {
          if (k.name.startsWith('...')) continue;
          if (!responseKeys.some((existing) => existing.name === k.name)) responseKeys.push(k);
        }
        responseLiteralLines.push(keys[0].line);
      }
      const responseLiteralLine = responseLiteralLines[0] ?? null;

      const envRefs = collectEnvRefs(file).filter(
        (r) => r.line >= handlerStart && r.line <= handlerEnd,
      );
      const sql: string[] = [];
      PREPARED_SQL.lastIndex = 0;
      let q: RegExpExecArray | null;
      while ((q = PREPARED_SQL.exec(handlerBody)) !== null) sql.push(q[2].replace(/\s+/g, ' ').trim().slice(0, 400));

      out.push({
        id: id('rt'),
        framework,
        method,
        path: routePath,
        file: file.rel,
        line,
        handler,
        responseKeys,
        responseLiteralLine,
        envRefs,
        sql,
      });
    }
  }
  return out;
}

/** Extracts `a.b.c` chains from code, ignoring noise. */
const CHAIN_RE = /(?<![\w$.'"])([A-Za-z_$][\w$]*)((?:\s*\?\s*\.\s*|\s*\.\s*)([A-Za-z_$][\w$]*))((?:\s*\?\s*\.\s*|\s*\.\s*([A-Za-z_$][\w$]*))?)/g;

function collectPropertyAccesses(
  file: IndexedFile,
  startLine: number,
  endLine: number,
): PropertyAccess[] {
  const out: PropertyAccess[] = [];
  const lines = file.blanked.split('\n');
  for (let ln = startLine; ln <= Math.min(endLine, lines.length); ln += 1) {
    const text = lines[ln - 1] ?? '';
    if (/^\s*(?:import|export)\b/.test(text)) continue;
    if (/^\s*(?:const|let|var)\s+[\w$]+\s*=\s*\{/.test(text) && !/\?\./.test(text)) continue;
    CHAIN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CHAIN_RE.exec(text)) !== null) {
      const base = m[1];
      if (STOPWORDS.has(base)) continue;
      if (base === 'this' || base === 'super') continue;
      const parts = [base, m[3]];
      if (m[4]) parts.push(m[4]);
      if (parts.some((p) => STOPWORDS.has(p))) continue;
      out.push({
        chain: parts,
        file: file.rel,
        line: ln,
        snippet: text.trim().slice(0, 200),
      });
    }
  }
  return out;
}

/** Declaration shapes we treat as a function/method boundary. */
const FN_DECL_PATTERNS: RegExp[] = [
  /(?:^|[^\w$.])(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g,
  /(?:^|[^\w$.])(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\*?\s*\(|[A-Za-z_$][\w$]*\s*=>)/g,
  /(?:^|[^\w$.])(?:public\s+|private\s+|protected\s+|static\s+|async\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{\s*$/gm,
];

/**
 * Finds every function body in a file by brace matching.
 * This is what makes "which reads happen inside this function" answerable
 * without a full parser.
 */
export function collectFunctionRanges(blanked: string): FunctionRange[] {
  const out: FunctionRange[] = [];
  const seen = new Set<string>();

  for (const pattern of FN_DECL_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(blanked)) !== null) {
      const name = m[1];
      if (!name || name === 'if' || name === 'for' || name === 'while' || name === 'switch'
        || name === 'catch' || name === 'return' || name === 'function' || name === 'constructor') continue;

      const declStart = m.index + m[0].indexOf(name);
      // Find the body brace: first `{` after the parameter list closes.
      const parenStart = blanked.indexOf('(', declStart);
      if (parenStart === -1) continue;
      const parenEnd = matchParen(blanked, parenStart);
      if (parenEnd === -1) continue;
      const arrowBody = blanked.indexOf('=>', parenEnd);
      const braceOffset = (() => {
        if (arrowBody !== -1 && arrowBody < parenEnd + 4) {
          const afterArrow = blanked.indexOf('{', arrowBody);
          return afterArrow;
        }
        return blanked.indexOf('{', parenEnd);
      })();
      if (braceOffset === -1 || braceOffset > declStart + 4000) continue;
      // Reject control-flow look-alikes that slipped through.
      const between = blanked.slice(parenEnd + 1, braceOffset);
      if (/[;}]/.test(between)) continue;
      const close = matchBrace(blanked, braceOffset);
      if (close === -1) continue;
      if (close - declStart > 200_000) continue;

      const startLine = lineAt(blanked, declStart);
      const endLine = lineAt(blanked, close);
      const key = `${startLine}:${endLine}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, startLine, endLine, startOffset: declStart, endOffset: close });
      pattern.lastIndex = close;
    }
  }

  return out.sort((a, b) => (a.endOffset - a.startOffset) - (b.endOffset - b.startOffset));
}

/** Innermost function containing a line, or a whole-file fallback. */
export function enclosingFunctionRange(
  ranges: FunctionRange[],
  line: number,
  fileLineCount: number,
): { name: string | null; start: number; end: number } {
  for (const range of ranges) {
    if (line >= range.startLine && line <= range.endLine) {
      return { name: range.name, start: range.startLine, end: range.endLine };
    }
  }
  return { name: null, start: 1, end: fileLineCount };
}

function collectClientCalls(
  file: IndexedFile,
  fnRanges: FunctionRange[],
  helpers: Map<string, { template: string; file: string; line: number }>,
): ClientCall[] {
  const out: ClientCall[] = [];
  if (!/\.[cm]?[jt]sx?$/.test(file.rel)) return out;
  const fileEnvRefs = collectEnvRefs(file);

  for (const { client, re } of CLIENT_CALL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(file.code)) !== null) {
      const line = lineAt(file.code, m.index);
      const fn = enclosingFunctionRange(fnRanges, line, file.lines.length);
      const argStart = file.code.indexOf('(', m.index);
      const argEnd = argStart === -1 ? -1 : matchParen(file.blanked, argStart);
      const urlExpression = argEnd === -1 || argStart === -1
        ? (file.lines[line - 1] ?? '').trim()
        : firstArgument(file.source, file.blanked, argStart, argEnd);
      const method = m[1] ? m[1].toUpperCase() : 'GET';
      const resolved = resolveUrlArgument(urlExpression, helpers);

      out.push({
        id: id('cc'),
        client,
        method,
        file: file.rel,
        line,
        urlExpression: urlExpression.trim().slice(0, 200),
        url: resolved.url,
        urlSource: resolved.source,
        helper: resolved.helper,
        envRefs: fileEnvRefs.filter((r) => r.line >= fn.start && r.line <= fn.end),
        functionName: fn.name,
        functionStart: fn.start,
        functionEnd: fn.end,
        accesses: collectPropertyAccesses(file, fn.start, fn.end),
        responseVars: [],
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* URL argument resolution                                             */
/* ------------------------------------------------------------------ */

/**
 * Collects `name -> template` pairs for trivial URL builders such as
 *   export const predictionsUrl = (id) => `${API_BASE}/api/predictions/${id}`;
 * so a call like `fetch(predictionsUrl(id))` can still be matched to a route.
 */
function collectUrlHelpers(files: Map<string, IndexedFile>): Map<string, { template: string; file: string; line: number }> {
  const out = new Map<string, { template: string; file: string; line: number }>();
  const patterns: RegExp[] = [
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:Url|URL|Path|Endpoint|Route|EndpointUrl))\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]*)?=>\s*(`[^`]*`|['"][^'"]*['"])/g,
    /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*(?:Url|URL|Path|Endpoint|Route))\s*\([^)]*\)\s*(?::[^=]*)?\{\s*return\s*(`[^`]*`|['"][^'"]*['"])/g,
  ];
  for (const file of files.values()) {
    if (!/\.[cm]?[jt]sx?$/.test(file.rel)) continue;
    for (const re of patterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(file.source)) !== null) {
        const name = m[1];
        // Keep the quotes: the resolver re-reads this as a literal.
        const template = m[2];
        if (!name || out.has(name)) continue;
        out.set(name, { template, file: file.rel, line: lineAt(file.source, m.index) });
      }
    }
  }
  return out;
}

interface ResolvedUrl {
  url: string | null;
  source: 'literal' | 'helper' | 'template-base' | 'unknown';
  helper: string | null;
}

/**
 * Returns the text of a call's first argument, ignoring commas that belong to
 * later arguments or to nested structures. Offsets are taken from the string
 * blanked view so commas inside literals are not counted.
 */
export function firstArgument(
  source: string,
  blanked: string,
  openParen: number,
  closeParen: number,
): string {
  return splitArguments(source, blanked, openParen, closeParen).first;
}

/** Splits a call into its first argument and the remaining argument text. */
export function splitArguments(
  source: string,
  blanked: string,
  openParen: number,
  closeParen: number,
): { first: string; rest: string } {
  const from = openParen + 1;
  let depth = 0;
  for (let i = from; i < closeParen; i += 1) {
    const c = blanked[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ',' && depth === 0) {
      return { first: source.slice(from, i), rest: source.slice(i + 1, closeParen) };
    }
  }
  return { first: source.slice(from, closeParen), rest: '' };
}

/** Turns a fetch argument into a comparable static path, if one is derivable. */
function resolveUrlArgument(expr: string, helpers?: Map<string, { template: string; file: string; line: number }>, depth = 0): ResolvedUrl {
  const text = expr.trim();

  // 1. A quoted literal, possibly a template.
  const literal = /^(['"`])((?:[^'"`\\]|\\.)*)\1$/.exec(text);
  if (literal) {
    const raw = literal[2];
    const staticPath = normaliseUrlTemplate(raw);
    return {
      url: staticPath || null,
      source: staticPath ? (raw.includes('${') ? 'template-base' : 'literal') : 'unknown',
      helper: null,
    };
  }

  // 2. A call to a local URL builder, e.g. `predictionsUrl(id)`.
  const call = /^([A-Za-z_$][\w$]*)\s*\(/.exec(text);
  if (call?.[1] && helpers?.has(call[1]) && depth < 3) {
    const helper = helpers.get(call[1]);
    if (helper) {
      const inner = resolveUrlArgument(helper.template, helpers, depth + 1);
      return { url: inner.url, source: 'helper', helper: `${call[1]}@${helper.file}:${helper.line}` };
    }
  }

  // 3. A bare path string with no quotes, e.g. `/api/x/${id}`.
  if (text.startsWith('/')) {
    const staticPath = normaliseUrlTemplate(text);
    return { url: staticPath || null, source: 'literal', helper: null };
  }

  return { url: null, source: 'unknown', helper: call?.[1] ?? null };
}

/** `${API_BASE}/api/x` → `/api/x` so it can be matched against declared routes. */
function normaliseUrlTemplate(raw: string): string {
  const withoutInterpolations = raw.replace(/\$\{[^}]*\}/g, '').replace(/\/\/+/g, '/');
  return withoutInterpolations;
}

function collectSqlArtifacts(file: IndexedFile): { tables: TableDef[]; queries: QueryRef[] } {
  const tables: TableDef[] = [];
  const queries: QueryRef[] = [];
  const isSql = path.extname(file.rel).toLowerCase() === '.sql';
  const isPrisma = path.basename(file.rel) === 'schema.prisma';

  if (isSql || file.source.toUpperCase().includes('CREATE TABLE')) {
    CREATE_TABLE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CREATE_TABLE.exec(file.source)) !== null) {
      const line = lineAt(file.source, m.index);
      const body = m[2];
      const columns: TableDef['columns'] = [];
      for (const rawLine of body.split('\n')) {
        const t = rawLine.trim();
        if (!t || /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX|KEY)\b/i.test(t)) continue;
        const cm = /^["'`]?(\w+)["'`]?\s+([A-Za-z][\w()\[\], ]*)/.exec(t);
        if (!cm) continue;
        columns.push({ name: cm[1], type: cm[2].trim().replace(/\s+/g, ' ').slice(0, 40), line });
      }
      tables.push({ name: m[1], file: file.rel, line, columns, source: 'sql' });
    }
  }

  if (isPrisma) {
    const re = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(file.source)) !== null) {
      const fields: ModelDef['fields'] = [];
      PRISMA_FIELD.lastIndex = 0;
      let fm: RegExpExecArray | null;
      while ((fm = PRISMA_FIELD.exec(m[2])) !== null) {
        fields.push({ name: fm[1], type: fm[2], line: lineAt(file.source, m.index + fm.index) });
      }
      tables.push({ name: m[1], file: file.rel, line: lineAt(file.source, m.index), columns: fields, source: 'orm' });
    }
  }

  PREPARED_SQL.lastIndex = 0;
  let q: RegExpExecArray | null;
  while ((q = PREPARED_SQL.exec(file.source)) !== null) {
    const sql = q[2].replace(/\s+/g, ' ').trim();
    queries.push({
      file: file.rel,
      line: lineAt(file.source, q.index),
      sql: sql.slice(0, 400),
      tables: extractTables(sql),
      columns: extractColumns(sql),
      columnRefs: extractColumnRefs(sql),
    });
  }

  return { tables, queries };
}

export function extractTables(sql: string): string[] {
  const out: string[] = [];
  const re = /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+["'`]?(\w+)["'`]?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) out.push(m[1]);
  return [...new Set(out)];
}

/* ------------------------------------------------------------------ */
/* SQL column resolution                                               */
/* ------------------------------------------------------------------ */

/** A column reference, attributed to a table when the query allows it. */
export interface SqlColumnRef {
  column: string;
  /** Resolved through the query's alias table, or null when ambiguous. */
  table: string | null;
  /** How the reference was written, for human-readable findings. */
  written: string;
}

const SQL_NON_ALIAS = new Set([
  'ON', 'USING', 'WHERE', 'GROUP', 'ORDER', 'LIMIT', 'OFFSET', 'HAVING', 'JOIN', 'LEFT',
  'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'SET', 'VALUES', 'RETURNING', 'AND', 'OR',
  'NOT', 'AS', 'UNION', 'SELECT', 'FROM', 'INSERT', 'UPDATE', 'DELETE', 'INTO',
]);

const SQL_STOPWORDS_IN_EXPR = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'IFNULL', 'NULLIF', 'CAST', 'ABS',
  'ROUND', 'LENGTH', 'LOWER', 'UPPER', 'SUBSTR', 'DISTINCT', 'ALL', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'NULL', 'TRUE', 'FALSE', 'LIKE', 'IN', 'IS', 'BETWEEN',
  'CURRENT_TIMESTAMP', 'DATETIME', 'NOW', 'GROUP_CONCAT', 'TOTAL',
  'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST', 'AND', 'OR', 'NOT', 'EXISTS',
]);

/** Splits a comma separated SQL list, ignoring commas inside parentheses. */
function splitSqlList(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Builds `alias -> table` from FROM/JOIN/UPDATE/INTO clauses. */
function sqlAliasMap(sql: string): { map: Map<string, string>; tables: string[] } {
  const map = new Map<string, string>();
  const tables: string[] = [];
  const re = /\b(?:FROM|JOIN|UPDATE|INTO)\s+["'`]?(\w+)["'`]?(?:\s+(?:AS\s+)?(\w+))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const table = m[1];
    tables.push(table);
    map.set(table.toLowerCase(), table);
    const maybeAlias = m[2];
    if (maybeAlias && !SQL_NON_ALIAS.has(maybeAlias.toUpperCase())) {
      map.set(maybeAlias.toLowerCase(), table);
    }
  }
  return { map, tables: [...new Set(tables)] };
}

/**
 * Resolves the columns a statement actually reads or writes.
 *
 * Correctly ignores output aliases (`... AS total`), `*`, aggregate results and
 * keywords, and attributes `alias.column` to the table the alias stands for.
 * This is what keeps the Database Investigation Agent from inventing
 * mismatches such as "`orders` has no column `total`".
 */
export function extractColumnRefs(sql: string): SqlColumnRef[] {
  const { map, tables } = sqlAliasMap(sql);
  const only = tables.length === 1 ? tables[0] : null;
  const refs: SqlColumnRef[] = [];
  const seen = new Set<string>();
  const add = (column: string, table: string | null, written: string) => {
    if (!column || /^\d+$/.test(column)) return;
    const key = `${table ?? '?'}.${column.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ column, table, written });
  };

  const scan = (expr: string, allowBare: boolean) => {
    // Qualified references: `p.id`, `orders.amount`
    for (const m of expr.matchAll(/(?:([A-Za-z_]\w*)\s*\.\s*)?([A-Za-z_]\w*)/g)) {
      const qualifier = m[1];
      const name = m[2];
      const end = (m.index ?? 0) + m[0].length;
      const after = expr.slice(end);
      const before = expr.slice(0, m.index ?? 0);
      if (qualifier) {
        if (after.trimStart().startsWith('(')) continue; // `schema.func(`
        add(name, map.get(qualifier.toLowerCase()) ?? null, m[0]);
        continue;
      }
      // A bare word: a column, a function name, a keyword or an alias.
      if (before.trimEnd().endsWith('.')) continue;
      if (/^\s*\(/.test(after)) continue;              // function call
      if (!allowBare) continue;
      if (SQL_STOPWORDS_IN_EXPR.has(name.toUpperCase())) continue;
      if (SQL_NON_ALIAS.has(name.toUpperCase())) continue;
      add(name, only, name);
    }
  };

  // 1. SELECT projection list.
  const select = /\bSELECT\s+(?:DISTINCT\s+)?([\s\S]*?)\s+FROM\b/i.exec(sql);
  if (select) {
    for (const rawItem of splitSqlList(select[1])) {
      // Drop the output alias so it is never treated as a column.
      const item = rawItem
        .replace(/\s+AS\s+["'`]?\w+["'`]?\s*$/i, '')
        .replace(/\s+["'`]?\w+["'`]?\s*$/i, (m2, off: number) => (
          // Only strip a trailing bare alias, never a trailing function call.
          rawItem.slice(off).includes('(') ? m2 : ''
        ))
        .trim();
      if (!item || item === '*' || /^\*[\s,]/i.test(item)) continue;
      scan(item, true);
    }
  }

  // 2. UPDATE ... SET a = ?, b = ?
  const set = /\bSET\s+([\s\S]*?)(?:\bWHERE\b|\bRETURNING\b|$)/i.exec(sql);
  if (set) {
    for (const part of splitSqlList(set[1])) {
      const m = /^\s*([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)\s*=/.exec(part) ?? /^\s*([A-Za-z_]\w*)\s*=/.exec(part);
      if (!m) continue;
      if (m[2]) add(m[2], map.get(m[1].toLowerCase()) ?? null, `${m[1]}.${m[2]}`);
      else add(m[1], only, m[1]);
    }
  }

  // 3. INSERT INTO t (a, b) VALUES (?, ?)
  const insertCols = /\bINTO\s+\w+\s*\(([^)]*)\)/i.exec(sql);
  if (insertCols) {
    for (const part of splitSqlList(insertCols[1])) {
      const m = /^["'`]?(\w+)["'`]?$/.exec(part.trim());
      if (m) add(m[1], only, m[1]);
    }
  }

  // 4. WHERE / GROUP BY / ORDER BY / HAVING / ON predicates.
  const clauses = /\b(?:WHERE|HAVING|GROUP\s+BY|ORDER\s+BY|ON)\s+([\s\S]*?)(?=\b(?:WHERE|HAVING|GROUP\s+BY|ORDER\s+BY|ON|LIMIT|OFFSET|RETURNING|VALUES|SET)\b|$)/gi;
  let cm: RegExpExecArray | null;
  while ((cm = clauses.exec(sql)) !== null) scan(cm[1], true);

  return refs;
}

export function extractColumns(sql: string): string[] {
  return [...new Set(extractColumnRefs(sql).map((r) => r.column))];
}

/**
 * Resolves a table alias used in a query back to the real table name, so a
 * runtime error such as `no such column: o.customer_name` can be attributed to
 * `orders` even though the error names the alias.
 */
export function resolveTableAlias(index: { queries: QueryRef[] }, alias: string): string | null {
  const re = new RegExp(`\\b(?:FROM|JOIN)\\s+(\\w+)\\s+(?:AS\\s+)?${alias}\\b`, 'i');
  for (const q of index.queries) {
    const m = re.exec(q.sql);
    if (m?.[1]) return m[1];
  }
  return null;
}

function collectModels(file: IndexedFile): ModelDef[] {
  const out: ModelDef[] = [];
  if (!/\.[cm]?[jt]sx?$/.test(file.rel)) return out;

  // Mongoose: new Schema({ ... })
  const schemaRe = /(\w+)\.model\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*new\s+(?:mongoose\.)?Schema\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = schemaRe.exec(file.blanked)) !== null) {
    const fields: ModelDef['fields'] = [];
    MONGOOSE_FIELD.lastIndex = 0;
    let fm: RegExpExecArray | null;
    while ((fm = MONGOOSE_FIELD.exec(file.source)) !== null) {
      fields.push({ name: fm[1], type: fm[2], line: lineAt(file.source, fm.index) });
    }
    out.push({ name: m[2], file: file.rel, line: lineAt(file.blanked, m.index), fields, orm: 'mongoose' });
  }

  // Sequelize: Model.init / define
  const seqRe = /(\w+)\.(?:init|define)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = seqRe.exec(file.blanked)) !== null) {
    const fields: ModelDef['fields'] = [];
    SEQUELIZE_FIELD.lastIndex = 0;
    let fm: RegExpExecArray | null;
    while ((fm = SEQUELIZE_FIELD.exec(file.source)) !== null) {
      fields.push({ name: fm[1], type: fm[2], line: lineAt(file.source, fm.index) });
    }
    out.push({ name: m[2], file: file.rel, line: lineAt(file.blanked, m.index), fields, orm: 'sequelize' });
  }

  return out;
}

function collectEnvDeclarations(file: IndexedFile): EnvDeclaration[] {
  const out: EnvDeclaration[] = [];
  const base = path.basename(file.rel);
  if (!base.startsWith('.env')) return out;
  const lines = file.source.split('\n');
  lines.forEach((raw, i) => {
    const t = raw.trim();
    if (!t || t.startsWith('#')) return;
    const m = ENV_DECL_PATTERN.exec(t);
    if (!m) return;
    let value = m[2].trim();
    // Never retain a real secret value in memory beyond the declaration line.
    if (/KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL/i.test(m[1])) value = '<redacted>';
    out.push({ name: m[1], file: file.rel, line: i + 1, value: value.slice(0, 120) });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Similarity                                                         */
/* ------------------------------------------------------------------ */

function normalise(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * 0..1. Combines exact match, edit distance, token overlap and a small
 * general-purpose lexicon of domain synonyms. Used only to *rank* a rename
 * hypothesis — never on its own to assert one.
 */
export function nameSimilarity(a: string, b: string): { score: number; via: string } {
  if (a === b) return { score: 1, via: 'exact' };
  const na = normalise(a);
  const nb = normalise(b);
  if (na === nb) return { score: 0.97, via: 'normalised' };

  const dist = levenshtein(na, nb);
  const editScore = 1 - dist / Math.max(na.length, nb.length, 1);
  if (editScore >= 0.75) return { score: 0.8, via: 'edit-distance' };

  const ta = new Set(na.split('_').filter(Boolean));
  const tb = new Set(nb.split('_').filter(Boolean));
  const overlap = [...ta].filter((t) => tb.has(t)).length;
  const jaccard = overlap / Math.max(1, new Set([...ta, ...tb]).size);
  if (jaccard > 0) return { score: 0.4 + 0.4 * jaccard, via: 'token-overlap' };

  for (const group of SEMANTIC_GROUPS) {
    const aIn = group.some((g) => g === na || na.includes(g));
    const bIn = group.some((g) => g === nb || nb.includes(g));
    if (aIn && bIn) return { score: 0.55, via: 'domain-lexicon' };
  }

  return { score: 0, via: 'none' };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function buildCodeIndex(root: string): Promise<CodeIndex> {
  const walk = await walkProject(root);
  const files = new Map<string, IndexedFile>();
  const languageBreakdown: Record<string, number> = {};
  let totalBytes = 0;

  for (const entry of walk.entries) {
    const source = await readTextFile(entry.abs);
    const language = languageOf(entry.rel);
    const layer = CONFIG_FILES.has(path.basename(entry.rel)) ? 'config' : classifyLayer(entry.rel);
    languageBreakdown[language] = (languageBreakdown[language] ?? 0) + 1;
    totalBytes += entry.bytes;
    files.set(entry.rel, {
      rel: entry.rel,
      layer,
      language,
      bytes: entry.bytes,
      source,
      blanked: blankNonCode(source),
      code: blankNonCode(source, { stripStrings: false }),
      lines: source.split('\n'),
    });
  }

  const routes: RouteDef[] = [];
  const clientCalls: ClientCall[] = [];
  const symbols = new Map<string, SymbolDef[]>();
  const envRefs: EnvRef[] = [];
  const envDeclarations: EnvDeclaration[] = [];
  const tables: TableDef[] = [];
  const models: ModelDef[] = [];
  const queries: QueryRef[] = [];
  const tests: TestDef[] = [];
  const importEdges: ImportEdge[] = [];

  const urlHelpers = collectUrlHelpers(files);

  for (const file of files.values()) {
    const fnRanges = collectFunctionRanges(file.blanked);
    for (const route of collectRoutes(file, fnRanges)) routes.push(route);
    for (const call of collectClientCalls(file, fnRanges, urlHelpers)) clientCalls.push(call);
    for (const sym of collectSymbols(file)) {
      const list = symbols.get(sym.name) ?? [];
      list.push(sym);
      symbols.set(sym.name, list);
    }
    envRefs.push(...collectEnvRefs(file));
    envDeclarations.push(...collectEnvDeclarations(file));
    const sql = collectSqlArtifacts(file);
    tables.push(...sql.tables);
    queries.push(...sql.queries);
    models.push(...collectModels(file));
    tests.push(...collectTests(file));
    importEdges.push(...collectImports(file));
  }

  // Resolve relative import specifiers to real files.
  for (const edge of importEdges) {
    const fromDir = path.posix.dirname(edge.from);
    if (!edge.specifier.startsWith('.')) {
      edge.to = edge.specifier; // bare specifier — record for reporting
      continue;
    }
    const base = path.posix.normalize(path.posix.join(fromDir === '.' ? '' : fromDir, edge.specifier));
    const candidates = [
      base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`,
      `${base}.cjs`, `${base}.json`, `${base}/index.ts`, `${base}/index.js`,
    ];
    edge.to = candidates.find((c) => files.has(c)) ?? base;
  }

  const pkg = await readPackageInfo(root);
  const frameworks = detectFrameworks(pkg.dependencies, files);

  const index: CodeIndex = {
    root,
    generatedAt: nowIso(),
    files,
    fileCount: files.size,
    totalBytes,
    languageBreakdown,
    truncated: walk.truncated,
    routes,
    clientCalls,
    symbols,
    envRefs,
    envDeclarations,
    tables,
    models,
    queries,
    tests,
    importEdges,
    packageManager: pkg.packageManager,
    scripts: pkg.scripts,
    dependencies: pkg.dependencies,
    frameworks,
    testRunner: detectTestRunner(pkg, files),
    entryPoints: Object.entries(pkg.scripts)
      .filter(([name]) => /^(dev|start|serve|build|test)$/.test(name))
      .map(([name, command]) => ({ name, command })),
  };

  return index;
}

export async function readPackageInfo(root: string): Promise<{
  scripts: Record<string, string>;
  dependencies: string[];
  packageManager: string;
}> {
  const pkgPath = path.join(root, 'package.json');
  try {
    const raw = JSON.parse(await readTextFile(pkgPath)) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      scripts: raw.scripts ?? {},
      dependencies: [...Object.keys(raw.dependencies ?? {}), ...Object.keys(raw.devDependencies ?? {})],
      packageManager: 'npm',
    };
  } catch {
    return { scripts: {}, dependencies: [], packageManager: 'npm' };
  }
}

function detectFrameworks(dependencies: string[], files: Map<string, IndexedFile>): string[] {
  const found = new Set<string>();
  for (const sig of FRAMEWORK_SIGNATURES) {
    if (sig.deps.some((d) => dependencies.includes(d))) {
      found.add(sig.name);
      continue;
    }
    if (sig.files) {
      for (const file of files.values()) {
        if (sig.files.test(file.rel) || sig.files.test(file.source)) {
          found.add(sig.name);
          break;
        }
      }
    }
  }
  return [...found];
}

function detectTestRunner(
  pkg: { scripts: Record<string, string>; dependencies: string[] },
  files: Map<string, IndexedFile>,
): string {
  if (pkg.dependencies.includes('vitest')) return 'vitest';
  if (pkg.dependencies.includes('jest')) return 'jest';
  if (pkg.dependencies.includes('mocha')) return 'mocha';
  for (const file of files.values()) {
    if (/from ['"]node:test['"]|require\(['"]node:test['"]\)/.test(file.source)) return 'node:test';
  }
  if (Object.keys(pkg.scripts).some((s) => /test/.test(s))) return 'npm script';
  return 'none';
}

/* ------------------------------------------------------------------ */
/* Project map (STEP 2 of the workflow)                                */
/* ------------------------------------------------------------------ */

export function buildProjectMap(index: CodeIndex): ProjectMap {
  const components: ProjectComponent[] = [];

  const groups: { layer: ProjectLayer; label: string; role: string }[] = [
    { layer: 'frontend', label: 'Frontend', role: 'User-facing interface, renders views and issues API calls' },
    { layer: 'backend', label: 'Backend', role: 'Server-side request handling and business logic' },
    { layer: 'api', label: 'API routes', role: 'HTTP entry points' },
    { layer: 'database', label: 'Database', role: 'Schemas, models and queries' },
    { layer: 'tests', label: 'Tests', role: 'Automated test suites' },
    { layer: 'config', label: 'Configuration', role: 'Build, runtime and environment configuration' },
    { layer: 'docs', label: 'Documentation', role: 'Project documentation' },
    { layer: 'scripts', label: 'Scripts', role: 'Automation and tooling' },
  ];

  for (const group of groups) {
    const sourceFiles = group.layer === 'api'
      ? [...new Set(index.routes.map((r) => r.file))]
      : [...index.files.values()].filter((f) => f.layer === group.layer).map((f) => f.rel);
    if (sourceFiles.length === 0) continue;
    const dominant = dominantLanguage(index, sourceFiles);
    components.push({
      id: `${group.layer}-${sourceFiles.length}`,
      layer: group.layer,
      name: `${group.label} (${sourceFiles.length} files)`,
      role: group.role,
      files: sourceFiles.slice(0, 60),
      language: dominant,
    });
  }

  return {
    root: toPosix(index.root),
    generatedAt: nowIso(),
    fileCount: index.fileCount,
    totalBytes: index.totalBytes,
    languageBreakdown: index.languageBreakdown,
    entryPoints: index.entryPoints,
    components,
    path: buildExecutionPath(index),
    packageManager: index.packageManager,
    testRunner: index.testRunner,
    frameworks: index.frameworks,
    notes: [
      `${index.fileCount} files analysed, ${index.languageBreakdown.TypeScript ?? 0} TypeScript / ${index.languageBreakdown.JavaScript ?? 0} JavaScript`,
      `${index.routes.length} HTTP routes, ${index.clientCalls.length} outbound client calls, ${index.tests.length} test cases`,
      `Test runner: ${index.testRunner}`,
      index.truncated ? 'File budget reached — analysis is partial and findings are marked accordingly.' : 'Full project walk completed within budget.',
    ],
  };
}

function dominantLanguage(index: CodeIndex, files: string[]): string {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const lang = index.files.get(f)?.language;
    if (lang) counts[lang] = (counts[lang] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Unknown';
}

/** Frontend → API client → route → handler → service → data/external → response. */
export function buildExecutionPath(index: CodeIndex): ExecutionPathEdge[] {
  const edges: ExecutionPathEdge[] = [];
  const seen = new Set<string>();
  const push = (edge: ExecutionPathEdge) => {
    const k = `${edge.from}->${edge.to}:${edge.relation}`;
    if (!seen.has(k)) { seen.add(k); edges.push(edge); }
  };

  // Match client calls to declared routes by path shape.
  for (const call of index.clientCalls) {
    const target = matchRoute(index.routes, call.url ?? call.urlExpression);
    if (!target) continue;
    push({ from: call.file, to: `${target.method} ${target.path}`, relation: 'requests', location: { file: call.file, line: call.line } });
    push({ from: `${target.method} ${target.path}`, to: `${target.file}${target.handler ? `#${target.handler}` : ''}`, relation: 'calls', location: { file: target.file, line: target.line } });
    for (const sql of target.sql) {
      push({ from: target.file, to: `SQL: ${sql.slice(0, 60)}`, relation: 'reads' });
    }
  }

  // File-level import edges restricted to internal modules.
  for (const edge of index.importEdges) {
    if (!edge.specifier.startsWith('.')) continue;
    if (!index.files.has(edge.to)) continue;
    push({ from: edge.from, to: edge.to, relation: 'calls', location: { file: edge.from, line: edge.line } });
  }

  return edges.slice(0, 400);
}

/** Matches a client URL against declared routes, tolerating prefixes and params. */
export function matchRoute(routes: RouteDef[], url: string | null | undefined): RouteDef | null {
  if (!url) return null;
  const cleaned = url.split('?')[0].split('#')[0].replace(/^https?:\/\/[^/]+/i, '').replace(/\/$/, '');
  if (!cleaned || cleaned === '/') return null;
  const segments = cleaned.split('/').filter(Boolean);
  const candidates = routes.filter((r) => {
    const rSeg = r.path.split('?')[0].split('/').filter(Boolean);
    if (rSeg.length === 0) return segments.length === 0;
    if (rSeg.length !== segments.length) return false;
    return rSeg.every((seg, i) => seg.startsWith(':') || seg === '*' || seg === segments[i]);
  });
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => scoreRoute(b.path, segments) - scoreRoute(a.path, segments))[0];
}

function scoreRoute(routePath: string, segments: string[]): number {
  const rSeg = routePath.split('/').filter(Boolean);
  let score = 0;
  for (let i = 0; i < rSeg.length; i += 1) {
    if (rSeg[i].startsWith(':')) score += 0.5;
    else if (rSeg[i] === segments[i]) score += 1;
  }
  return score;
}

export { normalise, levenshtein, toPosix };
export const __testing = { objectKeys, collectPropertyAccesses, collectFunctionRanges, classifyLayer };
void config;
