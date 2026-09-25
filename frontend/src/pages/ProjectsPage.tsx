import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Badge } from '../components/Badge.js';
import { Card } from '../components/Card.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

const ARCH_LAYERS: { id: string; label: string; files: string[]; color: string }[] = [
  { id: 'frontend', label: 'Frontend', files: ['src/frontend/', 'web/', 'ui/', 'client/'], color: 'var(--info)' },
  { id: 'api', label: 'API Layer', files: ['src/routes/', 'api/', 'controllers/'], color: 'var(--accent)' },
  { id: 'services', label: 'Services', files: ['src/services/', 'services/'], color: 'var(--warn)' },
  { id: 'database', label: 'Database', files: ['src/models/', 'db/', 'database/'], color: '#a78bfa' },
  { id: 'agents', label: 'AI Agents', files: ['src/agents/'], color: '#f472b6' },
];

const HEALTH_CHECKS = [
  { id: 'build', label: 'Build', status: 'pass', detail: 'Last built 2 min ago' },
  { id: 'tests', label: 'Tests', status: 'pass', detail: '47/47 passing' },
  { id: 'lint', label: 'Lint', status: 'warn', detail: '3 warnings' },
  { id: 'security', label: 'Security', status: 'pass', detail: 'No critical CVEs' },
  { id: 'deps', label: 'Dependencies', status: 'warn', detail: '2 outdated packages' },
  { id: 'git', label: 'Git', status: 'pass', detail: 'main up to date' },
];

const DEMO_FILES: { name: string; layer: string; language: string; size: string }[] = [
  { name: 'src/api/server.js', layer: 'api', language: 'JavaScript', size: '4.2 KB' },
  { name: 'src/routes/orders.js', layer: 'api', language: 'JavaScript', size: '2.1 KB' },
  { name: 'src/routes/predictions.js', layer: 'api', language: 'JavaScript', size: '3.8 KB' },
  { name: 'src/db/schema.sql', layer: 'database', language: 'SQL', size: '1.4 KB' },
  { name: 'web/app.js', layer: 'frontend', language: 'JavaScript', size: '8.7 KB' },
  { name: 'web/index.html', layer: 'frontend', language: 'HTML', size: '0.9 KB' },
  { name: 'test/api.test.js', layer: 'test', language: 'JavaScript', size: '6.3 KB' },
];

export function ProjectsPage() {
  const [projects, setProjects] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);

  React.useEffect(() => {
    api.projects()
      .then(({ projects }) => { setProjects(projects); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading projects…" />;

  const project = projects[0] ?? {
    id: 'insightboard',
    name: 'InsightBoard',
    description: 'Customer-feedback sentiment dashboard. Node http API, SQLite storage, vanilla web bundle, node:test suites.',
    isDemo: true,
    bugCount: 3,
  };

  return (
    <div className="page-content stack" style={{ gap: 24 }}>
      {/* Project Header */}
      <div className="project-header">
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <div className="project-avatar">{project.name[0]}</div>
          <div>
            <h1 className="page-title" style={{ marginBottom: 6 }}>{project.name}</h1>
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6, maxWidth: '60ch' }}>{project.description}</p>
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <Badge variant="info" dot>Active</Badge>
              {project.isDemo && <Badge variant="muted">Demo project</Badge>}
              <span className="chip mono">insightboard</span>
            </div>
          </div>
        </div>
      </div>

      {/* Health Row */}
      <Card title="Project Health">
        <div className="health-grid">
          {HEALTH_CHECKS.map((h) => (
            <div key={h.id} className="health-item">
              <div className={`health-dot health-dot-${h.status}`} />
              <div>
                <p className="health-label">{h.label}</p>
                <p className="health-detail">{h.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="card-grid-2">
        {/* Architecture Map */}
        <Card title="Architecture Map">
          <div className="arch-map">
            {ARCH_LAYERS.map((layer, i) => (
              <React.Fragment key={layer.id}>
                <button
                  className={`arch-layer ${selectedLayer === layer.id ? 'arch-layer-active' : ''}`}
                  style={{ '--layer-color': layer.color } as any}
                  onClick={() => setSelectedLayer(selectedLayer === layer.id ? null : layer.id)}
                >
                  <span className="arch-layer-dot" />
                  <span>{layer.label}</span>
                  <span className="arch-layer-count">{DEMO_FILES.filter(f => f.layer === layer.id).length} files</span>
                </button>
                {i < ARCH_LAYERS.length - 1 && <div className="arch-arrow">↓</div>}
              </React.Fragment>
            ))}
          </div>
        </Card>

        {/* Project Info */}
        <Card title="Project Details">
          <dl className="kv" style={{ rowGap: 12 }}>
            <dt>Framework</dt><dd>Node.js + Express</dd>
            <dt>Languages</dt><dd>JavaScript, SQL, HTML</dd>
            <dt>Database</dt><dd>SQLite</dd>
            <dt>Test Runner</dt><dd>node:test</dd>
            <dt>Package Manager</dt><dd>npm</dd>
            <dt>Build System</dt><dd>Vite (frontend)</dd>
            <dt>Total files</dt><dd>{DEMO_FILES.length}</dd>
            <dt>Open bugs</dt><dd>
              <Link to="/investigations" style={{ color: 'var(--danger)', textDecoration: 'none', fontWeight: 600 }}>
                {project.bugCount} investigations
              </Link>
            </dd>
          </dl>
        </Card>
      </div>

      {/* File Explorer */}
      <Card title="Repository Files" action={
        <div className="row" style={{ gap: 6 }}>
          {['All', 'API', 'Frontend', 'Database', 'Test'].map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${selected === f ? 'btn-primary' : ''}`}
              onClick={() => setSelected(selected === f ? null : f)}
            >
              {f}
            </button>
          ))}
        </div>
      } flush>
        <table className="table">
          <thead>
            <tr>
              <th>File</th>
              <th>Layer</th>
              <th>Language</th>
              <th>Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_FILES
              .filter(f => !selected || selected === 'All' || f.layer.toLowerCase().includes(selected.toLowerCase()))
              .map((f) => (
                <tr key={f.name}>
                  <td className="mono" style={{ color: 'var(--ink)', fontSize: 12 }}>{f.name}</td>
                  <td><LayerBadge layer={f.layer} /></td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{f.language}</td>
                  <td style={{ color: 'var(--subtle)', fontFamily: 'var(--mono)', fontSize: 11 }}>{f.size}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <Link to="/code-intelligence" className="btn btn-sm btn-link">Explore</Link>
                      <Link to="/code-review" className="btn btn-sm btn-link">Review</Link>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>

      {/* Quick Actions */}
      <div className="card-grid-3">
        <ActionCard
          title="Start Investigation"
          description="Report a bug and launch agent-driven root cause analysis."
          icon="◎"
          href="/new"
          cta="New investigation"
        />
        <ActionCard
          title="Code Review"
          description="AI-powered code review across files, branches, or pull requests."
          icon="◑"
          href="/code-review"
          cta="Open code review"
        />
        <ActionCard
          title="Security Scan"
          description="Check for vulnerabilities, exposed secrets, and authorization gaps."
          icon="◻"
          href="/security"
          cta="Run security scan"
        />
      </div>
    </div>
  );
}

function LayerBadge({ layer }: { layer: string }) {
  const map: Record<string, string> = {
    api: 'var(--accent)',
    frontend: 'var(--info)',
    database: '#a78bfa',
    test: 'var(--warn)',
    services: '#f472b6',
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 999,
      background: (map[layer] ?? 'var(--muted)') + '22',
      color: map[layer] ?? 'var(--muted)',
      border: `1px solid ${(map[layer] ?? 'var(--muted)') + '44'}`,
      fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', textTransform: 'uppercase',
    }}>
      {layer}
    </span>
  );
}

function ActionCard({ title, description, icon, href, cta }: {
  title: string; description: string; icon: string; href: string; cta: string;
}) {
  return (
    <div className="action-card">
      <div className="action-icon">{icon}</div>
      <h3 className="action-title">{title}</h3>
      <p className="action-desc">{description}</p>
      <Link to={href} className="btn btn-sm btn-primary" style={{ marginTop: 'auto' }}>{cta}</Link>
    </div>
  );
}
