import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

type ReviewTarget = 'changes' | 'file' | 'branch' | 'commit' | 'pr';

const REVIEW_CATEGORIES = ['Correctness', 'Bugs', 'Security', 'Performance', 'Maintainability', 'Testing'];

const DEMO_FINDINGS: {
  file: string; line: number; category: string;
  severity: string; message: string; suggestion: string;
}[] = [
  {
    file: 'src/routes/orders.js',
    line: 12,
    category: 'Bugs',
    severity: 'critical',
    message: 'SQL query references non-existent column `o.customer_name`. The actual column is `o.customer`.',
    suggestion: 'Change `o.customer_name` to `o.customer` in the SELECT and JOIN clauses.',
  },
  {
    file: 'web/api-client.js',
    line: 3,
    category: 'Bugs',
    severity: 'critical',
    message: 'API base URL reads from `import.meta.env.VITE_API_BASE` but the environment variable is declared as `VITE_API_URL`. Results in undefined base path.',
    suggestion: 'Replace `VITE_API_BASE` with `VITE_API_URL` to match the .env declaration.',
  },
  {
    file: 'web/app.js',
    line: 88,
    category: 'Correctness',
    severity: 'high',
    message: '`renderDetail()` reads `prediction.label` but the API response uses `prediction.sentiment`. This causes the badge to show empty.',
    suggestion: 'Update the field access to use `prediction.sentiment` or normalise the API response at the client boundary.',
  },
  {
    file: 'src/routes/orders.js',
    line: 8,
    category: 'Security',
    severity: 'medium',
    message: 'User-supplied `limit` parameter is interpolated directly into the SQL query without bound parameterisation.',
    suggestion: 'Use parameterised queries: `db.all(sql, [limit, offset], callback)`.',
  },
  {
    file: 'src/db/setup.js',
    line: 22,
    category: 'Performance',
    severity: 'low',
    message: 'No index on `predictions.created_at` — the dashboard sort query performs a full table scan.',
    suggestion: 'Add `CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions(created_at DESC)`.',
  },
  {
    file: 'test/api.test.js',
    line: 1,
    category: 'Testing',
    severity: 'medium',
    message: 'No test covers the orders endpoint error path. The SQL failure goes undetected by the test suite.',
    suggestion: 'Add a test that mocks the database to return an error and asserts the 500 status code.',
  },
];

const DIFF_PREVIEW = `--- a/src/routes/orders.js
+++ b/src/routes/orders.js
@@ -10,7 +10,7 @@
 router.get('/orders', (req, res) => {
   const { limit = 20, offset = 0 } = req.query;
   db.all(
-    'SELECT o.id, o.customer_name, o.amount FROM orders o',
+    'SELECT o.id, o.customer, o.amount FROM orders o',
     [limit, offset],
     (err, rows) => {
       if (err) return res.status(500).json({ error: err.message });`;

export function CodeReviewPage() {
  const [target, setTarget] = useState<ReviewTarget>('changes');
  const [filterCat, setFilterCat] = useState<string>('All');
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(true); // show demo results by default

  const filtered = filterCat === 'All' ? DEMO_FINDINGS : DEMO_FINDINGS.filter((f) => f.category === filterCat);

  function runReview() {
    setRunning(true);
    setTimeout(() => { setRunning(false); setRan(true); }, 1800);
  }

  const counts = REVIEW_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = DEMO_FINDINGS.filter((f) => f.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="page-content stack" style={{ gap: 22 }}>
      {/* Target selector */}
      <Card title="Review Target">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {(['changes', 'file', 'branch', 'commit', 'pr'] as ReviewTarget[]).map((t) => (
            <button
              key={t}
              className={`btn ${target === t ? 'btn-primary' : ''}`}
              onClick={() => setTarget(t)}
            >
              {t === 'changes' && '📝 Current Changes'}
              {t === 'file' && '📄 Selected File'}
              {t === 'branch' && '🌿 Branch Diff'}
              {t === 'commit' && '📌 Commit'}
              {t === 'pr' && '🔀 Pull Request'}
            </button>
          ))}
          <button
            className="btn btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={runReview}
            disabled={running}
          >
            {running ? '⏳ Analyzing…' : '▶ Run Review'}
          </button>
        </div>
      </Card>

      {ran && (
        <>
          {/* Summary metrics */}
          <div className="metric-grid">
            <div className="metric">
              <p className="metric-value" style={{ color: 'var(--danger)' }}>2</p>
              <p className="metric-label">Critical</p>
            </div>
            <div className="metric">
              <p className="metric-value" style={{ color: 'var(--danger)' }}>1</p>
              <p className="metric-label">High</p>
            </div>
            <div className="metric">
              <p className="metric-value" style={{ color: 'var(--warn)' }}>2</p>
              <p className="metric-label">Medium</p>
            </div>
            <div className="metric">
              <p className="metric-value" style={{ color: 'var(--muted)' }}>1</p>
              <p className="metric-label">Low</p>
            </div>
          </div>

          {/* Category filter */}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${filterCat === 'All' ? 'btn-primary' : ''}`}
              onClick={() => setFilterCat('All')}
            >
              All ({DEMO_FINDINGS.length})
            </button>
            {REVIEW_CATEGORIES.filter((c) => counts[c] > 0).map((cat) => (
              <button
                key={cat}
                className={`btn btn-sm ${filterCat === cat ? 'btn-primary' : ''}`}
                onClick={() => setFilterCat(cat)}
              >
                {cat} ({counts[cat]})
              </button>
            ))}
          </div>

          {/* Findings */}
          <div className="stack" style={{ gap: 10 }}>
            {filtered.map((finding, i) => (
              <div key={i} className={`review-finding review-finding-${finding.severity}`}>
                <div className="spread">
                  <div className="row" style={{ gap: 8 }}>
                    <Badge variant={finding.severity === 'critical' || finding.severity === 'high' ? 'danger' : finding.severity === 'medium' ? 'warn' : 'muted'} dot>
                      {finding.severity}
                    </Badge>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                      {finding.category}
                    </span>
                  </div>
                  <span className="chip mono" style={{ fontSize: 10 }}>{finding.file}:{finding.line}</span>
                </div>
                <p style={{ margin: '10px 0 8px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{finding.message}</p>
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(183,243,107,0.06)', border: '1px solid rgba(183,243,107,0.18)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Suggestion</span>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{finding.suggestion}</p>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 10 }}>
                  <Link to="/new" className="btn btn-sm">Investigate</Link>
                  <button className="btn btn-sm btn-link">Accept suggestion</button>
                  <button className="btn btn-sm btn-link">Dismiss</button>
                </div>
              </div>
            ))}
          </div>

          {/* Diff preview */}
          <Card title="Diff Preview — orders.js" action={<Badge variant="success" dot>Auto-generated fix</Badge>}>
            <pre className="code" style={{ fontSize: 11, lineHeight: 1.7 }}>
              {DIFF_PREVIEW.split('\n').map((line, i) => (
                <span
                  key={i}
                  style={{
                    display: 'block',
                    color: line.startsWith('+') ? 'var(--accent)' : line.startsWith('-') ? 'var(--danger)' : line.startsWith('@@') ? 'var(--info)' : undefined,
                  }}
                >
                  {line}
                </span>
              ))}
            </pre>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn btn-sm btn-primary">Apply fix</button>
              <button className="btn btn-sm">Create PR</button>
              <Link to="/new" className="btn btn-sm btn-link">Full investigation</Link>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
