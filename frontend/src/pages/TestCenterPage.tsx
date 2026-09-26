import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';
import type { VerificationResult, RegressionResult, CheckResult, Investigation } from '../types/index.js';

interface TestSuite {
  id: string;
  name: string;
  file: string;
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
  lastRun: string;
  status: 'pass' | 'fail' | 'running' | 'skip';
}

/* ── Demo fallback data (clearly labeled) ── */
const DEMO_SUITES: TestSuite[] = [
  { id: 'ts1', name: 'Investigation Service', file: 'backend/test/investigationService.test.ts', tests: 23, passed: 23, failed: 0, skipped: 0, duration: 1842, coverage: 87, lastRun: 'demo', status: 'pass' },
  { id: 'ts2', name: 'Manager Agent', file: 'backend/test/managerAgent.test.ts', tests: 11, passed: 10, failed: 1, skipped: 0, duration: 3210, coverage: 72, lastRun: 'demo', status: 'fail' },
  { id: 'ts3', name: 'API Routes', file: 'backend/test/routes.test.ts', tests: 18, passed: 18, failed: 0, skipped: 0, duration: 980, coverage: 91, lastRun: 'demo', status: 'pass' },
  { id: 'ts4', name: 'Evidence Agent', file: 'backend/test/evidenceAgent.test.ts', tests: 7, passed: 6, failed: 0, skipped: 1, duration: 560, coverage: 68, lastRun: 'demo', status: 'pass' },
  { id: 'ts5', name: 'Git Utils', file: 'backend/test/gitUtils.test.ts', tests: 5, passed: 5, failed: 0, skipped: 0, duration: 240, coverage: 94, lastRun: 'demo', status: 'pass' },
  { id: 'ts6', name: 'Frontend Components', file: 'frontend/src/__tests__/components.test.tsx', tests: 14, passed: 11, failed: 2, skipped: 1, duration: 2100, coverage: 55, lastRun: 'demo', status: 'fail' },
];

function statusDot(s: TestSuite['status']) {
  return { pass: 'var(--success)', fail: 'var(--danger)', running: 'var(--info)', skip: 'var(--muted)' }[s];
}

function statusLabel(s: TestSuite['status']) {
  return { pass: 'PASS', fail: 'FAIL', running: 'RUNNING', skip: 'SKIP' }[s];
}

function coverageColor(n: number) {
  if (n >= 80) return 'var(--success)';
  if (n >= 60) return 'var(--warn)';
  return 'var(--danger)';
}

/** Convert a CheckResult from a real investigation into our TestSuite shape */
function checkToSuite(c: CheckResult, runAt: string): TestSuite {
  const isPassed = c.status === 'pass';
  const isFailed = c.status === 'fail';
  return {
    id: c.id,
    name: c.name,
    file: c.command,
    tests: c.totalTests ?? (isPassed ? c.passedTests ?? 1 : 1),
    passed: c.passedTests ?? (isPassed ? c.totalTests ?? 1 : 0),
    failed: isFailed ? c.failedTests.length || 1 : 0,
    skipped: c.status === 'skipped' ? 1 : 0,
    duration: c.durationMs,
    lastRun: runAt,
    status: isPassed ? 'pass' : isFailed ? 'fail' : c.status === 'skipped' ? 'skip' : 'skip',
  };
}

export function TestCenterPage() {
  const [tab, setTab] = useState<'suites' | 'coverage' | 'history'>('suites');
  const [selected, setSelected] = useState<TestSuite | null>(null);
  const [running, setRunning] = useState(false);

  /* Live data from investigations */
  const [liveInvestigations, setLiveInvestigations] = useState<Pick<Investigation, 'id' | 'verification' | 'regression' | 'updatedAt' | 'bug'>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listInvestigations()
      .then(({ investigations }) => {
        // Fetch full details for completed ones to get verification/regression
        const completed = investigations.filter((i: any) => i.status === 'completed');
        if (completed.length === 0) { setLoading(false); return; }
        Promise.all(
          completed.slice(0, 5).map((inv: any) =>
            api.getInvestigation(inv.id).then(({ investigation }) => investigation).catch(() => null)
          )
        ).then((results) => {
          const valid = results.filter(Boolean) as Investigation[];
          setLiveInvestigations(valid);
          setLoading(false);
        });
      })
      .catch(() => setLoading(false));
  }, []);

  /* Build live suites from verification results */
  const liveSuites: TestSuite[] = [];
  liveInvestigations.forEach((inv) => {
    if (inv.verification?.checks) {
      inv.verification.checks.forEach((c) => {
        liveSuites.push(checkToSuite(c, inv.updatedAt));
      });
    }
    if (inv.regression?.executed) {
      inv.regression.executed.forEach((c) => {
        const suite = checkToSuite(c, inv.updatedAt);
        suite.name = `[Regression] ${suite.name}`;
        liveSuites.push(suite);
      });
    }
  });

  const isLive = liveSuites.length > 0;
  const suites = isLive ? liveSuites : DEMO_SUITES;

  const totalTests = suites.reduce((a, s) => a + s.tests, 0);
  const totalPassed = suites.reduce((a, s) => a + s.passed, 0);
  const totalFailed = suites.reduce((a, s) => a + s.failed, 0);
  const totalDuration = suites.reduce((a, s) => a + s.duration, 0);
  const avgCoverage = Math.round(
    suites.filter(s => s.coverage != null).reduce((a, s) => a + (s.coverage ?? 0), 0) /
    (suites.filter(s => s.coverage != null).length || 1)
  );

  function handleRunAll() {
    setRunning(true);
    setTimeout(() => setRunning(false), 3200);
  }

  return (
    <div className="page-content stack-lg">
      {/* Header */}
      <div className="spread">
        <div>
          <h1 className="page-title">Test Center</h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            {isLive
              ? `Live results from ${liveInvestigations.length} completed investigation${liveInvestigations.length !== 1 ? 's' : ''}.`
              : 'Test suite results for the InsightBoard demo project.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isLive
            ? <Badge variant="success" dot>LIVE</Badge>
            : <span className="demo-notice">DEMO DATA</span>}
          <button className="btn btn-primary btn-sm" onClick={handleRunAll} disabled={running}>
            {running ? '⟳ Running…' : '▶ Run All Tests'}
          </button>
        </div>
      </div>

      {/* Live data banner */}
      {isLive && (
        <div className="banner banner-ok" style={{ borderColor: 'var(--accent)', background: 'rgba(124,92,252,.06)' }}>
          <div>
            <p className="banner-title" style={{ color: 'var(--accent)' }}>
              ✓ Real test results from {liveInvestigations.length} completed investigation{liveInvestigations.length !== 1 ? 's' : ''}
            </p>
            <p className="banner-text">
              Showing actual verification and regression check results. Run a new investigation to update.
            </p>
          </div>
          <Link to="/investigations" className="btn btn-sm" style={{ flex: 'none' }}>
            View investigations →
          </Link>
        </div>
      )}

      {!isLive && !loading && (
        <div className="banner banner-info">
          <div>
            <p className="banner-title" style={{ color: 'var(--info)' }}>No real test results yet</p>
            <p className="banner-text">
              Complete an investigation to see live verification and regression test results here.
              Demo data shown below.
            </p>
          </div>
          <Link to="/investigations" className="btn btn-sm btn-primary" style={{ flex: 'none' }}>
            Run demo investigation →
          </Link>
        </div>
      )}

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
            {totalPassed}/{totalTests} — {totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%
          </span>
        </div>
        <div className="meter">
          <div className="meter-fill success" style={{ width: `${totalTests > 0 ? (totalPassed / totalTests) * 100 : 0}%` }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--subtle)' }}>
          Duration: {(totalDuration / 1000).toFixed(1)}s total · {suites.length} suite{suites.length !== 1 ? 's' : ''}
          {isLive ? ' · MEASURED from investigation runs' : ' · DEMO DATA'}
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
                    {suites.map(s => (
                      <tr
                        key={s.id}
                        style={{ cursor: 'pointer', background: selected?.id === s.id ? 'rgba(124,92,252,.05)' : undefined }}
                        onClick={() => setSelected(selected?.id === s.id ? null : s)}
                      >
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>{s.name}</div>
                          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--subtle)', marginTop: 2 }}>
                            {s.file}
                          </div>
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
                          {s.coverage != null ? (
                            <span style={{ color: coverageColor(s.coverage), fontFamily: 'var(--mono)', fontSize: 12 }}>
                              {s.coverage}%
                            </span>
                          ) : <span style={{ color: 'var(--subtle)', fontSize: 11 }}>—</span>}
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
                  <dl className="kv" style={{ rowGap: 8 }}>
                    <dt>Status</dt>
                    <dd>
                      <span style={{ color: statusDot(selected.status), fontWeight: 700, fontSize: 12 }}>
                        {statusLabel(selected.status)}
                      </span>
                    </dd>
                    <dt>Tests</dt><dd>{selected.passed}/{selected.tests} passing</dd>
                    {selected.failed > 0 && <><dt>Failures</dt><dd style={{ color: 'var(--danger)' }}>{selected.failed}</dd></>}
                    <dt>Duration</dt>
                    <dd className="mono" style={{ fontSize: 12 }}>
                      {selected.duration < 1000 ? `${selected.duration}ms` : `${(selected.duration / 1000).toFixed(1)}s`}
                    </dd>
                    {selected.coverage != null && (
                      <><dt>Coverage</dt><dd style={{ color: coverageColor(selected.coverage) }}>{selected.coverage}%</dd></>
                    )}
                    <dt>Last run</dt><dd>{selected.lastRun === 'demo' ? 'Demo data' : new Date(selected.lastRun).toLocaleString()}</dd>
                  </dl>
                  <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
                    {selected.passed}/{selected.tests} tests passing.
                    {isLive
                      ? ' Results from real investigation verification run.'
                      : ' No individual test data available in demo.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'coverage' && (
            <div className="stack">
              <div className="panel" style={{ padding: 18 }}>
                <p className="panel-title" style={{ marginBottom: 14 }}>
                  Coverage by Module
                  {!isLive && <span className="demo-notice" style={{ marginLeft: 10 }}>DEMO DATA</span>}
                </p>
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
                Coverage thresholds: branches &gt;= 60%, lines &gt;= 70%, functions &gt;= 75%. Project average: {avgCoverage}%.
                {!isLive && ' Coverage data shown is DEMO — run an investigation to get real coverage.'}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div>
              {isLive ? (
                <div className="panel panel-body-flush">
                  <table className="table">
                    <thead>
                      <tr><th>Investigation</th><th>Bug</th><th>Pass Rate</th><th>Duration</th><th>When</th></tr>
                    </thead>
                    <tbody>
                      {liveInvestigations.map(inv => {
                        const v = inv.verification;
                        const checks = v?.checks ?? [];
                        const pass = checks.filter(c => c.status === 'pass').length;
                        const total = checks.length;
                        const dur = checks.reduce((a, c) => a + c.durationMs, 0);
                        return (
                          <tr key={inv.id}>
                            <td>
                              <Link to={`/investigations/${inv.id}`} style={{ color: 'var(--accent)', fontSize: 12, fontFamily: 'var(--mono)' }}>
                                {inv.id?.slice(0, 8)}
                              </Link>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--ink)' }}>{(inv as any).bug?.title?.slice(0, 40)}</td>
                            <td>
                              <span style={{ color: pass === total ? 'var(--success)' : 'var(--warn)', fontSize: 12 }}>
                                {pass}/{total} ({total > 0 ? Math.round((pass / total) * 100) : 0}%)
                              </span>
                            </td>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                              {dur < 1000 ? `${dur}ms` : `${(dur / 1000).toFixed(1)}s`}
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--subtle)' }}>
                              {new Date(inv.updatedAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="panel panel-body-flush">
                  <table className="table">
                    <thead>
                      <tr><th>Run</th><th>Trigger</th><th>Pass Rate</th><th>Duration</th><th>Timestamp</th></tr>
                    </thead>
                    <tbody>
                      {[
                        { run: '#47', trigger: 'Manual', pass: 95, total: 100, dur: '8.3s', ts: '2 min ago' },
                        { run: '#46', trigger: 'Pre-merge', pass: 93, total: 100, dur: '9.1s', ts: '1 hour ago' },
                        { run: '#45', trigger: 'Manual', pass: 88, total: 100, dur: '8.7s', ts: '3 hours ago' },
                        { run: '#44', trigger: 'Pre-merge', pass: 90, total: 100, dur: '8.9s', ts: '1 day ago' },
                      ].map(r => (
                        <tr key={r.run}>
                          <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ink)' }}>{r.run}</td>
                          <td>{r.trigger}</td>
                          <td>
                            <span style={{ color: r.pass === r.total ? 'var(--success)' : 'var(--warn)', fontSize: 12 }}>
                              {r.pass}/{r.total} ({Math.round((r.pass / r.total) * 100)}%)
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.dur}</td>
                          <td style={{ fontSize: 11, color: 'var(--subtle)' }}>{r.ts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ padding: '8px 16px 12px', fontSize: 11, color: 'var(--subtle)', margin: 0 }}>
                    DEMO DATA — complete investigations to populate real run history.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
