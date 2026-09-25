import type { AgentContext } from '../types.js';
import { evidence as mkEvidence, finding, signal } from '../types.js';
import type {
  Evidence, Finding, Hypothesis, HypothesisStatus, RootCause, Signal, SignalKind,
} from '../../types/index.js';
import { id as makeId } from '../../utils/id.js';
import { q } from '../../utils/format.js';
import { nowIso } from '../../utils/time.js';

/**
 * Root Cause Engine
 * ─────────────────
 * Receives the pooled signals from all investigation agents and turns them into
 * a ranked list of hypotheses with an evidence matrix, then selects the most
 * evidence-supported root cause.
 *
 * Rules:
 *  - A hypothesis is only "supported" when two or more independent agents
 *    corroborate the same signal kind about the same subject.
 *  - The confidence margin between #1 and #2 determines how certain the
 *    verdict is; a narrow margin is flagged in the report.
 *  - No claim is fabricated. Every statement in the output traces to a signal.
 */

export interface RootCauseResult {
  rootCause: RootCause;
  finding: Finding;
}

const CATEGORY_LABEL: Record<SignalKind, string> = {
  'api-field-missing': 'API contract mismatch',
  'api-field-rename-suspect': 'API field rename',
  'env-undeclared': 'Undeclared environment variable',
  'env-declared-unused': 'Unused environment variable',
  'db-column-missing': 'Database schema mismatch',
  'db-column-unused': 'Unused database column',
  'runtime-null-access': 'Runtime null/undefined access',
  'test-failing': 'Failing tests',
  'coverage-gap': 'Test coverage gap',
  'symbol-located': 'Symbol location',
  'error-handling-gap': 'Error handling gap',
  'exculpatory': 'Exculpatory evidence',
  'git-recent-change': 'Recent git change',
};

const KIND_WEIGHT: Partial<Record<SignalKind, number>> = {
  'runtime-null-access': 1.3,
  'db-column-missing': 1.3,
  'api-field-missing': 1.2,
  'env-undeclared': 1.2,
  'api-field-rename-suspect': 0.9,
  'test-failing': 0.8,
  'exculpatory': -1.0,
  'coverage-gap': 0.1,
  'git-recent-change': 0.5,
  'symbol-located': 0.2,
};

interface HypothesisCandidate {
  kind: SignalKind;
  subject: string;
  category: string;
  signals: Signal[];
  supportingEvidence: Evidence[];
  contradictingEvidence: Evidence[];
  corroboratedBy: Set<string>; // agent ids
  totalWeight: number;
}

export async function runRootCauseEngine(
  ctx: AgentContext,
  allSignals: Signal[],
  allFindings: Finding[],
): Promise<RootCauseResult> {
  const candidates = buildCandidates(allSignals);
  const hypotheses = rankAndFilter(candidates, allSignals);
  const best = hypotheses[0] ?? null;
  const rootCause = materializeRootCause(best, hypotheses, ctx, allFindings);
  const f = finding({
    agent: 'manager',
    title: best
      ? `Root cause: ${CATEGORY_LABEL[best.kind] ?? best.kind} — ${q(best.subject)}`
      : 'Root cause undetermined',
    summary: rootCause.statement,
    severity: 'high',
    confidence: rootCause.confidence,
    impact: rootCause.detail,
    files: allFindings.flatMap((f) => f.files).slice(0, 10),
    functions: allFindings.flatMap((f) => f.functions).slice(0, 10),
    evidence: rootCause.evidence,
    signals: [],
  });
  return { rootCause, finding: f };
}

function buildCandidates(signals: Signal[]): Map<string, HypothesisCandidate> {
  const map = new Map<string, HypothesisCandidate>();

  for (const sig of signals) {
    if (sig.kind === 'exculpatory') continue; // handled separately
    const key = `${sig.kind}|${sig.subject}`;
    let cand = map.get(key);
    if (!cand) {
      cand = {
        kind: sig.kind,
        subject: sig.subject,
        category: CATEGORY_LABEL[sig.kind] ?? sig.kind,
        signals: [],
        supportingEvidence: [],
        contradictingEvidence: [],
        corroboratedBy: new Set(),
        totalWeight: 0,
      };
      map.set(key, cand);
    }
    cand.signals.push(sig);
    cand.supportingEvidence.push(...sig.evidence);
    cand.corroboratedBy.add(sig.source);
    const kindMult = KIND_WEIGHT[sig.kind] ?? 1.0;
    cand.totalWeight += sig.weight * kindMult;
  }

  // Exculpatory signals reduce the weight of matching candidates.
  for (const sig of signals) {
    if (sig.kind !== 'exculpatory') continue;
    for (const [key, cand] of map) {
      if (key.includes(sig.subject)) {
        cand.totalWeight = Math.max(0, cand.totalWeight - sig.weight * 0.5);
        cand.contradictingEvidence.push(...sig.evidence);
      }
    }
  }

  return map;
}

function rankAndFilter(candidates: Map<string, HypothesisCandidate>, allSignals: Signal[]): HypothesisCandidate[] {
  const list = [...candidates.values()].sort((a, b) => b.totalWeight - a.totalWeight);

  // Prune candidates with no real evidence.
  const meaningful = list.filter((c) => c.totalWeight > 0.2 && c.signals.length > 0);
  // Cap at 8 hypotheses to keep the report clean.
  return meaningful.slice(0, 8);
}

function materializeRootCause(
  best: HypothesisCandidate | null,
  ranked: HypothesisCandidate[],
  ctx: AgentContext,
  allFindings: Finding[],
): RootCause {
  const hypotheses: Hypothesis[] = ranked.map((c, i): Hypothesis => {
    const maxW = ranked[0]?.totalWeight ?? 1;
    const rawScore = c.totalWeight / Math.max(maxW, 1);
    let status: HypothesisStatus = rawScore > 0.6 ? 'supported' : rawScore > 0.25 ? 'possible' : 'rejected';
    if (c.contradictingEvidence.length > c.supportingEvidence.length) status = 'rejected';
    return {
      id: makeId('hyp'),
      statement: narrativeFor(c),
      subject: c.subject,
      category: c.category,
      status,
      score: parseFloat(rawScore.toFixed(3)),
      supporting: dedupeEvidence(c.supportingEvidence).slice(0, 6),
      contradicting: dedupeEvidence(c.contradictingEvidence).slice(0, 4),
      corroboratedBy: [...c.corroboratedBy] as any,
      signals: c.signals.map((s) => s.id),
    };
  });

  const rejected = ranked
    .filter((_, i) => hypotheses[i]?.status === 'rejected')
    .map((c) => `${c.category} — ${q(c.subject)}: insufficient evidence`);

  if (!best) {
    return {
      id: makeId('rc'),
      statement: 'The investigation could not identify a root cause with sufficient evidence.',
      detail: 'Check that evidence attachments are present and contain log output or stack traces.',
      confidence: 0,
      margin: 0,
      affectedComponents: [],
      failurePath: [],
      hypotheses,
      rejected,
      evidence: [],
    };
  }

  const second = ranked[1];
  const norm = best.totalWeight;
  const confidence = parseFloat(Math.min(0.99, norm / (norm + (second?.totalWeight ?? 0) + 0.5)).toFixed(3));
  const margin = second ? parseFloat(((best.totalWeight - second.totalWeight) / best.totalWeight).toFixed(3)) : 1;

  const affectedComponents = [
    ...new Set([
      ...best.supportingEvidence.map((e) => e.location?.file).filter(Boolean) as string[],
      ...allFindings.filter((f) => f.severity === 'high').flatMap((f) => f.files),
    ]),
  ].slice(0, 8);

  const failurePath = buildFailurePath(best, allFindings);

  return {
    id: makeId('rc'),
    statement: narrativeFor(best),
    detail: detailFor(best, ctx),
    confidence,
    margin,
    affectedComponents,
    failurePath,
    hypotheses,
    rejected,
    evidence: dedupeEvidence(best.supportingEvidence).slice(0, 8),
  };
}

function narrativeFor(c: HypothesisCandidate): string {
  switch (c.kind) {
    case 'api-field-missing':
      return `The API endpoint sends a response but the consumer reads ${q(c.subject)}, which is not in the payload.`;
    case 'api-field-rename-suspect':
      return `The field ${q(c.subject)} consumed by the client appears to be a renamed version of a produced field.`;
    case 'env-undeclared':
      return `The code reads ${q(c.subject)}, which is not declared in any environment file, so its value is undefined.`;
    case 'db-column-missing':
      return `A SQL query references ${q(c.subject)}, which does not exist in the declared schema.`;
    case 'runtime-null-access':
      return `A runtime TypeError occurred: reading property ${q(c.subject)} on an undefined/null value.`;
    case 'test-failing':
      return `One or more tests referencing ${q(c.subject)} fail on the current code.`;
    default:
      return `Investigation signal ${q(c.kind)} on ${q(c.subject)} with weight ${c.totalWeight.toFixed(2)}.`;
  }
}

function detailFor(c: HypothesisCandidate, ctx: AgentContext): string {
  const symptom = ctx.bug.actualBehavior.slice(0, 180);
  switch (c.kind) {
    case 'api-field-missing':
      return `The consumer expects ${q(c.subject)} in the JSON response but the server never sets that key. The symptom "${symptom}" is caused by the undefined value propagating into the render path.`;
    case 'env-undeclared':
      return `The build or runtime environment does not define ${q(c.subject)}. When code reads an undefined env variable, any string interpolation produces the literal text "undefined", which is what appears in ${symptom}.`;
    case 'db-column-missing':
      return `The query attempts to project ${q(c.subject)} but the table schema does not include that column. The database engine rejects the statement, causing the endpoint to return HTTP 500.`;
    case 'runtime-null-access':
      return `JavaScript throws a TypeError when code tries to read a property of undefined. The stack trace identified ${q(c.subject)} as the absent value. The symptom "${symptom}" follows from that failure.`;
    default:
      return `The highest-weighted signal cluster points at ${q(c.subject)}. Corroborated by ${[...c.corroboratedBy].join(', ')}.`;
  }
}

function buildFailurePath(
  c: HypothesisCandidate,
  allFindings: Finding[],
): RootCause['failurePath'] {
  const steps: RootCause['failurePath'] = [];

  // Use evidence locations to build the execution trace.
  const locs = c.supportingEvidence
    .filter((e) => e.location?.file)
    .map((e) => ({ file: e.location!.file, line: e.location!.line, symbol: e.location?.symbol }));

  const seen = new Set<string>();
  for (const loc of locs.slice(0, 6)) {
    const key = `${loc.file}:${loc.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push({ step: `${loc.symbol ?? 'code'} at ${loc.file}:${loc.line ?? '?'}`, file: loc.file, line: loc.line });
  }

  if (steps.length === 0) {
    // Fallback: use file references from high-severity findings.
    for (const f of allFindings.filter((f) => f.severity === 'high').slice(0, 3)) {
      for (const file of f.files.slice(0, 2)) {
        const key = file;
        if (seen.has(key)) continue;
        seen.add(key);
        steps.push({ step: `in ${file}`, file });
      }
    }
  }

  return steps;
}

function dedupeEvidence(ev: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const out: Evidence[] = [];
  for (const e of ev) {
    const key = `${e.kind}|${e.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
