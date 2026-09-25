import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage.js';
import { NewInvestigationPage } from './pages/NewInvestigationPage.js';
import { InvestigationPage } from './pages/InvestigationPage.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

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
        </div>
      </header>
      <main className="app-main" id="main">
        {children}
      </main>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
