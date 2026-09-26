import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DemoBug, PipelineFacts } from '../types/index.js';
import { api } from '../services/api.js';
import { Badge, severityBadge } from '../components/Badge.js';
import { Card } from '../components/Card.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

export function DashboardPage() {
  const [demoBugs, setDemoBugs] = React.useState<DemoBug[]>([]);
  const [pipeline, setPipeline] = React.useState<PipelineFacts | null>(null);
  const [investigations, setInvestigations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [launching, setLaunching] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    Promise.all([
      api.demoBugs(),
      api.pipeline(),
      api.listInvestigations(),
    ])
      .then(([b, p, i]) => {
        setDemoBugs(b.bugs);
        setPipeline(p);
        setInvestigations(i.investigations);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  async function launchDemo(bugId: string) {
    setLaunching(bugId);
    setError(null);
    try {
      const { investigation } = await api.demoQuickstart(bugId);
      navigate(`/investigations/${investigation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLaunching(null);
    }
  }

  if (loading) return <LoadingSpinner message="Loading FixFlow AI…" />;

  const activeInvs = investigations.filter((i) => !['completed', 'failed'].includes(i.status));
  const pendingApprovals = investigations.filter((i) => i.status === 'awaiting_approval');
  const completedInvs = investigations.filter((i) => i.status === 'completed');
  const obs = pipeline?.observed;

  return (
    <div className="dashboard">
      {error && <div className="alert" role="alert"><span>{error}</span></div>}

      {/* Hero — Command Center */}
      <div className="command-center-hero">
        <div>
          <p className="eyebrow">AI Software Engineering OS</p>
          <h1 className="dashboard-title">
            From <span>production bug</span><br />to verified fix.
          </h1>
          <p className="dashboard-subtitle">
            FixFlow coordinates specialized AI agents to investigate, fix, test and document software bugs in parallel.
            One connected workflow from incident to postmortem.
          </p>
          <div className="workflow-steps">
            {['Investigate', 'Fix', 'Test', 'Review', 'Release'].map((s, i) => (
              <React.Fragment key={s}>
                <div className="workflow-step">
                  <span className="workflow-num">0{i + 1}</span>
                  <span className="workflow-step-title">{s}</span>
                </div>
                {i < 4 && <span className="workflow-arrow">→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="hero-ctas">
          <Link to="/new" className="hero-action">+ Start investigation</Link>
          <Link to="/judge" className="hero-action-secondary">Judge Mode →</Link>
        </div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <StatusItem
          label="Active investigations"
          value={activeInvs.length}
          color={activeInvs.length > 0 ? 'var(--info)' : 'var(--subtle)'}
          href="/investigations"
        />
        <StatusItem
          label="Pending approvals"
          value={pendingApprovals.length}
          color={pendingApprovals.length > 0 ? 'var(--warn)' : 'var(--subtle)'}
          href="/investigations"
          urgent={pendingApprovals.length > 0}
        />
        <StatusItem
          label="Completed"
          value={completedInvs.length}
          color={completedInvs.length > 0 ? 'var(--success)' : 'var(--subtle)'}
          href="/reports"
        />
        <StatusItem
          label="Parallel agents"
          value={pipeline?.parallelAgentCount ?? '—'}
          color="var(--muted)"
        />
        {obs && (
          <StatusItem
            label="Median fix time"
            value={`${(obs.medianTotalMs / 1000).toFixed(1)}s`}
            color="var(--accent-text)"
            href="/analytics"
          />
        )}
        <StatusItem
          label="Workflow stages"
          value={pipeline?.stages?.length ?? '—'}
          color="var(--muted)"
        />
      </div>

      {/* Pending approvals alert */}
      {pendingApprovals.length > 0 && (
        <div className="banner banner-warn">
          <div>
            <p className="banner-title" style={{ color: 'var(--warn)' }}>
              ⏸ {pendingApprovals.length} investigation{pendingApprovals.length > 1 ? 's' : ''} awaiting your approval
            </p>
            <p className="banner-text">
              {pendingApprovals.map((i: any) => i.bug?.title).join(', ')}
            </p>
          </div>
          {pendingApprovals[0] && (
            <Link to={`/investigations/${pendingApprovals[0].id}`} className="btn btn-warn btn-sm" style={{ flex: 'none' }}>
              Review plan →
            </Link>
          )}
        </div>
      )}

      {/* Main grid */}
      <div className="card-grid-2">
        {/* Demo scenarios */}
        <section>
          <div className="section-heading">
            <h2>Demo scenarios</h2>
            <p>Curated bugs with real agent execution</p>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {demoBugs.map((bug) => (
              <div key={bug.id} className="scenario-card" style={{ minHeight: 'auto', padding: '14px 16px' }}>
                <div className="spread">
                  <div className="row" style={{ gap: 8 }}>
                    <span className="chip mono" style={{ fontSize: 10 }}>{bug.id}</span>
                    {severityBadge(bug.severity)}
                  </div>
                  <button
                    onClick={() => launchDemo(bug.id)}
                    disabled={launching !== null}
                    className="btn btn-sm btn-primary"
                    style={{ flex: 'none' }}
                  >
                    {launching === bug.id ? 'Launching…' : 'Investigate →'}
                  </button>
                </div>
                <p className="scenario-title" style={{ fontSize: 13, margin: '8px 0 4px' }}>{bug.title}</p>
                <p className="scenario-description" style={{ fontSize: 12, margin: 0 }}>{bug.oneLine}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recent investigations + quick links */}
        <section>
          <div className="section-heading">
            <h2>Recent investigations</h2>
            <Link to="/investigations" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {investigations.length > 0 ? (
            <div className="panel" style={{ overflow: 'hidden' }}>
              {investigations.slice(0, 6).map((inv: any, i: number) => (
                <Link
                  key={inv.id}
                  to={`/investigations/${inv.id}`}
                  className="spread"
                  style={{
                    padding: '11px 14px', textDecoration: 'none',
                    borderBottom: i < 5 ? '1px solid var(--line)' : undefined,
                    background: inv.status === 'awaiting_approval' ? 'rgba(251,191,36,.04)' : undefined,
                  }}
                >
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="chip mono" style={{ fontSize: 10 }}>{inv.id?.slice(0, 8)}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inv.bug?.title}
                    </span>
                  </div>
                  <div className="row" style={{ gap: 6, flex: 'none' }}>
                    {severityBadge(inv.bug?.severity)}
                    <Badge
                      variant={inv.status === 'completed' ? 'success' : inv.status === 'failed' ? 'danger' : inv.status === 'awaiting_approval' ? 'warn' : 'info'}
                      dot
                    >
                      {(inv.status ?? '').replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="panel">
              <div className="empty">
                <p className="empty-title">No investigations yet</p>
                <p className="empty-text">Start with a demo scenario above or create a new investigation.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Quick nav grid */}
      <section>
        <div className="section-heading"><h2>Engineering workflows</h2><p>Navigate to any part of the platform</p></div>
        <div className="quicknav-grid">
          {[
            { to: '/issues', icon: '◎', label: 'Issues', desc: 'Track and triage bugs', color: 'var(--danger)' },
            { to: '/debugging', icon: '⊘', label: 'Debugging', desc: 'Logs, runtime, timeline', color: 'var(--info)' },
            { to: '/code-review', icon: '◑', label: 'Code Review', desc: 'AI-powered review', color: 'var(--accent)' },
            { to: '/security', icon: '◻', label: 'Security', desc: 'Vulnerabilities & CVEs', color: '#f472b6' },
            { to: '/test-center', icon: '✓', label: 'Tests', desc: 'Suites & coverage', color: 'var(--warn)' },
            { to: '/git', icon: '⑂', label: 'Git', desc: 'Branches & commits', color: 'var(--info)' },
            { to: '/pull-requests', icon: '⊕', label: 'Pull Requests', desc: 'Generate & review PRs', color: 'var(--accent)' },
            { to: '/incidents', icon: '⚡', label: 'Incidents', desc: 'Detect & resolve', color: 'var(--danger)' },
            { to: '/releases', icon: '◈', label: 'Releases', desc: 'Readiness & flags', color: '#a78bfa' },
            { to: '/knowledge', icon: '◧', label: 'Knowledge', desc: 'Articles & AI memory', color: 'var(--warn)' },
            { to: '/analytics', icon: '◉', label: 'Analytics', desc: 'Metrics & audit log', color: 'var(--accent)' },
            { to: '/judge', icon: '◬', label: 'Judge Mode', desc: 'Full lifecycle demo', color: 'var(--accent)' },
          ].map((item) => (
            <Link key={item.to} to={item.to} className="quicknav-card" style={{ '--qn-color': item.color } as any}>
              <span className="quicknav-icon">{item.icon}</span>
              <div>
                <p className="quicknav-label">{item.label}</p>
                <p className="quicknav-desc">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Pipeline comparison (only shown when pipeline data available) */}
      {pipeline && (
        <section>
          <div className="section-heading">
            <h2>Workflow comparison</h2>
            <p>Live pipeline data — not estimated</p>
          </div>
          <div className="card-grid-2">
            <Card title="Traditional manual workflow">
              <ol className="list-num">
                {['Receive bug report', 'Gather logs manually', 'Context switch across files',
                  'Form hypothesis', 'Manually trace call paths', 'Write fix',
                  'Run tests manually', 'Document changes', 'Hope for no regression'].map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p className="subtle" style={{ margin: '12px 0 0', paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 11 }}>
                Duration not measured — no baseline recorded for this workflow.
              </p>
            </Card>
            <Card title="FixFlow AI workflow">
              <ol className="list-num">
                {pipeline.stages.map((s) => (
                  <li key={s.id} style={s.requiresHuman ? { color: 'var(--warn)', fontWeight: 600 } : undefined}>
                    {s.requiresHuman ? '⏸ ' : ''}{s.label}
                    {s.requiresHuman && <span className="subtle" style={{ fontWeight: 400 }}> — human decision</span>}
                  </li>
                ))}
              </ol>
              <p style={{ margin: '12px 0 0', paddingTop: 10, borderTop: '1px solid var(--line)', color: 'var(--accent)', fontSize: 11 }}>
                {pipeline.parallelAgentCount} parallel agents · {pipeline.humanGateCount} manual gate
                {obs ? ` · ${(obs.medianTotalMs / 1000).toFixed(1)}s median (MEASURED)` : ''}
              </p>
            </Card>
          </div>
        </section>
      )}

      {/* Measured performance (only shown with real data) */}
      {obs && (
        <section>
          <div className="section-heading">
            <h2>Measured performance</h2>
            <p>{obs.sampleSize} completed run{obs.sampleSize !== 1 ? 's' : ''} — all values real</p>
          </div>
          <div className="metric-grid">
            {[
              { label: 'Median total', value: `${(obs.medianTotalMs / 1000).toFixed(1)}s`, color: 'var(--accent)' },
              { label: 'Files inspected', value: obs.medianFilesInspected, color: 'var(--info)' },
              { label: 'Hypotheses', value: obs.medianHypothesesGenerated, color: 'var(--warn)' },
              { label: 'Agents used', value: obs.medianAgentsUsed, color: 'var(--muted)' },
            ].map((m) => (
              <div key={m.label} className="metric">
                <p className="metric-value" style={{ color: m.color }}>{m.value}</p>
                <p className="metric-label">{m.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatusItem({ label, value, color, href, urgent }: {
  label: string; value: string | number; color: string; href?: string; urgent?: boolean;
}) {
  const content = (
    <div className={`status-item ${urgent ? 'status-item-urgent' : ''}`}>
      <span className="status-item-value" style={{ color }}>{value}</span>
      <span className="status-item-label">{label}</span>
    </div>
  );
  return href ? <Link to={href} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}
