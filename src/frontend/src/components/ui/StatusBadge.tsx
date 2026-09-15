import type { RiskLevel, AssetStatus } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Risk Level Badge  — uses CSS-variable-backed .risk-badge-* classes so all
// four themes (dark / light / hc-dark / hc-light) work without extra JS.
// ─────────────────────────────────────────────────────────────────────────────

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md';
}

export function RiskBadge({ level, size = 'md' }: RiskBadgeProps) {
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span
      className={`risk-badge-${level} inline-flex items-center gap-1 rounded-full font-semibold capitalize
                  border border-transparent ${sizeClass}`}
      aria-label={`Risk level: ${level}`}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block risk-dot" />
      {level}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset Status Badge
// ─────────────────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: AssetStatus;
  size?: 'sm' | 'md';
}

const statusStyles: Record<AssetStatus, { cls: string; dot: string; label: string }> = {
  online:      { cls: 'status-badge-online',      dot: 'bg-green-400',  label: 'Online'      },
  offline:     { cls: 'status-badge-offline',     dot: 'bg-red-400',    label: 'Offline'     },
  maintenance: { cls: 'status-badge-maintenance', dot: 'bg-blue-400',   label: 'Maintenance' },
  degraded:    { cls: 'status-badge-degraded',    dot: 'bg-orange-400', label: 'Degraded'    },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { cls, dot, label } = statusStyles[status];
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizeClass} ${cls}`}
      aria-label={`Status: ${label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${dot} ${status === 'online' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}
