import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { Badge, severityBadge, statusBadge } from '../components/Badge.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

export function InvestigationsListPage() {
  const [investigations, setInvestigations] = React.useState<any[]>([]);
  const [demoBugs, setDemoBugs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [launching, setLaunching] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    Promise.all([api.listInvestigations(), api.demoBugs()])
      .then(([{ investigations }, { bugs }]) => {
        setInvestigations(investigations);
        setDemoBugs(bugs);
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  async function launchDemo(bugId: string) {
    setLaunching(bugId);
    try {
      const { investigation } = await api.demoQuickstart(bugId);
      navigate(`/investigations/${investigation.id}`);
    } catch (e) {
      setError(String(e));
      setLaunching(null);
    }
  }

  if (loading) return <LoadingSpinner message="Loading investigations…" />;

  return (
    <div className="page-content stack" style={{ gap: 24 }}>
      <div className="spread">
        <div>
          <h1 className="page-title">Investigations</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
            {investigations.length} investigation{investigations.length !== 1 ? 's' : ''} in this session
          </p>
        </div>
        <Link to="/new" className="btn btn-primary">+ New investigation</Link>
      </div>

      {error && <div className="alert" role="alert">{error}</div>}

      {investigations.length > 0 ? (
        <section className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-head">
            <h2 className="panel-title">All Investigations</h2>
            <span className="chip mono">{investigations.length}</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Project</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {investigations.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{inv.id?.slice(0, 10)}</td>
                  <td style={{ color: 'var(--ink)', fontSize: 13 }}>{inv.bug?.title}</td>
                  <td style={{ fontSize: 12 }}>{inv.projectName ?? inv.projectId}</td>
                  <td>{severityBadge(inv.bug?.severity)}</td>
                  <td>{statusBadge(inv.status)}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--subtle)' }}>
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleString() : '—'}
                  </td>
                  <td>
                    <Link to={`/investigations/${inv.id}`} className="btn btn-sm">Open →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <div className="panel">
          <div className="empty">
            <p className="empty-title">No investigations yet</p>
            <p className="empty-text">Start with a curated demo scenario or report a new bug.</p>
            <Link to="/new" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Create investigation</Link>
          </div>
        </div>
      )}

      {/* Demo scenarios */}
      {demoBugs.length > 0 && (
        <section>
          <div className="section-heading">
            <h2>Demo scenarios</h2>
            <p>Curated bugs with pre-loaded evidence</p>
          </div>
          <div className="scenario-grid">
            {demoBugs.map((bug) => (
              <div key={bug.id} className="scenario-card">
                <div className="scenario-meta">
                  <span>{bug.id}</span>
                  <Badge variant={bug.severity === 'critical' ? 'danger' : bug.severity === 'high' ? 'danger' : 'warn'} dot>
                    {bug.severity}
                  </Badge>
                </div>
                <p className="scenario-title">{bug.title}</p>
                <p className="scenario-description">{bug.oneLine}</p>
                <button
                  onClick={() => launchDemo(bug.id)}
                  disabled={launching !== null}
                  className="scenario-button"
                >
                  {launching === bug.id ? 'Launching…' : 'Investigate with FixFlow'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
