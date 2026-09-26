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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
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
                </tr>
              </thead>
              <tbody>
                {commits.map((c) => (
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        </div>
      )}
    </div>
  );
}

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
    </div>
  );
}
