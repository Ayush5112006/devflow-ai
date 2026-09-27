import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The FixFlow repository root (the directory holding the workspace package.json). */
export const ROOT_DIR = path.resolve(here, '..', '..');
export const BACKEND_DIR = path.resolve(here, '..');
export const DEMO_DIR = path.join(ROOT_DIR, 'demo');
export const WORKSPACES_DIR = path.join(ROOT_DIR, 'workspaces');
export const DATA_DIR = path.join(BACKEND_DIR, 'data');

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num('PORT', 4000),
  host: process.env.HOST ?? '127.0.0.1',
  dataDir: process.env.FIXFLOW_DATA_DIR ?? DATA_DIR,
  workspacesDir: process.env.FIXFLOW_WORKSPACES_DIR ?? WORKSPACES_DIR,
  demoDir: DEMO_DIR,
  repoRoot: ROOT_DIR,
  /** Hard ceiling for a single allow-listed command. */
  commandTimeoutMs: num('FIXFLOW_COMMAND_TIMEOUT_MS', 120_000),
  /** Never walk or read more than this many files from a target project. */
  maxFilesPerProject: num('FIXFLOW_MAX_FILES', 4_000),
  /** Bytes of a single file we are willing to hold in memory. */
  maxFileBytes: num('FIXFLOW_MAX_FILE_BYTES', 2 * 1024 * 1024),
  /** Optional, off by default. See docs/ARCHITECTURE.md. */
  llmUrl: process.env.FIXFLOW_LLM_URL ?? '',
  llmModel: process.env.FIXFLOW_LLM_MODEL ?? 'llama3.2',
  /** Cap on how many worker commands may run at the same time. */
  maxParallelCommands: num('FIXFLOW_MAX_PARALLEL_COMMANDS', 4),
  /** GitHub Integration configuration (optional) */
  githubToken: process.env.GITHUB_TOKEN ?? '',
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? '',
  githubApiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
} as const;

export const isLlmEnabled = (): boolean => config.llmUrl.length > 0;
export const isGithubConfigured = (): boolean => config.githubToken.trim().length > 0;
