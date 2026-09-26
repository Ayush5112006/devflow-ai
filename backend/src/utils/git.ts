/**
 * Safe, comprehensive Git utilities.
 * Uses only allowed read-only or explicit confirmed operations via spawn.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { tryRun } from './exec.js';

export interface GitInfo {
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
  recentCommits: GitCommitSummary[];
  suggestedBranch: string | null;
}

export interface GitCommitSummary {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail?: string;
  date: string;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
}

export interface GitCommitDetail extends GitCommitSummary {
  fullDiff: string;
  files: {
    file: string;
    status: 'modified' | 'added' | 'deleted' | 'renamed';
    insertions: number;
    deletions: number;
  }[];
}

export interface GitBranchInfo {
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

export interface GitTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  sizeBytes?: number;
  children?: GitTreeNode[];
}

async function git(args: string, cwd: string, timeoutMs = 8000): Promise<string | null> {
  const result = await tryRun(`git ${args}`, { cwd, timeoutMs });
  if (result.exitCode !== 0) return null;
  return result.stdout.trim() || null;
}

/**
 * Checks if a given directory path is inside or is a git work tree.
 */
export async function isGitRepository(repoPath: string): Promise<boolean> {
  const isRepo = await git('rev-parse --is-inside-work-tree', repoPath);
  return isRepo === 'true';
}

/**
 * Get comprehensive Git metadata and working tree status.
 */
export async function getGitInfo(workspacePath: string, investigationId?: string): Promise<GitInfo> {
  const isRepo = await isGitRepository(workspacePath);
  if (!isRepo) {
    return {
      available: false,
      branch: null,
      latestCommit: null,
      latestMessage: null,
      latestAuthor: null,
      latestDate: null,
      remoteUrl: null,
      isClean: true,
      status: { modified: [], added: [], deleted: [], untracked: [], staged: [] },
      modifiedFiles: [],
      recentCommits: [],
      suggestedBranch: null,
    };
  }

  const [branch, hash, message, author, date, remote] = await Promise.all([
    git('rev-parse --abbrev-ref HEAD', workspacePath),
    git('log -1 --format=%H', workspacePath),
    git('log -1 --format=%s', workspacePath),
    git('log -1 --format=%an', workspacePath),
    git('log -1 --format=%ci', workspacePath),
    git('remote get-url origin', workspacePath),
  ]);

  // Working tree status parsing
  const statusOut = await git('status --porcelain', workspacePath);
  const status = {
    modified: [] as string[],
    added: [] as string[],
    deleted: [] as string[],
    untracked: [] as string[],
    staged: [] as string[],
  };

  const modifiedFiles: string[] = [];

  if (statusOut) {
    const lines = statusOut.split('\n').filter(Boolean);
    for (const line of lines) {
      const x = line[0];
      const y = line[1];
      const filePath = line.slice(3).trim();

      if (x === '?' && y === '?') {
        status.untracked.push(filePath);
        modifiedFiles.push(filePath);
      } else {
        if (x !== ' ' && x !== '?') {
          status.staged.push(filePath);
        }
        if (y === 'M') {
          status.modified.push(filePath);
          modifiedFiles.push(filePath);
        } else if (y === 'D') {
          status.deleted.push(filePath);
          modifiedFiles.push(filePath);
        } else if (y === 'A' || x === 'A') {
          status.added.push(filePath);
          modifiedFiles.push(filePath);
        } else if (x === 'M') {
          status.modified.push(filePath);
          modifiedFiles.push(filePath);
        }
      }
    }
  }

  const isClean = modifiedFiles.length === 0 && status.staged.length === 0;

  // Recent commits (last 10)
  const logOut = await git('log -10 --format=%H%x09%s%x09%an%x09%ci', workspacePath);
  const recentCommits: GitCommitSummary[] = logOut
    ? logOut.split('\n').filter(Boolean).map((line) => {
        const [h, m, a, d] = line.split('\t');
        return {
          hash: h ?? '',
          shortHash: (h ?? '').slice(0, 10),
          message: m ?? '',
          author: a ?? '',
          date: d ?? '',
        };
      })
    : [];

  const shortId = investigationId ? investigationId.replace(/[^a-z0-9]/g, '-').slice(0, 20) : 'fix';
  const suggestedBranch = `fix/fixflow-${shortId}`;

  return {
    available: true,
    branch: branch || 'main',
    latestCommit: hash ? hash.slice(0, 12) : null,
    latestMessage: message,
    latestAuthor: author,
    latestDate: date,
    remoteUrl: remote,
    isClean,
    status,
    modifiedFiles,
    recentCommits,
    suggestedBranch,
  };
}

/**
 * List branches in the repository.
 */
export async function getGitBranches(workspacePath: string): Promise<GitBranchInfo[]> {
  const isRepo = await isGitRepository(workspacePath);
  if (!isRepo) return [];

  const [currentBranchName, rawBranchList] = await Promise.all([
    git('rev-parse --abbrev-ref HEAD', workspacePath),
    git('branch -a --no-color', workspacePath),
  ]);

  const branches: GitBranchInfo[] = [];

  if (rawBranchList) {
    const lines = rawBranchList.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      const isCurrentFromStar = line.startsWith('*');
      const cleanedLine = line.replace(/^\*\s*/, '').trim();
      if (!cleanedLine || cleanedLine.includes('->') || cleanedLine.includes('HEAD')) continue;

      const cleanName = cleanedLine.replace(/^remotes\/origin\//, '').replace(/^origin\//, '');
      const isCurrent = isCurrentFromStar || (!!currentBranchName && cleanName === currentBranchName.trim());
      const isProtected = ['main', 'master', 'release', 'production'].includes(cleanName.toLowerCase());

      const existingIndex = branches.findIndex((b) => b.name === cleanName);
      if (existingIndex >= 0) {
        if (isCurrent) {
          branches[existingIndex].isCurrent = true;
        }
      } else {
        branches.push({
          name: cleanName,
          isCurrent,
          latestCommitHash: '',
          latestCommitMessage: '',
          author: '',
          date: '',
          ahead: 0,
          behind: 0,
          isProtected,
        });
      }
    }
  }

  // Ensure current branch exists and is marked current
  const targetCurrent = currentBranchName ? currentBranchName.trim() : null;
  if (targetCurrent) {
    const cur = branches.find((b) => b.name === targetCurrent);
    if (cur) {
      cur.isCurrent = true;
    } else {
      branches.unshift({
        name: targetCurrent,
        isCurrent: true,
        latestCommitHash: '',
        latestCommitMessage: '',
        author: '',
        date: '',
        ahead: 0,
        behind: 0,
        isProtected: ['main', 'master'].includes(targetCurrent.toLowerCase()),
      });
    }
  } else if (branches.length > 0 && !branches.some((b) => b.isCurrent)) {
    branches[0].isCurrent = true;
  }

  return branches;
}

/**
 * Get commit log with optional pagination.
 */
export async function getGitCommits(
  workspacePath: string,
  limit = 25,
): Promise<GitCommitSummary[]> {
  const isRepo = await isGitRepository(workspacePath);
  if (!isRepo) return [];

  const out = await git(`log -${Math.min(limit, 100)} --format=%H%x09%s%x09%an%x09%ae%x09%ci`, workspacePath);
  if (!out) return [];

  return out.split('\n').filter(Boolean).map((line) => {
    const [h, m, a, email, d] = line.split('\t');
    return {
      hash: h ?? '',
      shortHash: (h ?? '').slice(0, 10),
      message: m ?? '',
      author: a ?? '',
      authorEmail: email ?? '',
      date: d ?? '',
    };
  });
}

/**
 * Get details and diff for a specific commit hash.
 */
export async function getGitCommitDetail(
  workspacePath: string,
  hash: string,
): Promise<GitCommitDetail | null> {
  const isRepo = await isGitRepository(workspacePath);
  if (!isRepo) return null;

  // Validate commit hash format
  if (!/^[a-f0-9]{4,40}$/i.test(hash)) {
    throw new Error('Invalid commit hash format');
  }

  const [meta, diff, numstat] = await Promise.all([
    git(`show -s --format=%H%x09%s%x09%an%x09%ae%x09%ci ${hash}`, workspacePath),
    git(`show --format="" --patch ${hash}`, workspacePath),
    git(`show --numstat --format="" ${hash}`, workspacePath),
  ]);

  if (!meta) return null;
  const [fullHash, message, author, email, date] = meta.split('\t');

  const files: GitCommitDetail['files'] = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  if (numstat) {
    for (const line of numstat.split('\n').filter(Boolean)) {
      const [ins, del, file] = line.split('\t');
      const i = parseInt(ins, 10) || 0;
      const d = parseInt(del, 10) || 0;
      totalInsertions += i;
      totalDeletions += d;
      files.push({
        file: file ?? '',
        status: 'modified',
        insertions: i,
        deletions: d,
      });
    }
  }

  return {
    hash: fullHash ?? hash,
    shortHash: (fullHash ?? hash).slice(0, 10),
    message: message ?? '',
    author: author ?? '',
    authorEmail: email ?? '',
    date: date ?? '',
    fullDiff: diff ?? '',
    filesChanged: files.length,
    insertions: totalInsertions,
    deletions: totalDeletions,
    files,
  };
}

/**
 * Get the current working tree diff.
 */
export async function getGitWorkingDiff(workspacePath: string): Promise<string> {
  const isRepo = await isGitRepository(workspacePath);
  if (!isRepo) return '';
  const diff = await git('diff', workspacePath);
  const stagedDiff = await git('diff --staged', workspacePath);
  return [diff, stagedDiff].filter(Boolean).join('\n');
}

/**
 * Build a file tree representation of a directory.
 */
export async function buildDirectoryTree(
  rootPath: string,
  relDir = '',
  depth = 0,
  maxDepth = 5,
): Promise<GitTreeNode[]> {
  if (depth > maxDepth) return [];
  const targetDir = path.join(rootPath, relDir);

  const IGNORED = new Set(['.git', 'node_modules', 'dist', 'build', '.cache', '.turbo', '.next']);
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(targetDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: GitTreeNode[] = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const relItemPath = relDir ? `${relDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = await buildDirectoryTree(rootPath, relItemPath, depth + 1, maxDepth);
      nodes.push({
        name: entry.name,
        path: relItemPath,
        type: 'directory',
        children,
      });
    } else if (entry.isFile()) {
      let sizeBytes = 0;
      try {
        const stat = await fs.stat(path.join(targetDir, entry.name));
        sizeBytes = stat.size;
      } catch {
        // ignore stat error
      }
      nodes.push({
        name: entry.name,
        path: relItemPath,
        type: 'file',
        sizeBytes,
      });
    }
  }

  // Sort directories first, then files alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}
