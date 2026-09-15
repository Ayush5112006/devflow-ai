import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  TableProperties,
  Wrench,
  CalendarDays,
  CloudLightning,
  Settings,
  Zap,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useAppStore, useGridSummary } from '../../store/useAppStore';

// ─────────────────────────────────────────────────────────────────────────────

const navItems = [
  { to: '/',            label: 'Dashboard',          icon: LayoutDashboard, end: true },
  { to: '/map',         label: 'Grid Map',            icon: Map,             end: false },
  { to: '/assets',      label: 'Asset Rankings',      icon: TableProperties, end: false },
  { to: '/maintenance', label: 'Maintenance',          icon: Wrench,          end: false },
  { to: '/calendar',    label: 'Calendar',             icon: CalendarDays,    end: false },
  { to: '/weather',     label: 'Weather Intelligence', icon: CloudLightning,  end: false },
];

interface SidebarInnerProps {
  onNavClick?: () => void;
}

function SidebarInner({ onNavClick }: SidebarInnerProps) {
  const summary = useGridSummary();

  return (
    <div className="flex flex-col h-full bg-navy-900 border-r border-surface-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-surface-border min-h-[64px]">
        <div className="p-1.5 rounded-lg bg-brand-600/20">
          <Zap size={18} className="text-brand-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">GridGuard AI</p>
          <p className="text-[10px] text-slate-500 leading-tight">Power Grid Intelligence</p>
        </div>
      </div>

      {/* Critical alert banner */}
      {summary && summary.critical_risk_count > 0 && (
        <div className="mx-3 mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg
                        bg-red-500/10 border border-red-500/25">
          <AlertTriangle size={13} className="text-red-400 shrink-0" />
          <p className="text-xs text-red-300">
            <strong>{summary.critical_risk_count}</strong> critical asset
            {summary.critical_risk_count > 1 ? 's' : ''} detected
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        <p className="label-muted px-3 pb-2" aria-hidden="true">Navigation</p>
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`
            }
          >
            <Icon size={16} className="shrink-0" />
            {label}
          </NavLink>
        ))}

        <div className="pt-4">
          <p className="label-muted px-3 pb-2">System</p>
          <NavLink
            to="/settings"
            end={false}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`
            }
          >
            <Settings size={16} className="shrink-0" />
            Settings
          </NavLink>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-surface-border">
        <p className="text-[10px] text-slate-600 text-center">GridGuard AI v1.0 · IBM Hackathon 2026</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop sidebar
// ─────────────────────────────────────────────────────────────────────────────

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 h-screen sticky top-0 flex-col">
      <SidebarInner />
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile drawer
// ─────────────────────────────────────────────────────────────────────────────

export function MobileSidebar() {
  const isOpen = useAppStore((s) => s.mobileSidebarOpen);
  const close = useAppStore((s) => s.setMobileSidebarOpen);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => close(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 md:hidden
          transform transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={() => close(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10
                       transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <SidebarInner onNavClick={() => close(false)} />
      </aside>
    </>
  );
}
