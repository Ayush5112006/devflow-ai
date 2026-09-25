import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import type { GitInfo } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

const DEMO_COMMITS = [
  { hash: 'a1b2c3d', message: 'fix: correct orders SQL column name from customer_name to customer', author: 'Developer', date: '2 hours ago', files: 3, additions: 2, deletions: 2 },
  { hash: 'e4f5a6b', message: 'fix: update api-client to use VITE_API_URL env variable', author: 'Developer', date: '4 hours ago', files: 1, additions: 1, deletions: 1 },
  { hash: 'c7d8e9f', message: 'fix: renderDetail reads prediction.sentiment not prediction.label', author: 'Developer', date: '6 hours ago', files: 1, additions: 1, deletions: 1 },
  { hash: 'b1c2d3e', message: 'test: add regression tests for orders endpoint', author: 'Developer', date: '8 hours ago', files: 2, additions: 28, deletions: 0 },
  { hash: 'f4a5b6c', message: 'chore: initial InsightBoard demo project setup', author: 'Developer', date: '2 days ago', files: 12, additions: 445, deletions: 0 },
];

const DEMO_BRANCHES = [
  { name: 'main', ahead: 0, behind: 0, lastCommit: '2 hours ago', isDefault: true, status: 'clean' },
  { name: 'fix/orders-sql-column', ahead: 3, behind: 0, lastCommit: '2 hours ago', isDefault: false, status: 'merged' },
  { name: 'fix/api-base-url', ahead: 2, behind: 0, lastCommit: '4 hours ago', isDefault: false, status: 'merged' },
  { name: 'fix/prediction-label', ahead: 1, behind: 0, lastCommit: '6 hours ago', isDefault: false, status: 'merged' },
];

export function GitCenterPage() {
  const [tab, setTab] = useState<'overview' | 'commits' | 'branches' | 'create'>('overview');
  const [git, setGit] = useState<GitInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const [branchBase, setBranchBase] = useState('main');
  const [branchType, setBranchType] = useState<'fix' | 'feature' | 'hotfix'>('fix');
  const [created, setCreated] = useState<string | null>(null);

  // Try to load git info from any completed investigation
  useEffect(() => {
    api.listInvestigations().then(({ investigations }) => {
      const completed = investigations.find((i: any) => i.status === 'completed');
      if (completed?.id) {
        setLoading(true);
        return api.git(completed.id).then(({ git: g }) => { setGit(g); setLoading(false); });
      }
    }).catch(() => {});
  }, []);

  function createBranch() {
    if (!newBranch.trim()) return;
    const full = `${branchType}/${newBranch.trim().toLowerCase().replace(/\s+/g, '-')}`;
    setCreated(full);
    setNewBranch('');
  }

  return (
    <div className="page-content stack" style={{ gap: 22 }}>
      {/* Tabs */}
      <div className="tabs" role="tablist">
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'commits', label: 'Commits' },
          { id: 'branches', label: 'Branches' },
          { id: 'create', label: 'Create Branch' },
        ] as const).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="stack" style={{ gap: 16 }}>
          {loading && <LoadingSpinner message="Loading git info…" />}
          {git && (
            <Card title="Repository Status">
              <dl className="kv" style={{ rowGap: 10 }}>
                <dt>Branch</dt>
                <dd className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>{git.branch ?? 'main'}</dd>
                <dt>Latest commit</dt>
                <dd className="mono" style={{ fontSize: 12 }}>{git.latestCommit?.slice(0, 12) ?? '—'}</dd>
                <dt>Message</dt>
                <dd style={{ fontSize: 13 }}>{git.latestMessage ?? '—'}</dd>
                <dt>Author</dt>
                <dd>{git.latestAuthor ?? '—'}</dd>
                <dt>Date</dt>
                <dd style={{ fontSize: 12, color: 'var(--muted)' }}>{git.latestDate ? new Date(git.latestDate).toLocaleString() : '—'}</dd>
                {git.modifiedFiles.length > 0 && (
                  <>
                    <dt>Modified files</dt>
                    <dd>
                      {git.modifiedFiles.map((f) => (
                        <span key={f} className="chip mono" style={{ fontSize: 10, marginRight: 4, marginBottom: 4, display: 'inline-flex' }}>{f}</span>
                      ))}
                    </dd>
                  </>
                )}
                {git.suggestedBranch && (
                  <>
                    <dt>Suggested branch</dt>
                    <dd className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{git.suggestedBranch}</dd>
                  </>
                )}
              </dl>
            </Card>
          )}

          {/* Recent commits */}
          <Card title="Recent Commits" flush>
            <table className="table">
              <thead><tr><th>Hash</th><th>Message</th><th>Author</th><th>When</th><th>Files</th></tr></thead>
              <tbody>
                {(git?.recentCommits?.length ? git.recentCommits.slice(0, 5).map((c) => ({
                  hash: c.hash, message: c.message, author: c.author, date: new Date(c.date).toLocaleString(), files: '—', additions: '—', deletions: '—'
                })) : DEMO_COMMITS).map((c) => (
                  <tr key={c.hash}>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--info)' }}>{c.hash.slice(0,8)}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink)', maxWidth: 360 }}>{c.message}</td>
                    <td style={{ fontSize: 12 }}>{c.author}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{typeof c.date === 'string' ? c.date : String(c.date)}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{typeof c.files === 'number' ? c.files : c.files}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!git?.recentCommits?.length && (
              <p style={{ padding: '8px 16px 12px', fontSize: 11, color: 'var(--subtle)', margin: 0 }}>
                DEMO — showing sample git history. Run a complete investigation to see real git data.
              </p>
            )}
          </Card>
        </div>
      )}

      {tab === 'commits' && (
        <Card title="Commit History" flush>
          <table className="table">
            <thead><tr><th>Hash</th><th>Message</th><th>Author</th><th>When</th><th>+</th><th>−</th></tr></thead>
            <tbody>
              {DEMO_COMMITS.map((c) => (
                <tr key={c.hash}>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--info)' }}>{c.hash}</td>
                  <td style={{ fontSize: 12, color: 'var(--ink)' }}>{c.message}</td>
                  <td style={{ fontSize: 12 }}>{c.author}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>{c.date}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>+{c.additions}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>-{c.deletions}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ padding: '8px 16px 12px', fontSize: 11, color: 'var(--subtle)', margin: 0 }}>
            DEMO — sample commit history. Real git history is shown in the investigation report tab.
          </p>
        </Card>
      )}

      {tab === 'branches' && (
        <div className="stack" style={{ gap: 12 }}>
          {DEMO_BRANCHES.map((b) => (
            <div key={b.name} className="panel" style={{ padding: '14px 18px' }}>
              <div className="spread">
                <div className="row" style={{ gap: 10 }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{b.name}</span>
                  {b.isDefault && <Badge variant="info">default</Badge>}
                  <Badge variant={b.status === 'merged' ? 'success' : b.status === 'clean' ? 'muted' : 'warn'} dot>
                    {b.status}
                  </Badge>
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>{b.lastCommit}</span>
              </div>
              {(b.ahead > 0 || b.behind > 0) && (
                <div className="row" style={{ gap: 12, marginTop: 8 }}>
                  {b.ahead > 0 && <span style={{ fontSize: 12, color: 'var(--accent)' }}>↑ {b.ahead} ahead</span>}
                  {b.behind > 0 && <span style={{ fontSize: 12, color: 'var(--warn)' }}>↓ {b.behind} behind</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'create' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="banner banner-info">
            <div>
              <p className="banner-title" style={{ color: 'var(--info)' }}>⑂ Branch Creation</p>
              <p className="banner-text">
                FixFlow can create branches from your investigation context. Branches are created locally — no automatic push without your approval.
              </p>
            </div>
          </div>

          {created && (
            <div className="banner banner-ok">
              <div>
                <p className="banner-title" style={{ color: 'var(--accent)' }}>✓ Branch prepared</p>
                <p className="banner-text mono" style={{ fontSize: 13 }}>{created}</p>
              </div>
              <button className="btn btn-sm" onClick={() => setCreated(null)}>Create another</button>
            </div>
          )}

          {!created && (
            <Card title="Create Branch">
              <div className="stack" style={{ gap: 16 }}>
                <div className="card-grid-2" style={{ gap: 12 }}>
                  <label className="field">
                    <span className="field-label">Branch type</span>
                    <select className="select" value={branchType} onChange={(e) => setBranchType(e.target.value as any)}>
                      <option value="fix">fix/</option>
                      <option value="feature">feature/</option>
                      <option value="hotfix">hotfix/</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Base branch</span>
                    <select className="select" value={branchBase} onChange={(e) => setBranchBase(e.target.value)}>
                      <option value="main">main</option>
                      <option value="develop">develop</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">Branch name</span>
                  <div className="row" style={{ gap: 0 }}>
                    <span style={{ padding: '11px 12px', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRight: 'none', borderRadius: '10px 0 0 10px', fontSize: 13, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
                      {branchType}/
                    </span>
                    <input
                      className="input"
                      style={{ borderRadius: '0 10px 10px 0' }}
                      value={newBranch}
                      onChange={(e) => setNewBranch(e.target.value)}
                      placeholder="fix-orders-sql-column"
                    />
                  </div>
                  <span className="field-hint">
                    Preview: <span className="mono">{branchType}/{newBranch || 'branch-name'}</span>
                  </span>
                </label>
                <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!newBranch.trim()} onClick={createBranch}>
                  Create branch (local)
                </button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
