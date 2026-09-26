import React, { useState } from 'react';

interface Dependency {
  name: string;
  version: string;
  latest?: string;
  type: 'production' | 'dev';
  status: 'current' | 'outdated' | 'major-outdated' | 'unknown';
  risk: 'low' | 'medium' | 'high';
  cves: number;
  usedIn: string[];
  license: string;
  description: string;
}

const DEPS: Dependency[] = [
  { name: 'express', version: '4.18.2', latest: '4.21.0', type: 'production', status: 'outdated', risk: 'medium', cves: 1, usedIn: ['backend/src/server.ts'], license: 'MIT', description: 'Fast, unopinionated, minimalist web framework for Node.js' },
  { name: 'react', version: '18.3.1', latest: '18.3.1', type: 'production', status: 'current', risk: 'low', cves: 0, usedIn: ['frontend/src/'], license: 'MIT', description: 'React is a JavaScript library for building user interfaces' },
  { name: 'react-router-dom', version: '6.28.0', latest: '6.28.0', type: 'production', status: 'current', risk: 'low', cves: 0, usedIn: ['frontend/src/App.tsx'], license: 'MIT', description: 'Declarative routing for React' },
  { name: 'typescript', version: '5.6.3', latest: '5.7.2', type: 'dev', status: 'outdated', risk: 'low', cves: 0, usedIn: ['backend/', 'frontend/'], license: 'Apache-2.0', description: 'TypeScript is a language for application-scale JavaScript' },
  { name: 'vite', version: '6.0.1', latest: '6.0.6', type: 'dev', status: 'outdated', risk: 'low', cves: 0, usedIn: ['frontend/'], license: 'MIT', description: 'Next generation frontend tooling' },
  { name: 'cors', version: '2.8.5', latest: '2.8.5', type: 'production', status: 'current', risk: 'low', cves: 0, usedIn: ['backend/src/server.ts'], license: 'MIT', description: 'Node.js CORS middleware' },
  { name: 'sqlite3', version: '5.1.2', latest: '5.1.7', type: 'production', status: 'outdated', risk: 'low', cves: 0, usedIn: ['demo/'], license: 'BSD-3-Clause', description: 'SQLite3 bindings for Node.js' },
  { name: 'tailwindcss', version: '4.0.0-beta.7', latest: '4.0.1', type: 'dev', status: 'outdated', risk: 'medium', cves: 0, usedIn: ['frontend/src/styles.css'], license: 'MIT', description: 'A utility-first CSS framework' },
  { name: '@types/express', version: '4.17.21', latest: '5.0.0', type: 'dev', status: 'major-outdated', risk: 'low', cves: 0, usedIn: ['backend/'], license: 'MIT', description: 'TypeScript definitions for Express' },
  { name: '@types/node', version: '20.17.9', latest: '22.10.0', type: 'dev', status: 'major-outdated', risk: 'low', cves: 0, usedIn: ['backend/'], license: 'MIT', description: 'TypeScript definitions for Node.js' },
  { name: 'nodemon', version: '3.1.7', latest: '3.1.7', type: 'dev', status: 'current', risk: 'low', cves: 0, usedIn: ['backend/'], license: 'MIT', description: 'Monitor for any changes in your Node.js application' },
];

function statusBadge(s: Dependency['status']) {
  const map = {
    current: 'badge-success',
    outdated: 'badge-warn',
    'major-outdated': 'badge-high',
    unknown: 'badge-muted',
  };
  return map[s];
}

function statusLabel(s: Dependency['status']) {
  return { current: 'Up to date', outdated: 'Outdated', 'major-outdated': 'Major update', unknown: 'Unknown' }[s];
}

function riskBadge(r: Dependency['risk']) {
  return { low: 'badge-low', medium: 'badge-medium', high: 'badge-high' }[r];
}

export function DependenciesPage() {
  const [typeFilter, setTypeFilter] = useState<'all' | 'production' | 'dev'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Dependency | null>(null);

  const filtered = DEPS.filter(d => {
    if (typeFilter !== 'all' && d.type !== typeFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    return true;
  });

  const outdatedCount = DEPS.filter(d => d.status !== 'current').length;
  const cveCount = DEPS.reduce((a, d) => a + d.cves, 0);
  const highRiskCount = DEPS.filter(d => d.risk === 'high').length;

  return (
    <div className="page-content stack-lg">
      {/* Header */}
      <div className="spread">
        <div>
          <h1 className="page-title">Dependencies</h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            Dependency health analysis for the FixFlow AI project. {DEPS.length} packages tracked.
          </p>
        </div>
        <span className="demo-notice">DEMO DATA</span>
      </div>

      {/* Metrics */}
      <div className="metric-grid">
        {[
          { label: 'Total Packages', value: DEPS.length },
          { label: 'Outdated', value: outdatedCount, color: outdatedCount > 0 ? 'var(--warn)' : 'var(--success)' },
          { label: 'Known CVEs', value: cveCount, color: cveCount > 0 ? 'var(--danger)' : 'var(--success)' },
          { label: 'High Risk', value: highRiskCount, color: highRiskCount > 0 ? 'var(--danger)' : 'var(--success)' },
        ].map(m => (
          <div key={m.label} className="metric">
            <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      {cveCount > 0 && (
        <div className="banner banner-bad">
          <div>
            <div className="banner-title">
              <span style={{ color: 'var(--danger)' }}>⚠</span>
              {cveCount} known CVE{cveCount !== 1 ? 's' : ''} in current dependencies
            </div>
            <p className="banner-text">
              express@4.18.2 has 1 known vulnerability. Review and update before next production deployment.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['all', 'production', 'dev'] as const).map(f => (
          <button key={f} className={`btn btn-sm ${typeFilter === f ? 'btn-primary' : ''}`} onClick={() => setTypeFilter(f)}>
            {f === 'all' ? 'All' : f === 'production' ? 'Production' : 'Dev'}
          </button>
        ))}
        <div style={{ width: 1, background: 'var(--line)', margin: '0 4px' }} />
        {['all', 'current', 'outdated', 'major-outdated'].map(f => (
          <button key={f} className={`btn btn-sm ${statusFilter === f ? 'btn-primary' : ''}`} onClick={() => setStatusFilter(f)}>
            {f === 'all' ? 'All status' : statusLabel(f as Dependency['status'])}
          </button>
        ))}
      </div>

      {/* Table + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) 340px' : '1fr', gap: 16 }}>
        <div className="panel panel-body-flush">
          <table className="table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Version</th>
                <th>Latest</th>
                <th>Status</th>
                <th>CVEs</th>
                <th>Risk</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr
                  key={d.name}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelected(selected?.name === d.name ? null : d)}
                >
                  <td>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ink)', fontSize: 13 }}>{d.name}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{d.version}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: d.status !== 'current' ? 'var(--warn)' : 'var(--muted)' }}>
                    {d.latest ?? '—'}
                  </td>
                  <td><span className={`badge ${statusBadge(d.status)}`}>{statusLabel(d.status)}</span></td>
                  <td style={{ color: d.cves > 0 ? 'var(--danger)' : 'var(--subtle)', fontFamily: 'var(--mono)', fontWeight: d.cves > 0 ? 700 : 400 }}>
                    {d.cves > 0 ? d.cves : '—'}
                  </td>
                  <td><span className={`badge ${riskBadge(d.risk)}`}>{d.risk}</span></td>
                  <td><span className="badge badge-muted" style={{ fontSize: 10 }}>{d.type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="panel stack" style={{ padding: 18, gap: 14, position: 'sticky', top: 80 }}>
            <div className="spread">
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{selected.name}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{selected.description}</p>

            <dl className="kv" style={{ rowGap: 8 }}>
              <dt>Current</dt><dd style={{ fontFamily: 'var(--mono)' }}>{selected.version}</dd>
              <dt>Latest</dt><dd style={{ fontFamily: 'var(--mono)', color: selected.status !== 'current' ? 'var(--warn)' : undefined }}>{selected.latest ?? '—'}</dd>
              <dt>Status</dt><dd><span className={`badge ${statusBadge(selected.status)}`}>{statusLabel(selected.status)}</span></dd>
              <dt>CVEs</dt><dd style={{ color: selected.cves > 0 ? 'var(--danger)' : 'var(--subtle)' }}>{selected.cves > 0 ? `${selected.cves} known` : 'None known'}</dd>
              <dt>Risk</dt><dd><span className={`badge ${riskBadge(selected.risk)}`}>{selected.risk}</span></dd>
              <dt>License</dt><dd style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{selected.license}</dd>
              <dt>Type</dt><dd><span className="badge badge-muted">{selected.type}</span></dd>
            </dl>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--subtle)', marginBottom: 6 }}>
                Used In
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {selected.usedIn.map(f => (
                  <span key={f} className="chip" style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{f}</span>
                ))}
              </div>
            </div>

            {selected.status !== 'current' && (
              <div className="alert alert-warn" style={{ fontSize: 12 }}>
                Update available. Test your application after upgrading.
                FixFlow AI does not auto-upgrade dependencies — human review required.
              </div>
            )}

            {selected.cves > 0 && (
              <div className="alert" style={{ fontSize: 12 }}>
                This package has known CVEs. Review the changelog and update as soon as possible.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
