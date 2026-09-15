import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accent?: 'blue' | 'red' | 'orange' | 'yellow' | 'green' | 'slate';
  trend?: { value: number; label: string };
}

// Left-edge accent strip colours — office KPI tile, not neon glow ring
const accentMap: Record<NonNullable<StatCardProps['accent']>, {
  strip: string;   // border-l colour
  icon:  string;   // icon bg + text
  value: string;   // value text colour
}> = {
  blue:   { strip: 'border-l-brand-500',   icon: 'bg-brand-600/15 text-brand-400',  value: 'text-brand-400'  },
  red:    { strip: 'border-l-red-600',      icon: 'bg-red-500/12 text-red-400',      value: 'text-red-400'    },
  orange: { strip: 'border-l-orange-600',   icon: 'bg-orange-500/12 text-orange-400',value: 'text-orange-400' },
  yellow: { strip: 'border-l-yellow-600',   icon: 'bg-yellow-500/12 text-yellow-400',value: 'text-yellow-400' },
  green:  { strip: 'border-l-green-700',    icon: 'bg-green-500/12 text-green-400',  value: 'text-green-400'  },
  slate:  { strip: 'border-l-slate-500',    icon: 'bg-slate-500/12 text-slate-400',  value: 'text-slate-400'  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = 'blue',
  trend,
}: StatCardProps) {
  const a = accentMap[accent];

  return (
    // Flat card with left accent strip — classic enterprise KPI tile
    <div className={`card card-hover flex items-start gap-3 p-4 border-l-4 ${a.strip}`}>
      {/* Icon box */}
      <div className={`p-2 rounded shrink-0 ${a.icon}`}>
        <Icon size={16} aria-hidden="true" />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="label-muted truncate">{title}</p>
        {/* Smaller, more workstation-appropriate value size */}
        <p className={`mt-0.5 text-2xl font-bold font-mono leading-none ${a.value}`}>
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500 truncate leading-tight">{subtitle}</p>
        )}
        {trend && (
          <p className={`mt-1 text-xs font-medium ${trend.value >= 0 ? 'text-red-400' : 'text-green-400'}`}>
            {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)} {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}
