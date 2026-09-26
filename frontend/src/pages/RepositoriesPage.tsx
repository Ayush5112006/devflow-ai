import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type RepositoryItem, type GitHubAuthStatus, type GitHubRemoteRepo } from '../services/api.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

export function RepositoriesPage() {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Search, filter, sort
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'local' | 'github' | 'demo'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'lastSync' | 'issues'>('lastSync');

  // Local Git registration modal / state
  const [showAddLocalModal, setShowAddLocalModal] = useState(false);
  const [localPathInput, setLocalPathInput] = useState('');
  const [localNameInput, setLocalNameInput] = useState('');
  const [addingLocal, setAddingLocal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // GitHub connection modal / state
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [ghStatus, setGhStatus] = useState<GitHubAuthStatus | null>(null);
  const [ghRepos, setGhRepos] = useState<GitHubRemoteRepo[]>([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghSearch, setGhSearch] = useState('');
  const [importingOwnerRepo, setImportingOwnerRepo] = useState<string | null>(null);

  const loadRepositories = async () => {
    try {
      setError(null);
      const data = await api.repositories();
      setRepositories(data.repositories);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepositories();
  }, []);

  const handleSync = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSyncingId(id);
    try {
      await api.syncRepository(id);
      await loadRepositories();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncingId(null);
    }
  };

  const handleRemove = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Disconnect repository "${name}"?`)) return;
    try {
      await api.removeRepository(id);
      await loadRepositories();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const openGitHubConnect = async () => {
    setShowGitHubModal(true);
    setGhLoading(true);
    try {
      const status = await api.getGitHubStatus();
      setGhStatus(status);
      if (status.authenticated) {
        const repoData = await api.getGitHubRepos();
        setGhRepos(repoData.repositories);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGhLoading(false);
    }
  };

  const handleImportGitHubRepo = async (owner: string, repo: string) => {
    setImportingOwnerRepo(`${owner}/${repo}`);
    try {
      const result = await api.importGitHubRepo(owner, repo);
      setShowGitHubModal(false);
      await loadRepositories();
      navigate(`/repositories/${result.repository.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportingOwnerRepo(null);
    }
  };

  const handleAddLocalRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPathInput.trim()) return;
    setAddingLocal(true);
    setLocalError(null);
    try {
      const result = await api.addLocalRepo(localPathInput.trim(), localNameInput.trim() || undefined);
      setShowAddLocalModal(false);
      setLocalPathInput('');
      setLocalNameInput('');
      await loadRepositories();
      navigate(`/repositories/${result.repository.id}`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingLocal(false);
    }
  };

  // Filtered and sorted repositories
  const filteredRepos = repositories
    .filter((r) => {
      if (providerFilter !== 'all' && r.provider !== providerFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(s) ||
        r.fullName.toLowerCase().includes(s) ||
        (r.description && r.description.toLowerCase().includes(s))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'issues') return b.openIssuesCount - a.openIssuesCount;
      // Default: lastSync
      const timeA = a.lastSyncAt ? Date.parse(a.lastSyncAt) : 0;
      const timeB = b.lastSyncAt ? Date.parse(b.lastSyncAt) : 0;
      return timeB - timeA;
    });

  if (loading) return <LoadingSpinner message="Loading Repositories…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 24 }}>🗄️</span>
            <h1 className="page-title" style={{ margin: 0 }}>Repositories</h1>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 14, maxWidth: 640 }}>
            Manage connected repositories, local Git worktrees, branches, commits, issues, and pull requests.
            Directly connect your code to FixFlow AI's 6-agent debugging swarm.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={loadRepositories} title="Refresh repositories">
            ⟳ Refresh
          </button>
          <button className="btn" onClick={() => setShowAddLocalModal(true)}>
            📁 + Add Local Repo
          </button>
          <button className="btn btn-primary" onClick={openGitHubConnect}>
            <span style={{ fontSize: 15 }}>🐙</span> Connect GitHub
          </button>
        </div>
      </div>

      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── Health / Overview Metrics ─── */}
      <div className="metric-grid">
        <div className="metric">
          <p className="metric-value">{repositories.length}</p>
          <p className="metric-label">Connected Repos</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--accent)' }}>
            {repositories.filter((r) => r.provider === 'local').length}
          </p>
          <p className="metric-label">Local Git Worktrees</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--info)' }}>
            {repositories.reduce((acc, r) => acc + (r.openIssuesCount || 0), 0)}
          </p>
          <p className="metric-label">Tracked Issues</p>
        </div>
        <div className="metric">
          <p className="metric-value" style={{ color: 'var(--warn)' }}>
            {repositories.reduce((acc, r) => acc + (r.openPullRequestsCount || 0), 0)}
          </p>
          <p className="metric-label">Open Pull Requests</p>
        </div>
      </div>

      {/* ─── Search, Filter, Sort Controls ─── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories by name, full path, or description…"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--subtle)' }}>Provider:</span>
          {(['all', 'local', 'github', 'demo'] as const).map((prov) => (
            <button
              key={prov}
              className={`btn btn-sm ${providerFilter === prov ? 'btn-primary' : ''}`}
              onClick={() => setProviderFilter(prov)}
            >
              {prov.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--subtle)' }}>Sort:</span>
          <select
            className="select"
            style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="lastSync">Last Synced</option>
            <option value="name">Repository Name</option>
            <option value="issues">Open Issues</option>
          </select>
        </div>
      </div>

      {/* ─── Repository List Table ─── */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        {filteredRepos.length === 0 ? (
          <div className="empty">
            <span style={{ fontSize: 32 }}>📂</span>
            <p className="empty-title">No repositories found</p>
            <p className="empty-text">
              {search || providerFilter !== 'all'
                ? 'No repositories match your active search and filter criteria.'
                : 'Connect a local Git worktree or import a GitHub repository to begin.'}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="btn btn-sm" onClick={() => setShowAddLocalModal(true)}>
                📁 Add Local Repository
              </button>
              <button className="btn btn-primary btn-sm" onClick={openGitHubConnect}>
                🐙 Connect GitHub
              </button>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Provider</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Issues</th>
                  <th>PRs</th>
                  <th>Last Commit</th>
                  <th>Last Sync</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRepos.map((repo) => {
                  const isSyncing = syncingId === repo.id || repo.status === 'syncing';
                  return (
                    <tr
                      key={repo.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/repositories/${repo.id}`)}
                    >
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{repo.name}</span>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>
                            {repo.fullName}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="chip"
                          style={{
                            color:
                              repo.provider === 'github'
                                ? 'var(--accent)'
                                : repo.provider === 'local'
                                ? 'var(--info)'
                                : 'var(--warn)',
                          }}
                        >
                          {repo.provider.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--ink)' }}>
                          {repo.currentBranch || repo.defaultBranch}
                        </span>
                      </td>
                      <td>
                        <span
                          className="chip"
                          style={{
                            color:
                              repo.status === 'active'
                                ? 'var(--accent)'
                                : repo.status === 'syncing'
                                ? 'var(--warn)'
                                : 'var(--danger)',
                          }}
                        >
                          ● {repo.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: repo.openIssuesCount > 0 ? 'var(--warn)' : 'var(--muted)' }}>
                          {repo.openIssuesCount}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: repo.openPullRequestsCount > 0 ? 'var(--info)' : 'var(--muted)' }}>
                          {repo.openPullRequestsCount}
                        </span>
                      </td>
                      <td>
                        {repo.lastCommitHash ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                              {repo.lastCommitHash.slice(0, 7)}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--subtle)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {repo.lastCommitMessage || '—'}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--subtle)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                          {repo.lastSyncAt ? new Date(repo.lastSyncAt).toLocaleTimeString() : 'Never'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-sm"
                            onClick={(e) => handleSync(e, repo.id)}
                            disabled={isSyncing}
                            title="Synchronize repository"
                          >
                            {isSyncing ? 'Syncing…' : '⟳ Sync'}
                          </button>
                          <Link to={`/repositories/${repo.id}`} className="btn btn-sm btn-primary">
                            Open →
                          </Link>
                          {repo.provider !== 'demo' && (
                            <button
                              className="btn btn-sm"
                              style={{ color: 'var(--danger)' }}
                              onClick={(e) => handleRemove(e, repo.id, repo.name)}
                              title="Disconnect"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Add Local Repository Modal ─── */}
      {showAddLocalModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowAddLocalModal(false)}
        >
          <div
            className="panel"
            style={{ width: '100%', maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <h2 className="panel-title">Add Local Git Repository</h2>
              <button
                onClick={() => setShowAddLocalModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddLocalRepo} className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Register a local folder with an existing <code>.git</code> repository to inspect working tree diffs,
                browse branches, and investigate local code defects.
              </p>

              <label className="field">
                <span className="field-label">
                  Local Directory Absolute Path <span style={{ color: 'var(--danger)' }}>*</span>
                </span>
                <input
                  className="input mono"
                  value={localPathInput}
                  onChange={(e) => setLocalPathInput(e.target.value)}
                  placeholder="C:\Users\username\projects\my-app"
                  required
                />
                <span className="field-hint">Must be an existing directory containing a .git directory.</span>
              </label>

              <label className="field">
                <span className="field-label">Display Name (optional)</span>
                <input
                  className="input"
                  value={localNameInput}
                  onChange={(e) => setLocalNameInput(e.target.value)}
                  placeholder="My Application"
                />
              </label>

              {localError && <div className="alert" role="alert"><span>{localError}</span></div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn" onClick={() => setShowAddLocalModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addingLocal}>
                  {addingLocal ? 'Validating…' : 'Register Repository'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Connect GitHub Modal ─── */}
      {showGitHubModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowGitHubModal(false)}
        >
          <div
            className="panel"
            style={{ width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🐙</span>
                <h2 className="panel-title">GitHub Integration</h2>
              </div>
              <button
                onClick={() => setShowGitHubModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="panel-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {ghLoading ? (
                <LoadingSpinner message="Checking GitHub credentials & repositories…" />
              ) : ghStatus && !ghStatus.authenticated ? (
                /* Unauthenticated / Not Configured State */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="banner banner-warn">
                    <div>
                      <div className="banner-title">
                        <span>⚠️</span> GitHub integration is not configured
                      </div>
                      <p className="banner-text">
                        {ghStatus.error || 'GITHUB_TOKEN is not set in backend/.env.'}
                      </p>
                    </div>
                  </div>

                  <div className="panel" style={{ padding: 14 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 10px', color: 'var(--ink)' }}>
                      Setup Instructions:
                    </p>
                    <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, lineHeight: 1.7, color: 'var(--muted)' }}>
                      <li>
                        Generate a Personal Access Token with <code>repo</code> scope at{' '}
                        <a
                          href="https://github.com/settings/tokens"
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--accent)' }}
                        >
                          github.com/settings/tokens
                        </a>.
                      </li>
                      <li>
                        Add <code>GITHUB_TOKEN=ghp_yourTokenHere</code> in <code>backend/.env</code>.
                      </li>
                      <li>
                        Optionally add <code>GITHUB_WEBHOOK_SECRET=your_secret</code> for webhook verification.
                      </li>
                      <li>Restart the backend server to activate live synchronization.</li>
                    </ol>
                  </div>

                  <p style={{ fontSize: 12, color: 'var(--subtle)', margin: 0 }}>
                    ℹ️ In accordance with FixFlow AI integrity rules, fake GitHub data is never displayed.
                    You can still use local Git repositories and the built-in InsightBoard demo project offline!
                  </p>
                </div>
              ) : ghStatus && ghStatus.authenticated ? (
                /* Authenticated State */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="banner banner-ok">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {ghStatus.avatarUrl && (
                        <img
                          src={ghStatus.avatarUrl}
                          alt={ghStatus.username || ''}
                          style={{ width: 36, height: 36, borderRadius: '50%' }}
                        />
                      )}
                      <div>
                        <div className="banner-title" style={{ color: 'var(--accent)' }}>
                          ✓ Connected to GitHub as @{ghStatus.username}
                        </div>
                        <p className="banner-text" style={{ fontSize: 12 }}>
                          Scopes: {ghStatus.scopes.join(', ') || 'read-only'} · API Rate Limit: {ghStatus.rateLimit?.remaining}/{ghStatus.rateLimit?.limit}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>Select a repository to import:</p>
                      <input
                        className="input"
                        style={{ maxWidth: 220, padding: '6px 10px', fontSize: 12 }}
                        value={ghSearch}
                        onChange={(e) => setGhSearch(e.target.value)}
                        placeholder="Search your repos…"
                      />
                    </div>

                    <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ghRepos
                        .filter((r) => !ghSearch || r.fullName.toLowerCase().includes(ghSearch.toLowerCase()))
                        .map((repo) => (
                          <div
                            key={repo.id}
                            style={{
                              padding: '10px 14px',
                              background: 'var(--panel-sunken)',
                              border: '1px solid var(--line)',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                                {repo.fullName}
                              </p>
                              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--subtle)' }}>
                                {repo.language ? `${repo.language} · ` : ''}⭐ {repo.stars} · {repo.openIssuesCount} open issues
                              </p>
                            </div>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={importingOwnerRepo === repo.fullName}
                              onClick={() => handleImportGitHubRepo(repo.owner, repo.name)}
                            >
                              {importingOwnerRepo === repo.fullName ? 'Importing…' : 'Import'}
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="panel-head" style={{ borderTop: '1px solid var(--line)', borderBottom: 'none', justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => setShowGitHubModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
