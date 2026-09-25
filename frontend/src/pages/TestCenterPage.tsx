import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

const TEST_SUITES = [
  {
    name: 'api.test.js',
    status: 'fail',
    total: 12,
    passed: 10,
    failed: 2,
    duration: '1.23s',
    failures: [
      'GET /api/orders - expected 200, got 500',
      'GET /api/orders - response body missing "orders" key',
    ],
  },
  {
    name: 'predictions.test.js',
    status: 'pass',
    total: 8,
    passed: 8,
    failed: 0,
    duration: '0.87s',
    failures: [],
  },
  {
    name: 'db.test.js',
    status: 'pass',
    total: 5,
    passed: 5,
    failed: 0,
    duration: '0.34s',
    failures: [],
  },
  {
    name: 'frontend.test.js',
    status: 'fail',
    total: 6,
    passed: 4,
    failed: 2,
    duration: '0.92s',
    failures: [
      'renderDetail() - TypeError: Cannot read properties of undefined',
      'renderBadge() - expected "NEGATIVE", got undefined',
    ],
  },
];

const COVERAGE = [
  { file: 'src/routes/orders.js', coverage: 62, lines: 34, coveredLines: 21 },
  { file: 'src/routes/predictions.js', coverage: 91, lines: 28, coveredLines: 25 },
  { file: 'web/app.js', coverage: 48, lines: 112, coveredLines: 54 },
  { file: 'src/db/setup.js', coverage: 85, lines: 20, coveredLines: 17 },
];

const SUGGESTED_TESTS = [
  {
    file: 'test/orders.error.test.js',
    name: 'GET /api/orders — handles SQL error',
    description: 'Mocks db.all() to throw an error and asserts 500 response with error JSON.',
    status: 'suggested',
  },
  {
    file: 'test/api-client.test.js',
    name: 'getPredictions() — handles 404',
    description: 'Mocks fetch() to return 404 and asserts error state is displayed.',
    status: 'suggested',
  },
  {
    file: 'test/regression/render-detail.test.js',
    name: 'renderDetail() — uses sentiment field',
    description: 'Asserts renderDetail() reads prediction.sentiment (not prediction.label) for the badge.',
    status: 'ai-generated',
  },
];

export function TestCenterPage() {
  const [tab, setTab] = useState<'suites' | 'coverage' | 'suggested'>('suites');
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalTests = TEST_SUITES.reduce((s, t) => s + t.total, 0);
  const totalPassed = TEST_SUITES.reduce((s, t) => s + t.passed, 0);
  const totalFailed = TEST_SUITES.reduce((s, t) => s + t.failed, 0);

  return (
    <div className="page-content stack" style={{ gap: 22 }}>
      {/* Metrics */}
      <div className="metric-grid">
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--ink)' }}>{totalTests}</p>
          <p className="metric-label">Total tests</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--accent)' }}>{totalPassed}</p>
          <p className="metric-label">Passing</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--danger)' }}>{totalFailed}</p>
          <p className="metric-label">Failing</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--warn)' }}>
            {Math.round(COVERAGE.reduce((s, c) => s + c.coverage, 0) / COVERAGE.length)}%
          </p>
          <p className="metric-label">Avg coverage</p>
        </div>
      </div>

      {totalFailed > 0 && (
        <div className="banner banner-bad">
          <div>
            <p className="banner-title" style={{ color: 'var(--danger)' }}>✗ {totalFailed} tests failing</p>
            <p className="banner-text">
              {TEST_SUITES.filter(s => s.status === 'fail').map(s => s.name).join(', ')} — these failures correlate with known bugs.
            </p>
          </div>
          <Link to="/investigations" className="btn btn-sm" style={{ flex: 'none' }}>See investigations</Link>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" role="tablist">
        {[
          { id: 'suites', label: 'Test Suites' },
          { id: 'coverage', label: 'Coverage' },
          { id: 'suggested', label: 'AI-Suggested Tests' },
        ].map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id as any} className="tab" onClick={() => setTab(t.id as any)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'suites' && (
        <div className="stack" style={{ gap: 12 }}>
          {TEST_SUITES.map((suite) => (
            <div key={suite.name} className="panel" style={{ overflow: 'hidden' }}>
              <button
                className="spread"
                style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => setExpanded(expanded === suite.name ? null : suite.name)}
              >
                <div className="row" style={{ gap: 12 }}>
                  <span style={{ fontSize: 18, color: suite.status === 'pass' ? 'var(--accent)' : 'var(--danger)' }}>
                    {suite.status === 'pass' ? '✓' : '✗'}
                  </span>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{suite.name}</span>
                  <Badge variant={suite.status === 'pass' ? 'success' : 'danger'} dot>{suite.status}</Badge>
                </div>
                <div className="row" style={{ gap: 14 }}>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{suite.passed} passed</span>
                  {suite.failed > 0 && <span style={{ fontSize: 12, color: 'var(--danger)', fontFamily: 'var(--mono)' }}>{suite.failed} failed</span>}
                  <span style={{ fontSize: 11, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>{suite.duration}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{expanded === suite.name ? '▲' : '▼'}</span>
                </div>
              </button>
              {expanded === suite.name && (
                <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--line)' }}>
                  <div className="meter" style={{ marginTop: 14, marginBottom: 10 }}>
                    <div className="meter-fill" style={{ width: `${(suite.passed / suite.total) * 100}%`, background: suite.status === 'pass' ? 'var(--accent)' : 'var(--danger)' }} />
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--muted)' }}>{suite.passed}/{suite.total} tests passing</p>
                  {suite.failures.length > 0 && (
                    <div>
                      <p style={{ margin: '12px 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Failures</p>
                      {suite.failures.map((f, i) => (
                        <div key={i} className="mono" style={{ padding: '6px 10px', background: 'var(--danger-soft)', borderRadius: 7, marginBottom: 4, fontSize: 12, color: 'var(--danger)' }}>
                          ✗ {f}
                        </div>
                      ))}
                      <Link to="/new" className="btn btn-sm" style={{ marginTop: 10 }}>Investigate failure</Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'coverage' && (
        <Card title="Coverage by File" flush>
          <table className="table">
            <thead>
              <tr><th>File</th><th>Coverage</th><th>Lines</th><th>Covered</th></tr>
            </thead>
            <tbody>
              {COVERAGE.sort((a, b) => a.coverage - b.coverage).map((c) => (
                <tr key={c.file}>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--ink)' }}>{c.file}</td>
                  <td style={{ minWidth: 160 }}>
                    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <div className="meter" style={{ flex: 1 }}>
                        <div
                          className="meter-fill"
                          style={{
                            width: `${c.coverage}%`,
                            background: c.coverage >= 80 ? 'var(--accent)' : c.coverage >= 60 ? 'var(--warn)' : 'var(--danger)'
                          }}
                        />
                      </div>
                      <span className="mono" style={{ fontSize: 12, color: c.coverage >= 80 ? 'var(--accent)' : c.coverage >= 60 ? 'var(--warn)' : 'var(--danger)', flex: 'none', width: 36, textAlign: 'right' }}>
                        {c.coverage}%
                      </span>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{c.lines}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{c.coveredLines}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'suggested' && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="banner banner-info">
            <div>
              <p className="banner-title" style={{ color: 'var(--info)' }}>AI-Generated Test Suggestions</p>
              <p className="banner-text">
                Based on failing tests, uncovered code paths, and known bugs, FixFlow AI suggests tests
                that would catch existing and regression bugs.
              </p>
            </div>
          </div>
          {SUGGESTED_TESTS.map((test, i) => (
            <Card key={i} title={test.name} action={
              <Badge variant={test.status === 'ai-generated' ? 'info' : 'muted'} dot>
                {test.status === 'ai-generated' ? 'AI-generated' : 'Suggested'}
              </Badge>
            }>
              <dl className="kv" style={{ rowGap: 8 }}>
                <dt>File</dt>
                <dd className="mono" style={{ fontSize: 12 }}>{test.file}</dd>
                <dt>Description</dt>
                <dd style={{ fontSize: 13, lineHeight: 1.6 }}>{test.description}</dd>
              </dl>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <button className="btn btn-sm btn-primary">Generate test</button>
                <button className="btn btn-sm btn-link">Dismiss</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
