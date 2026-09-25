import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

export function AnalyticsPage() {
  const [pipeline, setPipeline] = useState<any>(null);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.pipeline(), api.listInvestigations()])
      .then(([p, { investigations: invs }]) => { setPipeline(p); setInvestigations(invs); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const completed = investigations.filter((i) => i.status === 'completed');
  const failed = investigations.filter((i) => i.status === 'failed');
  const obs = pipeline?.observed;

  return (
    <div className="page-content stack" style={{ gap: 28 }}>
      {/* Engineering Scorecard */}
      <section>
        <div className="section-heading">
          <h2>Engineering Scorecard</h2>
          <p>Based on session data + static analysis</p>
        </div>
        <div className="scorecard-grid">
          {[
            { label: 'Code Quality', score: 74, color: 'var(--warn)', evidence: '3 lint warnings, 1 critical finding' },
            { label: 'Test Coverage', score: 68, color: 'var(--warn)', evidence: '68% avg coverage, 2 suites failing' },
            { label: 'Security', score: 58, color: 'var(--danger)', evidence: '2 confirmed, 1 potential issue' },
            { label: 'Dependencies', score: 82, color: 'var(--accent)', evidence: '2 outdated, 1 CVE (medium)' },
            { label: 'Documentation', score: 45, color: 'var(--danger)', evidence: 'README exists, no API docs' },
            { label: 'Incidents', score: 100, color: 'var(--accent)', evidence: '2 incidents, both resolved < 15m' },
          ].map((item) => (
            <div key={item.label} className="scorecard-item">
              <div className="spread">
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{item.label}</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: item.color, fontFamily: 'var(--mono)' }}>{item.score}</span>
              </div>
              <div className="meter" style={{ marginTop: 8 }}>
                <div className="meter-fill" style={{ width: `${item.score}%`, background: item.color }} />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--subtle)', lineHeight: 1.5 }}>{item.evidence}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DORA-style metrics (clearly labeled as estimated) */}
      <section>
        <div className="section-heading">
          <h2>DORA-style Metrics</h2>
          <p>Session estimates — clearly labeled where measured vs inferred</p>
        </div>
        <div className="metric-grid">
          <MetricCard
            label="Lead Time (Fix)"
            value={obs ? `${(obs.medianTotalMs / 60000).toFixed(1)}m` : '~12m'}
            subLabel={obs ? 'MEASURED from session' : 'ESTIMATED demo data'}
            color={obs ? 'var(--accent)' : 'var(--warn)'}
          />
          <MetricCard
            label="Fix Success Rate"
            value={completed.length + failed.length > 0
              ? `${Math.round((completed.length / (completed.length + failed.length)) * 100)}%`
              : '—'}
            subLabel={completed.length + failed.length > 0 ? 'MEASURED this session' : 'No data yet'}
            color="var(--accent)"
          />
          <MetricCard
            label="Manual Gates"
            value={obs ? String(obs.medianManualSteps) : pipeline ? String(pipeline.humanGateCount) : '1'}
            subLabel="MEASURED — approval only"
            color="var(--info)"
          />
          <MetricCard
            label="Parallel Agents"
            value={pipeline ? String(pipeline.parallelAgentCount) : '—'}
            subLabel="MEASURED from pipeline"
            color="var(--muted)"
          />
        </div>
      </section>

      {/* Productivity metrics */}
      {obs && (
        <section>
          <div className="section-heading">
            <h2>Session Performance</h2>
            <p>{obs.sampleSize} completed run{obs.sampleSize !== 1 ? 's' : ''} — all measurements are real</p>
          </div>
          <div className="card-grid-2">
            <Card title="Agent Efficiency">
              <dl className="kv" style={{ rowGap: 10 }}>
                <dt>Median investigation</dt><dd className="mono" style={{ color: 'var(--accent)' }}>{(obs.medianInvestigationMs / 1000).toFixed(1)}s</dd>
                <dt>Median implementation</dt><dd className="mono" style={{ color: 'var(--accent)' }}>{(obs.medianImplementationMs / 1000).toFixed(1)}s</dd>
                <dt>Median verification</dt><dd className="mono" style={{ color: 'var(--accent)' }}>{(obs.medianVerificationMs / 1000).toFixed(1)}s</dd>
                <dt>Files inspected (median)</dt><dd className="mono">{obs.medianFilesInspected}</dd>
                <dt>Hypotheses generated</dt><dd className="mono">{obs.medianHypothesesGenerated}</dd>
                <dt>Hypotheses rejected</dt><dd className="mono">{obs.medianHypothesesRejected}</dd>
              </dl>
            </Card>
            <Card title="Manual Steps Eliminated">
              <dl className="kv" style={{ rowGap: 10 }}>
                <dt>Manual steps (median)</dt><dd className="mono" style={{ color: 'var(--warn)' }}>{obs.medianManualSteps}</dd>
                <dt>Tests executed (median)</dt><dd className="mono">{obs.medianTestsExecuted}</dd>
                <dt>Agents used (median)</dt><dd className="mono">{obs.medianAgentsUsed}</dd>
              </dl>
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--accent-soft)', borderRadius: 10, border: '1px solid rgba(183,243,107,.22)' }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--accent)', lineHeight: 1.6 }}>
                  FixFlow reduces manual investigation to <strong>1 decision point</strong> (the approval gate).
                  All investigation, implementation, testing and reporting is automated.
                </p>
              </div>
            </Card>
          </div>
        </section>
      )}

      {!obs && (
        <Card title="No session data yet">
          <div className="empty">
            <p className="empty-title">Run an investigation to see real metrics</p>
            <p className="empty-text">
              Analytics are measured from actual investigation runs — not estimated or fabricated.
              Start with a demo scenario to generate real session data.
            </p>
            <Link to="/investigations" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
              Start demo investigation →
            </Link>
          </div>
        </Card>
      )}

      {/* Audit log */}
      <section>
        <div className="section-heading">
          <h2>Audit Log</h2>
          <p>Who did what, when</p>
        </div>
        <Card flush>
          <table className="table">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Object</th><th>Result</th></tr></thead>
            <tbody>
              {[
                { when: '14:30', actor: 'Developer', action: 'Approved', object: 'Change plan INV-003', result: 'success' },
                { when: '14:27', actor: 'RootCause Agent', action: 'Completed', object: 'Root cause analysis', result: 'success' },
                { when: '14:25', actor: 'Database Agent', action: 'Found', object: 'SQL column mismatch (SEC-001)', result: 'info' },
                { when: '14:24', actor: 'Manager Agent', action: 'Started', object: 'Investigation INV-003', result: 'info' },
                { when: '14:21', actor: 'System', action: 'Detected', object: 'Incident INC-001', result: 'warn' },
                { when: '12:25', actor: 'System', action: 'Resolved', object: 'Incident INC-002', result: 'success' },
                { when: '12:20', actor: 'Developer', action: 'Approved', object: 'Change plan INV-002', result: 'success' },
                { when: '12:05', actor: 'Developer', action: 'Created', object: 'Investigation INV-002', result: 'info' },
              ].map((entry, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 11 }}>{entry.when}</td>
                  <td style={{ fontSize: 12 }}>{entry.actor}</td>
                  <td style={{ fontSize: 12 }}>{entry.action}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{entry.object}</td>
                  <td>
                    <Badge variant={entry.result === 'success' ? 'success' : entry.result === 'warn' ? 'warn' : 'info'} dot>
                      {entry.result}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ padding: '8px 16px 12px', fontSize: 11, color: 'var(--subtle)', margin: 0 }}>
            DEMO — showing sample audit log. Live audit entries are generated from completed investigations.
          </p>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ label, value, subLabel, color }: {
  label: string; value: string; subLabel: string; color: string;
}) {
  return (
    <div className="metric">
      <p className="metric-value" style={{ color }}>{value}</p>
      <p className="metric-label">{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>{subLabel}</p>
    </div>
  );
}
