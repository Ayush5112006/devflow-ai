import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  List,
  LayoutGrid,
  X,
  CheckCircle2,
  Clock,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  Users,
  Wrench,
  Filter,
  ClipboardList,
} from 'lucide-react';
import { calendarTasks } from '../mock/calendarMockData';
import type { CalendarTask, CalTaskStatus } from '../mock/calendarMockData';
import { RiskBadge } from '../components/ui/StatusBadge';
import { StatCard } from '../components/ui/StatCard';
import type { RiskLevel, Zone, AssetType } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'list';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function todayStr(): string {
  return isoDate(new Date());
}

const priorityColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  emergency: { bg: 'bg-red-500/20',    border: 'border-red-500/50',    text: 'text-red-300',    dot: 'bg-red-400' },
  urgent:    { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-300', dot: 'bg-orange-400' },
  routine:   { bg: 'bg-blue-500/20',   border: 'border-blue-500/50',   text: 'text-blue-300',   dot: 'bg-blue-400' },
};

const riskColorMap: Record<RiskLevel, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
};

const statusColors: Record<CalTaskStatus, string> = {
  scheduled:   'text-slate-400',
  in_progress: 'text-brand-400',
  completed:   'text-green-400',
  deferred:    'text-amber-400',
  overdue:     'text-red-400',
};

const statusLabels: Record<CalTaskStatus, string> = {
  scheduled:   'Scheduled',
  in_progress: 'In Progress',
  completed:   'Completed',
  deferred:    'Deferred',
  overdue:     'Overdue',
};

// ─────────────────────────────────────────────────────────────────────────────
// Task event chip (used in month + week cells)
// ─────────────────────────────────────────────────────────────────────────────

function EventChip({
  task,
  onClick,
  isSelected,
}: {
  task: CalendarTask;
  onClick: (t: CalendarTask) => void;
  isSelected: boolean;
}) {
  const c = priorityColors[task.priority];
  const isOverdue =
    task.date < todayStr() &&
    task.status !== 'completed' &&
    task.status !== 'deferred';

  return (
    <button
      onClick={() => onClick(task)}
      className={`
        w-full text-left px-2 py-1 rounded text-[11px] font-medium leading-tight
        border transition-all duration-150 cursor-pointer
        ${isOverdue ? 'bg-red-500/25 border-red-500/60 text-red-300' : `${c.bg} ${c.border} ${c.text}`}
        ${isSelected ? 'ring-2 ring-brand-400 ring-offset-1 ring-offset-navy-800' : 'hover:brightness-125'}
      `}
      aria-label={`${task.title} - ${task.asset_id}`}
      title={`${task.title}\n${task.asset_id} · ${task.zone}\n${task.start_time}–${task.end_time}`}
    >
      <div className="flex items-center gap-1 truncate">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: riskColorMap[task.risk_level] }}
        />
        <span className="truncate">{task.asset_id}</span>
      </div>
      <div className="truncate opacity-80 mt-0.5">{task.title}</div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail drawer
// ─────────────────────────────────────────────────────────────────────────────

function DetailDrawer({
  task,
  onClose,
  onMarkComplete,
  onReschedule,
  statuses,
}: {
  task: CalendarTask | null;
  onClose: () => void;
  onMarkComplete: (id: string) => void;
  onReschedule: (id: string) => void;
  statuses: Record<string, CalTaskStatus>;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const visible = task !== null;
  const status = task ? (statuses[task.id] ?? task.status) : 'scheduled';
  const isOverdue =
    task &&
    task.date < todayStr() &&
    status !== 'completed' &&
    status !== 'deferred';

  return (
    <>
      {/* Backdrop (mobile only) */}
      {visible && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`
          fixed top-0 right-0 h-full w-full sm:w-[420px] z-40
          bg-navy-900 border-l border-surface-border
          flex flex-col shadow-2xl
          transform transition-transform duration-300 ease-out
          ${visible ? 'translate-x-0' : 'translate-x-full'}
        `}
        aria-label="Task detail panel"
      >
        {task && (
          <>
            {/* Drawer header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-surface-border">
              <div className="min-w-0">
                <p className="text-xs font-mono text-slate-500 mb-0.5">{task.id}</p>
                <h2 className="text-base font-bold text-white leading-snug">{task.title}</h2>
                <p className="text-xs text-slate-400 mt-0.5 capitalize">
                  {task.maintenance_type}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10
                           transition-colors shrink-0 mt-0.5"
                aria-label="Close drawer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Status + Risk row */}
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-surface-border/50
                            bg-navy-850">
              <RiskBadge level={task.risk_level} />
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize
                  ${priorityColors[task.priority].bg} ${priorityColors[task.priority].border}
                  ${priorityColors[task.priority].text}`}
              >
                {task.priority}
              </span>
              <span className={`text-xs font-semibold capitalize ${statusColors[status]}`}>
                {isOverdue ? '⚠ Overdue' : statusLabels[status]}
              </span>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Datetime */}
              <Section icon={<CalendarIcon size={13} />} title="Schedule">
                <Row label="Date" value={task.date} />
                <Row label="Start" value={task.start_time} />
                <Row label="End" value={task.end_time} />
                <Row label="Duration" value={`${task.duration_hours}h`} />
                {isOverdue && (
                  <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20
                                  rounded-lg px-3 py-2">
                    ⚠ This task is past its scheduled date and not yet completed.
                  </div>
                )}
              </Section>

              {/* Asset info */}
              <Section icon={<Wrench size={13} />} title="Asset">
                <Row label="Asset ID"   value={task.asset_id} mono />
                <Row label="Asset Name" value={task.asset_name} />
                <Row label="Type"       value={task.asset_type.replace('_', ' ')} capitalize />
                <Row label="Zone"       value={task.zone} />
                <Row label="Risk Score" value={`${task.risk_score}/100`} />
                <Row label="Last Inspected" value={task.last_inspection} />
              </Section>

              {/* Team */}
              <Section icon={<Users size={13} />} title="Team">
                <Row label="Crew"       value={task.assigned_team} />
                <Row label="Technician" value={task.technician} />
              </Section>

              {/* Work details */}
              <Section icon={<ClipboardList size={13} />} title="Work Details">
                <div className="space-y-2 text-xs">
                  <div>
                    <p className="text-slate-500 mb-1">Description</p>
                    <p className="text-slate-200 leading-relaxed">{task.description}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Required Action</p>
                    <p className="text-slate-200 leading-relaxed">{task.action}</p>
                  </div>
                </div>
              </Section>

              {/* Impact */}
              <Section icon={<Users size={13} />} title="Customer Impact">
                <Row label="Customers Affected" value={task.customers_affected.toLocaleString()} />
              </Section>

              {/* Precautions */}
              <Section icon={<AlertTriangle size={13} />} title="Precautionary Measures">
                <ul className="space-y-1.5">
                  {task.precautions.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </Section>
            </div>

            {/* Action buttons */}
            <div className="px-5 py-4 border-t border-surface-border flex flex-wrap gap-2">
              {status !== 'completed' && (
                <button
                  onClick={() => onMarkComplete(task.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                             bg-green-500/20 text-green-400 border border-green-500/30
                             hover:bg-green-500/30 transition-colors"
                >
                  <CheckCircle2 size={13} />
                  Mark Complete
                </button>
              )}
              <button
                onClick={() => onReschedule(task.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                           bg-amber-500/20 text-amber-400 border border-amber-500/30
                           hover:bg-amber-500/30 transition-colors"
              >
                <RotateCcw size={13} />
                Reschedule
              </button>
              <Link
                to={`/assets/${task.asset_id}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                           bg-brand-600/20 text-brand-400 border border-brand-500/30
                           hover:bg-brand-600/30 transition-colors"
              >
                <ExternalLink size={13} />
                View Asset
              </Link>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                           text-slate-400 border border-surface-border
                           hover:bg-white/5 hover:text-slate-200 transition-colors ml-auto"
              >
                <X size={13} />
                Close
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

// Small helpers for drawer sections
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-brand-400">{icon}</span>
        <p className="text-xs font-semibold text-white uppercase tracking-wider">{title}</p>
      </div>
      {children}
    </div>
  );
}
function Row({ label, value, mono, capitalize }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs py-1 border-b border-surface-border/30">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`font-medium text-right ${mono ? 'font-mono text-brand-300' : 'text-slate-200'} ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Month grid view
// ─────────────────────────────────────────────────────────────────────────────

function MonthView({
  year, month, tasks, selected, onSelect,
}: {
  year: number;
  month: number;
  tasks: CalendarTask[];
  selected: CalendarTask | null;
  onSelect: (t: CalendarTask) => void;
}) {
  const today = todayStr();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const tasksByDate: Record<string, CalendarTask[]> = {};
  for (const t of tasks) {
    if (!tasksByDate[t.date]) tasksByDate[t.date] = [];
    tasksByDate[t.date].push(t);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-surface-border">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-surface-border bg-navy-900">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 bg-navy-800 flex-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[110px] border-r border-b border-surface-border/40 bg-navy-850/50"
              />
            );
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayTasks = tasksByDate[dateStr] ?? [];
          const isToday = dateStr === today;
          const isPast = dateStr < today;
          const hasOverdue = dayTasks.some(
            (t) => t.date < today && t.status !== 'completed' && t.status !== 'deferred',
          );

          return (
            <div
              key={dateStr}
              className={`
                min-h-[110px] border-r border-b border-surface-border/40 p-1.5 flex flex-col gap-1
                ${isPast && !isToday ? 'opacity-75' : ''}
                ${isToday ? 'bg-brand-600/10' : ''}
              `}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={`
                    text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-brand-600 text-white' : isPast ? 'text-slate-600' : 'text-slate-300'}
                  `}
                >
                  {day}
                </span>
                {dayTasks.length > 0 && (
                  <span
                    className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5
                                 ${hasOverdue ? 'bg-red-500/20 text-red-400' : 'bg-navy-700 text-slate-400'}`}
                  >
                    {dayTasks.length}
                  </span>
                )}
              </div>

              {/* Task chips — show max 3, then "+N more" */}
              {dayTasks.slice(0, 3).map((t) => (
                <EventChip
                  key={t.id}
                  task={t}
                  onClick={onSelect}
                  isSelected={selected?.id === t.id}
                />
              ))}
              {dayTasks.length > 3 && (
                <button
                  onClick={() => onSelect(dayTasks[3])}
                  className="text-[10px] text-slate-500 hover:text-slate-300 text-left px-1 transition-colors"
                >
                  +{dayTasks.length - 3} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Week view
// ─────────────────────────────────────────────────────────────────────────────

function WeekView({
  weekStart, tasks, selected, onSelect,
}: {
  weekStart: Date;
  tasks: CalendarTask[];
  selected: CalendarTask | null;
  onSelect: (t: CalendarTask) => void;
}) {
  const today = todayStr();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return { date: d, dateStr: isoDate(d) };
  });

  const tasksByDate: Record<string, CalendarTask[]> = {};
  for (const t of tasks) {
    if (!tasksByDate[t.date]) tasksByDate[t.date] = [];
    tasksByDate[t.date].push(t);
  }

  return (
    <div className="grid grid-cols-7 rounded-xl border border-surface-border overflow-hidden">
      {days.map(({ date, dateStr }) => {
        const dayTasks = tasksByDate[dateStr] ?? [];
        const isToday = dateStr === today;
        const isPast = dateStr < today;
        return (
          <div
            key={dateStr}
            className={`
              min-h-[200px] border-r border-surface-border/40 last:border-r-0 flex flex-col
              ${isToday ? 'bg-brand-600/10' : isPast ? 'bg-navy-850/60' : 'bg-navy-800'}
            `}
          >
            {/* Header */}
            <div className={`px-2 py-2 border-b border-surface-border/40 ${isToday ? 'bg-brand-600/20' : 'bg-navy-900'}`}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase">{WEEKDAYS[date.getDay()]}</p>
              <p className={`text-lg font-bold leading-none mt-0.5 ${isToday ? 'text-brand-400' : isPast ? 'text-slate-600' : 'text-white'}`}>
                {date.getDate()}
              </p>
            </div>
            {/* Tasks */}
            <div className="p-1.5 flex flex-col gap-1 flex-1">
              {dayTasks.map((t) => (
                <EventChip
                  key={t.id}
                  task={t}
                  onClick={onSelect}
                  isSelected={selected?.id === t.id}
                />
              ))}
              {dayTasks.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-[10px] text-slate-700">—</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// List view
// ─────────────────────────────────────────────────────────────────────────────

function ListView({
  tasks, selected, onSelect, statuses,
}: {
  tasks: CalendarTask[];
  selected: CalendarTask | null;
  onSelect: (t: CalendarTask) => void;
  statuses: Record<string, CalTaskStatus>;
}) {
  const today = todayStr();
  const sorted = [...tasks].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  if (sorted.length === 0) {
    return (
      <div className="card py-20 text-center">
        <ClipboardList size={36} className="text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">No tasks match the current filters</p>
        <p className="text-slate-600 text-xs mt-1">Try adjusting filters to see more tasks</p>
      </div>
    );
  }

  // Group by date
  const byDate: Record<string, CalendarTask[]> = {};
  for (const t of sorted) {
    (byDate[t.date] ??= []).push(t);
  }

  return (
    <div className="space-y-4">
      {Object.entries(byDate).map(([date, dateTasks]) => {
        const isPast = date < today;
        const isToday = date === today;
        return (
          <div key={date}>
            {/* Date header */}
            <div className="flex items-center gap-3 mb-2">
              <div className={`
                px-3 py-1.5 rounded-lg text-xs font-bold
                ${isToday ? 'bg-brand-600 text-white' : isPast ? 'bg-navy-800 text-slate-500' : 'bg-navy-800 text-slate-300'}
              `}>
                {isToday ? 'Today' : date}
              </div>
              <div className="flex-1 h-px bg-surface-border/40" />
            </div>

            <div className="space-y-2">
              {dateTasks.map((task) => {
                const status = statuses[task.id] ?? task.status;
                const isOverdue = task.date < today && status !== 'completed' && status !== 'deferred';
                const c = priorityColors[task.priority];
                return (
                  <button
                    key={task.id}
                    onClick={() => onSelect(task)}
                    className={`
                      w-full text-left card p-4 flex items-start gap-4 transition-all duration-150
                      hover:bg-navy-750 focus-visible:ring-2 focus-visible:ring-brand-400
                      ${selected?.id === task.id ? 'ring-2 ring-brand-400' : ''}
                    `}
                  >
                    {/* Priority stripe */}
                    <div className={`w-1 self-stretch rounded-full shrink-0 ${c.dot}`} />

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{task.title}</span>
                          <span className="font-mono text-xs text-slate-500">{task.asset_id}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <RiskBadge level={task.risk_level} size="sm" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="capitalize">{task.asset_type.replace('_', ' ')}</span>
                        <span>{task.zone} Zone</span>
                        <span>{task.start_time}–{task.end_time}</span>
                        <span>{task.assigned_team}</span>
                        <span className={isOverdue ? 'text-red-400 font-semibold' : statusColors[status]}>
                          {isOverdue ? '⚠ Overdue' : statusLabels[status]}
                        </span>
                      </div>
                    </div>

                    <ChevronRight size={15} className="text-slate-600 shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast notification (non-blocking replacement for alert())
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]
                 flex items-center gap-3 px-4 py-3 rounded-xl
                 bg-navy-800 border border-amber-500/30 shadow-2xl text-sm"
    >
      <RotateCcw size={14} className="text-amber-400 shrink-0" />
      <span className="text-slate-200">{message}</span>
      <button
        onClick={onDismiss}
        className="p-0.5 text-slate-500 hover:text-white transition-colors ml-1"
        aria-label="Dismiss notification"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CalendarPage
// ─────────────────────────────────────────────────────────────────────────────

export function CalendarPage() {
  // Stable today reference — captured once at mount
  const todayRef = useRef(new Date());
  const today = todayRef.current;

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, CalTaskStatus>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters
  const [filterRisk, setFilterRisk]     = useState<RiskLevel | 'all'>('all');
  const [filterZone, setFilterZone]     = useState<Zone | 'all'>('all');
  const [filterType, setFilterType]     = useState<AssetType | 'all'>('all');
  const [filterCrew, setFilterCrew]     = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<CalTaskStatus | 'all'>('all');
  const [showFilters, setShowFilters]   = useState(false);

  // Derive effective statuses (local overrides)
  function effectiveStatus(t: CalendarTask): CalTaskStatus {
    if (taskStatuses[t.id]) return taskStatuses[t.id];
    if (t.date < todayStr() && t.status === 'scheduled') return 'overdue';
    return t.status;
  }

  // Actions
  const handleMarkComplete = useCallback((id: string) => {
    setTaskStatuses((prev) => ({ ...prev, [id]: 'completed' }));
  }, []);

  const handleReschedule = useCallback((id: string) => {
    setTaskStatuses((prev) => ({ ...prev, [id]: 'deferred' }));
    setToastMsg(`Task ${id} marked as deferred. A reschedule modal would appear in production.`);
  }, []);

  // Navigate months
  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };
  const goToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setWeekOffset(0);
  };

  // Week start — today is stable (useRef), so only weekOffset triggers recalc
  const weekStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay() + weekOffset * 7);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  // All crews for filter
  const allCrews = useMemo(
    () => ['all', ...Array.from(new Set(calendarTasks.map((t) => t.assigned_team))).sort()],
    [],
  );

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return calendarTasks.filter((t) => {
      const es = effectiveStatus(t);
      if (filterRisk   !== 'all' && t.risk_level     !== filterRisk)   return false;
      if (filterZone   !== 'all' && t.zone            !== filterZone)   return false;
      if (filterType   !== 'all' && t.asset_type      !== filterType)   return false;
      if (filterCrew   !== 'all' && t.assigned_team   !== filterCrew)   return false;
      if (filterStatus !== 'all' && es                !== filterStatus) return false;
      return true;
    });
  }, [filterRisk, filterZone, filterType, filterCrew, filterStatus, taskStatuses]);

  // Summary KPIs
  const kpis = useMemo(() => {
    const todayStr_ = todayStr();
    return {
      total:     calendarTasks.length,
      critical:  calendarTasks.filter((t) => t.risk_level === 'critical').length,
      high:      calendarTasks.filter((t) => t.risk_level === 'high').length,
      completed: calendarTasks.filter((t) => effectiveStatus(t) === 'completed').length,
      dueToday:  calendarTasks.filter((t) => t.date === todayStr_).length,
    };
  }, [taskStatuses]);

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Main content ── */}
      <div
        className={`flex-1 p-6 transition-all duration-300 ${selectedTask ? 'lg:pr-[440px]' : ''}`}
        style={{ maxWidth: selectedTask ? undefined : '1600px' }}
      >
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarIcon size={20} className="text-brand-400" />
              <h1 className="page-title">Maintenance Calendar</h1>
            </div>
            <p className="page-subtitle">
              Scheduled maintenance tasks and asset activities ·{' '}
              <span className="text-slate-300">{today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </p>
          </div>

          {/* View controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`btn-ghost flex items-center gap-1.5 text-xs ${showFilters ? 'bg-white/10 text-white' : ''}`}
            >
              <Filter size={13} />
              Filters
              {(filterRisk !== 'all' || filterZone !== 'all' || filterType !== 'all' || filterCrew !== 'all' || filterStatus !== 'all') && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              )}
            </button>
            <div className="flex items-center bg-navy-900 border border-surface-border rounded-lg overflow-hidden">
              {(['month', 'week', 'list'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 capitalize
                              ${viewMode === m ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  aria-label={`${m} view`}
                >
                  {m === 'month' ? <LayoutGrid size={13} /> : m === 'week' ? <CalendarIcon size={13} /> : <List size={13} />}
                  <span className="hidden sm:inline">{m}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard title="Total Scheduled" value={kpis.total}     icon={CalendarIcon} accent="blue" />
          <StatCard title="Critical Tasks"  value={kpis.critical}  icon={AlertTriangle} accent="red" />
          <StatCard title="High Priority"   value={kpis.high}      icon={Wrench}        accent="orange" />
          <StatCard title="Completed"       value={kpis.completed} icon={CheckCircle2}  accent="green" />
          <StatCard title="Due Today"       value={kpis.dueToday}  icon={Clock}         accent="yellow" />
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
            {/* Risk */}
            <div className="relative">
              <label className="label-muted block mb-1">Risk Level</label>
              <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value as RiskLevel | 'all')} className="select-dark pr-8">
                <option value="all">All Levels</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <span className="pointer-events-none absolute right-2 bottom-2.5 text-slate-400 text-xs">▾</span>
            </div>

            {/* Zone */}
            <div className="relative">
              <label className="label-muted block mb-1">Zone</label>
              <select value={filterZone} onChange={(e) => setFilterZone(e.target.value as Zone | 'all')} className="select-dark pr-8">
                <option value="all">All Zones</option>
                {(['North', 'South', 'East', 'West', 'Central'] as Zone[]).map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 bottom-2.5 text-slate-400 text-xs">▾</span>
            </div>

            {/* Asset type */}
            <div className="relative">
              <label className="label-muted block mb-1">Asset Type</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as AssetType | 'all')} className="select-dark pr-8">
                <option value="all">All Types</option>
                <option value="transformer">Transformer</option>
                <option value="substation">Substation</option>
                <option value="transmission_line">Transmission Line</option>
                <option value="circuit_breaker">Circuit Breaker</option>
                <option value="capacitor_bank">Capacitor Bank</option>
              </select>
              <span className="pointer-events-none absolute right-2 bottom-2.5 text-slate-400 text-xs">▾</span>
            </div>

            {/* Crew */}
            <div className="relative">
              <label className="label-muted block mb-1">Crew</label>
              <select value={filterCrew} onChange={(e) => setFilterCrew(e.target.value)} className="select-dark pr-8" style={{ maxWidth: 220 }}>
                {allCrews.map((c) => (
                  <option key={c} value={c}>{c === 'all' ? 'All Crews' : c}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 bottom-2.5 text-slate-400 text-xs">▾</span>
            </div>

            {/* Status */}
            <div className="relative">
              <label className="label-muted block mb-1">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as CalTaskStatus | 'all')} className="select-dark pr-8">
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="deferred">Deferred</option>
                <option value="overdue">Overdue</option>
              </select>
              <span className="pointer-events-none absolute right-2 bottom-2.5 text-slate-400 text-xs">▾</span>
            </div>

            <button
              onClick={() => {
                setFilterRisk('all'); setFilterZone('all'); setFilterType('all');
                setFilterCrew('all'); setFilterStatus('all');
              }}
              className="btn-ghost flex items-center gap-1 text-xs self-end"
            >
              <RotateCcw size={11} /> Reset
            </button>

            <span className="text-xs text-slate-500 self-end ml-auto">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* ── Calendar nav bar ── */}
        {viewMode !== 'list' && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={viewMode === 'month' ? prevMonth : () => setWeekOffset((w) => w - 1)}
                className="btn-ghost p-2" aria-label="Previous"
              >
                <ChevronLeft size={16} />
              </button>
              <h2 className="text-base font-bold text-white min-w-[200px] text-center">
                {viewMode === 'month'
                  ? `${MONTHS[currentMonth]} ${currentYear}`
                  : `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </h2>
              <button
                onClick={viewMode === 'month' ? nextMonth : () => setWeekOffset((w) => w + 1)}
                className="btn-ghost p-2" aria-label="Next"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <button onClick={goToday} className="btn-ghost text-xs px-3 py-1.5">
              Today
            </button>
          </div>
        )}

        {/* ── Views ── */}
        {viewMode === 'month' && (
          <MonthView
            year={currentYear}
            month={currentMonth}
            tasks={filteredTasks}
            selected={selectedTask}
            onSelect={setSelectedTask}
          />
        )}
        {viewMode === 'week' && (
          <WeekView
            weekStart={weekStart}
            tasks={filteredTasks}
            selected={selectedTask}
            onSelect={setSelectedTask}
          />
        )}
        {viewMode === 'list' && (
          <ListView
            tasks={filteredTasks}
            selected={selectedTask}
            onSelect={setSelectedTask}
            statuses={taskStatuses}
          />
        )}
      </div>

      {/* ── Detail Drawer ── */}
      <DetailDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onMarkComplete={handleMarkComplete}
        onReschedule={handleReschedule}
        statuses={taskStatuses}
      />

      {/* ── Toast notification ── */}
      {toastMsg && (
        <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />
      )}
    </div>
  );
}
