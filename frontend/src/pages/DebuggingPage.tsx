import React, { useState, useMemo } from 'react';

interface LogEntry {
  id: string;
  ts: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  service: string;
  message: string;
  requestId?: string;
  statusCode?: number;
  latencyMs?: number;
  trace?: string;
}

const ALL_LOGS: LogEntry[] = [
  { id: 'l1', ts: '14:23:01.112', level: 'ERROR', service: 'api', message: "TypeError: Cannot read properties of undefined (reading 'prediction')", requestId: 'req-88a2', statusCode: 500, trace: `TypeError: Cannot read properties of undefined (reading 'prediction')
  at getPrediction (src/services/predictionService.js:34:22)
  at async POST /api/predict (src/routes/predictions.js:18:14)` },
  { id: 'l2', ts: '14:23:01.098', level: 'INFO', service: 'api', message: 'POST /api/predict — 500 Internal Server Error', requestId: 'req-88a2', statusCode: 500, latencyMs: 1840 },
  { id: 'l3', ts: '14:23:00.880', level: 'INFO', service: 'ml', message: 'ML model invoked — input length: 142 chars', requestId: 'req-88a2' },
  { id: 'l4', ts: '14:23:00.875', level: 'INFO', service: 'api', message: 'POST /api/predict — received request body', requestId: 'req-88a2' },
  { id: 'l5', ts: '14:22:58.302', level: 'ERROR', service: 'api', message: "TypeError: Cannot read properties of undefined (reading 'prediction')", requestId: 'req-87f1', statusCode: 500 },
  { id: 'l6', ts: '14:22:58.288', level: 'INFO', service: 'api', message: 'POST /api/predict — 500 Internal Server Error', requestId: 'req-87f1', statusCode: 500, latencyMs: 1922 },
  { id: 'l7', ts: '14:22:45.011', level: 'WARN', service: 'db', message: 'Slow query detected: SELECT * FROM orders — 1240ms', latencyMs: 1240 },
  { id: 'l8', ts: '14:22:44.810', level: 'INFO', service: 'api', message: 'GET /api/orders?limit=50&offset=0 — 200 OK', statusCode: 200, latencyMs: 1248 },
  { id: 'l9', ts: '14:22:30.440', level: 'INFO', service: 'api', message: 'POST /api/predict — 200 OK', requestId: 'req-85c3', statusCode: 200, latencyMs: 920 },
  { id: 'l10', ts: '14:22:29.520', level: 'INFO', service: 'ml', message: 'ML model invoked — input length: 89 chars', requestId: 'req-85c3' },
  { id: 'l11', ts: '14:22:01.820', level: 'ERROR', service: 'api', message: "TypeError: Cannot read properties of undefined (reading 'prediction')", requestId: 'req-82b9', statusCode: 500 },
  { id: 'l12', ts: '14:21:59.410', level: 'INFO', service: 'api', message: 'POST /api/predict — 500 Internal Server Error', requestId: 'req-82b9', statusCode: 500, latencyMs: 2010 },
  { id: 'l13', ts: '14:21:00.000', level: 'INFO', service: 'system', message: 'Deployment completed — version 1.3.2 → 1.4.0' },
  { id: 'l14', ts: '14:20:58.000', level: 'INFO', service: 'system', message: 'Health check passed — all services nominal' },
  { id: 'l15', ts: '14:22:12.000', level: 'WARN', service: 'api', message: 'Authentication header missing on /api/admin/users — request rejected', statusCode: 401 },
  { id: 'l16', ts: '14:22:13.000', level: 'WARN', service: 'api', message: 'Authentication header missing on /api/admin/users — request rejected', statusCode: 401 },
];

const ERROR_PATTERNS = [
  {
    id: 'pat-1',
    pattern: "Cannot read properties of undefined (reading 'prediction')",
    count: 4,
    firstSeen: '14:21:59',
    lastSeen: '14:23:01',
    service: 'api',
    level: 'ERROR',
    hypothesis: 'ML model response schema mismatch — backend returns { label } but frontend expects { prediction }',
    relatedIds: ['l1', 'l5', 'l11'],
  },
  {
    id: 'pat-2',
    pattern: 'Slow query detected: SELECT * FROM orders',
    count: 1,
    firstSeen: '14:22:45',
    lastSeen: '14:22:45',
    service: 'db',
    level: 'WARN',
    hypothesis: 'Missing index on orders table for common filter columns. N+1 query pattern possible.',
    relatedIds: ['l7'],
  },
  {
    id: 'pat-3',
    pattern: 'Authentication header missing on /api/admin/users',
    count: 2,
    firstSeen: '14:22:12',
    lastSeen: '14:22:13',
    service: 'api',
    level: 'WARN',
    hypothesis: 'Automated scanner or misconfigured client making unauthenticated requests to admin endpoint.',
    relatedIds: ['l15', 'l16'],
  },
];

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  ERROR: 'var(--danger)',
  WARN: 'var(--warn)',
  INFO: 'var(--info)',
  DEBUG: 'var(--subtle)',
};

export function DebuggingPage() {
  const [tab, setTab] = useState<'logs' | 'patterns' | 'timeline'>('logs');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);

  const services = ['all', ...Array.from(new Set(ALL_LOGS.map(l => l.service)))];

  const filtered = useMemo(() => ALL_LOGS.filter(l => {
    if (levelFilter !== 'ALL' && l.level !== levelFilter) return false;
    if (serviceFilter !== 'all' && l.service !== serviceFilter) return false;
    return true;
  }), [levelFilter, serviceFilter]);

  const errorCount = ALL_LOGS.filter(l => l.level === 'ERROR').length;
  const warnCount = ALL_LOGS.filter(l => l.level === 'WARN').length;

  const TIMELINE_EVENTS = [
    { ts: '14:21:00', event: 'Deployment: v1.3.2 → v1.4.0', type: 'deploy' },
    { ts: '14:21:59', event: 'First error observed (req-82b9): TypeError: undefined.prediction', type: 'error' },
    { ts: '14:22:01', event: '4 errors in 90 seconds — pattern detected', type: 'error' },
    { ts: '14:22:12', event: 'Unauthorized requests to /api/admin/users', type: 'warn' },
    { ts: '14:22:45', event: 'Slow DB query: SELECT * FROM orders (1240ms)', type: 'warn' },
    { ts: '14:23:01', event: 'Latest error — investigation started', type: 'error' },
  ];

  return (
    <div className="page-content stack-lg">
      {/* Header */}
      <div className="spread">
        <div>
          <h1 className="page-title">Log Intelligence</h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            Runtime log analysis for the InsightBoard project. {ALL_LOGS.length} log entries from the last 5 minutes.
          </p>
        </div>
        <span className="demo-notice">DEMO DATA</span>
      </div>

      {/* Summary */}
      <div className="metric-grid">
        {[
          { label: 'Total Entries', value: ALL_LOGS.length },
          { label: 'Errors', value: errorCount, color: 'var(--danger)' },
          { label: 'Warnings', value: warnCount, color: 'var(--warn)' },
          { label: 'Error Patterns', value: ERROR_PATTERNS.length, color: 'var(--accent-text)' },
        ].map(m => (
          <div key={m.label} className="metric">
            <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      {errorCount > 0 && (
        <div className="banner banner-bad">
          <div>
            <div className="banner-title">
              <span style={{ color: 'var(--danger)' }}>●</span>
              {errorCount} errors detected after deployment at 14:21
            </div>
            <p className="banner-text">
              All errors share the same root pattern: <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>Cannot read properties of undefined (reading 'prediction')</code>
            </p>
          </div>
          <button className="btn btn-sm btn-danger" onClick={() => setTab('patterns')}>
            View Patterns
          </button>
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="tabs">
          {(['logs', 'patterns', 'timeline'] as const).map(t => (
            <button key={t} className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === 'logs' && `Raw Logs (${filtered.length})`}
              {t === 'patterns' && `Error Patterns (${ERROR_PATTERNS.length})`}
              {t === 'timeline' && 'Incident Timeline'}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          {/* ── RAW LOGS ── */}
          {tab === 'logs' && (
            <div className="stack">
              {/* Filters */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'] as const).map(l => (
                  <button
                    key={l}
                    className={`btn btn-sm ${levelFilter === l ? 'btn-primary' : ''}`}
                    onClick={() => setLevelFilter(l)}
                    style={levelFilter !== l && l !== 'ALL' ? { color: LEVEL_COLOR[l as LogEntry['level']] } : undefined}
                  >
                    {l}
                  </button>
                ))}
                <div style={{ width: 1, background: 'var(--line)', margin: '0 4px' }} />
                {services.map(s => (
                  <button
                    key={s}
                    className={`btn btn-sm ${serviceFilter === s ? 'btn-primary' : ''}`}
                    onClick={() => setServiceFilter(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Log output */}
              <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ maxHeight: 480, overflowY: 'auto', fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.7 }}>
                  {filtered.map(l => (
                    <div key={l.id}>
                      <div
                        style={{
                          display: 'flex', gap: 10, padding: '3px 14px',
                          borderBottom: '1px solid var(--line)',
                          background: l.level === 'ERROR' ? 'rgba(239,68,68,.04)' : undefined,
                          cursor: l.trace ? 'pointer' : undefined,
                        }}
                        onClick={() => l.trace && setExpandedTrace(expandedTrace === l.id ? null : l.id)}
                      >
                        <span style={{ color: 'var(--subtle)', flexShrink: 0 }}>{l.ts}</span>
                        <span style={{ color: LEVEL_COLOR[l.level], flexShrink: 0, width: 48, fontWeight: 700 }}>{l.level}</span>
                        <span style={{ color: 'var(--info)', flexShrink: 0, width: 56 }}>{l.service}</span>
                        <span style={{ color: l.level === 'ERROR' ? '#fca5a5' : l.level === 'WARN' ? '#fcd34d' : 'var(--muted)', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                          {l.message}
                        </span>
                        {l.latencyMs != null && (
                          <span style={{ color: l.latencyMs > 1000 ? 'var(--warn)' : 'var(--subtle)', flexShrink: 0 }}>
                            {l.latencyMs}ms
                          </span>
                        )}
                        {l.requestId && <span style={{ color: 'var(--subtle)', flexShrink: 0 }}>{l.requestId}</span>}
                        {l.trace && <span style={{ color: 'var(--subtle)' }}>▸</span>}
                      </div>
                      {expandedTrace === l.id && l.trace && (
                        <pre style={{ margin: 0, padding: '8px 14px 10px 72px', background: 'rgba(239,68,68,.06)', color: '#fca5a5', fontSize: 11, lineHeight: 1.6, borderBottom: '1px solid var(--line)' }}>
                          {l.trace}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PATTERNS ── */}
          {tab === 'patterns' && (
            <div className="stack">
              {ERROR_PATTERNS.map(p => (
                <div key={p.id} className="panel" style={{ padding: 18 }}>
                  <div className="spread" style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={`badge ${p.level === 'ERROR' ? 'badge-danger' : 'badge-warn'}`}>{p.level}</span>
                      <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13 }}>{p.count}× occurrences</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--subtle)' }}>{p.firstSeen} → {p.lastSeen}</span>
                  </div>

                  <pre className="code" style={{ fontSize: 12 }}>{p.pattern}</pre>

                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--subtle)', marginBottom: 5 }}>
                      AI Hypothesis
                    </p>
                    <div style={{ padding: '9px 12px', background: 'var(--accent-soft)', border: '1px solid rgba(124,92,252,.2)', borderRadius: 8, fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>
                      {p.hypothesis}
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                    <span className="chip">Service: {p.service}</span>
                    <span className="chip">{p.relatedIds.length} log entries</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── TIMELINE ── */}
          {tab === 'timeline' && (
            <div className="panel" style={{ padding: 20 }}>
              <div className="timeline">
                {TIMELINE_EVENTS.map((e, i) => (
                  <div key={i} className="timeline-row">
                    <div className="timeline-spine">
                      <div
                        className="timeline-dot"
                        style={{
                          borderColor: e.type === 'error' ? 'var(--danger)' : e.type === 'deploy' ? 'var(--accent)' : 'var(--warn)',
                          background: e.type === 'error' ? 'var(--danger-soft)' : e.type === 'deploy' ? 'var(--accent-soft)' : 'var(--warn-soft)',
                        }}
                      />
                      {i < TIMELINE_EVENTS.length - 1 && <div className="timeline-connector" />}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-time">{e.ts}</span>
                        <span className={`badge ${e.type === 'error' ? 'badge-danger' : e.type === 'deploy' ? 'badge-accent' : 'badge-warn'}`}>
                          {e.type.toUpperCase()}
                        </span>
                      </div>
                      <p className="timeline-msg" style={{ color: 'var(--ink)' }}>{e.event}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="alert alert-info" style={{ marginTop: 16, fontSize: 12 }}>
                All errors began after the 14:21 deployment. The deployment most likely introduced the API schema mismatch.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
