import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Badge, severityBadge } from '../components/Badge.js';
import { Card } from '../components/Card.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

export function ReportsPage() {
  const [investigations, setInvestigations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.listInvestigations()
      .then(({ investigations }) => { setInvestigations(investigations); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const completed = investigations.filter(i => i.status === 'completed');

  if (loading) return <LoadingSpinner message="Loading reports…" />;

  return (
    <div className="page-content stack" style={{ gap: 24 }}>
      <div className="spread">
        <div>
          <h1 className="page-title">Engineering Reports</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
            Final investigation reports with root cause, fix, verification, and PR summaries.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="metric-grid">
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--ink)' }}>{investigations.length}</p>
          <p className="metric-label">Total investigations</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--accent)' }}>{completed.length}</p>
          <p className="metric-label">Completed with reports</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--warn)' }}>
            {investigations.filter(i => i.status === 'investigating' || i.status === 'awaiting_approval').length}
          </p>
          <p className="metric-label">In progress</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--danger)' }}>
            {investigations.filter(i => i.status === 'failed').length}
          </p>
          <p className="metric-label">Failed</p>
        </div>
      </div>

      {completed.length > 0 ? (
        <section className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-head">
            <h2 className="panel-title">Completed investigations</h2>
            <span className="chip mono">{completed.length} reports</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Bug</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Created</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody>
              {completed.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{inv.id?.slice(0, 10)}</td>
                  <td style={{ color: 'var(--ink)', fontSize: 13 }}>{inv.bug?.title}</td>
                  <td>{severityBadge(inv.bug?.severity)}</td>
                  <td>
                    <Badge variant="success" dot>Completed</Badge>
                  </td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <Link to={`/investigations/${inv.id}`} className="btn btn-sm">View report →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <Card title="No reports yet">
          <div className="empty">
            <p className="empty-title">No completed investigations</p>
            <p className="empty-text">Complete an investigation to generate a full engineering report with root cause analysis, change summary, and PR description.</p>
            <Link to="/new" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Start an investigation</Link>
          </div>
        </Card>
      )}

      {investigations.length > 0 && (
        <Card title="All investigations">
          <div className="stack-sm">
            {investigations.map((inv: any) => (
              <Link
                key={inv.id}
                to={`/investigations/${inv.id}`}
                className="spread"
                style={{ padding: '11px 14px', textDecoration: 'none', borderRadius: 10, background: 'var(--panel-sunken)', border: '1px solid var(--line)' }}
              >
                <div className="row" style={{ gap: 10 }}>
                  <span className="chip mono" style={{ fontSize: 10 }}>{inv.id?.slice(0, 8)}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>{inv.bug?.title}</span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {severityBadge(inv.bug?.severity)}
                  <Badge
                    variant={inv.status === 'completed' ? 'success' : inv.status === 'failed' ? 'danger' : 'info'}
                    dot
                  >
                    {(inv.status ?? '').replace(/_/g, ' ')}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
