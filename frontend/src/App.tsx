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
import { IssuesPage } from './pages/IssuesPage.js';
import { GitCenterPage } from './pages/GitCenterPage.js';
import { PullRequestsPage } from './pages/PullRequestsPage.js';
import { ReleasesPage } from './pages/ReleasesPage.js';
import { IncidentsPage } from './pages/IncidentsPage.js';
import { KnowledgePage } from './pages/KnowledgePage.js';
import { AnalyticsPage } from './pages/AnalyticsPage.js';
import { JudgeModePage } from './pages/JudgeModePage.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ToastProvider } from './components/ToastProvider.js';
import { CommandPalette } from './components/CommandPalette.js';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: '⊞', label: 'Dashboard', exact: true },
      { to: '/projects', icon: '◫', label: 'Projects' },
      { to: '/analytics', icon: '◉', label: 'Analytics' },
    ],
  },
  {
    label: 'Engineering',
    items: [
      { to: '/issues', icon: '◎', label: 'Issues' },
      { to: '/investigations', icon: '◐', label: 'Investigations' },
      { to: '/incidents', icon: '⚡', label: 'Incidents' },
      { to: '/debugging', icon: '⊘', label: 'Debugging' },
    ],
  },
  {
    label: 'Code',
    items: [
      { to: '/code-intelligence', icon: '⌥', label: 'Code Intelligence' },
      { to: '/code-review', icon: '◑', label: 'Code Review' },
      { to: '/security', icon: '◻', label: 'Security' },
      { to: '/test-center', icon: '✓', label: 'Tests' },
    ],
  },
  {
    label: 'Release',
    items: [
      { to: '/git', icon: '⑂', label: 'Git' },
      { to: '/pull-requests', icon: '⊕', label: 'Pull Requests' },
      { to: '/releases', icon: '◈', label: 'Releases' },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { to: '/knowledge', icon: '◧', label: 'Knowledge Base' },
      { to: '/reports', icon: '▤', label: 'Reports' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/judge', icon: '◬', label: 'Judge Mode' },
      { to: '/metrics', icon: '▦', label: 'Metrics' },
      { to: '/settings', icon: '⚙', label: 'Settings' },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Engineering Command Center',
  '/projects': 'Projects',
  '/analytics': 'Analytics',
  '/issues': 'Issues',
  '/investigations': 'Investigations',
  '/new': 'New Investigation',
  '/incidents': 'Incidents',
  '/debugging': 'Debugging',
  '/code-intelligence': 'Code Intelligence',
  '/code-review': 'Code Review',
  '/security': 'Security',
  '/test-center': 'Test Center',
  '/git': 'Git Center',
  '/pull-requests': 'Pull Requests',
  '/releases': 'Releases',
  '/knowledge': 'Knowledge Base',
  '/reports': 'Reports',
  '/metrics': 'Metrics',
  '/judge': 'Judge Mode',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/investigations/')) return 'Investigation Detail';
  return PAGE_TITLES[pathname] ?? 'FixFlow AI';
}

function SideNavLink({ to, icon, label, exact }: { to: string; icon: string; label: string; exact?: boolean }) {
  const location = useLocation();
  const active = exact
    ? location.pathname === to
    : location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
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
      {open && <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <Link to="/" className="brand" onClick={onClose}>
            <div className="brand-mark">F</div>
            <span className="brand-name"><strong>Fix</strong>Flow AI</span>
          </Link>
          <span className="brand-sub">AI Software Engineering OS</span>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
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
          <div className="sidebar-status">
            <span className="sidebar-status-dot" />
            <span>Backend connected</span>
          </div>
          <span className="sidenav-version">FixFlow AI v2.0</span>
        </div>
      </aside>
    </>
  );
}

function TopBar({ onMenuToggle, onPaletteOpen }: { onMenuToggle: () => void; onPaletteOpen: () => void }) {
  const location = useLocation();
  const title = getPageTitle(location.pathname);
  return (
    <header className="topbar" role="banner">
      <button className="topbar-menu-btn" onClick={onMenuToggle} aria-label="Toggle navigation menu">☰</button>
      <span className="topbar-title">{title}</span>
      <div className="topbar-actions">
        <button
          className="btn btn-sm topbar-search-btn"
          onClick={onPaletteOpen}
          aria-label="Open command palette (Ctrl+K)"
          title="Ctrl+K"
        >
          <span>⌘</span>
          <span className="topbar-search-hint">Ctrl+K</span>
        </button>
        <Link to="/new" className="btn btn-primary btn-sm">+ New Investigation</Link>
      </div>
    </header>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app-shell-v2">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-content">
        <TopBar
          onMenuToggle={() => setSidebarOpen((o) => !o)}
          onPaletteOpen={() => setPaletteOpen(true)}
        />
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
              <Route path="/issues" element={<IssuesPage />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/debugging" element={<DebuggingPage />} />
              <Route path="/code-intelligence" element={<CodeIntelligencePage />} />
              <Route path="/code-review" element={<CodeReviewPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/test-center" element={<TestCenterPage />} />
              <Route path="/git" element={<GitCenterPage />} />
              <Route path="/pull-requests" element={<PullRequestsPage />} />
              <Route path="/releases" element={<ReleasesPage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/judge" element={<JudgeModePage />} />
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
