import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

interface PR {
  id: string;
  title: string;
  branch: string;
  base: string;
  status: 'open' | 'merged' | 'draft' | 'closed';
  author: string;
  createdAt: string;
  checks: { name: string; status: 'pass' | 'fail' | 'pending' }[];
  rootCause?: string;
  changes?: string;
  tests?: string;
  risk?: string;
}

const DEMO_PRS: PR[] = [
  {
    id: 'PR-003',
    title: 'fix: correct SQL column names in orders route',
    branch: 'fix/orders-sql-column',
    base: 'main',
    status: 'merged',
    author: 'Developer',
    createdAt: '2026-02-24T13:30:00Z',
    checks: [
      { name: 'tests', status: 'pass' },
      { name: 'lint', status: 'pass' },
      { name: 'security', status: 'pass' },
    ],
    rootCause: 'SQL query referenced o.customer_name but the orders table schema defines the column as o.customer.',
    changes: 'Modified src/routes/orders.js:12 — changed SELECT o.customer_name to SELECT o.customer.',
    tests: 'All 12 API tests passing. Added 2 regression tests for the orders endpoint.',
    risk: 'Low — single-line query fix, no schema change, all tests passing.',
  },
  {
    id: 'PR-002',
    title: 'fix: read VITE_API_URL env variable for API base URL',
    branch: 'fix/api-base-url',
    base: 'main',
    status: 'merged',
    author: 'Developer',
    createdAt: '2026-02-24T12:45:00Z',
    checks: [
      { name: 'tests', status: 'pass' },
      { name: 'lint', status: 'pass' },
      { name: 'security', status: 'pass' },
    ],
    rootCause: 'api-client.js read import.meta.env.VITE_API_BASE but the declared variable is VITE_API_URL.',
    changes: 'Modified web/api-client.js:3 — corrected env variable name.',
    tests: '8/8 predictions tests passing.',
    risk: 'Low — single token change, no logic change.',
  },
  {
    id: 'PR-001',
    title: 'fix: renderDetail reads prediction.sentiment field',
    branch: 'fix/prediction-label',
    base: 'main',
    status: 'merged',
    author: 'Developer',
    createdAt: '2026-02-24T11:15:00Z',
    checks: [
      { name: 'tests', status: 'pass' },
      { name: 'lint', status: 'pass' },
      { name: 'security', status: 'pass' },
    ],
    rootCause: 'Frontend renderDetail() read prediction.label but backend returns prediction.sentiment.',
    changes: 'Modified web/app.js:88 — changed field access from label to sentiment.',
    tests: '4/4 frontend tests passing after fix.',
    risk: 'Low — field name change only, API contract confirmed by agent.',
  },
];

export function PullRequestsPage() {
  const [selected, setSelected] = useState<PR | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [tab, setTab] = useState<'list' | 'generate'>('list');

  // Try to get a real PR from a completed investigation
  const [liveData, setLiveData] = React.useState<{ invId: string; report: any } | null>(null);

  React.useEffect(() => {
    api.listInvestigations().then(({ investigations }) => {
      const completed = investigations.find((i: any) => i.status === 'completed');
      if (completed?.id) {
        api.report(completed.id!).then(({ report }) => {
          if (report?.prSummary) setLiveData({ invId: completed.id!, report });
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  function generatePR() {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 1600);
  }

  const PR_STATUS_COLORS: Record<string, string> = {
    open: 'var(--info)', merged: 'var(--accent)', draft: 'var(--subtle)', closed: 'var(--muted)'
  };

  return (
    <div className="page-content stack" style={{ gap: 22 }}>
      {/* Live data banner — shown prominently when an investigation has a real PR summary */}
      {liveData && (
        <div className="banner banner-ok" style={{ borderColor: 'var(--accent)', background: 'rgba(124,92,252,.06)' }}>
          <div>
            <p className="banner-title" style={{ color: 'var(--accent)' }}>
              ✓ Live PR draft ready — from completed investigation
            </p>
            <p className="banner-text">
              Investigation <span className="mono" style={{ fontSize: 11 }}>{liveData.invId?.slice(0, 8)}</span> completed successfully.
              A real PR description has been generated from the root cause, change plan, and test results.
            </p>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => setTab('generate')}>
            View live PR draft →
          </button>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'list'} className="tab" onClick={() => setTab('list')}>Pull Requests</button>
        <button role="tab" aria-selected={tab === 'generate'} className="tab" onClick={() => setTab('generate')}>
          Generate PR {liveData ? <span className="badge badge-live" style={{ marginLeft: 6, fontSize: 9 }}>LIVE</span> : null}
        </button>
      </div>

      {tab === 'list' && (
        <div className="card-grid-sidebar">
          <div className="stack" style={{ gap: 10 }}>
            {DEMO_PRS.map((pr) => (
              <button
                key={pr.id}
                className="panel"
                style={{ padding: '14px 18px', cursor: 'pointer', textAlign: 'left', border: `1px solid ${selected?.id === pr.id ? 'rgba(183,243,107,.4)' : 'var(--line)'}`, width: '100%', background: selected?.id === pr.id ? 'rgba(183,243,107,.04)' : undefined }}
                onClick={() => setSelected(pr)}
              >
                <div className="spread">
                  <div className="row" style={{ gap: 10 }}>
                    <span className="chip mono" style={{ fontSize: 10 }}>{pr.id}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{pr.title}</span>
                  </div>
                  <Badge variant={pr.status === 'merged' ? 'success' : pr.status === 'open' ? 'info' : 'muted'} dot>
                    {pr.status}
                  </Badge>
                </div>
                <div className="row" style={{ gap: 10, marginTop: 8 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--info)' }}>{pr.branch}</span>
                  <span style={{ fontSize: 11, color: 'var(--subtle)' }}>→ {pr.base}</span>
                  <span style={{ fontSize: 11, color: 'var(--subtle)' }}>{pr.author} · {new Date(pr.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  {pr.checks.map((c) => (
                    <span key={c.name} style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: c.status === 'pass' ? 'var(--accent)' : c.status === 'fail' ? 'var(--danger)' : 'var(--warn)' }}>
                      {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '⋯'} {c.name}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {selected ? (
            <Card title={selected.id} action={
              <Badge variant={selected.status === 'merged' ? 'success' : 'info'} dot>{selected.status}</Badge>
            }>
              <div className="stack" style={{ gap: 14 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4 }}>{selected.title}</h3>
                <dl className="kv" style={{ rowGap: 8 }}>
                  <dt>Branch</dt><dd className="mono" style={{ fontSize: 12, color: 'var(--info)' }}>{selected.branch} → {selected.base}</dd>
                  <dt>Author</dt><dd>{selected.author}</dd>
                  <dt>Date</dt><dd>{new Date(selected.createdAt).toLocaleDateString()}</dd>
                </dl>
                {selected.rootCause && (
                  <Section label="Root Cause">{selected.rootCause}</Section>
                )}
                {selected.changes && (
                  <Section label="Changes">{selected.changes}</Section>
                )}
                {selected.tests && (
                  <Section label="Tests">{selected.tests}</Section>
                )}
                {selected.risk && (
                  <Section label="Risk" color="var(--accent)">{selected.risk}</Section>
                )}
                <div className="row" style={{ gap: 6 }}>
                  {selected.checks.map((c) => (
                    <Badge key={c.name} variant={c.status === 'pass' ? 'success' : c.status === 'fail' ? 'danger' : 'warn'} dot>
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          ) : (
            <Card title="PR Detail">
              <div className="empty" style={{ minHeight: 180 }}>
                <p className="empty-title">Select a pull request</p>
                <p className="empty-text">View root cause, changes, tests, and merge readiness.</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'generate' && (
        <div className="stack" style={{ gap: 16 }}>
          {liveData ? (
            <Card title="Live PR Draft — from investigation" action={<Badge variant="success" dot>LIVE</Badge>}>
              <div className="stack" style={{ gap: 12 }}>
                <Section label="Summary">{liveData.report.prSummary?.summary ?? liveData.report.bugSummary}</Section>
                <Section label="Root Cause">{liveData.report.prSummary?.rootCause ?? liveData.report.rootCause}</Section>
                <Section label="Changes">{liveData.report.prSummary?.changes ?? liveData.report.filesChanged}</Section>
                <Section label="Testing">{liveData.report.prSummary?.testing ?? liveData.report.testsExecuted}</Section>
                <Section label="Regression">{liveData.report.prSummary?.regressionStatus ?? liveData.report.regressionResults}</Section>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => { const t = document.createElement('textarea'); t.value = JSON.stringify(liveData.report.prSummary, null, 2); document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); }}>
                    Copy PR body
                  </button>
                  <Link to={`/investigations/${liveData.invId}`} className="btn btn-sm">View full report →</Link>
                </div>
              </div>
            </Card>
          ) : (
            <div className="banner banner-info">
              <div>
                <p className="banner-title" style={{ color: 'var(--info)' }}>No live investigation data yet</p>
                <p className="banner-text">Complete an investigation to generate a real PR description. The demo below shows a sample PR generation workflow.</p>
              </div>
              <Link to="/investigations" className="btn btn-sm" style={{ flex: 'none' }}>Run demo →</Link>
            </div>
          )}

          <Card title="PR Generator — Demo">
            <div className="stack" style={{ gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                After an investigation completes, FixFlow generates a full PR description from the root cause, change plan, and test results. The content comes from real agent findings — not templates.
              </p>
              {!generated ? (
                <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={generatePR} disabled={generating}>
                  {generating ? '⏳ Generating from investigation…' : '▶ Generate demo PR'}
                </button>
              ) : (
                <div className="stack" style={{ gap: 12 }}>
                  <Section label="Title">fix: correct SQL column names in orders route (ISS-003)</Section>
                  <Section label="Root Cause">SQL query in src/routes/orders.js:12 referenced `o.customer_name` which does not exist in the schema. The correct column is `o.customer`.</Section>
                  <Section label="Changes">• src/routes/orders.js:12 — SELECT clause corrected (1 line changed)<br />• test/api.test.js — 2 regression tests added</Section>
                  <Section label="Testing">✓ 47/47 tests passing. ✓ 2 new regression tests added. ✓ Reproduction command passes.</Section>
                  <Section label="Risk">Low — single SQL token change. No schema migration. No downstream API contract change.</Section>
                  <Section label="Related">Closes ISS-003. Investigation ID: {liveData?.invId ?? 'inv-demo-xxx'}</Section>
                  <button className="btn btn-sm btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => setGenerated(false)}>Reset</button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Section({ label, children, color }: { label: string; children: React.ReactNode; color?: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--panel-sunken)', border: '1px solid var(--line)' }}>
      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: color ?? 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}
