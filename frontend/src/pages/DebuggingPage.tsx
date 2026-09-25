import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

const RUNTIME_STEPS = [
  { id: 1, label: 'Form Hypotheses', desc: 'Identify candidate root causes from static evidence.', status: 'done' },
  { id: 2, label: 'Identify Runtime Evidence Needed', desc: 'Determine what runtime data would confirm or reject each hypothesis.', status: 'done' },
  { id: 3, label: 'Propose Instrumentation', desc: 'Generate temporary log statements, breakpoints, or trace calls.', status: 'active' },
  { id: 4, label: 'Developer Reproduces Bug', desc: 'Ask developer to run the reproduction command with instrumentation.', status: 'pending' },
  { id: 5, label: 'Collect Runtime Events', desc: 'Parse logs and runtime output for signals.', status: 'pending' },
  { id: 6, label: 'Correlate Evidence', desc: 'Match runtime signals against hypotheses.', status: 'pending' },
  { id: 7, label: 'Update Hypotheses', desc: 'Accept or reject each hypothesis based on runtime evidence.', status: 'pending' },
  { id: 8, label: 'Identify Root Cause', desc: 'Finalize the supported hypothesis as root cause.', status: 'pending' },
  { id: 9, label: 'Remove Instrumentation', desc: 'Clean up temporary debugging code from codebase.', status: 'pending' },
  { id: 10, label: 'Verify Fix', desc: 'Confirm root cause is resolved by running all tests.', status: 'pending' },
];

const LOG_LINES = [
  { time: '14:23:01', level: 'error', source: 'orders route', message: 'SQLITE_ERROR: no such column: o.customer_name', count: 127 },
  { time: '14:23:01', level: 'error', source: 'express', message: 'GET /api/orders 500 12ms', count: 127 },
  { time: '14:22:48', level: 'warn', source: 'predictions', message: 'TypeError: Cannot read properties of undefined (reading \'label\')', count: 34 },
  { time: '14:22:31', level: 'info', source: 'server', message: 'Server started on port 3000', count: 1 },
  { time: '14:21:55', level: 'error', source: 'api-client', message: 'SyntaxError: Unexpected token < in JSON at position 0', count: 89 },
  { time: '14:21:55', level: 'warn', source: 'fetch', message: 'Request to /undefined/api/predictions returned 404', count: 89 },
  { time: '14:21:40', level: 'info', source: 'sqlite', message: 'Database initialized at ./insightboard.db', count: 1 },
];

const INSTRUMENTATION = [
  {
    file: 'src/routes/orders.js',
    line: 12,
    type: 'log',
    code: `// DEBUG: Log query execution
console.log('[DEBUG] orders query:', query);
console.log('[DEBUG] query params:', params);`,
    reason: 'Capture the exact SQL query being executed to verify column names',
    temporary: true,
  },
  {
    file: 'web/app.js',
    line: 88,
    type: 'log',
    code: `// DEBUG: Trace prediction object structure
console.log('[DEBUG] prediction object:', JSON.stringify(prediction));
console.log('[DEBUG] available keys:', Object.keys(prediction));`,
    reason: 'Verify whether API response uses "label" or "sentiment" field name',
    temporary: true,
  },
];

export function DebuggingPage() {
  const [activeMode, setActiveMode] = useState<'log' | 'runtime' | 'instrumentation'>('log');
  const [logFilter, setLogFilter] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const filteredLogs = logFilter === 'all' ? LOG_LINES : LOG_LINES.filter((l) => l.level === logFilter);

  return (
    <div className="page-content stack" style={{ gap: 22 }}>
      {/* Mode selector */}
      <div className="row" style={{ gap: 8 }}>
        {(['log', 'runtime', 'instrumentation'] as const).map((mode) => (
          <button
            key={mode}
            className={`btn ${activeMode === mode ? 'btn-primary' : ''}`}
            onClick={() => setActiveMode(mode)}
          >
            {mode === 'log' && '📋 Log Intelligence'}
            {mode === 'runtime' && '⚡ Runtime Debug'}
            {mode === 'instrumentation' && '🔬 Instrumentation'}
          </button>
        ))}
        <Link to="/new" className="btn" style={{ marginLeft: 'auto' }}>+ Start investigation</Link>
      </div>

      {activeMode === 'log' && (
        <div className="stack" style={{ gap: 16 }}>
          {/* Summary */}
          <div className="card-grid-3">
            <MetricMini label="Total log lines" value="340" color="var(--ink)" />
            <MetricMini label="Error patterns" value="4" color="var(--danger)" />
            <MetricMini label="Affected services" value="3" color="var(--warn)" />
          </div>

          {/* Error pattern groups */}
          <Card title="Error Pattern Groups" action={
            <span className="chip">127 errors → 4 root patterns</span>
          }>
            <div className="stack" style={{ gap: 10 }}>
              {[
                { pattern: 'SQLITE_ERROR: no such column', count: 127, severity: 'critical', files: ['src/routes/orders.js:12'] },
                { pattern: 'TypeError: Cannot read properties of undefined', count: 34, severity: 'high', files: ['web/app.js:88'] },
                { pattern: 'SyntaxError: Unexpected token < in JSON', count: 89, severity: 'high', files: ['web/api-client.js:14'] },
                { pattern: 'GET /undefined/api/predictions 404', count: 89, severity: 'critical', files: ['web/api-client.js:3'] },
              ].map((p) => (
                <div key={p.pattern} className="error-pattern">
                  <div className="spread">
                    <div className="row" style={{ gap: 10 }}>
                      <span className={`error-count error-count-${p.severity}`}>{p.count}×</span>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--ink)' }}>{p.pattern}</span>
                    </div>
                    <Badge variant={p.severity === 'critical' ? 'danger' : 'warn'} dot>{p.severity}</Badge>
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 8 }}>
                    {p.files.map((f) => (
                      <Link key={f} to="/code-intelligence" className="chip mono" style={{ fontSize: 10, textDecoration: 'none', color: 'var(--info)' }}>{f}</Link>
                    ))}
                    <Link to="/new" className="btn btn-sm btn-link" style={{ marginLeft: 'auto' }}>Investigate</Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Raw log viewer */}
          <Card title="Log Stream" action={
            <div className="row" style={{ gap: 6 }}>
              {['all', 'error', 'warn', 'info'].map((f) => (
                <button
                  key={f}
                  className={`btn btn-sm ${logFilter === f ? 'btn-primary' : ''}`}
                  onClick={() => setLogFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          }>
            <div className="log">
              {filteredLogs.map((line, i) => (
                <div
                  key={i}
                  className={`log-row log-row-${line.level}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpandedLog(expandedLog === i ? null : i)}
                >
                  <span className="log-time">{line.time}</span>
                  <span className={`log-level log-level-${line.level}`}>{line.level.toUpperCase()}</span>
                  <span className="log-agent">{line.source}</span>
                  <span className="log-msg">{line.message}</span>
                  {line.count > 1 && <span className="chip mono" style={{ fontSize: 10, flex: 'none' }}>{line.count}×</span>}
                </div>
              ))}
            </div>
          </Card>

          {/* Incident Timeline */}
          <Card title="Incident Timeline">
            <div className="timeline">
              {[
                { time: '14:21:40', event: 'Server started', type: 'info' },
                { time: '14:21:55', event: 'First 404 error — /undefined/api/predictions', type: 'error' },
                { time: '14:22:31', event: 'API latency increased (avg 890ms)', type: 'warn' },
                { time: '14:22:48', event: 'TypeError in renderDetail() — 34 occurrences', type: 'error' },
                { time: '14:23:01', event: 'SQLITE_ERROR in orders route — 127 occurrences', type: 'error' },
                { time: '14:23:10', event: 'Investigation started by developer', type: 'info' },
                { time: '14:24:15', event: 'Agent discovered API field name mismatch', type: 'success' },
                { time: '14:25:30', event: 'Root cause identified: SQL column name mismatch', type: 'success' },
              ].map((ev, i) => (
                <div key={i} className="timeline-item">
                  <div className={`timeline-dot timeline-dot-${ev.type}`} />
                  <span className="timeline-time mono">{ev.time}</span>
                  <span className="timeline-event">{ev.event}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeMode === 'runtime' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="banner banner-info">
            <div>
              <p className="banner-title" style={{ color: 'var(--info)' }}>⚡ Runtime Debug Mode</p>
              <p className="banner-text">
                Static analysis is insufficient. This mode generates temporary instrumentation,
                collects runtime evidence, and removes all debugging code after verification.
                Instrumentation is never left in production.
              </p>
            </div>
          </div>

          <div className="stack" style={{ gap: 10 }}>
            {RUNTIME_STEPS.map((step) => (
              <div key={step.id} className={`runtime-step runtime-step-${step.status}`}>
                <div className={`runtime-step-num runtime-step-num-${step.status}`}>{step.id}</div>
                <div>
                  <p className="runtime-step-label">{step.label}</p>
                  <p className="runtime-step-desc">{step.desc}</p>
                </div>
                {step.status === 'done' && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 14 }}>✓</span>}
                {step.status === 'active' && <Badge variant="info" dot>Running</Badge>}
              </div>
            ))}
          </div>

          <Link to="/new" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            Start runtime investigation
          </Link>
        </div>
      )}

      {activeMode === 'instrumentation' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="banner banner-warn">
            <div>
              <p className="banner-title" style={{ color: 'var(--warn)' }}>🔬 Temporary Instrumentation</p>
              <p className="banner-text">
                The following code additions are temporary. They will be removed automatically
                after the root cause is verified. Never deploy instrumented code to production.
              </p>
            </div>
          </div>
          {INSTRUMENTATION.map((inst, i) => (
            <Card key={i} title={`Instrumentation ${i + 1} — ${inst.file}:${inst.line}`} action={
              <Badge variant="warn">Temporary</Badge>
            }>
              <dl className="kv" style={{ marginBottom: 14 }}>
                <dt>Purpose</dt><dd>{inst.reason}</dd>
                <dt>Type</dt><dd>{inst.type}</dd>
              </dl>
              <pre className="code">{inst.code}</pre>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <button className="btn btn-sm">Copy</button>
                <button className="btn btn-sm btn-link" style={{ color: 'var(--danger)' }}>Remove instrumentation</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="metric">
      <p className="metric-value" style={{ color }}>{value}</p>
      <p className="metric-label">{label}</p>
    </div>
  );
}
