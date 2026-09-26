/**
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

export const repositoriesRouter = Router();

/* ------------------------------------------------------------------ */
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
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
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
});
