/* Mirror of the backend domain types used in the UI */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type AgentId =
  | 'manager' | 'code' | 'api' | 'database' | 'test'
  | 'evidence' | 'history' | 'rootCause' | 'implementation'
  | 'verification' | 'regression' | 'reporting';

export type StageId =
  | 'projectAnalysis' | 'investigation' | 'rootCause' | 'changePlan'
  | 'approval' | 'implementation' | 'verification' | 'regression' | 'report';

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

export interface WorkflowComparison {
  baseline: {
    label: string;
    totalDurationMs: number;
    totalMinutes: number;  // kept for backward compat
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
    totalMinutes: number;  // kept for backward compat
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
    timeSavedMinutes: number;    // kept for backward compat
    manualStepsReduced: number;  // kept for backward compat
  };
  notes: string[];
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
  reworkCycles?: number;
  comparison: WorkflowComparison | null;
  stageTimings?: unknown[];
  measuredAt?: string;
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
  /** Ordered newest-first, capped at 200. */
  activity: ActivityEntry[];
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

/* ────────────────────────────────────────────────────────────────────
   REPOSITORY TYPES
   ──────────────────────────────────────────────────────────────────── */

export type RepositoryProvider = 'local' | 'github';
export type RepositorySyncStatus = 'idle' | 'syncing' | 'synced' | 'failed' | 'never';

export interface Repository {
  id: string;
  name: string;
  description: string;
  provider: RepositoryProvider;
  /** Absolute path for local repos, "owner/name" for GitHub. */
  path: string;
  owner: string | null;
  fullName: string | null;
  defaultBranch: string;
  currentBranch: string | null;
  visibility: 'public' | 'private' | 'unknown';
  language: string | null;
  stars: number;
  openIssues: number;
  openPRs: number;
  lastCommitSha: string | null;
  lastCommitMessage: string | null;
  lastCommitAt: string | null;
  lastSyncAt: string | null;
  syncStatus: RepositorySyncStatus;
  syncError: string | null;
  addedAt: string;
  updatedAt: string;
}

export interface RepositoryBranch {
  name: string;
  sha: string;
  isDefault: boolean;
  isProtected: boolean;
  lastCommitMessage: string | null;
  lastCommitAt: string | null;
  lastCommitAuthor: string | null;
  ahead: number;
  behind: number;
}

export interface RepositoryCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  parents: string[];
}

export interface RepositoryCommitDetail extends RepositoryCommit {
  diff: string;
  files: { filename: string; status: string; additions: number; deletions: number; patch: string }[];
}

export interface GitFileEntry {
  path: string;
  name: string;
  type: 'file' | 'dir';
  size: number;
  language: string | null;
}

export interface RepositoryIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  author: string;
  assignee: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  url: string | null;
  investigationId?: string;
}

export interface RepositoryPR {
  id: string;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged' | 'draft';
  author: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  url: string | null;
  checks: { name: string; status: 'pass' | 'fail' | 'pending' }[];
  additions: number;
  deletions: number;
  reviewStatus: 'approved' | 'changes_requested' | 'pending' | 'none';
}

export interface GitStatusFile {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | '?' | 'U';
  staged: boolean;
}

export interface DetailedGitStatus {
  available: boolean;
  branch: string | null;
  remoteBranch: string | null;
  ahead: number;
  behind: number;
  clean: boolean;
  files: GitStatusFile[];
  latestCommit: string | null;
  latestMessage: string | null;
  latestAuthor: string | null;
  latestDate: string | null;
  recentCommits: { hash: string; message: string; author: string; date: string }[];
}

export interface GitHubStatus {
  configured: boolean;
  login: string | null;
  name: string | null;
  avatarUrl: string | null;
  rateLimitRemaining: number | null;
  rateLimitReset: string | null;
  error: string | null;
}

export interface WebhookConfig {
  configured: boolean;
  webhookUrl: string;
  secretConfigured: boolean;
  supportedEvents: string[];
  instructions: string;
}
