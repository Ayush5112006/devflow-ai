/**
 * Shared presentation helpers. Imported by both the list view and the detail
 * view, so anything changed here has a wide blast radius.
 */

export function formatClass(value) {
  if (!value) return 'tone-unknown';
  return `tone-${String(value).toLowerCase()}`;
}

export function formatPercent(value) {
  if (typeof value !== 'number') return '—';
  return `${Math.round(value * 100)}%`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toISOString().slice(0, 10);
}
