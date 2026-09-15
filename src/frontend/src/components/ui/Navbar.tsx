import { Bell, RefreshCw, Menu, User, Search, Palette, Check } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { useAppStore, useGridSummary } from '../../store/useAppStore';
import { THEMES, type ThemeId } from '../../theme/themeUtils';

export function Navbar() {
  const loadData      = useAppStore((s) => s.loadData);
  const isLoading     = useAppStore((s) => s.isLoading);
  const toggleMobile  = useAppStore((s) => s.toggleMobileSidebar);
  const theme         = useAppStore((s) => s.theme);
  const setTheme      = useAppStore((s) => s.setTheme);
  const summary       = useGridSummary();

  const [themeOpen, setThemeOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!themeOpen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setThemeOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [themeOpen]);

  const lastUpdated = summary
    ? new Date(summary.last_updated).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  // Split themes into two groups for the dropdown menu
  const appearanceThemes = THEMES.filter((t) => t.id === 'dark' || t.id === 'light');
  const accessibilityThemes = THEMES.filter((t) => t.id === 'hc-dark' || t.id === 'hc-light');

  function handleThemeSelect(id: ThemeId) {
    setTheme(id);
    setThemeOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-navy-900 border-b border-surface-border
                       flex items-center gap-4 px-4 md:px-6">
      {/* Hidden aria-live region announces theme changes to screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="theme-announcement"
      >
        {`Theme changed to ${THEMES.find((t) => t.id === theme)?.label ?? theme}`}
      </div>
      {/* Mobile hamburger */}
      <button
        className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white
                   hover:bg-white/10 transition-colors"
        onClick={toggleMobile}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Logo (mobile only) */}
      <span className="md:hidden text-sm font-bold text-white">GridGuard AI</span>

      {/* Search (desktop) */}
      <div className="hidden md:flex flex-1 max-w-xs relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="search"
          placeholder="Search assets…"
          className="input-dark w-full pl-9 py-1.5 text-xs"
          aria-label="Search"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Last updated */}
        <span className="hidden sm:block text-xs text-slate-500 pr-2 border-r border-surface-border">
          Updated {lastUpdated}
        </span>

        {/* Outage risk pill */}
        {summary && summary.outage_risk_24h >= 0.2 && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium
                          bg-amber-500/10 text-amber-400 border border-amber-500/25
                          rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {Math.round(summary.outage_risk_24h * 100)}% outage risk 24h
          </div>
        )}

        {/* Refresh */}
        <button
          onClick={loadData}
          disabled={isLoading}
          className="btn-ghost p-2"
          aria-label="Refresh data"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
        </button>

        {/* Alerts */}
        <button className="btn-ghost relative p-2" aria-label="Notifications">
          <Bell size={15} />
          {summary && summary.critical_risk_count > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
          )}
        </button>

        {/* ── Theme switcher ─────────────────────────────────────────────── */}
        <div ref={dropdownRef} className="relative">
          <button
            className="btn-ghost p-2"
            onClick={() => setThemeOpen((o) => !o)}
            aria-label="Change theme"
            aria-haspopup="true"
            aria-expanded={themeOpen}
          >
            <Palette size={15} />
          </button>

          {themeOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-56
                         bg-navy-850 border border-surface-border rounded-xl shadow-2xl
                         py-2 z-50 text-sm"
            >
              {/* Appearance group */}
              <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Appearance
              </p>
              {appearanceThemes.map((t) => (
                <ThemeOption
                  key={t.id}
                  id={t.id}
                  label={t.label}
                  description={t.description}
                  icon={t.icon}
                  active={theme === t.id}
                  onSelect={handleThemeSelect}
                />
              ))}

              {/* Accessibility group */}
              <div className="my-1.5 border-t border-surface-border" />
              <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Accessibility
              </p>
              {accessibilityThemes.map((t) => (
                <ThemeOption
                  key={t.id}
                  id={t.id}
                  label={t.label}
                  description={t.description}
                  icon={t.icon}
                  active={theme === t.id}
                  onSelect={handleThemeSelect}
                />
              ))}
            </div>
          )}
        </div>

        {/* User avatar */}
        <button
          className="flex items-center justify-center w-8 h-8 rounded-full
                     bg-brand-600/30 border border-brand-500/30 text-brand-400
                     hover:bg-brand-600/50 transition-colors"
          aria-label="User profile"
        >
          <User size={14} />
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ThemeOption — single row inside the dropdown
// ─────────────────────────────────────────────────────────────────────────────

interface ThemeOptionProps {
  id: ThemeId;
  label: string;
  description: string;
  icon: string;
  active: boolean;
  onSelect: (id: ThemeId) => void;
}

function ThemeOption({ id, label, description, icon, active, onSelect }: ThemeOptionProps) {
  return (
    <button
      role="menuitem"
      onClick={() => onSelect(id)}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                  hover:bg-white/5 focus-visible:bg-white/5 outline-none
                  ${active ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
    >
      {/* Icon */}
      <span className="w-6 text-center text-base leading-none select-none" aria-hidden="true">
        {icon}
      </span>

      {/* Labels */}
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-medium leading-none mb-0.5">{label}</span>
        <span className="block text-[10px] text-slate-500 leading-none truncate">{description}</span>
      </span>

      {/* Active check */}
      {active && <Check size={13} className="shrink-0 text-brand-400" />}
    </button>
  );
}
