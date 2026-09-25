import React, { useState } from 'react';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'connected' | 'coming-soon' | 'configure';
  icon: string;
  features?: string[];
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Connect your GitHub repository to enable PR creation, issue sync, and commit-level investigations.',
    category: 'Version Control',
    status: 'configure',
    icon: '◎',
    features: ['Create pull requests from fix plans', 'Link investigations to GitHub Issues', 'Read commit history for blame analysis', 'Post review comments on PRs'],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'GitLab MR creation, pipeline status, and issue tracking integration.',
    category: 'Version Control',
    status: 'coming-soon',
    icon: '◐',
    features: ['Merge request creation', 'Pipeline status', 'Issue tracker sync'],
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Sync issues with Jira tickets. Create Jira issues from investigations and update status automatically.',
    category: 'Issue Tracking',
    status: 'coming-soon',
    icon: '◑',
    features: ['Auto-create Jira tickets from investigations', 'Update ticket status on fix completion', 'Link investigations to existing tickets'],
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Create Linear issues, assign to cycles, and track investigation status in your Linear workspace.',
    category: 'Issue Tracking',
    status: 'coming-soon',
    icon: '◫',
    features: ['Issue creation from investigations', 'Cycle assignment', 'Status sync'],
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Import Sentry errors directly as bug reports. Map stack traces to source files automatically.',
    category: 'Error Monitoring',
    status: 'coming-soon',
    icon: '⊗',
    features: ['Import errors as investigations', 'Stack trace → source mapping', 'Issue deduplication', 'Release correlation'],
  },
  {
    id: 'datadog',
    name: 'Datadog',
    description: 'Pull logs, traces, and APM data into investigations. Correlate performance anomalies with code changes.',
    category: 'Observability',
    status: 'coming-soon',
    icon: '◈',
    features: ['Log ingestion', 'Trace correlation', 'APM metrics', 'Alert-triggered investigations'],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Receive investigation updates, approval requests, and incident alerts in Slack.',
    category: 'Communication',
    status: 'coming-soon',
    icon: '⊞',
    features: ['Investigation notifications', 'Approval requests in Slack', 'Incident alerts', 'Daily digest'],
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    description: 'Trigger investigations automatically when a PagerDuty incident is created.',
    category: 'Incident Management',
    status: 'coming-soon',
    icon: '⚡',
    features: ['Incident-triggered investigations', 'Auto-escalation', 'MTTR tracking'],
  },
];

const CATEGORIES = ['All', 'Version Control', 'Issue Tracking', 'Error Monitoring', 'Observability', 'Communication', 'Incident Management'];

function statusBadge(status: Integration['status']) {
  if (status === 'connected') return <span className="badge badge-success">Connected</span>;
  if (status === 'configure') return <span className="badge badge-accent">Configure</span>;
  return <span className="badge badge-coming">Coming Soon</span>;
}

export function IntegrationsPage() {
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<Integration | null>(null);

  const filtered = INTEGRATIONS.filter(i => category === 'All' || i.category === category);

  return (
    <div className="page-content stack-lg">
      {/* Header */}
      <div className="spread">
        <div>
          <h1 className="page-title">Integrations</h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            Connect FixFlow AI to your existing tools and services.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="badge badge-success">1 active</span>
          <span className="badge badge-coming">{INTEGRATIONS.filter(i => i.status === 'coming-soon').length} coming soon</span>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) 360px' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, gridColumn: 1 }}>
          {filtered.map(integration => (
            <button
              key={integration.id}
              className={selected?.id === integration.id ? 'panel-selected' : 'panel'}
              style={{
                padding: 18,
                textAlign: 'left',
                cursor: integration.status !== 'coming-soon' ? 'pointer' : 'default',
                opacity: integration.status === 'coming-soon' ? 0.7 : 1,
                width: '100%',
              }}
              onClick={() => integration.status !== 'coming-soon' && setSelected(selected?.id === integration.id ? null : integration)}
            >
              <div className="spread" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20, color: 'var(--accent-text)' }}>{integration.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{integration.name}</span>
                </div>
                {statusBadge(integration.status)}
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>{integration.description}</p>
              <div style={{ marginTop: 8 }}>
                <span className="badge badge-muted" style={{ fontSize: 10 }}>{integration.category}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="panel stack" style={{ padding: 20, gap: 16, position: 'sticky', top: 80 }}>
            <div className="spread">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, color: 'var(--accent-text)' }}>{selected.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{selected.name}</span>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{selected.description}</p>

            {selected.features && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--subtle)', marginBottom: 8 }}>
                  Features
                </p>
                <ul style={{ margin: 0, padding: '0 0 0 16px', lineHeight: 1.8, fontSize: 13, color: 'var(--muted)' }}>
                  {selected.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}

            {selected.id === 'github' && (
              <div className="stack" style={{ gap: 14 }}>
                <label className="field">
                  <span className="field-label">GitHub Personal Access Token</span>
                  <input className="input" type="password" placeholder="ghp_…" />
                  <span className="field-hint">Requires repo, read:org, and workflow scopes.</span>
                </label>
                <label className="field">
                  <span className="field-label">Repository (owner/name)</span>
                  <input className="input" placeholder="myorg/myrepo" />
                </label>
                <button className="btn btn-primary">Connect GitHub</button>
                <div className="alert alert-info" style={{ fontSize: 12 }}>
                  GitHub connection is a preview feature. Token is stored in session memory only, never persisted.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
