/**
 * Shared domain types for the whole FixFlow engine.
 * Kept in one file on purpose: the agent contracts, the persistence layer and
 * the HTTP API all need to agree on exactly these shapes.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type AgentId =
  | 'manager'
  | 'code'
  | 'api'
  | 'database'
  | 'test'
  | 'evidence'
  | 'history'
  | 'rootCause'
  | 'implementation'
  | 'verification'
  | 'regression'
  | 'reporting';

export type StageId =
  | 'projectAnalysis'
  | 'investigation'
  | 'rootCause'
  | 'changePlan'
  | 'approval'
  | 'implementation'
  | 'verification'
  | 'regression'
  | 'report';

export type StageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'waiting_approval'
  | 'skipped';

export type CheckStatus = 'pass' | 'fail' | 'skipped' | 'not_available';

export type InvestigationStatus =
  | 'draft'
  | 'investigating'
  | 'awaiting_approval'
  | 'approved'
  | 'implementing'
  | 'verifying'
  | 'regressing'
  | 'completed'
  | 'failed';

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

export type EvidenceKind =
  | 'code'
  | 'log'
  | 'config'
  | 'test'
  | 'git'
  | 'report'
  | 'runtime';

export interface CodeLocation {
  /** Path relative to the analysed project root. */
  file: string;
  /** Convenience single-line form. */
  line?: number;
  lineStart?: number;
  lineEnd?: number;
  symbol?: string;
}

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  description: string;
  /** Verbatim text proving the claim. */
  snippet?: string;
  location?: CodeLocation;
  /** Which agent contributed this. */
  source: AgentId;
}

/* ------------------------------------------------------------------ */
/* Signals — the machine-readable backbone of root cause correlation    */
/* ------------------------------------------------------------------ */

export type SignalKind =
  /** Consumer reads a property the producer never sends. */
  | 'api-field-missing'
  /** Producer sends a field nobody consumes, and a similar name is consumed. */
  | 'api-field-rename-suspect'
  /** A property accessed on a possibly-undefined value at a named location. */
  | 'runtime-null-access'
  /** Code reads an env var that is not declared anywhere. */
  | 'env-undeclared'
  /** Code reads an env var that is declared but the declaration is unused. */
  | 'env-declared-unused'
  /** A query or model references a column/field absent from the schema. */
  | 'db-column-missing'
  /** Schema column that no query or model ever maps. */
  | 'db-column-unused'
  /** A test currently fails and its frames point at these symbols. */
  | 'test-failing'
  /** A symbol implicated by the report exists here. */
  | 'symbol-located'
  /** No error handling on a failing boundary. */
  | 'error-handling-gap'
  /** The implicated line was introduced/changed in a recent commit. */
  | 'git-recent-change'
  /** Evidence contradicts a hypothesis. */
  | 'exculpatory'
  /** A required check could not be run at all. */
  | 'coverage-gap';

export interface Signal {
  id: string;
  kind: SignalKind;
  /** Short human sentence, already safe to render. */
  statement: string;
  /** Normalised identifier the signal is about (field name, env var, column). */
  subject: string;
  source: AgentId;
  weight: number;
  evidence: Evidence[];
  /** Free-form structured detail used by the remediation generator. */
  detail: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Findings                                                            */
/* ------------------------------------------------------------------ */

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high';

export interface Finding {
  id: string;
  agent: AgentId;
  title: string;
  summary: string;
  severity: FindingSeverity;
  confidence: number;
  impact: string;
  files: string[];
  functions: string[];
  evidence: Evidence[];
  signals: Signal[];
  /** Milliseconds of real wall-clock time this agent spent. */
  durationMs: number;
  /** Present when the agent failed. Findings are preserved regardless. */
  error?: AgentError;
}

export interface AgentError {
  message: string;
  /** Short stack head, never the full trace. */
  detail?: string;
  /** Whether the orchestrator judged this fatal to the workflow. */
  blocking: boolean;
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
  error?: AgentError;
  /** Short progress lines shown in the activity panel. */
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Project map                                                         */
/* ------------------------------------------------------------------ */

export type ProjectLayer =
  | 'frontend'
  | 'backend'
  | 'api'
  | 'database'
  | 'tests'
  | 'config'
  | 'docs'
  | 'scripts'
  | 'other';

export interface ProjectComponent {
  id: string;
  layer: ProjectLayer;
  name: string;
  role: string;
  files: string[];
  language: string;
}

export interface ExecutionPathEdge {
  from: string;
  to: string;
  relation:
    | 'calls'
    | 'requests'
    | 'reads'
    | 'writes'
    | 'renders'
    | 'configures';
  location?: CodeLocation;
}

export interface ProjectMap {
  root: string;
  generatedAt: string;
  fileCount: number;
  totalBytes: number;
  languageBreakdown: Record<string, number>;
  entryPoints: { name: string; command: string; file?: string }[];
  components: ProjectComponent[];
  path: ExecutionPathEdge[];
  packageManager: string;
  testRunner: string;
  frameworks: string[];
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Root cause                                                          */
/* ------------------------------------------------------------------ */

export type HypothesisStatus = 'supported' | 'possible' | 'rejected';

export interface Hypothesis {
  id: string;
  statement: string;
  /** Normalised identifier this hypothesis is about (column, field, env var). */
  subject: string;
  category: string;
  status: HypothesisStatus;
  /** 0..1 — how strongly the evidence supports this over the alternatives. */
  score: number;
  supporting: Evidence[];
  contradicting: Evidence[];
  /** Agent ids that independently contributed support. */
  corroboratedBy: AgentId[];
  signals: string[];
}

export interface RootCause {
  id: string;
  statement: string;
  detail: string;
  confidence: number;
  /** 0..1 share of the winning hypothesis's score relative to the runner-up. */
  margin: number;
  affectedComponents: string[];
  failurePath: { step: string; file?: string; line?: number }[];
  hypotheses: Hypothesis[];
  /** Hypothesis ids that were explicitly ruled out. */
  rejected: string[];
  evidence: Evidence[];
}

/* ------------------------------------------------------------------ */
/* Remediation + change plan                                           */
/* ------------------------------------------------------------------ */

/**
 * A remediation is always a concrete, already-located edit.
 * The Implementation Agent never invents edits; it only applies these.
 */
export interface FileEdit {
  file: string;
  /** Exact text to locate. Must occur exactly `occurrences` times (default 1). */
  find: string;
  replace: string;
  occurrences: number;
  lineHint?: number;
  reason: string;
}

export interface Remediation {
  id: string;
  hypothesisId: string;
  title: string;
  edits: FileEdit[];
  risk: 'low' | 'medium' | 'high';
  verification: string;
  /** Unified diff preview generated by applying the edits to a copy. */
  diffPreview: string;
  applied: boolean;
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
  /** Hash of the exact plan content. Approval is bound to this. */
  planHash: string;
  summary: string;
  changes: PlannedChange[];
  remediations: Remediation[];
  consideredAndRejected: { statement: string; why: string }[];
  createdAt: string;
}

export interface Approval {
  id: string;
  planHash: string;
  approvedBy: string;
  approvedAt: string;
  note: string;
  /** Snapshot of the plan the human actually saw. */
  planSnapshot: ChangePlan;
}

/* ------------------------------------------------------------------ */
/* Implementation                                                      */
/* ------------------------------------------------------------------ */

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
  fullDiff: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'completed' | 'partial' | 'failed';
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

export interface CheckResult {
  id: string;
  name: string;
  command: string;
  status: CheckStatus;
  exitCode?: number;
  durationMs: number;
  summary: string;
  /** Failing test names, parsed from real output. */
  failedTests: string[];
  totalTests?: number;
  passedTests?: number;
  outputTail: string;
  evidence: Evidence[];
  /** Where this check came from — detected or explicitly requested. */
  origin: 'detected' | 'repro' | 'regression';
}

export interface BeforeAfter {
  bugReproduction: {
    command: string;
    expected: string;
    observed: string;
    failure: string;
    status: CheckStatus;
  };
  postFix: {
    command: string;
    expected: string;
    observed: string;
    result: 'PASS' | 'FAIL' | 'NOT AVAILABLE';
  };
  capturedAt: string;
}

export interface VerificationResult {
  id: string;
  checks: CheckResult[];
  before: BeforeAfter | null;
  /** Real failing-test list captured *before* the fix, for comparison. */
  baselineFailures: string[];
  currentFailures: string[];
  status: 'passed' | 'failed' | 'inconclusive';
  summary: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/* Regression                                                          */
/* ------------------------------------------------------------------ */

export interface RegressionImpact {
  file: string;
  symbol: string;
  kind: 'modified' | 'caller' | 'data' | 'api-contract' | 'config';
  detail: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CreatedTest {
  file: string;
  name: string;
  description: string;
  content: string;
  rationale: string;
}

export interface RegressionResult {
  id: string;
  impacts: RegressionImpact[];
  relatedTestFiles: string[];
  executed: CheckResult[];
  createdTests: CreatedTest[];
  originalBugRetested: CheckResult | null;
  status: 'clean' | 'risk-detected' | 'not_available';
  summary: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/* Report + metrics                                                    */
/* ------------------------------------------------------------------ */

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
  prSummary: { summary: string; rootCause: string; changes: string; testing: string; regressionStatus: string };
  markdown: string;
}

export interface StageTiming {
  stage: StageId;
  status: StageStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs: number;
}

export interface Metrics {
  /** Real `Date.now()` deltas. No estimates anywhere. */
  stageTimings: StageTiming[];
  investigationDurationMs: number;
  implementationDurationMs: number;
  verificationDurationMs: number;
  totalWorkflowDurationMs: number;
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
  reworkCycles: number;
  /** Comparison baseline measured by actually running the demo's manual path. */
  comparison: WorkflowComparison | null;
  measuredAt: string;
}

export interface WorkflowComparison {
  baseline: {
    label: string;
    totalDurationMs: number;
    manualSteps: number;
    contextSwitches: number;
    filesTouchedByHand: number;
    testsRun: number;
    reworks: number;
    source: string;
  };
  fixflow: {
    label: string;
    totalDurationMs: number;
    manualSteps: number;
    contextSwitches: number;
    filesTouchedByHand: number;
    testsRun: number;
    reworks: number;
  };
  deltas: {
    durationReductionPct: number;
    manualStepReductionPct: number;
    contextSwitchReductionPct: number;
    reworksAvoided: number;
  };
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

export interface ActivityEntry {
  id: string;
  at: string;
  agent: AgentId;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  stage?: StageId;
}

export interface InvestigationEvent {
  type:
    | 'investigation.created'
    | 'stage.started'
    | 'stage.finished'
    | 'agent.started'
    | 'agent.progress'
    | 'agent.finished'
    | 'activity'
    | 'findings.updated'
    | 'rootcause.updated'
    | 'plan.updated'
    | 'approval.updated'
    | 'implementation.updated'
    | 'verification.updated'
    | 'regression.updated'
    | 'report.updated'
    | 'investigation.updated'
    | 'error';
  investigationId: string;
  at: string;
  payload: unknown;
}

/* ------------------------------------------------------------------ */
/* Investigation                                                       */
/* ------------------------------------------------------------------ */

export interface EvidenceAttachment {
  id: string;
  name: string;
  kind: 'log' | 'stacktrace' | 'http' | 'doc' | 'image' | 'other';
  bytes: number;
  /** First N characters retained inline. */
  excerpt: string;
  storedPath?: string;
  addedAt: string;
}

export interface BugReport {
  title: string;
  description: string;
  severity: Severity;
  expectedBehavior: string;
  actualBehavior: string;
  reproSteps: string[];
  /** Optional explicit command that reproduces the failure. */
  reproCommand?: string;
  /** Optional commit the user believes last worked. */
  lastKnownGoodRef?: string;
  reportedAt?: string;
}

export interface Investigation {
  id: string;
  bug: BugReport;
  projectId: string;
  projectName: string;
  /** Disposable worktree this investigation operates in. */
  workspacePath: string;
  evidence: EvidenceAttachment[];
  status: InvestigationStatus;
  createdAt: string;
  updatedAt: string;
  stages: Record<StageId, StageTiming>;
  agents: AgentRun[];
  projectMap: ProjectMap | null;
  findings: Finding[];
  rootCause: RootCause | null;
  changePlan: ChangePlan | null;
  approval: Approval | null;
  implementation: ImplementationResult | null;
  verification: VerificationResult | null;
  regression: RegressionResult | null;
  report: Report | null;
  metrics: Metrics | null;
  errors: AgentError[];
}

export interface ProjectTarget {
  id: string;
  name: string;
  description: string;
  /** Path relative to the repo root, or absolute. */
  sourcePath: string;
  isDemo: boolean;
  bugCount: number;
}

export interface DemoBug {
  id: string;
  title: string;
  oneLine: string;
  severity: Severity;
  report: BugReport;
  evidence: { name: string; kind: EvidenceAttachment['kind']; content: string }[];
  /** What a human is expected to find, shown only as the *expected* outcome. */
  expectedOutcome: string;
}
