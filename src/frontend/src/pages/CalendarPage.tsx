import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
  CheckCircle2,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  Users,
  Wrench,
  ClipboardList,
  Search,
} from 'lucide-react';
import { calendarTasks } from '../mock/calendarMockData';
import type { CalendarTask, CalTaskStatus, CalZone, CalCrew } from '../mock/calendarMockData';
import { RiskBadge } from '../components/ui/StatusBadge';
import type { RiskLevel, AssetType } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'list';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// The "current" date for this demo
const MOCK_TODAY = '2026-09-15';
const MOCK_TODAY_DATE = new Date(2026, 8, 15); // Sept 15, 2026

// Risk-level event card colours — enterprise-readable, per spec
const riskEventStyle: Record<RiskLevel, { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B', dot: '#DC2626' },
  high:     { bg: '#FFEDD5', border: '#FDBA74', text: '#9A3412', dot: '#F97316' },
  medium:   { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', dot: '#EAB308' },
  low:      { bg: '#DCFCE7', border: '#86EFAC', text: '#166534', dot: '#16A34A' },
};

// Legend dot colours
const legendDots: { level: RiskLevel; label: string; color: string }[] = [
  { level: 'critical', label: 'Critical', color: '#DC2626' },
  { level: 'high',     label: 'High',     color: '#F97316' },
  { level: 'medium',   label: 'Medium',   color: '#EAB308' },
  { level: 'low',      label: 'Low',      color: '#16A34A' },
];

const statusLabels: Record<CalTaskStatus, string> = {
  scheduled:   'Scheduled',
  in_progress: 'In Progress',
  completed:   'Completed',
  overdue:     'Overdue',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getDaysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function getFirstDayOfWeek(y: number, m: number): number {
  return new Date(y, m, 1).getDay();
}

// ─────────────────────────────────────────────────────────────────────────────
// Event chip — risk-level coloured, enterprise readable
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
  const c = riskEventStyle[task.risk_level];

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(task); }}
      className="cal-event-chip"
      style={{
        background: c.bg,
        borderColor: c.border,
        color: c.text,
        outline: isSelected ? '2px solid #2457b8' : 'none',
        outlineOffset: isSelected ? '1px' : '0',
      }}
      title={`${task.title}\n${task.asset_id} · ${task.zone}\n${task.start_time}–${task.end_time}`}
      aria-label={`${task.title} - ${task.asset_id}`}
    >
      {/* Asset ID row with dot */}
      <div className="cal-event-asset">
        <span
          className="cal-event-dot"
          style={{ background: c.dot }}
        />
        <span className="cal-event-asset-id">{task.asset_id}</span>
      </div>
      {/* Title */}
      <div className="cal-event-title">{task.title}</div>
      {/* Time */}
      <div className="cal-event-time">{task.start_time} - {task.end_time}</div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail drawer (right slide-in panel)
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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const visible = task !== null;
  const status = task ? (statuses[task.id] ?? task.status) : 'scheduled';

  return (
    <>
      {/* Backdrop overlay — only when drawer is open */}
      {visible && (
        <div
          className="cal-drawer-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`cal-drawer ${visible ? 'cal-drawer-open' : ''}`}
        aria-label="Task detail panel"
        role="complementary"
      >
        {task && (
          <>
            {/* Header */}
            <div className="cal-drawer-header">
              <div style={{ minWidth: 0 }}>
                <p className="cal-drawer-task-id">{task.id}</p>
                <h2 className="cal-drawer-task-title">{task.title}</h2>
                <p className="cal-drawer-task-mtype">{task.maintenance_type}</p>
              </div>
              <button
                onClick={onClose}
                className="cal-drawer-close-btn"
                aria-label="Close panel"
              >
                <X size={16} />
              </button>
            </div>

            {/* Badges row */}
            <div className="cal-drawer-badges">
              <RiskBadge level={task.risk_level} />
              <span className="cal-drawer-status-badge">
                {statusLabels[status]}
              </span>
            </div>

            {/* Body */}
            <div className="cal-drawer-body">
              <DrawerSection icon={<CalendarIcon size={13} />} title="Schedule">
                <DrawerRow label="Date" value={task.date} />
                <DrawerRow label="Start" value={task.start_time} />
                <DrawerRow label="End" value={task.end_time} />
                <DrawerRow label="Duration" value={`${task.duration_hours}h`} />
              </DrawerSection>

              <DrawerSection icon={<Wrench size={13} />} title="Asset">
                <DrawerRow label="Asset ID" value={task.asset_id} mono />
                <DrawerRow label="Asset Name" value={task.asset_name} />
                <DrawerRow label="Type" value={task.asset_type.replace('_', ' ')} cap />
                <DrawerRow label="Zone" value={task.zone} />
                <DrawerRow label="Risk Score" value={`${task.risk_score}/100`} />
                <DrawerRow label="Last Inspected" value={task.last_inspection} />
              </DrawerSection>

              <DrawerSection icon={<Users size={13} />} title="Team">
                <DrawerRow label="Crew" value={task.assigned_team} />
                <DrawerRow label="Technician" value={task.technician} />
              </DrawerSection>

              <DrawerSection icon={<ClipboardList size={13} />} title="Work Details">
                <p className="cal-drawer-sublabel">Description</p>
                <p className="cal-drawer-subtext">{task.description}</p>
                <p className="cal-drawer-sublabel" style={{ marginTop: 8 }}>Required Action</p>
                <p className="cal-drawer-subtext">{task.action}</p>
              </DrawerSection>

              <DrawerSection icon={<Users size={13} />} title="Customer Impact">
                <DrawerRow label="Customers Affected" value={task.customers_affected.toLocaleString()} />
              </DrawerSection>

              <DrawerSection icon={<AlertTriangle size={13} />} title="Precautionary Measures">
                <ul className="cal-drawer-precautions">
                  {task.precautions.map((p, i) => (
                    <li key={i}>
                      <span className="cal-drawer-precaution-dot">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </DrawerSection>
            </div>

            {/* Actions */}
            <div className="cal-drawer-actions">
              {status !== 'completed' && (
                <button
                  onClick={() => onMarkComplete(task.id)}
                  className="cal-drawer-btn cal-drawer-btn-complete"
                >
                  <CheckCircle2 size={13} /> Mark Complete
                </button>
              )}
              <button
                onClick={() => onReschedule(task.id)}
                className="cal-drawer-btn cal-drawer-btn-reschedule"
              >
                <RotateCcw size={13} /> Reschedule
              </button>
              <Link
                to={`/assets/${task.asset_id}`}
                className="cal-drawer-btn cal-drawer-btn-asset"
              >
                <ExternalLink size={13} /> View Asset
              </Link>
              <button
                onClick={onClose}
                className="cal-drawer-btn cal-drawer-btn-close"
              >
                <X size={13} /> Close
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function DrawerSection({
  icon, title, children,
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div className="cal-drawer-section">
      <div className="cal-drawer-section-header">
        <span className="cal-drawer-section-icon">{icon}</span>
        <p className="cal-drawer-section-title">{title}</p>
      </div>
      {children}
    </div>
  );
}

function DrawerRow({
  label, value, mono, cap,
}: {
  label: string; value: string; mono?: boolean; cap?: boolean;
}) {
  return (
    <div className="cal-drawer-row">
      <span className="cal-drawer-row-label">{label}</span>
      <span
        className="cal-drawer-row-value"
        style={{
          fontFamily: mono ? 'Consolas, monospace' : undefined,
          textTransform: cap ? 'capitalize' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Month view
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
  const firstDay = getFirstDayOfWeek(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month === 0 ? 11 : month - 1);

  // Build cells: prev month filler + current month + next month filler
  interface CellData {
    day: number;
    type: 'prev' | 'current' | 'next';
    dateStr: string;
  }

  const cells: CellData[] = [];

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ day: d, type: 'prev', dateStr: isoDate(py, pm, d) });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, type: 'current', dateStr: isoDate(year, month, d) });
  }

  // Next month leading days
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, type: 'next', dateStr: isoDate(ny, nm, d) });
    }
  }

  const tasksByDate: Record<string, CalendarTask[]> = {};
  for (const t of tasks) {
    (tasksByDate[t.date] ??= []).push(t);
  }

  return (
    <div className="cal-grid-container">
      {/* Day-of-week header */}
      <div className="cal-grid-header">
        {WEEKDAYS.map((d) => (
          <div key={d} className="cal-grid-header-cell">
            {d}
          </div>
        ))}
      </div>

      {/* Grid cells */}
      <div className="cal-grid-body">
        {cells.map((cell, idx) => {
          const dayTasks = tasksByDate[cell.dateStr] ?? [];
          const isToday = cell.dateStr === MOCK_TODAY;
          const isOtherMonth = cell.type !== 'current';

          return (
            <div
              key={`${cell.dateStr}-${idx}`}
              className={`cal-grid-cell ${isToday ? 'cal-grid-cell-today' : ''} ${isOtherMonth ? 'cal-grid-cell-other' : ''}`}
            >
              {/* Day number */}
              <div className="cal-grid-day-number">
                <span className={isToday ? 'cal-today-badge' : isOtherMonth ? 'cal-other-month-day' : 'cal-current-month-day'}>
                  {cell.day}
                </span>
              </div>

              {/* Event chips */}
              <div className="cal-grid-events">
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
                    className="cal-more-btn"
                  >
                    +{dayTasks.length - 3} more
                  </button>
                )}
              </div>
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
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return {
      date: d,
      dateStr: isoDate(d.getFullYear(), d.getMonth(), d.getDate()),
    };
  });

  const tasksByDate: Record<string, CalendarTask[]> = {};
  for (const t of tasks) {
    (tasksByDate[t.date] ??= []).push(t);
  }

  return (
    <div className="cal-week-container">
      {days.map(({ date, dateStr }) => {
        const dayTasks = tasksByDate[dateStr] ?? [];
        const isToday = dateStr === MOCK_TODAY;
        return (
          <div
            key={dateStr}
            className={`cal-week-day ${isToday ? 'cal-week-day-today' : ''}`}
          >
            <div className={`cal-week-day-header ${isToday ? 'cal-week-day-header-today' : ''}`}>
              <span className="cal-week-dayname">{WEEKDAYS[date.getDay()]}</span>
              <span className={`cal-week-daynum ${isToday ? 'cal-today-badge' : ''}`}>
                {date.getDate()}
              </span>
            </div>
            <div className="cal-week-events">
              {dayTasks.map((t) => (
                <EventChip key={t.id} task={t} onClick={onSelect} isSelected={selected?.id === t.id} />
              ))}
              {dayTasks.length === 0 && (
                <div className="cal-week-empty">—</div>
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
  const sorted = [...tasks].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time),
  );

  if (sorted.length === 0) {
    return (
      <div className="cal-list-empty">
        <ClipboardList size={32} style={{ color: '#94A3B8', marginBottom: 12 }} />
        <p style={{ fontWeight: 500 }}>No tasks match the current filters</p>
        <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>Adjust filters or clear them to see tasks</p>
      </div>
    );
  }

  return (
    <div className="cal-list-container">
      <table className="cal-list-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Task</th>
            <th>Asset</th>
            <th>Asset Type</th>
            <th>Zone</th>
            <th>Criticality</th>
            <th>Crew</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const c = riskEventStyle[task.risk_level];
            const status = statuses[task.id] ?? task.status;
            return (
              <tr
                key={task.id}
                className={selected?.id === task.id ? 'cal-list-row-selected' : ''}
                onClick={() => onSelect(task)}
                style={{ cursor: 'pointer' }}
              >
                <td>{task.date}</td>
                <td>{task.start_time} - {task.end_time}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{task.title}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{task.id}</div>
                </td>
                <td style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{task.asset_id}</td>
                <td style={{ textTransform: 'capitalize' }}>{task.asset_type.replace('_', ' ')}</td>
                <td>{task.zone}</td>
                <td>
                  <span className="cal-list-criticality" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
                    <span className="cal-list-criticality-dot" style={{ background: c.dot }} />
                    {task.risk_level}
                  </span>
                </td>
                <td>{task.assigned_team}</td>
                <td>
                  <span className={`cal-list-status cal-list-status-${status}`}>
                    {statusLabels[status]}
                  </span>
                </td>
                <td>
                  <button
                    className="cal-list-action-btn"
                    onClick={(e) => { e.stopPropagation(); onSelect(task); }}
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div role="status" aria-live="polite" className="cal-toast">
      <RotateCcw size={13} />
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss" className="cal-toast-dismiss">
        <X size={12} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CalendarPage
// ─────────────────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(8); // September = 8 (0-indexed)
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, CalTaskStatus>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // ── Filter state ──
  const [searchText, setSearchText]       = useState('');
  const [filterRisk, setFilterRisk]       = useState<RiskLevel | 'all'>('all');
  const [filterType, setFilterType]       = useState<AssetType | 'all'>('all');
  const [filterZone, setFilterZone]       = useState<CalZone | 'all'>('all');
  const [filterCrew, setFilterCrew]       = useState<CalCrew | 'all'>('all');
  const [filterStatus, setFilterStatus]   = useState<CalTaskStatus | 'all'>('all');
  // "staged" = inputs; "applied" = what actually filters
  const [appliedSearch, setAppliedSearch]     = useState('');
  const [appliedRisk, setAppliedRisk]         = useState<RiskLevel | 'all'>('all');
  const [appliedType, setAppliedType]         = useState<AssetType | 'all'>('all');
  const [appliedZone, setAppliedZone]         = useState<CalZone | 'all'>('all');
  const [appliedCrew, setAppliedCrew]         = useState<CalCrew | 'all'>('all');
  const [appliedStatus, setAppliedStatus]     = useState<CalTaskStatus | 'all'>('all');

  function applyFilters() {
    setAppliedSearch(searchText);
    setAppliedRisk(filterRisk);
    setAppliedType(filterType);
    setAppliedZone(filterZone);
    setAppliedCrew(filterCrew);
    setAppliedStatus(filterStatus);
  }

  function clearFilters() {
    setSearchText(''); setFilterRisk('all'); setFilterType('all');
    setFilterZone('all'); setFilterCrew('all'); setFilterStatus('all');
    setAppliedSearch(''); setAppliedRisk('all'); setAppliedType('all');
    setAppliedZone('all'); setAppliedCrew('all'); setAppliedStatus('all');
  }

  const handleMarkComplete = useCallback((id: string) => {
    setTaskStatuses((prev) => ({ ...prev, [id]: 'completed' }));
    setToastMsg(`Task ${id} marked as completed.`);
  }, []);

  const handleReschedule = useCallback((id: string) => {
    setTaskStatuses((prev) => ({ ...prev, [id]: 'scheduled' }));
    setToastMsg(`Task ${id} marked for rescheduling.`);
  }, []);

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };
  const goToday = () => {
    setCurrentYear(2026);
    setCurrentMonth(8);
    setWeekOffset(0);
  };

  const weekStart = useMemo(() => {
    const d = new Date(MOCK_TODAY_DATE);
    d.setDate(d.getDate() - d.getDay() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return calendarTasks.filter((t) => {
      const status = taskStatuses[t.id] ?? t.status;
      if (appliedSearch) {
        const q = appliedSearch.toLowerCase();
        if (
          !t.id.toLowerCase().includes(q) &&
          !t.asset_id.toLowerCase().includes(q) &&
          !t.title.toLowerCase().includes(q) &&
          !t.asset_type.toLowerCase().includes(q) &&
          !t.zone.toLowerCase().includes(q) &&
          !t.assigned_team.toLowerCase().includes(q)
        ) return false;
      }
      if (appliedRisk   !== 'all' && t.risk_level    !== appliedRisk)   return false;
      if (appliedType   !== 'all' && t.asset_type    !== appliedType)   return false;
      if (appliedZone   !== 'all' && t.zone          !== appliedZone)   return false;
      if (appliedCrew   !== 'all' && t.assigned_team !== appliedCrew)   return false;
      if (appliedStatus !== 'all' && status          !== appliedStatus) return false;
      return true;
    });
  }, [appliedSearch, appliedRisk, appliedType, appliedZone, appliedCrew, appliedStatus, taskStatuses]);

  // Legend counts
  const legendCounts = useMemo(() => ({
    critical: filteredTasks.filter((t) => t.risk_level === 'critical').length,
    high:     filteredTasks.filter((t) => t.risk_level === 'high').length,
    medium:   filteredTasks.filter((t) => t.risk_level === 'medium').length,
    low:      filteredTasks.filter((t) => t.risk_level === 'low').length,
  }), [filteredTasks]);

  return (
    <div className="cal-page">
      {/* Main content */}
      <div className="cal-content">

        {/* ── Breadcrumb ── */}
        <nav className="cal-breadcrumb" aria-label="Breadcrumb">
          <span>Home</span>
          <span className="cal-breadcrumb-sep">&gt;</span>
          <span className="cal-breadcrumb-current">Calendar</span>
        </nav>

        {/* ── Page header ── */}
        <div className="cal-page-header">
          <div>
            <div className="cal-page-title-row">
              <CalendarIcon size={22} className="cal-title-icon" />
              <h1 className="cal-page-title">Maintenance Calendar</h1>
            </div>
            <p className="cal-page-subtitle">
              Scheduled maintenance tasks and asset activities.
            </p>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="cal-filter-bar">
          <div className="cal-filter-fields">
            {/* Search */}
            <div className="cal-filter-field cal-filter-search">
              <label className="cal-filter-label">Search</label>
              <div className="cal-filter-input-wrap">
                <Search size={14} className="cal-filter-search-icon" />
                <input
                  type="text"
                  placeholder="Search tasks, assets..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  className="cal-filter-input cal-filter-input-search"
                  aria-label="Search tasks"
                />
              </div>
            </div>

            {/* Criticality */}
            <div className="cal-filter-field">
              <label className="cal-filter-label">Criticality</label>
              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value as RiskLevel | 'all')}
                className="cal-filter-select"
                aria-label="Filter by criticality"
              >
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Asset Type */}
            <div className="cal-filter-field">
              <label className="cal-filter-label">Asset Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as AssetType | 'all')}
                className="cal-filter-select"
                aria-label="Filter by asset type"
              >
                <option value="all">All</option>
                <option value="transformer">Transformer</option>
                <option value="substation">Substation</option>
                <option value="circuit_breaker">Circuit Breaker</option>
                <option value="transmission_line">Transmission Line</option>
                <option value="capacitor_bank">Capacitor Bank</option>
              </select>
            </div>

            {/* Zone */}
            <div className="cal-filter-field">
              <label className="cal-filter-label">Zone</label>
              <select
                value={filterZone}
                onChange={(e) => setFilterZone(e.target.value as CalZone | 'all')}
                className="cal-filter-select"
                aria-label="Filter by zone"
              >
                <option value="all">All</option>
                <option value="Zone A">Zone A</option>
                <option value="Zone B">Zone B</option>
                <option value="Zone C">Zone C</option>
                <option value="Zone D">Zone D</option>
              </select>
            </div>

            {/* Crew */}
            <div className="cal-filter-field">
              <label className="cal-filter-label">Crew</label>
              <select
                value={filterCrew}
                onChange={(e) => setFilterCrew(e.target.value as CalCrew | 'all')}
                className="cal-filter-select"
                aria-label="Filter by crew"
              >
                <option value="all">All</option>
                <option value="Crew Alpha">Crew Alpha</option>
                <option value="Crew Beta">Crew Beta</option>
                <option value="Crew Gamma">Crew Gamma</option>
                <option value="Crew Delta">Crew Delta</option>
              </select>
            </div>

            {/* Status */}
            <div className="cal-filter-field">
              <label className="cal-filter-label">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as CalTaskStatus | 'all')}
                className="cal-filter-select"
                aria-label="Filter by status"
              >
                <option value="all">All</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="cal-filter-buttons">
              <button onClick={applyFilters} className="cal-btn-apply">
                Apply Filters
              </button>
              <button onClick={clearFilters} className="cal-btn-clear">
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* ── Month navigation row ── */}
        <div className="cal-nav-row">
          <div className="cal-nav-left">
            <button onClick={goToday} className="cal-nav-btn">Today</button>
            <button
              onClick={viewMode === 'month' ? prevMonth : () => setWeekOffset((w) => w - 1)}
              className="cal-nav-btn cal-nav-arrow"
              aria-label="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={viewMode === 'month' ? nextMonth : () => setWeekOffset((w) => w + 1)}
              className="cal-nav-btn cal-nav-arrow"
              aria-label="Next"
            >
              <ChevronRight size={16} />
            </button>
            <h2 className="cal-month-title">
              {viewMode === 'month'
                ? `${MONTHS[currentMonth]} ${currentYear}`
                : viewMode === 'week'
                  ? `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : `${MONTHS[currentMonth]} ${currentYear}`
              }
            </h2>
          </div>
          <div className="cal-nav-right">
            {/* View mode toggle */}
            <div className="cal-view-toggle">
              {(['month', 'week', 'list'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`cal-view-btn ${viewMode === m ? 'cal-view-btn-active' : ''}`}
                  aria-label={`${m} view`}
                >
                  {m === 'month' ? 'Month' : m === 'week' ? 'Week' : 'List'}
                </button>
              ))}
            </div>
          </div>
        </div>

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

        {/* ── Legend ── */}
        <div className="cal-legend">
          <span className="cal-legend-total">
            Total: {filteredTasks.length} tasks
          </span>
          {legendDots.map(({ level, label, color }) => (
            <span key={level} className="cal-legend-item">
              <span className="cal-legend-dot" style={{ background: color }} />
              {label} ({legendCounts[level]})
            </span>
          ))}
        </div>
      </div>

      {/* ── Detail Drawer ── */}
      <DetailDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onMarkComplete={handleMarkComplete}
        onReschedule={handleReschedule}
        statuses={taskStatuses}
      />

      {/* ── Toast ── */}
      {toastMsg && (
        <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />
      )}
    </div>
  );
}
