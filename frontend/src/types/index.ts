/* Mirror of the backend domain types used in the UI */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type AgentId =
  | 'manager' | 'code' | 'api' | 'database' | 'test'
  | 'evidence' | 'history' | 'rootCause' | 'implementation'
  | 'verification' | 'regression' | 'reporting';

export type StageId =
  | 'projectAnalysis' | 'investigation' | 'rootCause' | 'changePlan'
  | 'implementation' | 'verification' | 'regression' | 'report';

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval' | 'skipped';

export type InvestigationStatus =
  | 'draft' | 'investigating' | 'awaiting_approval' | 'approved' | 'implementing'
  | 'verifying' | 'regressing' | 'completed' | 'failed';

export interface StageTiming {
  stage: StageId;
  status: StageStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs: number;
}

export interface AgentRun {
  agent: AgentId;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  findingCount: number;
  signalCount: number;
  error?: { message: string; detail?: string; blocking: boolean };
  notes: string[];
}

export interface Evidence {
  id: string;
  kind: string;
  description: string;
  snippet?: string;
  location?: { file: string; line?: number; symbol?: string };
  source: AgentId;
}

export interface Finding {
  id: string;
  agent: AgentId;
  title: string;
  summary: string;
  severity: 'info' | 'low' | 'medium' | 'high';
  confidence: number;
  impact: string;
  files: string[];
  functions: string[];
  evidence: Evidence[];
  durationMs: number;
}

export interface Hypothesis {
  id: string;
  statement: string;
  category: string;
  status: 'supported' | 'possible' | 'rejected';
  score: number;
  supporting: Evidence[];
  contradicting: Evidence[];
  corroboratedBy: AgentId[];
}

export interface RootCause {
  id: string;
  statement: string;
  detail: string;
  confidence: number;
  margin: number;
  affectedComponents: string[];
  failurePath: { step: string; file?: string; line?: number }[];
  hypotheses: Hypothesis[];
  rejected: string[];
  evidence: Evidence[];
}

export interface PlannedChange {
  id: string;
  number: number;
  file: string;
  symbol: string;
  currentBehavior: string;
  requiredChange: string;
  reason: string;
  regressionRisk: string;
  verification: string;
  remediationId: string;
  diffPreview: string;
}

export interface ChangePlan {
  id: string;
  investigationId: string;
  planHash: string;
  summary: string;
  changes: PlannedChange[];
  consideredAndRejected: { statement: string; why: string }[];
  createdAt: string;
}

export interface Approval {
  id: string;
  planHash: string;
  approvedBy: string;
  approvedAt: string;
  note: string;
}

export interface AppliedChange {
  plannedChangeId: string;
  file: string;
  status: 'applied' | 'failed' | 'skipped';
  diff: string;
  note: string;
}

export interface ImplementationResult {
  id: string;
  appliedChanges: AppliedChange[];
  filesModified: string[];
  diffStat: string;
  status: 'completed' | 'partial' | 'failed';
  notes: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface CheckResult {
  id: string;
  name: string;
  command: string;
  status: 'pass' | 'fail' | 'skipped' | 'not_available';
  exitCode?: number;
  durationMs: number;
  summary: string;
  failedTests: string[];
  totalTests?: number;
  passedTests?: number;
  outputTail: string;
  origin: 'detected' | 'repro' | 'regression';
}

export interface VerificationResult {
  id: string;
  checks: CheckResult[];
  before: {
    bugReproduction: { expected: string; observed: string; status: string };
    postFix: { expected: string; observed: string; status: string };
    capturedAt: string;
  } | null;
  baselineFailures: string[];
  currentFailures: string[];
  status: 'passed' | 'failed' | 'inconclusive';
  summary: string;
  durationMs: number;
}

export interface RegressionImpact {
  file: string;
  symbol: string;
  kind: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RegressionResult {
  id: string;
  impacts: RegressionImpact[];
  relatedTestFiles: string[];
  executed: CheckResult[];
  createdTests: { file: string; name: string; description: string }[];
  originalBugRetested: CheckResult | null;
  status: 'clean' | 'risk-detected' | 'not_available';
  summary: string;
  durationMs: number;
}

export interface Report {
  id: string;
  investigationId: string;
  generatedAt: string;
  bugSummary: string;
  rootCause: string;
  evidence: string;
  affectedExecutionPath: string;
  filesChanged: string;
  fixImplemented: string;
  testsExecuted: string;
  beforeAfterBehavior: string;
  regressionResults: string;
  remainingRisks: string;
  recommendedFollowUp: string;
  prSummary: {
    summary: string;
    rootCause: string;
    changes: string;
    testing: string;
    regressionStatus: string;
  };
  markdown: string;
}

export interface Metrics {
  totalWorkflowDurationMs: number;
  investigationDurationMs: number;
  implementationDurationMs: number;
  verificationDurationMs: number;
  filesInspected: number;
  filesModified: number;
  agentsUsed: number;
  agentsFailed: number;
  hypothesesGenerated: number;
  hypothesesRejected: number;
  testsExecuted: number;
  testsPassed: number;
  testsFailed: number;
  manualSteps: number;
  manualStepsAutomated: number;
  manualStepsAutomatedPct: number;
  comparison: {
    baseline: { totalMinutes: number; manualSteps: number };
    fixflow: { totalMinutes: number; manualSteps: number };
    deltas: { timeSavedMinutes: number; manualStepsReduced: number };
    notes: string[];
  } | null;
}

export interface ActivityEntry {
  id: string;
  at: string;
  agent: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

/* --- pipeline facts, served by the backend --- */

export interface StageFact {
  id: StageId;
  label: string;
  requiresHuman: boolean;
  produces: string;
}

export interface ObservedStats {
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

export interface PipelineFacts {
  agents: {
    id: string;
    title: string;
    stage: StageId;
    parallelGroup: string;
    blocking: boolean;
  }[];
  parallelAgentCount: number;
  stages: StageFact[];
  humanGateCount: number;
  humanGateStages: string[];
  observed: ObservedStats | null;
  sampleSize: number;
}

export interface Investigation {
  id: string;
  bug: {
    title: string;
    description: string;
    severity: Severity;
    expectedBehavior: string;
    actualBehavior: string;
    reproSteps: string[];
    reproCommand?: string;
    lastKnownGoodRef?: string;
  };
  projectId: string;
  projectName: string;
  workspacePath: string;
  evidence: { id: string; name: string; kind: string; bytes: number; excerpt: string }[];
  status: InvestigationStatus;
  createdAt: string;
  updatedAt: string;
  stages: Record<StageId, StageTiming>;
  agents: AgentRun[];
  projectMap: {
    fileCount: number;
    totalBytes: number;
    languageBreakdown: Record<string, number>;
    frameworks: string[];
    testRunner: string;
    components: { id: string; layer: string; name: string; role: string }[];
  } | null;
  findings: Finding[];
  rootCause: RootCause | null;
  changePlan: ChangePlan | null;
  approval: Approval | null;
  implementation: ImplementationResult | null;
  verification: VerificationResult | null;
  regression: RegressionResult | null;
  report: Report | null;
  metrics: Metrics | null;
  errors: { message: string; blocking: boolean }[];
}

export interface DemoBug {
  id: string;
  title: string;
  oneLine: string;
  severity: Severity;
  expectedOutcome: string;
  report: Investigation['bug'];
}

export interface ProjectTarget {
  id: string;
  name: string;
  description: string;
  isDemo: boolean;
  bugCount: number;
}
