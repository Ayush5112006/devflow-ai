import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage.js';
import { NewInvestigationPage } from './pages/NewInvestigationPage.js';
import { InvestigationPage } from './pages/InvestigationPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { CodeIntelligencePage } from './pages/CodeIntelligencePage.js';
import { DebuggingPage } from './pages/DebuggingPage.js';
import { CodeReviewPage } from './pages/CodeReviewPage.js';
import { SecurityPage } from './pages/SecurityPage.js';
import { TestCenterPage } from './pages/TestCenterPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { MetricsPage } from './pages/MetricsPage.js';
import { InvestigationsListPage } from './pages/InvestigationsListPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ToastProvider } from './components/ToastProvider.js';
import { CommandPalette } from './components/CommandPalette.js';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: '◈', label: 'Dashboard', exact: true },
      { to: '/projects', icon: '◫', label: 'Projects' },
      { to: '/metrics', icon: '◉', label: 'Metrics' },
    ],
  },
  {
    label: 'Investigations',
    items: [
      { to: '/investigations', icon: '◎', label: 'Investigations' },
      { to: '/new', icon: '+', label: 'New Investigation' },
      { to: '/debugging', icon: '◐', label: 'Debugging' },
    ],
  },
  {
    label: 'Code Intelligence',
    items: [
      { to: '/code-intelligence', icon: '⌥', label: 'Code Explorer' },
      { to: '/code-review', icon: '◑', label: 'Code Review' },
      { to: '/security', icon: '◻', label: 'Security' },
    ],
  },
  {
    label: 'Quality',
    items: [
      { to: '/test-center', icon: '◈', label: 'Test Center' },
      { to: '/reports', icon: '◧', label: 'Reports' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', icon: '◬', label: 'Settings' },
    ],
  },
];

function SideNavLink({ to, icon, label, exact }: { to: string; icon: string; label: string; exact?: boolean }) {
  const location = useLocation();
  const active = exact ? location.pathname === to : (location.pathname === to || (to !== '/' && location.pathname.startsWith(to)));
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`sidenav-link ${active ? 'active' : ''}`}
    >
      <span className="sidenav-icon">{icon}</span>
      <span className="sidenav-label">{label}</span>
    </Link>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <Link to="/" className="brand" onClick={onClose}>
            <div className="brand-mark">F</div>
            <span className="brand-name"><strong>Fix</strong>Flow AI</span>
          </Link>
          <span className="brand-sub">Engineering Control Center</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="sidenav-section">
              <p className="sidenav-section-label">{section.label}</p>
              {section.items.map((item) => (
                <SideNavLink key={item.to} {...item} />
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidenav-version">FixFlow AI v2.0</span>
        </div>
      </aside>
    </>
  );
}

function TopBar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const location = useLocation();
  const title = getPageTitle(location.pathname);
  return (
    <header className="topbar" role="banner">
      <button className="topbar-menu-btn" onClick={onMenuToggle} aria-label="Toggle menu">☰</button>
      <span className="topbar-title">{title}</span>
      <div className="topbar-actions">
        <Link to="/new" className="btn btn-primary btn-sm">+ New Investigation</Link>
      </div>
    </header>
  );
}

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/investigations/')) return 'Investigation';
  if (pathname === '/investigations') return 'Investigations';
  if (pathname === '/new') return 'New Investigation';
  if (pathname === '/projects') return 'Projects';
  if (pathname === '/code-intelligence') return 'Code Intelligence';
  if (pathname === '/debugging') return 'Debugging';
  if (pathname === '/code-review') return 'Code Review';
  if (pathname === '/security') return 'Security';
  if (pathname === '/test-center') return 'Test Center';
  if (pathname === '/reports') return 'Reports';
  if (pathname === '/metrics') return 'Metrics';
  if (pathname === '/settings') return 'Settings';
  return 'FixFlow AI';
}

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app-shell-v2">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-content">
        <TopBar onMenuToggle={() => setSidebarOpen((o) => !o)} />
        <main className="app-main-v2" id="main">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/new" element={<NewInvestigationPage />} />
              <Route path="/investigations" element={<InvestigationsListPage />} />
              <Route path="/investigations/:id" element={<InvestigationPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/code-intelligence" element={<CodeIntelligencePage />} />
              <Route path="/debugging" element={<DebuggingPage />} />
              <Route path="/code-review" element={<CodeReviewPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/test-center" element={<TestCenterPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <p className="empty-title">Page not found</p>
                    <Link to="/" className="btn btn-primary btn-sm">Back to dashboard</Link>
                  </div>
                }
              />
            </Routes>
          </Layout>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
