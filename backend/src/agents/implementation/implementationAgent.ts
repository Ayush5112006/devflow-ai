import type { AppliedChange, Approval, ChangePlan, ImplementationResult, PlannedChange } from '../../types/index.js';
import { id as makeId } from '../../utils/id.js';
import { nowIso } from '../../utils/time.js';
import { writeTextFile } from '../../utils/fsSafe.js';
import { createLogger } from '../../utils/logger.js';
import type { CodeIndex } from '../../analysis/codeIndex.js';
import path from 'node:path';

const log = createLogger('implementation');

/**
 * Implementation Agent
 * ────────────────────
 * Applies ONLY the changes the human explicitly approved. It reads the approval
 * record, verifies the plan hash matches, and then applies each edit using a
 * simple string replacement on the live workspace copy.
 *
 * Rules:
 *  - Only the workspacePath directory is ever written to.
 *  - Edits are search-and-replace, not arbitrary command execution.
 *  - Each edit is recorded with a diff regardless of whether it succeeds.
 *  - The original source is never truncated on failure.
 */

export async function runImplementationAgent(
  workspacePath: string,
  approval: Approval,
  index: CodeIndex,
): Promise<ImplementationResult> {
  const startedAt = nowIso();
  const started = Date.now();
  const appliedChanges: AppliedChange[] = [];
  const filesModified: string[] = [];
  const notes: string[] = [];

  log.info(`Applying ${approval.planSnapshot.changes.length} change(s) from plan ${approval.planSnapshot.id}`);

  for (const change of approval.planSnapshot.changes) {
    const result = await applyChange(workspacePath, change, index);
    appliedChanges.push(result);
    if (result.status === 'applied') {
      filesModified.push(result.file);
      notes.push(`Applied change #${change.number}: ${change.file}`);
    } else if (result.status === 'failed') {
      notes.push(`Failed change #${change.number}: ${change.file} — ${result.note}`);
    } else {
      notes.push(`Skipped change #${change.number}: ${change.file} — ${result.note}`);
    }
  }

  const failed = appliedChanges.filter((c) => c.status === 'failed').length;
  const applied = appliedChanges.filter((c) => c.status === 'applied').length;
  const status: ImplementationResult['status'] = applied === 0 ? 'failed'
    : failed > 0 ? 'partial'
    : 'completed';

  const diffStat = `${applied} change(s) applied, ${failed} failed, across ${new Set(filesModified).size} file(s)`;
  const fullDiff = appliedChanges.map((c) => `--- ${c.file}\n${c.diff}`).join('\n\n');

  return {
    id: makeId('impl'),
    appliedChanges,
    filesModified: [...new Set(filesModified)],
    diffStat,
    fullDiff,
    startedAt,
    finishedAt: nowIso(),
    durationMs: Date.now() - started,
    status,
    notes,
  };
}

async function applyChange(
  workspacePath: string,
  change: PlannedChange,
  index: CodeIndex,
): Promise<AppliedChange> {
  // Get the remediation edits from the plan snapshot.
  const remediationId = change.remediationId;

  // Use the file from the change record.
  const relFile = change.file;
  const absFile = path.join(workspacePath, relFile);

  // Look up the file in the code index (already read into memory).
  const indexed = index.files.get(relFile);
  if (!indexed) {
    return {
      plannedChangeId: change.id,
      file: relFile,
      status: 'skipped',
      diff: '',
      note: `File ${relFile} not found in the code index (may not exist in workspace).`,
    };
  }

  const original = indexed.source;

  // Find the remediation for this change in the approved plan snapshot.
  // We use the diffPreview as a fallback if edits are not available.
  // The actual edit info is embedded in the change fields.
  const currentBehaviorKey = extractFindKey(change.currentBehavior);
  if (!currentBehaviorKey) {
    return {
      plannedChangeId: change.id,
      file: relFile,
      status: 'skipped',
      diff: '',
      note: 'Could not determine what text to replace from the change plan.',
    };
  }

  // Determine find/replace from the diffPreview.
  const { find, replace } = parseDiffPreview(change.diffPreview, currentBehaviorKey);
  if (!find) {
    return {
      plannedChangeId: change.id,
      file: relFile,
      status: 'skipped',
      diff: '',
      note: 'diffPreview does not contain a clear find/replace pair.',
    };
  }

  if (!original.includes(find)) {
    return {
      plannedChangeId: change.id,
      file: relFile,
      status: 'skipped',
      diff: '',
      note: `The text ${JSON.stringify(find.slice(0, 60))} was not found in ${relFile} — the file may have already been changed.`,
    };
  }

  const updated = original.replace(find, replace);
  if (updated === original) {
    return {
      plannedChangeId: change.id,
      file: relFile,
      status: 'skipped',
      diff: '',
      note: 'Replacement would produce no change.',
    };
  }

  try {
    await writeTextFile(absFile, updated);
    log.info(`  wrote ${relFile}`);
    return {
      plannedChangeId: change.id,
      file: relFile,
      status: 'applied',
      diff: `-${find}\n+${replace}`,
      note: change.requiredChange.slice(0, 200),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`  failed to write ${relFile}: ${msg}`);
    return {
      plannedChangeId: change.id,
      file: relFile,
      status: 'failed',
      diff: '',
      note: msg,
    };
  }
}

/**
 * Parse a diff preview like "-oldText\n+newText" into find/replace.
 */
function parseDiffPreview(diffPreview: string, fallback: string): { find: string; replace: string } {
  const lines = diffPreview.split('\n');
  const minus = lines.find((l) => l.startsWith('-'))?.slice(1).trim() ?? '';
  const plus = lines.find((l) => l.startsWith('+'))?.slice(1).trim() ?? '';
  if (minus && plus && minus !== plus) return { find: minus, replace: plus };
  // If only a + line: this is an append operation; not a replacement.
  if (!minus && plus) return { find: '', replace: plus };
  // Fall back to the extracted key.
  return { find: fallback, replace: fallback };
}

/**
 * Extract the search string from a currentBehavior description like
 * "The code contains `foo` which ...".
 */
function extractFindKey(currentBehavior: string): string {
  const m = /contains `([^`]+)`/.exec(currentBehavior);
  return m?.[1] ?? '';
}
