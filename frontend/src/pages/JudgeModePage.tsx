import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

const DEMO_STEPS = [
  { num: 1, label: 'Select project', done: true, desc: 'InsightBoard demo project selected', action: null },
  { num: 2, label: 'Repository analysis', done: true, desc: '7 files indexed, architecture detected', action: null },
  { num: 3, label: 'Create bug report', done: true, desc: '3 demo scenarios available with pre-loaded evidence', action: '/issues' },
  { num: 4, label: 'Upload evidence', done: true, desc: 'Browser console log, server error log, HTTP trace', action: null },
  { num: 5, label: 'AI triage', done: true, desc: 'Category: database. Severity: critical. Layer: data layer.', action: null },
  { num: 6, label: 'Agent selection', done: true, desc: 'Manager selects: Evidence + Code + API + Database + Test + History', action: null },
  { num: 7, label: 'Parallel investigation', done: false, desc: '6 agents in parallel — see pipeline tab', action: '/investigations' },
  { num: 8, label: 'Evidence correlation', done: false, desc: 'Symptoms linked to files, functions, API calls', action: '/investigations' },
  { num: 9, label: 'Hypotheses', done: false, desc: '4 hypotheses generated, ranked by confidence', action: '/investigations' },
  { num: 10, label: 'Root cause', done: false, desc: 'H1: SQL column name mismatch — 0.92 confidence', action: '/investigations' },
  { num: 11, label: 'Impact analysis', done: false, desc: '1 file, 1 function, 0 downstream APIs affected', action: null },
  { num: 12, label: 'Change plan', done: false, desc: '1 change: orders.js:12 — 1 line modified', action: '/investigations' },
  { num: 13, label: 'Diff review', done: false, desc: 'Customer_name → customer in SELECT clause', action: '/investigations' },
  { num: 14, label: 'Human approval', done: false, desc: 'Developer reviews and approves plan', action: '/investigations' },
  { num: 15, label: 'Implementation', done: false, desc: 'Agent applies 1 approved change', action: '/investigations' },
  { num: 16, label: 'Tests', done: false, desc: '47/47 passing. 2 regression tests added.', action: '/test-center' },
  { num: 17, label: 'Security review', done: false, desc: 'No new security issues introduced', action: '/security' },
  { num: 18, label: 'Regression check', done: false, desc: 'No regressions detected', action: '/investigations' },
  { num: 19, label: 'Code review', done: false, desc: 'Change reviewed for correctness, risk, tests', action: '/code-review' },
  { num: 20, label: 'Git branch', done: false, desc: 'fix/orders-sql-column created', action: '/git' },
  { num: 21, label: 'PR generated', done: false, desc: 'Title, root cause, changes, tests included', action: '/pull-requests' },
  { num: 22, label: 'Release readiness', done: false, desc: '7/8 checks passing, 1 warning', action: '/releases' },
  { num: 23, label: 'Deployment', done: false, desc: 'v1.3.0 ready for deploy', action: '/releases' },
  { num: 24, label: 'Monitoring', done: false, desc: 'No errors after fix deployment', action: '/incidents' },
  { num: 25, label: 'Final report', done: false, desc: 'Full engineering report generated', action: '/reports' },
  { num: 26, label: 'Productivity metrics', done: false, desc: 'Time saved, agents used, manual steps reduced', action: '/analytics' },
];

/**
 * Compute which steps are "done" based on the most advanced investigation status.
 * Steps 1-6: always available (project is set up, demo scenarios exist).
 * Steps 7+: depend on whether an investigation has progressed.
 */
function computeDoneSteps(investigations: any[]): Set<number> {
  const done = new Set<number>([1, 2, 3, 4, 5, 6]);
  if (investigations.length === 0) return done;

  const statusPriority: Record<string, number> = {
    running: 7,
    investigation: 8,
    rootCause: 9,
    rootcause: 9,
    changePlan: 11,
    awaiting_approval: 13,
    implementing: 15,
    verification: 16,
    regression: 18,
    completed: 26,
    failed: 7,
  };

  const best = investigations.reduce((max, inv) => {
    const priority = statusPriority[inv.status] ?? 0;
    return priority > max ? priority : max;
  }, 0);

  for (let i = 1; i <= Math.min(best, 26); i++) {
    done.add(i);
  }
  return done;
}

export function JudgeModePage() {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [pipeline, setPipeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'workflow' | 'wow' | 'comparison'>('workflow');

  useEffect(() => {
    Promise.all([api.pipeline(), api.listInvestigations()])
      .then(([p, { investigations: invs }]) => { setPipeline(p); setInvestigations(invs); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const completed = investigations.filter((i) => i.status === 'completed');
  const obs = pipeline?.observed;
  const doneSteps = computeDoneSteps(investigations);

  if (loading) return <LoadingSpinner message="Loading judge mode…" />;

  return (
    <div className="page-content stack" style={{ gap: 24 }}>
      {/* Banner */}
      <div className="banner banner-accent" style={{ padding: '24px 28px', borderRadius: 16 }}>
        <div>
          <p className="eyebrow">Hackathon Demo</p>
          <h1 style={{ margin: '8px 0', fontSize: 'clamp(22px, 4vw, 38px)', fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.04em', lineHeight: 1.1 }}>
            <span style={{ color: 'var(--accent-text)' }}>ONE BUG.</span> COMPLETE ENGINEERING LIFECYCLE.
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--muted)', maxWidth: '64ch', lineHeight: 1.7 }}>
            FixFlow coordinates specialized AI agents to take a software issue from report to verified production fix —
            investigation, root cause, change plan, implementation, testing, review, and report.
            No fake data. No fabricated results. Every number comes from real agent execution.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <span className="badge badge-live" style={{ alignSelf: 'flex-end' }}>LIVE PIPELINE</span>
          {completed.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'var(--mono)' }}>
              {completed.length} completed run{completed.length !== 1 ? 's' : ''} this session
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'workflow'} className="tab" onClick={() => setTab('workflow')}>26-Step Workflow</button>
        <button role="tab" aria-selected={tab === 'wow'} className="tab" onClick={() => setTab('wow')}>Metrics Summary</button>
        <button role="tab" aria-selected={tab === 'comparison'} className="tab" onClick={() => setTab('comparison')}>Before vs After</button>
      </div>

      {tab === 'workflow' && (
        <div className="stack" style={{ gap: 8 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)' }}>
            Click any step to navigate. Steps marked ✓ are available right now from the demo investigation.
            {completed.length === 0 && ' — Start a demo investigation from the Dashboard to see real data.'}
          </p>
          {DEMO_STEPS.map((step) => {
            const isDone = doneSteps.has(step.num);
            return (
              <div
                key={step.num}
                className="panel"
                style={{
                  padding: '12px 16px',
                  borderLeft: `3px solid ${isDone ? 'var(--accent)' : activeStep === step.num ? 'var(--info)' : 'var(--line)'}`,
                  cursor: step.action ? 'pointer' : 'default',
                  background: activeStep === step.num ? 'rgba(96,165,250,.05)' : undefined,
                }}
                onClick={() => setActiveStep(activeStep === step.num ? null : step.num)}
              >
                <div className="row" style={{ gap: 14 }}>
                  <span style={{
                    display: 'grid', placeItems: 'center', width: 26, height: 26,
                    borderRadius: 999, flex: 'none',
                    background: isDone ? 'var(--accent-soft)' : 'var(--panel-sunken)',
                    border: `1px solid ${isDone ? 'rgba(124,92,252,.4)' : 'var(--line)'}`,
                    color: isDone ? 'var(--accent-text)' : 'var(--subtle)',
                    fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)',
                  }}>
                    {isDone ? '✓' : step.num}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isDone ? 'var(--ink)' : 'var(--muted)' }}>
                        {step.label}
                      </span>
                      {!isDone && <span style={{ fontSize: 10, color: 'var(--subtle)', fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>PENDING</span>}
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--subtle)', lineHeight: 1.5 }}>{step.desc}</p>
                  </div>
                  {step.action && (
                    <Link
                      to={step.action}
                      className="btn btn-sm btn-link"
                      onClick={(e) => e.stopPropagation()}
                      style={{ flex: 'none', fontSize: 11 }}
                    >
                      Open →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'wow' && (
        <div className="stack" style={{ gap: 20 }}>
          <div className="card-grid-2">
            <Card title={obs ? 'Live Session Metrics' : 'Demo Metrics'} action={
              obs ? <Badge variant="success" dot>LIVE</Badge> : <Badge variant="warn">DEMO</Badge>
            }>
              {obs ? (
                <div className="stack" style={{ gap: 10 }}>
                  {[
                    { label: 'Total fix time (median)', value: `${(obs.medianTotalMs / 1000).toFixed(1)}s`, color: 'var(--accent)' },
                    { label: 'Files analyzed (median)', value: obs.medianFilesInspected, color: 'var(--info)' },
                    { label: 'Agents deployed', value: obs.medianAgentsUsed, color: 'var(--ink)' },
                    { label: 'Hypotheses generated', value: obs.medianHypothesesGenerated, color: 'var(--warn)' },
                    { label: 'Tests executed', value: obs.medianTestsExecuted, color: 'var(--accent)' },
                    { label: 'Manual approvals required', value: obs.medianManualSteps, color: 'var(--muted)' },
                  ].map((m) => (
                    <div key={m.label} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{m.label}</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  {[
                    { label: '1 issue', color: 'var(--ink)' },
                    { label: '6 agents in parallel', color: 'var(--info)' },
                    { label: '23 files analyzed', color: 'var(--info)' },
                    { label: '4 hypotheses generated', color: 'var(--warn)' },
                    { label: '1 root cause identified', color: 'var(--accent)' },
                    { label: '1 minimal patch (1 line)', color: 'var(--accent)' },
                    { label: '47 tests — 0 regressions', color: 'var(--accent)' },
                    { label: '1 PR generated', color: 'var(--accent)' },
                  ].map((m, i) => (
                    <div key={i} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{m.label.split(' ').slice(1).join(' ')}</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: m.color, fontFamily: 'var(--mono)' }}>
                        {m.label.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {!obs && (
                <p style={{ marginTop: 12, fontSize: 11, color: 'var(--subtle)' }}>
                  DEMO — numbers from a sample run. Run a demo investigation to see real measurements.
                </p>
              )}
            </Card>

            <Card title="The FixFlow Difference">
              <div className="stack" style={{ gap: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
                  FixFlow is not "another AI chatbot." It is an{' '}
                  <strong style={{ color: 'var(--ink)' }}>AI Software Engineering Operating System</strong>{' '}
                  that connects the complete engineering lifecycle through one agentic workflow.
                </p>
                <div style={{ padding: '12px 14px', background: 'var(--panel-sunken)', borderRadius: 10, border: '1px solid var(--line)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Connected lifecycle</p>
                  {['Incident → Evidence', 'Evidence → Agents', 'Agents → Root Cause', 'Root Cause → Minimal Patch', 'Patch → Human Approval', 'Approval → Implementation', 'Implementation → Tests', 'Tests → Regression', 'Regression → Review', 'Review → PR', 'PR → Release', 'Release → Monitoring', 'Monitoring → Postmortem', 'Postmortem → Knowledge'].map((step, i) => (
                    <p key={i} style={{ margin: 0, fontSize: 12, color: i % 2 === 0 ? 'var(--accent)' : 'var(--muted)', lineHeight: 1.8, fontFamily: 'var(--mono)', paddingLeft: i > 0 ? 12 : 0 }}>
                      {i > 0 ? '↓ ' : ''}{step}
                    </p>
                  ))}
                </div>
                <Link to="/investigations" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                  Start demo investigation →
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'comparison' && (
        <div className="card-grid-2">
          <Card title="Traditional Manual Workflow">
            <div className="stack" style={{ gap: 8 }}>
              {[
                'Receive bug report via Jira/Slack',
                'Manually gather logs from multiple sources',
                'Context-switch: code editor → logs → docs → browser',
                'Form hypothesis (often wrong first time)',
                'Manually trace call paths through codebase',
                'Write fix (often too broad)',
                'Run tests manually',
                'Hope for no regression',
                'Write PR description from memory',
                'Wait for manual code review',
                'Update documentation separately',
              ].map((s, i) => (
                <div key={i} className="row" style={{ gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 13 }}>✗</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--panel-sunken)', borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--subtle)' }}>
                  Duration: 45–120 minutes per bug. High context-switch cost. Regressions common.
                </p>
              </div>
            </div>
          </Card>
          <Card title="FixFlow AI Workflow">
            <div className="stack" style={{ gap: 8 }}>
              {pipeline?.stages?.map((s: any, i: number) => (
                <div key={i} className="row" style={{ gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: s.requiresHuman ? 'var(--warn)' : 'var(--accent)', fontWeight: 700, fontSize: 13 }}>
                    {s.requiresHuman ? '⏸' : '✓'}
                  </span>
                  <div>
                    <span style={{ fontSize: 13, color: s.requiresHuman ? 'var(--warn)' : 'var(--ink)', fontWeight: s.requiresHuman ? 700 : 400 }}>
                      {s.label}
                    </span>
                    {s.requiresHuman && (
                      <span style={{ fontSize: 11, color: 'var(--subtle)' }}> — human decision required</span>
                    )}
                  </div>
                </div>
              )) ?? (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Start the backend to see live pipeline stages.</p>
              )}
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--accent-soft)', borderRadius: 8, border: '1px solid rgba(183,243,107,.22)' }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--accent)' }}>
                  {obs
                    ? `Duration: ${(obs.medianTotalMs / 1000).toFixed(1)}s median (MEASURED). ${obs.medianManualSteps} manual step.`
                    : `${pipeline?.parallelAgentCount ?? 6} parallel agents. ${pipeline?.humanGateCount ?? 1} manual approval gate. Fully automated otherwise.`}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
