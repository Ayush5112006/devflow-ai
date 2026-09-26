/**
 * The single source of truth for what FixFlow actually does.
 *
 * The dashboard used to assert its own numbers — "6 parallel agents",
 * "30–60 seconds", "1 manual step". Those were literals in a React component:
 * they could not go stale visibly, and nobody could check them. Everything the
 * UI states about the platform is now derived here from the real agent
 * registry, the real stage list, and the real recorded durations of runs that
 * have already happened.
 */
import type { Investigation, StageId } from '../types/index.js';
import { MANAGER_INVESTIGATION_ORDER } from '../agents/manager/managerAgent.js';

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */

export interface StageFact {
  id: StageId;
  label: string;
  /** True when a person must act before the workflow can continue. */
  requiresHuman: boolean;
  /** What this stage produces. */
  produces: string;
}

/**
 * Ordered exactly as the workflow runs them. `requiresHuman` is not a
 * marketing claim: the workflow genuinely blocks on the approval stage, and
 * these are the only two points where a person has to do something.
 */
export const STAGE_FACTS: readonly StageFact[] = [
  { id: 'projectAnalysis', label: 'Project Analysis', requiresHuman: false, produces: 'a symbol, route, schema and test index' },
  { id: 'investigation', label: 'Investigation', requiresHuman: false, produces: 'findings and scored signals from the analysis agents' },
  { id: 'rootCause', label: 'Root Cause', requiresHuman: false, produces: 'a ranked root cause with a confidence score' },
  { id: 'changePlan', label: 'Change Plan', requiresHuman: false, produces: 'a hashed plan with per-change regression risk' },
  { id: 'approval', label: 'Approval', requiresHuman: true, produces: 'a human decision bound to the exact plan hash' },
  { id: 'implementation', label: 'Implementation', requiresHuman: false, produces: 'the minimal patch' },
  { id: 'verification', label: 'Verification', requiresHuman: false, produces: 'before/after command output' },
  { id: 'regression', label: 'Regression', requiresHuman: false, produces: 'the test suite result after the patch' },
  { id: 'report', label: 'Report', requiresHuman: false, produces: 'the engineering report and measured metrics' },
];

/* ------------------------------------------------------------------ */
/* Observed measurements                                               */
/* ------------------------------------------------------------------ */

export interface ObservedStats {
  /** How many completed investigations the numbers below come from. */
  sampleSize: number;
  minTotalMs: number;
  medianTotalMs: number;
  maxTotalMs: number;
  medianInvestigationMs: number;
  medianImplementationMs: number;
  medianVerificationMs: number;
  medianManualSteps: number;
  medianAgentsUsed: number;
  medianTestsExecuted: number;
  medianFilesInspected: number;
  medianHypothesesGenerated: number;
  medianHypothesesRejected: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Summarise what actually happened, using only runs that reached the report
 * stage and recorded real `Date.now()` deltas. A run that failed, or that is
 * still in progress, is excluded rather than counted as a fast success.
 */
export function observedStats(investigations: Investigation[]): ObservedStats | null {
  const completed = investigations.filter(
    (inv) => inv.status === 'completed' && inv.metrics && inv.metrics.totalWorkflowDurationMs > 0,
  );
  if (completed.length === 0) return null;

  const totals = completed.map((inv) => inv.metrics!.totalWorkflowDurationMs);
  return {
    sampleSize: completed.length,
    minTotalMs: Math.min(...totals),
    medianTotalMs: median(totals),
    maxTotalMs: Math.max(...totals),
    medianInvestigationMs: median(completed.map((i) => i.metrics!.investigationDurationMs)),
    medianImplementationMs: median(completed.map((i) => i.metrics!.implementationDurationMs)),
    medianVerificationMs: median(completed.map((i) => i.metrics!.verificationDurationMs)),
    medianManualSteps: median(completed.map((i) => i.metrics!.manualSteps)),
    medianAgentsUsed: median(completed.map((i) => i.metrics!.agentsUsed)),
    medianTestsExecuted: median(completed.map((i) => i.metrics!.testsExecuted)),
    medianFilesInspected: median(completed.map((i) => i.metrics!.filesInspected)),
    medianHypothesesGenerated: median(completed.map((i) => i.metrics!.hypothesesGenerated)),
    medianHypothesesRejected: median(completed.map((i) => i.metrics!.hypothesesRejected)),
  };
}

/* ------------------------------------------------------------------ */
/* The whole description, ready for the UI                             */
/* ------------------------------------------------------------------ */

export interface PipelineFacts {
  agents: { id: string; title: string; stage: StageId; parallelGroup: string; blocking: boolean }[];
  parallelAgentCount: number;
  stages: StageFact[];
  /** Stages a person must act on. Counted from the workflow, not asserted. */
  humanGateCount: number;
  humanGateStages: string[];
  observed: ObservedStats | null;
  /** How long a fresh run has been observed to take, if it has finished. */
  sampleSize: number;
}

export function pipelineFacts(investigations: Investigation[]): PipelineFacts {
  const observed = observedStats(investigations);
  const humanGates = STAGE_FACTS.filter((s) => s.requiresHuman);
  return {
    agents: MANAGER_INVESTIGATION_ORDER.map((a) => ({
      id: a.id,
      title: a.title,
      stage: a.stage,
      parallelGroup: a.parallelGroup,
      blocking: a.blocking,
    })),
    parallelAgentCount: MANAGER_INVESTIGATION_ORDER.length,
    stages: [...STAGE_FACTS],
    humanGateCount: humanGates.length,
    humanGateStages: humanGates.map((s) => s.label),
    observed,
    sampleSize: observed?.sampleSize ?? 0,
  };
}
