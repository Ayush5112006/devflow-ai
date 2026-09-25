import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  updatedAt: string;
  source: 'manual' | 'ai' | 'investigation';
}

const DEMO_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'kb-001',
    title: 'InsightBoard: API Contract — Prediction Object Shape',
    category: 'Architecture',
    content: 'The prediction API (/api/predictions) returns objects with the shape: { id, sentiment, confidence, customer }. Note: the sentiment field (not label) carries the classification result. This is validated by the API Agent in investigation INV-001.',
    tags: ['api', 'frontend', 'contract'],
    updatedAt: '2026-02-24',
    source: 'investigation',
  },
  {
    id: 'kb-002',
    title: 'InsightBoard: Database Schema — Orders Table',
    category: 'Database',
    content: 'The orders table has columns: id (INTEGER), customer (TEXT), amount (REAL), status (TEXT). The column is named "customer" not "customer_name". All queries must use o.customer. See ISS-003 for the impact of this discrepancy.',
    tags: ['database', 'sql', 'schema'],
    updatedAt: '2026-02-24',
    source: 'investigation',
  },
  {
    id: 'kb-003',
    title: 'InsightBoard: Environment Variables',
    category: 'Configuration',
    content: 'Required environment variables:\n• VITE_API_URL — The backend API base URL (used by the Vite frontend)\n\nCommon mistake: Reading VITE_API_BASE instead of VITE_API_URL causes undefined base URL in API client.',
    tags: ['configuration', 'environment', 'frontend'],
    updatedAt: '2026-02-24',
    source: 'investigation',
  },
  {
    id: 'kb-004',
    title: 'InsightBoard: Testing Instructions',
    category: 'Testing',
    content: 'Run tests: npm test\nTest framework: node:test\nTest files: test/api.test.js, test/predictions.test.js, test/db.test.js\n\nAll tests are API integration tests. No frontend unit tests yet. See Test Center for coverage details.',
    tags: ['testing', 'test-runner'],
    updatedAt: '2026-02-20',
    source: 'manual',
  },
  {
    id: 'kb-005',
    title: 'InsightBoard: Known Security Issues',
    category: 'Security',
    content: 'SEC-001: SQL injection risk in orders limit parameter — unparameterised query.\nSEC-003: Raw SQLite errors exposed in API response.\n\nSee Security Center for full details and remediation steps.',
    tags: ['security', 'sql', 'known-issues'],
    updatedAt: '2026-02-25',
    source: 'ai',
  },
];

const AI_MEMORY_ENTRIES = [
  { key: 'Database', value: 'SQLite with node:sqlite3 driver. Schema at src/db/schema.sql.' },
  { key: 'API framework', value: 'Express.js with JSON responses. Error format: { error: string }.' },
  { key: 'Test runner', value: 'node:test (built-in). Tests in test/ directory.' },
  { key: 'Frontend build', value: 'Vite. Frontend code in web/ directory.' },
  { key: 'Key bug pattern', value: 'API field names differ between frontend expectation and backend return.' },
  { key: 'Known risk', value: 'SQL queries in routes/ use raw column names without parameterisation.' },
];

const ONBOARDING_STEPS = [
  { title: 'Project Overview', done: true, desc: 'Node.js + Express backend, vanilla JS frontend, SQLite database.' },
  { title: 'Architecture', done: true, desc: 'Frontend (web/) → API (src/routes/) → Services → SQLite DB.' },
  { title: 'Important Files', done: true, desc: 'src/server.js, src/routes/orders.js, web/app.js, src/db/schema.sql.' },
  { title: 'Development Setup', done: false, desc: 'Run `npm install && npm start`. Frontend at :5173, API at :3000.' },
  { title: 'Testing', done: false, desc: 'Run `npm test`. Uses node:test. 47 tests total.' },
  { title: 'Known Issues', done: false, desc: 'See Issues page for 2 open security findings.' },
];

export function KnowledgePage() {
  const [tab, setTab] = useState<'articles' | 'memory' | 'onboarding'>('articles');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<KnowledgeArticle | null>(null);
  const [editingMemory, setEditingMemory] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [memoryEntries, setMemoryEntries] = useState(AI_MEMORY_ENTRIES);

  const filtered = DEMO_ARTICLES.filter((a) =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.content.toLowerCase().includes(search.toLowerCase()) ||
    a.tags.some((t) => t.includes(search.toLowerCase()))
  );

  return (
    <div className="page-content stack" style={{ gap: 22 }}>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'articles'} className="tab" onClick={() => setTab('articles')}>Knowledge Articles</button>
        <button role="tab" aria-selected={tab === 'memory'} className="tab" onClick={() => setTab('memory')}>AI Project Memory</button>
        <button role="tab" aria-selected={tab === 'onboarding'} className="tab" onClick={() => setTab('onboarding')}>Onboarding Tour</button>
      </div>

      {tab === 'articles' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <input
              className="input"
              placeholder="Search knowledge base…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm">+ New Article</button>
          </div>

          <div className="card-grid-sidebar">
            <div className="stack" style={{ gap: 8 }}>
              {filtered.map((a) => (
                <button
                  key={a.id}
                  className={`panel ${selected?.id === a.id ? 'panel-selected' : ''}`}
                  style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', width: '100%', borderColor: selected?.id === a.id ? 'rgba(183,243,107,.4)' : undefined }}
                  onClick={() => setSelected(a)}
                >
                  <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{a.category}</span>
                    <SourceBadge source={a.source} />
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{a.title}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }} className="truncate-2">
                    {a.content}
                  </p>
                  <div className="row" style={{ gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    {a.tags.map((t) => (
                      <span key={t} className="chip mono" style={{ fontSize: 10 }}>{t}</span>
                    ))}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="empty"><p className="empty-title">No articles found</p></div>
              )}
            </div>

            {selected ? (
              <Card title={selected.title} action={
                <div className="row" style={{ gap: 6 }}>
                  <SourceBadge source={selected.source} />
                  <button className="btn btn-sm btn-link" onClick={() => setSelected(null)}>✕</button>
                </div>
              }>
                <div className="stack" style={{ gap: 12 }}>
                  <dl className="kv" style={{ rowGap: 6 }}>
                    <dt>Category</dt><dd>{selected.category}</dd>
                    <dt>Updated</dt><dd>{selected.updatedAt}</dd>
                    <dt>Tags</dt>
                    <dd>{selected.tags.map((t) => <span key={t} className="chip mono" style={{ fontSize: 10, marginRight: 4 }}>{t}</span>)}</dd>
                  </dl>
                  <div style={{ padding: '12px 14px', background: 'var(--panel-sunken)', borderRadius: 10, border: '1px solid var(--line)' }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{selected.content}</p>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-sm">Edit</button>
                    <Link to="/investigations" className="btn btn-sm btn-link">Related investigation</Link>
                  </div>
                </div>
              </Card>
            ) : (
              <Card title="Article">
                <div className="empty" style={{ minHeight: 180 }}>
                  <p className="empty-title">Select an article</p>
                  <p className="empty-text">Knowledge is built from investigations, agent findings, and manual entries.</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'memory' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="banner banner-info">
            <div>
              <p className="banner-title" style={{ color: 'var(--info)' }}>AI Project Memory</p>
              <p className="banner-text">
                Project-level facts that FixFlow agents use when analyzing this project.
                These are editable — you can correct or extend what agents have learned.
                Agents use this context to make more accurate findings.
              </p>
            </div>
            <button className="btn btn-sm" onClick={() => setEditingMemory(true)} style={{ flex: 'none' }}>+ Add fact</button>
          </div>

          {editingMemory && (
            <Card title="Add Project Fact">
              <div className="stack" style={{ gap: 12 }}>
                <label className="field">
                  <span className="field-label">Topic</span>
                  <input className="input" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="e.g. Authentication, Database, API format" />
                </label>
                <label className="field">
                  <span className="field-label">Fact</span>
                  <textarea className="textarea" rows={2} value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder='e.g. "All API errors use { error: string } format."' />
                </label>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-sm btn-primary" disabled={!newKey.trim() || !newVal.trim()} onClick={() => {
                    setMemoryEntries((prev) => [...prev, { key: newKey, value: newVal }]);
                    setNewKey(''); setNewVal(''); setEditingMemory(false);
                  }}>Save</button>
                  <button className="btn btn-sm btn-link" onClick={() => setEditingMemory(false)}>Cancel</button>
                </div>
              </div>
            </Card>
          )}

          <Card title="Project Memory" flush>
            <table className="table">
              <thead><tr><th>Topic</th><th>Fact</th><th></th></tr></thead>
              <tbody>
                {memoryEntries.map((e, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, width: 160 }}>{e.key}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{e.value}</td>
                    <td><button className="btn btn-sm btn-link">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'onboarding' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="banner banner-info">
            <div>
              <p className="banner-title" style={{ color: 'var(--info)' }}>Developer Onboarding Tour</p>
              <p className="banner-text">
                FixFlow generates an onboarding guide from the repository analysis, knowledge base, and past investigations.
                This helps new developers understand the project quickly.
              </p>
            </div>
          </div>

          <div className="stack" style={{ gap: 10 }}>
            {ONBOARDING_STEPS.map((step, i) => (
              <div key={i} className="panel" style={{ padding: '14px 18px', borderLeft: `3px solid ${step.done ? 'var(--accent)' : 'var(--line)'}` }}>
                <div className="row" style={{ gap: 12 }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 999, background: step.done ? 'var(--accent-soft)' : 'var(--panel-sunken)', border: `1px solid ${step.done ? 'rgba(183,243,107,.4)' : 'var(--line)'}`, color: step.done ? 'var(--accent)' : 'var(--subtle)', fontSize: 11, fontWeight: 700, flex: 'none' }}>
                    {step.done ? '✓' : String(i + 1)}
                  </span>
                  <div>
                    <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{step.title}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>Quick reference commands:</p>
            <pre className="code" style={{ fontSize: 11 }}>{`npm install          # Install dependencies
npm start            # Start API server (port 3000)
npm run dev          # Start Vite frontend (port 5173)
npm test             # Run all tests
npm run repro:d1     # Reproduce bug D1
npm run repro:d2     # Reproduce bug D2
npm run repro:d3     # Reproduce bug D3`}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    investigation: { label: 'from investigation', variant: 'success' },
    ai: { label: 'AI-generated', variant: 'info' },
    manual: { label: 'manual', variant: 'muted' },
  };
  const v = map[source] ?? map.manual;
  return <Badge variant={v.variant}>{v.label}</Badge>;
}
