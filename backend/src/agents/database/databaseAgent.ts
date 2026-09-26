import type { AgentContext, AgentDefinition, AgentResult } from '../types.js';
import { nameSimilarity, resolveTableAlias, type CodeIndex } from '../../analysis/codeIndex.js';
import { codeEvidence } from '../../analysis/evidenceParse.js';
import { evidence, finding, signal } from '../types.js';
import type { Evidence, Finding, Signal } from '../../types/index.js';
import { q } from '../../utils/format.js';

/**
 * Database Agent
 * ──────────────
 * Cross-references declared schemas and ORM models against the columns the
 * code actually asks for, and against any database error in the evidence.
 */
export const databaseAgent: AgentDefinition = {
  id: 'database',
  title: 'Database Agent',
  stage: 'investigation',
  parallelGroup: 'investigation',
  blocking: false,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const index = ctx.index;
    const findings: Finding[] = [];
    const signals: Signal[] = [];

    findings.push(inventory(index));

    const declared = collectDeclaredColumns(index);
    if (declared.size > 0) {
      findings.push(...checkQueries(ctx, index, declared, signals));
    }

    findings.push(...checkAgainstRuntimeErrors(ctx, index, signals));

    return { findings, signals: dedupeSignals(signals) };
  },
};

/** Collapses signals that say the same thing about the same subject. */
function dedupeSignals(signals: Signal[]): Signal[] {
  const seen = new Set<string>();
  const out: Signal[] = [];
  for (const s of signals) {
    const key = `${s.kind}|${s.subject}|${s.statement}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** table → { column → declared in } */
function collectDeclaredColumns(index: CodeIndex): Map<string, Map<string, { file: string; line: number }>> {
  const out = new Map<string, Map<string, { file: string; line: number }>>();
  for (const table of index.tables) {
    const cols = out.get(table.name) ?? new Map<string, { file: string; line: number }>();
    for (const col of table.columns) {
      if (!cols.has(col.name)) cols.set(col.name, { file: table.file, line: col.line });
    }
    out.set(table.name, cols);
  }
  for (const model of index.models) {
    const cols = out.get(model.name) ?? new Map<string, { file: string; line: number }>();
    for (const f of model.fields) {
      if (!cols.has(f.name)) cols.set(f.name, { file: model.file, line: f.line });
    }
    out.set(model.name, cols);
  }
  return out;
}

function inventory(index: CodeIndex) {
  const ev: Evidence[] = [];
  const rows: string[] = [];
  for (const table of index.tables.slice(0, 25)) {
    const cols = table.columns.map((c) => `${c.name} ${c.type}`).join(', ');
    rows.push(`${table.name}(${cols})`);
    ev.push(codeEvidence('database', table.file, table.line, `Table ${q(table.name)} declared in ${table.file}`, `CREATE TABLE ${table.name} ( ${cols} )`));
  }
  for (const model of index.models.slice(0, 25)) {
    rows.push(`model ${model.name} [${model.orm}]: ${model.fields.map((f) => f.name).join(', ')}`);
    ev.push(codeEvidence('database', model.file, model.line, `Model ${q(model.name)} (${model.orm})`, model.fields.map((f) => f.name).join(', ')));
  }
  return finding({
    agent: 'database',
    title: `Schema inventory — ${index.tables.length} table(s), ${index.models.length} model(s)`,
    summary: rows.join('\n') || 'No SQL schema or ORM model was found in this project.',
    severity: 'info',
    confidence: 0.9,
    impact: 'Authoritative list of the columns that exist. Every query is checked against it.',
    files: [...new Set(index.tables.map((t) => t.file))],
    functions: [],
    evidence: ev,
    signals: [],
  });
}

function checkQueries(
  ctx: AgentContext,
  index: CodeIndex,
  declared: Map<string, Map<string, { file: string; line: number }>>,
  signals: Signal[],
): Finding[] {
  const findings: Finding[] = [];

  for (const query of index.queries) {
    if (query.tables.length === 0) continue;
    const frames = ctx.expectations.frames.filter((f) => f.file === query.file);

    for (const tableName of query.tables) {
      const columns = declared.get(tableName);
      if (!columns) continue;

      // Only blame a table for references that are actually attributed to it.
      const refs = (query.columnRefs ?? []).filter((r) => r.table === tableName);
      const unknown = refs
        .map((r) => r.column)
        .filter((c) => !columns.has(c) && !/^\d+$/.test(c) && !/^[?$:]\w*$/.test(c));
      if (unknown.length === 0) continue;

      const unique = [...new Set(unknown)];
      const isRuntimeConfirmed = ctx.expectations.databaseErrors.some(
        (e) => e.column && unique.includes(e.column),
      );
      const inFailingFile = frames.length > 0;

      let weight = 0.45;
      if (isRuntimeConfirmed) weight += 0.35;
      if (inFailingFile) weight += 0.15;

      const schemaDecl = columns.values().next().value as { file: string; line: number } | undefined;
      const ev: Evidence[] = [
        codeEvidence('database', schemaDecl?.file ?? query.file, schemaDecl?.line ?? 1,
          `Table ${q(tableName)} declares: ${[...columns.keys()].join(', ')}`,
          `CREATE TABLE ${tableName} ( ${[...columns.keys()].join(', ')} )`),
        codeEvidence('database', query.file, query.line,
          `Query reads ${unique.join(', ')} from ${q(tableName)}`,
          query.sql),
      ];
      for (const frame of frames) {
        ev.push(evidence({
          kind: 'log',
          description: `Runtime stack points at ${frame.file}:${frame.line} in ${frame.symbol}()`,
          snippet: `at ${frame.symbol} (${frame.file}:${frame.line}:${frame.column})`,
          location: { file: frame.file, line: frame.line, symbol: frame.symbol },
          source: 'database',
        }));
      }

      // Point at the closest declared column, which is what the query should use.
      const near = unique
        .map((c) => ({ requested: c, best: closestColumn(c, [...columns.keys()]) }))
        .filter((n) => n.best && n.best.score >= 0.3);

      const statement = `Query on ${q(tableName)} reads ${unique.map((c) => q(c)).join(', ')}, which the schema does not declare.`
        + (near.length > 0
          ? ` Closest declared column${near.length > 1 ? 's' : ''}: ${near.map((n) => `${n.requested} → ${q(n.best!.column)}`).join(', ')}.`
          : '');

      signals.push(signal({
        kind: 'db-column-missing',
        statement,
        subject: unique[0],
        source: 'database',
        weight: Math.min(0.97, weight),
        evidence: ev,
        detail: {
          table: tableName,
          unknownColumns: unique,
          declaredColumns: [...columns.keys()],
          likelyIntendedColumns: near.map((n) => n.best!.column),
          queryFile: query.file,
          queryLine: query.line,
          query: query.sql,
          runtimeConfirmed: isRuntimeConfirmed,
          stackCorroborated: inFailingFile,
          schemaFile: schemaDecl?.file ?? null,
        },
      }));

      findings.push(finding({
        agent: 'database',
        title: `Query on ${q(tableName)} uses columns the schema does not declare`,
        summary: `${statement}\n\nDeclared on ${tableName}: ${[...columns.keys()].join(', ')}.`,
        // An uncorroborated mismatch is a lead; a runtime-confirmed one is the bug.
        severity: isRuntimeConfirmed ? 'high' : 'medium',
        confidence: Math.min(0.97, weight),
        impact: 'The statement fails at execution time, so every request that reaches it returns an error.',
        files: [query.file],
        functions: frames.map((f) => f.symbol),
        evidence: ev,
        signals: [],
      }));
    }
  }

  return dedupeFindings(findings);
}

/** Finds the declared column name closest to an unknown one. */
function closestColumn(requested: string, declared: string[]): { column: string; score: number } | null {
  let best: { column: string; score: number } | null = null;
  for (const column of declared) {
    const { score } = nameSimilarity(requested, column);
    if (!best || score > best.score) best = { column, score };
  }
  return best;
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of findings) {
    const key = `${f.title}|${f.summary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/** Compares the schema against columns the runtime said are missing. */
function checkAgainstRuntimeErrors(ctx: AgentContext, index: CodeIndex, signals: Signal[]): Finding[] {
  const findings: Finding[] = [];
  const declared = collectDeclaredColumns(index);
  if (declared.size === 0) return findings;

  for (const dbErr of ctx.expectations.databaseErrors) {
    if (!dbErr.column) continue;
    // The runtime names whatever the query wrote, which may be a table alias.
    const named = dbErr.table;
    const tableName = (named && declared.has(named) ? named : null)
      ?? (named ? resolveTableAlias(index, named) : null)
      ?? [...declared.keys()][0];
    const columns = declared.get(tableName);
    if (!columns) continue;

    if (columns.has(dbErr.column)) {
      // The schema does declare it — so the fault is elsewhere (wrong table, alias).
      signals.push(signal({
        kind: 'exculpatory',
        statement: `The database said ${q(dbErr.column)} does not exist, but table ${q(tableName)} declares it — the query is probably hitting a different table or alias.`,
        subject: dbErr.column,
        source: 'database',
        weight: 0.5,
        evidence: [codeEvidence('database', columns.get(dbErr.column)!.file, columns.get(dbErr.column)!.line, `\`${tableName}.${dbErr.column}\` IS declared`, `CREATE TABLE ${tableName} ( ... ${dbErr.column} ... )`)],
        detail: { table: tableName, column: dbErr.column },
      }));
      continue;
    }

    // Find the closest declared column name — this is what the query should use.
    const candidates = [...columns.keys()];
    const near = candidates
      .map((c) => ({ c, sim: nameSimilarity(dbErr.column as string, c).score }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 3);

    const ev: Evidence[] = [
      codeEvidence('database', columns.values().next().value?.file ?? '', columns.values().next().value?.line ?? 1,
        `Table ${q(tableName)} declares: ${candidates.join(', ')}`,
        `CREATE TABLE ${tableName} ( ${candidates.join(', ')} )`),
      evidence({
        kind: 'log',
        description: `Runtime database error names ${q(dbErr.column)} as missing`,
        snippet: dbErr.message,
        source: 'database',
      }),
    ];

    const top = near[0];
    if (top && top.sim >= 0.3) {
      signals.push(signal({
        kind: 'db-column-missing',
        statement: `The database rejected ${q(dbErr.column)}; ${q(tableName)} declares ${q(top.c)} (similarity ${top.sim.toFixed(2)}).`,
        subject: dbErr.column,
        source: 'database',
        weight: 0.9,
        evidence: ev,
        detail: {
          table: tableName,
          requestedColumn: dbErr.column,
          likelyIntendedColumn: top.c,
          alternatives: near,
          similarity: top.sim,
          schemaFile: columns.values().next().value?.file ?? null,
        },
      }));
    } else {
      signals.push(signal({
        kind: 'db-column-missing',
        statement: `The database rejected ${q(dbErr.column)}; ${q(tableName)} declares ${candidates.join(', ')}.`,
        subject: dbErr.column,
        source: 'database',
        weight: 0.75,
        evidence: ev,
        detail: { table: tableName, requestedColumn: dbErr.column, declaredColumns: candidates },
      }));
    }

    findings.push(finding({
      agent: 'database',
      title: `Runtime database error: ${dbErr.message}`,
      summary: `Table ${q(tableName)} declares ${candidates.join(', ')}. ${q(dbErr.column)} is not among them.`,
      severity: 'high',
      confidence: 0.92,
      impact: 'The statement is rejected at prepare time, so the whole endpoint fails.',
      files: [],
      functions: [],
      evidence: ev,
      signals: [],
    }));
  }

  return dedupeFindings(findings);
}

