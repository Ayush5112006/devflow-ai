/** The dashboard renders these facts, so they have to be right. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { observedStats, pipelineFacts, STAGE_FACTS } from '../src/analysis/pipelineFacts.js';
import { MANAGER_INVESTIGATION_ORDER } from '../src/agents/manager/managerAgent.js';
import type { Investigation, Metrics } from '../src/types/index.js';

function metrics(over: Partial<Metrics> = {}): Metrics {
  return {
    stageTimings: [],
    investigationDurationMs: 1000,
    implementationDurationMs: 200,
    verificationDurationMs: 300,
    totalWorkflowDurationMs: 2000,
    filesInspected: 26,
    filesModified: 1,
    agentsUsed: 6,
    agentsFailed: 0,
    hypothesesGenerated: 5,
    hypothesesRejected: 4,
    testsExecuted: 11,
    testsPassed: 10,
    testsFailed: 1,
    manualSteps: 1,
    manualStepsAutomated: 8,
    manualStepsAutomatedPct: 89,
    comparison: null,
    ...over,
  };
}

function investigation(over: Partial<Investigation> = {}): Investigation {
  return {
    id: 'inv_test',
    bug: {
      id: 'b', title: 't', description: 'd', severity: 'high',
      expectedBehavior: 'e', actualBehavior: 'a', reproSteps: [],
      reportedAt: '2026-01-01T00:00:00.000Z',
    },
    projectId: 'p', projectName: 'p', workspacePath: 'w', evidence: [],
    status: 'completed', createdAt: '', updatedAt: '',
    stages: {} as Investigation['stages'],
    agents: [], projectMap: null, findings: [],
    rootCause: null, changePlan: null, approval: null,
    implementation: null, verification: null, regression: null,
    report: null, metrics: metrics(), errors: [],
    ...over,
  };
}

test('the agent list is the real registry, not a number written by hand', () => {
  const facts = pipelineFacts([]);
  assert.equal(facts.parallelAgentCount, MANAGER_INVESTIGATION_ORDER.length);
  assert.deepEqual(
    facts.agents.map((a) => a.id),
    MANAGER_INVESTIGATION_ORDER.map((a) => a.id),
  );
  for (const a of facts.agents) assert.ok(a.title, `${a.id} has no title`);
});

test('the human gate is counted from the workflow', () => {
  const facts = pipelineFacts([]);
  const declared = STAGE_FACTS.filter((s) => s.requiresHuman).map((s) => s.id);
  assert.equal(facts.humanGateCount, declared.length);
  assert.deepEqual(facts.humanGateStages, STAGE_FACTS.filter((s) => s.requiresHuman).map((s) => s.label));
  // Approval is the one stage the workflow genuinely blocks on.
  assert.deepEqual(declared, ['approval']);
});

test('with no completed run the dashboard is told to claim nothing', () => {
  assert.equal(observedStats([]), null);
  const facts = pipelineFacts([investigation({ status: 'draft' })]);
  assert.equal(facts.observed, null);
  assert.equal(facts.sampleSize, 0);
});

test('an unfinished or failed run is excluded rather than counted as fast', () => {
  const stats = observedStats([
    investigation({ status: 'investigating' }),
    investigation({ status: 'failed' }),
    investigation({ status: 'completed', metrics: metrics({ totalWorkflowDurationMs: 5000 }) }),
  ]);
  assert.equal(stats?.sampleSize, 1);
  assert.equal(stats?.medianTotalMs, 5000);
});

test('a run with no recorded duration is not evidence of a fast run', () => {
  const stats = observedStats([
    investigation({ metrics: metrics({ totalWorkflowDurationMs: 0 }) }),
  ]);
  assert.equal(stats, null);
});

test('durations summarise the runs that actually finished', () => {
  const stats = observedStats([
    investigation({ metrics: metrics({ totalWorkflowDurationMs: 1000 }) }),
    investigation({ metrics: metrics({ totalWorkflowDurationMs: 2000 }) }),
    investigation({ metrics: metrics({ totalWorkflowDurationMs: 3000 }) }),
    investigation({ metrics: metrics({ totalWorkflowDurationMs: 9000 }) }),
    investigation({ status: 'awaiting_approval' }),
  ]);
  assert.equal(stats?.sampleSize, 4);
  assert.equal(stats?.minTotalMs, 1000);
  assert.equal(stats?.maxTotalMs, 9000);
  assert.equal(stats?.medianTotalMs, 2500, 'median of 2k and 3k');
  assert.equal(stats?.medianManualSteps, 1);
  assert.equal(stats?.medianAgentsUsed, 6);
});
