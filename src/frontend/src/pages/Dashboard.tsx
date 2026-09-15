import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  Wrench,
  Users,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useAppStore, useGridSummary } from '../store/useAppStore';
import { StatCard } from '../components/ui/StatCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { RiskBadge, StatusBadge } from '../components/ui/StatusBadge';
import { GridMap } from '../components/map/GridMap';

export function Dashboard() {
  const loadData = useAppStore((s) => s.loadData);
  const isLoading = useAppStore((s) => s.isLoading);
  const assets = useAppStore((s) => s.assets);
  const tasks = useAppStore((s) => s.maintenanceTasks);
  const summary = useGridSummary();

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading || !summary) {
    return <LoadingSpinner size="lg" label="Loading grid data…" />;
  }

  const top5 = [...assets].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5);
  const upcomingTasks = [...tasks]
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .slice(0, 3);

  const totalCustomers = assets.reduce((s, a) => s + a.customers_served, 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} className="text-brand-400" />
          <h1 className="page-title">Grid Health Dashboard</h1>
        </div>
        <p className="page-subtitle">
          Predictive view of asset health, outage exposure and maintenance priorities.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Assets"
          value={summary.total_assets}
          subtitle={`${summary.online} online · ${summary.offline} offline`}
          icon={Activity}
          accent="blue"
        />
        <StatCard
          title="Critical Assets"
          value={summary.critical_risk_count}
          subtitle={`Score 85–100 · Immediate action needed`}
          icon={AlertTriangle}
          accent="red"
        />
        <StatCard
          title="High Risk Assets"
          value={summary.high_risk_count}
          subtitle={`Score 70–84 · Monitor closely`}
          icon={TrendingUp}
          accent="orange"
        />
        <StatCard
          title="Maintenance Today"
          value={summary.maintenance_today}
          subtitle={`${summary.pending_maintenance_tasks} total pending tasks`}
          icon={Wrench}
          accent="yellow"
        />
      </div>

      {/* Outage risk banner */}
      {summary.outage_risk_24h >= 0.25 && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/25
                        rounded-xl text-sm text-amber-300">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-300">
              Elevated outage risk:{' '}
              <span className="text-amber-400">{Math.round(summary.outage_risk_24h * 100)}%</span>
              {' '}probability in next 24 hours
            </p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Based on current asset health and weather exposure. Review critical assets immediately.
            </p>
          </div>
        </div>
      )}

      {/* Map preview + right panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Map */}
        <div className="xl:col-span-2 card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-white">Grid Map Preview</h2>
            <Link
              to="/map"
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
            >
              View Full Map <ChevronRight size={13} />
            </Link>
          </div>
          <GridMap assets={assets} height={400} />
        </div>

        {/* Customers stat */}
        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users size={15} className="text-brand-400" />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Customer Exposure
              </h3>
            </div>
            <p className="text-3xl font-bold text-white font-mono">
              {totalCustomers.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">total customers monitored</p>
            <div className="divider my-3" />
            <div className="grid grid-cols-2 gap-3 text-xs">
              {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
                const levelAssets = assets.filter((a) => a.risk_level === level);
                const customers = levelAssets.reduce((s, a) => s + a.customers_served, 0);
                return (
                  <div key={level} className="flex flex-col">
                    <RiskBadge level={level} size="sm" />
                    <p className="font-mono font-bold text-white mt-1">
                      {customers.toLocaleString()}
                    </p>
                    <p className="text-slate-500">customers</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk breakdown */}
          <div className="card p-5">
            <h3 className="label-muted mb-3">Risk Breakdown</h3>
            {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
              const count = assets.filter((a) => a.risk_level === level).length;
              const pct = Math.round((count / assets.length) * 100);
              const barColors: Record<string, string> = {
                critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
              };
              return (
                <div key={level} className="mb-2.5">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400 capitalize">{level}</span>
                    <span className="text-slate-300 font-medium">{count} assets</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-navy-900 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${pct}%`, background: barColors[level] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 at-risk */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-white">Top 5 At-Risk Assets</h2>
            <Link
              to="/assets"
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
            >
              View All <ChevronRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-surface-border/50">
            {top5.map((asset, i) => (
              <Link
                key={asset.id}
                to={`/assets/${asset.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-navy-750 transition-colors group"
              >
                <span className="text-slate-600 font-mono text-sm w-5 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white group-hover:text-brand-300
                                 transition-colors truncate">
                    {asset.id}
                  </p>
                  <p className="text-xs text-slate-400 capitalize">
                    {asset.type.replace('_', ' ')} · {asset.zone}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={asset.status} size="sm" />
                  <RiskBadge level={asset.risk_level} />
                  <span className="text-sm font-bold font-mono text-white w-8 text-right">
                    {asset.risk_score}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming maintenance */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-white">Upcoming Maintenance</h2>
            <Link
              to="/maintenance"
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
            >
              View Full Plan <ChevronRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-surface-border/50">
            {upcomingTasks.map((task) => {
              const priorityColors: Record<string, string> = {
                emergency: 'text-red-400 bg-red-500/10 border-red-500/25',
                urgent: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
                routine: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
              };
              return (
                <Link
                  key={task.id}
                  to={`/assets/${task.asset_id}`}
                  className="flex items-start gap-4 px-5 py-3.5 hover:bg-navy-750 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-brand-300
                                   transition-colors truncate">
                      {task.asset_id}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{task.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {task.scheduled_date} · {task.assigned_team}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0
                                ${priorityColors[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
