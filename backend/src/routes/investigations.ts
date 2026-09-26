import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { investigationService } from '../investigations/investigationService.js';
import { pipelineFacts } from '../analysis/pipelineFacts.js';
import { loadDemoBugs, PROJECTS, resolveProjectPath } from '../repositories/demoCatalog.js';
import { badRequest } from '../utils/errors.js';
import { nowIso } from '../utils/time.js';
import { id as makeId } from '../utils/id.js';
import { getGitInfo } from '../utils/git.js';
import type { BugReport, EvidenceAttachment, Severity } from '../types/index.js';

export const router = Router();

/* ------------------------------------------------------------------ */
/* Projects                                                           */
/* ------------------------------------------------------------------ */

router.get('/projects', (_req, res) => {
  res.json({ projects: PROJECTS });
});

/* ------------------------------------------------------------------ */
/* Demo bugs                                                          */
/* ------------------------------------------------------------------ */

router.get('/demo/bugs', async (_req, res, next) => {
  try {
    const bugs = await loadDemoBugs();
    res.json({ bugs });
  } catch (err) {
    next(err);
  }
});

/**
 * What the platform actually is: the live agent registry, the real stage
 * list, which stages need a person, and durations measured from runs that
 * have already completed. The dashboard renders this instead of hardcoded
 * claims, so the numbers cannot silently drift from the implementation.
 */
router.get('/pipeline', (_req, res) => {
  res.json(pipelineFacts(investigationService.list()));
});

/* ------------------------------------------------------------------ */
/* Investigations                                                     */
/* ------------------------------------------------------------------ */

const BugReportSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  expectedBehavior: z.string().min(1).max(1000),
  actualBehavior: z.string().min(1).max(1000),
  reproSteps: z.array(z.string().max(300)).max(20).default([]),
  reproCommand: z.string().max(200).optional(),
  lastKnownGoodRef: z.string().max(100).optional(),
  reportedAt: z.string().optional(),
});

const CreateInvestigationSchema = z.object({
  projectId: z.string().min(1).max(100),
  bug: BugReportSchema,
  evidence: z.array(z.object({
    name: z.string().max(200),
    kind: z.enum(['log', 'stacktrace', 'http', 'doc', 'image', 'other']),
    content: z.string().max(200_000),
  })).max(20).default([]),
});

router.get('/investigations', (_req, res) => {
  const list = investigationService.list().map((inv) => ({
    id: inv.id,
    bug: { title: inv.bug.title, severity: inv.bug.severity },
    projectId: inv.projectId,
    projectName: inv.projectName,
    status: inv.status,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  }));
  res.json({ investigations: list });
});

router.post('/investigations', async (req, res, next) => {
  try {
    const body = CreateInvestigationSchema.parse(req.body);
    const { project, absPath } = resolveProjectPath(body.projectId);

    const bug: BugReport = {
      ...body.bug,
      reportedAt: body.bug.reportedAt ?? nowIso(),
    };

    const evidence: EvidenceAttachment[] = body.evidence.map((e) => ({
      id: makeId('att'),
      name: e.name,
      kind: e.kind,
      bytes: e.content.length,
      excerpt: e.content.slice(0, 50_000),
      addedAt: nowIso(),
    }));

    const inv = investigationService.create(bug, body.projectId, project.name, absPath, evidence);
    res.status(201).json({ investigation: inv });
  } catch (err) {
    next(err);
  }
});

router.get('/investigations/:id', (req, res, next) => {
  try {
    const inv = investigationService.get(req.params.id);
    if (!inv) return next(badRequest(`Investigation not found: ${req.params.id}`));
    res.json({ investigation: sanitizeInvestigation(inv) });
  } catch (err) {
    next(err);
  }
});

/* ---- Start (run the investigation workflow up to approval gate) ---- */
router.post('/investigations/:id/start', async (req, res, next) => {
  try {
    const inv = investigationService.get(req.params.id);
    if (!inv) return next(badRequest(`Investigation not found: ${req.params.id}`));
    // Fire-and-forget — the client listens on the SSE stream.
    void investigationService.run(req.params.id).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[investigation] ${req.params.id} run() rejected: ${msg}`);
    });
    res.json({ started: true });
  } catch (err) {
    next(err);
  }
});

/* ---- SSE event stream ---- */
router.get('/investigations/:id/stream', (req, res) => {
  const id = req.params.id;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const ping = setInterval(() => res.write(': ping\n\n'), 15_000);

  const unsub = investigationService.subscribe(id, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // Send current state immediately.
  const inv = investigationService.get(id);
  if (inv) {
    res.write(`data: ${JSON.stringify({ type: 'snapshot', investigationId: id, at: nowIso(), payload: sanitizeInvestigation(inv) })}\n\n`);
  }

  req.on('close', () => {
    clearInterval(ping);
    unsub();
  });
});

/* ---- Agent runs ---- */
router.get('/investigations/:id/agents', (req, res, next) => {
  try {
    const inv = investigationService.get(req.params.id);
    if (!inv) return next(badRequest(`Not found: ${req.params.id}`));
    res.json({ agents: inv.agents });
  } catch (err) { next(err); }
});

/* ---- Findings ---- */
router.get('/investigations/:id/findings', (req, res, next) => {
  try {
    const inv = investigationService.get(req.params.id);
    if (!inv) return next(badRequest(`Not found: ${req.params.id}`));
    res.json({ findings: inv.findings });
  } catch (err) { next(err); }
});

/* ---- Root cause ---- */
router.get('/investigations/:id/root-cause', (req, res, next) => {
  try {
    const inv = investigationService.get(req.params.id);
    if (!inv) return next(badRequest(`Not found: ${req.params.id}`));
    res.json({ rootCause: inv.rootCause });
  } catch (err) { next(err); }
});

/* ---- Change plan ---- */
router.get('/investigations/:id/change-plan', (req, res, next) => {
  try {
    const inv = investigationService.get(req.params.id);
    if (!inv) return next(badRequest(`Not found: ${req.params.id}`));
    res.json({ changePlan: inv.changePlan });
  } catch (err) { next(err); }
});

/* ---- Human approval ---- */
router.post('/investigations/:id/approve', async (req, res, next) => {
  try {
    const body = z.object({
      approvedBy: z.string().min(1).max(200).default('developer'),
      note: z.string().max(500).default(''),
    }).parse(req.body);

    const approval = await investigationService.approve(req.params.id, body.approvedBy, body.note);
    res.json({ approval });
  } catch (err) { next(err); }
});

/* ---- Implementation ---- */
router.post('/investigations/:id/implement', async (req, res, next) => {
  try {
    void investigationService.implement(req.params.id).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[investigation] ${req.params.id} implement() rejected: ${msg}`);
    });
    res.json({ started: true });
  } catch (err) { next(err); }
});

/* ---- Verification ---- */
router.get('/investigations/:id/verify', (req, res, next) => {
  try {
    const inv = investigationService.get(req.params.id);
    if (!inv) return next(badRequest(`Not found: ${req.params.id}`));
    res.json({ verification: inv.verification });
  } catch (err) { next(err); }
});

/* ---- Report ---- */
router.get('/investigations/:id/report', (req, res, next) => {
  try {
    const inv = investigationService.get(req.params.id);
    if (!inv) return next(badRequest(`Not found: ${req.params.id}`));
    res.json({ report: inv.report, metrics: inv.metrics });
  } catch (err) { next(err); }
});

/* ---- Demo quick-start ---- */
router.post('/investigations/demo/:bugId/quickstart', async (req, res, next) => {
  try {
    const bugId = req.params.bugId;
    const bugs = await loadDemoBugs();
    const demoBug = bugs.find((b) => b.id === bugId);
    if (!demoBug) return next(badRequest(`Unknown demo bug: ${bugId}`));

    const { project, absPath } = resolveProjectPath('insightboard');

    const evidence: EvidenceAttachment[] = demoBug.evidence.map((e) => ({
      id: makeId('att'),
      name: e.name,
      kind: e.kind,
      bytes: e.content.length,
      excerpt: e.content.slice(0, 50_000),
      addedAt: nowIso(),
    }));

    const inv = investigationService.create(demoBug.report, project.id, project.name, absPath, evidence);

    void investigationService.run(inv.id).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[demo] ${inv.id} run() rejected: ${msg}`);
    });

    res.status(201).json({ investigation: inv });
  } catch (err) { next(err); }
});

/* ---- Git information ---- */
router.get('/investigations/:id/git', async (req, res, next) => {
  try {
    const inv = investigationService.get(req.params.id);
    if (!inv) return next(badRequest(`Not found: ${req.params.id}`));
    const info = await getGitInfo(inv.workspacePath, inv.id);
    res.json({ git: info });
  } catch (err) { next(err); }
});

/* ---- Re-plan with feedback ---- */
router.post('/investigations/:id/replan', async (req, res, next) => {
  try {
    const { feedback } = z.object({ feedback: z.string().min(1).max(1000) }).parse(req.body);
    const inv = investigationService.get(req.params.id);
    if (!inv) return next(badRequest(`Not found: ${req.params.id}`));
    if (inv.status !== 'awaiting_approval') {
      return next(badRequest(`Investigation is not awaiting approval (state: ${inv.status})`));
    }
    // Record feedback and rebuild the change plan with the note attached.
    await investigationService.replan(req.params.id, feedback);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Strip the transient `index` and `expectations` fields before sending. */
function sanitizeInvestigation(inv: object): object {
  const { index, expectations, signals, ...rest } = inv as any;
  return rest;
}
