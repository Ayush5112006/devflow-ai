import type {
  AgentError, AgentId, AgentRun, Evidence, EvidenceAttachment, Finding, Signal, StageId,
} from '../types/index.js';
import type { CodeIndex } from '../analysis/codeIndex.js';
import type { EvidenceExpectation } from '../analysis/expectations.js';
import { id as makeId } from '../utils/id.js';
import { nowIso } from '../utils/time.js';
import { toErrorPayload } from '../utils/errors.js';

/**
 * The contract every FixFlow agent implements.
 *
 * Rules encoded here rather than left to convention:
 *  - an agent receives a read-only `AgentContext` with the parsed project and
 *    the shared reading of the evidence,
 *  - it returns findings; it never writes to the repository,
 *  - throwing is safe: the orchestrator records the failure and keeps going.
 */
export interface AgentContext {
  investigationId: string;
  workspacePath: string;
  /** Parsed once by the Manager, shared read-only with every agent. */
  index: CodeIndex;
  /** Derived once from the evidence bundle, shared read-only. */
  expectations: EvidenceExpectation;
  bug: {
    title: string;
    description: string;
    severity: string;
    expectedBehavior: string;
    actualBehavior: string;
    reproSteps: string[];
    reproCommand?: string;
    lastKnownGoodRef?: string;
  };
  evidence: EvidenceAttachment[];
  /** Free-form note sink for the activity panel. */
  note(message: string): void;
}

export interface AgentResult {
  findings: Finding[];
  /** Agents may return signals without a finding when they are pure facts. */
  signals?: Signal[];
}

export interface AgentDefinition {
  id: AgentId;
  title: string;
  stage: StageId;
  /** Shown in the dashboard pipeline. */
  parallelGroup: 'investigation' | 'sequential';
  /** Whether a failure of this agent must halt the workflow. */
  blocking: boolean;
  /** Runs against a snapshot of evidence gathered by other agents. */
  run(ctx: AgentContext): Promise<AgentResult>;
}

/* ------------------------------------------------------------------ */
/* Constructors                                                        */
/* ------------------------------------------------------------------ */

export function evidence(input: Omit<Evidence, 'id'> & { id?: string }): Evidence {
  return { id: input.id ?? makeId('ev'), ...input };
}

export function signal(input: Omit<Signal, 'id'> & { id?: string }): Signal {
  return { id: input.id ?? makeId('sg'), ...input };
}

export function finding(input: Omit<Finding, 'id' | 'durationMs'> & { id?: string; durationMs?: number }): Finding {
  return { id: input.id ?? makeId('fnd'), durationMs: input.durationMs ?? 0, ...input };
}

export function emptyRun(agent: AgentId, title: string): AgentRun {
  return { agent, title, status: 'pending', findingCount: 0, signalCount: 0, notes: [] };
}

export function agentError(err: unknown, blocking: boolean): AgentError {
  const { message, detail } = toErrorPayload(err);
  return { message, detail, blocking };
}

/** Runs an agent, converting any throw into a recorded failure. */
export async function runAgentSafely(
  definition: AgentDefinition,
  ctx: AgentContext,
  hooks: {
    onStart(): void;
    onFinish(run: AgentRun): void;
  },
): Promise<{ run: AgentRun; result: AgentResult | null }> {
  const run: AgentRun = {
    agent: definition.id,
    title: definition.title,
    status: 'running',
    startedAt: nowIso(),
    findingCount: 0,
    signalCount: 0,
    notes: [],
  };
  hooks.onStart();
  const started = Date.now();
  try {
    const result = await definition.run(ctx);
    const findings = result.findings.map((f) => ({ ...f, durationMs: Date.now() - started }));
    const signalCount = findings.reduce((n, f) => n + f.signals.length, 0) + (result.signals?.length ?? 0);
    run.status = 'completed';
    run.findingCount = findings.length;
    run.signalCount = signalCount;
    run.durationMs = Date.now() - started;
    run.finishedAt = nowIso();
    hooks.onFinish(run);
    return { run, result: { findings, signals: result.signals } };
  } catch (err) {
    run.status = 'failed';
    run.durationMs = Date.now() - started;
    run.finishedAt = nowIso();
    run.error = agentError(err, definition.blocking);
    run.notes.push(`failed: ${run.error.message}`);
    hooks.onFinish(run);
    return { run, result: null };
  }
}
