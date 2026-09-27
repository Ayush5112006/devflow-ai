import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';
import type { Investigation } from '../types/index.js';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type Status = 'confirmed' | 'potential' | 'review';

interface Finding {
  id: string;
  title: string;
  file: string;
  line: number;
  category: string;
  severity: Severity;
  status: Status;
  description: string;
  evidence: string;
  recommendation: string;
  cwe?: string;
}

const FINDINGS: Finding[] = [
  {
    id: 'SEC-001',
    title: 'SQL Injection — Unparameterised Query',
    file: 'src/routes/orders.js',
    line: 8,
    category: 'Injection',
    severity: 'high',
    status: 'confirmed',
    cwe: 'CWE-89',
    description: 'The `limit` and `offset` query parameters are interpolated directly into the SQL query string without parameterisation, allowing an attacker to manipulate the query.',
    evidence: 'db.all(`SELECT * FROM orders LIMIT ${limit} OFFSET ${offset}`) — user-controlled values in template literal.',
    recommendation: 'Use parameterised queries: db.all("SELECT * FROM orders LIMIT ? OFFSET ?", [limit, offset]) to prevent injection.',
  },
  {
    id: 'SEC-002',
    title: 'Exposed Stack Trace in API Response',
    file: 'src/routes/orders.js',
    line: 18,
    category: 'Information Disclosure',
    severity: 'medium',
    status: 'confirmed',
    cwe: 'CWE-209',
    description: 'When the SQL query fails, the raw SQLite error including internal schema details is returned directly to the API caller.',
    evidence: 'res.status(500).json({ error: err.message }) — returns "no such column: o.customer_name" to caller.',
    recommendation: 'Return a generic error message to clients. Log detailed errors server-side only with a correlation ID.',
  },
  {
    id: 'SEC-003',
    title: 'Missing Input Validation — Prediction Endpoint',
    file: 'src/routes/predictions.js',
    line: 22,
    category: 'Input Handling',
    severity: 'medium',
    status: 'potential',
    cwe: 'CWE-20',
    description: 'The POST /api/predictions endpoint accepts a `text` field without length, format, or content validation before passing it to the ML model.',
    evidence: 'No req.body validation middleware detected. Text field passed directly to ML model invocation without checks.',
    recommendation: 'Add validation: maximum length (e.g., 10,000 chars), reject empty/null, sanitise before processing.',
  },
  {
    id: 'SEC-004',
    title: 'No Rate Limiting on Public Endpoints',
    file: 'src/api/server.js',
    line: 1,
    category: 'API Security',
    severity: 'medium',
    status: 'potential',
    cwe: 'CWE-770',
    description: 'No rate limiting middleware is applied to public API endpoints. This could allow abuse through brute-force or denial-of-service attacks.',
    evidence: 'No express-rate-limit, helmet rate-limit, or nginx rate-limit configuration found in codebase.',
    recommendation: 'Add express-rate-limit: limit per IP to 100 req/15min on public routes, 20 req/15min on auth routes.',
  },
  {
    id: 'SEC-005',
    title: 'Hardcoded Default Credentials',
    file: 'config/database.js',
    line: 4,
    category: 'Credentials',
    severity: 'high',
    status: 'review',
    cwe: 'CWE-798',
    description: 'A hardcoded default username/password pair is present in the database configuration file. If this file is committed or deployed as-is, credentials may be exposed.',
    evidence: 'const DB_PASSWORD = "admin123" — literal string, not read from environment.',
    recommendation: 'Move all credentials to environment variables. Add config/database.js to .gitignore if it contains secrets.',
  },
  {
    id: 'SEC-006',
    title: 'Missing CORS Restriction',
    file: 'src/api/server.js',
    line: 12,
    category: 'Configuration',
    severity: 'low',
    status: 'review',
    cwe: 'CWE-942',
    description: 'CORS is configured with a wildcard origin (*) allowing requests from any domain. This is acceptable for public APIs but should be reviewed for authenticated endpoints.',
    evidence: 'app.use(cors()) with no origin restriction — verified in server configuration.',
    recommendation: 'For endpoints with authentication, restrict origins: cors({ origin: process.env.ALLOWED_ORIGINS }).',
  },
];

const CATEGORIES = ['All', 'Injection', 'Information Disclosure', 'Input Handling', 'API Security', 'Credentials', 'Configuration'];
const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function sevColor(s: Severity) {
  return { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low', info: 'badge-info' }[s];
}

function statusColor(s: Status) {
  return { confirmed: 'badge-danger', potential: 'badge-warn', review: 'badge-muted' }[s];
}

function statusLabel(s: Status) {
  return { confirmed: 'Confirmed', potential: 'Potential', review: 'Needs Review' }[s];
}

export function SecurityPage() {
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<Finding | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  /* Pull security-related findings from real completed investigations */
  const [liveFindings, setLiveFindings] = useState<Finding[]>([]);
  const [liveSource, setLiveSource] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    api.listInvestigations()
      .then(({ investigations }) => {
        const completed = investigations.filter((i: any) => i.status === 'completed');
        if (completed.length === 0) return;
        // Use the most recent completed investigation
        api.getInvestigation((completed[0] as any).id).then(({ investigation }) => {
          const secFindings: Finding[] = investigation.findings
            .filter((f) => ['high', 'medium'].includes(f.severity))
            .map((f, i) => ({
              id: `INV-SEC-${String(i + 1).padStart(3, '0')}`,
              title: f.title,
              file: f.files[0] ?? 'unknown',
              line: 0,
              category: f.agent === 'database' ? 'Injection'
                : f.agent === 'api' ? 'API Security'
                : f.agent === 'code' ? 'Input Handling'
                : 'Configuration',
              severity: f.severity as Severity,
              status: 'confirmed' as Status,
              description: f.summary,
              evidence: f.evidence.map((e) => e.description).join('\n') || f.impact,
              recommendation: `Reviewed by ${f.agent} agent. Confidence: ${Math.round(f.confidence * 100)}%`,
            }));
          if (secFindings.length > 0) {
            setLiveFindings(secFindings);
            setLiveSource({ id: investigation.id, title: investigation.bug.title });
          }
        }).catch(() => {});
      })
      .catch(() => {});
  }, []);

  const isLive = liveFindings.length > 0;
  const allFindings = isLive ? liveFindings : FINDINGS;

  const filtered = allFindings
    .filter(f => category === 'All' || f.category === category)
    .filter(f => severityFilter === 'all' || f.severity === severityFilter);

  const counts = {
    critical: allFindings.filter(f => f.severity === 'critical').length,
    high: allFindings.filter(f => f.severity === 'high').length,
    medium: allFindings.filter(f => f.severity === 'medium').length,
    low: allFindings.filter(f => f.severity === 'low').length,
    confirmed: allFindings.filter(f => f.status === 'confirmed').length,
  };

  return (
    <div className="page-content stack-lg">
      {/* Header */}
      <div className="spread">
        <div>
          <h1 className="page-title">Security Review</h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            {isLive
              ? `Security findings from investigation: "${liveSource?.title?.slice(0, 50)}"`
              : 'Static analysis findings for the InsightBoard demo project. Review confirmed issues first.'}
          </p>
        </div>
        {isLive
          ? <Badge variant="success" dot>LIVE</Badge>
          : <span className="demo-notice">DEMO DATA</span>}
      </div>

      {/* Live source banner */}
      {isLive && liveSource && (
        <div className="banner banner-ok" style={{ borderColor: 'var(--accent)', background: 'rgba(124,92,252,.06)' }}>
          <div>
            <p className="banner-title" style={{ color: 'var(--accent)' }}>
              ✓ Real security findings from completed investigation
            </p>
            <p className="banner-text">
              High/medium severity findings surfaced by AI agents during investigation{' '}
              <span className="mono" style={{ fontSize: 11 }}>{liveSource.id.slice(0, 8)}</span>.
            </p>
          </div>
          <Link to={`/investigations/${liveSource.id}`} className="btn btn-sm" style={{ flex: 'none' }}>
            View investigation →
          </Link>
        </div>
      )}

      {/* Summary bar */}
      <div className="banner banner-warn">
        <div>
          <div className="banner-title">
            <span style={{ color: 'var(--danger)' }}>⚠</span>
            {counts.confirmed} confirmed issue{counts.confirmed !== 1 ? 's' : ''} require attention
          </div>
          <p className="banner-text">
            {counts.high} high-severity · {counts.medium} medium-severity · {counts.low} low-severity findings across {allFindings.length} total
          </p>
        </div>
        <button className="btn btn-sm" onClick={() => setSeverityFilter('all')}>Show All</button>
      </div>

      {/* Score cards */}
      <div className="metric-grid">
        {[
          { label: 'Critical', value: counts.critical, cls: 'badge-critical', filter: 'critical' },
          { label: 'High', value: counts.high, cls: 'badge-high', filter: 'high' },
          { label: 'Medium', value: counts.medium, cls: 'badge-medium', filter: 'medium' },
          { label: 'Low / Info', value: counts.low, cls: 'badge-low', filter: 'low' },
        ].map(c => (
          <button
            key={c.label}
            className="metric"
            style={{ cursor: 'pointer', textAlign: 'left', border: severityFilter === c.filter ? '1px solid var(--accent)' : undefined }}
            onClick={() => setSeverityFilter(severityFilter === c.filter ? 'all' : c.filter)}
          >
            <div className="metric-value" style={{ fontSize: 28 }}>{c.value}</div>
            <div className="metric-label">{c.label}</div>
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) 380px' : '1fr', gap: 16, alignItems: 'start' }}>
        {/* Left: findings list */}
        <div className="stack-sm">
          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            {CATEGORIES.map(c => (
              <button
                key={c}
                className={`btn btn-sm ${category === c ? 'btn-primary' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Findings */}
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🔍</div>
              <p className="empty-title">No findings in this category</p>
            </div>
          ) : (
            filtered
              .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))
              .map(f => (
                <button
                  key={f.id}
                  className={selected?.id === f.id ? 'panel-selected' : 'panel'}
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer', padding: '14px 16px', border: undefined }}
                  onClick={() => setSelected(selected?.id === f.id ? null : f)}
                >
                  <div className="spread">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span className={`badge ${sevColor(f.severity)}`}>{f.severity.toUpperCase()}</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {f.cwe && <span className="chip" style={{ fontSize: 10 }}>{f.cwe}</span>}
                      <span className={`badge ${statusColor(f.status)}`}>{statusLabel(f.status)}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 11, color: 'var(--subtle)' }}>
                    <span style={{ fontFamily: 'var(--mono)' }}>{f.file}:{f.line}</span>
                    <span>{f.category}</span>
                  </div>
                </button>
              ))
          )}
        </div>

        {/* Right: detail panel */}
        {selected && (
          <div className="panel stack" style={{ padding: 20, gap: 16, position: 'sticky', top: 80 }}>
            <div className="spread">
              <span className={`badge ${sevColor(selected.severity)}`}>{selected.severity.toUpperCase()}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>✕ Close</button>
            </div>

            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{selected.title}</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={`badge ${statusColor(selected.status)}`}>{statusLabel(selected.status)}</span>
                {selected.cwe && <span className="chip">{selected.cwe}</span>}
                <span className="chip">{selected.category}</span>
              </div>
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--subtle)', marginBottom: 6 }}>Description</p>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{selected.description}</p>
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--subtle)', marginBottom: 6 }}>Evidence</p>
              <pre className="code" style={{ fontSize: 11 }}>{selected.evidence}</pre>
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--subtle)', marginBottom: 6 }}>Recommendation</p>
              <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{selected.recommendation}</p>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <span className="chip" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{selected.file}:{selected.line}</span>
            </div>

            <div className="alert alert-info" style={{ fontSize: 12 }}>
              This is a static analysis finding. Verify manually before remediating in production.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
