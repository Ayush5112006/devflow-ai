import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { Badge, severityBadge } from '../components/Badge.js';
import { Card } from '../components/Card.js';

type IssueStatus = 'open' | 'triaged' | 'investigating' | 'planned' | 'in_progress' | 'testing' | 'resolved' | 'closed';
type IssuePriority = 'critical' | 'high' | 'medium' | 'low';
type IssueCategory = 'bug' | 'performance' | 'security' | 'api' | 'database' | 'frontend' | 'backend' | 'config' | 'dependency';

interface Issue {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  category: IssueCategory;
  severity: string;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  evidence: { kind: string; name: string }[];
  investigationId?: string;
  labels: string[];
}

const DEMO_ISSUES: Issue[] = [
  {
    id: 'ISS-001',
    title: 'Prediction detail card shows blank sentiment badge',
    description: 'Clicking a prediction row throws a TypeError and the detail panel never renders.',
    status: 'resolved',
    priority: 'high',
    category: 'frontend',
    severity: 'high',
    assignee: 'Developer',
    createdAt: '2026-02-24T12:10:00Z',
    updatedAt: '2026-02-24T14:33:00Z',
    evidence: [{ kind: 'log', name: 'browser-console.log' }],
    investigationId: undefined,
    labels: ['frontend', 'api-contract'],
  },
  {
    id: 'ISS-002',
    title: 'Dashboard empty — all API calls 404',
    description: 'Browser requests /undefined/api/predictions and receives HTML 404 response.',
    status: 'resolved',
    priority: 'critical',
    category: 'config',
    severity: 'critical',
    assignee: 'Developer',
    createdAt: '2026-02-24T12:08:00Z',
    updatedAt: '2026-02-24T14:20:00Z',
    evidence: [{ kind: 'log', name: 'browser-console.log' }, { kind: 'log', name: 'server-access.log' }],
    investigationId: undefined,
    labels: ['configuration', 'env-vars'],
  },
  {
    id: 'ISS-003',
    title: 'GET /api/orders returns 500 — SQL column mismatch',
    description: 'Orders route throws "no such column: o.customer_name" while /api/revenue still works.',
    status: 'resolved',
    priority: 'critical',
    category: 'database',
    severity: 'critical',
    assignee: 'Developer',
    createdAt: '2026-02-24T11:59:00Z',
    updatedAt: '2026-02-24T13:45:00Z',
    evidence: [{ kind: 'log', name: 'server-error.log' }, { kind: 'http', name: 'curl-output.txt' }],
    investigationId: undefined,
    labels: ['database', 'sql'],
  },
  {
    id: 'ISS-004',
    title: 'SQL injection risk in orders limit parameter',
    description: 'User-supplied limit parameter interpolated directly into SQL query without parameterisation.',
    status: 'open',
    priority: 'high',
    category: 'security',
    severity: 'high',
    createdAt: '2026-02-25T09:00:00Z',
    updatedAt: '2026-02-25T09:00:00Z',
    evidence: [],
    labels: ['security', 'sql-injection'],
  },
  {
    id: 'ISS-005',
    title: 'No rate limiting on API endpoints',
    description: 'No express-rate-limit or equivalent middleware configured. All endpoints accept unlimited requests.',
    status: 'triaged',
    priority: 'medium',
    category: 'security',
    severity: 'low',
    createdAt: '2026-02-25T10:30:00Z',
    updatedAt: '2026-02-25T11:00:00Z',
    evidence: [],
    labels: ['security', 'configuration'],
  },
];

const STATUS_FLOW: IssueStatus[] = ['open', 'triaged', 'investigating', 'planned', 'in_progress', 'testing', 'resolved', 'closed'];

const STATUS_COLORS: Record<IssueStatus, string> = {
  open: 'var(--danger)',
  triaged: 'var(--warn)',
  investigating: 'var(--info)',
  planned: '#a78bfa',
  in_progress: 'var(--info)',
  testing: 'var(--warn)',
  resolved: 'var(--accent)',
  closed: 'var(--subtle)',
};

export function IssuesPage() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>(DEMO_ISSUES);
  const [filter, setFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Issue | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSeverity, setNewSeverity] = useState<IssuePriority>('medium');
  const [newCategory, setNewCategory] = useState<IssueCategory>('bug');

  const filtered = filter === 'all' ? issues : issues.filter((i) =>
    filter === 'open' ? ['open', 'triaged', 'investigating', 'planned', 'in_progress', 'testing'].includes(i.status)
    : filter === 'resolved' ? ['resolved', 'closed'].includes(i.status)
    : i.category === filter || i.priority === filter
  );

  function createIssue() {
    if (!newTitle.trim()) return;
    const issue: Issue = {
      id: `ISS-${String(issues.length + 1).padStart(3, '0')}`,
      title: newTitle,
      description: newDesc,
      status: 'open',
      priority: newSeverity,
      category: newCategory,
      severity: newSeverity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidence: [],
      labels: [newCategory],
    };
    setIssues((prev) => [issue, ...prev]);
    setCreating(false);
    setNewTitle('');
    setNewDesc('');
    setSelected(issue);
  }

  const openCount = issues.filter((i) => !['resolved', 'closed'].includes(i.status)).length;
  const criticalCount = issues.filter((i) => i.priority === 'critical' && !['resolved', 'closed'].includes(i.status)).length;

  return (
    <div className="page-content stack" style={{ gap: 22 }}>
      {/* DEMO notice */}
      <div className="banner banner-warn" style={{ padding: '10px 14px' }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="demo-notice">DEMO</span>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
            Issues shown are from the InsightBoard demo project. In production, issues would be imported from your issue tracker or created from investigation findings.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="spread">
        <div>
          <div className="row" style={{ gap: 14 }}>
            <h1 className="page-title">Issues</h1>
            <span className="chip mono">{openCount} open</span>
            {criticalCount > 0 && (
              <Badge variant="danger" dot>{criticalCount} critical</Badge>
            )}
            <span className="demo-notice">DEMO DATA</span>
          </div>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
            Track, triage and investigate software issues from report to resolution.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New Issue</button>
      </div>

      {/* Create form */}
      {creating && (
        <Card title="New Issue" action={
          <button className="btn btn-sm btn-link" onClick={() => setCreating(false)}>✕ Cancel</button>
        }>
          <div className="stack" style={{ gap: 14 }}>
            <label className="field">
              <span className="field-label">Title <span style={{ color: 'var(--danger)' }}>*</span></span>
              <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Login fails with 401 on valid credentials" />
            </label>
            <label className="field">
              <span className="field-label">Description</span>
              <textarea className="textarea" rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What is broken? What is the impact?" />
            </label>
            <div className="card-grid-2" style={{ gap: 12 }}>
              <label className="field">
                <span className="field-label">Priority / Severity</span>
                <select className="select" value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as IssuePriority)}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Category</span>
                <select className="select" value={newCategory} onChange={(e) => setNewCategory(e.target.value as IssueCategory)}>
                  {(['bug','performance','security','api','database','frontend','backend','config','dependency'] as IssueCategory[]).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-primary" onClick={createIssue} disabled={!newTitle.trim()}>Create issue</button>
              <Link to="/new" className="btn btn-sm" onClick={() => setCreating(false)}>
                Create + investigate →
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="card-grid-sidebar">
        {/* List */}
        <div className="stack" style={{ gap: 12 }}>
          {/* Filters */}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: `All (${issues.length})` },
              { key: 'open', label: `Open (${openCount})` },
              { key: 'resolved', label: 'Resolved' },
              { key: 'security', label: 'Security' },
              { key: 'database', label: 'Database' },
            ].map((f) => (
              <button
                key={f.key}
                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Issue rows */}
          <div className="panel" style={{ overflow: 'hidden' }}>
            {filtered.map((issue, i) => (
              <button
                key={issue.id}
                className="issue-row"
                style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : undefined,
                  background: selected?.id === issue.id ? 'rgba(183,243,107,.04)' : undefined,
                }}
                onClick={() => setSelected(issue)}
              >
                <div className="row" style={{ gap: 10, minWidth: 0, flex: 1 }}>
                  <span className="issue-status-dot" style={{ background: STATUS_COLORS[issue.status] }} />
                  <span className="chip mono" style={{ fontSize: 10 }}>{issue.id}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {issue.title}
                  </span>
                </div>
                <div className="row" style={{ gap: 6, flex: 'none' }}>
                  {severityBadge(issue.severity)}
                  <IssueCategoryChip cat={issue.category} />
                  <IssueStatusBadge status={issue.status} />
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="empty"><p className="empty-title">No issues match filter</p></div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected ? (
          <IssueDetail issue={selected} onClose={() => setSelected(null)} />
        ) : (
          <Card title="Issue Detail">
            <div className="empty" style={{ minHeight: 200 }}>
              <p className="empty-title">Select an issue</p>
              <p className="empty-text">Click any issue to view details, evidence, triage, and linked investigation.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function IssueDetail({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Card title={issue.id} action={
      <button className="btn btn-sm btn-link" onClick={onClose}>✕</button>
    }>
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4 }}>{issue.title}</h3>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {severityBadge(issue.severity)}
            <IssueStatusBadge status={issue.status} />
            <IssueCategoryChip cat={issue.category} />
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{issue.description}</p>

        {/* AI Triage box */}
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(183,243,107,.06)', border: '1px solid rgba(183,243,107,.18)' }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em' }}>AI Triage</p>
          <dl className="kv" style={{ rowGap: 6 }}>
            <dt>Category</dt><dd>{issue.category}</dd>
            <dt>Severity</dt><dd style={{ color: issue.priority === 'critical' || issue.priority === 'high' ? 'var(--danger)' : 'var(--warn)' }}>{issue.priority}</dd>
            <dt>Layer</dt><dd>{issue.category === 'frontend' ? 'UI/Client' : issue.category === 'database' ? 'Data layer' : issue.category === 'security' ? 'Security' : 'Backend/API'}</dd>
            <dt>Reproducibility</dt><dd>Confirmed</dd>
          </dl>
        </div>

        <dl className="kv" style={{ rowGap: 8 }}>
          <dt>Status</dt><dd><IssueStatusBadge status={issue.status} /></dd>
          <dt>Assignee</dt><dd>{issue.assignee ?? 'Unassigned'}</dd>
          <dt>Created</dt><dd>{new Date(issue.createdAt).toLocaleDateString()}</dd>
          {issue.labels.length > 0 && (
            <>
              <dt>Labels</dt>
              <dd>{issue.labels.map((l) => <span key={l} className="chip mono" style={{ fontSize: 10, marginRight: 4 }}>{l}</span>)}</dd>
            </>
          )}
          {issue.evidence.length > 0 && (
            <>
              <dt>Evidence</dt>
              <dd>{issue.evidence.map((e) => <span key={e.name} className="chip mono" style={{ fontSize: 10, marginRight: 4 }}>{e.kind}: {e.name}</span>)}</dd>
            </>
          )}
        </dl>

        {/* Lifecycle status bar */}
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Lifecycle</p>
          <div className="issue-lifecycle">
            {STATUS_FLOW.slice(0, -1).map((s) => {
              const currentIdx = STATUS_FLOW.indexOf(issue.status);
              const sIdx = STATUS_FLOW.indexOf(s);
              const done = sIdx <= currentIdx;
              return (
                <div key={s} className="issue-lifecycle-step" title={s.replace(/_/g, ' ')}>
                  <div className={`issue-lifecycle-dot ${done ? 'done' : ''}`} style={{ background: done ? STATUS_COLORS[s] : undefined }} />
                  <span className="issue-lifecycle-label">{s.replace(/_/g, ' ')}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {issue.investigationId ? (
            <Link to={`/investigations/${issue.investigationId}`} className="btn btn-sm btn-primary">
              View investigation →
            </Link>
          ) : (
            <Link
              to="/new"
              state={{
                title: issue.title,
                description: issue.description,
                severity: issue.priority,
              }}
              className="btn btn-sm btn-primary"
            >
              Investigate →
            </Link>
          )}
          <Link to="/debugging" className="btn btn-sm">Debug</Link>
          <Link to="/code-review" className="btn btn-sm">Review</Link>
        </div>
      </div>
    </Card>
  );
}

function IssueCategoryChip({ cat }: { cat: IssueCategory }) {
  const colors: Record<string, string> = {
    bug: 'var(--danger)', security: '#f472b6', database: '#a78bfa',
    api: 'var(--accent)', frontend: 'var(--info)', backend: 'var(--warn)',
    performance: '#fb923c', config: 'var(--subtle)', dependency: 'var(--muted)',
  };
  const c = colors[cat] ?? 'var(--muted)';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', background: c + '22', color: c, border: `1px solid ${c}44` }}>
      {cat}
    </span>
  );
}

function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', background: c + '22', color: c, border: `1px solid ${c}44` }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
