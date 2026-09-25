import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

type IssueStatus = 'confirmed' | 'potential' | 'review';

const SECURITY_FINDINGS: {
  id: string;
  title: string;
  file: string;
  line: number;
  category: string;
  severity: string;
  status: IssueStatus;
  description: string;
  evidence: string;
  recommendation: string;
}[] = [
  {
    id: 'SEC-001',
    title: 'SQL Injection Risk — Unparameterised Limit',
    file: 'src/routes/orders.js',
    line: 8,
    category: 'Injection',
    severity: 'high',
    status: 'confirmed',
    description: 'The `limit` and `offset` query parameters are interpolated directly into the SQL query string without parameterisation.',
    evidence: 'db.all(`SELECT ... LIMIT ${limit} OFFSET ${offset}`) — user-controlled values in SQL template literal.',
    recommendation: 'Use parameterised queries: db.all(sql, [limit, offset], callback) to prevent SQL injection.',
  },
  {
    id: 'SEC-002',
    title: 'Missing Input Validation — Prediction Endpoint',
    file: 'src/routes/predictions.js',
    line: 22,
    category: 'Input Handling',
    severity: 'medium',
    status: 'potential',
    description: 'The POST /api/predictions endpoint accepts a `text` field without length or content validation.',
    evidence: 'No req.body validation middleware detected. Text field passed directly to ML model invocation.',
    recommendation: 'Add input validation: maximum length check, sanitization, and reject empty or malformed inputs.',
  },
  {
    id: 'SEC-003',
    title: 'Exposed Error Details in API Response',
    file: 'src/routes/orders.js',
    line: 18,
    category: 'Information Disclosure',
    severity: 'medium',
    status: 'confirmed',
    description: 'When the SQL query fails, the raw SQLite error message including internal schema details is returned directly to the API client.',
    evidence: 'res.status(500).json({ error: err.message }) — returns "no such column: o.customer_name" to caller.',
    recommendation: 'Return a generic error message to clients. Log detailed errors server-side only.',
  },
  {
    id: 'SEC-004',
    title: 'No Rate Limiting on API Endpoints',
    file: 'src/api/server.js',
    line: 1,
    category: 'Configuration',
    severity: 'low',
    status: 'review',
    description: 'No rate limiting middleware is configured. All endpoints accept unlimited requests.',
    evidence: 'No express-rate-limit, helmet, or equivalent middleware found in server.js or app.js.',
    recommendation: 'Add rate limiting middleware (e.g., express-rate-limit) for public-facing endpoints.',
  },
  {
    id: 'SEC-005',
    title: 'Missing HTTP Security Headers',
    file: 'src/api/server.js',
    line: 1,
    category: 'Configuration',
    severity: 'low',
    status: 'review',
    description: 'No security headers (X-Frame-Options, Content-Security-Policy, X-Content-Type-Options) are set.',
    evidence: 'Helmet middleware not found in express server setup. Response headers lack security directives.',
    recommendation: 'Add the helmet middleware: app.use(helmet()) for standard HTTP security headers.',
  },
];

const DEPENDENCY_RISKS = [
  { name: 'sqlite3', current: '5.1.2', latest: '5.1.7', risk: 'low', status: 'outdated', cves: 0, usedIn: ['src/db/setup.js', 'src/routes/'] },
  { name: 'express', current: '4.18.2', latest: '4.21.0', risk: 'medium', status: 'outdated', cves: 1, usedIn: ['src/api/server.js'] },
  { name: 'node:test', current: 'built-in', latest: 'N/A', risk: 'low', status: 'current', cves: 0, usedIn: ['test/'] },
];

export function SecurityPage() {
  const [tab, setTab] = useState<'findings' | 'deps' | 'checklist'>('findings');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = statusFilter === 'all' ? SECURITY_FINDINGS : SECURITY_FINDINGS.filter(f => f.status === statusFilter);

  const confirmed = SECURITY_FINDINGS.filter(f => f.status === 'confirmed').length;
  const potential = SECURITY_FINDINGS.filter(f => f.status === 'potential').length;
  const review = SECURITY_FINDINGS.filter(f => f.status === 'review').length;

  return (
    <div className="page-content stack" style={{ gap: 22 }}>
      {/* Summary */}
      <div className="metric-grid">
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--danger)' }}>{confirmed}</p>
          <p className="metric-label">Confirmed issues</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--warn)' }}>{potential}</p>
          <p className="metric-label">Potential issues</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--info)' }}>{review}</p>
          <p className="metric-label">Needs review</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--muted)' }}>{DEPENDENCY_RISKS.filter(d => d.cves > 0).length}</p>
          <p className="metric-label">Dependency CVEs</p>
        </div>
      </div>

      <div className="banner banner-warn">
        <div>
          <p className="banner-title" style={{ color: 'var(--warn)' }}>⚠ Security findings require human review</p>
          <p className="banner-text">
            FixFlow AI distinguishes confirmed issues (evidence found in code) from potential issues and items needing review.
            No finding is marked confirmed without code evidence. Always verify before acting.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" role="tablist">
        {[
          { id: 'findings', label: 'Security Findings' },
          { id: 'deps', label: 'Dependency Health' },
          { id: 'checklist', label: 'Security Checklist' },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id as any}
            className="tab"
            onClick={() => setTab(t.id as any)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'findings' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 6 }}>
            {[
              { key: 'all', label: `All (${SECURITY_FINDINGS.length})` },
              { key: 'confirmed', label: `Confirmed (${confirmed})` },
              { key: 'potential', label: `Potential (${potential})` },
              { key: 'review', label: `Needs review (${review})` },
            ].map((f) => (
              <button
                key={f.key}
                className={`btn btn-sm ${statusFilter === f.key ? 'btn-primary' : ''}`}
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {filtered.map((finding) => (
            <div key={finding.id} className={`security-finding security-finding-${finding.status}`}>
              <div className="spread">
                <div className="row" style={{ gap: 8 }}>
                  <span className="chip mono">{finding.id}</span>
                  <StatusPill status={finding.status} />
                  <Badge variant={finding.severity === 'high' || finding.severity === 'critical' ? 'danger' : finding.severity === 'medium' ? 'warn' : 'muted'} dot>
                    {finding.severity}
                  </Badge>
                </div>
                <span className="chip mono" style={{ fontSize: 10 }}>{finding.category}</span>
              </div>
              <h3 style={{ margin: '10px 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{finding.title}</h3>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{finding.description}</p>
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--panel-sunken)', border: '1px solid var(--line)', marginBottom: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Evidence</p>
                <p className="mono" style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{finding.evidence}</p>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(183,243,107,0.06)', border: '1px solid rgba(183,243,107,0.18)', marginBottom: 12 }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Recommendation</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{finding.recommendation}</p>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="chip mono" style={{ fontSize: 10, color: 'var(--info)' }}>{finding.file}:{finding.line}</span>
                <Link to="/new" className="btn btn-sm" style={{ marginLeft: 'auto' }}>Investigate</Link>
                <Link to="/code-review" className="btn btn-sm btn-link">Review code</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'deps' && (
        <Card title="Dependency Risk Analysis" flush>
          <table className="table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Current</th>
                <th>Latest</th>
                <th>Status</th>
                <th>CVEs</th>
                <th>Risk</th>
                <th>Used in</th>
              </tr>
            </thead>
            <tbody>
              {DEPENDENCY_RISKS.map((dep) => (
                <tr key={dep.name}>
                  <td className="mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>{dep.name}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{dep.current}</td>
                  <td className="mono" style={{ fontSize: 12, color: dep.status === 'outdated' ? 'var(--warn)' : 'var(--muted)' }}>{dep.latest}</td>
                  <td>
                    <Badge variant={dep.status === 'current' ? 'success' : 'warn'} dot>{dep.status}</Badge>
                  </td>
                  <td style={{ color: dep.cves > 0 ? 'var(--danger)' : 'var(--subtle)', fontFamily: 'var(--mono)', fontWeight: dep.cves > 0 ? 700 : 400 }}>
                    {dep.cves > 0 ? `${dep.cves} CVE` : '—'}
                  </td>
                  <td>
                    <Badge variant={dep.risk === 'high' ? 'danger' : dep.risk === 'medium' ? 'warn' : 'muted'}>{dep.risk}</Badge>
                  </td>
                  <td style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--subtle)' }}>
                    {dep.usedIn.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'checklist' && (
        <Card title="Security Checklist">
          <div className="stack" style={{ gap: 8 }}>
            {[
              { label: 'SQL injection prevention', status: 'fail', note: 'Unparameterised query in orders.js' },
              { label: 'Input validation on all endpoints', status: 'partial', note: 'Missing on /api/predictions' },
              { label: 'Error details not exposed to client', status: 'fail', note: 'Raw SQLite errors returned' },
              { label: 'Authentication on protected routes', status: 'review', note: 'No auth middleware detected' },
              { label: 'HTTP security headers (helmet)', status: 'fail', note: 'Not configured' },
              { label: 'Rate limiting', status: 'fail', note: 'No rate limiter found' },
              { label: 'Secrets not in source code', status: 'pass', note: 'No hardcoded secrets found' },
              { label: 'Dependencies: no known critical CVEs', status: 'pass', note: '0 critical CVEs in current scan' },
              { label: 'File upload restrictions', status: 'pass', note: 'No file upload endpoints found' },
            ].map((item, i) => (
              <div key={i} className="spread" style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--panel-sunken)', border: '1px solid var(--line)' }}>
                <div className="row" style={{ gap: 10 }}>
                  <ChecklistDot status={item.status} />
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{item.note}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: IssueStatus }) {
  const map: Record<IssueStatus, { label: string; color: string; bg: string }> = {
    confirmed: { label: 'Confirmed', color: 'var(--danger)', bg: 'var(--danger-soft)' },
    potential: { label: 'Potential', color: 'var(--warn)', bg: 'var(--warn-soft)' },
    review: { label: 'Needs review', color: 'var(--info)', bg: 'var(--info-soft)' },
  };
  const v = map[status];
  return (
    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', background: v.bg, color: v.color }}>
      {v.label}
    </span>
  );
}

function ChecklistDot({ status }: { status: string }) {
  const map: Record<string, { symbol: string; color: string }> = {
    pass: { symbol: '✓', color: 'var(--accent)' },
    fail: { symbol: '✗', color: 'var(--danger)' },
    partial: { symbol: '~', color: 'var(--warn)' },
    review: { symbol: '?', color: 'var(--info)' },
  };
  const v = map[status] ?? map.review;
  return (
    <span style={{ display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: 999, background: v.color + '22', color: v.color, fontSize: 11, fontWeight: 700, flex: 'none' }}>
      {v.symbol}
    </span>
  );
}
