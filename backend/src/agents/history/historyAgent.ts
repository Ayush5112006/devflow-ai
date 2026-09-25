import type { AgentContext, AgentDefinition, AgentResult } from '../types.js';
import { tryRun } from '../../utils/exec.js';
import { evidence, finding, signal } from '../types.js';
import type { Evidence, Finding, Signal } from '../../types/index.js';
import { q } from '../../utils/format.js';

/**
 * Change History Agent
 * ────────────────────
 * Uses git to find *when* the implicated code changed, and refuses to assert
 * causation it cannot support. "This commit touched the file" is a fact;
 * "this commit caused the bug" is a hypothesis the root-cause engine must
 * earn from corroborating evidence.
 */
export const historyAgent: AgentDefinition = {
  id: 'history',
  title: 'Change History Agent',
  stage: 'investigation',
  parallelGroup: 'investigation',
  blocking: false,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const index = ctx.index;
    const findings: Finding[] = [];
    const signals: Signal[] = [];

    const isRepo = await tryRun('git rev-parse --is-inside-work-tree', { cwd: index.root });
    if (isRepo.exitCode !== 0 || !/true/.test(isRepo.stdout)) {
      findings.push(finding({
        agent: 'history',
        title: 'No git history available',
        summary: 'The project is not a git repository, so change history could not be analysed.',
        severity: 'info',
        confidence: 1,
        impact: 'Regression-vs-defect reasoning is unavailable for this investigation.',
        files: [],
        functions: [],
        evidence: [],
        signals: [],
      }));
      return { findings, signals };
    }

    /* --- recent activity --- */
    const log = await tryRun('git log --date=iso-strict --pretty=format:%h|%ad|%an|%s -n 25', { cwd: index.root });
    const commits = parseCommits(log.stdout);
    if (commits.length === 0) {
      findings.push(finding({
        agent: 'history',
        title: 'Git repository has no commits',
        summary: 'The repository is initialised but empty.',
        severity: 'info',
        confidence: 1,
        impact: 'No change history to correlate.',
        files: [], functions: [], evidence: [], signals: [],
      }));
      return { findings, signals };
    }

    ctx.note(`${commits.length} recent commit(s) found`);
    const logEvidence: Evidence[] = commits.slice(0, 15).map((c) => evidence({
      kind: 'git',
      description: `${c.hash} ${c.date} ${c.author} — ${c.subject}`,
      snippet: c.subject,
      source: 'history',
    }));

    findings.push(finding({
      agent: 'history',
      title: `Recent history — ${commits.length} commit(s)`,
      summary: commits.slice(0, 10).map((c) => `${c.hash}  ${c.date}  ${c.subject}`).join('\n'),
      severity: 'info',
      confidence: 1,
      impact: 'Candidate regressions are looked for in these commits.',
      files: [], functions: [],
      evidence: logEvidence,
      signals: [],
    }));

    /* --- which files does the evidence implicate? --- */
    const implicated = new Set<string>();
    for (const frame of ctx.expectations.frames) implicated.add(frame.file);
    for (const dbErr of ctx.expectations.databaseErrors) {
      for (const f of index.files.keys()) {
        if (f.includes('Service') || f.includes('service') || f.includes('order') || f.includes('db')) implicated.add(f);
      }
    }
    // The consumer files the API agent will care about.
    for (const call of index.clientCalls) implicated.add(call.file);
    for (const ref of index.envRefs) implicated.add(ref.file);

    const changedRecently: {
      file: string;
      hash: string;
      date: string;
      author: string;
      subject: string;
      addedIdentifiers: string[];
      removedIdentifiers: string[];
      isImplicated: boolean;
    }[] = [];

    for (const file of [...implicated].slice(0, 14)) {
      if (!index.files.has(file)) continue;
      const logForFile = await tryRun(
        `git log --date=iso-strict --pretty=format:%h|%ad|%an|%s -n 5 -- ${quotePath(file)}`,
        { cwd: index.root },
      );
      const fileCommits = parseCommits(logForFile.stdout);
      for (const commit of fileCommits.slice(0, 3)) {
        const patch = await tryRun(`git show --unified=0 --format= ${quotePath(file)} ${commit.hash}`, { cwd: index.root });
        const { added, removed } = parseDiff(patch.stdout);
        changedRecently.push({
          file,
          hash: commit.hash,
          date: commit.date,
          author: commit.author,
          subject: commit.subject,
          addedIdentifiers: added,
          removedIdentifiers: removed,
          isImplicated: true,
        });
      }
    }

    /* --- correlate with the failure tokens --- */
    const failureTokens = new Set<string>();
    for (const m of ctx.expectations.missingProperties) failureTokens.add(m.name);
    for (const e of ctx.expectations.databaseErrors) if (e.column) failureTokens.add(e.column);
    for (const f of ctx.expectations.frames) if (f.symbol) failureTokens.add(f.symbol);
    for (const q of ctx.expectations.quotedIdentifiers) failureTokens.add(q);
    for (const call of index.envRefs) failureTokens.add(call.name);

    for (const change of changedRecently) {
      const touchedTokens = [...failureTokens].filter((token) =>
        change.addedIdentifiers.includes(token) || change.removedIdentifiers.includes(token));

      if (touchedTokens.length === 0) continue;

      const patch = await tryRun(`git show --format= --unified=2 ${change.hash} -- ${quotePath(change.file)}`, { cwd: index.root });
      const snippet = patch.stdout.split('\n').filter((l) => touchedTokens.some((t) => l.includes(t))).slice(0, 6).join('\n');

      const ev: Evidence[] = [
        evidence({
          kind: 'git',
          description: `${change.hash} (${change.date}, ${change.author}) changed ${change.file}: ${change.subject}`,
          snippet: `${change.subject}\n${snippet}`.slice(0, 600),
          location: { file: change.file },
          source: 'history',
        }),
      ];

      // Causation requires the reporter to have said it used to work, or the
      // change to be recent. Absent both, this stays a low-weight signal.
      const reporterSaidRegression = Boolean(ctx.bug.lastKnownGoodRef);
      const recency = daysSince(change.date);
      const isRecent = recency !== null && recency <= 60;

      let weight = 0.3;
      if (touchedTokens.length > 1) weight += 0.1;
      if (reporterSaidRegression) weight += 0.2;
      if (isRecent) weight += 0.1;

      signals.push(signal({
        kind: 'git-recent-change',
        statement: `${change.hash} "${change.subject}" (${change.date}) changed ${change.file} and touched ${touchedTokens.map((t) => `${q(t)}`).join(', ')}.`,
        subject: change.file,
        source: 'history',
        weight: Math.min(0.85, weight),
        evidence: ev,
        detail: {
          commit: change.hash,
          date: change.date,
          author: change.author,
          subject: change.subject,
          file: change.file,
          touchedTokens,
          daysAgo: recency,
          reporterBelievedRegression: reporterSaidRegression,
          lastKnownGoodRef: ctx.bug.lastKnownGoodRef ?? null,
        },
      }));
    }

    /* --- the reporter's own last-known-good ref --- */
    if (ctx.bug.lastKnownGoodRef) {
      const diff = await tryRun(`git diff --stat ${quoteGitRef(ctx.bug.lastKnownGoodRef)} HEAD`, { cwd: index.root });
      if (diff.exitCode === 0 && diff.stdout.trim()) {
        const ev: Evidence[] = [evidence({
          kind: 'git',
          description: `Files changed between ${ctx.bug.lastKnownGoodRef} and HEAD`,
          snippet: diff.stdout.slice(0, 1200),
          source: 'history',
        })];
        findings.push(finding({
          agent: 'history',
          title: `Change surface since ${ctx.bug.lastKnownGoodRef}`,
          summary: diff.stdout.trim().split('\n').slice(0, 20).join('\n'),
          severity: 'medium',
          confidence: 0.9,
          impact: 'The reporter says the defect is newer than this reference; these are the candidate changes.',
          files: diff.stdout.split('\n').filter((l) => l.includes('|'))
            .map((l) => l.split('|')[0].trim()).filter(Boolean),
          functions: [],
          evidence: ev,
          signals: [signal({
            kind: 'git-recent-change',
            statement: `${diff.stdout.split('\n').filter((l) => l.includes('|')).length} file(s) changed since ${ctx.bug.lastKnownGoodRef}.`,
            subject: ctx.bug.lastKnownGoodRef,
            source: 'history',
            weight: 0.55,
            evidence: ev,
            detail: { lastKnownGoodRef: ctx.bug.lastKnownGoodRef, stat: diff.stdout },
          })],
        }));
      }
    }

    return { findings, signals };
  },
};

/* ------------------------------------------------------------------ */
/* Parsing                                                            */
/* ------------------------------------------------------------------ */

interface Commit {
  hash: string;
  date: string;
  author: string;
  subject: string;
}

export function parseCommits(raw: string): Commit[] {
  const out: Commit[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes('|')) continue;
    const [hash, date, author, ...rest] = line.split('|');
    if (!hash || !date) continue;
    out.push({ hash: hash.trim(), date: date.trim(), author: (author ?? '').trim(), subject: rest.join('|').trim() });
  }
  return out;
}

/** Extracts identifiers added and removed by a diff. */
export function parseDiff(diff: string): { added: string[]; removed: string[] } {
  const added = new Set<string>();
  const removed = new Set<string>();
  const idRe = /[A-Za-z_$][\w$]*/g;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    const target = line.startsWith('+') ? added : line.startsWith('-') ? removed : null;
    if (!target) continue;
    for (const m of line.matchAll(idRe)) {
      const token = m[0];
      if (token.length < 3) continue;
      if (/^(const|let|var|return|function|export|import|from|default|async|await|new|class|if|else|this|null|true|false|string|number|object)$/.test(token)) continue;
      target.add(token);
    }
  }
  return { added: [...added], removed: [...removed] };
}

function daysSince(iso: string): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86_400_000));
}

/** The workspace path can contain spaces, so paths are quoted for git. */
function quotePath(file: string): string {
  return file.includes(' ') ? `"${file}"` : file;
}

function quoteGitRef(ref: string): string {
  if (!/^[A-Za-z0-9._/~^-]+$/.test(ref)) throw new Error(`Unsafe git ref: ${ref}`);
  return ref;
}

export { quotePath, quoteGitRef };

