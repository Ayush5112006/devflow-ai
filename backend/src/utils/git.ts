/**
 * Lightweight Git information helpers.
 * Uses only read-only git commands from the allowed programs list.
 * All user-supplied values (paths, branch names) are validated before use.
 */
import { tryRun } from './exec.js';
import type {
  DetailedGitStatus,
  GitStatusFile,
  RepositoryBranch,
  RepositoryCommit,
  RepositoryCommitDetail,
  GitFileEntry,
} from '../types/index.js';

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

/** Safe branch-name pattern — no shell metacharacters, no path traversal. */
const SAFE_REF = /^[a-zA-Z0-9._\-/]{1,200}$/;

export function assertSafeRef(ref: string): string {
  if (!SAFE_REF.test(ref)) throw new Error(`Unsafe git ref: ${ref}`);
  return ref;
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

/** Returns detailed git status with staged/unstaged breakdown. */
export async function getDetailedGitStatus(cwd: string): Promise<DetailedGitStatus> {
  const branch = await git('rev-parse --abbrev-ref HEAD', cwd);
  if (!branch) {
    return {
      available: false,
      branch: null,
      remoteBranch: null,
      ahead: 0,
      behind: 0,
      clean: true,
      files: [],
      latestCommit: null,
      latestMessage: null,
      latestAuthor: null,
      latestDate: null,
      recentCommits: [],
    };
  }

  const [hash, message, author, date, porcelain, remoteBranchRaw] = await Promise.all([
    git('log -1 --format=%H', cwd),
    git('log -1 --format=%s', cwd),
    git('log -1 --format=%an', cwd),
    git('log -1 --format=%ci', cwd),
    git('status --porcelain', cwd),
    git('rev-parse --abbrev-ref --symbolic-full-name @{u}', cwd),
  ]);

  const files: GitStatusFile[] = [];
  if (porcelain) {
    for (const line of porcelain.split('\n').filter(Boolean)) {
      const staged = line[0] !== ' ' && line[0] !== '?';
      const unstaged = line[1] !== ' ';
      const rawStatus = line[0] === '?' ? '?' : staged ? line[0] : line[1];
      const filePath = line.slice(3).trim().split(' -> ').pop() ?? '';
      if (filePath) {
        files.push({
          path: filePath,
          status: rawStatus as GitStatusFile['status'],
          staged: staged && line[0] !== '?',
        });
        // If a file has both staged and unstaged changes, add it twice
        if (staged && unstaged && line[0] !== '?') {
          files.push({ path: filePath, status: line[1] as GitStatusFile['status'], staged: false });
        }
      }
    }
  }

  // Ahead / behind relative to the upstream
  let ahead = 0;
  let behind = 0;
  if (remoteBranchRaw) {
    const aheadRaw = await git(`rev-list --count ${remoteBranchRaw}..HEAD`, cwd);
    const behindRaw = await git(`rev-list --count HEAD..${remoteBranchRaw}`, cwd);
    ahead = parseInt(aheadRaw ?? '0', 10) || 0;
    behind = parseInt(behindRaw ?? '0', 10) || 0;
  }

  const logOut = await git('log -10 --format=%H%x09%s%x09%an%x09%ci', cwd);
  const recentCommits = logOut
    ? logOut.split('\n').filter(Boolean).map((line) => {
        const [h, m, a, d] = line.split('\t');
        return { hash: (h ?? '').slice(0, 12), message: m ?? '', author: a ?? '', date: d ?? '' };
      })
    : [];

  return {
    available: true,
    branch,
    remoteBranch: remoteBranchRaw,
    ahead,
    behind,
    clean: files.length === 0,
    files,
    latestCommit: hash ? hash.slice(0, 12) : null,
    latestMessage: message,
    latestAuthor: author,
    latestDate: date,
    recentCommits,
  };
}

/** Returns the list of local branches. */
export async function getGitBranches(cwd: string, defaultBranch: string): Promise<RepositoryBranch[]> {
  // Format: refname:short | objectname:short | subject | authordateshort | authorname
  const raw = await git(
    'branch -a --format=%(refname:short)%x09%(objectname:short)%x09%(subject)%x09%(authordate:iso-strict)%x09%(authorname)%x09%(HEAD)',
    cwd,
  );
  if (!raw) return [];

  const branches: RepositoryBranch[] = [];
  for (const line of raw.split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    const name = parts[0]?.trim() ?? '';
    const sha = parts[1]?.trim() ?? '';
    const subject = parts[2]?.trim() ?? '';
    const dateStr = parts[3]?.trim() ?? '';
    const authorName = parts[4]?.trim() ?? '';

    // Skip remote-tracking branches from the local list (those start with "remotes/")
    if (name.startsWith('remotes/')) continue;
    if (!name) continue;

    branches.push({
      name,
      sha: sha.slice(0, 12),
      isDefault: name === defaultBranch,
      isProtected: name === defaultBranch || name === 'main' || name === 'master',
      lastCommitMessage: subject || null,
      lastCommitAt: dateStr || null,
      lastCommitAuthor: authorName || null,
      ahead: 0,
      behind: 0,
    });
  }

  return branches;
}

/** Returns paginated commit history. */
export async function getGitCommits(
  cwd: string,
  opts: { limit?: number; skip?: number; branch?: string } = {},
): Promise<RepositoryCommit[]> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const skip = opts.skip ?? 0;
  const branch = opts.branch ? assertSafeRef(opts.branch) : 'HEAD';

  // Format: hash | subject | author | author-email | date | numstat-summary
  const raw = await git(
    `log ${branch} --skip=${skip} -${limit} --format=%H%x09%s%x09%an%x09%ae%x09%ci --shortstat`,
    cwd,
  );
  if (!raw) return [];

  const commits: RepositoryCommit[] = [];
  // git log with --shortstat produces blocks:
  // <hash>\t<subject>\t<author>\t<email>\t<date>
  //  1 file changed, X insertions(+), Y deletions(-)
  const blocks = raw.split('\n\n').filter(Boolean);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const headerLine = lines[0];
    const statLine = lines[1]?.trim() ?? '';

    const parts = headerLine?.split('\t') ?? [];
    const sha = parts[0]?.trim() ?? '';
    if (!sha) continue;

    let filesChanged = 0;
    let additions = 0;
    let deletions = 0;
    const filesMatch = statLine.match(/(\d+) file/);
    const addMatch = statLine.match(/(\d+) insertion/);
    const delMatch = statLine.match(/(\d+) deletion/);
    if (filesMatch) filesChanged = parseInt(filesMatch[1], 10);
    if (addMatch) additions = parseInt(addMatch[1], 10);
    if (delMatch) deletions = parseInt(delMatch[1], 10);

    commits.push({
      sha: sha.slice(0, 40),
      shortSha: sha.slice(0, 8),
      message: parts[1]?.trim() ?? '',
      author: parts[2]?.trim() ?? '',
      authorEmail: parts[3]?.trim() ?? '',
      date: parts[4]?.trim() ?? '',
      filesChanged,
      additions,
      deletions,
      parents: [],
    });
  }
  return commits;
}

/** Returns commit detail including diff. */
export async function getGitCommitDetail(cwd: string, sha: string): Promise<RepositoryCommitDetail | null> {
  const safeSha = assertSafeRef(sha);

  const headerRaw = await git(
    `show --format=%H%x09%s%x09%an%x09%ae%x09%ci%x09%P -s ${safeSha}`,
    cwd,
  );
  if (!headerRaw) return null;

  const parts = headerRaw.split('\t');
  const fullSha = parts[0]?.trim() ?? safeSha;
  const parents = parts[5]?.trim().split(' ').filter(Boolean) ?? [];

  const diffRaw = await git(`show --stat --patch ${safeSha}`, cwd);
  const diff = diffRaw ?? '';

  // Parse file stats from diff
  const files: RepositoryCommitDetail['files'] = [];
  const diffSections = diff.split(/^diff --git /m).slice(1);
  for (const section of diffSections) {
    const fileMatch = section.match(/^a\/(.+?) b\/(.+?)$/m);
    const filename = fileMatch ? fileMatch[2] : '';
    if (!filename) continue;
    const addMatch = section.match(/^\+\+\+ /m) ? (section.match(/^@@ .+? @@/gm) ?? []).length : 0;
    const adds = (section.match(/^\+(?!\+\+)/gm) ?? []).length;
    const dels = (section.match(/^-(?!--)/gm) ?? []).length;
    files.push({
      filename,
      status: 'modified',
      additions: adds,
      deletions: dels,
      patch: section.slice(0, 5000),
    });
  }

  const shortStat = await git(`show --stat --no-patch ${safeSha}`, cwd);
  const filesMatch = shortStat?.match(/(\d+) file/);
  const addMatch = shortStat?.match(/(\d+) insertion/);
  const delMatch = shortStat?.match(/(\d+) deletion/);

  return {
    sha: fullSha,
    shortSha: fullSha.slice(0, 8),
    message: parts[1]?.trim() ?? '',
    author: parts[2]?.trim() ?? '',
    authorEmail: parts[3]?.trim() ?? '',
    date: parts[4]?.trim() ?? '',
    filesChanged: filesMatch ? parseInt(filesMatch[1], 10) : files.length,
    additions: addMatch ? parseInt(addMatch[1], 10) : 0,
    deletions: delMatch ? parseInt(delMatch[1], 10) : 0,
    parents,
    diff: diff.slice(0, 50_000),
    files,
  };
}

/** Language detection from file extension. */
const EXT_TO_LANG: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
  mjs: 'JavaScript', cjs: 'JavaScript', py: 'Python', go: 'Go', rs: 'Rust',
  java: 'Java', kt: 'Kotlin', cs: 'C#', cpp: 'C++', c: 'C', rb: 'Ruby',
  php: 'PHP', swift: 'Swift', sql: 'SQL', sh: 'Shell', bash: 'Shell',
  zsh: 'Shell', yml: 'YAML', yaml: 'YAML', json: 'JSON', md: 'Markdown',
  html: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'SASS', toml: 'TOML',
  xml: 'XML', env: 'Env',
};

export function detectLanguage(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_LANG[ext] ?? null;
}

/** Build a file-tree list from the local git working tree. */
export async function getGitFileTree(
  cwd: string,
  subpath: string = '',
): Promise<GitFileEntry[]> {
  // Use git ls-tree which is safe (no shell injection possible with the fixed args)
  const target = subpath ? assertSafeRef(subpath) : 'HEAD';
  const raw = await git(`ls-tree -r --name-only --full-tree ${target}`, cwd);
  if (!raw) {
    // Fallback: if not a full git repo snapshot, return nothing
    return [];
  }

  const allPaths = raw.split('\n').filter(Boolean);

  // Filter to the subpath if given
  const prefix = subpath ? subpath.replace(/^\//, '') + '/' : '';
  const filtered = prefix
    ? allPaths.filter((p) => p.startsWith(prefix))
    : allPaths;

  const entries: GitFileEntry[] = [];
  const seenDirs = new Set<string>();

  for (const filePath of filtered) {
    const relative = prefix ? filePath.slice(prefix.length) : filePath;
    const parts = relative.split('/');

    if (parts.length > 1) {
      // This is a file in a subdirectory — emit the directory entry
      const dirName = parts[0];
      const dirPath = prefix + dirName;
      if (!seenDirs.has(dirPath)) {
        seenDirs.add(dirPath);
        entries.push({ path: dirPath, name: dirName, type: 'dir', size: 0, language: null });
      }
    } else {
      // Top-level file in this directory
      const name = parts[0];
      entries.push({
        path: filePath,
        name,
        type: 'file',
        size: 0,
        language: detectLanguage(name),
      });
    }
  }

  return entries;
}
