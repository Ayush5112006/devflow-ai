<<<<<<< HEAD
/**
 * /repositories/:id — Repository detail workspace.
 *
 * Tabs: Overview | Files | Branches | Commits | Issues | Pull Requests
 *
 * LIVE data — all panels load from real API endpoints.
 * GitHub tabs require GITHUB_TOKEN; local git tabs always work.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import type {
  Repository, RepositoryBranch, RepositoryCommit, RepositoryCommitDetail,
  GitFileEntry, RepositoryIssue, RepositoryPR, DetailedGitStatus,
} from '../types/index.js';

/* ──────────────────────────────────────────────────────────────────── */
/*  Utility                                                            */
/* ──────────────────────────────────────────────────────────────────── */

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 86_400_000 * 30) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusDot(status: string) {
  const color = status === 'open' ? 'var(--success)' :
                status === 'merged' ? 'var(--accent)' :
                status === 'closed' ? 'var(--muted)' :
                status === 'draft' ? 'var(--warn)' : 'var(--muted)';
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

function statusBadge(state: string) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    open:   { bg: 'rgba(34,197,94,0.12)',   color: 'var(--success)', border: 'rgba(34,197,94,0.25)' },
    closed: { bg: 'rgba(100,116,139,0.12)', color: 'var(--muted)',   border: 'rgba(100,116,139,0.2)' },
    merged: { bg: 'rgba(124,92,252,0.12)',  color: 'var(--accent-text)', border: 'rgba(124,92,252,0.25)' },
    draft:  { bg: 'rgba(245,158,11,0.12)',  color: 'var(--warn)',    border: 'rgba(245,158,11,0.25)' },
  };
  const s = styles[state] ?? styles.closed;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 'var(--r-full)',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {state}
    </span>
  );
}

type Tab = 'overview' | 'files' | 'branches' | 'commits' | 'issues' | 'prs';

/* ──────────────────────────────────────────────────────────────────── */
/*  Skeleton                                                           */
/* ──────────────────────────────────────────────────────────────────── */

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ height: 13, borderRadius: 4, background: 'var(--line)', opacity: 0.5, width: `${60 + (i % 3) * 15}%` }} />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Overview tab                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function OverviewTab({ repo, gitStatus }: { repo: Repository; gitStatus: DetailedGitStatus | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Metadata grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {[
          { label: 'Provider', value: repo.provider === 'github' ? '⬡ GitHub' : '⬡ Local' },
          { label: 'Owner', value: repo.owner ?? '—' },
          { label: 'Visibility', value: repo.visibility },
          { label: 'Language', value: repo.language ?? '—' },
          { label: 'Default Branch', value: repo.defaultBranch },
          { label: 'Current Branch', value: gitStatus?.branch ?? repo.currentBranch ?? repo.defaultBranch },
          { label: 'Open Issues', value: String(repo.openIssues) },
          { label: 'Open PRs', value: String(repo.openPRs) },
          { label: 'Stars', value: String(repo.stars) },
          { label: 'Added', value: relativeTime(repo.addedAt) },
          { label: 'Last Sync', value: relativeTime(repo.lastSyncAt) },
          { label: 'Sync Status', value: repo.syncStatus },
        ].map(({ label, value }) => (
          <div key={label} style={{
            padding: '12px 14px', borderRadius: 'var(--r-sm)',
            background: 'var(--panel-sunken)', border: '1px solid var(--line)',
          }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 13, color: 'var(--ink)', fontFamily: ['Current Branch','Default Branch','Language'].includes(label) ? 'var(--mono)' : 'inherit' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Description */}
      {repo.description && (
        <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'var(--panel-sunken)', border: '1px solid var(--line)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</p>
          <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>{repo.description}</p>
        </div>
      )}

      {/* Last commit */}
      {(repo.lastCommitSha || repo.lastCommitMessage) && (
        <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'var(--panel-sunken)', border: '1px solid var(--line)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Last Commit</p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            {repo.lastCommitSha && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-text)', flexShrink: 0, marginTop: 2 }}>
                {repo.lastCommitSha.slice(0, 8)}
              </span>
            )}
            <p style={{ fontSize: 13, color: 'var(--ink)' }}>{repo.lastCommitMessage ?? '—'}</p>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto', flexShrink: 0 }}>{relativeTime(repo.lastCommitAt)}</span>
          </div>
        </div>
      )}

      {/* Git working tree status for local repos */}
      {gitStatus && (
        <GitStatusPanel status={gitStatus} />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Git status panel (shown in overview for local repos)              */
/* ──────────────────────────────────────────────────────────────────── */

function GitStatusPanel({ status }: { status: DetailedGitStatus }) {
  if (!status.available) {
    return (
      <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <p style={{ fontSize: 12, color: 'var(--warn)' }}>Git is not available in this directory.</p>
      </div>
    );
  }

  const statusIcon: Record<string, { char: string; color: string; label: string }> = {
    M: { char: 'M', color: 'var(--warn)', label: 'Modified' },
    A: { char: 'A', color: 'var(--success)', label: 'Added' },
    D: { char: 'D', color: 'var(--danger)', label: 'Deleted' },
    R: { char: 'R', color: 'var(--info)', label: 'Renamed' },
    '?': { char: '?', color: 'var(--muted)', label: 'Untracked' },
    U: { char: 'U', color: 'var(--accent-text)', label: 'Unmerged' },
  };

  return (
    <div style={{ padding: '14px 16px', borderRadius: 'var(--r-sm)', background: 'var(--panel-sunken)', border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Working Tree Status</p>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-full)',
          background: status.clean ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
          color: status.clean ? 'var(--success)' : 'var(--warn)',
          border: `1px solid ${status.clean ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.25)'}`,
        }}>
          {status.clean ? '✓ Clean' : `${status.files.length} changes`}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 10, color: 'var(--subtle)', marginBottom: 3 }}>Branch</p>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent-text)' }}>{status.branch}</span>
          {status.ahead > 0 && <span style={{ fontSize: 10, color: 'var(--success)', marginLeft: 6 }}>↑{status.ahead}</span>}
          {status.behind > 0 && <span style={{ fontSize: 10, color: 'var(--warn)', marginLeft: 4 }}>↓{status.behind}</span>}
        </div>
        <div>
          <p style={{ fontSize: 10, color: 'var(--subtle)', marginBottom: 3 }}>Latest Commit</p>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{status.latestCommit?.slice(0, 8) ?? '—'}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>{status.latestMessage?.slice(0, 40)}</span>
        </div>
      </div>

      {status.files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
          {status.files.map((f, i) => {
            const si = statusIcon[f.status] ?? { char: f.status, color: 'var(--muted)', label: 'Changed' };
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.15)',
              }}>
                <span style={{
                  width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 3, fontSize: 9, fontWeight: 800, flexShrink: 0,
                  background: `${si.color}20`, color: si.color, border: `1px solid ${si.color}40`,
                }} title={`${si.label}${f.staged ? ' (staged)' : ''}`}>
                  {si.char}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', flex: 1 }}>{f.path}</span>
                {f.staged && (
                  <span style={{ fontSize: 9, color: 'var(--success)', fontWeight: 700 }}>STAGED</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent commits */}
      {status.recentCommits.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Recent Commits</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {status.recentCommits.slice(0, 5).map((c) => (
              <div key={c.hash} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent-text)', flexShrink: 0 }}>{c.hash.slice(0, 8)}</span>
                <span style={{ fontSize: 11, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
                <span style={{ fontSize: 10, color: 'var(--subtle)', flexShrink: 0 }}>{c.author}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Files tab                                                          */
/* ──────────────────────────────────────────────────────────────────── */

function FilesTab({ repoId }: { repoId: string }) {
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<GitFileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<{ content: string | null; size: number; error: string | null } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [search, setSearch] = useState('');

  const loadFiles = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const { entries: e } = await api.repos.files(repoId, { path: p });
      // Sort: dirs first, then files
      const sorted = [...e].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
=======
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  api,
  type RepositoryItem,
  type GitBranchItem,
  type GitCommitItem,
  type GitCommitDetailItem,
  type GitWorkingStatus,
  type FileTreeNode,
  type RepositoryIssueItem,
  type RepositoryPullRequestItem,
  type WebhookSettingsInfo,
  type WebhookEventItem,
  type CodeIntelResult,
} from '../services/api.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

type DetailTab =
  | 'overview'
  | 'files'
  | 'branches'
  | 'commits'
  | 'status'
  | 'issues'
  | 'pulls'
  | 'codeintel'
  | 'webhooks';

export function RepositoryDetailPage() {
  const { repositoryId } = useParams<{ repositoryId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [repo, setRepo] = useState<RepositoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Tab Data States
  const [branches, setBranches] = useState<GitBranchItem[]>([]);
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitCommitDetailItem | null>(null);
  const [loadingCommit, setLoadingCommit] = useState(false);

  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<{ content: string; language: string; size: number } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const [gitStatus, setGitStatus] = useState<GitWorkingStatus | null>(null);
  const [workingDiff, setWorkingDiff] = useState<string>('');

  const [issues, setIssues] = useState<RepositoryIssueItem[]>([]);
  const [pulls, setPulls] = useState<RepositoryPullRequestItem[]>([]);
  const [startingInvId, setStartingInvId] = useState<string | null>(null);

  // Create Issue Modal
  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDesc, setNewIssueDesc] = useState('');
  const [newIssueSeverity, setNewIssueSeverity] = useState('medium');
  const [creatingIssue, setCreatingIssue] = useState(false);

  // Create PR Modal
  const [showCreatePR, setShowCreatePR] = useState(false);
  const [newPRTitle, setNewPRTitle] = useState('');
  const [newPRDesc, setNewPRDesc] = useState('');
  const [newPRSource, setNewPRSource] = useState('');
  const [creatingPR, setCreatingPR] = useState(false);

  // Code Intelligence
  const [codeQuery, setCodeQuery] = useState('');
  const [codeIntelResult, setCodeIntelResult] = useState<CodeIntelResult | null>(null);
  const [queryingCode, setQueryingCode] = useState(false);

  // Webhooks
  const [webhookSettings, setWebhookSettings] = useState<WebhookSettingsInfo | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventItem[]>([]);

  const loadRepository = async () => {
    if (!repositoryId) return;
    try {
      setError(null);
      const data = await api.getRepository(repositoryId);
      setRepo(data.repository);
>>>>>>> origin/main
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
<<<<<<< HEAD
  }, [repoId]);

  useEffect(() => { loadFiles(''); }, [loadFiles]);

  async function openEntry(entry: GitFileEntry) {
    if (entry.type === 'dir') {
      setPath(entry.path);
      setSelectedFile(null);
      setFileContent(null);
      await loadFiles(entry.path);
    } else {
      setSelectedFile(entry.path);
      setFileLoading(true);
      try {
        const result = await api.repos.fileContent(repoId, entry.path);
        setFileContent(result);
      } catch (err) {
        setFileContent({ content: null, size: 0, error: err instanceof Error ? err.message : String(err) });
      } finally {
        setFileLoading(false);
      }
    }
  }

  function navigateUp() {
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.join('/');
    setPath(newPath);
    setSelectedFile(null);
    setFileContent(null);
    loadFiles(newPath);
  }

  const filteredEntries = search
    ? entries.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : entries;

  const langColor: Record<string, string> = {
    TypeScript: 'var(--info)',
    JavaScript: 'var(--warn)',
    Python: 'var(--success)',
    Go: 'var(--accent-text)',
    Rust: 'var(--danger)',
    Markdown: 'var(--muted)',
  };

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
      {/* File tree */}
      <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {path && (
            <button className="btn btn-xs" onClick={navigateUp} title="Go up">← up</button>
          )}
          <code style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            /{path}
          </code>
        </div>
        <input
          type="text"
          placeholder="Filter files…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '5px 8px', borderRadius: 'var(--r-sm)', fontSize: 11,
            background: 'var(--panel-sunken)', border: '1px solid var(--line)', color: 'var(--ink)',
          }}
        />
        <div style={{
          flex: 1, overflowY: 'auto', borderRadius: 'var(--r-sm)',
          background: 'var(--panel-sunken)', border: '1px solid var(--line)',
        }}>
          {loading ? (
            <div style={{ padding: 12 }}><Skeleton lines={8} /></div>
          ) : error ? (
            <div style={{ padding: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <p style={{ padding: 12, fontSize: 11, color: 'var(--muted)' }}>No files found</p>
          ) : (
            filteredEntries.map((entry) => (
              <button
                key={entry.path}
                onClick={() => openEntry(entry)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '6px 10px', borderRadius: 0, border: 'none', cursor: 'pointer',
                  background: selectedFile === entry.path ? 'var(--accent-soft)' : 'transparent',
                  color: selectedFile === entry.path ? 'var(--accent-text)' : 'var(--ink)',
                  borderLeft: selectedFile === entry.path ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <span style={{ fontSize: 12, flexShrink: 0 }}>
                  {entry.type === 'dir' ? '▶' : '·'}
                </span>
                <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>
                  {entry.name}
                </span>
                {entry.language && (
                  <span style={{ fontSize: 9, color: langColor[entry.language] ?? 'var(--muted)', flexShrink: 0 }}>
                    {entry.language.slice(0, 2)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* File viewer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {selectedFile ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent-text)' }}>{selectedFile}</code>
              {fileContent?.size != null && fileContent.size > 0 && (
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>({(fileContent.size / 1024).toFixed(1)} KB)</span>
              )}
            </div>
            <div style={{
              flex: 1, borderRadius: 'var(--r-sm)', background: 'var(--panel-sunken)',
              border: '1px solid var(--line)', overflow: 'auto',
            }}>
              {fileLoading ? (
                <div style={{ padding: 16 }}><Skeleton lines={12} /></div>
              ) : fileContent?.error ? (
                <div style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--danger)' }}>{fileContent.error}</p>
                </div>
              ) : fileContent?.content != null ? (
                <pre style={{
                  margin: 0, padding: '12px 16px', fontSize: 11,
                  fontFamily: 'var(--mono)', lineHeight: 1.7, color: 'var(--ink)', whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {fileContent.content.slice(0, 100_000)}
                  {fileContent.content.length > 100_000 && '\n\n[truncated — file too large to display fully]'}
                </pre>
              ) : (
                <p style={{ padding: 16, fontSize: 12, color: 'var(--muted)' }}>Select a file to view its contents.</p>
              )}
            </div>
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--r-sm)', background: 'var(--panel-sunken)', border: '1px solid var(--line)',
          }}>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Select a file to view its contents</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Branches tab                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function BranchesTab({ repoId, defaultBranch }: { repoId: string; defaultBranch: string }) {
  const [branches, setBranches] = useState<RepositoryBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.repos.branches(repoId)
      .then(({ branches: b }) => setBranches(b))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [repoId]);

  const filtered = search ? branches.filter((b) => b.name.toLowerCase().includes(search.toLowerCase())) : branches;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {branches.length > 0 && (
        <input
          type="text"
          placeholder="Filter branches…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '7px 12px', borderRadius: 'var(--r-sm)', fontSize: 12, width: 280,
            background: 'var(--panel-sunken)', border: '1px solid var(--line-strong)', color: 'var(--ink)',
          }}
        />
      )}
      {loading ? (
        <Skeleton lines={6} />
      ) : error ? (
        <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--r-sm)' }}>
          <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', borderStyle: 'dashed' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No branches found</p>
        </div>
      ) : (
        <div style={{ background: 'var(--panel-raised)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Last Commit</th>
                <th>Author</th>
                <th>Updated</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.name}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: b.isDefault ? 'var(--accent-text)' : 'var(--ink)' }}>
                        {b.name}
                      </span>
                      {b.isDefault && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 'var(--r-full)', background: 'rgba(124,92,252,0.12)', color: 'var(--accent-text)', border: '1px solid rgba(124,92,252,0.2)' }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>{b.sha.slice(0, 8)}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.lastCommitMessage ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--muted)' }}>{b.lastCommitAuthor ?? '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--muted)' }}>{relativeTime(b.lastCommitAt)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {b.isProtected && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 'var(--r-full)', background: 'rgba(245,158,11,0.12)', color: 'var(--warn)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          PROTECTED
                        </span>
                      )}
                      {b.ahead > 0 && <span style={{ fontSize: 10, color: 'var(--success)' }}>↑{b.ahead}</span>}
                      {b.behind > 0 && <span style={{ fontSize: 10, color: 'var(--warn)' }}>↓{b.behind}</span>}
                    </div>
                  </td>
=======
  };

  useEffect(() => {
    loadRepository();
  }, [repositoryId]);

  // Load Tab Specific Data
  useEffect(() => {
    if (!repositoryId || !repo) return;

    if (activeTab === 'branches') {
      api.getRepoBranches(repositoryId).then((d) => setBranches(d.branches)).catch(() => undefined);
    }
    if (activeTab === 'commits') {
      api.getRepoCommits(repositoryId, 40).then((d) => setCommits(d.commits)).catch(() => undefined);
    }
    if (activeTab === 'files') {
      api.getRepoFiles(repositoryId).then((d) => setFileTree(d.tree)).catch(() => undefined);
    }
    if (activeTab === 'status') {
      api.getRepoWorkingStatus(repositoryId).then((d) => setGitStatus(d.status)).catch(() => undefined);
      api.getRepoWorkingDiff(repositoryId).then((d) => setWorkingDiff(d.diff)).catch(() => undefined);
    }
    if (activeTab === 'issues' || activeTab === 'overview') {
      api.getRepoIssues(repositoryId).then((d) => setIssues(d.issues)).catch(() => undefined);
    }
    if (activeTab === 'pulls' || activeTab === 'overview') {
      api.getRepoPullRequests(repositoryId).then((d) => setPulls(d.pullRequests)).catch(() => undefined);
    }
    if (activeTab === 'webhooks') {
      api.getWebhookSettings().then((d) => setWebhookSettings(d)).catch(() => undefined);
      api.getWebhookEvents().then((d) => setWebhookEvents(d.events)).catch(() => undefined);
    }
  }, [activeTab, repositoryId, repo]);

  const handleSync = async () => {
    if (!repositoryId) return;
    setSyncing(true);
    try {
      await api.syncRepository(repositoryId);
      await loadRepository();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleFileClick = async (filePath: string) => {
    if (!repositoryId) return;
    setSelectedFilePath(filePath);
    setLoadingFile(true);
    try {
      const data = await api.getRepoFileContent(repositoryId, filePath);
      setFileContent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingFile(false);
    }
  };

  const handleCommitClick = async (hash: string) => {
    if (!repositoryId) return;
    setLoadingCommit(true);
    try {
      const data = await api.getRepoCommitDetail(repositoryId, hash);
      setSelectedCommit(data.commit);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingCommit(false);
    }
  };

  const handleStartInvestigation = async (issueId: string) => {
    if (!repositoryId) return;
    setStartingInvId(issueId);
    try {
      const result = await api.investigateRepoIssue(repositoryId, issueId);
      navigate(`/investigations/${result.investigationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStartingInvId(null);
    }
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repositoryId || !newIssueTitle.trim()) return;
    setCreatingIssue(true);
    try {
      await api.createRepoIssue(repositoryId, {
        title: newIssueTitle.trim(),
        description: newIssueDesc.trim(),
        severity: newIssueSeverity,
        labels: ['bug', 'investigation-ready'],
      });
      setShowCreateIssue(false);
      setNewIssueTitle('');
      setNewIssueDesc('');
      const updated = await api.getRepoIssues(repositoryId);
      setIssues(updated.issues);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingIssue(false);
    }
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repositoryId || !newPRTitle.trim() || !newPRSource.trim()) return;
    setCreatingPR(true);
    try {
      await api.createRepoPullRequest(repositoryId, {
        title: newPRTitle.trim(),
        description: newPRDesc.trim(),
        sourceBranch: newPRSource.trim(),
        targetBranch: repo?.defaultBranch || 'main',
      });
      setShowCreatePR(false);
      setNewPRTitle('');
      setNewPRDesc('');
      setNewPRSource('');
      const updated = await api.getRepoPullRequests(repositoryId);
      setPulls(updated.pullRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingPR(false);
    }
  };

  const handleRunCodeIntel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repositoryId || !codeQuery.trim()) return;
    setQueryingCode(true);
    try {
      const res = await api.queryCodeIntelligence(repositoryId, codeQuery.trim());
      setCodeIntelResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setQueryingCode(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading Repository Workspace…" />;
  if (!repo) {
    return (
      <div className="empty">
        <p className="empty-title">Repository not found</p>
        <Link to="/repositories" className="btn btn-primary btn-sm">
          ← Back to repositories
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ─── Top Navigation & Title ─── */}
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/repositories">Repositories</Link>
        <span aria-hidden="true">›</span>
        <span style={{ color: 'var(--ink)' }}>{repo.name}</span>
      </nav>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>
              {repo.provider === 'github' ? '🐙' : repo.provider === 'local' ? '📁' : '🧪'}
            </span>
            <h1 className="page-title" style={{ margin: 0 }}>{repo.name}</h1>
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
            <span className="chip" style={{ color: repo.status === 'active' ? 'var(--accent)' : 'var(--warn)' }}>
              ● {repo.status.toUpperCase()}
            </span>
          </div>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>
            {repo.description}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-sm" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : '⟳ Sync Repository'}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreateIssue(true)}>
            + New Issue
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

      {/* ─── Navigation Tabs ─── */}
      <div className="tabs">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'files', label: 'Files', icon: '📄' },
          { id: 'branches', label: 'Branches', icon: '🌿' },
          { id: 'commits', label: 'Commits', icon: '📜' },
          { id: 'status', label: 'Git Working Tree', icon: '⚡' },
          { id: 'issues', label: `Issues (${repo.openIssuesCount})`, icon: '🐛' },
          { id: 'pulls', label: `Pull Requests (${repo.openPullRequestsCount})`, icon: '🔀' },
          { id: 'codeintel', label: 'Code Intelligence', icon: '🧠' },
          { id: 'webhooks', label: 'Webhooks & Settings', icon: '⚙️' },
        ].map((tab) => (
          <button
            key={tab.id}
            className="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id as DetailTab)}
          >
            <span style={{ fontSize: 13 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ─── TAB 1: OVERVIEW ─── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Key Facts */}
          <div className="metric-grid">
            <div className="metric">
              <p className="metric-value mono" style={{ fontSize: 18 }}>{repo.currentBranch || repo.defaultBranch}</p>
              <p className="metric-label">Current Branch</p>
            </div>
            <div className="metric">
              <p className="metric-value mono" style={{ fontSize: 18, color: 'var(--accent)' }}>
                {repo.lastCommitHash ? repo.lastCommitHash.slice(0, 8) : 'HEAD'}
              </p>
              <p className="metric-label">Latest Commit</p>
            </div>
            <div className="metric">
              <p className="metric-value" style={{ color: 'var(--warn)' }}>{issues.length}</p>
              <p className="metric-label">Active Issues</p>
            </div>
            <div className="metric">
              <p className="metric-value" style={{ color: 'var(--info)' }}>{pulls.length}</p>
              <p className="metric-label">Pull Requests</p>
            </div>
          </div>

          {/* Quick Demo Workflow Bridge Callout */}
          <div className="banner banner-ok">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="banner-title" style={{ color: 'var(--accent)' }}>
                🚀 AI Investigation Pipeline Connected
              </div>
              <p className="banner-text">
                Every issue in this repository can be automatically converted into an autonomous FixFlow AI investigation.
                Six specialized agents (Code, API, DB, Test, Evidence, History) will isolate the defect, generate a minimal
                approved change, verify it with tests, and construct a pull request.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('issues')}>
              View Issues & Start Investigation →
            </button>
          </div>

          {/* Recent Issues and Pull Requests */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
            {/* Recent Issues */}
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Repository Issues</span>
                <button className="btn btn-sm" onClick={() => setActiveTab('issues')}>
                  View all ({issues.length})
                </button>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {issues.slice(0, 3).map((iss) => (
                  <div
                    key={iss.id}
                    style={{
                      padding: 12,
                      background: 'var(--panel-sunken)',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>
                          #{iss.number}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{iss.title}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineClamp: 2 }}>
                        {iss.description}
                      </p>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ whiteSpace: 'nowrap' }}
                      disabled={startingInvId === iss.id}
                      onClick={() => handleStartInvestigation(iss.id)}
                    >
                      {startingInvId === iss.id ? 'Starting…' : '⚡ Investigate'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent PRs */}
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Pull Requests</span>
                <button className="btn btn-sm" onClick={() => setActiveTab('pulls')}>
                  View all ({pulls.length})
                </button>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pulls.length === 0 ? (
                  <p className="subtle" style={{ margin: 0, fontSize: 13 }}>No open pull requests.</p>
                ) : (
                  pulls.slice(0, 3).map((pr) => (
                    <div
                      key={pr.id}
                      style={{
                        padding: 12,
                        background: 'var(--panel-sunken)',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>
                          #{pr.number}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{pr.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--subtle)' }}>
                        <span>Branch: {pr.sourceBranch} → {pr.targetBranch}</span>
                        <span>State: {pr.state}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: FILE EXPLORER ─── */}
      {activeTab === 'files' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, minHeight: 480 }}>
          {/* File Tree Panel */}
          <div className="panel" style={{ overflowY: 'auto', maxHeight: 600 }}>
            <div className="panel-head">
              <span className="panel-title">Repository Tree</span>
            </div>
            <div style={{ padding: '8px 4px' }}>
              {renderTreeNodes(fileTree, selectedFilePath, handleFileClick)}
            </div>
          </div>

          {/* File Viewer Panel */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-head">
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink)' }}>
                {selectedFilePath || 'Select a file to inspect'}
              </span>
              {fileContent && (
                <span className="subtle" style={{ fontSize: 11 }}>
                  {fileContent.language.toUpperCase()} · {(fileContent.size / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
            <div className="panel-body" style={{ flex: 1, overflow: 'auto', padding: 0 }}>
              {loadingFile ? (
                <div style={{ padding: 40 }}><LoadingSpinner message="Reading file…" /></div>
              ) : fileContent ? (
                <pre
                  className="code"
                  style={{
                    margin: 0,
                    borderRadius: 0,
                    border: 'none',
                    background: 'transparent',
                    maxHeight: 520,
                  }}
                >
                  {fileContent.content}
                </pre>
              ) : (
                <div className="empty" style={{ padding: '60px 20px' }}>
                  <span style={{ fontSize: 28 }}>📄</span>
                  <p className="empty-title">No file selected</p>
                  <p className="empty-text">Click any file in the tree to view its source code and structure.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: BRANCHES ─── */}
      {activeTab === 'branches' && (
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-head">
            <span className="panel-title">Branches ({branches.length})</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Branch Name</th>
                <th>Status</th>
                <th>Latest Commit</th>
                <th>Author</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.name}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--accent)' }}>🌿</span>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{b.name}</span>
                      {b.isCurrent && <span className="chip" style={{ color: 'var(--accent)' }}>Current</span>}
                      {b.isProtected && <span className="chip" style={{ color: 'var(--warn)' }}>Protected</span>}
                    </div>
                  </td>
                  <td>
                    <span className="chip">Clean</span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                      {b.latestCommitHash.slice(0, 8)}
                    </span>{' '}
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{b.latestCommitMessage}</span>
                  </td>
                  <td><span style={{ fontSize: 12 }}>{b.author || '—'}</span></td>
                  <td><span style={{ fontSize: 11.5, color: 'var(--subtle)' }}>{b.date || '—'}</span></td>
>>>>>>> origin/main
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
<<<<<<< HEAD
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Commits tab                                                        */
/* ──────────────────────────────────────────────────────────────────── */

function CommitsTab({ repoId }: { repoId: string }) {
  const [commits, setCommits] = useState<RepositoryCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedCommit, setSelectedCommit] = useState<RepositoryCommitDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.repos.commits(repoId, { page, per_page: 20 })
      .then(({ commits: c }) => setCommits(c))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [repoId, page]);

  async function openCommit(sha: string) {
    setDetailLoading(true);
    try {
      const { commit } = await api.repos.commitDetail(repoId, sha);
      setSelectedCommit(commit);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  }

  if (selectedCommit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-xs" onClick={() => setSelectedCommit(null)}>← Back</button>
          <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent-text)' }}>{selectedCommit.sha.slice(0, 12)}</code>
        </div>
        <div style={{ padding: '14px 16px', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{selectedCommit.message}</p>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
            <span>{selectedCommit.author} &lt;{selectedCommit.authorEmail}&gt;</span>
            <span>{new Date(selectedCommit.date).toLocaleString()}</span>
            <span style={{ color: 'var(--success)' }}>+{selectedCommit.additions}</span>
            <span style={{ color: 'var(--danger)' }}>-{selectedCommit.deletions}</span>
            <span>{selectedCommit.filesChanged} files</span>
          </div>
        </div>
        {selectedCommit.files.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Files Changed</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {selectedCommit.files.map((f) => (
                <div key={f.filename} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', flex: 1 }}>{f.filename}</span>
                  <span style={{ fontSize: 10, color: 'var(--success)' }}>+{f.additions}</span>
                  <span style={{ fontSize: 10, color: 'var(--danger)' }}>-{f.deletions}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {selectedCommit.diff && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Diff</p>
            <pre style={{
              padding: '12px 14px', borderRadius: 'var(--r-sm)',
              background: 'var(--panel-sunken)', border: '1px solid var(--line)',
              fontSize: 11, fontFamily: 'var(--mono)', lineHeight: 1.6,
              overflowX: 'auto', maxHeight: 600, color: 'var(--ink)',
              whiteSpace: 'pre',
            }}>
              {selectedCommit.diff.slice(0, 20_000)}
              {selectedCommit.diff.length > 20_000 && '\n[diff truncated]'}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {loading ? (
        <Skeleton lines={8} />
      ) : error ? (
        <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--r-sm)' }}>
          <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>
        </div>
      ) : commits.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', borderStyle: 'dashed' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No commits available</p>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--panel-raised)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>SHA</th>
                  <th>Message</th>
                  <th>Author</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Changes</th>
=======

      {/* ─── TAB 4: COMMITS ─── */}
      {activeTab === 'commits' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="panel" style={{ overflow: 'hidden' }}>
            <div className="panel-head">
              <span className="panel-title">Commit Log</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Hash</th>
                  <th>Message</th>
                  <th>Author</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
>>>>>>> origin/main
                </tr>
              </thead>
              <tbody>
                {commits.map((c) => (
<<<<<<< HEAD
                  <tr key={c.sha} style={{ cursor: 'pointer' }} onClick={() => openCommit(c.sha)}>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-text)' }}>{c.shortSha}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--ink)' }}>{c.message.slice(0, 80)}{c.message.length > 80 ? '…' : ''}</span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{c.author}</td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{relativeTime(c.date)}</td>
                    <td style={{ textAlign: 'right', fontSize: 11 }}>
                      {c.filesChanged > 0 && (
                        <span style={{ color: 'var(--muted)' }}>
                          {c.filesChanged} file{c.filesChanged !== 1 ? 's' : ''}
                          {c.additions > 0 && <span style={{ color: 'var(--success)', marginLeft: 4 }}>+{c.additions}</span>}
                          {c.deletions > 0 && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>-{c.deletions}</span>}
                        </span>
                      )}
=======
                  <tr key={c.hash} onClick={() => handleCommitClick(c.hash)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                        {c.shortHash}
                      </span>
                    </td>
                    <td><span style={{ fontWeight: 500, color: 'var(--ink)' }}>{c.message}</span></td>
                    <td><span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.author}</span></td>
                    <td><span style={{ fontSize: 11.5, color: 'var(--subtle)' }}>{c.date}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm" onClick={() => handleCommitClick(c.hash)}>
                        Diff →
                      </button>
>>>>>>> origin/main
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
<<<<<<< HEAD
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Newer</button>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Page {page}</span>
            <button className="btn btn-xs" disabled={commits.length < 20} onClick={() => setPage((p) => p + 1)}>Older →</button>
          </div>
        </>
      )}
      {detailLoading && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, padding: '8px 14px', background: 'var(--panel-raised)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--muted)' }}>
          Loading commit…
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Issues tab                                                         */
/* ──────────────────────────────────────────────────────────────────── */

function IssuesTab({ repoId, provider, repoFullName }: { repoId: string; provider: string; repoFullName: string | null }) {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<RepositoryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [creating, setCreating] = useState<string | null>(null); // issue id being converted to investigation
  const [created, setCreated] = useState<Record<string, string>>({}); // issueId -> investigationId

  useEffect(() => {
    setLoading(true);
    api.repos.issues(repoId, { state: stateFilter })
      .then(({ issues: iss }) => setIssues(iss))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [repoId, stateFilter]);

  async function startInvestigation(issue: RepositoryIssue) {
    setCreating(issue.id);
    try {
      const { investigation } = await api.createInvestigation({
        projectId: 'insightboard', // default project — user can reassign
        bug: {
          title: `[GitHub #${issue.number}] ${issue.title}`,
          description: [
            `**GitHub Issue #${issue.number}**${repoFullName ? ` in ${repoFullName}` : ''}`,
            `**State:** ${issue.state}`,
            issue.labels.length > 0 ? `**Labels:** ${issue.labels.join(', ')}` : '',
            issue.assignee ? `**Assignee:** ${issue.assignee}` : '',
            '',
            issue.body || '_(No description provided)_',
          ].filter(Boolean).join('\n'),
          severity: issue.labels.some((l) => l.toLowerCase().includes('critical') || l.toLowerCase().includes('urgent')) ? 'critical'
                  : issue.labels.some((l) => l.toLowerCase().includes('high')) ? 'high'
                  : issue.labels.some((l) => l.toLowerCase().includes('low')) ? 'low'
                  : 'medium',
          expectedBehavior: 'The issue described in the GitHub issue is resolved.',
          actualBehavior: issue.title,
          reproSteps: [`GitHub Issue: ${issue.url ?? `#${issue.number}`}`],
        },
      });
      setCreated((prev) => ({ ...prev, [issue.id]: investigation.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(null);
    }
  }

  if (provider !== 'github') {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', borderStyle: 'dashed' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Issues are only available for GitHub repositories</p>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Local repositories do not have an issue tracker. Connect a GitHub repository to view issues here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['open', 'closed', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStateFilter(s)}
            style={{
              padding: '4px 12px', borderRadius: 'var(--r-sm)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: stateFilter === s ? 'var(--accent-soft)' : 'transparent',
              color: stateFilter === s ? 'var(--accent-text)' : 'var(--muted)',
              border: stateFilter === s ? '1px solid rgba(124,92,252,0.3)' : '1px solid transparent',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton lines={6} />
      ) : error ? (
        <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--r-sm)' }}>
          <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>
        </div>
      ) : issues.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', borderStyle: 'dashed' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No {stateFilter === 'all' ? '' : stateFilter + ' '}issues</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {issues.map((issue) => {
            const invId = created[issue.id];
            return (
              <div key={issue.id} style={{
                padding: '12px 14px', borderRadius: 'var(--r-sm)',
                background: 'var(--panel-sunken)', border: '1px solid var(--line)',
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}>
                <div style={{ paddingTop: 3 }}>{statusDot(issue.state)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>#{issue.number}</span>
                    {issue.url ? (
                      <a href={issue.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                        {issue.title}
                      </a>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{issue.title}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>by {issue.author}</span>
                    <span style={{ fontSize: 11, color: 'var(--subtle)' }}>{relativeTime(issue.updatedAt)}</span>
                    {issue.labels.map((label) => (
                      <span key={label} style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 'var(--r-full)',
                        background: 'rgba(124,92,252,0.1)', color: 'var(--accent-text)',
                        border: '1px solid rgba(124,92,252,0.2)',
                      }}>
                        {label}
                      </span>
                    ))}
                    {issue.assignee && (
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>→ {issue.assignee}</span>
                    )}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {invId ? (
                    <Link to={`/investigations/${invId}`} className="btn btn-xs btn-primary">
                      View Investigation →
                    </Link>
                  ) : (
                    <button
                      className="btn btn-xs btn-primary"
                      disabled={creating === issue.id}
                      onClick={() => startInvestigation(issue)}
                    >
                      {creating === issue.id ? 'Starting…' : 'Start Investigation'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
=======

          {/* Commit Diff Modal or Detail Drawer */}
          {selectedCommit && (
            <div className="panel">
              <div className="panel-head">
                <div>
                  <span className="panel-title">Commit {selectedCommit.shortHash}</span>
                  <p style={{ margin: '4px 0 0', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
                    {selectedCommit.message}
                  </p>
                </div>
                <button className="btn btn-sm" onClick={() => setSelectedCommit(null)}>
                  Close
                </button>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
                  <span>Author: <strong>{selectedCommit.author}</strong></span>
                  <span>Files: <strong>{selectedCommit.filesChanged}</strong></span>
                  <span style={{ color: 'var(--accent)' }}>+{selectedCommit.insertions}</span>
                  <span style={{ color: 'var(--danger)' }}>-{selectedCommit.deletions}</span>
                </div>
                <pre
                  className="code"
                  style={{ maxHeight: 360, overflowY: 'auto', background: 'var(--panel-sunken)' }}
                >
                  {selectedCommit.fullDiff || 'No text diff available.'}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: GIT WORKING TREE STATUS ─── */}
      {activeTab === 'status' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Working Tree Status</span>
              {gitStatus && (
                <span className="chip" style={{ color: gitStatus.isClean ? 'var(--accent)' : 'var(--warn)' }}>
                  {gitStatus.isClean ? 'CLEAN' : 'UNCOMMITTED CHANGES'}
                </span>
              )}
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {gitStatus ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                    <div style={{ padding: 12, background: 'var(--panel-sunken)', borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>MODIFIED</p>
                      <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--warn)' }}>
                        {gitStatus.status.modified.length}
                      </p>
                    </div>
                    <div style={{ padding: 12, background: 'var(--panel-sunken)', borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>ADDED</p>
                      <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
                        {gitStatus.status.added.length}
                      </p>
                    </div>
                    <div style={{ padding: 12, background: 'var(--panel-sunken)', borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>DELETED</p>
                      <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        {gitStatus.status.deleted.length}
                      </p>
                    </div>
                    <div style={{ padding: 12, background: 'var(--panel-sunken)', borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>UNTRACKED</p>
                      <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--muted)' }}>
                        {gitStatus.status.untracked.length}
                      </p>
                    </div>
                  </div>

                  {gitStatus.modifiedFiles.length > 0 && (
                    <div>
                      <p className="panel-title" style={{ marginBottom: 8 }}>Changed Files:</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {gitStatus.modifiedFiles.map((f) => (
                          <span key={f} className="chip mono">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="subtle">Working tree status not available for remote-only repositories.</p>
              )}
            </div>
          </div>

          {workingDiff && (
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Working Tree Diff</span>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                <pre className="code" style={{ margin: 0, border: 'none', maxHeight: 420 }}>
                  {workingDiff}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 6: ISSUES & 1-CLICK INVESTIGATION ─── */}
      {activeTab === 'issues' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Issues tracked in this repository. Click <strong>"Start Investigation"</strong> to immediately trigger FixFlow's
              AI multi-agent debugging swarm on the problem with zero manual context copying.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateIssue(true)}>
              + Create Issue
            </button>
          </div>

          <div className="panel" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title & Description</th>
                  <th>State</th>
                  <th>Labels</th>
                  <th>Author</th>
                  <th style={{ textAlign: 'right' }}>Workflow Action</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((iss) => (
                  <tr key={iss.id}>
                    <td><span className="mono" style={{ color: 'var(--subtle)' }}>#{iss.number}</span></td>
                    <td style={{ maxWidth: 460 }}>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{iss.title}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted)', lineClamp: 2 }}>
                        {iss.description}
                      </p>
                    </td>
                    <td>
                      <span className="chip" style={{ color: iss.state === 'open' ? 'var(--accent)' : 'var(--subtle)' }}>
                        {iss.state.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {iss.labels.map((l) => (
                          <span key={l} className="chip" style={{ fontSize: 10 }}>{l}</span>
                        ))}
                      </div>
                    </td>
                    <td><span style={{ fontSize: 12 }}>{iss.author}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={startingInvId === iss.id}
                        onClick={() => handleStartInvestigation(iss.id)}
                        title="Directly launch FixFlow AI investigation agents for this issue"
                      >
                        {startingInvId === iss.id ? 'Launching Swarm…' : '⚡ Start Investigation'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 7: PULL REQUESTS ─── */}
      {activeTab === 'pulls' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Pull Requests generated from verified AI fixes or created manually by developers.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreatePR(true)}>
              + Create Pull Request
            </button>
          </div>

          <div className="panel" style={{ overflow: 'hidden' }}>
            {pulls.length === 0 ? (
              <div className="empty">
                <span style={{ fontSize: 30 }}>🔀</span>
                <p className="empty-title">No pull requests</p>
                <p className="empty-text">Complete an investigation to generate verified pull requests automatically.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>PR</th>
                    <th>Title</th>
                    <th>Branches</th>
                    <th>State</th>
                    <th>Author</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {pulls.map((pr) => (
                    <tr key={pr.id}>
                      <td><span className="mono" style={{ color: 'var(--subtle)' }}>#{pr.number}</span></td>
                      <td>
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink)' }}>{pr.title}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>{pr.description}</p>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: 11 }}>
                          {pr.sourceBranch} → {pr.targetBranch}
                        </span>
                      </td>
                      <td>
                        <span className="chip" style={{ color: pr.state === 'open' ? 'var(--accent)' : 'var(--info)' }}>
                          {pr.state.toUpperCase()}
                        </span>
                      </td>
                      <td><span style={{ fontSize: 12 }}>{pr.author}</span></td>
                      <td>
                        <span className="chip" style={{ color: 'var(--warn)' }}>
                          {pr.reviewStatus?.replace('_', ' ').toUpperCase() || 'REVIEW'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 8: CODE INTELLIGENCE ─── */}
      {activeTab === 'codeintel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Repository Code Intelligence</span>
            </div>
            <form onSubmit={handleRunCodeIntel} className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
                Query the repository index for architectural elements, database models, API handlers, and symbol declarations:
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  className="input"
                  value={codeQuery}
                  onChange={(e) => setCodeQuery(e.target.value)}
                  placeholder="e.g. Where is customer orders table defined? Or which API handles prediction?"
                />
                <button type="submit" className="btn btn-primary" disabled={queryingCode}>
                  {queryingCode ? 'Analyzing…' : 'Ask Intelligence'}
                </button>
              </div>
            </form>
          </div>

          {codeIntelResult && (
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Evidence & Analysis</span>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontWeight: 600, color: 'var(--accent)', margin: 0 }}>
                  {codeIntelResult.summary}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {codeIntelResult.evidence.map((ev, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 12,
                        background: 'var(--panel-sunken)',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 13 }}>
                          {ev.file}{ev.line ? `:${ev.line}` : ''}
                        </span>
                        <span className="chip" style={{ color: 'var(--accent)' }}>
                          {(ev.score * 100).toFixed(0)}% MATCH
                        </span>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--muted)' }}>{ev.snippet}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>{ev.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 9: WEBHOOKS & SETTINGS ─── */}
      {activeTab === 'webhooks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Webhook Configuration & Security</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink)' }}>
                    Payload URL: <code>/api/integrations/github/webhook</code>
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--subtle)' }}>
                    Content type: application/json · Supported: issues, pull_request, push
                  </p>
                </div>
                <span className="chip" style={{ color: webhookSettings?.hasSecret ? 'var(--accent)' : 'var(--warn)' }}>
                  {webhookSettings?.hasSecret ? 'HMAC-SHA256 SECURED' : 'SECRET NOT SET'}
                </span>
              </div>

              <div style={{ paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--muted)' }}>
                {webhookSettings?.hasSecret ? (
                  <p style={{ margin: 0 }}>
                    ✓ Webhook signature verification is active. Every incoming payload is cryptographically validated
                    against <code>GITHUB_WEBHOOK_SECRET</code> before acceptance.
                  </p>
                ) : (
                  <p style={{ margin: 0 }}>
                    ⚠️ Configure <code>GITHUB_WEBHOOK_SECRET</code> in your environment to enable verified delivery.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Recent Webhook Deliveries ({webhookEvents.length})</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              {webhookEvents.length === 0 ? (
                <p className="subtle" style={{ padding: 20, margin: 0 }}>No webhook events received yet.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Status</th>
                      <th>Summary</th>
                      <th>Received At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhookEvents.map((e) => (
                      <tr key={e.id}>
                        <td><span className="mono">{e.eventType}</span></td>
                        <td>
                          <span
                            className="chip"
                            style={{ color: e.status === 'processed' ? 'var(--accent)' : 'var(--danger)' }}
                          >
                            {e.status.toUpperCase()}
                          </span>
                        </td>
                        <td><span style={{ fontSize: 12 }}>{e.summary}</span></td>
                        <td><span style={{ fontSize: 11, color: 'var(--subtle)' }}>{new Date(e.receivedAt).toLocaleTimeString()}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE ISSUE MODAL ─── */}
      {showCreateIssue && (
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
          onClick={() => setShowCreateIssue(false)}
        >
          <div className="panel" style={{ width: '100%', maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <span className="panel-title">Create Repository Issue</span>
              <button onClick={() => setShowCreateIssue(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateIssue} className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="field">
                <span className="field-label">Issue Title *</span>
                <input
                  className="input"
                  value={newIssueTitle}
                  onChange={(e) => setNewIssueTitle(e.target.value)}
                  placeholder="e.g. Memory leak in background worker on large datasets"
                  required
                />
              </label>

              <label className="field">
                <span className="field-label">Severity</span>
                <select
                  className="select"
                  value={newIssueSeverity}
                  onChange={(e) => setNewIssueSeverity(e.target.value)}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">Description & Reproduction Context *</span>
                <textarea
                  className="textarea"
                  rows={4}
                  value={newIssueDesc}
                  onChange={(e) => setNewIssueDesc(e.target.value)}
                  placeholder="Describe the failure, observed error logs, or symptoms…"
                  required
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn" onClick={() => setShowCreateIssue(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creatingIssue}>
                  {creatingIssue ? 'Creating…' : 'Create Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CREATE PULL REQUEST MODAL ─── */}
      {showCreatePR && (
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
          onClick={() => setShowCreatePR(false)}
        >
          <div className="panel" style={{ width: '100%', maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <span className="panel-title">Create Pull Request</span>
              <button onClick={() => setShowCreatePR(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePR} className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="field">
                <span className="field-label">PR Title *</span>
                <input
                  className="input"
                  value={newPRTitle}
                  onChange={(e) => setNewPRTitle(e.target.value)}
                  placeholder="e.g. fix: resolve null reference in sentiment model"
                  required
                />
              </label>

              <label className="field">
                <span className="field-label">Source Branch *</span>
                <input
                  className="input mono"
                  value={newPRSource}
                  onChange={(e) => setNewPRSource(e.target.value)}
                  placeholder="e.g. fix/fixflow-d1"
                  required
                />
              </label>

              <label className="field">
                <span className="field-label">PR Summary & Test Evidence</span>
                <textarea
                  className="textarea"
                  rows={4}
                  value={newPRDesc}
                  onChange={(e) => setNewPRDesc(e.target.value)}
                  placeholder="Summary of changes, verification test results, and impact analysis…"
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn" onClick={() => setShowCreatePR(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creatingPR}>
                  {creatingPR ? 'Submitting…' : 'Open Pull Request'}
                </button>
              </div>
            </form>
          </div>
>>>>>>> origin/main
        </div>
      )}
    </div>
  );
}

<<<<<<< HEAD
/* ──────────────────────────────────────────────────────────────────── */
/*  Pull Requests tab                                                  */
/* ──────────────────────────────────────────────────────────────────── */

function PRsTab({ repoId, provider }: { repoId: string; provider: string }) {
  const [prs, setPrs] = useState<RepositoryPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [selected, setSelected] = useState<RepositoryPR | null>(null);

  useEffect(() => {
    setLoading(true);
    api.repos.prs(repoId, { state: stateFilter })
      .then(({ prs: p }) => setPrs(p))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [repoId, stateFilter]);

  if (provider !== 'github') {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', borderStyle: 'dashed' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Pull Requests are only available for GitHub repositories</p>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Connect a GitHub repository to view pull requests.</p>
      </div>
    );
  }

  if (selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-xs" onClick={() => setSelected(null)}>← Back</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>PR #{selected.number}: {selected.title}</span>
          {statusBadge(selected.state)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            ['Author', selected.author],
            ['Source', selected.sourceBranch],
            ['Target', selected.targetBranch],
            ['Created', relativeTime(selected.createdAt)],
            ['Updated', relativeTime(selected.updatedAt)],
            ['Review Status', selected.reviewStatus],
            ['Additions', String(selected.additions)],
            ['Deletions', String(selected.deletions)],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '8px 12px', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
              <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{label}</p>
              <p style={{ fontSize: 12, color: 'var(--ink)', fontFamily: ['Source','Target'].includes(label) ? 'var(--mono)' : 'inherit' }}>{value}</p>
            </div>
          ))}
        </div>
        {selected.body && (
          <div style={{ padding: '12px 14px', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Description</p>
            <pre style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'inherit', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {selected.body.slice(0, 5000)}
            </pre>
          </div>
        )}
        {selected.url && (
          <a href={selected.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>
            Open on GitHub →
          </a>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['open', 'closed', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStateFilter(s)}
            style={{
              padding: '4px 12px', borderRadius: 'var(--r-sm)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: stateFilter === s ? 'var(--accent-soft)' : 'transparent',
              color: stateFilter === s ? 'var(--accent-text)' : 'var(--muted)',
              border: stateFilter === s ? '1px solid rgba(124,92,252,0.3)' : '1px solid transparent',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton lines={6} />
      ) : error ? (
        <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--r-sm)' }}>
          <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>
        </div>
      ) : prs.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', borderStyle: 'dashed' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No {stateFilter === 'all' ? '' : stateFilter + ' '}pull requests</p>
        </div>
      ) : (
        <div style={{ background: 'var(--panel-raised)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>PR</th>
                <th>Title</th>
                <th>Author</th>
                <th>Branch</th>
                <th>State</th>
                <th>Updated</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {prs.map((pr) => (
                <tr key={pr.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(pr)}>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>#{pr.number}</span></td>
                  <td style={{ maxWidth: 280 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>
                      {pr.title}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--muted)' }}>{pr.author}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent-text)' }}>
                      {pr.sourceBranch} → {pr.targetBranch}
                    </span>
                  </td>
                  <td>{statusBadge(pr.state)}</td>
                  <td style={{ fontSize: 11, color: 'var(--muted)' }}>{relativeTime(pr.updatedAt)}</td>
                  <td>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 'var(--r-full)',
                      background: pr.reviewStatus === 'approved' ? 'rgba(34,197,94,0.1)' :
                                  pr.reviewStatus === 'changes_requested' ? 'rgba(239,68,68,0.1)' :
                                  'rgba(100,116,139,0.1)',
                      color: pr.reviewStatus === 'approved' ? 'var(--success)' :
                             pr.reviewStatus === 'changes_requested' ? 'var(--danger)' : 'var(--muted)',
                    }}>
                      {pr.reviewStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Main detail page                                                   */
/* ──────────────────────────────────────────────────────────────────── */

export function RepositoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [gitStatus, setGitStatus] = useState<DetailedGitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.repos.get(id),
      api.repos.gitStatus(id),
    ]).then(([{ repository }, { gitStatus: gs }]) => {
      setRepo(repository);
      setGitStatus(gs);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleSync() {
    if (!id || !repo) return;
    setSyncing(true);
    try {
      const { repository } = await api.repos.sync(id);
      setRepo(repository);
      // Refresh git status too
      const { gitStatus: gs } = await api.repos.gitStatus(id);
      setGitStatus(gs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="page-content stack" style={{ gap: 24 }}>
        <div>
          <div style={{ height: 28, borderRadius: 6, background: 'var(--line)', opacity: 0.5, width: 200, marginBottom: 8 }} />
          <div style={{ height: 14, borderRadius: 4, background: 'var(--line)', opacity: 0.3, width: 300 }} />
        </div>
        <Skeleton lines={10} />
      </div>
    );
  }

  if (error || !repo) {
    return (
      <div className="page-content stack" style={{ gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => navigate('/repositories')}>← Repositories</button>
        </div>
        <div style={{ padding: '24px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--r-md)' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>Repository not found</p>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{error ?? 'The requested repository could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; disabled?: boolean; hint?: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'files', label: 'Files' },
    { id: 'branches', label: 'Branches' },
    { id: 'commits', label: 'Commits' },
    { id: 'issues', label: `Issues${repo.openIssues > 0 ? ` (${repo.openIssues})` : ''}`, disabled: repo.provider !== 'github', hint: repo.provider !== 'github' ? 'GitHub only' : undefined },
    { id: 'prs', label: `Pull Requests${repo.openPRs > 0 ? ` (${repo.openPRs})` : ''}`, disabled: repo.provider !== 'github', hint: repo.provider !== 'github' ? 'GitHub only' : undefined },
  ];

  return (
    <div className="page-content stack" style={{ gap: 20 }}>
      {/* Breadcrumb + header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, color: 'var(--muted)' }}>
          <Link to="/repositories" style={{ color: 'var(--muted)' }}>Repositories</Link>
          <span>›</span>
          <span style={{ color: 'var(--ink)' }}>{repo.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{repo.name}</h1>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-full)',
                background: repo.provider === 'github' ? 'rgba(124,92,252,0.15)' : 'rgba(56,189,248,0.12)',
                color: repo.provider === 'github' ? 'var(--accent-text)' : 'var(--info)',
                border: `1px solid ${repo.provider === 'github' ? 'rgba(124,92,252,0.3)' : 'rgba(56,189,248,0.2)'}`,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {repo.provider === 'github' ? '⬡ GitHub' : '⬡ Local'}
              </span>
            </div>
            {repo.fullName && (
              <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{repo.fullName}</p>
            )}
            {repo.description && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, maxWidth: 600 }}>{repo.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-sm" disabled={syncing} onClick={handleSync}>
              {syncing ? 'Syncing…' : '↺ Sync'}
            </button>
            {repo.fullName && (
              <a
                href={`https://github.com/${repo.fullName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm"
              >
                Open on GitHub →
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Sync error */}
      {repo.syncError && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 'var(--r-sm)' }}>
          <p style={{ fontSize: 12, color: 'var(--danger)' }}>Sync failed: {repo.syncError}</p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--line)', display: 'flex', gap: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            title={tab.hint}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: tab.disabled ? 'not-allowed' : 'pointer',
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab.disabled ? 'var(--subtle)' : activeTab === tab.id ? 'var(--accent-text)' : 'var(--muted)',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <OverviewTab repo={repo} gitStatus={gitStatus} />}
        {activeTab === 'files' && <FilesTab repoId={repo.id} />}
        {activeTab === 'branches' && <BranchesTab repoId={repo.id} defaultBranch={repo.defaultBranch} />}
        {activeTab === 'commits' && <CommitsTab repoId={repo.id} />}
        {activeTab === 'issues' && <IssuesTab repoId={repo.id} provider={repo.provider} repoFullName={repo.fullName} />}
        {activeTab === 'prs' && <PRsTab repoId={repo.id} provider={repo.provider} />}
      </div>
=======
/** Helper recursive file tree node renderer */
function renderTreeNodes(
  nodes: FileTreeNode[],
  selectedPath: string | null,
  onSelect: (p: string) => void,
  depth = 0
): React.ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: depth > 0 ? 12 : 0 }}>
      {nodes.map((node) => {
        if (node.type === 'directory') {
          return (
            <div key={node.path} style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--muted)',
                }}
              >
                <span>📁</span>
                <span>{node.name}</span>
              </div>
              {node.children && renderTreeNodes(node.children, selectedPath, onSelect, depth + 1)}
            </div>
          );
        }

        const isSelected = selectedPath === node.path;
        return (
          <button
            key={node.path}
            onClick={() => onSelect(node.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              fontSize: 12,
              background: isSelected ? 'var(--accent-soft)' : 'transparent',
              color: isSelected ? 'var(--ink)' : 'var(--muted)',
              border: 'none',
              borderRadius: 4,
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: isSelected ? 600 : 400,
            }}
          >
            <span>📄</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.name}
            </span>
          </button>
        );
      })}
>>>>>>> origin/main
    </div>
  );
}
