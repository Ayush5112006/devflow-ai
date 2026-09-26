<<<<<<< HEAD
/**
 * /repositories — Real repository management workspace.
 *
 * LIVE: Local git repository (workspace root), branch list, commits, git status.
 * LIVE (when GITHUB_TOKEN set): GitHub repositories, issues, PRs, file tree.
 * COMING SOON: PR creation with push, automatic background sync, GitLab/Bitbucket.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import type { Repository, GitHubStatus } from '../types/index.js';

/* ──────────────────────────────────────────────────────────────────── */
/*  Utility                                                            */
/* ──────────────────────────────────────────────────────────────────── */

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function syncStatusColor(status: string): string {
  if (status === 'synced') return 'var(--success)';
  if (status === 'syncing') return 'var(--info)';
  if (status === 'failed') return 'var(--danger)';
  return 'var(--muted)';
}

function syncStatusLabel(status: string): string {
  if (status === 'synced') return 'Synced';
  if (status === 'syncing') return 'Syncing…';
  if (status === 'failed') return 'Failed';
  if (status === 'never') return 'Never synced';
  return status;
}

function providerBadge(provider: string) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 'var(--r-full)',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
      background: provider === 'github' ? 'rgba(124,92,252,0.15)' : 'rgba(56,189,248,0.12)',
      color: provider === 'github' ? 'var(--accent-text)' : 'var(--info)',
      border: `1px solid ${provider === 'github' ? 'rgba(124,92,252,0.3)' : 'rgba(56,189,248,0.2)'}`,
    }}>
      {provider === 'github' ? '⬡ GitHub' : '⬡ Local'}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Skeleton loader                                                    */
/* ──────────────────────────────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <tr>
      {[1,2,3,4,5,6,7,8].map((i) => (
        <td key={i}>
          <div style={{ height: 14, borderRadius: 4, background: 'var(--line)', opacity: 0.5, width: i === 2 ? '80%' : '60%' }} />
        </td>
      ))}
    </tr>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  GitHub connect banner                                              */
/* ──────────────────────────────────────────────────────────────────── */

function GitHubStatusBanner({ status, onRefresh }: { status: GitHubStatus | null; onRefresh: () => void }) {
  if (status === null) return null;

  if (!status.configured) {
    return (
      <div style={{
        padding: '14px 18px', borderRadius: 'var(--r-md)', marginBottom: 0,
        background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)',
        display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <span style={{ fontSize: 18, marginTop: 1 }}>⬡</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--info)', marginBottom: 4 }}>
            GitHub integration is not configured
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>
            To connect GitHub repositories and access issues, PRs, and commits, set the{' '}
            <code style={{ fontFamily: 'var(--mono)', background: 'rgba(56,189,248,0.1)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>GITHUB_TOKEN</code>{' '}
            environment variable to a{' '}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)' }}>
              GitHub Personal Access Token
            </a>{' '}
            with <strong>repo</strong> scope, then restart the backend.
          </p>
          <p style={{ fontSize: 11, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
            export GITHUB_TOKEN=ghp_...
          </p>
        </div>
      </div>
    );
  }

  if (status.error) {
    return (
      <div style={{
        padding: '12px 16px', borderRadius: 'var(--r-md)', marginBottom: 0,
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ color: 'var(--danger)', fontSize: 15 }}>✕</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', marginBottom: 2 }}>GitHub authentication failed</p>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{status.error}</p>
        </div>
        <button className="btn btn-xs" onClick={onRefresh}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '10px 16px', borderRadius: 'var(--r-md)', marginBottom: 0,
      background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ color: 'var(--success)', fontSize: 15 }}>●</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, color: 'var(--success)' }}>
          <strong>GitHub connected</strong>{' '}
          <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
            as <strong style={{ color: 'var(--ink)' }}>{status.login}</strong>
            {status.rateLimitRemaining !== null && ` · ${status.rateLimitRemaining} API calls remaining`}
          </span>
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Add Repository modal                                               */
/* ──────────────────────────────────────────────────────────────────── */

interface AddRepoModalProps {
  onClose: () => void;
  onAdded: (repo: Repository) => void;
  githubStatus: GitHubStatus | null;
  githubRepos: Partial<Repository>[];
  githubReposLoading: boolean;
}

function AddRepoModal({ onClose, onAdded, githubStatus, githubRepos, githubReposLoading }: AddRepoModalProps) {
  const [tab, setTab] = useState<'local' | 'github'>('local');
  const [localPath, setLocalPath] = useState('');
  const [localName, setLocalName] = useState('');
  const [githubSearch, setGithubSearch] = useState('');
  const [selectedGH, setSelectedGH] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualFullName, setManualFullName] = useState('');

  const filteredGHRepos = githubRepos.filter((r) =>
    !githubSearch || (r.fullName ?? r.name ?? '').toLowerCase().includes(githubSearch.toLowerCase())
  );

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      if (tab === 'local') {
        if (!localPath.trim()) { setError('Please enter a repository path'); setSubmitting(false); return; }
        const { repository } = await api.repos.register({ provider: 'local', path: localPath.trim(), name: localName.trim() || undefined });
        onAdded(repository);
      } else {
        const fullName = selectedGH ?? manualFullName.trim();
        if (!fullName) { setError('Please select or enter a repository name (owner/repo)'); setSubmitting(false); return; }
        const { repository } = await api.github.import(fullName);
        onAdded(repository);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--panel-raised)', border: '1px solid var(--line-strong)',
        borderRadius: 'var(--r-lg)', width: 560, maxHeight: '85vh', overflowY: 'auto',
        padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Add Repository</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
          {([['local', '⬡ Local Git'], ['github', '⬡ GitHub']] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: tab === t ? 'var(--accent-soft)' : 'transparent',
                color: tab === t ? 'var(--accent-text)' : 'var(--muted)',
                border: tab === t ? '1px solid rgba(124,92,252,0.3)' : '1px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'local' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Repository Path <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="e.g. /home/user/my-project"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 'var(--r-sm)',
                  background: 'var(--panel-sunken)', border: '1px solid var(--line-strong)',
                  color: 'var(--ink)', fontSize: 12, fontFamily: 'var(--mono)',
                }}
              />
              <p style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 5 }}>
                Must be an absolute path to a directory containing a .git folder.
                The path must be within the FixFlow workspace root.
              </p>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Display Name (optional)
              </label>
              <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="Leave blank to use directory name"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 'var(--r-sm)',
                  background: 'var(--panel-sunken)', border: '1px solid var(--line-strong)',
                  color: 'var(--ink)', fontSize: 12,
                }}
              />
            </div>
          </div>
        )}

        {tab === 'github' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!githubStatus?.configured ? (
              <div style={{ padding: '14px', background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 'var(--r-sm)' }}>
                <p style={{ fontSize: 12, color: 'var(--info)', marginBottom: 6, fontWeight: 700 }}>GitHub not configured</p>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Set the <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>GITHUB_TOKEN</code> environment variable to connect GitHub repositories.
                </p>
              </div>
            ) : (
              <>
                {githubReposLoading ? (
                  <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Loading your GitHub repositories…</p>
                ) : githubRepos.length > 0 ? (
                  <>
                    <input
                      type="text"
                      value={githubSearch}
                      onChange={(e) => setGithubSearch(e.target.value)}
                      placeholder="Search repositories…"
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 'var(--r-sm)',
                        background: 'var(--panel-sunken)', border: '1px solid var(--line-strong)',
                        color: 'var(--ink)', fontSize: 12,
                      }}
                    />
                    <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {filteredGHRepos.slice(0, 50).map((r) => {
                        const fn = r.fullName ?? r.name ?? '';
                        return (
                          <button
                            key={fn}
                            onClick={() => setSelectedGH(fn === selectedGH ? null : fn)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left',
                              background: selectedGH === fn ? 'var(--accent-soft)' : 'var(--panel-sunken)',
                              border: selectedGH === fn ? '1px solid rgba(124,92,252,0.35)' : '1px solid var(--line)',
                              color: 'var(--ink)',
                            }}
                          >
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600 }}>{fn}</p>
                              {r.description && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.description.slice(0, 60)}</p>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              {r.language && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{r.language}</span>}
                              <span style={{ fontSize: 10, color: r.visibility === 'private' ? 'var(--warn)' : 'var(--success)' }}>
                                {r.visibility === 'private' ? '🔒 Private' : '◎ Public'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                      No repositories loaded, or enter owner/repo manually:
                    </p>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                    Or enter manually (owner/repo)
                  </label>
                  <input
                    type="text"
                    value={manualFullName}
                    onChange={(e) => { setManualFullName(e.target.value); setSelectedGH(null); }}
                    placeholder="e.g. octocat/hello-world"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 'var(--r-sm)',
                      background: 'var(--panel-sunken)', border: '1px solid var(--line-strong)',
                      color: 'var(--ink)', fontSize: 12, fontFamily: 'var(--mono)',
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--r-sm)' }}>
            <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-sm" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSubmit}
            disabled={submitting || (tab === 'github' && !githubStatus?.configured)}
          >
            {submitting ? 'Adding…' : tab === 'local' ? 'Add Local Repository' : 'Import from GitHub'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Main page                                                          */
/* ──────────────────────────────────────────────────────────────────── */

export function RepositoriesPage() {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [ghStatus, setGhStatus] = useState<GitHubStatus | null>(null);
  const [ghRepos, setGhRepos] = useState<Partial<Repository>[]>([]);
  const [ghReposLoading, setGhReposLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    try {
      const { repositories } = await api.repos.list();
      setRepos(repositories);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const loadGhStatus = useCallback(async () => {
    try {
      const { github } = await api.github.status();
      setGhStatus(github);
      if (github.configured && !github.error) {
        setGhReposLoading(true);
        const { repos: available } = await api.github.repos({ per_page: 50 });
        setGhRepos(available ?? []);
        setGhReposLoading(false);
      }
    } catch {
      // GitHub status check failure is non-fatal
    }
  }, []);

  useEffect(() => {
    Promise.all([loadRepos(), loadGhStatus()]).finally(() => setLoading(false));
  }, [loadRepos, loadGhStatus]);

  async function handleSync(id: string) {
    setSyncing((prev) => new Set(prev).add(id));
    try {
      const { repository } = await api.repos.sync(id);
      setRepos((prev) => prev.map((r) => r.id === id ? repository : r));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    try {
      await api.repos.remove(id);
      setRepos((prev) => prev.filter((r) => r.id !== id));
      setRemoveConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemoving(null);
    }
  }

  const filtered = repos.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.fullName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content stack" style={{ gap: 24 }}>
      {/* Header */}
      <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Repositories</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13, lineHeight: 1.6 }}>
            Manage connected repositories, branches, commits, issues and pull requests.
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn btn-sm"
            onClick={() => { setLoading(true); Promise.all([loadRepos(), loadGhStatus()]).finally(() => setLoading(false)); }}
          >
            ↺ Refresh
=======
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
>>>>>>> origin/main
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setShowAddModal(true)}
          >
            + Add Repository
          </button>
          {ghStatus?.configured && !ghStatus.error ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              borderRadius: 'var(--r-full)', fontSize: 11, fontWeight: 600,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
              color: 'var(--success)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              GitHub: {ghStatus.login}
            </span>
          ) : (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              Connect GitHub
            </button>
          )}
        </div>
      </div>

<<<<<<< HEAD
      {/* GitHub status banner */}
      {ghStatus !== null && (
        <GitHubStatusBanner status={ghStatus} onRefresh={loadGhStatus} />
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>
          <button className="btn btn-xs" style={{ marginTop: 6 }} onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Repository list */}
      <section>
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <h2>Connected Repositories</h2>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{repos.length} registered</span>
        </div>

        {repos.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repositories…"
              style={{
                padding: '7px 12px', borderRadius: 'var(--r-sm)', fontSize: 12, width: 280,
                background: 'var(--panel-sunken)', border: '1px solid var(--line-strong)', color: 'var(--ink)',
              }}
            />
          </div>
        )}

        {loading ? (
          <div style={{ background: 'var(--panel-raised)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  {['Repository','Provider','Branch','Last Sync','Status','Issues','PRs','Last Commit','Actions'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SkeletonRow /><SkeletonRow /><SkeletonRow />
              </tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: '48px 24px', textAlign: 'center',
            background: 'var(--panel-raised)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)', borderStyle: 'dashed',
          }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
              No repositories connected
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, margin: '0 auto 20px' }}>
              Connect a GitHub repository or register a local Git repository to start using repository intelligence.
            </p>
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-sm btn-primary" onClick={() => setShowAddModal(true)}>
                Connect GitHub
              </button>
              <button className="btn btn-sm" onClick={() => setShowAddModal(true)}>
                Add Local Repository
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--panel-raised)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Provider</th>
                  <th>Default Branch</th>
                  <th>Last Sync</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Issues</th>
                  <th style={{ textAlign: 'right' }}>PRs</th>
                  <th>Last Commit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((repo) => (
                  <tr
                    key={repo.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/repositories/${repo.id}`)}
                  >
                    <td>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                          {repo.name}
                        </p>
                        {repo.fullName && (
                          <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>{repo.fullName}</p>
                        )}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {providerBadge(repo.provider)}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-text)' }}>
                        {repo.currentBranch ?? repo.defaultBranch}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {relativeTime(repo.lastSyncAt)}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
                        color: syncStatusColor(repo.syncStatus),
                      }}>
                        {syncing.has(repo.id) ? (
                          <><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--info)', display: 'inline-block', animation: 'pulse 1.2s infinite' }} /> Syncing…</>
                        ) : (
                          <><span style={{ width: 6, height: 6, borderRadius: '50%', background: syncStatusColor(repo.syncStatus), display: 'inline-block' }} /> {syncStatusLabel(repo.syncStatus)}</>
                        )}
                      </span>
                      {repo.syncError && (
                        <p style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }} title={repo.syncError}>
                          {repo.syncError.slice(0, 40)}{repo.syncError.length > 40 ? '…' : ''}
                        </p>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: repo.openIssues > 0 ? 'var(--warn)' : 'var(--muted)' }}>
                      {repo.openIssues}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: repo.openPRs > 0 ? 'var(--info)' : 'var(--muted)' }}>
                      {repo.openPRs}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {repo.lastCommitSha ? (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent-text)' }}>
                          {repo.lastCommitSha.slice(0, 8)}
                        </span>
                      ) : relativeTime(repo.lastCommitAt)}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row" style={{ gap: 4 }}>
                        <Link
                          to={`/repositories/${repo.id}`}
                          className="btn btn-xs"
                          style={{ fontSize: 10 }}
                        >
                          Open
                        </Link>
                        <button
                          className="btn btn-xs"
                          style={{ fontSize: 10 }}
                          disabled={syncing.has(repo.id)}
                          onClick={() => handleSync(repo.id)}
                          title="Sync repository metadata"
                        >
                          {syncing.has(repo.id) ? '…' : '↺'}
                        </button>
                        {repo.path !== repo.path && ( // never show for workspace repo
                          <button
                            className="btn btn-xs"
                            style={{ fontSize: 10, color: 'var(--danger)' }}
                            onClick={() => setRemoveConfirm(repo.id)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Feature classification legend */}
      <section>
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <h2>Integrations Status</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {[
            {
              title: 'Local Git',
              status: 'LIVE' as const,
              desc: 'Branch detection, commit history, file tree, and working tree status from local git repositories.',
            },
            {
              title: 'GitHub Integration',
              status: ghStatus?.configured && !ghStatus?.error ? 'LIVE' as const : 'REQUIRES CONFIG' as const,
              desc: ghStatus?.configured && !ghStatus?.error
                ? `Connected as ${ghStatus.login}. Issues, PRs, branches and commits available.`
                : 'Set GITHUB_TOKEN environment variable to enable GitHub integration.',
            },
            {
              title: 'Webhook Events',
              status: 'LIVE' as const,
              desc: 'Webhook receiver at /api/integrations/github/webhook. Requires GITHUB_WEBHOOK_SECRET for signature validation.',
            },
            {
              title: 'Issue → Investigation',
              status: 'LIVE' as const,
              desc: 'GitHub issues can be started as investigations directly, with all context automatically attached.',
            },
            {
              title: 'Create GitHub PR',
              status: 'COMING SOON' as const,
              desc: 'PR creation requires write access and branch management. Investigation reports include PR summaries ready to paste.',
            },
            {
              title: 'Automatic Sync',
              status: 'COMING SOON' as const,
              desc: 'Background job scheduling is not in the current architecture. Manual sync via the Sync button is available.',
            },
          ].map((item) => (
            <div key={item.title} style={{
              padding: '14px 16px', borderRadius: 'var(--r-md)',
              background: 'var(--panel-raised)', border: '1px solid var(--line)',
              borderStyle: item.status === 'COMING SOON' ? 'dashed' : 'solid',
            }}>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{item.title}</p>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '2px 7px', borderRadius: 'var(--r-full)',
                  background: item.status === 'LIVE' ? 'rgba(34,197,94,0.12)' :
                              item.status === 'REQUIRES CONFIG' ? 'rgba(56,189,248,0.12)' :
                              'rgba(100,116,139,0.15)',
                  color: item.status === 'LIVE' ? 'var(--success)' :
                         item.status === 'REQUIRES CONFIG' ? 'var(--info)' : 'var(--muted)',
                  border: `1px solid ${item.status === 'LIVE' ? 'rgba(34,197,94,0.2)' :
                                       item.status === 'REQUIRES CONFIG' ? 'rgba(56,189,248,0.25)' :
                                       'rgba(100,116,139,0.2)'}`,
                }}>
                  {item.status}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Webhook settings quick-view */}
      <WebhookSettings />

      {/* Add modal */}
      {showAddModal && (
        <AddRepoModal
          onClose={() => setShowAddModal(false)}
          onAdded={(repo) => {
            setRepos((prev) => [repo, ...prev.filter((r) => r.id !== repo.id)]);
            setShowAddModal(false);
          }}
          githubStatus={ghStatus}
          githubRepos={ghRepos}
          githubReposLoading={ghReposLoading}
        />
      )}

      {/* Remove confirm */}
      {removeConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--panel-raised)', border: '1px solid var(--line-strong)',
            borderRadius: 'var(--r-lg)', padding: 24, maxWidth: 400,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Remove Repository?</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              This removes the repository from FixFlow. It will not delete the actual repository or its code.
            </p>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => setRemoveConfirm(null)}>Cancel</button>
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}
                disabled={removing === removeConfirm}
                onClick={() => handleRemove(removeConfirm)}
              >
                {removing === removeConfirm ? 'Removing…' : 'Remove'}
=======
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
>>>>>>> origin/main
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Webhook settings panel                                             */
/* ──────────────────────────────────────────────────────────────────── */

function WebhookSettings() {
  const [config, setConfig] = useState<import('../types/index.js').WebhookConfig | null>(null);
  const [events, setEvents] = useState<unknown[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.github.webhookConfig().then(setConfig).catch(() => {});
  }, []);

  function loadEvents() {
    setLoading(true);
    api.github.webhookEvents().then(({ events: e }) => setEvents(e)).catch(() => {}).finally(() => setLoading(false));
  }

  if (!config) return null;

  return (
    <section>
      <div
        className="section-heading"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => { setExpanded((e) => !e); if (!expanded) loadEvents(); }}
      >
        <h2>Webhook Configuration</h2>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{expanded ? '▲ Collapse' : '▼ Expand'}</span>
      </div>

      {expanded && (
        <div style={{
          padding: '16px 18px', borderRadius: 'var(--r-md)',
          background: 'var(--panel-raised)', border: '1px solid var(--line)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Webhook URL</p>
              <code style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--info)', wordBreak: 'break-all' }}>{config.webhookUrl}</code>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Signature Validation</p>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-full)',
                background: config.secretConfigured ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                color: config.secretConfigured ? 'var(--success)' : 'var(--warn)',
                border: `1px solid ${config.secretConfigured ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
              }}>
                {config.secretConfigured ? '✓ HMAC-SHA256 enabled' : '⚠ No secret configured'}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Supported Events</p>
            <div className="row" style={{ gap: 6 }}>
              {config.supportedEvents.map((ev) => (
                <span key={ev} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'var(--panel-sunken)', border: '1px solid var(--line)', color: 'var(--muted)' }}>
                  {ev}
                </span>
              ))}
            </div>
          </div>

          {!config.secretConfigured && (
            <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--r-sm)', marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600, marginBottom: 4 }}>Webhook secret not configured</p>
              <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                export GITHUB_WEBHOOK_SECRET=&lt;your-secret&gt;
              </p>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Without a secret, incoming webhooks are accepted without signature validation. Set this in production.
              </p>
            </div>
          )}

          <div>
            <div className="spread" style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recent Events ({events.length})
              </p>
              <button className="btn btn-xs" onClick={loadEvents} disabled={loading}>
                {loading ? 'Loading…' : '↺ Refresh'}
              </button>
            </div>
            {events.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--subtle)' }}>No webhook events received yet.</p>
            ) : (
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(events as any[]).slice(0, 20).map((ev: any) => (
                  <div key={ev.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                    background: 'var(--panel-sunken)', borderRadius: 'var(--r-sm)', fontSize: 11,
                  }}>
                    <span style={{ color: ev.verified ? 'var(--success)' : 'var(--warn)', flex: 'none' }}>
                      {ev.verified ? '✓' : '⚠'}
                    </span>
                    <span style={{ color: 'var(--accent-text)', fontFamily: 'var(--mono)', flex: 'none' }}>{ev.event}</span>
                    {ev.action && <span style={{ color: 'var(--muted)' }}>{ev.action}</span>}
                    <span style={{ color: 'var(--muted)', flex: 1 }}>{ev.repositoryFullName}</span>
                    <span style={{ color: 'var(--subtle)', flex: 'none' }}>{relativeTime(ev.receivedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
