import express from 'express';
import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { router } from './routes/investigations.js';
import { repositoriesRouter } from './routes/repositories.js';
<<<<<<< HEAD
import { integrationsRouter } from './routes/integrations.js';
=======
>>>>>>> origin/main
import { FixFlowError } from './utils/errors.js';
import { createLogger } from './utils/logger.js';
import { ensureWorkspaceRepository } from './repositories/repositoryStore.js';

const log = createLogger('server');

const app = express();

/* ------------------------------------------------------------------ */
/* Middleware                                                         */
/* ------------------------------------------------------------------ */

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    `http://localhost:${config.port}`,
    `http://127.0.0.1:${config.port}`,
  ],
  credentials: true,
}));

<<<<<<< HEAD
// Raw body capture for the webhook endpoint (must come BEFORE json middleware)
app.use('/api/integrations/github/webhook', (req, _res, next) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    (req as any).rawBody = Buffer.concat(chunks);
    next();
  });
  req.on('error', next);
});

// Parse JSON bodies, but not for SSE routes or the webhook endpoint.
app.use((req, _res, next) => {
  if (req.path.endsWith('/stream')) return next();
  if (req.path === '/api/integrations/github/webhook') return next();
  express.json({ limit: '5mb' })(req, _res, next);
=======
// Parse JSON bodies, keeping raw body buffer for webhook signature validation, not for SSE routes.
app.use((req, res, next) => {
  if (req.path.endsWith('/stream')) return next();
  express.json({
    limit: '5mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })(req, res, next);
>>>>>>> origin/main
});

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    uptime: Math.floor(process.uptime()),
  });
});

app.use('/api', router);
<<<<<<< HEAD
app.use('/api/repositories', repositoriesRouter);
app.use('/api/integrations', integrationsRouter);
=======
app.use('/api', repositoriesRouter);
>>>>>>> origin/main

/* ------------------------------------------------------------------ */
/* Error handling                                                     */
/* ------------------------------------------------------------------ */

// Zod validation errors.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err && typeof err === 'object' && (err as any).name === 'ZodError') {
    res.status(400).json({
      error: 'Validation error',
      code: 'validation_error',
      issues: (err as any).errors,
    });
    return;
  }
  next(err);
});

// FixFlow domain errors.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof FixFlowError) {
    res.status(err.status).json({ error: err.message, code: err.code, detail: err.detail });
    return;
  }
  next(err);
});

// Catch-all.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err);
  log.error(`Unhandled error on ${req.method} ${req.path}`, msg);
  res.status(500).json({ error: 'Internal server error', code: 'internal_error' });
});

/* ------------------------------------------------------------------ */
/* Start                                                              */
/* ------------------------------------------------------------------ */

// Ensure workspace repository is registered at startup
try {
  ensureWorkspaceRepository();
} catch (err) {
  log.warn('Could not register workspace repository', err instanceof Error ? err.message : String(err));
}

app.listen(config.port, config.host, () => {
  log.info(`FixFlow AI backend listening on http://${config.host}:${config.port}`);
});

export { app };
