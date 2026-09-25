import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

const DEMO_SYMBOLS = [
  {
    name: 'renderDetail()',
    file: 'web/app.js',
    line: 88,
    type: 'function',
    layer: 'frontend',
    purpose: 'Renders the detail panel for a selected prediction row.',
    inputs: ['prediction: object'],
    outputs: ['void — updates DOM'],
    callers: ['handleRowClick()', 'initDashboard()'],
    calls: ['document.querySelector()', 'renderSentimentBadge()'],
    tests: ['test/frontend.test.js:22'],
    lastModified: '2 days ago',
    risk: 'high',
    riskReason: 'Reads prediction.label but API returns prediction.sentiment — contract mismatch',
  },
  {
    name: 'getPredictions()',
    file: 'web/api-client.js',
    line: 14,
    type: 'function',
    layer: 'frontend',
    purpose: 'Fetches the predictions list from the backend API.',
    inputs: [],
    outputs: ['Promise<Prediction[]>'],
    callers: ['initDashboard()'],
    calls: ['fetch()', 'JSON.parse()'],
    tests: ['test/api.test.js:10'],
    lastModified: '4 days ago',
    risk: 'medium',
    riskReason: 'Uses hardcoded base URL — may break in different environments',
  },
  {
    name: 'GET /api/orders',
    file: 'src/routes/orders.js',
    line: 12,
    type: 'route',
    layer: 'api',
    purpose: 'Returns the list of orders from the database.',
    inputs: ['query params: limit, offset'],
    outputs: ['{ orders: Order[] }'],
    callers: ['Express router'],
    calls: ['db.all()', 'formatOrder()'],
    tests: ['test/api.test.js:45'],
    lastModified: '6 days ago',
    risk: 'critical',
    riskReason: 'References o.customer_name which does not exist in schema — throws SQL error',
  },
  {
    name: 'initDB()',
    file: 'src/db/setup.js',
    line: 5,
    type: 'function',
    layer: 'database',
    purpose: 'Initializes the SQLite database and creates tables if they do not exist.',
    inputs: [],
    outputs: ['Promise<Database>'],
    callers: ['server startup'],
    calls: ['sqlite3.open()', 'db.exec()'],
    tests: ['test/db.test.js:8'],
    lastModified: '8 days ago',
    risk: 'low',
    riskReason: 'No known issues',
  },
];

const SEARCH_CATEGORIES = ['All', 'Functions', 'Routes', 'Classes', 'Variables', 'Tests', 'TODOs'];

export function CodeIntelligencePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<typeof DEMO_SYMBOLS[0] | null>(null);

  const filtered = DEMO_SYMBOLS.filter((s) => {
    const matchesQuery = !query || s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.file.toLowerCase().includes(query.toLowerCase()) ||
      s.purpose.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'All' ||
      (category === 'Functions' && s.type === 'function') ||
      (category === 'Routes' && s.type === 'route');
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="page-content">
      <div className="stack" style={{ gap: 20 }}>
        {/* Search Bar */}
        <div className="ci-search-bar">
          <input
            className="input"
            placeholder="Search functions, routes, files, variables, errors…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ fontSize: 15 }}
          />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {SEARCH_CATEGORIES.map((c) => (
              <button
                key={c}
                className={`btn btn-sm ${category === c ? 'btn-primary' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="card-grid-sidebar">
          {/* Results */}
          <div className="stack" style={{ gap: 10 }}>
            <div className="panel-head" style={{ background: 'transparent', border: 'none', padding: '0 0 4px 0' }}>
              <span className="panel-title">{filtered.length} results</span>
            </div>
            {filtered.map((sym) => (
              <button
                key={sym.name}
                className={`symbol-card ${selected?.name === sym.name ? 'symbol-card-active' : ''}`}
                onClick={() => setSelected(sym)}
              >
                <div className="spread">
                  <div className="row" style={{ gap: 8 }}>
                    <TypeBadge type={sym.type} />
                    <span className="symbol-name mono">{sym.name}</span>
                  </div>
                  <RiskBadge risk={sym.risk} />
                </div>
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>{sym.file}:{sym.line}</span>
                  <LayerChip layer={sym.layer} />
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{sym.purpose}</p>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="empty" style={{ minHeight: 160 }}>
                <p className="empty-title">No results</p>
                <p className="empty-text">Try a different search term or category.</p>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selected ? (
            <div className="stack" style={{ gap: 14 }}>
              <Card title="Symbol Inspector" action={
                <button className="btn btn-sm btn-link" onClick={() => setSelected(null)}>✕ Close</button>
              }>
                <div className="stack" style={{ gap: 14 }}>
                  <div>
                    <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{selected.name}</span>
                    <div className="row" style={{ gap: 6, marginTop: 8 }}>
                      <TypeBadge type={selected.type} />
                      <RiskBadge risk={selected.risk} />
                    </div>
                  </div>

                  <dl className="kv" style={{ rowGap: 10 }}>
                    <dt>File</dt>
                    <dd className="mono" style={{ fontSize: 12 }}>{selected.file}:{selected.line}</dd>
                    <dt>Layer</dt>
                    <dd><LayerChip layer={selected.layer} /></dd>
                    <dt>Last modified</dt>
                    <dd>{selected.lastModified}</dd>
                  </dl>

                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Purpose</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{selected.purpose}</p>
                  </div>

                  {selected.inputs.length > 0 && (
                    <div>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Inputs</p>
                      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {selected.inputs.map((i) => <li key={i} className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{i}</li>)}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Called by</p>
                    {selected.callers.map((c) => (
                      <span key={c} className="chip mono" style={{ marginRight: 6, marginBottom: 4, display: 'inline-flex' }}>{c}</span>
                    ))}
                  </div>

                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Calls</p>
                    {selected.calls.map((c) => (
                      <span key={c} className="chip mono" style={{ marginRight: 6, marginBottom: 4, display: 'inline-flex' }}>{c}</span>
                    ))}
                  </div>

                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Related tests</p>
                    {selected.tests.map((t) => (
                      <span key={t} className="chip mono" style={{ marginRight: 6, marginBottom: 4, display: 'inline-flex', color: 'var(--accent)' }}>{t}</span>
                    ))}
                  </div>

                  {selected.risk !== 'low' && (
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: selected.risk === 'critical' ? 'var(--danger-soft)' : selected.risk === 'high' ? 'rgba(248,113,113,0.08)' : 'var(--warn-soft)', border: `1px solid ${selected.risk === 'critical' ? 'rgba(248,113,113,.32)' : 'rgba(251,191,36,.32)'}` }}>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 12, color: selected.risk === 'critical' || selected.risk === 'high' ? 'var(--danger)' : 'var(--warn)' }}>
                        ⚠ Risk: {selected.risk}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{selected.riskReason}</p>
                    </div>
                  )}

                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <Link to="/new" className="btn btn-sm">Investigate this</Link>
                    <Link to="/code-review" className="btn btn-sm">Review</Link>
                    <button className="btn btn-sm btn-link">Find usages</button>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card title="Symbol Inspector">
              <div className="empty" style={{ minHeight: 200 }}>
                <p className="empty-title">Select a symbol</p>
                <p className="empty-text">Click any result to inspect its callers, tests, dependencies, and risk profile.</p>
              </div>
            </Card>
          )}
        </div>

        {/* Repository Map */}
        <Card title="Dependency Flow">
          <div className="dep-flow">
            {[
              { label: 'Frontend (web/app.js)', color: 'var(--info)' },
              { label: 'API Client (web/api-client.js)', color: 'var(--accent)' },
              { label: 'Express (src/server.js)', color: 'var(--warn)' },
              { label: 'Route Handlers (src/routes/)', color: 'var(--warn)' },
              { label: 'SQLite DB (src/db/)', color: '#a78bfa' },
            ].map((node, i, arr) => (
              <React.Fragment key={node.label}>
                <div className="dep-node" style={{ '--node-color': node.color } as any}>{node.label}</div>
                {i < arr.length - 1 && <div className="dep-arrow">↓</div>}
              </React.Fragment>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    function: 'var(--info)',
    route: 'var(--accent)',
    class: '#a78bfa',
    variable: 'var(--muted)',
  };
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700,
      fontFamily: 'var(--mono)', textTransform: 'uppercase',
      background: (colors[type] ?? 'var(--muted)') + '22',
      color: colors[type] ?? 'var(--muted)',
      border: `1px solid ${(colors[type] ?? 'var(--muted)') + '44'}`,
    }}>
      {type}
    </span>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    critical: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
    high: { bg: 'rgba(248,113,113,0.08)', fg: 'var(--danger)' },
    medium: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
    low: { bg: 'transparent', fg: 'var(--subtle)' },
  };
  const v = map[risk] ?? map.low;
  return (
    <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', background: v.bg, color: v.fg }}>
      {risk}
    </span>
  );
}

function LayerChip({ layer }: { layer: string }) {
  return <span className="chip mono" style={{ fontSize: 10 }}>{layer}</span>;
}
