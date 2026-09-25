import type { AgentContext, AgentDefinition } from '../types.js';
import type { AgentRun, Finding, InvestigationEvent, Signal, StageId } from '../../types/index.js';
import { emptyRun, runAgentSafely } from '../types.js';
import { codeAgent } from '../code/codeAgent.js';
import { apiAgent } from '../api/apiAgent.js';
import { databaseAgent } from '../database/databaseAgent.js';
import { testAgent } from '../testing/testAgent.js';
import { evidenceAgent } from '../evidence/evidenceAgent.js';
import { historyAgent } from '../../agents/history/historyAgent.js';
import { pool } from '../../utils/exec.js';
import { config } from '../../config.js';
import { nowIso } from '../../utils/time.js';
import { toErrorPayload } from '../../utils/errors.js';

/**
 * Manager Agent
 * ─────────────
 * Owns the workflow: decides what runs, in what order, and what to do when
 * something fails. It is the only component that knows the state machine.
 *
 * Two guarantees it provides:
 *  1. Investigation agents run concurrently and cannot block each other. A
 *     failed agent records its failure and the rest continue.
 *  2. Nothing past the approval gate runs until a human approves a plan whose
 *     hash matches the plan that was shown to them.
 */
export const managerAgent = {
  id: 'manager' as const,
  title: 'Manager Agent',

  investigationAgents: [codeAgent, apiAgent, databaseAgent, testAgent, evidenceAgent, historyAgent],

  /**
   * Fans out every investigation agent at once and merges their findings.
   * A failing agent is reported, not swallowed.
   */
  async investigate(
    ctx: AgentContext,
    hooks?: {
      onAgentStart?(agent: AgentDefinition): void;
      onAgentNote?(agent: AgentDefinition, message: string): void;
      onAgentFinish?(run: AgentRun): void;
    },
  ): Promise<{ runs: AgentRun[]; findings: Finding[]; signals: Signal[] }> {
    const runs: AgentRun[] = [];
    const findings: Finding[] = [];
    const signals: Signal[] = [];

    // Hooks only drive progress reporting. They must never be able to decide
    // whether an investigation produces results, so a caller that omits them
    // (a batch run, a test) gets the same analysis as one that supplies them.
    const onStart = hooks?.onAgentStart?.bind(hooks) ?? (() => undefined);
    const onNote = hooks?.onAgentNote?.bind(hooks) ?? (() => undefined);
    const onFinish = hooks?.onAgentFinish?.bind(hooks) ?? (() => undefined);

    // The evidence agent is cheap and produces the shared expectations other
    // agents are scored against, so it runs first — but only for a moment.
    const ordered = [...MANAGER_INVESTIGATION_ORDER];

    const results = await pool(ordered, Math.max(1, config.maxParallelCommands), async (definition) => {
      const childCtx: AgentContext = {
        ...ctx,
        note: (message: string) => onNote(definition, message),
      };
      onStart(definition);
      return runAgentSafely(definition, childCtx, {
        onStart: () => undefined,
        onFinish: (run) => onFinish(run),
      });
    });

    results.forEach((settled, i) => {
      const definition = ordered[i];
      if (settled.status === 'rejected') {
        const run: AgentRun = {
          ...emptyRun(definition.id, definition.title),
          status: 'failed',
          startedAt: nowIso(),
          finishedAt: nowIso(),
          error: { ...toErrorPayload(settled.reason), blocking: definition.blocking },
        };
        runs.push(run);
        return;
      }
      const { run, result } = settled.value;
      runs.push(run);
      if (result) {
        findings.push(...result.findings);
        signals.push(...(result.signals ?? []));
      }
    });

    return { runs, findings, signals };
  },

  /**
   * Decides whether a set of agent failures is fatal.
   * A missing git history is not fatal. A missing code index is.
   */
  assessBlocking(runs: AgentRun[]): { blocked: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const failed = runs.filter((r) => r.status === 'failed');
    const blockingFailures = failed.filter((r) => r.error?.blocking);
    if (blockingFailures.length > 0) {
      reasons.push(...blockingFailures.map((r) => `${r.title}: ${r.error?.message}`));
    }
    if (failed.some((r) => r.agent === 'evidence')) {
      reasons.push('Evidence Agent failed — root cause analysis has no symptom to explain.');
    }
    return { blocked: reasons.length > 0, reasons };
  },
} as const;

export const MANAGER_INVESTIGATION_ORDER: readonly AgentDefinition[] = [
  evidenceAgent,
  codeAgent,
  apiAgent,
  databaseAgent,
  testAgent,
  historyAgent,
];

export type { InvestigationEvent, StageId };
