/**
 * GitHub Integration Service
 * 
 * Provides verified API operations for GitHub when configured with GITHUB_TOKEN.
 * Never returns fake data. If GITHUB_TOKEN is missing or unauthorized,
 * reports accurate status and configuration guidelines.
 */
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('github-service');

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

export interface GitHubRepositoryItem {
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

export interface GitHubIssueItem {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  author: string;
  authorAvatar?: string;
  labels: { name: string; color: string }[];
  assignees: string[];
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  commentsCount: number;
}

export interface GitHubPullRequestItem {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed' | 'merged';
  author: string;
  authorAvatar?: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  draft: boolean;
  merged: boolean;
  checksStatus?: 'success' | 'failure' | 'pending' | 'none';
}

export class GitHubService {
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'FixFlow-AI-Platform',
    };
    if (config.githubToken) {
      headers.Authorization = `Bearer ${config.githubToken}`;
    }
    return headers;
  }

  /**
   * Verify credentials and retrieve current authenticated user details.
   */
  async verifyAuth(): Promise<GitHubAuthStatus> {
    if (!config.githubToken || config.githubToken.trim().length === 0) {
      return {
        configured: false,
        authenticated: false,
        username: null,
        name: null,
        avatarUrl: null,
        scopes: [],
        rateLimit: null,
        error: 'GITHUB_TOKEN is not configured in the backend environment.',
        setupInstructions: [
          'Create a GitHub Personal Access Token (classic or fine-grained) with `repo` or `read:user` scope at https://github.com/settings/tokens',
          'Add GITHUB_TOKEN=your_token_here in your backend .env file or environment variables',
          'Optionally add GITHUB_WEBHOOK_SECRET=your_secret for real-time webhook sync',
          'Restart the FixFlow AI backend to activate the live integration',
        ],
      };
    }

    try {
      const res = await fetch(`${config.githubApiUrl}/user`, {
        headers: this.getHeaders(),
      });

      const rateLimit = {
        limit: parseInt(res.headers.get('x-ratelimit-limit') || '0', 10),
        remaining: parseInt(res.headers.get('x-ratelimit-remaining') || '0', 10),
        reset: parseInt(res.headers.get('x-ratelimit-reset') || '0', 10),
      };

      const scopesHeader = res.headers.get('x-oauth-scopes');
      const scopes = scopesHeader ? scopesHeader.split(',').map((s) => s.trim()) : [];

      if (!res.ok) {
        if (res.status === 401) {
          return {
            configured: true,
            authenticated: false,
            username: null,
            name: null,
            avatarUrl: null,
            scopes: [],
            rateLimit,
            error: 'GitHub Token is invalid or expired. Check your GITHUB_TOKEN in .env',
          };
        }
        if (res.status === 403 && rateLimit.remaining === 0) {
          const resetTime = new Date(rateLimit.reset * 1000).toLocaleTimeString();
          return {
            configured: true,
            authenticated: false,
            username: null,
            name: null,
            avatarUrl: null,
            scopes: [],
            rateLimit,
            error: `GitHub API rate limit exceeded. Resets at ${resetTime}.`,
          };
        }
        return {
          configured: true,
          authenticated: false,
          username: null,
          name: null,
          avatarUrl: null,
          scopes: [],
          rateLimit,
          error: `GitHub API error: HTTP ${res.status}`,
        };
      }

      const user = await res.json() as any;
      return {
        configured: true,
        authenticated: true,
        username: user.login,
        name: user.name || user.login,
        avatarUrl: user.avatar_url,
        scopes,
        rateLimit,
      };
    } catch (err) {
      log.error('Failed to verify GitHub auth', err);
      return {
        configured: true,
        authenticated: false,
        username: null,
        name: null,
        avatarUrl: null,
        scopes: [],
        rateLimit: null,
        error: `Network error connecting to GitHub API (${err instanceof Error ? err.message : String(err)})`,
      };
    }
  }

  /**
   * List accessible repositories for the authenticated user.
   */
  async listRepositories(page = 1, perPage = 30): Promise<GitHubRepositoryItem[]> {
    if (!config.githubToken) throw new Error('GitHub token not configured');

    const res = await fetch(
      `${config.githubApiUrl}/user/repos?sort=updated&per_page=${perPage}&page=${page}`,
      { headers: this.getHeaders() }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub API error (${res.status}): ${err.slice(0, 200)}`);
    }

    const repos = await res.json() as any[];
    return repos.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner.login,
      description: r.description,
      isPrivate: r.private,
      defaultBranch: r.default_branch || 'main',
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssuesCount: r.open_issues_count,
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
      updatedAt: r.updated_at,
      pushedAt: r.pushed_at,
    }));
  }

  /**
   * Get single repository details.
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepositoryItem> {
    const res = await fetch(`${config.githubApiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Repository not found on GitHub (${owner}/${repo}): HTTP ${res.status}`);
    }

    const r = await res.json() as any;
    return {
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner.login,
      description: r.description,
      isPrivate: r.private,
      defaultBranch: r.default_branch || 'main',
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssuesCount: r.open_issues_count,
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
      updatedAt: r.updated_at,
      pushedAt: r.pushed_at,
    };
  }

  /**
   * Fetch issues for a repository.
   */
  async listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssueItem[]> {
    const res = await fetch(
      `${config.githubApiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${state}&per_page=50`,
      { headers: this.getHeaders() }
    );

    if (!res.ok) {
      throw new Error(`Failed to load issues for ${owner}/${repo}: HTTP ${res.status}`);
    }

    const issues = await res.json() as any[];
    // Filter out pull requests as GitHub issues endpoint returns both
    return issues
      .filter((i) => !i.pull_request)
      .map((i) => ({
        id: i.id,
        number: i.number,
        title: i.title,
        body: i.body,
        state: i.state,
        author: i.user?.login || 'unknown',
        authorAvatar: i.user?.avatar_url,
        labels: (i.labels || []).map((l: any) => ({ name: l.name, color: l.color })),
        assignees: (i.assignees || []).map((a: any) => a.login),
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        htmlUrl: i.html_url,
        commentsCount: i.comments || 0,
      }));
  }

  /**
   * Fetch pull requests for a repository.
   */
  async listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPullRequestItem[]> {
    const res = await fetch(
      `${config.githubApiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=${state}&per_page=50`,
      { headers: this.getHeaders() }
    );

    if (!res.ok) {
      throw new Error(`Failed to load pull requests for ${owner}/${repo}: HTTP ${res.status}`);
    }

    const pulls = await res.json() as any[];
    return pulls.map((p) => ({
      id: p.id,
      number: p.number,
      title: p.title,
      body: p.body,
      state: p.merged_at ? 'merged' : p.state,
      author: p.user?.login || 'unknown',
      authorAvatar: p.user?.avatar_url,
      sourceBranch: p.head?.ref || '',
      targetBranch: p.base?.ref || '',
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      htmlUrl: p.html_url,
      draft: !!p.draft,
      merged: !!p.merged_at,
      checksStatus: 'none',
    }));
  }

  /**
   * Create an issue on GitHub.
   */
  async createIssue(
    owner: string,
    repo: string,
    data: { title: string; body: string; labels?: string[]; assignees?: string[] }
  ): Promise<GitHubIssueItem> {
    if (!config.githubToken) throw new Error('GitHub token not configured for write operations');

    const res = await fetch(
      `${config.githubApiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create issue on GitHub: ${err.slice(0, 200)}`);
    }

    const i = await res.json() as any;
    return {
      id: i.id,
      number: i.number,
      title: i.title,
      body: i.body,
      state: i.state,
      author: i.user?.login || 'unknown',
      authorAvatar: i.user?.avatar_url,
      labels: (i.labels || []).map((l: any) => ({ name: l.name, color: l.color })),
      assignees: (i.assignees || []).map((a: any) => a.login),
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      htmlUrl: i.html_url,
      commentsCount: 0,
    };
  }

  /**
   * Create a pull request on GitHub.
   */
  async createPullRequest(
    owner: string,
    repo: string,
    data: { title: string; head: string; base: string; body: string; draft?: boolean }
  ): Promise<GitHubPullRequestItem> {
    if (!config.githubToken) throw new Error('GitHub token not configured for write operations');

    const res = await fetch(
      `${config.githubApiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create pull request on GitHub: ${err.slice(0, 200)}`);
    }

    const p = await res.json() as any;
    return {
      id: p.id,
      number: p.number,
      title: p.title,
      body: p.body,
      state: 'open',
      author: p.user?.login || 'unknown',
      authorAvatar: p.user?.avatar_url,
      sourceBranch: p.head?.ref || '',
      targetBranch: p.base?.ref || '',
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      htmlUrl: p.html_url,
      draft: !!p.draft,
      merged: false,
      checksStatus: 'none',
    };
  }
}

export const githubService = new GitHubService();
