import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Card } from '../components/Card.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

export function MetricsPage() {
  const [pipeline, setPipeline] = React.useState<any>(null);
  const [investigations, setInvestigations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([api.pipeline(), api.listInvestigations()])
      .then(([p, { investigations }]) => { setPipeline(p); setInvestigations(investigations); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading metrics…" />;

  const completed = investigations.filter(i => i.status === 'completed');
  const obs = pipeline?.observed;

  return (
    <div className="page-content stack" style={{ gap: 24 }}>
      <div>
        <h1 className="page-title">Engineering Metrics</h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
          Live productivity measurements from this session's investigation runs.
        </p>
      </div>

      {/* Top-level KPIs */}
      <div className="metric-grid">
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--ink)' }}>{investigations.length}</p>
          <p className="metric-label">Investigations</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--accent)' }}>{completed.length}</p>
          <p className="metric-label">Resolved</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--info)' }}>{pipeline?.parallelAgentCount ?? '—'}</p>
          <p className="metric-label">Parallel agents</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--warn)' }}>{pipeline?.humanGateCount ?? '—'}</p>
          <p className="metric-label">Manual gates</p>
        </div>
      </div>

      {obs ? (
        <>
          <Card title="Session Performance" action={
            <span className="chip mono">{obs.sampleSize} completed run{obs.sampleSize !== 1 ? 's' : ''}</span>
          }>
            <div className="metric-grid">
              <MiniMetric label="Median total" value={`${(obs.medianTotalMs / 1000).toFixed(1)}s`} color="var(--accent)" />
              <MiniMetric label="Files inspected" value={obs.medianFilesInspected} color="var(--info)" />
              <MiniMetric label="Hypotheses generated" value={obs.medianHypothesesGenerated} color="var(--warn)" />
              <MiniMetric label="Agents used" value={obs.medianAgentsUsed} color="var(--muted)" />
            </div>
            <div className="metric-grid" style={{ marginTop: 12 }}>
              <MiniMetric label="Min total" value={`${(obs.minTotalMs / 1000).toFixed(1)}s`} color="var(--muted)" />
              <MiniMetric label="Max total" value={`${(obs.maxTotalMs / 1000).toFixed(1)}s`} color="var(--muted)" />
              <MiniMetric label="Tests executed" value={obs.medianTestsExecuted} color="var(--muted)" />
              <MiniMetric label="Manual steps" value={obs.medianManualSteps} color="var(--muted)" />
            </div>
          </Card>

          {/* Workflow comparison */}
          <div className="card-grid-2">
            <Card title="Traditional workflow">
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                Estimated manual baseline for the same class of bug investigation.
              </p>
              <dl className="kv">
                <dt>Total time</dt><dd style={{ color: 'var(--ink)', fontWeight: 700 }}>~45–90 minutes</dd>
                <dt>Manual steps</dt><dd style={{ color: 'var(--ink)', fontWeight: 700 }}>~12–18</dd>
                <dt>Context switches</dt><dd style={{ color: 'var(--ink)', fontWeight: 700 }}>High</dd>
                <dt>Documentation</dt><dd style={{ color: 'var(--muted)' }}>Often skipped</dd>
                <dt>Regression check</dt><dd style={{ color: 'var(--muted)' }}>Manual / inconsistent</dd>
              </dl>
            </Card>
            <Card title="FixFlow AI workflow">
              <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16, color: 'var(--accent)' }}>
                Measured from {obs.sampleSize} completed run{obs.sampleSize !== 1 ? 's' : ''} in this session.
              </p>
              <dl className="kv">
                <dt>Total time</dt>
                <dd style={{ color: 'var(--accent)', fontWeight: 700 }}>{(obs.medianTotalMs / 1000).toFixed(1)}s median</dd>
                <dt>Manual gates</dt>
                <dd style={{ color: 'var(--accent)', fontWeight: 700 }}>{obs.medianManualSteps} (approval only)</dd>
                <dt>Agents used</dt>
                <dd style={{ color: 'var(--ink)', fontWeight: 700 }}>{obs.medianAgentsUsed} parallel agents</dd>
                <dt>Report</dt>
                <dd style={{ color: 'var(--accent)' }}>Auto-generated</dd>
                <dt>Regression check</dt>
                <dd style={{ color: 'var(--accent)' }}>Automated</dd>
              </dl>
            </Card>
          </div>
        </>
      ) : (
        <Card title="No session data yet">
          <div className="empty">
            <p className="empty-title">No completed investigations</p>
            <p className="empty-text">
              Run an investigation to completion to see live performance metrics.
              Session data is measured from real runs — not estimated.
            </p>
            <Link to="/investigations" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
              Start with a demo scenario
            </Link>
          </div>
        </Card>
      )}

      {/* Pipeline stages */}
      {pipeline && (
        <Card title="Pipeline Stages" action={
          <span className="chip mono">{pipeline.stages.length} stages</span>
        } flush>
          <table className="table">
            <thead>
              <tr><th>#</th><th>Stage</th><th>Human gate</th><th>Produces</th></tr>
            </thead>
            <tbody>
              {pipeline.stages.map((stage: any, i: number) => (
                <tr key={stage.id}>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>{i + 1}</td>
                  <td style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 13 }}>{stage.label}</td>
                  <td>
                    {stage.requiresHuman
                      ? <span style={{ color: 'var(--warn)', fontWeight: 700, fontSize: 12 }}>⏸ Yes</span>
                      : <span style={{ color: 'var(--subtle)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{stage.produces}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Agent registry */}
      {pipeline?.agents && (
        <Card title="Registered Agents" action={
          <span className="chip mono">{pipeline.agents.length} agents · {pipeline.parallelAgentCount} parallel</span>
        } flush>
          <table className="table">
            <thead>
              <tr><th>Agent</th><th>Stage</th><th>Parallel group</th><th>Blocking</th></tr>
            </thead>
            <tbody>
              {pipeline.agents.map((agent: any) => (
                <tr key={agent.id}>
                  <td style={{ color: 'var(--ink)', fontSize: 13 }}>{agent.title}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{agent.stage}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{agent.parallelGroup}</td>
                  <td style={{ fontSize: 12, color: agent.blocking ? 'var(--danger)' : 'var(--subtle)' }}>
                    {agent.blocking ? 'Yes' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="metric">
      <p className="metric-value" style={{ color }}>{value}</p>
      <p className="metric-label">{label}</p>
    </div>
  );
}
