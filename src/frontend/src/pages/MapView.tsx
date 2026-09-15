import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal, Users } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { GridMap } from '../components/map/GridMap';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { RiskBadge, StatusBadge } from '../components/ui/StatusBadge';
import type { Asset, RiskLevel, Zone } from '../types';

const ZONES: Array<Zone | 'all'> = ['all', 'North', 'South', 'East', 'West', 'Central'];
const RISK_LEVELS: Array<RiskLevel | 'all'> = ['all', 'critical', 'high', 'medium', 'low'];

const riskHexMap: Record<RiskLevel, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
};

export function MapView() {
  const loadData = useAppStore((s) => s.loadData);
  const isLoading = useAppStore((s) => s.isLoading);
  const allAssets = useAppStore((s) => s.assets);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [riskFilters, setRiskFilters] = useState<Set<RiskLevel>>(
    new Set(['critical', 'high', 'medium', 'low']),
  );
  const [zoneFilter, setZoneFilter] = useState<Zone | 'all'>('all');

  useEffect(() => { loadData(); }, [loadData]);

  const toggleRisk = (level: RiskLevel) => {
    setRiskFilters((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  };

  const filtered = allAssets.filter(
    (a) =>
      riskFilters.has(a.risk_level) &&
      (zoneFilter === 'all' || a.zone === zoneFilter),
  );

  const selectedAsset: Asset | undefined = allAssets.find((a) => a.id === selectedId);

  if (isLoading) return <LoadingSpinner size="lg" label="Loading map…" />;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
      {/* ── Filter Panel ── */}
      <aside className="w-full lg:w-64 shrink-0 bg-navy-900 border-b lg:border-b-0 lg:border-r
                         border-surface-border flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-surface-border flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-white">Filters</h2>
        </div>

        {/* Risk level checkboxes */}
        <div className="p-4 border-b border-surface-border">
          <p className="label-muted mb-3">Risk Level</p>
          <div className="space-y-2">
            {RISK_LEVELS.filter((r) => r !== 'all').map((level) => (
              <label
                key={level}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={riskFilters.has(level as RiskLevel)}
                  onChange={() => toggleRisk(level as RiskLevel)}
                  className="w-4 h-4 rounded border-surface-border bg-navy-800 accent-brand-500
                             cursor-pointer"
                  aria-label={`Filter ${level} risk`}
                />
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: riskHexMap[level as RiskLevel] }}
                />
                <span className="text-sm capitalize text-slate-300 group-hover:text-white transition-colors">
                  {level}
                </span>
                <span className="ml-auto text-xs text-slate-500">
                  {allAssets.filter((a) => a.risk_level === level).length}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Zone select */}
        <div className="p-4 border-b border-surface-border">
          <p className="label-muted mb-3">Zone</p>
          <div className="space-y-1">
            {ZONES.map((zone) => (
              <button
                key={zone}
                onClick={() => setZoneFilter(zone)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  zoneFilter === zone
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {zone === 'all' ? 'All Zones' : zone}
                {zone !== 'all' && (
                  <span className="ml-auto float-right text-xs text-slate-500">
                    {allAssets.filter((a) => a.zone === zone).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="p-4">
          <p className="label-muted mb-2">Showing</p>
          <p className="text-2xl font-bold text-white">{filtered.length}</p>
          <p className="text-xs text-slate-500">of {allAssets.length} assets</p>
        </div>
      </aside>

      {/* ── Map + Detail ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <GridMap
            assets={filtered}
            selectedAssetId={selectedId}
            onAssetSelect={setSelectedId}
            height="100%"
          />
          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-navy-900/90 border border-surface-border
                          rounded-lg px-3 py-2 flex gap-3 text-xs backdrop-blur-sm z-20">
            {(['critical', 'high', 'medium', 'low'] as const).map((level) => (
              <span key={level} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: riskHexMap[level] }}
                />
                <span className="text-slate-400 capitalize">{level}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Asset detail panel */}
        {selectedAsset && (
          <aside className="w-72 shrink-0 bg-navy-900 border-l border-surface-border
                             overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-surface-border flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-white text-base truncate">{selectedAsset.id}</p>
                <p className="text-xs text-slate-400 capitalize mt-0.5">
                  {selectedAsset.type.replace('_', ' ')} · {selectedAsset.zone}
                </p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-slate-500 hover:text-white transition-colors text-lg leading-none shrink-0 mt-0.5"
                aria-label="Close panel"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              <div className="flex flex-wrap gap-2">
                <RiskBadge level={selectedAsset.risk_level} />
                <StatusBadge status={selectedAsset.status} />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Risk Score', value: `${selectedAsset.risk_score}/100` },
                  { label: 'Age', value: `${selectedAsset.age_years} yrs` },
                  { label: '7d Failure', value: `${Math.round(selectedAsset.failure_probability_7d * 100)}%` },
                  { label: '30d Failure', value: `${Math.round(selectedAsset.failure_probability_30d * 100)}%` },
                  { label: 'Weather Risk', value: `${Math.round(selectedAsset.weather_risk_factor * 100)}%` },
                  { label: 'Next Maint.', value: selectedAsset.next_maintenance },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-navy-800 rounded-lg p-2.5 border border-surface-border/50">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                    <p className="font-semibold text-white text-sm mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Users size={13} />
                <span>
                  <strong className="text-white">{selectedAsset.customers_served.toLocaleString()}</strong>{' '}
                  customers at risk
                </span>
              </div>

              {selectedAsset.notes && (
                <div className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20
                                rounded-lg p-3 leading-relaxed">
                  {selectedAsset.notes}
                </div>
              )}

              <Link
                to={`/assets/${selectedAsset.id}`}
                className="btn-primary w-full text-center block"
              >
                View Full Details →
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
