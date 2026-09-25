import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage.js';
import { NewInvestigationPage } from './pages/NewInvestigationPage.js';
import { InvestigationPage } from './pages/InvestigationPage.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ToastProvider } from './components/ToastProvider.js';
import { CommandPalette } from './components/CommandPalette.js';

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`nav-link ${active ? 'active' : ''}`}
    >
      {children}
    </Link>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global Ctrl+K / Cmd+K handler
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <Link to="/" className="brand">
            <div className="brand-mark">F</div>
            <span className="brand-name"><strong>Fix</strong>Flow AI</span>
          </Link>
          <nav className="app-nav">
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/new">New Investigation</NavLink>
          </nav>
          <button
            className="palette-trigger"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette (Ctrl+K)"
            title="Command palette (Ctrl+K)"
          >
            <span aria-hidden="true">⌘</span>
            <span>Ctrl K</span>
          </button>
        </div>
      </header>
      <main className="app-main" id="main">
        {children}
      </main>
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
              <Route path="/investigations/:id" element={<InvestigationPage />} />
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
