/**
 * Lightweight Git information helpers.
 * Uses only read-only git commands from the allowed programs list.
 */
import { tryRun } from './exec.js';

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

async function git(args: string, cwd: string): Promise<string | null> {
  const result = await tryRun(`git ${args}`, { cwd, timeoutMs: 5000 });
  if (result.exitCode !== 0) return null;
  return result.stdout.trim() || null;
}

export async function getGitInfo(workspacePath: string, investigationId?: string): Promise<GitInfo> {
  // Check if git is available in this directory
  const branch = await git('rev-parse --abbrev-ref HEAD', workspacePath);
  if (!branch) {
    return {
      available: false,
      branch: null,
      latestCommit: null,
      latestMessage: null,
      latestAuthor: null,
      latestDate: null,
      modifiedFiles: [],
      recentCommits: [],
      suggestedBranch: null,
    };
  }

  const [hash, message, author, date] = await Promise.all([
    git('log -1 --format=%H', workspacePath),
    git('log -1 --format=%s', workspacePath),
    git('log -1 --format=%an', workspacePath),
    git('log -1 --format=%ci', workspacePath),
  ]);

  // Modified/untracked files
  const statusOut = await git('status --short', workspacePath);
  const modifiedFiles = statusOut
    ? statusOut.split('\n').filter(Boolean).map((l) => l.slice(3).trim()).filter(Boolean)
    : [];

  // Recent commits (last 5)
  const logOut = await git('log -5 --format=%H%x09%s%x09%an%x09%ci', workspacePath);
  const recentCommits = logOut
    ? logOut.split('\n').filter(Boolean).map((line) => {
        const [h, m, a, d] = line.split('\t');
        return { hash: (h ?? '').slice(0, 12), message: m ?? '', author: a ?? '', date: d ?? '' };
      })
    : [];

  // Suggest a branch name based on investigation id
  const shortId = investigationId ? investigationId.replace(/[^a-z0-9]/g, '-').slice(0, 20) : 'fix';
  const suggestedBranch = `fix/fixflow-${shortId}`;

  return {
    available: true,
    branch,
    latestCommit: hash ? hash.slice(0, 12) : null,
    latestMessage: message,
    latestAuthor: author,
    latestDate: date,
    modifiedFiles,
    recentCommits,
    suggestedBranch,
  };
}
