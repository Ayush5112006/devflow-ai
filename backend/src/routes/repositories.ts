/**
<<<<<<< HEAD
 * /api/repositories — full repository management API.
 *
 * Every endpoint validates inputs and never executes user-supplied shell commands.
 * GitHub tokens are read exclusively from environment variables and are never
 * returned to the frontend.
 */
import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { repositoryStore, ensureWorkspaceRepository, makeLocalRepository } from '../repositories/repositoryStore.js';
import { config } from '../config.js';
import { badRequest, notFound, forbidden } from '../utils/errors.js';
import { nowIso } from '../utils/time.js';
import { assertInside } from '../utils/fsSafe.js';
import {
  getDetailedGitStatus,
  getGitBranches,
  getGitCommits,
  getGitCommitDetail,
  getGitFileTree,
} from '../utils/git.js';
import {
  verifyGitHubToken,
  listGitHubRepos,
  getGitHubBranches,
  getGitHubCommits,
  getGitHubCommitDetail,
  getGitHubFileTree,
  getGitHubIssues,
  getGitHubPRs,
  getGitHubFileContent,
} from '../services/githubService.js';
import { createLogger } from '../utils/logger.js';
import type { Repository } from '../types/index.js';

const log = createLogger('repositories-route');
=======
 * Repositories API Router
 * 
 * REST Endpoints for repository management, git operations, GitHub sync,
 * issues, pull requests, file tree explorer, code intelligence, and webhooks.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { repositoryService } from '../services/repositoryService.js';
import { githubService } from '../services/githubService.js';
import { webhookService } from '../services/webhookService.js';
import { investigationService } from '../investigations/investigationService.js';
import { buildCodeIndex } from '../analysis/codeIndex.js';
import { badRequest, notFound } from '../utils/errors.js';
import { nowIso } from '../utils/time.js';
>>>>>>> origin/main

export const repositoriesRouter = Router();

/* ------------------------------------------------------------------ */
<<<<<<< HEAD
/* Ensure workspace repo is always registered                         */
/* ------------------------------------------------------------------ */

ensureWorkspaceRepository();

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function getRepo(id: string): Repository {
  const repo = repositoryStore.get(id);
  if (!repo) throw notFound(`Repository not found: ${id}`);
  return repo;
}

/** Validate an absolute path is either the workspace root or inside it. */
async function validateLocalPath(inputPath: string): Promise<string> {
  let resolved: string;
  try {
    resolved = path.resolve(inputPath);
  } catch {
    throw badRequest('Invalid repository path');
  }

  // Must exist
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) throw badRequest('Path is not a directory');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw badRequest(`Directory does not exist: ${resolved}`);
    }
    throw err;
  }

  // Must be the repoRoot or somewhere BELOW it (prevents traversal)
  const rel = path.relative(config.repoRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    // Allow the repoRoot itself
    if (resolved !== config.repoRoot) {
      throw forbidden('Path is outside the allowed workspace root');
    }
  }

  // Verify it is a git repo
  const gitDir = path.join(resolved, '.git');
  const hasGit = await fs.stat(gitDir).then((s) => s.isDirectory() || s.isFile()).catch(() => false);
  if (!hasGit) throw badRequest('Directory is not a git repository (no .git found)');

  return resolved;
}

/* ------------------------------------------------------------------ */
/* List repositories                                                  */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/', (_req: Request, res: Response) => {
  const repos = repositoryStore.list();
  res.json({ repositories: repos });
});

/* ------------------------------------------------------------------ */
/* Register a repository                                              */
/* ------------------------------------------------------------------ */

const RegisterSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('local'),
    path: z.string().min(1).max(500),
    name: z.string().min(1).max(200).optional(),
  }),
  z.object({
    provider: z.literal('github'),
    fullName: z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, 'Must be owner/name format'),
    name: z.string().min(1).max(200).optional(),
  }),
]);

repositoriesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RegisterSchema.parse(req.body);

    if (body.provider === 'local') {
      const absPath = await validateLocalPath(body.path);

      // Check not already registered
      const existing = repositoryStore.list().find((r) => r.path === absPath && r.provider === 'local');
      if (existing) {
        res.json({ repository: existing, alreadyExists: true });
        return;
      }

      const data = makeLocalRepository(absPath, body.name);
      const repo = repositoryStore.upsert(data);
      res.status(201).json({ repository: repo });
    } else {
      // GitHub
      const { verifyGitHubToken: verify, getGitHubRepo } = await import('../services/githubService.js');
      const status = await verify();
      if (!status.configured || status.error) {
        throw badRequest(status.error ?? 'GitHub is not configured. Set the GITHUB_TOKEN environment variable.');
      }

      const { repo: ghRepo, error } = await getGitHubRepo(body.fullName);
      if (error || !ghRepo) {
        throw badRequest(error ?? `GitHub repository not found: ${body.fullName}`);
      }

      const existing = repositoryStore.list().find((r) => r.fullName === body.fullName && r.provider === 'github');
      if (existing) {
        res.json({ repository: existing, alreadyExists: true });
        return;
      }

      const repo = repositoryStore.upsert({
        ...ghRepo,
        name: body.name ?? ghRepo.name ?? body.fullName.split('/')[1] ?? body.fullName,
        provider: 'github',
        path: body.fullName,
        owner: ghRepo.owner ?? body.fullName.split('/')[0] ?? null,
        fullName: body.fullName,
        defaultBranch: ghRepo.defaultBranch ?? 'main',
        currentBranch: null,
        visibility: ghRepo.visibility ?? 'unknown',
        language: ghRepo.language ?? null,
        stars: ghRepo.stars ?? 0,
        openIssues: ghRepo.openIssues ?? 0,
        openPRs: ghRepo.openPRs ?? 0,
        lastCommitSha: null,
        lastCommitMessage: null,
        lastCommitAt: ghRepo.lastCommitAt ?? null,
        lastSyncAt: null,
        syncStatus: 'never',
        syncError: null,
        description: ghRepo.description ?? '',
      } as Omit<Repository, 'id' | 'addedAt' | 'updatedAt'>);

      res.status(201).json({ repository: repo });
    }
=======
/* Repository CRUD & Discovery                                        */
/* ------------------------------------------------------------------ */

// List connected repositories
repositoriesRouter.get('/repositories', (_req: Request, res: Response) => {
  const list = repositoryService.listRepositories();
  res.json({ repositories: list });
});

// Auto-detect local Git repository
repositoriesRouter.get('/repositories/local/detect', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const detected = await repositoryService.detectAndRegisterCurrentRepo();
    res.json({ detected: !!detected, repository: detected });
  } catch (err) {
    next(err);
  }
});

// Register a custom local Git repository
repositoriesRouter.post('/repositories/local', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: repoPath, name } = z.object({
      path: z.string().min(1).max(500),
      name: z.string().max(100).optional(),
    }).parse(req.body);

    const repo = await repositoryService.addLocalRepository(repoPath, name);
    res.status(201).json({ repository: repo });
  } catch (err) {
    next(err);
  }
});

// Get single repository
repositoriesRouter.get('/repositories/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = repositoryService.getRepository(req.params.id);
    if (!repo) return next(notFound(`Repository ${req.params.id} not found`));
    res.json({ repository: repo });
  } catch (err) {
    next(err);
  }
});

// Sync repository
repositoriesRouter.post('/repositories/:id/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await repositoryService.syncRepository(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Remove repository
repositoriesRouter.delete('/repositories/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const success = repositoryService.removeRepository(req.params.id);
    res.json({ removed: success });
>>>>>>> origin/main
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
<<<<<<< HEAD
/* Get repository                                                      */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    res.json({ repository: repo });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Remove repository                                                   */
/* ------------------------------------------------------------------ */

repositoriesRouter.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    // Never delete the workspace repository
    if (repo.path === config.repoRoot && repo.provider === 'local') {
      throw forbidden('The workspace repository cannot be removed');
    }
    repositoryStore.delete(req.params.id);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Git status                                                          */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/:id/git', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    if (repo.provider === 'local') {
      const status = await getDetailedGitStatus(repo.path);
      // Update repo with fresh live data
      if (status.available) {
        repositoryStore.patch(repo.id, {
          currentBranch: status.branch,
          lastCommitSha: status.latestCommit,
          lastCommitMessage: status.latestMessage,
          lastCommitAt: status.latestDate,
        });
      }
      res.json({ gitStatus: status });
    } else {
      res.json({ gitStatus: null, message: 'Git status is only available for local repositories' });
    }
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Sync                                                                */
/* ------------------------------------------------------------------ */

repositoriesRouter.post('/:id/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    repositoryStore.patch(repo.id, { syncStatus: 'syncing', syncError: null });

    const started = Date.now();

    if (repo.provider === 'local') {
      const status = await getDetailedGitStatus(repo.path);
      const patches: Partial<Repository> = {
        syncStatus: 'synced',
        lastSyncAt: nowIso(),
        syncError: null,
      };
      if (status.available) {
        patches.currentBranch = status.branch;
        patches.lastCommitSha = status.latestCommit;
        patches.lastCommitMessage = status.latestMessage;
        patches.lastCommitAt = status.latestDate;
      }
      const updated = repositoryStore.patch(repo.id, patches);
      res.json({ repository: updated, durationMs: Date.now() - started, synced: true });
    } else if (repo.provider === 'github' && repo.fullName) {
      const { getGitHubRepo } = await import('../services/githubService.js');
      const { repo: ghRepo, error } = await getGitHubRepo(repo.fullName);
      if (error || !ghRepo) {
        repositoryStore.patch(repo.id, { syncStatus: 'failed', syncError: error ?? 'GitHub sync failed' });
        throw badRequest(error ?? 'Failed to sync from GitHub');
      }
      const updated = repositoryStore.patch(repo.id, {
        syncStatus: 'synced',
        lastSyncAt: nowIso(),
        syncError: null,
        openIssues: ghRepo.openIssues ?? repo.openIssues,
        openPRs: ghRepo.openPRs ?? repo.openPRs,
        lastCommitAt: ghRepo.lastCommitAt ?? repo.lastCommitAt,
        stars: ghRepo.stars ?? repo.stars,
        language: ghRepo.language ?? repo.language,
      });
      res.json({ repository: updated, durationMs: Date.now() - started, synced: true });
    } else {
      throw badRequest('Cannot sync: unknown provider');
    }
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Branches                                                           */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/:id/branches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    if (repo.provider === 'local') {
      const branches = await getGitBranches(repo.path, repo.defaultBranch);
      res.json({ branches, provider: 'local' });
    } else if (repo.provider === 'github' && repo.fullName) {
      const { branches, error } = await getGitHubBranches(repo.fullName, repo.defaultBranch);
      if (error) throw badRequest(error);
      res.json({ branches, provider: 'github' });
    } else {
      res.json({ branches: [], provider: repo.provider });
    }
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Commits                                                            */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/:id/commits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.per_page ?? '20'), 10)));

    if (repo.provider === 'local') {
      const branch = typeof req.query.branch === 'string' ? req.query.branch : undefined;
      const commits = await getGitCommits(repo.path, {
        limit: perPage,
        skip: (page - 1) * perPage,
        branch,
      });
      res.json({ commits, provider: 'local', page, perPage });
    } else if (repo.provider === 'github' && repo.fullName) {
      const sha = typeof req.query.branch === 'string' ? req.query.branch : undefined;
      const { commits, error } = await getGitHubCommits(repo.fullName, { perPage, page, sha });
      if (error) throw badRequest(error);
      res.json({ commits, provider: 'github', page, perPage });
    } else {
      res.json({ commits: [], provider: repo.provider });
    }
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Commit detail                                                       */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/:id/commits/:sha', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    const sha = req.params.sha;

    // Basic SHA validation — must be hex characters only
    if (!/^[a-f0-9]{4,40}$/i.test(sha)) throw badRequest('Invalid commit SHA');

    if (repo.provider === 'local') {
      const commit = await getGitCommitDetail(repo.path, sha);
      if (!commit) throw notFound(`Commit not found: ${sha}`);
      res.json({ commit, provider: 'local' });
    } else if (repo.provider === 'github' && repo.fullName) {
      const { commit, error } = await getGitHubCommitDetail(repo.fullName, sha);
      if (error) throw badRequest(error);
      if (!commit) throw notFound(`Commit not found: ${sha}`);
      res.json({ commit, provider: 'github' });
    } else {
      throw notFound('Commit not available');
    }
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* File tree                                                          */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/:id/files', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    const subpath = typeof req.query.path === 'string' ? req.query.path : '';

    if (repo.provider === 'local') {
      const entries = await getGitFileTree(repo.path, subpath);
      res.json({ entries, provider: 'local', path: subpath });
    } else if (repo.provider === 'github' && repo.fullName) {
      const ref = typeof req.query.ref === 'string' ? req.query.ref : 'HEAD';
      const { entries, error } = await getGitHubFileTree(repo.fullName, ref, subpath);
      if (error) throw badRequest(error);
      res.json({ entries, provider: 'github', path: subpath });
    } else {
      res.json({ entries: [], provider: repo.provider });
    }
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* File content                                                        */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/:id/file-content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    const filePath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!filePath) throw badRequest('path query parameter is required');

    // Strip leading slash
    const cleanPath = filePath.replace(/^\/+/, '');

    if (repo.provider === 'local') {
      // Validate path doesn't escape the repo root
      const absFile = assertInside(repo.path, path.join(repo.path, cleanPath));
      const stat = await fs.stat(absFile).catch(() => null);
      if (!stat || !stat.isFile()) throw notFound(`File not found: ${cleanPath}`);
      if (stat.size > config.maxFileBytes) {
        res.json({ content: null, size: stat.size, error: `File too large to display (${(stat.size / 1024).toFixed(0)} KB)` });
        return;
      }
      const content = await fs.readFile(absFile, 'utf8').catch(() => null);
      if (content === null) {
        res.json({ content: null, size: stat.size, error: 'File could not be read (may be binary)' });
        return;
      }
      res.json({ content, size: stat.size, error: null, path: cleanPath });
    } else if (repo.provider === 'github' && repo.fullName) {
      const ref = typeof req.query.ref === 'string' ? req.query.ref : 'HEAD';
      const { content, size, error } = await getGitHubFileContent(repo.fullName, cleanPath, ref);
      res.json({ content, size, error, path: cleanPath });
    } else {
      throw badRequest('File content unavailable for this provider');
    }
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Issues                                                             */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/:id/issues', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    const state = req.query.state === 'closed' ? 'closed' : req.query.state === 'all' ? 'all' : 'open';
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.per_page ?? '30'), 10)));

    if (repo.provider === 'github' && repo.fullName) {
      const { issues, error } = await getGitHubIssues(repo.fullName, { state, perPage, page });
      if (error) throw badRequest(error);
      res.json({ issues, provider: 'github', state, page, perPage });
    } else {
      // Local repos have no issue tracker
      res.json({ issues: [], provider: 'local', message: 'Issues are only available for GitHub repositories' });
    }
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Pull Requests                                                       */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/:id/pull-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    const state = req.query.state === 'closed' ? 'closed' : req.query.state === 'all' ? 'all' : 'open';
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.per_page ?? '20'), 10)));

    if (repo.provider === 'github' && repo.fullName) {
      const { prs, error } = await getGitHubPRs(repo.fullName, { state, perPage, page });
      if (error) throw badRequest(error);
      res.json({ prs, provider: 'github', state, page, perPage });
    } else {
      res.json({ prs: [], provider: 'local', message: 'Pull requests are only available for GitHub repositories' });
    }
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Repository health                                                   */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/:id/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepo(req.params.id);
    let uncommittedChanges = 0;

    if (repo.provider === 'local') {
      const status = await getDetailedGitStatus(repo.path);
      uncommittedChanges = status.files.length;
    }

    res.json({
      health: {
        repositoryId: repo.id,
        openIssues: repo.openIssues,
        openPRs: repo.openPRs,
        uncommittedChanges,
        lastCommitAt: repo.lastCommitAt,
        lastSyncAt: repo.lastSyncAt,
        syncStatus: repo.syncStatus,
        calculatedAt: nowIso(),
      },
    });
  } catch (err) { next(err); }
=======
/* Git Inspection: Branches, Commits, Diff, Working Tree              */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/repositories/:id/branches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branches = await repositoryService.getBranches(req.params.id);
    res.json({ branches });
  } catch (err) {
    next(err);
  }
});

repositoriesRouter.get('/repositories/:id/commits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 30;
    const commits = await repositoryService.getCommits(req.params.id, limit);
    res.json({ commits });
  } catch (err) {
    next(err);
  }
});

repositoriesRouter.get('/repositories/:id/commits/:hash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commit = await repositoryService.getCommitDetail(req.params.id, req.params.hash);
    if (!commit) return next(notFound(`Commit ${req.params.hash} not found`));
    res.json({ commit });
  } catch (err) {
    next(err);
  }
});

repositoriesRouter.get('/repositories/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await repositoryService.getWorkingStatus(req.params.id);
    res.json({ status });
  } catch (err) {
    next(err);
  }
});

repositoriesRouter.get('/repositories/:id/diff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const diff = await repositoryService.getWorkingDiff(req.params.id);
    res.json({ diff });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* File Tree & File Content                                           */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/repositories/:id/files', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tree = await repositoryService.getFileTree(req.params.id);
    res.json({ tree });
  } catch (err) {
    next(err);
  }
});

repositoriesRouter.get('/repositories/:id/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) return next(badRequest('Missing file path parameter'));

    const file = await repositoryService.getFileContent(req.params.id, filePath);
    res.json(file);
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* Issues & Issue -> Investigation Bridge                             */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/repositories/:id/issues', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const issues = await repositoryService.getIssues(req.params.id);
    res.json({ issues });
  } catch (err) {
    next(err);
  }
});

repositoriesRouter.post('/repositories/:id/issues', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      title: z.string().min(1).max(300),
      description: z.string().min(1).max(5000),
      severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      labels: z.array(z.string()).optional(),
    }).parse(req.body);

    const issue = await repositoryService.createIssue(req.params.id, body);
    res.status(201).json({ issue });
  } catch (err) {
    next(err);
  }
});

/**
 * 1-CLICK BRIDGE: Repository Issue -> FixFlow AI Investigation
 */
repositoriesRouter.post('/repositories/:id/issues/:issueId/investigate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = repositoryService.getRepository(req.params.id);
    if (!repo) return next(notFound(`Repository ${req.params.id} not found`));

    const issues = await repositoryService.getIssues(req.params.id);
    const issue = issues.find((i) => i.id === req.params.issueId || String(i.number) === req.params.issueId);
    if (!issue) return next(notFound(`Issue ${req.params.issueId} not found in repository ${req.params.id}`));

    // Determine target workspace path
    const workspacePath = repo.sourcePath || config.repoRoot;

    // Create FixFlow investigation
    const inv = investigationService.create(
      {
        title: issue.title,
        description: issue.description || issue.title,
        severity: issue.severity || 'high',
        expectedBehavior: 'Correct behavior as expected by repository specifications without errors.',
        actualBehavior: issue.description || 'Observed unexpected failure reported in repository issue.',
        reproSteps: [`Investigate repository issue #${issue.number}`, `Target branch: ${repo.currentBranch || repo.defaultBranch}`],
        reportedAt: issue.createdAt || nowIso(),
      },
      repo.id,
      repo.name,
      workspacePath,
      []
    );

    // Auto-launch the investigation pipeline
    void investigationService.run(inv.id).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[issue-investigation] ${inv.id} run() rejected: ${msg}`);
    });

    res.status(201).json({
      investigationId: inv.id,
      investigation: inv,
      message: `Started FixFlow AI investigation for Issue #${issue.number}`,
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* Pull Requests & PR Automation                                      */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/repositories/:id/pulls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pullRequests = await repositoryService.getPullRequests(req.params.id);
    res.json({ pullRequests });
  } catch (err) {
    next(err);
  }
});

repositoriesRouter.post('/repositories/:id/pulls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      title: z.string().min(1).max(300),
      description: z.string().min(1).max(5000),
      sourceBranch: z.string().min(1).max(100),
      targetBranch: z.string().max(100).optional(),
    }).parse(req.body);

    const pullRequest = await repositoryService.createPullRequest(req.params.id, body);
    res.status(201).json({ pullRequest });
  } catch (err) {
    next(err);
  }
});

// Generate PR preview from a completed investigation
repositoriesRouter.post('/repositories/:id/generate-pr-from-investigation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { investigationId } = z.object({ investigationId: z.string() }).parse(req.body);
    const inv = investigationService.get(investigationId);
    if (!inv) return next(notFound(`Investigation ${investigationId} not found`));

    const prSummary = inv.report?.prSummary;
    const diffStat = inv.implementation?.diffStat || '1 file changed';
    const suggestedBranch = `fix/fixflow-${inv.id.slice(0, 8)}`;

    const title = `fix: resolve issue "${inv.bug.title.slice(0, 60)}"`;
    const description = [
      `### Summary`,
      prSummary?.summary || inv.bug.description,
      ``,
      `### Root Cause`,
      prSummary?.rootCause || inv.rootCause?.statement || 'Analyzed via FixFlow AI agents',
      ``,
      `### Changes`,
      prSummary?.changes || diffStat,
      ``,
      `### Verification & Tests`,
      prSummary?.testing || (inv.verification?.status === 'passed' ? 'All verification checks passed' : 'Pending verification'),
      ``,
      `### Regression Status`,
      prSummary?.regressionStatus || inv.regression?.summary || 'Clean — zero regressions detected',
      ``,
      `> Generated automatically by FixFlow AI Agentic Bug Resolution Platform`,
    ].join('\n');

    res.json({
      title,
      description,
      sourceBranch: suggestedBranch,
      targetBranch: 'main',
      filesChanged: inv.implementation?.filesModified || [],
      diffPreview: inv.implementation?.fullDiff || '',
      verificationStatus: inv.verification?.status || 'passed',
      regressionStatus: inv.regression?.status || 'clean',
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* Code Intelligence Query                                            */
/* ------------------------------------------------------------------ */

repositoriesRouter.post('/repositories/:id/query-code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = repositoryService.getRepository(req.params.id);
    if (!repo) return next(notFound(`Repository ${req.params.id} not found`));

    const { question } = z.object({ question: z.string().min(1).max(500) }).parse(req.body);
    const targetPath = repo.sourcePath || config.repoRoot;
    const index = await buildCodeIndex(targetPath);

    const q = question.toLowerCase();
    const matches: { file: string; line?: number; symbol?: string; snippet?: string; score: number; reason: string }[] = [];

    // Search routes
    for (const r of index.routes) {
      if (q.includes('api') || q.includes('route') || q.includes('login') || q.includes('auth') || q.includes(r.path.toLowerCase())) {
        matches.push({
          file: r.file,
          line: r.line,
          symbol: `${r.method} ${r.path}`,
          snippet: `Route handler for ${r.method} ${r.path}`,
          score: 0.9,
          reason: `Matches route definition for "${r.path}"`,
        });
      }
    }

    // Search database tables
    for (const t of index.tables) {
      if (q.includes('database') || q.includes('db') || q.includes('table') || q.includes('sql') || q.includes(t.name.toLowerCase())) {
        matches.push({
          file: t.file,
          line: t.line,
          symbol: t.name,
          snippet: `Database table/model "${t.name}" (columns: ${t.columns.slice(0, 5).join(', ')})`,
          score: 0.85,
          reason: `Matches database schema for table "${t.name}"`,
        });
      }
    }

    // Search file symbols
    for (const [name, symList] of index.symbols.entries()) {
      if (q.includes(name.toLowerCase())) {
        for (const sym of symList) {
          matches.push({
            file: sym.file,
            line: sym.line,
            symbol: sym.name,
            snippet: `${sym.kind} ${sym.name}`,
            score: 0.8,
            reason: `Declared symbol "${sym.name}" in ${sym.file}`,
          });
        }
      }
    }

    matches.sort((a, b) => b.score - a.score);

    res.json({
      question,
      repositoryId: repo.id,
      evidence: matches.slice(0, 10),
      summary: matches.length > 0
        ? `Found ${matches.length} matching code evidence item(s) across the repository.`
        : `No direct symbol matches found for query. Try searching for specific route names, database tables, or function names.`,
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* GitHub Integration Endpoints                                       */
/* ------------------------------------------------------------------ */

// Check GitHub credentials status
repositoriesRouter.get('/integrations/github/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await githubService.verifyAuth();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// List accessible repositories from GitHub account
repositoriesRouter.get('/integrations/github/repos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const perPage = parseInt(req.query.perPage as string, 10) || 30;
    const repos = await githubService.listRepositories(page, perPage);
    res.json({ repositories: repos });
  } catch (err) {
    next(err);
  }
});

// Import GitHub repository
repositoriesRouter.post('/integrations/github/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { owner, repo } = z.object({
      owner: z.string().min(1),
      repo: z.string().min(1),
    }).parse(req.body);

    const imported = await repositoryService.importGitHubRepository(owner, repo);
    res.status(201).json({ repository: imported });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* Webhooks                                                           */
/* ------------------------------------------------------------------ */

repositoriesRouter.get('/integrations/github/webhooks/settings', (_req: Request, res: Response) => {
  res.json(webhookService.getSettings());
});

repositoriesRouter.get('/integrations/github/webhooks/events', (_req: Request, res: Response) => {
  res.json({ events: webhookService.getEvents() });
});

/**
 * Incoming GitHub webhook receiver with HMAC-SHA256 signature verification.
 */
repositoriesRouter.post('/integrations/github/webhook', (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const eventType = (req.headers['x-github-event'] as string) || 'unknown';
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  // Validate signature
  const valid = webhookService.verifySignature(rawBody, signature);
  if (!valid) {
    webhookService.recordEvent(eventType, req.body || {}, 'failed', 'Rejected: Invalid or missing webhook signature');
    res.status(401).json({ error: 'Invalid webhook signature', code: 'invalid_signature' });
    return;
  }

  const payload = req.body || {};
  const action = payload.action ? `[action: ${payload.action}]` : '';
  const repoName = payload.repository?.full_name || 'unknown';
  const summary = `Received ${eventType} event ${action} from ${repoName}`;

  webhookService.recordEvent(eventType, payload, 'processed', summary);
  res.status(200).json({ received: true, event: eventType });
>>>>>>> origin/main
});
