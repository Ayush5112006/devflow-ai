import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card.js';

interface ReviewComment {
  id: string;
  file: string;
  line: number;
  category: 'bug' | 'security' | 'performance' | 'style' | 'test' | 'maintainability';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'suggestion';
  comment: string;
  suggestion?: string;
}

const DEMO_DIFF = `--- a/src/routes/predictions.js
+++ b/src/routes/predictions.js
@@ -15,8 +15,12 @@ router.post('/predict', async (req, res) => {
   try {
-    const result = await mlClient.predict(req.body.text);
-    res.json({ prediction: result.label, confidence: result.confidence });
+    const { text } = req.body;
+    if (!text || text.length > 10000) {
+      return res.status(400).json({ error: 'Invalid input' });
+    }
+    const result = await mlClient.predict(text);
+    res.json({ label: result.label, confidence: result.confidence });
   } catch (err) {
-    res.status(500).json({ error: err.message });
+    console.error('[predict] error:', err);
+    res.status(500).json({ error: 'Prediction failed' });
   }
 });`;

const REVIEW_COMMENTS: ReviewComment[] = [
  {
    id: 'rv-1',
    file: 'src/routes/predictions.js',
    line: 17,
    category: 'bug',
    severity: 'critical',
    comment: 'API contract changed: response field renamed from `prediction` to `label`. This will break all existing frontend consumers that read `result.prediction`.',
    suggestion: 'Keep the response field as `prediction` OR update all frontend consumers atomically in the same PR. Do not rename silently.',
  },
  {
    id: 'rv-2',
    file: 'src/routes/predictions.js',
    line: 19,
    category: 'security',
    severity: 'high',
    comment: 'Missing input sanitization. Length check added but no content validation. Malicious payloads (XSS strings, SQL fragments) could still reach the ML model.',
    suggestion: 'Add: text = text.trim(); and validate it contains no HTML/script tags before forwarding to the model.',
  },
  {
    id: 'rv-3',
    file: 'src/routes/predictions.js',
    line: 22,
    category: 'test',
    severity: 'medium',
    comment: 'No test covers the new validation branch (lines 17–20). The 400 response path is untested.',
    suggestion: 'Add test cases: empty string → 400, string > 10000 chars → 400, valid string → 200.',
  },
  {
    id: 'rv-4',
    file: 'src/routes/predictions.js',
    line: 24,
    category: 'maintainability',
    severity: 'suggestion',
    comment: 'Error handling is improved but error logging uses `console.error` directly. Consider using the project logger for consistent log format.',
    suggestion: 'Replace `console.error(...)` with `logger.error(...)` matching the logging convention in other routes.',
  },
];

const CATEGORY_COLOR: Record<ReviewComment['category'], string> = {
  bug: 'badge-danger',
  security: 'badge-critical',
  performance: 'badge-warn',
  style: 'badge-muted',
  test: 'badge-info',
  maintainability: 'badge-muted',
};

const SEV_COLOR: Record<ReviewComment['severity'], string> = {
  critical: 'badge-critical',
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
  suggestion: 'badge-muted',
};

export function CodeReviewPage() {
  const [tab, setTab] = useState<'diff' | 'comments' | 'checklist'>('comments');
  const [selectedComment, setSelectedComment] = useState<ReviewComment | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(true);

  function handleAnalyze() {
    setAnalyzing(true);
    setAnalyzed(false);
    setTimeout(() => {
      setAnalyzing(false);
      setAnalyzed(true);
    }, 2400);
  }

  const criticalCount = REVIEW_COMMENTS.filter(c => c.severity === 'critical' || c.severity === 'high').length;

  const CHECKLIST_ITEMS = [
    { label: 'No breaking API contract changes', pass: false, note: 'response.prediction renamed to response.label' },
    { label: 'Input validation present', pass: true, note: 'Length check added' },
    { label: 'Error messages sanitized (no stack traces in response)', pass: true, note: 'Generic error message returned' },
    { label: 'New code paths covered by tests', pass: false, note: 'Validation branch has no test coverage' },
    { label: 'No hardcoded secrets or credentials', pass: true, note: 'None found' },
    { label: 'Consistent coding style', pass: false, note: 'console.error used instead of logger' },
    { label: 'All dependencies declared', pass: true, note: 'No new dependencies added' },
    { label: 'Change description present in PR', pass: true, note: 'PR description provided' },
  ];

  return (
    <div className="page-content stack-lg">
      {/* Header */}
      <div className="spread">
        <div>
          <h1 className="page-title">Code Review</h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            AI-assisted review for recent changes to InsightBoard.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="demo-notice">DEMO DATA</span>
          <button className="btn btn-primary btn-sm" onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? '⟳ Analyzing…' : '↻ Re-analyze'}
          </button>
        </div>
      </div>

      {/* Change being reviewed */}
      <div className="panel" style={{ padding: '14px 16px' }}>
        <div className="spread">
          <div>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14 }}>
              fix: rename prediction field + add input validation
            </div>
            <div style={{ fontSize: 12, color: 'var(--subtle)', marginTop: 3 }}>
              1 file changed · +8 / -3 lines · src/routes/predictions.js
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {criticalCount > 0 && (
              <span className="badge badge-danger">{criticalCount} critical</span>
            )}
            <span className="badge badge-warn">{REVIEW_COMMENTS.length} comments</span>
          </div>
        </div>
      </div>

      {/* Summary metrics */}
      {analyzed && (
        <div className="metric-grid">
          {[
            { label: 'Critical / High', value: REVIEW_COMMENTS.filter(c => ['critical','high'].includes(c.severity)).length, color: 'var(--danger)' },
            { label: 'Medium', value: REVIEW_COMMENTS.filter(c => c.severity === 'medium').length, color: 'var(--warn)' },
            { label: 'Suggestions', value: REVIEW_COMMENTS.filter(c => c.severity === 'suggestion').length, color: 'var(--muted)' },
            { label: 'Checklist Pass', value: `${CHECKLIST_ITEMS.filter(i => i.pass).length}/${CHECKLIST_ITEMS.length}`, color: 'var(--ink)' },
          ].map(m => (
            <div key={m.label} className="metric">
              <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {criticalCount > 0 && analyzed && (
        <div className="banner banner-bad">
          <div>
            <div className="banner-title">
              <span style={{ color: 'var(--danger)' }}>✕</span>
              Review blocked — {criticalCount} critical issue{criticalCount !== 1 ? 's' : ''} must be resolved
            </div>
            <p className="banner-text">
              API contract change (prediction → label) will break existing frontend code.
              This change should not be merged without updating all consumers simultaneously.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="tabs">
          {(['comments', 'diff', 'checklist'] as const).map(t => (
            <button key={t} className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === 'comments' && `Review Comments (${REVIEW_COMMENTS.length})`}
              {t === 'diff' && 'Diff View'}
              {t === 'checklist' && 'Review Checklist'}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          {/* ── COMMENTS ── */}
          {tab === 'comments' && (
            <div style={{ display: 'grid', gridTemplateColumns: selectedComment ? 'minmax(0,1fr) 360px' : '1fr', gap: 16 }}>
              <div className="stack-sm">
                {REVIEW_COMMENTS.sort((a, b) => {
                  const order = ['critical','high','medium','low','suggestion'];
                  return order.indexOf(a.severity) - order.indexOf(b.severity);
                }).map(c => (
                  <button
                    key={c.id}
                    className={selectedComment?.id === c.id ? 'panel-selected' : 'panel'}
                    style={{ width: '100%', textAlign: 'left', cursor: 'pointer', padding: '14px 16px' }}
                    onClick={() => setSelectedComment(selectedComment?.id === c.id ? null : c)}
                  >
                    <div className="spread">
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className={`badge ${SEV_COLOR[c.severity]}`}>{c.severity}</span>
                        <span className={`badge ${CATEGORY_COLOR[c.category]}`}>{c.category}</span>
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--subtle)' }}>
                        {c.file}:{c.line}
                      </span>
                    </div>
                    <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }} className="truncate-2">
                      {c.comment}
                    </p>
                  </button>
                ))}
              </div>

              {selectedComment && (
                <div className="panel stack" style={{ padding: 18, gap: 14, position: 'sticky', top: 80 }}>
                  <div className="spread">
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className={`badge ${SEV_COLOR[selectedComment.severity]}`}>{selectedComment.severity}</span>
                      <span className={`badge ${CATEGORY_COLOR[selectedComment.category]}`}>{selectedComment.category}</span>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => setSelectedComment(null)}>✕</button>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--subtle)', marginBottom: 5 }}>
                      Finding
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{selectedComment.comment}</p>
                  </div>

                  {selectedComment.suggestion && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--subtle)', marginBottom: 5 }}>
                        Suggestion
                      </p>
                      <div style={{ padding: '9px 12px', background: 'var(--accent-soft)', border: '1px solid rgba(124,92,252,.2)', borderRadius: 8, fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>
                        {selectedComment.suggestion}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className="chip" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                      {selectedComment.file}:{selectedComment.line}
                    </span>
                  </div>

                  <div className="alert alert-info" style={{ fontSize: 12 }}>
                    Resolve this comment before requesting merge approval.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DIFF ── */}
          {tab === 'diff' && (
            <div className="panel" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                src/routes/predictions.js
              </div>
              <pre style={{
                margin: 0,
                padding: '12px 0',
                background: 'var(--panel-sunken)',
                fontFamily: 'var(--mono)',
                fontSize: 12,
                lineHeight: 1.7,
                overflowX: 'auto',
              }}>
                {DEMO_DIFF.split('\n').map((line, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0 16px',
                      background: line.startsWith('+') && !line.startsWith('+++')
                        ? 'rgba(34,197,94,.08)'
                        : line.startsWith('-') && !line.startsWith('---')
                          ? 'rgba(239,68,68,.08)'
                          : undefined,
                      color: line.startsWith('+') && !line.startsWith('+++')
                        ? '#86efac'
                        : line.startsWith('-') && !line.startsWith('---')
                          ? '#fca5a5'
                          : line.startsWith('@@')
                            ? 'var(--info)'
                            : 'var(--muted)',
                    }}
                  >
                    {line}
                  </div>
                ))}
              </pre>
            </div>
          )}

          {/* ── CHECKLIST ── */}
          {tab === 'checklist' && (
            <div className="panel" style={{ overflow: 'hidden' }}>
              {CHECKLIST_ITEMS.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < CHECKLIST_ITEMS.length - 1 ? '1px solid var(--line)' : undefined,
                    background: !item.pass ? 'rgba(239,68,68,.03)' : undefined,
                  }}
                >
                  <span style={{
                    display: 'grid', placeItems: 'center',
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    background: item.pass ? 'var(--success-soft)' : 'var(--danger-soft)',
                    color: item.pass ? 'var(--success)' : 'var(--danger)',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {item.pass ? '✓' : '✕'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.note}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
