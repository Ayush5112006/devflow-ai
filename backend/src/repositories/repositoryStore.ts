/**
 * In-memory repository registry.
 * Same pattern as InvestigationService — all mutation goes through this store.
 */
import path from 'node:path';
import type {
  Repository,
  RepositoryProvider,
} from '../types/index.js';
import { id as makeId } from '../utils/id.js';
import { nowIso } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';
import { config } from '../config.js';

const log = createLogger('repository-store');

export class RepositoryStore {
  private readonly repos = new Map<string, Repository>();

  /** Add or replace a repository. */
  upsert(data: Omit<Repository, 'id' | 'addedAt' | 'updatedAt'> & { id?: string; addedAt?: string }): Repository {
    const existing = data.id ? this.repos.get(data.id) : undefined;
    const repo: Repository = {
      ...data,
      id: data.id ?? makeId('repo'),
      addedAt: data.addedAt ?? existing?.addedAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    this.repos.set(repo.id, repo);
    log.info(`Repository upserted: ${repo.id} (${repo.name})`);
    return repo;
  }

  get(id: string): Repository | undefined {
    return this.repos.get(id);
  }

  list(): Repository[] {
    return [...this.repos.values()].sort(
      (a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt),
    );
  }

  delete(id: string): boolean {
    const existed = this.repos.has(id);
    this.repos.delete(id);
    return existed;
  }

  /** Update specific fields on an existing repository. */
  patch(id: string, updates: Partial<Repository>): Repository | undefined {
    const existing = this.repos.get(id);
    if (!existing) return undefined;
    const updated: Repository = { ...existing, ...updates, id, updatedAt: nowIso() };
    this.repos.set(id, updated);
    return updated;
  }
}

export const repositoryStore = new RepositoryStore();

/**
 * Register the FixFlow workspace root as a local repository if not already registered.
 * Called at startup so the workspace always has a default repository.
 */
export function ensureWorkspaceRepository(): Repository {
  // Check if we already have the workspace registered
  const existing = repositoryStore.list().find((r) => r.path === config.repoRoot);
  if (existing) return existing;

  const repo = repositoryStore.upsert({
    name: 'fixflow-ai',
    description: 'FixFlow AI — the application workspace itself (local git repository)',
    provider: 'local',
    path: config.repoRoot,
    owner: null,
    fullName: null,
    defaultBranch: 'main',
    currentBranch: null,
    visibility: 'private',
    language: 'TypeScript',
    stars: 0,
    openIssues: 0,
    openPRs: 0,
    lastCommitSha: null,
    lastCommitMessage: null,
    lastCommitAt: null,
    lastSyncAt: null,
    syncStatus: 'never',
    syncError: null,
  });

  log.info(`Workspace repository registered: ${repo.id}`);
  return repo;
}

/** Build a local repository object from a validated absolute path. */
export function makeLocalRepository(
  absPath: string,
  name?: string,
): Omit<Repository, 'id' | 'addedAt' | 'updatedAt'> {
  const repoName = name ?? path.basename(absPath);
  return {
    name: repoName,
    description: `Local git repository at ${absPath}`,
    provider: 'local' as RepositoryProvider,
    path: absPath,
    owner: null,
    fullName: null,
    defaultBranch: 'main',
    currentBranch: null,
    visibility: 'private',
    language: null,
    stars: 0,
    openIssues: 0,
    openPRs: 0,
    lastCommitSha: null,
    lastCommitMessage: null,
    lastCommitAt: null,
    lastSyncAt: null,
    syncStatus: 'never',
    syncError: null,
  };
}
