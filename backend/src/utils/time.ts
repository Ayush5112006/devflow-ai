export const nowIso = (): string => new Date().toISOString();

/** Real elapsed milliseconds between two ISO timestamps. */
export function elapsedSince(iso: string | undefined, until: string = nowIso()): number {
  if (!iso) return 0;
  return Math.max(0, Date.parse(until) - Date.parse(iso));
}

export function ms(value: number): string {
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(2)}s`;
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.round((value % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}
