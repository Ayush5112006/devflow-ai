import React from 'react';
import { Link } from 'react-router-dom';
import { ComingSoon } from '../components/ComingSoon.js';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

const INTEGRATIONS = [
  {
    name: 'Datadog',
    logo: '📊',
    status: 'not_connected' as const,
    description: 'APM, logs, metrics, and alerts from Datadog.',
    planned: 'Connect production observability to FixFlow investigations. Auto-trigger investigations when error rates spike.',
  },
  {
    name: 'Sentry',
    logo: '🔍',
    status: 'not_connected' as const,
    description: 'Error tracking and performance monitoring.',
    planned: 'Auto-create investigations from Sentry issues. Link stack traces to root cause analysis.',
  },
  {
    name: 'PagerDuty',
    logo: '🚨',
    status: 'not_connected' as const,
    description: 'On-call alerting and incident management.',
    planned: 'Trigger investigations from PagerDuty alerts. Push resolution updates back to PagerDuty.',
  },
  {
    name: 'Prometheus / Grafana',
    logo: '📈',
    status: 'not_connected' as const,
    description: 'Open-source metrics and visualization.',
    planned: 'Pull service health metrics into investigation context. Correlate metric spikes with bug reports.',
  },
  {
    name: 'CloudWatch',
    logo: '☁️',
    status: 'not_connected' as const,
    description: 'AWS CloudWatch logs, metrics and alarms.',
    planned: 'Ingest CloudWatch alarms as incident triggers. Pull related logs as evidence.',
  },
  {
    name: 'New Relic',
    logo: '🔬',
    status: 'not_connected' as const,
    description: 'Full-stack observability platform.',
    planned: 'Deep integration with distributed traces and error analytics.',
  },
];

export function MonitoringPage() {
  return (
    <div className="page-content stack" style={{ gap: 24 }}>
      {/* Header */}
      <div className="spread">
        <div>
          <h1 className="page-title">Monitoring</h1>
          <p className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
            Connect production observability tools to route incidents and alerts into FixFlow investigations.
          </p>
        </div>
        <Badge variant="info">No integrations connected</Badge>
      </div>

      {/* Status overview */}
      <div className="metric-grid">
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--muted)' }}>—</p>
          <p className="metric-label">Active alerts</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--muted)' }}>—</p>
          <p className="metric-label">Error rate (1h)</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--muted)' }}>—</p>
          <p className="metric-label">P95 latency</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--muted)' }}>—</p>
          <p className="metric-label">Service health</p>
        </div>
      </div>

      {/* Not connected banner */}
      <div className="banner banner-info">
        <div>
          <p className="banner-title" style={{ color: 'var(--info)' }}>No observability integration connected</p>
          <p className="banner-text">
            Connect a monitoring provider to see live error rates, latency, health checks, and alerts here.
            Without an integration, this page cannot show live data.
          </p>
        </div>
        <Link to="/integrations" className="btn btn-sm btn-primary" style={{ flex: 'none' }}>
          Configure integrations →
        </Link>
      </div>

      {/* Available integrations */}
      <section>
        <div className="section-heading">
          <h2>Available Integrations</h2>
          <p>Connect a provider to enable live monitoring</p>
        </div>
        <div className="card-grid-2">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="panel"
              style={{ padding: '16px 20px', borderStyle: 'dashed', opacity: 0.85 }}
            >
              <div className="spread" style={{ marginBottom: 8 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{integration.logo}</span>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{integration.name}</p>
                </div>
                <span className="badge badge-coming">Coming Soon</span>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                {integration.description}
              </p>
              <div style={{ padding: '8px 12px', background: 'rgba(56,189,248,.06)', borderRadius: 8, border: '1px solid rgba(56,189,248,.15)' }}>
                <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Planned</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{integration.planned}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What monitoring will enable */}
      <section>
        <div className="section-heading">
          <h2>What monitoring enables</h2>
          <p>Capabilities unlocked when an observability integration is connected</p>
        </div>
        <div className="card-grid-2">
          {[
            {
              title: 'Automatic incident triggers',
              desc: 'When error rate exceeds threshold, FixFlow automatically creates an incident and starts an investigation.',
              icon: '⚡',
              color: 'var(--danger)',
            },
            {
              title: 'Live error correlation',
              desc: 'Link production errors directly to specific code changes, commits, and agents for root cause analysis.',
              icon: '🔗',
              color: 'var(--info)',
            },
            {
              title: 'Deployment health checks',
              desc: 'After each deployment, monitor error rates and latency automatically. Rollback recommendations if thresholds breach.',
              icon: '🚀',
              color: 'var(--accent)',
            },
            {
              title: 'Performance baselines',
              desc: 'Establish baseline metrics per service. Detect performance regressions introduced by fixes.',
              icon: '📊',
              color: 'var(--warn)',
            },
          ].map((item) => (
            <div key={item.title} className="panel" style={{ padding: '14px 18px' }}>
              <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: item.color }}>{item.title}</p>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Link to incidents */}
      <div className="banner banner-warn">
        <div>
          <p className="banner-title" style={{ color: 'var(--warn)' }}>View existing demo incidents</p>
          <p className="banner-text">
            The Incidents page contains demo scenarios showing how FixFlow handles production incidents end-to-end,
            including postmortem generation and knowledge base integration.
          </p>
        </div>
        <Link to="/incidents" className="btn btn-sm" style={{ flex: 'none' }}>
          View Incidents →
        </Link>
      </div>
    </div>
  );
}
