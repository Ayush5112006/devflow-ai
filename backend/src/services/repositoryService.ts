/**
 * Repository Service
 * 
 * Manages connected repositories (Local Git, Demo, and imported GitHub repositories).
 * Provides metadata synchronization, branch/commit inspection, file viewing, and issue tracking.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import { id as makeId } from '../utils/id.js';
import { nowIso } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';
import { readTextFile } from '../utils/fsSafe.js';
import {
  getGitInfo,
  getGitBranches,
  getGitCommits,
  getGitCommitDetail,
  getGitWorkingDiff,
  buildDirectoryTree,
  isGitRepository,
  type GitInfo,
  type GitBranchInfo,
  type GitCommitSummary,
  type GitCommitDetail,
  type GitTreeNode,
} from '../utils/git.js';
import { githubService, type GitHubIssueItem, type GitHubPullRequestItem } from './githubService.js';
import { PROJECTS as DEMO_PROJECTS } from '../repositories/demoCatalog.js';

const log = createLogger('repository-service');

export type RepositoryProvider = 'local' | 'github' | 'demo';

export interface RepositoryEntity {
  id: string;
  name: string;
  fullName: string;
  description: string;
  provider: RepositoryProvider;
  sourcePath: string; // Absolute or relative path on disk (for local/demo)
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

export interface RepositoryIssue {
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

export interface RepositoryPullRequest {
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

export class RepositoryService {
  private repositories: Map<string, RepositoryEntity> = new Map();
  private localIssues: Map<string, RepositoryIssue[]> = new Map();
  private localPRs: Map<string, RepositoryPullRequest[]> = new Map();
  private initialized = false;

  constructor() {
    this.initDefaultRepositories();
  }

  private initDefaultRepositories() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Seed demo InsightBoard project
    const demo = DEMO_PROJECTS[0];
    if (demo) {
      const demoRepo: RepositoryEntity = {
        id: demo.id,
        name: demo.name,
        fullName: `demo/${demo.id}`,
        description: demo.description,
        provider: 'demo',
        sourcePath: path.resolve(config.repoRoot, demo.sourcePath),
        remoteUrl: null,
        defaultBranch: 'main',
        currentBranch: 'main',
        lastCommitHash: 'd3f1a09',
        lastCommitMessage: 'feat: add sentiment model and customer orders view',
        lastCommitAuthor: 'FixFlow Demo Team',
        lastCommitDate: nowIso(),
        status: 'active',
        lastSyncAt: nowIso(),
        openIssuesCount: 3,
        openPullRequestsCount: 1,
        isClean: true,
        isDemo: true,
      };
      this.repositories.set(demoRepo.id, demoRepo);

      // Seed default issues for InsightBoard
      this.localIssues.set(demoRepo.id, [
        {
          id: 'iss-d1',
          number: 101,
          title: 'Prediction detail card shows a blank sentiment badge',
          description: 'Clicking a prediction row throws a TypeError and the detail panel never renders.',
          state: 'open',
          severity: 'high',
          author: 'frontend-lead',
          labels: ['bug', 'frontend', 'sentiment'],
          assignees: ['developer'],
          createdAt: '2026-02-24T12:10:00Z',
          updatedAt: '2026-02-24T12:10:00Z',
          source: 'demo',
        },
        {
          id: 'iss-d2',
          number: 102,
          title: 'Dashboard is empty and every API call 404s',
          description: 'The browser requests /undefined/api/predictions and gets an HTML 404 body back.',
          state: 'open',
          severity: 'critical',
          author: 'devops-oncall',
          labels: ['bug', 'api', 'env'],
          assignees: ['developer'],
          createdAt: '2026-02-24T12:08:00Z',
          updatedAt: '2026-02-24T12:08:00Z',
          source: 'demo',
        },
        {
          id: 'iss-d3',
          number: 103,
          title: 'GET /api/orders returns 500',
          description: 'The orders route throws "no such column: o.customer_name" while /api/revenue still works.',
          state: 'open',
          severity: 'critical',
          author: 'backend-team',
          labels: ['bug', 'database', 'sqlite'],
          assignees: ['developer'],
          createdAt: '2026-02-24T11:59:00Z',
          updatedAt: '2026-02-24T11:59:00Z',
          source: 'demo',
        },
      ]);

      this.localPRs.set(demoRepo.id, [
        {
          id: 'pr-101',
          number: 42,
          title: 'refactor: cache query plans in orders service',
          description: 'Improves response time on high-load analytics dashboards by preparing statement cache.',
          state: 'open',
          author: 'senior-engineer',
          sourceBranch: 'perf/query-cache',
          targetBranch: 'main',
          createdAt: '2026-02-23T14:00:00Z',
          updatedAt: '2026-02-23T14:30:00Z',
          source: 'demo',
          checksStatus: 'success',
          reviewStatus: 'review_required',
        },
      ]);
    }

    // 2. Auto-detect FixFlow project root as a Local Git repository if it is git-backed
    void this.detectAndRegisterCurrentRepo();
  }

  /**
   * Detects the root FixFlow project repository and registers it as local repository.
   */
  async detectAndRegisterCurrentRepo(): Promise<RepositoryEntity | null> {
    try {
      const isGit = await isGitRepository(config.repoRoot);
      if (!isGit) return null;

      const gitInfo = await getGitInfo(config.repoRoot);
      const pkgPath = path.join(config.repoRoot, 'package.json');
      let repoName = 'fixflow-ai';
      try {
        const pkgRaw = await readTextFile(pkgPath);
        const pkg = JSON.parse(pkgRaw);
        if (pkg.name) repoName = pkg.name;
      } catch {
        // fallback
      }

      const id = 'local-fixflow-root';
      const entity: RepositoryEntity = {
        id,
        name: repoName,
        fullName: gitInfo.remoteUrl
          ? gitInfo.remoteUrl.replace(/^.*github\.com[/:]([^/]+\/[^/.]+)(\.git)?$/, '$1')
          : `local/${repoName}`,
        description: 'FixFlow AI Workspace Local Git Repository (Active codebase)',
        provider: 'local',
        sourcePath: config.repoRoot,
        remoteUrl: gitInfo.remoteUrl,
        defaultBranch: 'main',
        currentBranch: gitInfo.branch || 'ASHISH',
        lastCommitHash: gitInfo.latestCommit,
        lastCommitMessage: gitInfo.latestMessage,
        lastCommitAuthor: gitInfo.latestAuthor,
        lastCommitDate: gitInfo.latestDate,
        status: 'active',
        lastSyncAt: nowIso(),
        openIssuesCount: this.localIssues.get(id)?.length || 0,
        openPullRequestsCount: this.localPRs.get(id)?.length || 0,
        isClean: gitInfo.isClean,
      };

      this.repositories.set(id, entity);
      log.info(`Registered local Git repository: ${entity.fullName}`);
      return entity;
    } catch (err) {
      log.warn('Could not auto-register local repo:', err);
      return null;
    }
  }

  listRepositories(): RepositoryEntity[] {
    return [...this.repositories.values()];
  }

  getRepository(id: string): RepositoryEntity | undefined {
    return this.repositories.get(id);
  }

  /**
   * Register a user-specified local repository directory.
   */
  async addLocalRepository(targetPath: string, name?: string): Promise<RepositoryEntity> {
    const absPath = path.resolve(targetPath);
    const isGit = await isGitRepository(absPath);
    if (!isGit) {
      throw new Error(`The directory "${absPath}" is not a valid Git repository.`);
    }

    const gitInfo = await getGitInfo(absPath);
    const repoName = name || path.basename(absPath);
    const id = `local-${makeId('repo')}`;

    const entity: RepositoryEntity = {
      id,
      name: repoName,
      fullName: `local/${repoName}`,
      description: `Local repository located at ${absPath}`,
      provider: 'local',
      sourcePath: absPath,
      remoteUrl: gitInfo.remoteUrl,
      defaultBranch: gitInfo.branch || 'main',
      currentBranch: gitInfo.branch || 'main',
      lastCommitHash: gitInfo.latestCommit,
      lastCommitMessage: gitInfo.latestMessage,
      lastCommitAuthor: gitInfo.latestAuthor,
      lastCommitDate: gitInfo.latestDate,
      status: 'active',
      lastSyncAt: nowIso(),
      openIssuesCount: 0,
      openPullRequestsCount: 0,
      isClean: gitInfo.isClean,
    };

    this.repositories.set(id, entity);
    this.localIssues.set(id, []);
    this.localPRs.set(id, []);
    return entity;
  }

  /**
   * Import a GitHub repository metadata.
   */
  async importGitHubRepository(owner: string, repo: string): Promise<RepositoryEntity> {
    const ghRepo = await githubService.getRepository(owner, repo);
    const id = `github-${ghRepo.id}`;

    const entity: RepositoryEntity = {
      id,
      name: ghRepo.name,
      fullName: ghRepo.fullName,
      description: ghRepo.description || 'Imported GitHub Repository',
      provider: 'github',
      sourcePath: '', // remote
      remoteUrl: ghRepo.htmlUrl,
      defaultBranch: ghRepo.defaultBranch,
      currentBranch: ghRepo.defaultBranch,
      lastCommitHash: null,
      lastCommitMessage: null,
      lastCommitAuthor: null,
      lastCommitDate: ghRepo.pushedAt,
      status: 'active',
      lastSyncAt: nowIso(),
      openIssuesCount: ghRepo.openIssuesCount,
      openPullRequestsCount: 0,
      githubOwner: ghRepo.owner,
      githubRepo: ghRepo.name,
    };

    this.repositories.set(id, entity);
    // Trigger initial sync of issues & PRs in background
    void this.syncRepository(id);
    return entity;
  }

  /**
   * Sync a repository (branches, commits, issues, PRs).
   */
  async syncRepository(id: string): Promise<{ synced: boolean; durationMs: number; summary: string }> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    const start = Date.now();
    repo.status = 'syncing';

    try {
      if (repo.provider === 'local' || repo.provider === 'demo') {
        const gitInfo = await getGitInfo(repo.sourcePath);
        if (gitInfo.available) {
          repo.currentBranch = gitInfo.branch || repo.currentBranch;
          repo.lastCommitHash = gitInfo.latestCommit;
          repo.lastCommitMessage = gitInfo.latestMessage;
          repo.lastCommitAuthor = gitInfo.latestAuthor;
          repo.lastCommitDate = gitInfo.latestDate;
          repo.isClean = gitInfo.isClean;
        }
      } else if (repo.provider === 'github' && repo.githubOwner && repo.githubRepo) {
        const [ghRepo, ghIssues, ghPulls] = await Promise.all([
          githubService.getRepository(repo.githubOwner, repo.githubRepo),
          githubService.listIssues(repo.githubOwner, repo.githubRepo, 'open').catch(() => []),
          githubService.listPullRequests(repo.githubOwner, repo.githubRepo, 'open').catch(() => []),
        ]);

        repo.defaultBranch = ghRepo.defaultBranch;
        repo.openIssuesCount = ghIssues.length;
        repo.openPullRequestsCount = ghPulls.length;
        repo.lastCommitDate = ghRepo.pushedAt;
      }

      repo.status = 'active';
      repo.lastSyncAt = nowIso();
      repo.syncDurationMs = Date.now() - start;

      return {
        synced: true,
        durationMs: repo.syncDurationMs,
        summary: `Synchronized ${repo.name} successfully in ${repo.syncDurationMs}ms`,
      };
    } catch (err) {
      repo.status = 'error';
      throw err;
    }
  }

  /**
   * Remove a repository connection.
   */
  removeRepository(id: string): boolean {
    return this.repositories.delete(id);
  }

  /* ---------------- Git inspection methods ---------------- */

  async getBranches(id: string): Promise<GitBranchInfo[]> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    if (repo.provider === 'local' || repo.provider === 'demo') {
      return getGitBranches(repo.sourcePath);
    }
    // Remote GitHub repository
    return [
      {
        name: repo.defaultBranch,
        isCurrent: true,
        latestCommitHash: repo.lastCommitHash || 'HEAD',
        latestCommitMessage: repo.lastCommitMessage || 'Latest commit on remote',
        author: repo.lastCommitAuthor || 'Remote Author',
        date: repo.lastCommitDate || nowIso(),
        ahead: 0,
        behind: 0,
        isProtected: true,
      },
    ];
  }

  async getCommits(id: string, limit = 25): Promise<GitCommitSummary[]> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    if (repo.provider === 'local' || repo.provider === 'demo') {
      return getGitCommits(repo.sourcePath, limit);
    }
    return [];
  }

  async getCommitDetail(id: string, hash: string): Promise<GitCommitDetail | null> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    if (repo.provider === 'local' || repo.provider === 'demo') {
      return getGitCommitDetail(repo.sourcePath, hash);
    }
    return null;
  }

  async getWorkingStatus(id: string): Promise<GitInfo> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    if (repo.provider === 'local' || repo.provider === 'demo') {
      return getGitInfo(repo.sourcePath);
    }
    return {
      available: false,
      branch: repo.defaultBranch,
      latestCommit: null,
      latestMessage: null,
      latestAuthor: null,
      latestDate: null,
      remoteUrl: repo.remoteUrl,
      isClean: true,
      status: { modified: [], added: [], deleted: [], untracked: [], staged: [] },
      modifiedFiles: [],
      recentCommits: [],
      suggestedBranch: null,
    };
  }

  async getWorkingDiff(id: string): Promise<string> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    if (repo.provider === 'local' || repo.provider === 'demo') {
      return getGitWorkingDiff(repo.sourcePath);
    }
    return '';
  }

  async getFileTree(id: string): Promise<GitTreeNode[]> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    if (repo.provider === 'local' || repo.provider === 'demo') {
      return buildDirectoryTree(repo.sourcePath);
    }
    return [];
  }

  async getFileContent(id: string, relPath: string): Promise<{ content: string; language: string; size: number }> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    // Prevent path traversal
    const safeRel = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absPath = path.join(repo.sourcePath, safeRel);

    const ext = path.extname(safeRel).toLowerCase().slice(1);
    const content = await readTextFile(absPath);
    return {
      content,
      language: ext || 'text',
      size: content.length,
    };
  }

  /* ---------------- Issues ---------------- */

  async getIssues(id: string): Promise<RepositoryIssue[]> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    if (repo.provider === 'github' && repo.githubOwner && repo.githubRepo) {
      const ghIssues = await githubService.listIssues(repo.githubOwner, repo.githubRepo);
      return ghIssues.map((g) => ({
        id: `gh-${g.id}`,
        number: g.number,
        title: g.title,
        description: g.body || '',
        state: g.state,
        author: g.author,
        labels: g.labels.map((l) => l.name),
        assignees: g.assignees,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
        source: 'github',
        githubHtmlUrl: g.htmlUrl,
      }));
    }

    return this.localIssues.get(id) || [];
  }

  async createIssue(
    id: string,
    data: { title: string; description: string; severity?: RepositoryIssue['severity']; labels?: string[] }
  ): Promise<RepositoryIssue> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    if (repo.provider === 'github' && repo.githubOwner && repo.githubRepo) {
      const gh = await githubService.createIssue(repo.githubOwner, repo.githubRepo, {
        title: data.title,
        body: data.description,
        labels: data.labels,
      });
      return {
        id: `gh-${gh.id}`,
        number: gh.number,
        title: gh.title,
        description: gh.body || '',
        state: 'open',
        author: gh.author,
        labels: gh.labels.map((l) => l.name),
        assignees: gh.assignees,
        createdAt: gh.createdAt,
        updatedAt: gh.updatedAt,
        source: 'github',
        githubHtmlUrl: gh.htmlUrl,
      };
    }

    // Local / Demo issue
    const existing = this.localIssues.get(id) || [];
    const issueNum = existing.length + 101;
    const newIssue: RepositoryIssue = {
      id: makeId('iss'),
      number: issueNum,
      title: data.title,
      description: data.description,
      state: 'open',
      severity: data.severity || 'medium',
      author: 'developer',
      labels: data.labels || ['bug'],
      assignees: ['developer'],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      source: repo.provider === 'demo' ? 'demo' : 'local',
    };

    existing.unshift(newIssue);
    this.localIssues.set(id, existing);
    repo.openIssuesCount = existing.filter((i) => i.state === 'open').length;
    return newIssue;
  }

  /* ---------------- Pull Requests ---------------- */

  async getPullRequests(id: string): Promise<RepositoryPullRequest[]> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    if (repo.provider === 'github' && repo.githubOwner && repo.githubRepo) {
      const ghPulls = await githubService.listPullRequests(repo.githubOwner, repo.githubRepo);
      return ghPulls.map((p) => ({
        id: `gh-pr-${p.id}`,
        number: p.number,
        title: p.title,
        description: p.body || '',
        state: p.state,
        author: p.author,
        sourceBranch: p.sourceBranch,
        targetBranch: p.targetBranch,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        source: 'github',
        githubHtmlUrl: p.htmlUrl,
        checksStatus: p.checksStatus,
        reviewStatus: 'review_required',
      }));
    }

    return this.localPRs.get(id) || [];
  }

  async createPullRequest(
    id: string,
    data: { title: string; description: string; sourceBranch: string; targetBranch?: string }
  ): Promise<RepositoryPullRequest> {
    const repo = this.repositories.get(id);
    if (!repo) throw new Error(`Repository ${id} not found`);

    const targetBranch = data.targetBranch || repo.defaultBranch || 'main';

    if (repo.provider === 'github' && repo.githubOwner && repo.githubRepo) {
      const p = await githubService.createPullRequest(repo.githubOwner, repo.githubRepo, {
        title: data.title,
        body: data.description,
        head: data.sourceBranch,
        base: targetBranch,
      });
      return {
        id: `gh-pr-${p.id}`,
        number: p.number,
        title: p.title,
        description: p.body || '',
        state: 'open',
        author: p.author,
        sourceBranch: p.sourceBranch,
        targetBranch: p.targetBranch,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        source: 'github',
        githubHtmlUrl: p.htmlUrl,
        checksStatus: 'pending',
        reviewStatus: 'review_required',
      };
    }

    // Local / Demo pull request
    const existing = this.localPRs.get(id) || [];
    const prNum = existing.length + 50;
    const newPR: RepositoryPullRequest = {
      id: makeId('pr'),
      number: prNum,
      title: data.title,
      description: data.description,
      state: 'open',
      author: 'developer',
      sourceBranch: data.sourceBranch,
      targetBranch,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      source: 'local',
      checksStatus: 'success',
      reviewStatus: 'review_required',
    };

    existing.unshift(newPR);
    this.localPRs.set(id, existing);
    repo.openPullRequestsCount = existing.filter((p) => p.state === 'open').length;
    return newPR;
  }
}

export const repositoryService = new RepositoryService();
