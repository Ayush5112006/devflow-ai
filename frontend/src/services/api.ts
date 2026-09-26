import type {
  Investigation, DemoBug, ProjectTarget, PipelineFacts,
  Repository, RepositoryBranch, RepositoryCommit, RepositoryCommitDetail,
  GitFileEntry, RepositoryIssue, RepositoryPR, DetailedGitStatus, GitHubStatus, WebhookConfig,
} from '../types/index.js';

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
<<<<<<< HEAD
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
=======
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
  });
>>>>>>> origin/main
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

<<<<<<< HEAD
=======
export interface RepositoryItem {
  id: string;
  name: string;
  fullName: string;
  description: string;
  provider: 'local' | 'github' | 'demo';
  sourcePath: string;
  remoteUrl: string | null;
  defaultBranch: string;
  currentBranch: string;
  lastCommitHash: string | null;
  lastCommitMessage: string | null;
  lastCommitAuthor: string | null;
  lastCommitDate: string | null;
  status: 'active' | 'syncing' | 'error';
  lastSyncAt: string | null;
  syncDurationMs?: number;
  openIssuesCount: number;
  openPullRequestsCount: number;
  isClean?: boolean;
  isDemo?: boolean;
  githubOwner?: string;
  githubRepo?: string;
}

export interface GitWorkingStatus {
  available: boolean;
  branch: string | null;
  latestCommit: string | null;
  latestMessage: string | null;
  latestAuthor: string | null;
  latestDate: string | null;
  remoteUrl: string | null;
  isClean: boolean;
  status: {
    modified: string[];
    added: string[];
    deleted: string[];
    untracked: string[];
    staged: string[];
  };
  modifiedFiles: string[];
  recentCommits: {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
  }[];
  suggestedBranch: string | null;
}

export type GitInfo = GitWorkingStatus;

export interface GitBranchItem {
  name: string;
  isCurrent: boolean;
  latestCommitHash: string;
  latestCommitMessage: string;
  author: string;
  date: string;
  ahead: number;
  behind: number;
  isProtected: boolean;
}

export interface GitCommitItem {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail?: string;
  date: string;
}

export interface GitCommitDetailItem extends GitCommitItem {
  fullDiff: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: {
    file: string;
    status: 'modified' | 'added' | 'deleted' | 'renamed';
    insertions: number;
    deletions: number;
  }[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  sizeBytes?: number;
  children?: FileTreeNode[];
}

export interface RepositoryIssueItem {
  id: string;
  number: number;
  title: string;
  description: string;
  state: 'open' | 'closed';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  author: string;
  labels: string[];
  assignees: string[];
  createdAt: string;
  updatedAt: string;
  source: 'local' | 'github' | 'demo';
  githubHtmlUrl?: string;
}

export interface RepositoryPullRequestItem {
  id: string;
  number: number;
  title: string;
  description: string;
  state: 'open' | 'closed' | 'merged';
  author: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  updatedAt: string;
  source: 'local' | 'github' | 'demo';
  githubHtmlUrl?: string;
  checksStatus?: 'success' | 'failure' | 'pending' | 'none';
  reviewStatus?: 'approved' | 'changes_requested' | 'review_required' | 'none';
}

export interface GitHubAuthStatus {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  scopes: string[];
  rateLimit: {
    limit: number;
    remaining: number;
    reset: number;
  } | null;
  error?: string;
  setupInstructions?: string[];
}

export interface GitHubRemoteRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssuesCount: number;
  htmlUrl: string;
  cloneUrl: string;
  updatedAt: string;
  pushedAt: string;
}

export interface WebhookSettingsInfo {
  enabled: boolean;
  hasSecret: boolean;
  webhookUrl: string;
  lastEventAt: string | null;
  totalEventsReceived: number;
  lastSuccessfulDelivery: string | null;
  lastFailedDelivery: string | null;
  supportedEvents: string[];
}

export interface WebhookEventItem {
  id: string;
  eventType: string;
  action?: string;
  repository?: string;
  sender?: string;
  receivedAt: string;
  status: 'processed' | 'ignored' | 'failed';
  summary: string;
  payloadExcerpt: Record<string, unknown>;
}

export interface CodeIntelResult {
  question: string;
  repositoryId: string;
  summary: string;
  evidence: {
    file: string;
    line?: number;
    symbol?: string;
    snippet?: string;
    score: number;
    reason: string;
  }[];
}

>>>>>>> origin/main
export const api = {
  /* Projects */
  projects: () => get<{ projects: ProjectTarget[] }>('/projects'),

  /* Pipeline — live agent registry, real stage list, measured durations */
  pipeline: () => get<PipelineFacts>('/pipeline'),

  /* Demo */
  demoBugs: () => get<{ bugs: DemoBug[] }>('/demo/bugs'),
  demoQuickstart: (bugId: string) =>
    post<{ investigation: Investigation }>(`/investigations/demo/${bugId}/quickstart`),

  /* Investigations */
  listInvestigations: () => get<{ investigations: Partial<Investigation>[] }>('/investigations'),
  getInvestigation: (id: string) => get<{ investigation: Investigation }>(`/investigations/${id}`),

  createInvestigation: (body: {
    projectId: string;
    bug: Investigation['bug'];
    evidence?: { name: string; kind: string; content: string }[];
  }) => post<{ investigation: Investigation }>('/investigations', body),

  start: (id: string) => post<{ started: boolean }>(`/investigations/${id}/start`),
  approve: (id: string, approvedBy: string, note: string) =>
    post<{ approval: Investigation['approval'] }>(`/investigations/${id}/approve`, { approvedBy, note }),
  implement: (id: string) => post<{ started: boolean }>(`/investigations/${id}/implement`),
  replan: (id: string, feedback: string) =>
    post<{ ok: boolean }>(`/investigations/${id}/replan`, { feedback }),

  /* Getters */
  findings: (id: string) => get<{ findings: Investigation['findings'] }>(`/investigations/${id}/findings`),
  rootCause: (id: string) => get<{ rootCause: Investigation['rootCause'] }>(`/investigations/${id}/root-cause`),
  changePlan: (id: string) => get<{ changePlan: Investigation['changePlan'] }>(`/investigations/${id}/change-plan`),
  report: (id: string) => get<{ report: Investigation['report']; metrics: Investigation['metrics'] }>(`/investigations/${id}/report`),
  git: (id: string) => get<{ git: GitWorkingStatus }>(`/investigations/${id}/git`),

  /* System health */
  health: () => get<{ status: string; version: string; uptime: number }>('/health').catch(() => null),

  /* SSE */
  stream: (id: string) => new EventSource(`/api/investigations/${id}/stream`),
<<<<<<< HEAD

  /* ── Repositories ───────────────────────────────────────────────── */
  repos: {
    list: () => get<{ repositories: Repository[] }>('/repositories'),
    get: (id: string) => get<{ repository: Repository }>(`/repositories/${id}`),
    register: (body: { provider: 'local'; path: string; name?: string } | { provider: 'github'; fullName: string; name?: string }) =>
      post<{ repository: Repository; alreadyExists?: boolean }>('/repositories', body),
    remove: (id: string) => del<{ deleted: boolean }>(`/repositories/${id}`),
    sync: (id: string) => post<{ repository: Repository; durationMs: number; synced: boolean }>(`/repositories/${id}/sync`),
    gitStatus: (id: string) => get<{ gitStatus: DetailedGitStatus | null; message?: string }>(`/repositories/${id}/git`),
    branches: (id: string) => get<{ branches: RepositoryBranch[]; provider: string }>(`/repositories/${id}/branches`),
    commits: (id: string, opts?: { page?: number; per_page?: number; branch?: string }) => {
      const params = new URLSearchParams();
      if (opts?.page) params.set('page', String(opts.page));
      if (opts?.per_page) params.set('per_page', String(opts.per_page));
      if (opts?.branch) params.set('branch', opts.branch);
      const qs = params.toString();
      return get<{ commits: RepositoryCommit[]; provider: string; page: number; perPage: number }>(`/repositories/${id}/commits${qs ? '?' + qs : ''}`);
    },
    commitDetail: (id: string, sha: string) => get<{ commit: RepositoryCommitDetail; provider: string }>(`/repositories/${id}/commits/${sha}`),
    files: (id: string, opts?: { path?: string; ref?: string }) => {
      const params = new URLSearchParams();
      if (opts?.path) params.set('path', opts.path);
      if (opts?.ref) params.set('ref', opts.ref);
      const qs = params.toString();
      return get<{ entries: GitFileEntry[]; provider: string; path: string }>(`/repositories/${id}/files${qs ? '?' + qs : ''}`);
    },
    fileContent: (id: string, filePath: string, ref?: string) => {
      const params = new URLSearchParams({ path: filePath });
      if (ref) params.set('ref', ref);
      return get<{ content: string | null; size: number; error: string | null; path: string }>(`/repositories/${id}/file-content?${params}`);
    },
    issues: (id: string, opts?: { state?: 'open' | 'closed' | 'all'; page?: number; per_page?: number }) => {
      const params = new URLSearchParams();
      if (opts?.state) params.set('state', opts.state);
      if (opts?.page) params.set('page', String(opts.page));
      if (opts?.per_page) params.set('per_page', String(opts.per_page));
      const qs = params.toString();
      return get<{ issues: RepositoryIssue[]; provider: string; message?: string }>(`/repositories/${id}/issues${qs ? '?' + qs : ''}`);
    },
    prs: (id: string, opts?: { state?: 'open' | 'closed' | 'all'; page?: number; per_page?: number }) => {
      const params = new URLSearchParams();
      if (opts?.state) params.set('state', opts.state);
      if (opts?.page) params.set('page', String(opts.page));
      if (opts?.per_page) params.set('per_page', String(opts.per_page));
      const qs = params.toString();
      return get<{ prs: RepositoryPR[]; provider: string; message?: string }>(`/repositories/${id}/pull-requests${qs ? '?' + qs : ''}`);
    },
    health: (id: string) => get<{ health: { repositoryId: string; openIssues: number; openPRs: number; uncommittedChanges: number; lastCommitAt: string | null; lastSyncAt: string | null; syncStatus: string; calculatedAt: string } }>(`/repositories/${id}/health`),
  },

  /* ── GitHub Integration ─────────────────────────────────────────── */
  github: {
    status: () => get<{ github: GitHubStatus }>('/integrations/github/status'),
    repos: (opts?: { type?: 'all' | 'public' | 'private'; per_page?: number }) => {
      const params = new URLSearchParams();
      if (opts?.type) params.set('type', opts.type);
      if (opts?.per_page) params.set('per_page', String(opts.per_page));
      const qs = params.toString();
      return get<{ repos: Partial<Repository>[]; error: string | null }>(`/integrations/github/repos${qs ? '?' + qs : ''}`);
    },
    import: (fullName: string) => post<{ repository: Repository; alreadyExists?: boolean }>('/integrations/github/import', { fullName }),
    webhookConfig: () => get<WebhookConfig>('/integrations/github/webhook/config'),
    webhookEvents: () => get<{ events: unknown[] }>('/integrations/github/webhook/events'),
  },
};
=======
>>>>>>> origin/main

  /* ---------------- Repositories API ---------------- */
  repositories: () => get<{ repositories: RepositoryItem[] }>('/repositories'),
  detectLocalRepo: () => get<{ detected: boolean; repository: RepositoryItem | null }>('/repositories/local/detect'),
  addLocalRepo: (path: string, name?: string) => post<{ repository: RepositoryItem }>('/repositories/local', { path, name }),
  getRepository: (id: string) => get<{ repository: RepositoryItem }>(`/repositories/${id}`),
  syncRepository: (id: string) => post<{ synced: boolean; durationMs: number; summary: string }>(`/repositories/${id}/sync`),
  removeRepository: (id: string) => del<{ removed: boolean }>(`/repositories/${id}`),

  /* Repository Git inspection */
  getRepoBranches: (id: string) => get<{ branches: GitBranchItem[] }>(`/repositories/${id}/branches`),
  getRepoCommits: (id: string, limit = 30) => get<{ commits: GitCommitItem[] }>(`/repositories/${id}/commits?limit=${limit}`),
  getRepoCommitDetail: (id: string, hash: string) => get<{ commit: GitCommitDetailItem }>(`/repositories/${id}/commits/${hash}`),
  getRepoWorkingStatus: (id: string) => get<{ status: GitWorkingStatus }>(`/repositories/${id}/status`),
  getRepoWorkingDiff: (id: string) => get<{ diff: string }>(`/repositories/${id}/diff`),
  getRepoFiles: (id: string) => get<{ tree: FileTreeNode[] }>(`/repositories/${id}/files`),
  getRepoFileContent: (id: string, path: string) => get<{ content: string; language: string; size: number }>(`/repositories/${id}/file?path=${encodeURIComponent(path)}`),

  /* Repository Issues */
  getRepoIssues: (id: string) => get<{ issues: RepositoryIssueItem[] }>(`/repositories/${id}/issues`),
  createRepoIssue: (id: string, body: { title: string; description: string; severity?: string; labels?: string[] }) =>
    post<{ issue: RepositoryIssueItem }>(`/repositories/${id}/issues`, body),
  investigateRepoIssue: (id: string, issueId: string) =>
    post<{ investigationId: string; message: string; investigation: Investigation }>(`/repositories/${id}/issues/${issueId}/investigate`),

  /* Repository Pull Requests */
  getRepoPullRequests: (id: string) => get<{ pullRequests: RepositoryPullRequestItem[] }>(`/repositories/${id}/pulls`),
  createRepoPullRequest: (id: string, body: { title: string; description: string; sourceBranch: string; targetBranch?: string }) =>
    post<{ pullRequest: RepositoryPullRequestItem }>(`/repositories/${id}/pulls`, body),
  generatePrFromInvestigation: (id: string, investigationId: string) =>
    post<{
      title: string;
      description: string;
      sourceBranch: string;
      targetBranch: string;
      filesChanged: string[];
      diffPreview: string;
      verificationStatus: string;
      regressionStatus: string;
    }>(`/repositories/${id}/generate-pr-from-investigation`, { investigationId }),

  /* Code Intelligence */
  queryCodeIntelligence: (id: string, question: string) =>
    post<CodeIntelResult>(`/repositories/${id}/query-code`, { question }),

  /* GitHub Integration */
  getGitHubStatus: () => get<GitHubAuthStatus>('/integrations/github/status'),
  getGitHubRepos: (page = 1, perPage = 30) =>
    get<{ repositories: GitHubRemoteRepo[] }>(`/integrations/github/repos?page=${page}&perPage=${perPage}`),
  importGitHubRepo: (owner: string, repo: string) =>
    post<{ repository: RepositoryItem }>('/integrations/github/import', { owner, repo }),

  /* Webhooks */
  getWebhookSettings: () => get<WebhookSettingsInfo>('/integrations/github/webhooks/settings'),
  getWebhookEvents: () => get<{ events: WebhookEventItem[] }>('/integrations/github/webhooks/events'),
};
