/**
 * /api/integrations — GitHub status, webhook receiver.
 *
 * SECURITY RULES:
 * - GITHUB_TOKEN is never returned to the frontend.
 * - Webhook endpoint validates X-Hub-Signature-256 before processing.
 * - Webhook secret is read only from GITHUB_WEBHOOK_SECRET env var.
 * - Payloads are stored in memory with a cap of 200 events.
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { verifyGitHubToken, listGitHubRepos, isGitHubConfigured } from '../services/githubService.js';
import { repositoryStore } from '../repositories/repositoryStore.js';
import { badRequest, forbidden } from '../utils/errors.js';
import { nowIso } from '../utils/time.js';
import { id as makeId } from '../utils/id.js';
import { createLogger } from '../utils/logger.js';
import type { WebhookEvent } from '../types/index.js';

const log = createLogger('integrations-route');

export const integrationsRouter = Router();

/* ------------------------------------------------------------------ */
/* In-memory webhook event store (capped at 200)                      */
/* ------------------------------------------------------------------ */

const webhookEvents: WebhookEvent[] = [];

function storeWebhookEvent(event: WebhookEvent): void {
  webhookEvents.unshift(event);
  if (webhookEvents.length > 200) webhookEvents.length = 200;
}

/* ------------------------------------------------------------------ */
/* GitHub connection status                                           */
/* ------------------------------------------------------------------ */

integrationsRouter.get('/github/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await verifyGitHubToken();
    // NEVER include the token itself in the response
    res.json({ github: status });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* List GitHub repositories accessible to the token                   */
/* ------------------------------------------------------------------ */

integrationsRouter.get('/github/repos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isGitHubConfigured()) {
      res.status(200).json({
        repos: [],
        error: 'GitHub integration is not configured. Set the GITHUB_TOKEN environment variable.',
      });
      return;
    }

    const type = req.query.type === 'public' ? 'public' : req.query.type === 'private' ? 'private' : 'all';
    const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.per_page ?? '30'), 10)));

    const { repos, error } = await listGitHubRepos({ type, perPage });
    res.json({ repos, error });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Import a GitHub repository from the accessible list                */
/* ------------------------------------------------------------------ */

const ImportSchema = z.object({
  fullName: z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, 'Must be owner/name format'),
});

integrationsRouter.post('/github/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isGitHubConfigured()) {
      throw badRequest('GitHub integration is not configured. Set the GITHUB_TOKEN environment variable.');
    }

    const { fullName } = ImportSchema.parse(req.body);

    // Check not already imported
    const existing = repositoryStore.list().find((r) => r.fullName === fullName && r.provider === 'github');
    if (existing) {
      res.json({ repository: existing, alreadyExists: true });
      return;
    }

    const { getGitHubRepo } = await import('../services/githubService.js');
    const { repo: ghRepo, error } = await getGitHubRepo(fullName);
    if (error || !ghRepo) {
      throw badRequest(error ?? `GitHub repository not found: ${fullName}`);
    }

    const repo = repositoryStore.upsert({
      name: ghRepo.name ?? fullName.split('/')[1] ?? fullName,
      description: ghRepo.description ?? '',
      provider: 'github',
      path: fullName,
      owner: ghRepo.owner ?? fullName.split('/')[0] ?? null,
      fullName,
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
      lastSyncAt: nowIso(),
      syncStatus: 'synced',
      syncError: null,
    });

    res.status(201).json({ repository: repo });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Webhook events list (for UI display)                               */
/* ------------------------------------------------------------------ */

integrationsRouter.get('/github/webhook/events', (_req: Request, res: Response) => {
  res.json({ events: webhookEvents.slice(0, 50) });
});

/* ------------------------------------------------------------------ */
/* Webhook setup instructions                                          */
/* ------------------------------------------------------------------ */

integrationsRouter.get('/github/webhook/config', (req: Request, res: Response) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const configured = !!(secret && secret.length > 8);
  const host = req.headers.host ?? 'your-server-host';
  const proto = req.headers['x-forwarded-proto'] ?? 'http';

  res.json({
    configured,
    webhookUrl: `${proto}://${host}/api/integrations/github/webhook`,
    secretConfigured: configured,
    // NEVER include the secret value itself
    supportedEvents: ['push', 'issues', 'pull_request'],
    instructions: configured
      ? 'Webhook secret is configured. Set this URL in your GitHub repository webhook settings.'
      : 'Set GITHUB_WEBHOOK_SECRET environment variable, then configure this URL in GitHub webhook settings.',
  });
});

/* ------------------------------------------------------------------ */
/* Webhook receiver (POST /api/integrations/github/webhook)           */
/* ------------------------------------------------------------------ */

/**
 * Validates the GitHub webhook signature.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function validateWebhookSignature(secret: string, body: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  if (!signature.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'ascii'), Buffer.from(signature, 'ascii'));
  } catch {
    return false;
  }
}

// This route uses raw body parsing — must be registered before json middleware intercepts it.
// The server.ts mounts this route BEFORE the generic JSON body parser.
integrationsRouter.post(
  '/github/webhook',
  (req: Request, res: Response, next: NextFunction) => {
    // Collect raw body
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      (req as any).rawBody = Buffer.concat(chunks);
      next();
    });
    req.on('error', next);
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawBody: Buffer = (req as any).rawBody ?? Buffer.alloc(0);
      const secret = process.env.GITHUB_WEBHOOK_SECRET;

      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      const eventType = req.headers['x-github-event'] as string | undefined;
      const deliveryId = req.headers['x-github-delivery'] as string | undefined;

      // If a secret is configured, REJECT any request that fails verification
      if (secret && secret.length > 8) {
        if (!validateWebhookSignature(secret, rawBody, signature)) {
          log.warn(`Webhook signature validation failed (delivery: ${deliveryId})`);
          res.status(401).json({ error: 'Invalid webhook signature' });
          return;
        }
      } else {
        // No secret configured — warn but process (dev convenience only)
        log.warn('GITHUB_WEBHOOK_SECRET is not set — accepting webhook without verification');
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch {
        res.status(400).json({ error: 'Invalid JSON payload' });
        return;
      }

      const repoName = (payload.repository as any)?.full_name ?? 'unknown';
      const action = typeof payload.action === 'string' ? payload.action : null;

      const event: WebhookEvent = {
        id: makeId('wh'),
        provider: 'github',
        event: eventType ?? 'unknown',
        action,
        repositoryFullName: repoName,
        payload,
        receivedAt: nowIso(),
        verified: !!(secret && secret.length > 8),
        investigationTriggered: false,
      };

      storeWebhookEvent(event);
      log.info(`Webhook received: ${eventType} (${action}) from ${repoName}`);

      // Update repository open_issues if this is an issues event
      if (eventType === 'issues' && repoName !== 'unknown') {
        const repo = repositoryStore.list().find((r) => r.fullName === repoName);
        if (repo && typeof (payload.issue as any)?.state === 'string') {
          // Trigger a sync in the background (don't block the response)
          void (async () => {
            try {
              const { getGitHubRepo } = await import('../services/githubService.js');
              const { repo: fresh } = await getGitHubRepo(repoName);
              if (fresh) {
                repositoryStore.patch(repo.id, {
                  openIssues: fresh.openIssues ?? repo.openIssues,
                  openPRs: fresh.openPRs ?? repo.openPRs,
                });
              }
            } catch { /* non-critical */ }
          })();
        }
      }

      res.status(200).json({ ok: true, event: event.id });
    } catch (err) {
      next(err);
    }
  },
);
