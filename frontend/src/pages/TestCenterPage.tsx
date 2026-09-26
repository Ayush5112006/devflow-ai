import React, { useState } from 'react';
import { Card } from '../components/Card.js';

interface TestSuite {
  id: string;
  name: string;
  file: string;
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // ms
  coverage?: number;
  lastRun: string;
  status: 'pass' | 'fail' | 'running' | 'skip';
}

interface TestCase {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
}

const SUITES: TestSuite[] = [
  { id: 'ts1', name: 'Investigation Service', file: 'backend/test/investigationService.test.ts', tests: 23, passed: 23, failed: 0, skipped: 0, duration: 1842, coverage: 87, lastRun: '2 min ago', status: 'pass' },
  { id: 'ts2', name: 'Manager Agent', file: 'backend/test/managerAgent.test.ts', tests: 11, passed: 10, failed: 1, skipped: 0, duration: 3210, coverage: 72, lastRun: '2 min ago', status: 'fail' },
  { id: 'ts3', name: 'API Routes', file: 'backend/test/routes.test.ts', tests: 18, passed: 18, failed: 0, skipped: 0, duration: 980, coverage: 91, lastRun: '2 min ago', status: 'pass' },
  { id: 'ts4', name: 'Evidence Agent', file: 'backend/test/evidenceAgent.test.ts', tests: 7, passed: 6, failed: 0, skipped: 1, duration: 560, coverage: 68, lastRun: '2 min ago', status: 'pass' },
  { id: 'ts5', name: 'Git Utils', file: 'backend/test/gitUtils.test.ts', tests: 5, passed: 5, failed: 0, skipped: 0, duration: 240, coverage: 94, lastRun: '2 min ago', status: 'pass' },
  { id: 'ts6', name: 'Frontend Components', file: 'frontend/src/__tests__/components.test.tsx', tests: 14, passed: 11, failed: 2, skipped: 1, duration: 2100, coverage: 55, lastRun: '8 min ago', status: 'fail' },
];

const SUITE_CASES: Record<string, TestCase[]> = {
  ts2: [
    { name: 'should dispatch evidence agent in parallel', status: 'pass', duration: 210 },
    { name: 'should dispatch code agent in parallel', status: 'pass', duration: 185 },
    { name: 'should select agents based on issue category', status: 'pass', duration: 340 },
    { name: 'should recover gracefully from agent timeout', status: 'fail', duration: 1200, error: 'Timeout: agent did not respond within 1000ms. Expected graceful fallback, got UnhandledPromiseRejection.' },
    { name: 'should return combined results object', status: 'pass', duration: 95 },
    { name: 'should mark failed agents as skipped in report', status: 'pass', duration: 88 },
  ],
  ts6: [
    { name: 'renders StageStepper with correct active step', status: 'pass', duration: 45 },
    { name: 'renders Badge with severity styles', status: 'pass', duration: 32 },
    { name: 'CommandPalette opens on Ctrl+K', status: 'pass', duration: 110 },
    { name: 'InvestigationTimeline renders events in order', status: 'fail', duration: 280, error: 'Expected 3 timeline items, received 2. Component may not render pending events.' },
    { name: 'ActivityLog streams SSE events', status: 'fail', duration: 520, error: 'Cannot mock EventSource in jsdom environment. Missing polyfill.' },
    { name: 'Card renders with title and children', status: 'pass', duration: 28 },
    { name: 'PipelineDiagram shows RUNNING state', status: 'skip', duration: 0 },
  ],
};

function statusDot(s: TestSuite['status']) {
  const map = { pass: 'var(--success)', fail: 'var(--danger)', running: 'var(--info)', skip: 'var(--muted)' };
  return map[s];
}

function statusLabel(s: TestSuite['status']) {
  return { pass: 'PASS', fail: 'FAIL', running: 'RUNNING', skip: 'SKIP' }[s];
}

function coverageColor(n: number) {
  if (n >= 80) return 'var(--success)';
  if (n >= 60) return 'var(--warn)';
  return 'var(--danger)';
}

export function TestCenterPage() {
  const [tab, setTab] = useState<'suites' | 'coverage' | 'history'>('suites');
  const [selected, setSelected] = useState<TestSuite | null>(null);
  const [running, setRunning] = useState(false);

  const totalTests = SUITES.reduce((a, s) => a + s.tests, 0);
  const totalPassed = SUITES.reduce((a, s) => a + s.passed, 0);
  const totalFailed = SUITES.reduce((a, s) => a + s.failed, 0);
  const totalDuration = SUITES.reduce((a, s) => a + s.duration, 0);
  const avgCoverage = Math.round(SUITES.reduce((a, s) => a + (s.coverage ?? 0), 0) / SUITES.length);

  function handleRunAll() {
    setRunning(true);
    setTimeout(() => setRunning(false), 3200);
  }

  const cases = selected ? (SUITE_CASES[selected.id] ?? []) : [];

  return (
    <div className="page-content stack-lg">
      {/* Header */}
      <div className="spread">
        <div>
          <h1 className="page-title">Test Center</h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            Test suite results and coverage for the InsightBoard project.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="demo-notice">DEMO DATA</span>
          <button className="btn btn-primary btn-sm" onClick={handleRunAll} disabled={running}>
            {running ? '⟳ Running…' : '▶ Run All Tests'}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="metric-grid">
        {[
          { label: 'Total Tests', value: totalTests },
          { label: 'Passing', value: totalPassed, color: 'var(--success)' },
          { label: 'Failing', value: totalFailed, color: totalFailed > 0 ? 'var(--danger)' : 'var(--ink)' },
          { label: 'Avg Coverage', value: `${avgCoverage}%`, color: coverageColor(avgCoverage) },
        ].map(m => (
          <div key={m.label} className="metric">
            <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Overall pass bar */}
      <div className="panel" style={{ padding: '14px 16px' }}>
        <div className="spread" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Pass Rate</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: totalFailed > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {totalPassed}/{totalTests} — {Math.round((totalPassed / totalTests) * 100)}%
          </span>
        </div>
        <div className="meter">
          <div className="meter-fill success" style={{ width: `${(totalPassed / totalTests) * 100}%` }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--subtle)' }}>
          Duration: {(totalDuration / 1000).toFixed(1)}s total · {SUITES.length} suites
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="tabs">
          {(['suites', 'coverage', 'history'] as const).map(t => (
            <button key={t} className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          {tab === 'suites' && (
            <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) 380px' : '1fr', gap: 16 }}>
              {/* Suite list */}
              <div className="panel panel-body-flush">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Suite</th>
                      <th>Status</th>
                      <th>Tests</th>
                      <th>Coverage</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SUITES.map(s => (
                      <tr
                        key={s.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelected(selected?.id === s.id ? null : s)}
                      >
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>{s.name}</div>
                          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--subtle)', marginTop: 2 }}>{s.file}</div>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: statusDot(s.status) }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusDot(s.status), display: 'inline-block' }} />
                            {statusLabel(s.status)}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--ink)' }}>{s.passed}</span>
                          <span style={{ color: 'var(--subtle)' }}>/{s.tests}</span>
                          {s.failed > 0 && <span style={{ color: 'var(--danger)', marginLeft: 6 }}>✕{s.failed}</span>}
                          {s.skipped > 0 && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>⊘{s.skipped}</span>}
                        </td>
                        <td>
                          {s.coverage != null && (
                            <span style={{ color: coverageColor(s.coverage), fontFamily: 'var(--mono)', fontSize: 12 }}>
                              {s.coverage}%
                            </span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                          {s.duration < 1000 ? `${s.duration}ms` : `${(s.duration / 1000).toFixed(1)}s`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Test case detail */}
              {selected && (
                <div className="panel stack" style={{ padding: 18, gap: 14 }}>
                  <div className="spread">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{selected.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 2, fontFamily: 'var(--mono)' }}>{selected.file}</div>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>✕</button>
                  </div>

                  {cases.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13 }}>
                      {selected.passed}/{selected.tests} tests passing. No individual test data available in demo.
                    </p>
                  ) : (
                    <div className="stack-sm">
                      {cases.map((c, i) => (
                        <div key={i} style={{ padding: '10px 12px', background: 'var(--panel-sunken)', borderRadius: 8, border: `1px solid ${c.status === 'fail' ? 'rgba(239,68,68,.25)' : 'var(--line)'}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: c.status === 'pass' ? 'var(--success)' : c.status === 'fail' ? 'var(--danger)' : 'var(--muted)' }}>
                              {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✕' : '⊘'}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>{c.name}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--subtle)' }}>
                              {c.duration > 0 ? `${c.duration}ms` : '-'}
                            </span>
                          </div>
                          {c.error && (
                            <pre className="code" style={{ marginTop: 8, fontSize: 11, color: '#fca5a5', whiteSpace: 'pre-wrap' }}>
                              {c.error}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'coverage' && (
            <div className="stack">
              <div className="panel" style={{ padding: 18 }}>
                <p className="panel-title" style={{ marginBottom: 14 }}>Coverage by Module</p>
                <div className="stack">
                  {[
                    { module: 'investigationService', pct: 87, lines: '412/474' },
                    { module: 'managerAgent', pct: 72, lines: '198/275' },
                    { module: 'api/routes', pct: 91, lines: '182/200' },
                    { module: 'evidenceAgent', pct: 68, lines: '95/140' },
                    { module: 'gitUtils', pct: 94, lines: '78/83' },
                    { module: 'pipelineFacts', pct: 55, lines: '44/80' },
                    { module: 'demoCatalog', pct: 100, lines: '45/45' },
                    { module: 'analysisEngine', pct: 42, lines: '63/150' },
                  ].map(r => (
                    <div key={r.module}>
                      <div className="spread" style={{ marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)' }}>{r.module}</span>
                        <span style={{ fontSize: 12, color: coverageColor(r.pct), fontFamily: 'var(--mono)' }}>{r.pct}% ({r.lines})</span>
                      </div>
                      <div className="meter">
                        <div
                          className={`meter-fill ${r.pct >= 80 ? 'success' : r.pct >= 60 ? 'warn' : 'danger'}`}
                          style={{ width: `${r.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="alert alert-info" style={{ fontSize: 12 }}>
                Coverage thresholds: branches &gt;= 60%, lines &gt;= 70%, functions &gt;= 75%. Current project average: {avgCoverage}%.
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="panel panel-body-flush">
              <table className="table">
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Trigger</th>
                    <th>Pass Rate</th>
                    <th>Duration</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { run: '#47', trigger: 'Manual', pass: 95, total: 100, dur: '8.3s', ts: '2 min ago' },
                    { run: '#46', trigger: 'Pre-merge', pass: 93, total: 100, dur: '9.1s', ts: '1 hour ago' },
                    { run: '#45', trigger: 'Manual', pass: 88, total: 100, dur: '8.7s', ts: '3 hours ago' },
                    { run: '#44', trigger: 'Pre-merge', pass: 90, total: 100, dur: '8.9s', ts: '1 day ago' },
                    { run: '#43', trigger: 'Scheduled', pass: 100, total: 100, dur: '7.8s', ts: '2 days ago' },
                  ].map(r => (
                    <tr key={r.run}>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ink)' }}>{r.run}</td>
                      <td>{r.trigger}</td>
                      <td>
                        <span style={{ color: r.pass === r.total ? 'var(--success)' : 'var(--warn)' }}>
                          {r.pass}/{r.total} ({Math.round((r.pass / r.total) * 100)}%)
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.dur}</td>
                      <td>{r.ts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
