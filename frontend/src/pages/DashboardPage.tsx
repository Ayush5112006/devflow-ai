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

  return (
    <div className="dashboard">
      {error && <div className="alert" role="alert"><span>{error}</span></div>}

      {pipeline && (
        <div className="stats-row" style={{ marginTop: 0, marginBottom: -22 }}>
          <Stat label="parallel agents" value={pipeline.parallelAgentCount} />
          <Stat label="manual steps" value={pipeline.humanGateCount} />
          <Stat label="workflow stages" value={pipeline.stages.length} />
          {pipeline.observed && (
            <Stat label="median run" value={`${(pipeline.observed.medianTotalMs / 1000).toFixed(1)}s`} />
          )}
        </div>
      )}

      {/* Hero */}
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Agentic developer workflow</p>
          <h1 className="dashboard-title">From production bug to <span>verified fix.</span></h1>
          <p className="dashboard-subtitle">
            FixFlow coordinates specialized AI agents to investigate software bugs in parallel, identify
            evidence-backed root causes, propose the smallest safe change, verify the fix, and check for regressions.
          </p>
          <div className="workflow-steps">
            <div className="workflow-step">
              <span className="workflow-num">01</span>
              <div>
                <p className="workflow-step-title">Investigate</p>
                <p className="workflow-step-desc">Parallel agents + evidence</p>
              </div>
            </div>
            <span className="workflow-arrow">→</span>
            <div className="workflow-step">
              <span className="workflow-num">02</span>
              <div>
                <p className="workflow-step-title">Fix</p>
                <p className="workflow-step-desc">Minimal change + human approval</p>
              </div>
            </div>
            <span className="workflow-arrow">→</span>
            <div className="workflow-step">
              <span className="workflow-num">03</span>
              <div>
                <p className="workflow-step-title">Verify</p>
                <p className="workflow-step-desc">Tests + regression + report</p>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-ctas">
          <Link to="/new" className="hero-action">+ Start investigation</Link>
          <Link to="/" className="hero-action-secondary">View demo ↓</Link>
        </div>
      </div>

      {/* Demo bugs */}
      <section>
        <div className="section-heading"><h2>Start with a known failure</h2><p>Curated scenarios from InsightBoard</p></div>
        <div className="scenario-grid">
          {demoBugs.map((bug) => (
            <div key={bug.id} className="scenario-card">
              <div className="scenario-meta">
                <span>{bug.id}</span>
                {severityBadge(bug.severity)}
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

      {/* Workflow comparison — numbers from the live pipeline endpoint */}
      <section>
        <div className="section-heading">
          <h2>Workflow comparison</h2>
          <p>FixFlow stages come from the running pipeline</p>
        </div>
        <div className="card-grid-2">
          <Card title="Traditional manual workflow">
            <ol className="list-num">
              {['Receive bug report', 'Gather logs manually', 'Context switch across files',
                'Form a hypothesis', 'Manually trace call paths', 'Write a fix',
                'Run tests manually', 'Document changes', 'Hope for no regression'].map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <p className="subtle" style={{ margin: '14px 0 0', paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 12 }}>
              Duration not measured — no baseline is recorded for this workflow.
            </p>
          </Card>
          <Card title="FixFlow AI workflow">
            {pipeline ? (
              <>
                <ol className="list-num">
                  {pipeline.stages.map((s) => (
                    <li key={s.id} style={s.requiresHuman ? { color: 'var(--warn)', fontWeight: 600 } : undefined}>
                      {s.requiresHuman ? '⏸ ' : ''}{s.label}
                      {s.requiresHuman && <span className="subtle" style={{ fontWeight: 400 }}> — human decision</span>}
                    </li>
                  ))}
                </ol>
                <p style={{ margin: '14px 0 0', paddingTop: 12, borderTop: '1px solid var(--line)', color: 'var(--accent)', fontSize: 12 }}>
                  {pipeline.parallelAgentCount} parallel agents · {pipeline.humanGateCount} manual step
                  {pipeline.humanGateCount === 1 ? '' : 's'} ({pipeline.humanGateStages.join(', ')})
                </p>
              </>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Stage list unavailable — the backend did not report it.
              </p>
            )}
          </Card>
        </div>
      </section>

      {/* Live stats from completed runs (only shown when there is real data) */}
      {pipeline?.observed && (
        <section>
          <div className="section-heading">
            <h2>Measured performance</h2>
            <p>{pipeline.observed.sampleSize} completed run{pipeline.observed.sampleSize !== 1 ? 's' : ''} in this session</p>
          </div>
          <div className="metric-grid">
            {[
              { label: 'Median total', value: `${(pipeline.observed.medianTotalMs / 1000).toFixed(1)}s` },
              { label: 'Files inspected', value: pipeline.observed.medianFilesInspected },
              { label: 'Hypotheses', value: pipeline.observed.medianHypothesesGenerated },
              { label: 'Agents used', value: pipeline.observed.medianAgentsUsed },
            ].map((m) => (
              <div key={m.label} className="metric">
                <p className="metric-value" style={{ color: 'var(--accent)' }}>{m.value}</p>
                <p className="metric-label">{m.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent investigations */}
      {investigations.length > 0 && (
        <section>
          <div className="section-heading">
            <h2>Recent investigations</h2>
            <p>Most recent first</p>
          </div>
          <div className="panel" style={{ overflow: 'hidden' }}>
            {investigations.slice(0, 6).map((inv: any) => (
              <Link
                key={inv.id}
                to={`/investigations/${inv.id}`}
                className="spread"
                style={{ padding: '13px 16px', textDecoration: 'none', borderBottom: '1px solid var(--line)' }}
              >
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="chip mono">{inv.id?.slice(0, 10)}</span>
                  <span style={{ fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inv.bug?.title}
                  </span>
                </div>
                <div className="row" style={{ gap: 6, flex: 'none' }}>
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
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
