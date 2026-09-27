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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                </tr>
              </thead>
              <tbody>
                {commits.map((c) => (
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
        </div>
      )}
    </div>
  );
}

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
    </div>
  );
}
