/**
 * GridGuard Settings Store
 * Manages all user preferences — persisted to localStorage.
 * Single source of truth for settings shared across the app.
 */
import { create } from 'zustand';
import { type ThemeId, applyTheme } from '../theme/themeUtils';
import { useAppStore } from '../store/useAppStore';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TextSize    = 'small' | 'default' | 'large';
export type DateFormat  = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type TimeFormat  = '12-hour' | '24-hour';
export type Density     = 'compact' | 'comfortable';
export type DashboardView = 'Grid Health Dashboard';
export type AssetView   = 'All Assets' | 'Critical Assets' | 'High Risk Assets' | 'Recently Inspected';

export interface GridGuardSettings {
  // Appearance
  theme:              ThemeId;
  // Accessibility
  textSize:           TextSize;
  reducedMotion:      boolean;
  showStatusLabels:   boolean;
  // Notifications
  criticalAssetAlerts:    boolean;
  highRiskAlerts:         boolean;
  maintenanceReminders:   boolean;
  weatherRiskAlerts:      boolean;
  overdueMaintenanceAlerts: boolean;
  dailySummary:           boolean;
  // General
  dateFormat:        DateFormat;
  timeFormat:        TimeFormat;
  defaultDashboard:  DashboardView;
  defaultAssetView:  AssetView;
  density:           Density;
}

export const DEFAULT_SETTINGS: GridGuardSettings = {
  theme:                    'dark',
  textSize:                 'default',
  reducedMotion:            false,
  showStatusLabels:         true,
  criticalAssetAlerts:      true,
  highRiskAlerts:           true,
  maintenanceReminders:     true,
  weatherRiskAlerts:        true,
  overdueMaintenanceAlerts: true,
  dailySummary:             true,
  dateFormat:               'DD/MM/YYYY',
  timeFormat:               '24-hour',
  defaultDashboard:         'Grid Health Dashboard',
  defaultAssetView:         'All Assets',
  density:                  'comfortable',
};

const STORAGE_KEY = 'gridguard-settings';

// ─────────────────────────────────────────────────────────────────────────────
// Persistence helpers
// ─────────────────────────────────────────────────────────────────────────────

export function loadSettings(): GridGuardSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GridGuardSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: GridGuardSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply non-theme preferences to the DOM
// ─────────────────────────────────────────────────────────────────────────────

export function applyTextSize(size: TextSize): void {
  const root = document.documentElement;
  root.removeAttribute('data-text-size');
  if (size !== 'default') root.setAttribute('data-text-size', size);
}

export function applyReducedMotion(on: boolean): void {
  const root = document.documentElement;
  if (on) root.setAttribute('data-reduced-motion', 'true');
  else root.removeAttribute('data-reduced-motion');
}

export function applyDensity(density: Density): void {
  const root = document.documentElement;
  root.setAttribute('data-density', density);
}

/** Apply all non-persisted DOM effects from a settings object */
export function applyAllPreferences(s: GridGuardSettings): void {
  applyTheme(s.theme);
  applyTextSize(s.textSize);
  applyReducedMotion(s.reducedMotion);
  applyDensity(s.density);
}

// ─────────────────────────────────────────────────────────────────────────────
// Zustand store
// ─────────────────────────────────────────────────────────────────────────────

interface SettingsState {
  settings:   GridGuardSettings;
  /** Pending (unsaved) settings — mirror that the user is editing */
  draft:      GridGuardSettings;
  isDirty:    boolean;

  updateDraft: <K extends keyof GridGuardSettings>(key: K, value: GridGuardSettings[K]) => void;
  saveChanges: () => void;
  resetToDefaults: () => void;
  /** Apply theme immediately without saving the whole settings object */
  applyThemePreview: (id: ThemeId) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initial = loadSettings();
  // Apply persisted preferences on first load
  applyAllPreferences(initial);

  return {
    settings: initial,
    draft:    { ...initial },
    isDirty:  false,

    updateDraft: (key, value) => {
      set((state) => {
        const next = { ...state.draft, [key]: value };
        const dirty = JSON.stringify(next) !== JSON.stringify(state.settings);
        // Apply theme & visual prefs immediately (live preview)
        if (key === 'theme') {
          applyTheme(value as ThemeId);
          // keep Zustand app store in sync
          useAppStore.getState().setTheme(value as ThemeId);
        }
        if (key === 'textSize')      applyTextSize(value as TextSize);
        if (key === 'reducedMotion') applyReducedMotion(value as boolean);
        if (key === 'density')       applyDensity(value as Density);
        return { draft: next, isDirty: dirty };
      });
    },

    saveChanges: () => {
      const { draft } = get();
      saveSettings(draft);
      applyAllPreferences(draft);
      // Sync theme to app-wide store
      useAppStore.getState().setTheme(draft.theme);
      set({ settings: { ...draft }, isDirty: false });
    },

    resetToDefaults: () => {
      const d = { ...DEFAULT_SETTINGS };
      saveSettings(d);
      applyAllPreferences(d);
      useAppStore.getState().setTheme(d.theme);
      set({ settings: d, draft: d, isDirty: false });
    },

    applyThemePreview: (id) => {
      applyTheme(id);
      useAppStore.getState().setTheme(id);
      set((state) => ({
        draft: { ...state.draft, theme: id },
        isDirty: true,
      }));
    },
  };
});
