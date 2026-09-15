import { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  Monitor,
  Bell,
  Eye,
  Info,
  Save,
  RotateCcw,
  Check,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import {
  useSettingsStore,
  type GridGuardSettings,
  type TextSize,
  type DateFormat,
  type TimeFormat,
  type Density,
  type AssetView,
} from '../settings/useSettingsStore';
import { THEMES, type ThemeId } from '../theme/themeUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Section IDs
// ─────────────────────────────────────────────────────────────────────────────

type SectionId = 'general' | 'appearance' | 'accessibility' | 'notifications' | 'system';

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'general',       label: 'General',        icon: <SettingsIcon size={14} />, description: 'Application preferences' },
  { id: 'appearance',    label: 'Appearance',      icon: <Monitor size={14} />,      description: 'Theme and display' },
  { id: 'accessibility', label: 'Accessibility',   icon: <Eye size={14} />,          description: 'Text, motion, contrast' },
  { id: 'notifications', label: 'Notifications',   icon: <Bell size={14} />,         description: 'Alert preferences' },
  { id: 'system',        label: 'System',          icon: <Info size={14} />,         description: 'System information' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable primitives — enterprise office style
// ─────────────────────────────────────────────────────────────────────────────

/** Section title + description */
function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-3 mb-4 border-b border-surface-border">
      <h2 className="text-sm font-bold text-white">{title}</h2>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </div>
  );
}

/** A single settings row: label on the left, control on the right */
function SettingsRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-surface-border/50 last:border-b-0">
      <div className="flex-1 min-w-0">
        <label
          htmlFor={htmlFor}
          className="block text-xs font-semibold text-slate-200 mb-0.5 cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <p className="text-[11px] text-slate-500 leading-snug">{description}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}

/** Read-only info row */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5 border-b border-surface-border/50 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-40">{label}</span>
      <span className="text-xs font-mono text-slate-200 text-right">{value}</span>
    </div>
  );
}

/** Standard <select> styled for the office theme */
function OSelect({
  id,
  value,
  onChange,
  children,
  className = '',
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`select-dark pr-7 min-w-[160px] ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={11}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

/** Toggle switch — ON/OFF */
function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 cursor-pointer select-none"
      aria-label={label}
    >
      {/* Track */}
      <span
        className={`relative inline-block w-9 h-5 rounded-sm border transition-colors ${
          checked
            ? 'bg-brand-600 border-brand-500'
            : 'bg-navy-700 border-surface-border'
        }`}
      >
        {/* Thumb */}
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-sm bg-white border transition-all ${
            checked
              ? 'left-[18px] border-brand-400'
              : 'left-0.5 border-slate-400'
          }`}
        />
      </span>
      <input
        type="checkbox"
        id={id}
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-xs font-semibold text-slate-300 w-7">
        {checked ? 'ON' : 'OFF'}
      </span>
    </label>
  );
}

/** Radio-button group (horizontal or vertical) */
function RadioGroup<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5" role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-start gap-2.5 px-2.5 py-2 border rounded cursor-pointer transition-colors ${
            value === opt.value
              ? 'border-brand-500/60 bg-brand-600/10'
              : 'border-surface-border hover:bg-navy-750'
          }`}
        >
          <span className="mt-0.5 flex-shrink-0">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-brand-500 w-3 h-3"
            />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-slate-200">{opt.label}</span>
            {opt.description && (
              <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{opt.description}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset confirmation dialog
// ─────────────────────────────────────────────────────────────────────────────

function ResetDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Escape key closes
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-dialog-title"
        className="relative z-10 bg-navy-800 border-2 border-surface-border rounded
                   shadow-2xl w-full max-w-sm mx-4 p-6"
      >
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 id="reset-dialog-title" className="text-sm font-bold text-white mb-1">
              Reset Settings?
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to restore all GridGuard settings to their
              default values? This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
          <button
            onClick={onCancel}
            className="btn-ghost text-xs"
            autoFocus
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-xs font-semibold px-3 py-1.5 rounded border
                       bg-amber-500/15 text-amber-300 border-amber-500/40
                       hover:bg-amber-500/25 transition-colors"
          >
            Reset Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast — temporary success/info notification
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
                 flex items-center gap-2.5 px-4 py-2.5 rounded border
                 bg-navy-800 border-green-600/50 shadow-2xl text-xs font-semibold"
    >
      <Check size={13} className="text-green-400 shrink-0" />
      <span className="text-slate-200">{message}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings sections
// ─────────────────────────────────────────────────────────────────────────────

function GeneralSection({
  draft,
  update,
}: {
  draft: GridGuardSettings;
  update: <K extends keyof GridGuardSettings>(k: K, v: GridGuardSettings[K]) => void;
}) {
  return (
    <div>
      <SectionHeader
        title="General Settings"
        description="Configure general GridGuard application preferences."
      />

      <div className="space-y-0">
        <SettingsRow label="Application Name" description="The application identifier.">
          <input
            readOnly
            value="GridGuard AI"
            className="input-dark min-w-[180px] opacity-60 cursor-not-allowed"
            aria-readonly="true"
          />
        </SettingsRow>

        <SettingsRow label="Application Version" description="Current installed version.">
          <input
            readOnly
            value="v1.0"
            className="input-dark w-24 opacity-60 cursor-not-allowed"
            aria-readonly="true"
          />
        </SettingsRow>

        <SettingsRow
          label="Default Dashboard"
          description="The view displayed when the app first loads."
          htmlFor="defaultDashboard"
        >
          <OSelect
            id="defaultDashboard"
            value={draft.defaultDashboard}
            onChange={(v) => update('defaultDashboard', v as GridGuardSettings['defaultDashboard'])}
          >
            <option value="Grid Health Dashboard">Grid Health Dashboard</option>
          </OSelect>
        </SettingsRow>

        <SettingsRow
          label="Default Asset View"
          description="Filter applied when opening the Asset Rankings page."
          htmlFor="defaultAssetView"
        >
          <OSelect
            id="defaultAssetView"
            value={draft.defaultAssetView}
            onChange={(v) => update('defaultAssetView', v as AssetView)}
          >
            <option value="All Assets">All Assets</option>
            <option value="Critical Assets">Critical Assets</option>
            <option value="High Risk Assets">High Risk Assets</option>
            <option value="Recently Inspected">Recently Inspected</option>
          </OSelect>
        </SettingsRow>

        <SettingsRow
          label="Date Format"
          description="How dates are displayed across the application."
          htmlFor="dateFormat"
        >
          <OSelect
            id="dateFormat"
            value={draft.dateFormat}
            onChange={(v) => update('dateFormat', v as DateFormat)}
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
          </OSelect>
        </SettingsRow>

        <SettingsRow
          label="Time Format"
          description="12-hour (AM/PM) or 24-hour clock display."
          htmlFor="timeFormat"
        >
          <OSelect
            id="timeFormat"
            value={draft.timeFormat}
            onChange={(v) => update('timeFormat', v as TimeFormat)}
          >
            <option value="24-hour">24-hour</option>
            <option value="12-hour">12-hour (AM/PM)</option>
          </OSelect>
        </SettingsRow>

        <SettingsRow
          label="Data Display Density"
          description="Controls spacing in tables and lists."
        >
          <OSelect
            value={draft.density}
            onChange={(v) => update('density', v as Density)}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </OSelect>
        </SettingsRow>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AppearanceSection({
  draft,
  update,
}: {
  draft: GridGuardSettings;
  update: <K extends keyof GridGuardSettings>(k: K, v: GridGuardSettings[K]) => void;
}) {
  return (
    <div>
      <SectionHeader
        title="Appearance"
        description="Customize the visual theme of the GridGuard application."
      />

      <p className="text-xs font-semibold text-slate-300 mb-2">Theme</p>
      <p className="text-[11px] text-slate-500 mb-3">
        Selecting a theme applies it immediately across the entire application.
      </p>

      <RadioGroup<ThemeId>
        name="theme"
        value={draft.theme}
        options={THEMES.map((t) => ({
          value: t.id,
          label: t.label,
          description: t.description,
        }))}
        onChange={(id) => update('theme', id)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AccessibilitySection({
  draft,
  update,
}: {
  draft: GridGuardSettings;
  update: <K extends keyof GridGuardSettings>(k: K, v: GridGuardSettings[K]) => void;
}) {
  return (
    <div>
      <SectionHeader
        title="Accessibility"
        description="Adjust GridGuard for improved readability and accessibility."
      />

      <div className="space-y-0">
        <SettingsRow
          label="Text Size"
          description="Adjusts the base font size across the application."
        >
          <OSelect
            value={draft.textSize}
            onChange={(v) => update('textSize', v as TextSize)}
          >
            <option value="small">Small</option>
            <option value="default">Default</option>
            <option value="large">Large</option>
          </OSelect>
        </SettingsRow>

        <SettingsRow
          label="Reduced Motion"
          description="Minimises animations and transitions for users sensitive to motion."
          htmlFor="toggle-reduced-motion"
        >
          <Toggle
            id="toggle-reduced-motion"
            label="Reduced motion"
            checked={draft.reducedMotion}
            onChange={(v) => update('reducedMotion', v)}
          />
        </SettingsRow>

        <SettingsRow
          label="High Contrast"
          description={
            draft.theme === 'hc-dark' || draft.theme === 'hc-light'
              ? 'High contrast is currently active via Appearance → Theme.'
              : 'Select High Contrast Dark or Light in Appearance to enable.'
          }
        >
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded border ${
              draft.theme === 'hc-dark' || draft.theme === 'hc-light'
                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                : 'bg-navy-700 text-slate-500 border-surface-border'
            }`}
          >
            {draft.theme === 'hc-dark' || draft.theme === 'hc-light' ? 'Active' : 'Inactive'}
          </span>
        </SettingsRow>

        <SettingsRow
          label="Show Status Labels"
          description={
            'Always display text labels alongside risk and status colour indicators. ' +
            'Recommended — do not rely on colour alone.'
          }
          htmlFor="toggle-status-labels"
        >
          <Toggle
            id="toggle-status-labels"
            label="Show status labels"
            checked={draft.showStatusLabels}
            onChange={(v) => update('showStatusLabels', v)}
          />
        </SettingsRow>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface NotifRow {
  key: keyof GridGuardSettings;
  label: string;
  description: string;
}

const NOTIF_ROWS: NotifRow[] = [
  {
    key: 'criticalAssetAlerts',
    label: 'Critical Asset Alerts',
    description: 'Receive alerts when critical-risk assets require immediate attention.',
  },
  {
    key: 'highRiskAlerts',
    label: 'High Risk Asset Alerts',
    description: 'Receive alerts when assets are elevated to high-risk status.',
  },
  {
    key: 'maintenanceReminders',
    label: 'Maintenance Reminders',
    description: 'Receive reminders for scheduled maintenance tasks.',
  },
  {
    key: 'weatherRiskAlerts',
    label: 'Weather Risk Alerts',
    description: 'Receive alerts when adverse weather conditions affect grid assets.',
  },
  {
    key: 'overdueMaintenanceAlerts',
    label: 'Overdue Maintenance Alerts',
    description: 'Receive alerts when scheduled maintenance tasks become overdue.',
  },
  {
    key: 'dailySummary',
    label: 'Daily Grid Summary',
    description: 'Receive a daily summary of overall grid health and risk status.',
  },
];

function NotificationsSection({
  draft,
  update,
}: {
  draft: GridGuardSettings;
  update: <K extends keyof GridGuardSettings>(k: K, v: GridGuardSettings[K]) => void;
}) {
  return (
    <div>
      <SectionHeader
        title="Notification Settings"
        description="Control which alert types are enabled. These are local UI preferences — no push notifications are sent in demo mode."
      />

      <div className="space-y-0">
        {NOTIF_ROWS.map((row) => (
          <SettingsRow
            key={row.key}
            label={row.label}
            description={row.description}
            htmlFor={`toggle-${row.key}`}
          >
            <Toggle
              id={`toggle-${row.key}`}
              label={row.label}
              checked={draft[row.key] as boolean}
              onChange={(v) => update(row.key, v)}
            />
          </SettingsRow>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SystemSection() {
  const refreshTime = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

  const rows = [
    { label: 'Application',         value: 'GridGuard AI' },
    { label: 'Version',             value: 'v1.0' },
    { label: 'Environment',         value: 'Hackathon Demo' },
    { label: 'Frontend',            value: 'React + TypeScript + Vite' },
    { label: 'Styling',             value: 'Tailwind CSS' },
    { label: 'State Management',    value: 'Zustand' },
    { label: 'Data Source',         value: 'Local Mock Data' },
    { label: 'Backend Connection',  value: 'Not Connected' },
    { label: 'System Status',       value: 'Demo Mode' },
    { label: 'Last Local Refresh',  value: refreshTime },
  ];

  return (
    <div>
      <SectionHeader
        title="System Information"
        description="Read-only information about this GridGuard installation."
      />

      <div className="bg-navy-850 border border-surface-border rounded p-0 overflow-hidden">
        {rows.map((r) => (
          <InfoRow key={r.label} label={r.label} value={r.value} />
        ))}
      </div>

      {/* Status indicator */}
      <div className="mt-4 flex items-start gap-2.5 p-3 bg-amber-500/8 border border-amber-500/25 rounded text-xs">
        <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-300 mb-0.5">Demo Mode Active</p>
          <p className="text-amber-400/70 leading-relaxed">
            GridGuard is running with local mock data. No live grid connection is active.
            Backend integration will be available in the production deployment.
          </p>
        </div>
      </div>

      {/* localStorage diagnostics */}
      <div className="mt-4">
        <p className="label-muted mb-2">Storage</p>
        <div className="bg-navy-850 border border-surface-border rounded p-0 overflow-hidden">
          <InfoRow
            label="Settings key"
            value="gridguard-settings"
          />
          <InfoRow
            label="Theme key"
            value="gridguard-theme"
          />
          <InfoRow
            label="Storage type"
            value="localStorage (browser)"
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SettingsPage
// ─────────────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { draft, isDirty, updateDraft, saveChanges, resetToDefaults } = useSettingsStore();

  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [showReset, setShowReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dismissToast = useCallback(() => setToast(null), []);

  function handleSave() {
    saveChanges();
    setToast('Settings saved successfully.');
  }

  function handleResetConfirm() {
    resetToDefaults();
    setShowReset(false);
    setToast('Settings restored to defaults.');
  }

  const activeNavItem = NAV_ITEMS.find((n) => n.id === activeSection);

  return (
    <div className="p-5 max-w-[1200px]">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <nav className="text-[11px] text-slate-500 mb-1" aria-label="Breadcrumb">
          <span>System</span>
          <span className="mx-1">/</span>
          <span className="text-slate-300">Settings</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <SettingsIcon size={15} className="text-brand-400" />
              <h1 className="page-title">Settings</h1>
            </div>
            <p className="page-subtitle">
              Configure GridGuard application preferences, appearance and accessibility.
            </p>
          </div>
          {isDirty && (
            <span className="shrink-0 text-[11px] font-semibold text-amber-400 border border-amber-500/30
                             bg-amber-500/10 px-2.5 py-1 rounded flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* ── Mobile category selector ─────────────────────────────────────── */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="btn-ghost w-full justify-between text-xs"
          aria-expanded={mobileMenuOpen}
          aria-label="Settings category menu"
        >
          <span className="flex items-center gap-2">
            {activeNavItem?.icon}
            {activeNavItem?.label}
          </span>
          <ChevronDown
            size={13}
            className={`transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {mobileMenuOpen && (
          <div className="mt-1 border border-surface-border rounded bg-navy-800 overflow-hidden">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors
                  ${activeSection === item.id
                    ? 'bg-brand-600/15 text-brand-400 font-semibold'
                    : 'text-slate-400 hover:bg-navy-750 hover:text-slate-200'
                  }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* ── LEFT: settings navigation (desktop only) ── */}
        <aside
          className="hidden md:flex flex-col w-52 shrink-0 sticky top-[80px]"
          aria-label="Settings navigation"
        >
          <nav className="card overflow-hidden">
            {NAV_ITEMS.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`
                  w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors
                  border-b border-surface-border/50 last:border-b-0
                  ${idx === 0 ? '' : ''}
                  ${activeSection === item.id
                    ? 'bg-brand-600/12 text-brand-400 border-l-2 border-l-brand-500 pl-[10px]'
                    : 'text-slate-400 hover:bg-navy-750 hover:text-slate-200'
                  }
                `}
                aria-current={activeSection === item.id ? 'page' : undefined}
              >
                <span className="mt-0.5 shrink-0">{item.icon}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{item.label}</span>
                  <span className="block text-[10px] text-slate-500 leading-tight mt-0.5">
                    {item.description}
                  </span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* ── RIGHT: settings content ── */}
        <div className="flex-1 min-w-0">
          <div className="card p-5">
            {activeSection === 'general' && (
              <GeneralSection draft={draft} update={updateDraft} />
            )}
            {activeSection === 'appearance' && (
              <AppearanceSection draft={draft} update={updateDraft} />
            )}
            {activeSection === 'accessibility' && (
              <AccessibilitySection draft={draft} update={updateDraft} />
            )}
            {activeSection === 'notifications' && (
              <NotificationsSection draft={draft} update={updateDraft} />
            )}
            {activeSection === 'system' && (
              <SystemSection />
            )}
          </div>

          {/* ── Action bar ── */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3
                          p-4 card">
            <div className="flex flex-wrap items-center gap-2">
              {/* Save */}
              <button
                onClick={handleSave}
                disabled={!isDirty}
                className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded border
                            transition-colors
                            ${isDirty
                              ? 'bg-brand-600 text-white border-brand-500 hover:bg-brand-700'
                              : 'bg-navy-700 text-slate-500 border-surface-border cursor-not-allowed opacity-60'
                            }`}
                aria-disabled={!isDirty}
              >
                <Save size={13} />
                Save Changes
              </button>

              {/* Reset */}
              <button
                onClick={() => setShowReset(true)}
                className="flex items-center gap-2 btn-ghost text-xs"
              >
                <RotateCcw size={12} />
                Reset to Defaults
              </button>
            </div>

            {isDirty && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                You have unsaved changes
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Reset confirmation dialog ── */}
      {showReset && (
        <ResetDialog
          onConfirm={handleResetConfirm}
          onCancel={() => setShowReset(false)}
        />
      )}

      {/* ── Toast notification ── */}
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
