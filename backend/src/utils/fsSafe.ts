import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { forbidden } from './errors.js';

/** Directories never walked, read or copied when snapshotting a project. */
const IGNORED_DIRS = new Set([
  '.git', 'node_modules', '.next', 'dist', 'build', 'out', 'coverage', '.turbo',
  '.cache', '.vite', '.idea', '.vscode', '.pytest_cache', '__pycache__', '.venv',
  'venv', '.DS_Store', 'tmp', '.fixflow',
]);

const IGNORED_FILES = new Set([
  '.DS_Store', 'Thumbs.db', 'npm-debug.log', 'yarn-error.log',
]);

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.pdf', '.zip', '.gz',
  '.tar', '.7z', '.exe', '.dll', '.so', '.dylib', '.mp4', '.mp3', '.wav', '.woff',
  '.woff2', '.ttf', '.eot', '.sqlite', '.db', '.class', '.jar', '.pyc',
]);

export const ANALYZABLE_EXT = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts',
  '.json', '.jsonc', '.sql', '.md', '.mdx', '.txt', '.yml', '.yaml',
  '.html', '.css', '.sh', '.py', '.rb', '.go', '.java', '.env',
]);

export function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name);
}

export function isIgnoredFile(name: string): boolean {
  return IGNORED_FILES.has(name) || name.endsWith('.d.ts');
}

export function isTextLike(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXT.has(ext)) return false;
  if (ANALYZABLE_EXT.has(ext)) return true;
  // Extensionless dotfiles such as .env, .eslintrc, .gitignore
  return path.basename(filePath).startsWith('.') || path.basename(filePath).startsWith('Dockerfile');
}

export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/** Throws unless `candidate` resolves inside `root`. Blocks ../ escapes and symlink tricks. */
export function assertInside(root: string, candidate: string): string {
  const rootResolved = path.resolve(root);
  const resolved = path.resolve(candidate);
  const rel = path.relative(rootResolved, resolved);
  if (rel === '') return resolved;
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw forbidden('Path escapes the allowed project directory', `${candidate} is outside ${rootResolved}`);
  }
  return resolved;
}

/** Joins under the project root and verifies containment. */
export function projectPath(root: string, ...segments: string[]): string {
  return assertInside(root, path.join(root, ...segments));
}

export interface WalkEntry {
  /** Path relative to the scan root, always POSIX-separated. */
  rel: string;
  abs: string;
  bytes: number;
}

export interface WalkResult {
  entries: WalkEntry[];
  truncated: boolean;
  totalBytes: number;
}

export async function walkProject(
  root: string,
  opts: { maxFiles?: number; includeAll?: boolean } = {},
): Promise<WalkResult> {
  const maxFiles = opts.maxFiles ?? config.maxFilesPerProject;
  const entries: WalkEntry[] = [];
  let totalBytes = 0;
  let truncated = false;

  const queue: string[] = [root];
  while (queue.length > 0) {
    const dir = queue.shift() as string;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable directory is skipped, not fatal
    }
    for (const dirent of dirents) {
      if (truncated) break;
      const abs = path.join(dir, dirent.name);
      if (dirent.isSymbolicLink()) {
        // Never follow symlinks: a link could point outside the project.
        continue;
      }
      if (dirent.isDirectory()) {
        if (isIgnoredDir(dirent.name)) continue;
        queue.push(abs);
        continue;
      }
      if (!dirent.isFile()) continue;
      if (!opts.includeAll && !isTextLike(abs)) continue;
      if (isIgnoredFile(dirent.name)) continue;
      let bytes = 0;
      try {
        bytes = (await fs.stat(abs)).size;
      } catch {
        continue;
      }
      if (bytes > config.maxFileBytes) continue;
      if (entries.length >= maxFiles) {
        truncated = true;
        break;
      }
      totalBytes += bytes;
      entries.push({ rel: toPosix(path.relative(root, abs)), abs, bytes });
    }
  }
  entries.sort((a, b) => a.rel.localeCompare(b.rel));
  return { entries, truncated, totalBytes };
}

const readCache = new Map<string, string>();

export async function readTextFile(abs: string): Promise<string> {
  const hit = readCache.get(abs);
  if (hit !== undefined) return hit;
  const raw = await fs.readFile(abs, 'utf8');
  readCache.set(abs, raw);
  return raw;
}

export function readTextFileSync(abs: string): string {
  const hit = readCache.get(abs);
  if (hit !== undefined) return hit;
  const raw = fsSync.readFileSync(abs, 'utf8');
  readCache.set(abs, raw);
  return raw;
}

export function clearReadCache(): void {
  readCache.clear();
}

export async function fileExists(abs: string): Promise<boolean> {
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

export function fileExistsSync(abs: string): boolean {
  return fsSync.existsSync(abs);
}

export async function readJson<T = unknown>(abs: string): Promise<T | null> {
  try {
    return JSON.parse(await readTextFile(abs)) as T;
  } catch {
    return null;
  }
}

export async function writeTextFile(abs: string, content: string): Promise<void> {
  assertInside(config.workspacesDir, abs);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  readCache.set(abs, content);
}

/**
 * Copies a project directory into a fresh directory, skipping ignored paths and
 * symlinks. Used to make the disposable per-investigation worktree.
 */
export async function copyProject(src: string, dest: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  await fs.mkdir(dest, { recursive: true });
  const queue: Array<{ from: string; to: string }> = [{ from: src, to: dest }];
  while (queue.length > 0) {
    const job = queue.shift() as { from: string; to: string };
    let dirents;
    try {
      dirents = await fs.readdir(job.from, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const dirent of dirents) {
      const from = path.join(job.from, dirent.name);
      const to = path.join(job.to, dirent.name);
      if (dirent.isSymbolicLink()) continue;
      if (dirent.isDirectory()) {
        if (isIgnoredDir(dirent.name)) continue;
        queue.push({ from, to });
        continue;
      }
      if (!dirent.isFile()) continue;
      if (isIgnoredFile(dirent.name)) continue;
      const stat = await fs.stat(from).catch(() => null);
      if (!stat || stat.size > config.maxFileBytes) continue;
      if (files >= config.maxFilesPerProject) break;
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
      files += 1;
      bytes += stat.size;
    }
  }
  return { files, bytes };
}
