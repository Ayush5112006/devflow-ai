import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface DemoBug {
  id: string;
  title: string;
  oneLine: string;
  severity: string;
  report: { title: string; description: string; severity: string };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [bugs, setBugs] = useState<DemoBug[]>([]);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.demoBugs().catch(() => []),
      api.investigations().catch(() => []),
    ]).then(([b, inv]) => {
      setBugs(b);
      setInvestigations(inv);
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  const launchInvestigation = async (bugId: string) => {
    setLaunching(bugId);
    try {
      const inv = await api.quickstartInvestigation(bugId);
      navigate(`/investigation/${inv.id}`);
    } catch (err: any) {
      setError(err.message);
      setLaunching(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* ─── Hero ─── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          <span className="gradient-text">Bug Resolution</span> Dashboard
        </h1>
        <p style={{ color: 'var(--ff-text-muted)', maxWidth: 600 }}>
          Select a bug report below to launch an automated investigation. FixFlow's agent swarm will
          analyse the code, find the root cause, and generate a verified fix.
        </p>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1.5rem', borderRadius: 8,
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5', fontSize: '0.85rem',
        }}>
          ⚠ {error}
          <button onClick={() => setError(null)} style={{
            marginLeft: '1rem', background: 'none', border: 'none', color: '#fca5a5',
            cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem',
          }}>Dismiss</button>
        </div>
      )}

      {/* ─── Stats Row ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Demo Bugs', value: bugs.length, icon: '🐛', color: 'var(--ff-warning)' },
          { label: 'Investigations', value: investigations.length, icon: '🔬', color: 'var(--ff-accent)' },
          { label: 'Completed', value: investigations.filter(i => i.status === 'completed').length, icon: '✅', color: 'var(--ff-success)' },
          { label: 'Active', value: investigations.filter(i => !['completed', 'failed'].includes(i.status)).length, icon: '⚡', color: 'var(--ff-info)' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: `${stat.color}15`, border: `1px solid ${stat.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem',
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ff-text-muted)', fontWeight: 500 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Demo Bugs ─── */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.1rem' }}>🐛</span> Demo Bug Reports
      </h2>

      <div style={{ display: 'grid', gap: '1rem', marginBottom: '2.5rem' }}>
        {bugs.map((bug) => (
          <div key={bug.id} className="card" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                <span className="mono" style={{
                  fontSize: '0.7rem', color: 'var(--ff-text-dim)',
                  background: 'var(--ff-bg)', padding: '0.15rem 0.5rem', borderRadius: 4,
                }}>{bug.id.toUpperCase()}</span>
                <span className={`badge badge-${bug.severity}`}>{bug.severity}</span>
              </div>
              <h3 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.3rem' }}>{bug.title}</h3>
              <p style={{ color: 'var(--ff-text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>{bug.oneLine}</p>
            </div>
            <button
              className="btn btn-primary"
              disabled={launching === bug.id}
              onClick={() => launchInvestigation(bug.id)}
              style={{ marginLeft: '1rem', whiteSpace: 'nowrap' }}
            >
              {launching === bug.id ? (
                <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div> Launching...</>
              ) : (
                <>🚀 Investigate</>
              )}
            </button>
          </div>
        ))}

        {bugs.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--ff-text-dim)' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📦</p>
            <p>No demo bugs available. The demo project evidence files may need to be generated.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
              Run <code style={{ background: 'var(--ff-bg)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>npm run seed:demo</code> to set up demo data.
            </p>
          </div>
        )}
      </div>

      {/* ─── Past Investigations ─── */}
      {investigations.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🔬</span> Past Investigations
          </h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {investigations.map((inv) => (
              <div
                key={inv.id}
                className="card"
                onClick={() => navigate(`/investigation/${inv.id}`)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span className={`status-dot ${inv.status}`}></span>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--ff-text-dim)' }}>{inv.id}</span>
                  </div>
                  <h3 style={{ fontWeight: 600, fontSize: '0.9rem' }}>{inv.bug?.title ?? 'Unknown'}</h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge badge-${inv.bug?.severity ?? 'info'}`}>{inv.status}</span>
                  <div style={{ fontSize: '0.7rem', color: 'var(--ff-text-dim)', marginTop: '0.3rem' }}>
                    {new Date(inv.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
