import { useEffect, useState } from 'react';
import { Download, Filter, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { AssetRiskTable, exportAssetsToCSV } from '../components/tables/AssetRiskTable';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { RiskLevel, AssetStatus, AssetType, Zone } from '../types';

const RISK_LEVELS: Array<{ value: RiskLevel | 'all'; label: string }> = [
  { value: 'all', label: 'All Risk Levels' },
  { value: 'critical', label: 'Critical (85–100)' },
  { value: 'high', label: 'High (70–84)' },
  { value: 'medium', label: 'Medium (45–69)' },
  { value: 'low', label: 'Low (0–44)' },
];

const STATUSES: Array<{ value: AssetStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'degraded', label: 'Degraded' },
];

const ASSET_TYPES: Array<{ value: AssetType | 'all'; label: string }> = [
  { value: 'all', label: 'All Types' },
  { value: 'transformer', label: 'Transformer' },
  { value: 'substation', label: 'Substation' },
  { value: 'transmission_line', label: 'Transmission Line' },
  { value: 'circuit_breaker', label: 'Circuit Breaker' },
  { value: 'capacitor_bank', label: 'Capacitor Bank' },
];

const ZONES: Array<{ value: Zone | 'all'; label: string }> = [
  { value: 'all', label: 'All Zones' },
  { value: 'North', label: 'North' },
  { value: 'South', label: 'South' },
  { value: 'East', label: 'East' },
  { value: 'West', label: 'West' },
  { value: 'Central', label: 'Central' },
];

export function AssetTable() {
  const loadData = useAppStore((s) => s.loadData);
  const isLoading = useAppStore((s) => s.isLoading);
  const getFilteredAssets = useAppStore((s) => s.getFilteredAssets);
  const filters = useAppStore((s) => s.filters);
  const setFilter = useAppStore((s) => s.setFilter);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const allAssets = useAppStore((s) => s.assets);

  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = getFilteredAssets().filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.id.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.zone.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="page-header flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Asset Risk Rankings</h1>
          <p className="page-subtitle">
            Prioritized view of grid equipment risk · {allAssets.length} assets monitored
          </p>
        </div>
        <button
          onClick={() => exportAssetsToCSV(filtered)}
          className="btn-primary flex items-center gap-2 shrink-0"
          aria-label="Export to CSV"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Filters bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 text-slate-400 shrink-0 mr-1">
            <Filter size={13} />
            <span className="text-xs font-medium">Filters</span>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search by ID, name, zone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark w-52"
            aria-label="Search assets"
          />

          {/* Risk level */}
          <div className="relative">
            <select
              value={filters.risk_level}
              onChange={(e) => setFilter('risk_level', e.target.value as RiskLevel | 'all')}
              className="select-dark pr-8"
              aria-label="Filter by risk level"
            >
              {RISK_LEVELS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
          </div>

          {/* Zone */}
          <div className="relative">
            <select
              value={filters.zone}
              onChange={(e) => setFilter('zone', e.target.value as Zone | 'all')}
              className="select-dark pr-8"
              aria-label="Filter by zone"
            >
              {ZONES.map((z) => (
                <option key={z.value} value={z.value}>{z.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
          </div>

          {/* Status */}
          <div className="relative">
            <select
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value as AssetStatus | 'all')}
              className="select-dark pr-8"
              aria-label="Filter by status"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
          </div>

          {/* Type */}
          <div className="relative">
            <select
              value={filters.asset_type}
              onChange={(e) => setFilter('asset_type', e.target.value as AssetType | 'all')}
              className="select-dark pr-8"
              aria-label="Filter by asset type"
            >
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
          </div>

          <button
            onClick={() => { resetFilters(); setSearch(''); }}
            className="btn-ghost flex items-center gap-1.5 ml-auto"
            aria-label="Reset filters"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>

      {/* Result count */}
      {(filters.risk_level !== 'all' || filters.zone !== 'all' || filters.status !== 'all' || filters.asset_type !== 'all' || search) && (
        <p className="text-xs text-slate-500">
          Showing <strong className="text-slate-300">{filtered.length}</strong> of {allAssets.length} assets
        </p>
      )}

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner label="Loading assets…" />
      ) : (
        <AssetRiskTable assets={filtered} />
      )}
    </div>
  );
}
