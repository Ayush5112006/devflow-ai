/** Renders an identifier in code style. Avoids backtick-escaping inside templates. */
export const q = (value: string | number | null | undefined): string =>
  value === null || value === undefined ? '' : `\`${value}\``;

/** Joins a list into `a, b and c`. */
export function list(items: string[], conjunction = 'and'): string {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(', ')} ${conjunction} ${clean[clean.length - 1]}`;
}

/** Collapses whitespace and truncates for one-line display. */
export function oneLine(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
