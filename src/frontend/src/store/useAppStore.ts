import { create } from 'zustand';
import type { Asset, GridSummary, MaintenanceTask, AppFilters, RiskLevel, Zone } from '../types';
import { mockAssets, mockGridSummary, mockMaintenanceTasks } from '../mock/mockData';
import { type ThemeId, applyTheme, getStoredTheme } from '../theme/themeUtils';

// ─────────────────────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────────────────────

interface AppState {
  // Data
  assets: Asset[];
  gridSummary: GridSummary | null;
  maintenanceTasks: MaintenanceTask[];
  selectedAssetId: string | null;

  // UI
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  filters: AppFilters;

  // Theme
  theme: ThemeId;

  // Actions
  loadData: () => void;
  selectAsset: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  setFilter: <K extends keyof AppFilters>(key: K, value: AppFilters[K]) => void;
  resetFilters: () => void;
  getFilteredAssets: () => Asset[];
  setTheme: (id: ThemeId) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default filters
// ─────────────────────────────────────────────────────────────────────────────

const defaultFilters: AppFilters = {
  risk_level: 'all',
  asset_type: 'all',
  zone: 'all',
  status: 'all',
};

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  // ── initial state ──────────────────────────────────────────────────────────
  assets: [],
  gridSummary: null,
  maintenanceTasks: [],
  selectedAssetId: null,
  isLoading: false,
  error: null,
  sidebarOpen: true,
  mobileSidebarOpen: false,
  filters: { ...defaultFilters },
  // main.tsx already called initTheme() before React mounted; just read the value.
  theme: getStoredTheme(),

  // ── actions ────────────────────────────────────────────────────────────────

  loadData: () => {
    set({ isLoading: true, error: null });
    // Using mock data. Replace with API calls when backend is ready.
    set({
      assets: mockAssets,
      gridSummary: mockGridSummary,
      maintenanceTasks: mockMaintenanceTasks,
      isLoading: false,
    });
  },

  selectAsset: (id) => set({ selectedAssetId: id }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

  toggleMobileSidebar: () =>
    set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),

  setTheme: (id) => {
    applyTheme(id);
    set({ theme: id });
  },

  getFilteredAssets: () => {
    const { assets, filters } = get();
    return assets.filter((asset) => {
      if (filters.risk_level !== 'all' && asset.risk_level !== filters.risk_level)
        return false;
      if (filters.asset_type !== 'all' && asset.type !== filters.asset_type)
        return false;
      if (filters.zone !== 'all' && asset.zone !== filters.zone)
        return false;
      if (filters.status !== 'all' && asset.status !== filters.status)
        return false;
      return true;
    });
  },
}));

// ── Convenience selector hooks ─────────────────────────────────────────────
export const useAssets = () => useAppStore((s) => s.assets);
export const useGridSummary = () => useAppStore((s) => s.gridSummary);
export const useMaintenanceTasks = () => useAppStore((s) => s.maintenanceTasks);
export const useIsLoading = () => useAppStore((s) => s.isLoading);
export const useFilters = () => useAppStore((s) => s.filters);

// ── Risk colour helpers ────────────────────────────────────────────────────
export function riskColor(level: RiskLevel): string {
  return {
    low:      'text-green-400',
    medium:   'text-yellow-400',
    high:     'text-orange-400',
    critical: 'text-red-400',
  }[level];
}

export function riskBorderColor(level: RiskLevel): string {
  return {
    low:      'border-green-500',
    medium:   'border-yellow-500',
    high:     'border-orange-500',
    critical: 'border-red-500',
  }[level];
}

export function riskBg(level: RiskLevel): string {
  return {
    low:      'bg-green-500/15 text-green-400',
    medium:   'bg-yellow-500/15 text-yellow-400',
    high:     'bg-orange-500/15 text-orange-400',
    critical: 'bg-red-500/15 text-red-400',
  }[level];
}

export function riskHex(level: RiskLevel): string {
  return { low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444' }[level];
}

// ── Zone colour ───────────────────────────────────────────────────────────
export function zoneColor(zone: Zone): string {
  return {
    North:   'text-sky-400',
    South:   'text-emerald-400',
    East:    'text-violet-400',
    West:    'text-amber-400',
    Central: 'text-pink-400',
  }[zone];
}
