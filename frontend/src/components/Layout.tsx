import { Outlet, Link, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ─── Top Nav ─── */}
      <header className="glass" style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid var(--ff-border)',
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', fontWeight: 800, color: 'white',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
          }}>
            FF
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ff-text)' }}>FixFlow</span>
            <span style={{ fontWeight: 300, fontSize: '1.1rem', color: 'var(--ff-text-muted)', marginLeft: 4 }}>AI</span>
          </div>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link
            to="/"
            style={{
              textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500,
              color: location.pathname === '/' ? 'var(--ff-accent)' : 'var(--ff-text-muted)',
              transition: 'color 0.2s',
            }}
          >
            Dashboard
          </Link>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.7rem', borderRadius: 8,
            background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.2)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ff-success)' }}></span>
            <span style={{ fontSize: '0.75rem', color: '#86efac', fontWeight: 500 }}>System Online</span>
          </div>
        </nav>
      </header>

      {/* ─── Main Content ─── */}
      <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>

      {/* ─── Footer ─── */}
      <footer style={{
        padding: '1rem 1.5rem',
        borderTop: '1px solid var(--ff-border)',
        textAlign: 'center',
        color: 'var(--ff-text-dim)',
        fontSize: '0.75rem',
      }}>
        FixFlow AI v0.1.0 — Agentic Bug Resolution Engine
      </footer>
    </div>
  );
}
