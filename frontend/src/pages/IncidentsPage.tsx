import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

interface Incident {
  id: string;
  title: string;
  severity: 'p0' | 'p1' | 'p2' | 'p3';
  status: 'detected' | 'investigating' | 'mitigating' | 'resolved' | 'postmortem';
  services: string[];
  owner: string;
  detectedAt: string;
  resolvedAt?: string;
  symptoms: string[];
  timeline: { time: string; event: string; type: string }[];
}

const DEMO_INCIDENTS: Incident[] = [
  {
    id: 'INC-001',
    title: 'Orders API returning 500 — SQL column not found',
    severity: 'p1',
    status: 'resolved',
    services: ['orders-api', 'insightboard-backend'],
    owner: 'Developer',
    detectedAt: '2026-02-24T14:21:00Z',
    resolvedAt: '2026-02-24T14:33:00Z',
    symptoms: [
      'GET /api/orders returning HTTP 500',
      'Error log: "no such column: o.customer_name"',
      'Admin dashboard unable to load orders',
      'Affected users: internal admin team',
    ],
    timeline: [
      { time: '14:21', event: 'First error detected in server logs', type: 'error' },
      { time: '14:23', event: '127 errors in 2 minutes — threshold exceeded', type: 'error' },
      { time: '14:24', event: 'Investigation started automatically', type: 'info' },
      { time: '14:25', event: 'Database Agent identified SQL column mismatch', type: 'success' },
      { time: '14:27', event: 'Root cause confirmed: orders route query bug', type: 'success' },
      { time: '14:29', event: 'Change plan generated — 1 file, 1 line', type: 'info' },
      { time: '14:30', event: 'Human approved fix plan', type: 'info' },
      { time: '14:31', event: 'Fix applied by implementation agent', type: 'success' },
      { time: '14:32', event: 'All tests passing after fix', type: 'success' },
      { time: '14:33', event: 'Incident resolved', type: 'success' },
    ],
  },
  {
    id: 'INC-002',
    title: 'Dashboard empty — all API calls returning 404',
    severity: 'p0',
    status: 'resolved',
    services: ['frontend', 'insightboard-api'],
    owner: 'Developer',
    detectedAt: '2026-02-24T12:05:00Z',
    resolvedAt: '2026-02-24T12:25:00Z',
    symptoms: [
      'Dashboard shows no predictions',
      'Browser console: SyntaxError in JSON response',
      'Network tab: requests to /undefined/api/predictions',
      'Impact: all users of prediction dashboard',
    ],
    timeline: [
      { time: '12:05', event: 'User reports: dashboard empty since last deploy', type: 'warn' },
      { time: '12:08', event: 'Investigation started', type: 'info' },
      { time: '12:12', event: 'Evidence Agent: /undefined/ in request paths', type: 'success' },
      { time: '12:15', event: 'Code Agent: VITE_API_BASE vs VITE_API_URL mismatch found', type: 'success' },
      { time: '12:18', event: 'Root cause confirmed: wrong env variable name', type: 'success' },
      { time: '12:20', event: 'Fix approved and applied', type: 'info' },
      { time: '12:25', event: 'Dashboard loading normally — incident resolved', type: 'success' },
    ],
  },
];

const SEV_COLORS: Record<string, string> = {
  p0: 'var(--danger)', p1: 'var(--danger)', p2: 'var(--warn)', p3: 'var(--info)'
};
const STATUS_COLORS: Record<string, string> = {
  detected: 'var(--danger)', investigating: 'var(--info)', mitigating: 'var(--warn)',
  resolved: 'var(--accent)', postmortem: 'var(--subtle)'
};

/** Download a string as a file in the browser. */
function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildPostmortemMarkdown(inc: Incident): string {
  const duration = (i: Incident) => {
    if (!i.resolvedAt) return 'Ongoing';
    const ms = new Date(i.resolvedAt).getTime() - new Date(i.detectedAt).getTime();
    return `${Math.round(ms / 60000)} minutes`;
  };
  const rootCause = inc.id === 'INC-001'
    ? 'SQL query in orders route referenced a column (o.customer_name) that does not exist in the schema. Correct column is o.customer.'
    : 'Frontend API client read a misnamed environment variable (VITE_API_BASE instead of VITE_API_URL), causing all API requests to use an undefined base URL.';

  return `# Postmortem: ${inc.id} — ${inc.title}

**Severity:** ${inc.severity.toUpperCase()}
**Status:** ${inc.status}
**Detected:** ${new Date(inc.detectedAt).toLocaleString()}
${inc.resolvedAt ? `**Resolved:** ${new Date(inc.resolvedAt).toLocaleString()}  \n` : ''}**Duration:** ${duration(inc)}
**Services:** ${inc.services.join(', ')}
**Owner:** ${inc.owner}

---

## Summary

${inc.title} — resolved in ${duration(inc)}.
${inc.status === 'resolved' ? 'Fully resolved with no data loss.' : 'Ongoing.'}

## Impact

Services affected: ${inc.services.join(', ')}. Duration: ${duration(inc)}.
Symptoms: ${inc.symptoms[0]}.

## Root Cause

${rootCause}

## Detection

${inc.timeline[0]?.event}. Escalated at ${inc.timeline[1]?.time}.

## Timeline

${inc.timeline.map((e) => `- **${e.time}** — ${e.event}`).join('\n')}

## Resolution

${inc.timeline.filter((e) => e.type === 'success').slice(-1)[0]?.event ?? 'Fix applied by implementation agent.'}

## What Went Well

- FixFlow agents identified root cause in under 4 minutes.
- Minimal patch — 1 file, 1 line.
- All regression tests passed.

## Corrective Actions

- Add SQL column name validation in query builder.
- Add integration test that catches column mismatch at startup.
- Review environment variable naming conventions.

---

*Generated by FixFlow AI Incident Center*
`;
}

export function IncidentsPage() {
  const [selected, setSelected] = useState<Incident>(DEMO_INCIDENTS[0]);
  const [tab, setTab] = useState<'list' | 'detail' | 'postmortem'>('list');
  const [kbAdded, setKbAdded] = useState<Set<string>>(new Set());

  const resolvedCount = DEMO_INCIDENTS.filter((i) => i.status === 'resolved').length;
  const activeCount = DEMO_INCIDENTS.filter((i) => !['resolved', 'postmortem'].includes(i.status)).length;

  const incidentDuration = (inc: Incident) => {
    if (!inc.resolvedAt) return 'Ongoing';
    const ms = new Date(inc.resolvedAt).getTime() - new Date(inc.detectedAt).getTime();
    const mins = Math.round(ms / 60000);
    return `${mins}m`;
  };

  return (
    <div className="page-content stack" style={{ gap: 22 }}>
      {/* Summary */}
      <div className="metric-grid">
        <div className="metric">
          <p className="metric-value" style={{ color: activeCount > 0 ? 'var(--danger)' : 'var(--muted)' }}>{activeCount}</p>
          <p className="metric-label">Active incidents</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--accent)' }}>{resolvedCount}</p>
          <p className="metric-label">Resolved</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--warn)' }}>12m</p>
          <p className="metric-label">Avg resolution</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--info)' }}>100%</p>
          <p className="metric-label">Agent-assisted</p>
        </div>
      </div>

      {activeCount === 0 && (
        <div className="banner banner-ok">
          <div>
            <p className="banner-title" style={{ color: 'var(--accent)' }}>✓ No active incidents</p>
            <p className="banner-text">All services are operating normally.</p>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'list'} className="tab" onClick={() => setTab('list')}>Incidents</button>
        <button role="tab" aria-selected={tab === 'detail'} className="tab" onClick={() => setTab('detail')}>
          {selected.id} Timeline
        </button>
        <button role="tab" aria-selected={tab === 'postmortem'} className="tab" onClick={() => setTab('postmortem')}>Postmortem</button>
      </div>

      {tab === 'list' && (
        <div className="stack" style={{ gap: 12 }}>
          {DEMO_INCIDENTS.map((inc) => (
            <button
              key={inc.id}
              className="panel"
              style={{ padding: '16px 20px', textAlign: 'left', cursor: 'pointer', width: '100%', borderLeft: `3px solid ${SEV_COLORS[inc.severity]}`, background: selected.id === inc.id ? 'rgba(255,255,255,.02)' : undefined }}
              onClick={() => { setSelected(inc); setTab('detail'); }}
            >
              <div className="spread">
                <div className="row" style={{ gap: 12 }}>
                  <span className="chip mono" style={{ fontSize: 10, color: SEV_COLORS[inc.severity] }}>{inc.severity.toUpperCase()}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{inc.title}</span>
                </div>
                <Badge variant={inc.status === 'resolved' ? 'success' : 'danger'} dot>{inc.status}</Badge>
              </div>
              <div className="row" style={{ gap: 14, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Duration: {incidentDuration(inc)}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Services: {inc.services.join(', ')}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Owner: {inc.owner}</span>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {inc.symptoms.slice(0, 2).map((s, i) => (
                  <span key={i} style={{ fontSize: 11, color: 'var(--subtle)', background: 'var(--panel-sunken)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--line)' }}>{s}</span>
                ))}
                {inc.symptoms.length > 2 && (
                  <span style={{ fontSize: 11, color: 'var(--subtle)' }}>+{inc.symptoms.length - 2} more</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'detail' && (
        <div className="stack" style={{ gap: 16 }}>
          <Card title={`${selected.id} — Incident Timeline`} action={
            <Badge variant={selected.status === 'resolved' ? 'success' : 'danger'} dot>{selected.status}</Badge>
          }>
            <div className="stack" style={{ gap: 10, marginBottom: 16 }}>
              <dl className="kv" style={{ rowGap: 8 }}>
                <dt>Severity</dt><dd style={{ color: SEV_COLORS[selected.severity], fontWeight: 700 }}>{selected.severity.toUpperCase()}</dd>
                <dt>Duration</dt><dd>{incidentDuration(selected)}</dd>
                <dt>Services</dt><dd>{selected.services.join(', ')}</dd>
                <dt>Owner</dt><dd>{selected.owner}</dd>
                <dt>Detected</dt><dd className="mono" style={{ fontSize: 12 }}>{new Date(selected.detectedAt).toLocaleString()}</dd>
                {selected.resolvedAt && <><dt>Resolved</dt><dd className="mono" style={{ fontSize: 12 }}>{new Date(selected.resolvedAt).toLocaleString()}</dd></>}
              </dl>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Timeline</p>
            <div className="timeline">
              {selected.timeline.map((ev, i) => (
                <div key={i} className="timeline-item">
                  <div className={`timeline-dot timeline-dot-${ev.type}`} />
                  <span className="timeline-time mono">{ev.time}</span>
                  <span className="timeline-event">{ev.event}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="row" style={{ gap: 10 }}>
            <Link to="/investigations" className="btn btn-sm">View related investigation</Link>
            <button className="btn btn-sm" onClick={() => setTab('postmortem')}>Generate postmortem →</button>
          </div>
        </div>
      )}

      {tab === 'postmortem' && (
        <div className="stack" style={{ gap: 14 }}>
          <Card title={`Postmortem — ${selected.id}`}>
            <div className="stack" style={{ gap: 14 }}>
              <PostSection label="Summary">
                {selected.title} — resolved in {incidentDuration(selected)}.
                {selected.status === 'resolved' ? ' Fully resolved with no data loss.' : ' Ongoing.'}
              </PostSection>
              <PostSection label="Impact">
                Services affected: {selected.services.join(', ')}. Duration: {incidentDuration(selected)}.
                Symptoms: {selected.symptoms[0]}.
              </PostSection>
              <PostSection label="Root Cause">
                {selected.id === 'INC-001'
                  ? 'SQL query in orders route referenced a column (o.customer_name) that does not exist in the schema. Correct column is o.customer.'
                  : 'Frontend API client read a misnamed environment variable (VITE_API_BASE instead of VITE_API_URL), causing all API requests to use an undefined base URL.'}
              </PostSection>
              <PostSection label="Detection">
                {selected.timeline[0].event}. Escalated at {selected.timeline[1].time}.
              </PostSection>
              <PostSection label="Resolution">
                {selected.timeline.filter((e) => e.type === 'success').slice(-1)[0]?.event ?? 'Fix applied by implementation agent.'}
              </PostSection>
              <PostSection label="What Went Well">
                • FixFlow agents identified root cause in under 4 minutes.{'\n'}
                • Minimal patch — 1 file, 1 line.{'\n'}
                • All regression tests passed.
              </PostSection>
              <PostSection label="Corrective Actions">
                • Add SQL column name validation in query builder.{'\n'}
                • Add integration test that catches column mismatch at startup.{'\n'}
                • Review environment variable naming conventions.
              </PostSection>
              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => downloadText(
                    `postmortem-${selected.id.toLowerCase()}.md`,
                    buildPostmortemMarkdown(selected)
                  )}
                >
                  ↓ Export postmortem (Markdown)
                </button>
                <button
                  className={`btn btn-sm ${kbAdded.has(selected.id) ? 'btn-success' : ''}`}
                  onClick={() => setKbAdded((prev) => new Set(prev).add(selected.id))}
                  disabled={kbAdded.has(selected.id)}
                >
                  {kbAdded.has(selected.id) ? '✓ Added to Knowledge Base' : 'Add to Knowledge Base'}
                </button>
              </div>
              {kbAdded.has(selected.id) && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--subtle)' }}>
                  Postmortem saved to session Knowledge Base. Navigate to <a href="/knowledge" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Knowledge Base</a> to view.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function PostSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--panel-sunken)', borderRadius: 10, border: '1px solid var(--line)' }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{children}</p>
    </div>
  );
}
