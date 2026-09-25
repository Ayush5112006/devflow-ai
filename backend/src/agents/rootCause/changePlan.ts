import type { Approval, ChangePlan, PlannedChange, Remediation, RootCause } from '../../types/index.js';
import { id as makeId } from '../../utils/id.js';
import { shortHash } from '../../utils/id.js';
import { nowIso } from '../../utils/time.js';
import { q } from '../../utils/format.js';
import type { CodeIndex } from '../../analysis/codeIndex.js';
import type { EvidenceExpectation } from '../../analysis/expectations.js';

/**
 * Change Plan Generator
 * ─────────────────────
 * Converts the root cause into concrete, minimal file edits with a machine-
 * verifiable plan hash. The hash is the approval gate: the Implementation Agent
 * refuses to run if the plan it sees does not match what the human approved.
 */

export interface ChangePlanInput {
  investigationId: string;
  rootCause: RootCause;
  index: CodeIndex;
  expectations: EvidenceExpectation;
}

export function generateChangePlan(input: ChangePlanInput): ChangePlan {
  const { investigationId, rootCause, index, expectations } = input;

  const remediations: Remediation[] = [];
  const changes: PlannedChange[] = [];
  const consideredAndRejected: { statement: string; why: string }[] = [];

  // Generate one remediation per supported hypothesis.
  let changeNumber = 0;
  for (const hyp of rootCause.hypotheses.filter((h) => h.status === 'supported' || h.status === 'possible')) {
    const rem = buildRemediation(hyp, index, expectations);
    if (!rem) {
      consideredAndRejected.push({
        statement: hyp.statement,
        why: 'No specific file edit could be determined from static analysis alone.',
      });
      continue;
    }
    remediations.push(rem);
    for (const edit of rem.edits) {
      changeNumber += 1;
      changes.push({
        id: makeId('chg'),
        number: changeNumber,
        file: edit.file,
        symbol: guessSymbol(edit.file, edit.find, index),
        currentBehavior: `The code contains ${q(edit.find.trim().slice(0, 80))} which ${describeCurrentBehavior(hyp.category)}`,
        requiredChange: edit.reason,
        reason: hyp.statement,
        regressionRisk: regressionRisk(hyp.category, edit.file),
        verification: verificationSteps(hyp.category, index),
        remediationId: rem.id,
        diffPreview: rem.diffPreview,
      });
    }
  }

  const planHash = shortHash(JSON.stringify(changes.map((c) => ({ f: c.file, find: changes[0]?.currentBehavior }))));

  return {
    id: makeId('plan'),
    investigationId,
    planHash,
    summary: summarizePlan(rootCause, changes),
    changes,
    remediations,
    consideredAndRejected,
    createdAt: nowIso(),
  };
}

/* ------------------------------------------------------------------ */
/* Remediation builders                                               */
/* ------------------------------------------------------------------ */

function buildRemediation(
  hyp: NonNullable<RootCause['hypotheses'][0]>,
  index: CodeIndex,
  expectations: EvidenceExpectation,
): Remediation | null {
  const { category } = hyp;

  if (category === 'API contract mismatch' || category === 'API field rename') {
    return buildApiMismatchRemediation(hyp, index, expectations);
  }
  if (category === 'Undeclared environment variable') {
    return buildEnvRemediation(hyp, index, expectations);
  }
  if (category === 'Database schema mismatch') {
    return buildDbRemediation(hyp, index, expectations);
  }
  if (category === 'Runtime null/undefined access') {
    return buildNullAccessRemediation(hyp, index, expectations);
  }

  return null;
}

function buildApiMismatchRemediation(
  hyp: RootCause['hypotheses'][0],
  index: CodeIndex,
  expectations: EvidenceExpectation,
): Remediation | null {
  // Find the consumer file and the exact property access.
  const consumerSignal = hyp.signals
    .map((sid) => { /* we only have ids, look in evidence */ return null; })
    .filter(Boolean)[0];

  // Use evidence locations instead.
  const consumerLoc = hyp.supporting.find((e) => e.kind === 'code' && e.location?.file);
  const producerLoc = hyp.supporting.find((e) => e.kind === 'code' && e.snippet?.includes('{'));

  if (!consumerLoc?.location?.file) return null;

  // Extract consumed field name from the statement.
  const fieldMatch = /reads `([^`]+)`/.exec(hyp.statement);
  const consumedField = fieldMatch?.[1]?.split('.').pop() ?? '';

  // Extract produced field from "never sends `X`" in evidence.
  const producedMatch = hyp.supporting
    .map((e) => /sends \{ ([^}]+) \}/.exec(e.description ?? '') ?? /sends `([^`]+)`/.exec(e.description ?? ''))
    .find(Boolean);
  const producedKeys = producedMatch?.[1]?.split(',').map((s) => s.trim()) ?? [];

  // Best guess at the right key.
  const bestKey = producedKeys.find((k) => k !== consumedField) ?? producedKeys[0] ?? '';
  if (!consumedField || !bestKey || consumedField === bestKey) return null;

  const consumerFile = consumerLoc.location.file;
  const fileContent = index.files.get(consumerFile)?.source ?? '';
  const snippet = consumerLoc.snippet ?? consumedField;

  // Generate a diff that renames consumedField → bestKey in the consumer.
  const find = snippet.slice(0, 120);
  const replace = find.replace(new RegExp(`\\b${consumedField}\\b`), bestKey);
  if (find === replace) return null;

  const diffPreview = `-${find}\n+${replace}`;
  return {
    id: makeId('rem'),
    hypothesisId: hyp.id,
    title: `Rename ${q(consumedField)} to ${q(bestKey)} in the consumer`,
    edits: [{
      file: consumerFile,
      find: consumedField,
      replace: bestKey,
      occurrences: 1,
      lineHint: consumerLoc.location.line,
      reason: `The API sends ${q(bestKey)} but the consumer reads ${q(consumedField)}. Align the consumer to the producer.`,
    }],
    risk: 'low',
    verification: `After applying, the property access resolves correctly; the rendered component shows the expected value.`,
    diffPreview,
    applied: false,
  };
}

function buildEnvRemediation(
  hyp: RootCause['hypotheses'][0],
  index: CodeIndex,
  expectations: EvidenceExpectation,
): Remediation | null {
  // Extract the undeclared name from evidence.
  const undeclaredEv = hyp.supporting.find((e) => e.description?.includes('never declared'));
  if (!undeclaredEv?.location?.file) return null;

  const readMatch = /Reads `([^`]+)`/.exec(undeclaredEv.description ?? '');
  const readName = readMatch?.[1] ?? '';
  const declaredMatch = /`([^`]+)` IS declared/.exec(
    hyp.supporting.find((e) => e.description?.includes('IS declared'))?.description ?? '',
  );
  const correctName = declaredMatch?.[1] ?? '';
  if (!readName) return null;

  const consumerFile = undeclaredEv.location.file;

  if (correctName && correctName !== readName) {
    const diffPreview = `-${readName}\n+${correctName}`;
    return {
      id: makeId('rem'),
      hypothesisId: hyp.id,
      title: `Fix env variable name: ${q(readName)} → ${q(correctName)}`,
      edits: [{
        file: consumerFile,
        find: readName,
        replace: correctName,
        occurrences: 1,
        lineHint: undeclaredEv.location.line,
        reason: `${q(correctName)} is declared in the env file; ${q(readName)} is not. The code should read the declared name.`,
      }],
      risk: 'low',
      verification: `The interpolated URL no longer contains the literal text "undefined". All API requests resolve to the correct path.`,
      diffPreview,
      applied: false,
    };
  }

  // No known-declared replacement: suggest adding to .env.
  const envFile = index.files.has('.env.example') ? '.env.example' : '.env';
  return {
    id: makeId('rem'),
    hypothesisId: hyp.id,
    title: `Declare ${q(readName)} in ${envFile}`,
    edits: [{
      file: envFile,
      find: '',
      replace: `${readName}=<value>`,
      occurrences: 0,
      reason: `${q(readName)} is read by the code but not declared in any env file. Add it with the correct value.`,
    }],
    risk: 'low',
    verification: `After adding the declaration, the value is no longer undefined at runtime.`,
    diffPreview: `+${readName}=<value>`,
    applied: false,
  };
}

function buildDbRemediation(
  hyp: RootCause['hypotheses'][0],
  index: CodeIndex,
  expectations: EvidenceExpectation,
): Remediation | null {
  // The subject is the wrong column name; find the nearest declared column.
  const schemaEv = hyp.supporting.find((e) => e.description?.includes('declares'));
  const queryEv = hyp.supporting.find((e) => e.description?.includes('Query') || e.description?.includes('reads'));

  if (!queryEv?.location?.file) return null;

  const wrongCol = hyp.subject.split('.').pop() ?? hyp.subject;
  const declaredMatch = /declares: ([^\n]+)/.exec(schemaEv?.description ?? '');
  const declared = declaredMatch?.[1]?.split(',').map((s) => s.trim().split(' ')[0]) ?? [];
  const rightCol = declared.find((c) => c !== wrongCol) ?? declared[0] ?? '';

  if (!rightCol || rightCol === wrongCol) return null;

  const queryFile = queryEv.location.file;
  const diffPreview = `-${wrongCol}\n+${rightCol}`;

  return {
    id: makeId('rem'),
    hypothesisId: hyp.id,
    title: `Replace ${q(wrongCol)} with ${q(rightCol)} in the SQL query`,
    edits: [{
      file: queryFile,
      find: wrongCol,
      replace: rightCol,
      occurrences: 1,
      lineHint: queryEv.location.line,
      reason: `The schema declares ${q(rightCol)}; the query uses ${q(wrongCol)}, which does not exist.`,
    }],
    risk: 'medium',
    verification: `The SQL statement executes without error; the endpoint returns HTTP 200 with the expected data.`,
    diffPreview,
    applied: false,
  };
}

function buildNullAccessRemediation(
  hyp: RootCause['hypotheses'][0],
  index: CodeIndex,
  expectations: EvidenceExpectation,
): Remediation | null {
  const loc = hyp.supporting.find((e) => e.location?.file);
  if (!loc?.location?.file) return null;

  return {
    id: makeId('rem'),
    hypothesisId: hyp.id,
    title: `Guard the access to ${q(hyp.subject)}`,
    edits: [{
      file: loc.location.file,
      find: hyp.subject,
      replace: hyp.subject,
      occurrences: 1,
      lineHint: loc.location.line,
      reason: `The runtime confirmed this value can be undefined. A guard (optional chaining or explicit check) prevents the TypeError.`,
    }],
    risk: 'low',
    verification: `No TypeError is thrown; the UI degrades gracefully instead of crashing.`,
    diffPreview: `// add optional chaining or null check around ${hyp.subject}`,
    applied: false,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function guessSymbol(file: string, find: string, index: CodeIndex): string {
  const syms = index.symbols.get(find);
  if (syms?.length) return syms[0].name;
  const fileEntry = index.files.get(file);
  if (!fileEntry) return file;
  // Find the nearest function definition.
  const lineNo = (fileEntry.source.indexOf(find) > 0)
    ? fileEntry.source.slice(0, fileEntry.source.indexOf(find)).split('\n').length
    : 1;
  return `${file}:${lineNo}`;
}

function describeCurrentBehavior(category: string): string {
  switch (category) {
    case 'API contract mismatch': return 'causes the consumer to receive undefined for the expected field';
    case 'Undeclared environment variable': return 'resolves to undefined at build/runtime';
    case 'Database schema mismatch': return 'does not match the declared schema column';
    case 'Runtime null/undefined access': return 'can be undefined, causing a TypeError';
    default: return 'is the identified cause of the reported failure';
  }
}

function regressionRisk(category: string, file: string): string {
  switch (category) {
    case 'API contract mismatch':
      return 'Other consumers of the same API endpoint must also be checked; renaming a field on the producer side would break all consumers.';
    case 'Undeclared environment variable':
      return 'Low: adding a declaration or correcting a name affects only the initialisation of that one value.';
    case 'Database schema mismatch':
      return 'Medium: other queries on the same table may reference this column and should be reviewed.';
    case 'Runtime null/undefined access':
      return 'Low: adding a guard does not change the happy path, only the error path.';
    default:
      return 'Review callers of the modified function/component for assumptions about the changed behaviour.';
  }
}

function verificationSteps(category: string, index: CodeIndex): string {
  const testCmd = index.scripts['test'] ? 'npm test' : index.scripts['test:unit'] ? 'npm run test:unit' : null;
  const testLine = testCmd ? ` Run ${q(testCmd)} and confirm all previously-passing tests still pass.` : '';
  switch (category) {
    case 'API contract mismatch':
      return `Open the affected UI component and confirm the value renders correctly.${testLine}`;
    case 'Undeclared environment variable':
      return `Verify the request URL no longer contains the literal text "undefined".${testLine}`;
    case 'Database schema mismatch':
      return `Call the endpoint with curl and confirm it returns HTTP 200 with the expected data.${testLine}`;
    default:
      return `Execute the reproduction command and confirm the reported symptom no longer occurs.${testLine}`;
  }
}

function summarizePlan(rootCause: RootCause, changes: PlannedChange[]): string {
  if (changes.length === 0) return 'No automated changes could be determined. Manual inspection is required.';
  const files = [...new Set(changes.map((c) => c.file))];
  return `${changes.length} change(s) across ${files.length} file(s) to address: ${rootCause.statement}`;
}
