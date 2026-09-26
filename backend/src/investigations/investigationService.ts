import type {
  ActivityEntry, AgentRun, Approval, Investigation, InvestigationEvent, InvestigationStatus,
  ProjectMap, StageId, StageTiming,
} from '../types/index.js';
import { id as makeId } from '../utils/id.js';
import { nowIso, elapsedSince } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';
import { buildCodeIndex, buildProjectMap } from '../analysis/codeIndex.js';
import { deriveExpectations } from '../analysis/expectations.js';
import { clearReadCache } from '../utils/fsSafe.js';
import { managerAgent } from '../agents/manager/managerAgent.js';
import { runRootCauseEngine } from '../agents/rootCause/rootCauseAgent.js';
import { generateChangePlan } from '../agents/rootCause/changePlan.js';
import { runImplementationAgent } from '../agents/implementation/implementationAgent.js';
import { runVerificationAgent } from '../agents/verification/verificationAgent.js';
import { runRegressionAgent } from '../agents/regression/regressionAgent.js';
import { generateReport, computeMetrics } from '../agents/reporting/reportingAgent.js';
import type { AgentDefinition } from '../agents/types.js';

const log = createLogger('investigation-service');

type AnyEvent = { type: string; investigationId: string; at: string; payload: unknown };
type EventEmitter = (event: AnyEvent) => void;

/**
 * InvestigationService
 * ─────────────────────
 * The application layer between the HTTP routes and the agent system.
 * It owns the in-memory state of each investigation and emits structured
 * events for the SSE stream.
 *
 * Design invariant: all mutation goes through this service so that the
 * state machine is never partially updated.
 */
export class InvestigationService {
  private readonly investigations = new Map<string, Investigation>();
  private readonly listeners = new Map<string, Set<EventEmitter>>();

  constructor() {}

  /* ------------------------------------------------------------------ */
  /* CRUD                                                               */
  /* ------------------------------------------------------------------ */

  create(
    bug: Investigation['bug'],
    projectId: string,
    projectName: string,
    workspacePath: string,
    evidence: Investigation['evidence'],
  ): Investigation {
    const inv = emptyInvestigation(bug, projectId, projectName, workspacePath, evidence);
    this.investigations.set(inv.id, inv);
    log.info(`Created investigation ${inv.id} — ${bug.title}`);
    return inv;
  }

  get(id: string): Investigation | undefined {
    return this.investigations.get(id);
  }

  list(): Investigation[] {
    return [...this.investigations.values()].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  }

  /* ------------------------------------------------------------------ */
  /* Workflow execution                                                 */
  /* ------------------------------------------------------------------ */

  async run(id: string): Promise<void> {
    const inv = this.getOrThrow(id);
    if (inv.status !== 'draft') {
      throw new Error(`Investigation ${id} is already in state ${inv.status}`);
    }

    this.transition(inv, 'investigating');
    this.emit(inv, 'investigation.updated', { status: 'investigating', projectId: inv.projectId });
    this.activity(inv, 'manager', 'info', 'Manager Agent started investigation');

    try {
      await this.stageProjectAnalysis(inv);
      await this.stageInvestigation(inv);
      await this.stageRootCause(inv);
      await this.stageChangePlan(inv);
      // Workflow pauses here until human approval.
      this.transition(inv, 'awaiting_approval');
      this.emit(inv, 'plan.updated', { status: 'awaiting_approval', planHash: inv.changePlan?.planHash });
      this.activity(inv, 'manager', 'info', 'Awaiting human approval of the change plan');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Investigation ${id} failed in investigation phase: ${msg}`);
      inv.errors.push({ message: msg, blocking: true });
      this.transition(inv, 'failed');
      this.emit(inv, 'error', { error: msg, status: 'failed' });
    }
  }

  async approve(id: string, approvedBy: string, note: string): Promise<Approval> {
    const inv = this.getOrThrow(id);
    if (!inv.changePlan) throw new Error('No change plan to approve');
    if (inv.status !== 'awaiting_approval') {
      throw new Error(`Investigation ${id} is not awaiting approval (state: ${inv.status})`);
    }

    const approval: Approval = {
      id: makeId('apr'),
      planHash: inv.changePlan.planHash,
      approvedBy,
      approvedAt: nowIso(),
      note,
      planSnapshot: inv.changePlan,
    };
    inv.approval = approval;
    // `InvestigationStatus` has no separate `approved` value: once the plan is
    // approved the next state is implementation.
    this.transition(inv, 'implementing');
    this.emit(inv, 'approval.updated', { approvedBy, planHash: approval.planHash });
    this.activity(inv, 'manager', 'success', `Change plan approved by ${approvedBy}`);
    log.info(`Investigation ${id} approved by ${approvedBy}`);
    return approval;
  }

  /**
   * Regenerate the change plan with developer feedback incorporated.
   * Only allowed when awaiting_approval. Does not restart the full investigation.
   */
  async replan(id: string, feedback: string): Promise<void> {
    const inv = this.getOrThrow(id);
    if (inv.status !== 'awaiting_approval') {
      throw new Error(`Investigation ${id} is not awaiting approval (state: ${inv.status})`);
    }
    this.activity(inv, 'manager', 'info', `Developer requested plan changes: "${feedback.slice(0, 120)}"`);
    const index = (inv as any).index;
    const expectations = (inv as any).expectations;
    if (!index || !expectations) {
      throw new Error('Project index not available for replan — cannot regenerate plan without analysis context.');
    }
    this.startStage(inv, 'changePlan');
    inv.changePlan = generateChangePlan({
      investigationId: inv.id,
      rootCause: inv.rootCause!,
      index,
      expectations,
    });
    // Attach feedback as a "considered and rejected" note so it's visible in the UI
    inv.changePlan.consideredAndRejected.unshift({
      statement: `Developer feedback: "${feedback}"`,
      why: 'Plan regenerated with this feedback in mind. Review the new changes above.',
    });
    this.finishStage(inv, 'changePlan');
    this.activity(inv, 'manager', 'success', `Change plan regenerated with ${inv.changePlan.changes.length} change(s)`);
    this.emit(inv, 'plan.updated', { changePlan: inv.changePlan, status: 'ready' });
  }

  async implement(id: string): Promise<void> {
    const inv = this.getOrThrow(id);
    if (!inv.approval) throw new Error('No approval record');
    if (inv.approval.planHash !== inv.changePlan?.planHash) {
      throw new Error('Plan hash mismatch — the approved plan does not match the current plan');
    }
    if (inv.status !== 'implementing') {
      throw new Error(`Investigation ${id} is not ready to implement (state: ${inv.status})`);
    }

    try {
      await this.stageImplementation(inv);
      await this.stageVerification(inv);
      await this.stageRegression(inv);
      await this.stageReport(inv);
      this.transition(inv, 'completed');
      this.emit(inv, 'investigation.updated', { status: 'completed' });
      this.activity(inv, 'manager', 'success', 'Investigation completed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Investigation ${id} failed in post-approval phase: ${msg}`);
      inv.errors.push({ message: msg, blocking: true });
      this.transition(inv, 'failed');
      this.emit(inv, 'error', { error: msg, status: 'failed' });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Stages                                                             */
  /* ------------------------------------------------------------------ */

  private async stageProjectAnalysis(inv: Investigation): Promise<void> {
    this.startStage(inv, 'projectAnalysis');
    this.activity(inv, 'manager', 'info', `Indexing ${inv.workspacePath}`);
    clearReadCache();
    const index = await buildCodeIndex(inv.workspacePath);
    (inv as any).index = index; // transient, not in the JSON shape
    inv.projectMap = buildProjectMap(index);
    this.activity(inv, 'manager', 'success',
      `Project indexed: ${index.fileCount} files, ${index.routes.length} routes, ${index.tables.length} tables`);
    this.emit(inv, 'investigation.updated', { projectMap: inv.projectMap });
    this.finishStage(inv, 'projectAnalysis');
  }

  private async stageInvestigation(inv: Investigation): Promise<void> {
    this.startStage(inv, 'investigation');
    const index = (inv as any).index;
    const expectations = deriveExpectations(inv.evidence);
    (inv as any).expectations = expectations;

    const ctx = {
      investigationId: inv.id,
      workspacePath: inv.workspacePath,
      index,
      expectations,
      bug: inv.bug,
      evidence: inv.evidence,
      note: (msg: string) => this.activity(inv, 'manager', 'info', msg),
    };

    this.activity(inv, 'manager', 'info', 'Launching parallel investigation agents');
    const { runs, findings, signals } = await managerAgent.investigate(ctx, {
      onAgentStart: (def: AgentDefinition) => {
        this.updateAgent(inv, def.id, 'running');
        this.emit(inv, 'agent.started', { agent: def.id });
        this.activity(inv, def.id, 'info', `${def.title} started`);
      },
      onAgentNote: (def: AgentDefinition, message: string) => {
        this.activity(inv, def.id, 'info', message);
      },
      onAgentFinish: (run: AgentRun) => {
        this.updateAgent(inv, run.agent, run.status, run);
        this.emit(inv, 'agent.finished', { agent: run.agent, status: run.status });
        const level = run.status === 'failed' ? 'error' : 'success';
        this.activity(inv, run.agent, level,
          `${run.title}: ${run.status} (${run.findingCount} finding(s), ${run.signalCount} signal(s), ${run.durationMs}ms)`);
      },
    });

    inv.findings = findings;
    (inv as any).signals = signals;
    inv.agents = runs;

    const { blocked, reasons } = managerAgent.assessBlocking(runs);
    if (blocked) {
      throw new Error(`Investigation blocked: ${reasons.join('; ')}`);
    }

    this.emit(inv, 'findings.updated', { count: findings.length });
    this.finishStage(inv, 'investigation');
  }

  private async stageRootCause(inv: Investigation): Promise<void> {
    this.startStage(inv, 'rootCause');
    this.activity(inv, 'manager', 'info', 'Root Cause Agent: correlating signals');
    const index = (inv as any).index;
    const expectations = (inv as any).expectations;
    const signals = (inv as any).signals ?? [];

    const ctx = {
      investigationId: inv.id,
      workspacePath: inv.workspacePath,
      index,
      expectations,
      bug: inv.bug,
      evidence: inv.evidence,
      note: (msg: string) => this.activity(inv, 'manager', 'info', msg),
    };

    const { rootCause, finding } = await runRootCauseEngine(ctx, signals, inv.findings);
    inv.rootCause = rootCause;
    inv.findings.push(finding);
    this.activity(inv, 'manager', 'success',
      `Root cause identified (confidence ${(rootCause.confidence * 100).toFixed(0)}%): ${rootCause.statement.slice(0, 120)}`);
    this.emit(inv, 'rootcause.updated', { rootCause });
    this.finishStage(inv, 'rootCause');
  }

  private async stageChangePlan(inv: Investigation): Promise<void> {
    this.startStage(inv, 'changePlan');
    this.activity(inv, 'manager', 'info', 'Generating change plan');
    const index = (inv as any).index;
    const expectations = (inv as any).expectations;

    inv.changePlan = generateChangePlan({
      investigationId: inv.id,
      rootCause: inv.rootCause!,
      index,
      expectations,
    });
    this.activity(inv, 'manager', 'success',
      `Change plan ready: ${inv.changePlan.changes.length} change(s)`);
    this.emit(inv, 'plan.updated', { changePlan: inv.changePlan, status: 'ready' });
    this.finishStage(inv, 'changePlan');
  }

  private async stageImplementation(inv: Investigation): Promise<void> {
    this.startStage(inv, 'implementation');
    this.activity(inv, 'manager', 'info', 'Implementation Agent: applying changes');
    const index = (inv as any).index;

    inv.implementation = await runImplementationAgent(inv.workspacePath, inv.approval!, index);
    this.activity(inv, 'manager',
      inv.implementation.status === 'completed' ? 'success' : 'warn',
      `Implementation ${inv.implementation.status}: ${inv.implementation.diffStat}`);
    this.emit(inv, 'implementation.updated', { implementation: inv.implementation });
    this.finishStage(inv, 'implementation');
  }

  private async stageVerification(inv: Investigation): Promise<void> {
    this.startStage(inv, 'verification');
    this.activity(inv, 'manager', 'info', 'Verification Agent: running checks');
    const index = (inv as any).index;
    const expectations = (inv as any).expectations;

    const ctx = {
      investigationId: inv.id,
      workspacePath: inv.workspacePath,
      index,
      expectations,
      bug: inv.bug,
      evidence: inv.evidence,
      note: (msg: string) => this.activity(inv, 'manager', 'info', msg),
    };

    inv.verification = await runVerificationAgent(ctx, inv.implementation!);
    this.activity(inv, 'manager',
      inv.verification.status === 'passed' ? 'success' : 'warn',
      `Verification ${inv.verification.status}: ${inv.verification.summary}`);
    this.emit(inv, 'verification.updated', { verification: inv.verification });
    this.finishStage(inv, 'verification');
  }

  private async stageRegression(inv: Investigation): Promise<void> {
    this.startStage(inv, 'regression');
    this.activity(inv, 'manager', 'info', 'Regression Agent: analysing impact');
    const index = (inv as any).index;
    const expectations = (inv as any).expectations;

    const ctx = {
      investigationId: inv.id,
      workspacePath: inv.workspacePath,
      index,
      expectations,
      bug: inv.bug,
      evidence: inv.evidence,
      note: (msg: string) => this.activity(inv, 'manager', 'info', msg),
    };

    inv.regression = await runRegressionAgent(ctx, inv.implementation!, inv.rootCause!);
    this.activity(inv, 'manager',
      inv.regression.status === 'clean' ? 'success' : 'warn',
      `Regression analysis: ${inv.regression.summary}`);
    this.emit(inv, 'regression.updated', { regression: inv.regression });
    this.finishStage(inv, 'regression');
  }

  private async stageReport(inv: Investigation): Promise<void> {
    this.startStage(inv, 'report');
    this.activity(inv, 'manager', 'info', 'Generating final engineering report');
    inv.report = generateReport(inv);
    inv.metrics = computeMetrics(inv);
    this.emit(inv, 'report.updated', { report: inv.report, metrics: inv.metrics });
    this.finishStage(inv, 'report');
  }

  /* ------------------------------------------------------------------ */
  /* SSE                                                               */
  /* ------------------------------------------------------------------ */

  subscribe(id: string, emitter: EventEmitter): () => void {
    if (!this.listeners.has(id)) this.listeners.set(id, new Set());
    this.listeners.get(id)!.add(emitter);
    return () => {
      this.listeners.get(id)?.delete(emitter);
    };
  }

  /* ------------------------------------------------------------------ */
  /* Internal helpers                                                  */
  /* ------------------------------------------------------------------ */

  private getOrThrow(id: string): Investigation {
    const inv = this.investigations.get(id);
    if (!inv) throw new Error(`Investigation ${id} not found`);
    return inv;
  }

  private transition(inv: Investigation, status: InvestigationStatus): void {
    inv.status = status;
    inv.updatedAt = nowIso();
    this.investigations.set(inv.id, inv);
  }

  private startStage(inv: Investigation, stage: StageId): void {
    const s: StageTiming = { stage, status: 'running', startedAt: nowIso(), durationMs: 0 };
    inv.stages[stage] = s;
    inv.updatedAt = nowIso();
  }

  private finishStage(inv: Investigation, stage: StageId): void {
    const s = inv.stages[stage];
    if (!s) return;
    s.status = 'completed';
    s.finishedAt = nowIso();
    s.durationMs = elapsedSince(s.startedAt);
    inv.updatedAt = nowIso();
  }

  private updateAgent(inv: Investigation, agentId: string, status: AgentRun['status'], run?: AgentRun): void {
    const existing = inv.agents.find((a) => a.agent === agentId);
    if (existing) {
      Object.assign(existing, run ?? { status });
    } else {
      inv.agents.push(run ?? {
        agent: agentId as any,
        title: agentId,
        status,
        findingCount: 0,
        signalCount: 0,
        notes: [],
      });
    }
  }

  private activity(inv: Investigation, agent: ActivityEntry['agent'], level: ActivityEntry['level'], message: string): void {
    const entry: ActivityEntry = {
      id: makeId('act'),
      at: nowIso(),
      agent,
      level,
      message,
    };
    // Keep the log on the investigation. Emitting it only reached clients that
    // happened to be connected, so reloading a finished investigation showed an
    // empty activity log and the audit trail was lost.
    inv.activity.unshift(entry);
    if (inv.activity.length > 200) inv.activity.length = 200;
    this.emit(inv, 'activity', { entry });
  }

  private emit(inv: Investigation, type: InvestigationEvent['type'], payload: unknown): void {
    const event: InvestigationEvent = {
      type,
      investigationId: inv.id,
      at: nowIso(),
      payload,
    };
    const listeners = this.listeners.get(inv.id);
    if (listeners) {
      for (const fn of listeners) fn(event);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Factory                                                            */
/* ------------------------------------------------------------------ */

function emptyStages(): Investigation['stages'] {
  const stageIds: StageId[] = [
    'projectAnalysis', 'investigation', 'rootCause', 'changePlan',
    'implementation', 'verification', 'regression', 'report',
  ];
  return Object.fromEntries(
    stageIds.map((s): [StageId, StageTiming] => [s, { stage: s, status: 'pending', durationMs: 0 }]),
  ) as Investigation['stages'];
}

function emptyInvestigation(
  bug: Investigation['bug'],
  projectId: string,
  projectName: string,
  workspacePath: string,
  evidence: Investigation['evidence'],
): Investigation {
  return {
    id: makeId('inv'),
    bug,
    projectId,
    projectName,
    workspacePath,
    evidence,
    status: 'draft',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    stages: emptyStages(),
    agents: [],
    projectMap: null,
    findings: [],
    rootCause: null,
    changePlan: null,
    approval: null,
    implementation: null,
    verification: null,
    regression: null,
    report: null,
    metrics: null,
    errors: [],
    activity: [],
  };
}

/** Singleton — every route handler imports the same instance. */
export const investigationService = new InvestigationService();
