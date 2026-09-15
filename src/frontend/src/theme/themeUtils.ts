export type ThemeId = 'dark' | 'light' | 'hc-dark' | 'hc-light';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  icon: string; // emoji shorthand for display
}

export const THEMES: ThemeDefinition[] = [
  { id: 'dark',     label: 'Dark',                description: 'Default dark navy theme',      icon: '🌙' },
  { id: 'light',    label: 'Light',               description: 'Professional light theme',     icon: '☀️' },
  { id: 'hc-dark',  label: 'High Contrast Dark',  description: 'Accessibility — dark',         icon: '◐' },
  { id: 'hc-light', label: 'High Contrast Light', description: 'Accessibility — light',        icon: '◑' },
];

const STORAGE_KEY = 'gridguard-theme';

export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light' || v === 'hc-dark' || v === 'hc-light') return v;
  } catch { /* ignore SSR / private browsing */ }
  return 'dark';
}

export function persistTheme(id: ThemeId): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}

/** Apply theme class to <html data-theme="…"> and persist to localStorage */
export function applyTheme(id: ThemeId): void {
  document.documentElement.setAttribute('data-theme', id);
  persistTheme(id);
}

/** Call once on app startup — reads persisted theme and applies it */
export function initTheme(): ThemeId {
  const id = getStoredTheme();
  applyTheme(id);
  return id;
}
