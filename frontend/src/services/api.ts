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
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

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
  git: (id: string) => get<{ git: GitInfo }>(`/investigations/${id}/git`),

  /* System health */
  health: () => get<{ status: string; version: string; uptime: number }>('/health').catch(() => null),

  /* SSE */
  stream: (id: string) => new EventSource(`/api/investigations/${id}/stream`),

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

export interface GitInfo {
  available: boolean;
  branch: string | null;
  latestCommit: string | null;
  latestMessage: string | null;
  latestAuthor: string | null;
  latestDate: string | null;
  modifiedFiles: string[];
  recentCommits: { hash: string; message: string; author: string; date: string }[];
  suggestedBranch: string | null;
}
