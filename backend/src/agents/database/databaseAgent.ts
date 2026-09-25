import type { AgentContext, AgentDefinition, AgentResult } from '../types.js';
import type { CodeIndex } from '../../analysis/codeIndex.js';
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

    return { findings, signals };
  },
};

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
    for (const tableName of query.tables) {
      const columns = declared.get(tableName);
      if (!columns) continue;

      const unknown = query.columns.filter((c) => !columns.has(c) && !/^\d+$/.test(c));
      if (unknown.length === 0) continue;

      const isRuntimeConfirmed = ctx.expectations.databaseErrors.some((e) => e.column && unknown.includes(e.column));
      const frames = ctx.expectations.frames.filter((f) => f.file === query.file);
      const inFailingFile = frames.length > 0;

      let weight = 0.4;
      if (isRuntimeConfirmed) weight += 0.35;
      if (inFailingFile) weight += 0.15;

      const ev: Evidence[] = [
        codeEvidence('database', columns.values().next().value?.file ?? query.file, columns.values().next().value?.line ?? 1,
          `Table ${q(tableName)} declares: ${[...columns.keys()].join(', ')}`,
          `CREATE TABLE ${tableName} ( ${[...columns.keys()].join(', ')} )`),
        codeEvidence('database', query.file, query.line,
          `Query selects ${query.columns.join(', ')} from ${q(tableName)}`,
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

      const statement = `Query on ${q(tableName)} selects ${unknown.join(', ')}, which the schema does not declare.`;
      signals.push(signal({
        kind: 'db-column-missing',
        statement,
        subject: unknown[0],
        source: 'database',
        weight: Math.min(0.97, weight),
        evidence: ev,
        detail: {
          table: tableName,
          unknownColumns: unknown,
          declaredColumns: [...columns.keys()],
          queryFile: query.file,
          queryLine: query.line,
          query: query.sql,
          runtimeConfirmed: isRuntimeConfirmed,
          stackCorroborated: inFailingFile,
          schemaFile: columns.values().next().value?.file ?? null,
        },
      }));

      findings.push(finding({
        agent: 'database',
        title: `Query references columns that do not exist on ${q(tableName)}`,
        summary: `${statement} Declared: ${[...columns.keys()].join(', ')}.`,
        severity: 'high',
        confidence: Math.min(0.97, weight),
        impact: `Every call that reaches this query fails with a database error and the endpoint returns HTTP 500.`,
        files: [query.file],
        functions: frames.map((f) => f.symbol),
        evidence: ev,
        signals: [],
      }));
    }
  }

  return findings;
}

/** Compares the schema against columns the runtime said are missing. */
function checkAgainstRuntimeErrors(ctx: AgentContext, index: CodeIndex, signals: Signal[]): Finding[] {
  const findings: Finding[] = [];
  const declared = collectDeclaredColumns(index);
  if (declared.size === 0) return findings;

  for (const dbErr of ctx.expectations.databaseErrors) {
    if (!dbErr.column) continue;
    const tableName = dbErr.table ?? [...declared.keys()][0];
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
      .map((c) => ({ c, sim: nameSimilarityLocal(dbErr.column as string, c) }))
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

  return findings;
}

/** Local copy to avoid a circular import with the analysis module. */
function nameSimilarityLocal(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const nb = b.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (na === nb) return 1;
  const tokensA = new Set(na.split('_').filter(Boolean));
  const tokensB = new Set(nb.split('_').filter(Boolean));
  const overlap = [...tokensA].filter((t) => tokensB.has(t)).length;
  if (overlap > 0) return 0.4 + 0.4 * (overlap / new Set([...tokensA, ...tokensB]).size);
  const domainPairs: [string, string][] = [
    ['customer', 'customer_name'], ['name', 'customer_name'], ['amount', 'total_cents'],
    ['total', 'total_cents'], ['cents', 'total_cents'], ['amount', 'amount_cents'],
    ['cents', 'amount_cents'], ['total', 'amount_cents'], ['customer', 'customer_name'],
  ];
  for (const [x, y] of domainPairs) {
    if ((na.includes(x) && nb.includes(y)) || (na.includes(y) && nb.includes(x))) return 0.55;
  }
  return 0;
}

export { collectDeclaredColumns, nameSimilarityLocal };

