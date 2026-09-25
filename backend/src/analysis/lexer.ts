/**
 * A small, dependency-free source scanner.
 *
 * It is not a JavaScript parser and does not pretend to be. It does three
 * things reliably enough for evidence gathering:
 *   1. blanks out comments and string bodies while preserving offsets,
 *   2. finds the balanced extent of a `{ ... }` region,
 *   3. enumerates the top-level keys of an object literal.
 */

export interface ScanOptions {
  /** Blank out string bodies too. Default true. */
  stripStrings?: boolean;
}

const STRING_STARTS = new Set(['"', "'", '`']);

/**
 * Replaces comment and string *contents* with spaces, keeping newlines and
 * byte offsets intact so line/column numbers stay correct.
 */
export function blankNonCode(source: string, options: ScanOptions = {}): string {
  const stripStrings = options.stripStrings !== false;
  const out = source.split('');
  const len = source.length;
  let i = 0;

  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < len; k += 1) {
      if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
    }
  };

  while (i < len) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '/' && next === '/') {
      const nl = source.indexOf('\n', i);
      const end = nl === -1 ? len : nl;
      blank(i, end);
      i = end;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2);
      const end = close === -1 ? len : close + 2;
      blank(i, end);
      i = end;
      continue;
    }
    if (STRING_STARTS.has(ch)) {
      const quote = ch;
      let j = i + 1;
      let templateDepth = 0;
      while (j < len) {
        const c = source[j];
        if (c === '\\') { j += 2; continue; }
        if (quote === '`' && c === '$' && source[j + 1] === '{') {
          // Keep template expressions: they contain real code (env reads, calls).
          if (!stripStrings) { j += 2; continue; }
          // Walk the expression to its matching brace, leave it intact.
          let depth = 1;
          j += 2;
          while (j < len && depth > 0) {
            if (source[j] === '{') depth += 1;
            else if (source[j] === '}') depth -= 1;
            j += 1;
          }
          templateDepth = 0;
          continue;
        }
        if (quote === '`' && c === '`' && templateDepth === 0) break;
        if (quote !== '`' && c === quote) break;
        if (quote === '`' && c === '\\') { j += 2; continue; }
        j += 1;
      }
      if (stripStrings && quote !== '`') blank(i + 1, Math.min(j, len));
      if (stripStrings && quote === '`') {
        // Blank the literal text but keep ${...} expressions readable.
        let k = i + 1;
        while (k < Math.min(j, len)) {
          if (source[k] === '$' && source[k + 1] === '{') {
            let depth = 1;
            k += 2;
            while (k < len && depth > 0) {
              if (source[k] === '{') depth += 1;
              else if (source[k] === '}') depth -= 1;
              k += 1;
            }
            continue;
          }
          if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
          k += 1;
        }
      }
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

/** 1-based line number of a character offset. */
export function lineAt(source: string, offset: number): number {
  let line = 1;
  const limit = Math.min(offset, source.length);
  for (let i = 0; i < limit; i += 1) if (source[i] === '\n') line += 1;
  return line;
}

/** Character offset at which the given 1-based line starts. */
export function offsetAt(source: string, line: number): number {
  if (line <= 1) return 0;
  let current = 1;
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === '\n') {
      current += 1;
      if (current === line) return i + 1;
    }
  }
  return source.length;
}

/** Finds the index just past the `}` that closes the `{` at `openIndex`. */
export function matchBrace(blanked: string, openIndex: number): number {
  if (blanked[openIndex] !== '{') return -1;
  let depth = 0;
  for (let i = openIndex; i < blanked.length; i += 1) {
    const c = blanked[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Finds the index of the `(` ... `)` group that starts at `openIndex`. */
export function matchParen(blanked: string, openIndex: number): number {
  if (blanked[openIndex] !== '(') return -1;
  let depth = 0;
  for (let i = openIndex; i < blanked.length; i += 1) {
    const c = blanked[i];
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export interface ObjectKey {
  name: string;
  line: number;
  /** Character offset of the key name. */
  offset: number;
  kind: 'scalar' | 'object' | 'array' | 'function' | 'spread';
  /** Rendered value text, truncated. Empty for objects. */
  value: string;
}

/**
 * Enumerates the immediate keys of the object literal beginning at `openIndex`
 * (which must point at `{`). Works on the blanked source for structure and the
 * original source for values.
 */
export function objectKeys(
  original: string,
  blanked: string,
  openIndex: number,
): ObjectKey[] {
  const close = matchBrace(blanked, openIndex);
  if (close === -1) return [];
  const keys: ObjectKey[] = [];
  const bodyStart = openIndex + 1;
  const bodyEnd = close;

  let depth = 0;
  let i = bodyStart;

  const isKeyStart = (idx: number): boolean => {
    if (idx > bodyStart && !/[\s{,;]/.test(blanked[idx - 1])) return false;
    return /['"`A-Za-z_$]/.test(blanked[idx]);
  };

  while (i < bodyEnd) {
    const c = blanked[i];

    if (c === '{' || c === '[' || c === '(') { depth += 1; i += 1; continue; }
    if (c === '}' || c === ']' || c === ')') { depth -= 1; i += 1; continue; }
    if (c === ',' || c === ';') { i += 1; continue; }
    if (depth !== 0) { i += 1; continue; }

    // `...spread`
    if (c === '.' && blanked.startsWith('...', i)) {
      const m = /^\.\.\.\s*([A-Za-z_$][\w$]*)/.exec(blanked.slice(i, bodyEnd));
      if (m) {
        keys.push({
          name: `...${m[1]}`,
          line: lineAt(original, i),
          offset: i,
          kind: 'spread',
          value: '',
        });
        i += m[0].length;
        continue;
      }
    }

    if (!isKeyStart(i)) { i += 1; continue; }

    // Read the key name (quoted or bare), then require `:` or `(`.
    let name = '';
    let afterKey = i;
    if (c === '\'' || c === '"' || c === '`') {
      const closeQuote = blanked.indexOf(c, i + 1);
      if (closeQuote === -1 || closeQuote >= bodyEnd) { i += 1; continue; }
      name = original.slice(i + 1, closeQuote);
      afterKey = closeQuote + 1;
    } else {
      const m = /^[A-Za-z_$][\w$]*/.exec(blanked.slice(i, bodyEnd));
      if (!m) { i += 1; continue; }
      name = m[0];
      afterKey = i + m[0].length;
    }
    if (!name) { i += 1; continue; }

    // Skip whitespace to find the terminator.
    let j = afterKey;
    while (j < bodyEnd && /\s/.test(blanked[j])) j += 1;
    const terminator = blanked[j];

    if (terminator === ':') {
      let kind: ObjectKey['kind'] = 'scalar';
      let value = '';
      let k = j + 1;
      while (k < bodyEnd && /\s/.test(blanked[k])) k += 1;
      const valueChar = blanked[k];
      if (valueChar === '{') kind = 'object';
      else if (valueChar === '[') kind = 'array';
      else {
        const v = /^[^\n,}]*/.exec(original.slice(k, bodyEnd));
        value = (v?.[0] ?? '').trim().slice(0, 120);
        if (/^(async\s*)?(\(|function\b|[A-Za-z_$][\w$]*\s*=>)/.test(value)) kind = 'function';
      }
      keys.push({ name, line: lineAt(original, i), offset: i, kind, value });
      // Skip the whole value so its identifiers are not mistaken for keys.
      i = skipToNextMember(blanked, j + 1, bodyEnd);
      continue;
    }

    if (terminator === '(') {
      // Shorthand method: `foo() { ... }`
      keys.push({ name, line: lineAt(original, i), offset: i, kind: 'function', value: '' });
      i = skipToNextMember(blanked, j + 1, bodyEnd);
      continue;
    }

    // Shorthand property: `{ prediction }`
    keys.push({ name, line: lineAt(original, i), offset: i, kind: 'scalar', value: name });
    i = skipToNextMember(blanked, afterKey, bodyEnd);
  }

  return dedupeKeys(keys);
}

/**
 * Advances to the next top-level member of an object literal, i.e. just past
 * the comma that ends the current one. Nested structures are stepped over.
 */
function skipToNextMember(blanked: string, from: number, bodyEnd: number): number {
  let depth = 0;
  for (let i = from; i < bodyEnd; i += 1) {
    const c = blanked[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return i;
      depth -= 1;
    } else if (c === ',' && depth === 0) {
      return i;
    }
  }
  return bodyEnd;
}

function dedupeKeys(keys: ObjectKey[]): ObjectKey[] {
  const seen = new Set<string>();
  const out: ObjectKey[] = [];
  for (const k of keys) {
    if (seen.has(k.name)) continue;
    seen.add(k.name);
    out.push(k);
  }
  return out;
}

export interface FunctionRange {
  name: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Locates function bodies by brace matching rather than by counting braces per
 * line, which is resilient to one-line arrow functions and object literals.
 */
export function findFunctionRanges(
  original: string,
  blanked: string,
  nameHint: string | null,
  fromOffset: number,
): FunctionRange | null {
  // Prefer an explicit `name(...) {` definition.
  const patterns = [
    new RegExp(`(?:async\\s+)?function\\s*\\*?\\s*${escapeRe(nameHint ?? '')}\\s*\\(`),
    new RegExp(`\\b${escapeRe(nameHint ?? '')}\\s*\\([^)]*\\)\\s*\\{`),
    new RegExp(`\\b${escapeRe(nameHint ?? '')}\\s*=\\s*(?:async\\s*)?(?:function\\s*\\*)?\\s*\\([^)]*\\)\\s*=>`),
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    const slice = blanked.slice(fromOffset);
    const m = re.exec(slice);
    if (!m) continue;
    const abs = fromOffset + m.index;
    const openIdx = blanked.indexOf('{', abs + m[0].length - 1);
    if (openIdx === -1) continue;
    const close = matchBrace(blanked, openIdx);
    if (close === -1) continue;
    return {
      name: nameHint ?? 'anonymous',
      startLine: lineAt(original, abs),
      endLine: lineAt(original, close),
      startOffset: abs,
      endOffset: close,
    };
  }
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits a function-ish body into lines. */
export function sliceLines(source: string, startLine: number, endLine: number): string {
  const lines = source.split('\n');
  return lines.slice(Math.max(0, startLine - 1), endLine).join('\n');
}

export function lineText(source: string, line: number): string {
  const lines = source.split('\n');
  return (lines[line - 1] ?? '').trim();
}

export function lineCount(source: string): number {
  return source.split('\n').length;
}
