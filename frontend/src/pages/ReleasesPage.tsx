import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

interface Release {
  version: string;
  branch: string;
  status: 'ready' | 'blocked' | 'deployed' | 'staging';
  date: string;
  commits: number;
  prs: number;
  checks: { label: string; status: 'pass' | 'fail' | 'warn' | 'skip'; detail: string }[];
}

const DEMO_RELEASES: Release[] = [
  {
    version: 'v1.3.0',
    branch: 'main',
    status: 'ready',
    date: '2026-02-24',
    commits: 3,
    prs: 3,
    checks: [
      { label: 'Tests', status: 'pass', detail: '47/47 passing' },
      { label: 'Build', status: 'pass', detail: 'Clean in 0.8s' },
      { label: 'Security', status: 'pass', detail: 'No critical CVEs' },
      { label: 'Lint', status: 'warn', detail: '3 warnings' },
      { label: 'Dependencies', status: 'warn', detail: '2 outdated packages' },
      { label: 'Coverage', status: 'pass', detail: '74% overall' },
      { label: 'Rollback', status: 'pass', detail: 'v1.2.0 available' },
      { label: 'Database', status: 'pass', detail: 'No migrations' },
    ],
  },
  {
    version: 'v1.2.0',
    branch: 'main',
    status: 'deployed',
    date: '2026-02-20',
    commits: 8,
    prs: 5,
    checks: [
      { label: 'Tests', status: 'pass', detail: '45/45 passing' },
      { label: 'Build', status: 'pass', detail: 'Clean' },
      { label: 'Security', status: 'pass', detail: 'No issues' },
      { label: 'Lint', status: 'pass', detail: 'Clean' },
      { label: 'Dependencies', status: 'pass', detail: 'All current' },
      { label: 'Coverage', status: 'pass', detail: '71% overall' },
      { label: 'Rollback', status: 'pass', detail: 'v1.1.0 available' },
      { label: 'Database', status: 'pass', detail: 'No migrations' },
    ],
  },
];

const FEATURE_FLAGS = [
  { name: 'prediction-detail-v2', env: 'production', status: 'enabled', rollout: '100%', owner: 'Frontend', created: '2026-02-24' },
  { name: 'orders-pagination', env: 'production', status: 'disabled', rollout: '0%', owner: 'Backend', created: '2026-02-22' },
  { name: 'ml-sentiment-v3', env: 'staging', status: 'percentage', rollout: '25%', owner: 'ML Team', created: '2026-02-20' },
  { name: 'new-dashboard-layout', env: 'staging', status: 'percentage', rollout: '50%', owner: 'Frontend', created: '2026-02-18' },
];

export function ReleasesPage() {
  const [tab, setTab] = useState<'releases' | 'readiness' | 'flags' | 'rollback'>('releases');
  const [selectedRelease, setSelectedRelease] = useState<Release>(DEMO_RELEASES[0]);

  const passing = selectedRelease.checks.filter((c) => c.status === 'pass').length;
  const failing = selectedRelease.checks.filter((c) => c.status === 'fail').length;
  const warning = selectedRelease.checks.filter((c) => c.status === 'warn').length;
  const isReady = failing === 0;

  return (
    <div className="page-content stack" style={{ gap: 22 }}>
      <div className="tabs" role="tablist">
        {([
          { id: 'releases', label: 'Releases' },
          { id: 'readiness', label: 'Release Readiness' },
          { id: 'flags', label: 'Feature Flags' },
          { id: 'rollback', label: 'Rollback' },
        ] as const).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'releases' && (
        <div className="stack" style={{ gap: 14 }}>
          {DEMO_RELEASES.map((r) => (
            <div key={r.version} className="panel" style={{ padding: '16px 20px' }}>
              <div className="spread">
                <div className="row" style={{ gap: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', fontFamily: 'var(--mono)' }}>{r.version}</span>
                  <Badge variant={r.status === 'deployed' ? 'success' : r.status === 'ready' ? 'info' : r.status === 'blocked' ? 'danger' : 'warn'} dot>
                    {r.status}
                  </Badge>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>{r.branch}</span>
                </div>
                <div className="row" style={{ gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{r.commits} commits · {r.prs} PRs</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>{r.date}</span>
                </div>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {r.checks.map((c) => (
                  <span key={c.label} style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: c.status === 'pass' ? 'var(--accent)' : c.status === 'fail' ? 'var(--danger)' : c.status === 'warn' ? 'var(--warn)' : 'var(--subtle)' }}>
                    {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '⚠'} {c.label}
                  </span>
                ))}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <button className="btn btn-sm" onClick={() => { setSelectedRelease(r); setTab('readiness'); }}>View readiness</button>
                {r.status === 'ready' && <button className="btn btn-sm btn-primary">Deploy →</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'readiness' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className={`banner ${isReady ? 'banner-ok' : 'banner-bad'}`}>
            <div>
              <p className="banner-title" style={{ color: isReady ? 'var(--accent)' : 'var(--danger)' }}>
                {isReady ? '✓ READY TO RELEASE' : '✗ BLOCKED'}
              </p>
              <p className="banner-text">
                {isReady
                  ? `${selectedRelease.version} — ${passing}/${selectedRelease.checks.length} checks passing${warning > 0 ? `, ${warning} warnings` : ''}.`
                  : `${failing} blocking check${failing > 1 ? 's' : ''} must be resolved before release.`
                }
              </p>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {isReady ? (
                <button className="btn btn-sm btn-primary">Approve release</button>
              ) : (
                <Link to="/investigations" className="btn btn-sm">Investigate blockers</Link>
              )}
            </div>
          </div>

          <Card title={`Release Readiness — ${selectedRelease.version}`} flush>
            <table className="table">
              <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
              <tbody>
                {selectedRelease.checks.map((c) => (
                  <tr key={c.label}>
                    <td style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>{c.label}</td>
                    <td>
                      <Badge variant={c.status === 'pass' ? 'success' : c.status === 'fail' ? 'danger' : c.status === 'warn' ? 'warn' : 'muted'} dot>
                        {c.status}
                      </Badge>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'flags' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="banner banner-info">
            <p className="banner-text">
              Feature flags allow progressive rollout of changes. This view shows conceptual flag management — no real production flag control is configured.
              Flags marked <strong>DEMO</strong> are illustrative only.
            </p>
          </div>
          <Card title="Feature Flags" flush>
            <table className="table">
              <thead><tr><th>Flag</th><th>Environment</th><th>Status</th><th>Rollout</th><th>Owner</th><th>Created</th></tr></thead>
              <tbody>
                {FEATURE_FLAGS.map((f) => (
                  <tr key={f.name}>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>{f.name}</td>
                    <td style={{ fontSize: 12 }}>{f.env}</td>
                    <td>
                      <Badge variant={f.status === 'enabled' ? 'success' : f.status === 'disabled' ? 'muted' : 'warn'} dot>
                        {f.status}
                      </Badge>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: f.status === 'enabled' ? 'var(--accent)' : 'var(--muted)' }}>
                      {f.rollout}
                    </td>
                    <td style={{ fontSize: 12 }}>{f.owner}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>{f.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'rollback' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="banner banner-warn">
            <div>
              <p className="banner-title" style={{ color: 'var(--warn)' }}>⚠ Rollback requires human approval</p>
              <p className="banner-text">
                FixFlow prepares the rollback plan and shows what will change. No files are modified until you explicitly approve. Rollback targets must be verified stable before proceeding.
              </p>
            </div>
          </div>
          <Card title="Rollback Center">
            <div className="stack" style={{ gap: 16 }}>
              <dl className="kv">
                <dt>Current version</dt><dd className="mono" style={{ color: 'var(--ink)', fontWeight: 700 }}>v1.3.0</dd>
                <dt>Rollback target</dt><dd className="mono" style={{ color: 'var(--warn)' }}>v1.2.0</dd>
                <dt>Changed files</dt><dd>3 files</dd>
                <dt>Rollback risk</dt><dd><Badge variant="info">Low — no schema changes</Badge></dd>
                <dt>Tests at v1.2.0</dt><dd><Badge variant="success" dot>45/45 passing</Badge></dd>
              </dl>
              <div style={{ padding: '10px 14px', background: 'var(--panel-sunken)', borderRadius: 10, border: '1px solid var(--line)' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Rollback Plan</p>
                <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
                  <li>Revert src/routes/orders.js to v1.2.0 state</li>
                  <li>Revert web/api-client.js to v1.2.0 state</li>
                  <li>Revert web/app.js to v1.2.0 state</li>
                  <li>Run full test suite to verify stability</li>
                </ul>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn btn-sm" style={{ color: 'var(--danger)', borderColor: 'rgba(248,113,113,.3)' }}>
                  Approve rollback (requires confirmation)
                </button>
                <button className="btn btn-sm">Cancel</button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
