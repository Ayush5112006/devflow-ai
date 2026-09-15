import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Clock, AlertTriangle, CheckCircle2, Users, Download, Calendar } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { RiskBadge } from '../components/ui/StatusBadge';
import { StatCard } from '../components/ui/StatCard';
import type { MaintenanceTask } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type TabMode = 'day' | 'asset' | 'crew';

const priorityOrder: Record<string, number> = { emergency: 0, urgent: 1, routine: 2 };
const priorityBadge: Record<string, string> = {
  emergency: 'bg-red-500/15 text-red-400 border-red-500/25',
  urgent:    'bg-orange-500/15 text-orange-400 border-orange-500/25',
  routine:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
};
const statusBadge: Record<string, string> = {
  scheduled:   'text-slate-400',
  in_progress: 'text-brand-400',
  completed:   'text-green-400',
  deferred:    'text-amber-400',
};
const statusIcon: Record<string, React.ReactNode> = {
  scheduled:   <Clock size={13} />,
  in_progress: <AlertTriangle size={13} />,
  completed:   <CheckCircle2 size={13} />,
  deferred:    <Clock size={13} />,
};

function exportMaintenanceCSV(tasks: MaintenanceTask[]) {
  const headers = ['ID', 'Asset ID', 'Asset Name', 'Zone', 'Priority', 'Action', 'Date', 'Team', 'Duration (h)', 'Cost ($)', 'Status'];
  const rows = tasks.map((t) => [
    t.id, t.asset_id, `"${t.asset_name}"`, t.zone, t.priority, `"${t.action}"`,
    t.scheduled_date, `"${t.assigned_team}"`, t.estimated_duration_hours, t.estimated_cost_usd, t.status,
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gridguard-maintenance-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task card
// ─────────────────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: MaintenanceTask }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-navy-750 transition-colors border-b border-surface-border/50">
      {/* Priority */}
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0 mt-0.5
                    ${priorityBadge[task.priority]}`}
      >
        {task.priority}
      </span>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start flex-wrap gap-2 mb-1">
          <Link
            to={`/assets/${task.asset_id}`}
            className="font-semibold text-sm text-white hover:text-brand-300 transition-colors"
          >
            {task.asset_id}
          </Link>
          <RiskBadge level={task.risk_level} size="sm" />
        </div>
        <p className="text-sm text-slate-300">{task.action}</p>
        <p className="text-xs text-slate-500 mt-1">{task.description}</p>
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {task.scheduled_date}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {task.estimated_duration_hours}h est.
          </span>
          <span className="flex items-center gap-1">
            <Users size={11} />
            {task.assigned_team}
          </span>
          <span className="text-slate-500">
            ${task.estimated_cost_usd.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className={`flex items-center gap-1 text-xs font-medium shrink-0 ${statusBadge[task.status]}`}>
        {statusIcon[task.status]}
        <span className="capitalize">{task.status.replace('_', ' ')}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function MaintenancePlan() {
  const loadData = useAppStore((s) => s.loadData);
  const isLoading = useAppStore((s) => s.isLoading);
  const tasks = useAppStore((s) => s.maintenanceTasks);
  const [tab, setTab] = useState<TabMode>('day');

  useEffect(() => { loadData(); }, [loadData]);

  if (isLoading) return <LoadingSpinner size="lg" label="Loading maintenance plan…" />;

  const sorted = [...tasks].sort(
    (a, b) =>
      a.scheduled_date.localeCompare(b.scheduled_date) ||
      priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  const totalCost = tasks.reduce((s, t) => s + t.estimated_cost_usd, 0);
  const totalHours = tasks.reduce((s, t) => s + t.estimated_duration_hours, 0);
  const crews = new Set(tasks.map((t) => t.assigned_team)).size;
  const assetsScheduled = new Set(tasks.map((t) => t.asset_id)).size;

  // Group helpers
  function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
    return arr.reduce<Record<string, T[]>>((acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    }, {});
  }

  const byDay = groupBy(sorted, (t) => t.scheduled_date);
  const byAsset = groupBy(sorted, (t) => t.asset_id);
  const byCrew = groupBy(sorted, (t) => t.assigned_team);

  function renderGroups(groups: Record<string, MaintenanceTask[]>, groupLabel: (key: string) => string) {
    return Object.entries(groups).map(([key, groupTasks]) => (
      <section key={key} className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border
                        bg-navy-850">
          <h3 className="text-sm font-semibold text-white">{groupLabel(key)}</h3>
          <span className="text-xs text-slate-500">
            {groupTasks.length} task{groupTasks.length !== 1 ? 's' : ''}
          </span>
        </div>
        {groupTasks.map((t) => <TaskRow key={t.id} task={t} />)}
      </section>
    ));
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 page-header">
        <div>
          <h1 className="page-title">Maintenance & Crew Pre-Positioning</h1>
          <p className="page-subtitle">
            AI-prioritized maintenance schedule based on risk and grid impact.
          </p>
        </div>
        <button
          onClick={() => exportMaintenanceCSV(tasks)}
          className="btn-primary flex items-center gap-2 shrink-0"
          aria-label="Export maintenance plan"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Tasks This Week" value={tasks.length} icon={Wrench} accent="blue" />
        <StatCard title="Crews Deployed" value={crews} icon={Users} accent="green" />
        <StatCard title="Assets Scheduled" value={assetsScheduled} icon={CheckCircle2} accent="yellow" />
        <StatCard title="Estimated Field Hours" value={`${totalHours}h`} icon={Clock} accent="orange"
          subtitle={`$${totalCost.toLocaleString()} est. cost`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-navy-900 rounded-xl w-fit border border-surface-border">
        {([['day', 'By Day'], ['asset', 'By Asset'], ['crew', 'By Crew']] as const).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {tab === 'day' &&
          renderGroups(byDay, (date) => {
            const today = new Date().toISOString().split('T')[0];
            const label = date === today ? `Today — ${date}` : date;
            return label;
          })}
        {tab === 'asset' &&
          renderGroups(byAsset, (assetId) => assetId)}
        {tab === 'crew' &&
          renderGroups(byCrew, (crew) => crew)}
      </div>
    </div>
  );
}
