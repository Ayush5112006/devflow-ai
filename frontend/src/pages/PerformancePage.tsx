import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Card } from '../components/Card.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

export function PerformancePage() {
  const [pipeline, setPipeline] = useState<any>(null);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.pipeline(), api.listInvestigations()])
      .then(([p, { investigations: invs }]) => {
        setPipeline(p);
        setInvestigations(invs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading performance data…" />;

  const obs = pipeline?.observed;
  const completed = investigations.filter((i: any) => i.status === 'completed');
  const failed = investigations.filter((i: any) => i.status === 'failed');
  const total = completed.length + failed.length;
  const successRate = total > 0 ? Math.round((completed.length / total) * 100) : null;

  return (
    <div className="page-content stack" style={{ gap: 28 }}>
      {/* Header */}
      <div>
        <h1 className="page-title">Performance</h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
          Real-time measurement of the FixFlow AI pipeline. All numbers are measured from actual agent execution — not estimated.
        </p>
      </div>

      {/* Live measured metrics — only show with real data */}
      {obs ? (
        <>
          <section>
            <div className="section-heading">
              <h2>Pipeline Performance</h2>
              <p>{obs.sampleSize} completed run{obs.sampleSize !== 1 ? 's' : ''} — all values MEASURED</p>
            </div>
            <div className="metric-grid">
              <div className="metric">
                <p className="metric-value" style={{ color: 'var(--accent)' }}>{(obs.medianTotalMs / 1000).toFixed(1)}s</p>
                <p className="metric-label">Median total time</p>
                <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>MEASURED</p>
              </div>
              <div className="metric">
                <p className="metric-value" style={{ color: 'var(--info)' }}>{(obs.medianInvestigationMs / 1000).toFixed(1)}s</p>
                <p className="metric-label">Investigation phase</p>
                <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>MEASURED</p>
              </div>
              <div className="metric">
                <p className="metric-value" style={{ color: 'var(--warn)' }}>{(obs.medianImplementationMs / 1000).toFixed(1)}s</p>
                <p className="metric-label">Implementation phase</p>
                <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>MEASURED</p>
              </div>
              <div className="metric">
                <p className="metric-value" style={{ color: 'var(--success)' }}>{(obs.medianVerificationMs / 1000).toFixed(1)}s</p>
                <p className="metric-label">Verification phase</p>
                <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>MEASURED</p>
              </div>
            </div>
          </section>

          <section>
            <div className="section-heading">
              <h2>Agent Efficiency</h2>
              <p>Per-investigation median values</p>
            </div>
            <div className="card-grid-2">
              <Card title="Investigation Quality">
                <dl className="kv" style={{ rowGap: 10 }}>
                  <dt>Files inspected (median)</dt>
                  <dd className="mono" style={{ color: 'var(--info)' }}>{obs.medianFilesInspected}</dd>
                  <dt>Hypotheses generated</dt>
                  <dd className="mono" style={{ color: 'var(--warn)' }}>{obs.medianHypothesesGenerated}</dd>
                  <dt>Hypotheses rejected</dt>
                  <dd className="mono">{obs.medianHypothesesRejected}</dd>
                  <dt>Agents used</dt>
                  <dd className="mono">{obs.medianAgentsUsed}</dd>
                </dl>
              </Card>
              <Card title="Fix Quality">
                <dl className="kv" style={{ rowGap: 10 }}>
                  <dt>Tests executed (median)</dt>
                  <dd className="mono" style={{ color: 'var(--success)' }}>{obs.medianTestsExecuted}</dd>
                  <dt>Manual steps (median)</dt>
                  <dd className="mono" style={{ color: 'var(--accent)' }}>{obs.medianManualSteps}</dd>
                  <dt>Fix success rate</dt>
                  <dd className="mono" style={{ color: successRate != null ? 'var(--success)' : 'var(--muted)' }}>
                    {successRate != null ? `${successRate}%` : '—'}
                  </dd>
                  <dt>Completed runs</dt>
                  <dd className="mono">{completed.length}</dd>
                </dl>
              </Card>
            </div>
          </section>
        </>
      ) : (
        <div className="banner banner-info">
          <div>
            <p className="banner-title" style={{ color: 'var(--info)' }}>No performance data yet</p>
            <p className="banner-text">
              Run an investigation to generate real measured performance data. Metrics are computed from actual agent execution times — nothing is estimated.
            </p>
          </div>
          <Link to="/investigations" className="btn btn-sm btn-primary" style={{ flex: 'none' }}>
            Start investigation →
          </Link>
        </div>
      )}

      {/* Pipeline architecture — always shown */}
      {pipeline && (
        <section>
          <div className="section-heading">
            <h2>Pipeline Architecture</h2>
            <p>Stages and agents — live from agent registry</p>
          </div>
          <div className="card-grid-2">
            <Card title="Stages">
              <ol className="list-num" style={{ gap: 9 }}>
                {pipeline.stages.map((s: any) => (
                  <li key={s.id} style={{ color: s.requiresHuman ? 'var(--warn)' : 'var(--muted)', fontWeight: s.requiresHuman ? 600 : 400 }}>
                    {s.requiresHuman ? '⏸ ' : ''}{s.label}
                    {s.requiresHuman && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--subtle)' }}> — human gate</span>}
                  </li>
                ))}
              </ol>
              <p style={{ marginTop: 12, fontSize: 11, color: 'var(--subtle)' }}>
                {pipeline.humanGateCount} human decision point · {pipeline.stages.length} total stages
              </p>
            </Card>
            <Card title="Parallel Agents">
              <div className="stack" style={{ gap: 8 }}>
                {pipeline.agents.map((a: any) => (
                  <div key={a.id} className="row" style={{ gap: 10, padding: '6px 10px', background: 'var(--panel-sunken)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-text)', fontFamily: 'var(--mono)', flex: 'none', width: 96 }}>{a.id}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>{a.title}</span>
                    {!a.blocking && (
                      <span style={{ fontSize: 10, color: 'var(--info)', fontFamily: 'var(--mono)', flex: 'none' }}>parallel</span>
                    )}
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 10, fontSize: 11, color: 'var(--subtle)' }}>
                {pipeline.parallelAgentCount} agents run in parallel during investigation
              </p>
            </Card>
          </div>
        </section>
      )}

      {/* Coming Soon section */}
      <section>
        <div className="section-heading">
          <h2>Coming Soon</h2>
          <span className="badge badge-coming">Planned</span>
        </div>
        <div className="card-grid-2">
          {[
            { title: 'Time-series performance charts', desc: 'Investigation duration over time, trend analysis, outlier detection.' },
            { title: 'Per-agent latency breakdown', desc: 'Which agents take longest, bottleneck identification, optimization opportunities.' },
            { title: 'Comparative benchmarks', desc: 'Compare your fix times against industry averages and previous sessions.' },
            { title: 'Alert thresholds', desc: 'Set alerts when investigation time exceeds a threshold or success rate drops.' },
          ].map((item) => (
            <div key={item.title} className="panel" style={{ padding: '14px 16px', borderStyle: 'dashed' }}>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{item.title}</p>
                <span className="badge badge-coming">Coming Soon</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
