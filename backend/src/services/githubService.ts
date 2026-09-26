/**
 * GitHub REST API v3 client.
 *
 * Uses native fetch (Node 18+). The GitHub token is ONLY read from the
 * GITHUB_TOKEN environment variable — it is never stored, returned to the
 * frontend, or logged.
 *
 * All operations are read-only EXCEPT:
 *  - None yet (PR creation is Coming Soon)
 *
 * Rate limiting: GitHub allows 5000 req/hour for authenticated requests.
 * This module does not implement pagination exhaustion to stay within limits.
 */

import type {
  Repository,
  RepositoryBranch,
  RepositoryCommit,
  RepositoryCommitDetail,
  GitFileEntry,
  RepositoryIssue,
  RepositoryPR,
} from '../types/index.js';
import { detectLanguage } from '../utils/git.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('github-service');

const GITHUB_API = 'https://api.github.com';

/** Returns the configured GitHub token or null if not set. */
export function getGitHubToken(): string | null {
  return process.env.GITHUB_TOKEN?.trim() || null;
}

/** Returns whether GitHub integration is configured. */
export function isGitHubConfigured(): boolean {
  return getGitHubToken() !== null;
}

/** Connection status object returned to the frontend (never includes the token). */
export interface GitHubStatus {
  configured: boolean;
  login: string | null;
  name: string | null;
  avatarUrl: string | null;
  rateLimitRemaining: number | null;
  rateLimitReset: string | null;
  error: string | null;
}

interface FetchOptions {
  method?: string;
  body?: unknown;
}

async function ghFetch<T>(
  path: string,
  opts: FetchOptions = {},
): Promise<{ data: T | null; status: number; error: string | null }> {
  const token = getGitHubToken();
  if (!token) {
    return { data: null, status: 401, error: 'GitHub token not configured. Set the GITHUB_TOKEN environment variable.' };
  }

  const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'FixFlow-AI/1.0',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`GitHub fetch error: ${msg}`);
    return { data: null, status: 0, error: `Network error: ${msg}` };
  }

  if (response.status === 401) {
    return { data: null, status: 401, error: 'GitHub token is invalid or expired.' };
  }
  if (response.status === 403) {
    const body = await response.text().catch(() => '');
    if (body.includes('rate limit')) {
      const reset = response.headers.get('x-ratelimit-reset');
      const resetTime = reset ? new Date(parseInt(reset, 10) * 1000).toISOString() : 'unknown';
      return { data: null, status: 403, error: `GitHub rate limit reached. Resets at ${resetTime}.` };
    }
    return { data: null, status: 403, error: 'GitHub permission denied.' };
  }
  if (response.status === 404) {
    return { data: null, status: 404, error: 'GitHub resource not found.' };
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return { data: null, status: response.status, error: `GitHub API error ${response.status}: ${body.slice(0, 200)}` };
  }

  try {
    const data = await response.json() as T;
    return { data, status: response.status, error: null };
  } catch {
    return { data: null, status: response.status, error: 'Failed to parse GitHub response.' };
  }
}

/** Verify the GitHub token and return the authenticated user. */
export async function verifyGitHubToken(): Promise<GitHubStatus> {
  if (!isGitHubConfigured()) {
    return {
      configured: false,
      login: null,
      name: null,
      avatarUrl: null,
      rateLimitRemaining: null,
      rateLimitReset: null,
      error: 'GitHub token not configured. Set the GITHUB_TOKEN environment variable.',
    };
  }

  const { data, error } = await ghFetch<{ login: string; name: string; avatar_url: string }>('/user');
  if (error || !data) {
    return { configured: true, login: null, name: null, avatarUrl: null, rateLimitRemaining: null, rateLimitReset: null, error: error ?? 'Unknown error' };
  }

  const { data: rateData } = await ghFetch<{ rate: { remaining: number; reset: number } }>('/rate_limit');
  return {
    configured: true,
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
    rateLimitRemaining: rateData?.rate?.remaining ?? null,
    rateLimitReset: rateData?.rate?.reset ? new Date(rateData.rate.reset * 1000).toISOString() : null,
    error: null,
  };
}

interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  owner: { login: string };
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  updated_at: string;
  pushed_at: string;
  clone_url: string;
  html_url: string;
}

/** List repositories accessible to the authenticated user. */
export async function listGitHubRepos(
  opts: { type?: 'all' | 'public' | 'private'; perPage?: number } = {},
): Promise<{ repos: Partial<Repository>[]; error: string | null }> {
  const perPage = opts.perPage ?? 30;
  const type = opts.type ?? 'all';

  const { data, error } = await ghFetch<GHRepo[]>(`/user/repos?type=${type}&per_page=${perPage}&sort=updated`);
  if (error || !data) {
    return { repos: [], error: error ?? 'Failed to list repositories' };
  }

  const repos: Partial<Repository>[] = data.map((r) => ({
    name: r.name,
    description: r.description ?? '',
    provider: 'github',
    path: r.full_name,
    owner: r.owner.login,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    visibility: r.private ? 'private' : 'public',
    language: r.language,
    stars: r.stargazers_count,
    openIssues: r.open_issues_count,
    openPRs: 0,
    lastCommitAt: r.pushed_at,
  }));

  return { repos, error: null };
}

/** Get a specific GitHub repository. */
export async function getGitHubRepo(fullName: string): Promise<{ repo: Partial<Repository> | null; error: string | null }> {
  const { data, error } = await ghFetch<GHRepo>(`/repos/${fullName}`);
  if (error || !data) return { repo: null, error };

  return {
    repo: {
      name: data.name,
      description: data.description ?? '',
      provider: 'github',
      path: data.full_name,
      owner: data.owner.login,
      fullName: data.full_name,
      defaultBranch: data.default_branch,
      visibility: data.private ? 'private' : 'public',
      language: data.language,
      stars: data.stargazers_count,
      openIssues: data.open_issues_count,
      openPRs: 0,
      lastCommitAt: data.pushed_at,
    },
    error: null,
  };
}

/** List branches for a GitHub repository. */
export async function getGitHubBranches(fullName: string, defaultBranch: string): Promise<{ branches: RepositoryBranch[]; error: string | null }> {
  const { data, error } = await ghFetch<{ name: string; commit: { sha: string; commit: { message: string; committer: { date: string; name: string } } }; protected: boolean }[]>(
    `/repos/${fullName}/branches?per_page=50`,
  );
  if (error || !data) return { branches: [], error };

  const branches: RepositoryBranch[] = data.map((b) => ({
    name: b.name,
    sha: b.commit.sha.slice(0, 12),
    isDefault: b.name === defaultBranch,
    isProtected: b.protected,
    lastCommitMessage: b.commit.commit.message?.split('\n')[0] ?? null,
    lastCommitAt: b.commit.commit.committer?.date ?? null,
    lastCommitAuthor: b.commit.commit.committer?.name ?? null,
    ahead: 0,
    behind: 0,
  }));

  return { branches, error: null };
}

/** List commits for a GitHub repository. */
export async function getGitHubCommits(
  fullName: string,
  opts: { perPage?: number; page?: number; sha?: string } = {},
): Promise<{ commits: RepositoryCommit[]; error: string | null }> {
  const perPage = opts.perPage ?? 20;
  const page = opts.page ?? 1;
  const sha = opts.sha ? `&sha=${encodeURIComponent(opts.sha)}` : '';

  const { data, error } = await ghFetch<{
    sha: string;
    commit: { message: string; author: { name: string; email: string; date: string } };
    parents: { sha: string }[];
  }[]>(`/repos/${fullName}/commits?per_page=${perPage}&page=${page}${sha}`);

  if (error || !data) return { commits: [], error };

  const commits: RepositoryCommit[] = data.map((c) => ({
    sha: c.sha,
    shortSha: c.sha.slice(0, 8),
    message: c.commit.message.split('\n')[0] ?? '',
    author: c.commit.author.name,
    authorEmail: c.commit.author.email,
    date: c.commit.author.date,
    filesChanged: 0,
    additions: 0,
    deletions: 0,
    parents: c.parents.map((p) => p.sha.slice(0, 8)),
  }));

  return { commits, error: null };
}

/** Get a specific commit detail. */
export async function getGitHubCommitDetail(fullName: string, sha: string): Promise<{ commit: RepositoryCommitDetail | null; error: string | null }> {
  const { data, error } = await ghFetch<{
    sha: string;
    commit: { message: string; author: { name: string; email: string; date: string } };
    parents: { sha: string }[];
    stats: { additions: number; deletions: number; total: number };
    files: { filename: string; status: string; additions: number; deletions: number; patch?: string }[];
  }>(`/repos/${fullName}/commits/${sha}`);

  if (error || !data) return { commit: null, error };

  return {
    commit: {
      sha: data.sha,
      shortSha: data.sha.slice(0, 8),
      message: data.commit.message.split('\n')[0] ?? '',
      author: data.commit.author.name,
      authorEmail: data.commit.author.email,
      date: data.commit.author.date,
      filesChanged: data.files?.length ?? 0,
      additions: data.stats?.additions ?? 0,
      deletions: data.stats?.deletions ?? 0,
      parents: data.parents.map((p) => p.sha.slice(0, 8)),
      diff: data.files?.map((f) => f.patch ?? '').join('\n') ?? '',
      files: (data.files ?? []).map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch ?? '',
      })),
    },
    error: null,
  };
}

/** Get file tree for a GitHub repository. */
export async function getGitHubFileTree(
  fullName: string,
  treeSha: string = 'HEAD',
  path: string = '',
): Promise<{ entries: GitFileEntry[]; error: string | null }> {
  const { data, error } = await ghFetch<{
    tree: { path: string; type: 'blob' | 'tree'; size?: number; sha: string }[];
    truncated: boolean;
  }>(`/repos/${fullName}/git/trees/${treeSha}?recursive=0`);

  if (error || !data) return { entries: [], error };

  const prefix = path ? path.replace(/\/$/, '') + '/' : '';
  const entries: GitFileEntry[] = data.tree
    .filter((item) => {
      if (!prefix) return true;
      return item.path.startsWith(prefix) && !item.path.slice(prefix.length).includes('/');
    })
    .map((item) => ({
      path: item.path,
      name: item.path.split('/').pop() ?? item.path,
      type: item.type === 'tree' ? 'dir' : 'file',
      size: item.size ?? 0,
      language: item.type === 'blob' ? detectLanguage(item.path) : null,
    }));

  return { entries, error: null };
}

/** Get GitHub issues. */
export async function getGitHubIssues(
  fullName: string,
  opts: { state?: 'open' | 'closed' | 'all'; perPage?: number; page?: number } = {},
): Promise<{ issues: RepositoryIssue[]; error: string | null }> {
  const state = opts.state ?? 'open';
  const perPage = opts.perPage ?? 30;
  const page = opts.page ?? 1;

  // GitHub's /issues endpoint returns both issues AND PRs. Filter PRs out.
  const { data, error } = await ghFetch<{
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: string;
    user: { login: string };
    assignee: { login: string } | null;
    labels: { name: string }[];
    created_at: string;
    updated_at: string;
    html_url: string;
    pull_request?: unknown;
  }[]>(`/repos/${fullName}/issues?state=${state}&per_page=${perPage}&page=${page}`);

  if (error || !data) return { issues: [], error };

  const issues: RepositoryIssue[] = data
    .filter((i) => !i.pull_request) // exclude PRs
    .map((i) => ({
      id: String(i.id),
      number: i.number,
      title: i.title,
      body: i.body ?? '',
      state: i.state === 'open' ? 'open' : 'closed',
      author: i.user.login,
      assignee: i.assignee?.login ?? null,
      labels: i.labels.map((l) => l.name),
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      url: i.html_url,
    }));

  return { issues, error: null };
}

/** Get GitHub pull requests. */
export async function getGitHubPRs(
  fullName: string,
  opts: { state?: 'open' | 'closed' | 'all'; perPage?: number; page?: number } = {},
): Promise<{ prs: RepositoryPR[]; error: string | null }> {
  const state = opts.state ?? 'open';
  const perPage = opts.perPage ?? 20;
  const page = opts.page ?? 1;

  const { data, error } = await ghFetch<{
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: string;
    draft: boolean;
    user: { login: string };
    head: { ref: string };
    base: { ref: string };
    created_at: string;
    updated_at: string;
    merged_at: string | null;
    html_url: string;
    additions: number;
    deletions: number;
    review_comments: number;
  }[]>(`/repos/${fullName}/pulls?state=${state}&per_page=${perPage}&page=${page}`);

  if (error || !data) return { prs: [], error };

  const prs: RepositoryPR[] = data.map((pr) => ({
    id: String(pr.id),
    number: pr.number,
    title: pr.title,
    body: pr.body ?? '',
    state: pr.draft ? 'draft' : pr.merged_at ? 'merged' : pr.state === 'open' ? 'open' : 'closed',
    author: pr.user.login,
    sourceBranch: pr.head.ref,
    targetBranch: pr.base.ref,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at,
    url: pr.html_url,
    checks: [],
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    reviewStatus: 'pending',
  }));

  return { prs, error: null };
}

/** Get file content from a GitHub repository (raw text only, capped at 500KB). */
export async function getGitHubFileContent(
  fullName: string,
  filePath: string,
  ref: string = 'HEAD',
): Promise<{ content: string | null; size: number; error: string | null }> {
  const { data, error } = await ghFetch<{ content: string; size: number; encoding: string }>(
    `/repos/${fullName}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`,
  );

  if (error || !data) return { content: null, size: 0, error };
  if (data.size > 500_000) return { content: null, size: data.size, error: 'File too large to display (> 500KB).' };

  const content = data.encoding === 'base64'
    ? Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8')
    : data.content;

  return { content, size: data.size, error: null };
}
