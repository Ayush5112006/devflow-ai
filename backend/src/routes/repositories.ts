/**
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

export const repositoriesRouter = Router();

/* ------------------------------------------------------------------ */
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
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
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
});
