import type { AgentContext, AgentDefinition, AgentResult } from '../types.js';
import type { ClientCall, CodeIndex, RouteDef } from '../../analysis/codeIndex.js';
import { matchRoute, nameSimilarity } from '../../analysis/codeIndex.js';
import { codeEvidence } from '../../analysis/evidenceParse.js';
import { evidence, finding, signal } from '../types.js';
import type { Evidence, Finding, Signal } from '../../types/index.js';
import { q } from '../../utils/format.js';

/**
 * API / Service Agent
 * ───────────────────
 * Compares what each producer actually sends against what each consumer
 * actually reads, and compares declared configuration against what is read.
 * It is the agent that catches contract drift between two halves of a
 * full-stack app.
 */
export const apiAgent: AgentDefinition = {
  id: 'api',
  title: 'API / Service Agent',
  stage: 'investigation',
  parallelGroup: 'investigation',
  blocking: false,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const index = ctx.index;
    const findings: Finding[] = [];
    const signals: Signal[] = [];

    findings.push(...describeContract(index).findings);

    const mismatches = findFieldMismatches(ctx, index);
    findings.push(...mismatches.findings);
    signals.push(...mismatches.signals);

    const envIssues = findEnvIssues(ctx, index);
    findings.push(...envIssues.findings);
    signals.push(...envIssues.signals);

    findings.push(...describeRoutes(ctx, index));
    findings.push(...describeServiceCalls(index).findings);
    signals.push(...describeServiceCalls(index).signals);

    return { findings, signals };
  },
};

/* ------------------------------------------------------------------ */
/* Contract inventory                                                 */
/* ------------------------------------------------------------------ */

function describeContract(index: CodeIndex) {
  const findings: Finding[] = [];
  if (index.routes.length === 0) {
    return {
      findings: [finding({
        agent: 'api',
        title: 'No HTTP routes detected',
        summary: 'The analyser found no recognisable route definitions in this project.',
        severity: 'info',
        confidence: 1,
        impact: 'API contract analysis has nothing to work with.',
        files: [],
        functions: [],
        evidence: [],
        signals: [],
      })],
    };
  }

  const ev: Evidence[] = [];
  const rows: string[] = [];
  for (const route of index.routes.slice(0, 40)) {
    const keys = route.responseKeys.map((k) => k.name).join(', ') || '(no literal payload found)';
    rows.push(`${route.method} ${route.path} → { ${keys} }`);
    ev.push(codeEvidence(
      'api',
      route.file,
      route.responseLiteralLine ?? route.line,
      `Response payload for ${route.method} ${route.path}`,
      `{ ${keys} }`,
      route.handler ?? undefined,
    ));
  }

  return {
    findings: [finding({
      agent: 'api',
      title: `API contract inventory — ${index.routes.length} route(s)`,
      summary: rows.slice(0, 12).join('\n'),
      severity: 'info',
      confidence: 0.9,
      impact: 'The set of fields each endpoint actually sends. Consumer expectations are checked against this.',
      files: [...new Set(index.routes.map((r) => r.file))],
      functions: [...new Set(index.routes.map((r) => r.handler).filter(Boolean) as string[])],
      evidence: ev,
      signals: [],
    })],
  };
}

function describeRoutes(ctx: AgentContext, index: CodeIndex) {
  const findings: Finding[] = [];
  // Which routes did the logs actually hit?
  const hitRoutes = index.routes.filter((r) =>
    ctx.expectations.requestPaths.some((p) => matchRoute([r], p.path) !== null));

  if (hitRoutes.length === 0) return findings;

  const ev: Evidence[] = [];
  for (const route of hitRoutes.slice(0, 8)) {
    ev.push(codeEvidence('api', route.file, route.line, `Route ${route.method} ${route.path} appears in the access evidence`, `${route.method} ${route.path}`, route.handler ?? undefined));
  }

  return [finding({
    agent: 'api',
    title: 'Endpoints named in the evidence',
    summary: hitRoutes.slice(0, 8).map((r) => `${r.method} ${r.path} → ${r.file}${r.handler ? ` (${r.handler})` : ''}`).join('\n'),
    severity: 'medium',
    confidence: 0.85,
    impact: 'These are the endpoints the reported failure actually exercised.',
    files: hitRoutes.map((r) => r.file),
    functions: hitRoutes.map((r) => r.handler).filter(Boolean) as string[],
    evidence: ev,
    signals: [],
  })];
}

/* ------------------------------------------------------------------ */
/* Producer / consumer field mismatch                                 */
/* ------------------------------------------------------------------ */

interface FieldMismatch {
  call: ClientCall;
  route: RouteDef;
  missing: { key: string; chain: string[]; line: number; file: string; snippet: string; depth: number; via: string | null }[];
  renameSuspects: { consumed: string; produced: string; score: number; chain: string[]; line: number; file: string; snippet: string }[];
  unusedProduced: string[];
}

/**
 * Walks a consumer chain (`payload.prediction.prediction.label`) against what the
 * producer actually sends, one hop at a time.
 *
 * The first hop is checked against the response payload's own keys. Deeper hops
 * are checked against the known shape of the value behind that key, which comes
 * from the query that produced it. A hop we know nothing about stops the walk
 * rather than inventing a mismatch.
 */
function checkChain(
  chain: string[],
  produced: Set<string>,
  shapes: Record<string, { keys: string[]; via: string; table: string | null }>,
): { missingHop: string | null; depth: number; via: string | null; keysAtHop: string[] | null } {
  const hops = chain.slice(1);
  if (hops.length === 0) return { missingHop: null, depth: 0, via: null, keysAtHop: null };

  const first = hops[0];
  if (!produced.has(first)) return { missingHop: first, depth: 1, via: null, keysAtHop: null };

  let current = first;
  for (let i = 1; i < hops.length; i += 1) {
    const shape = shapes[current];
    if (!shape) return { missingHop: null, depth: 0, via: null, keysAtHop: null }; // unknown, stay silent
    const next = hops[i];
    if (!shape.keys.includes(next)) {
      return { missingHop: next, depth: i + 1, via: shape.via, keysAtHop: shape.keys };
    }
    current = next;
  }
  return { missingHop: null, depth: 0, via: null, keysAtHop: null };
}

function findFieldMismatches(ctx: AgentContext, index: CodeIndex): { findings: Finding[]; signals: Signal[] } {
  const findings: Finding[] = [];
  const signals: Signal[] = [];
  const mismatches: FieldMismatch[] = [];

  for (const call of index.clientCalls) {
    const route = matchRoute(index.routes, call.url ?? call.urlExpression);
    if (!route) continue;
    const produced = new Set(route.responseKeys.map((k) => k.name));
    // Spread payload (`{ ...row }`) means the shape is dynamic — do not guess.
    if ([...produced].some((k) => k.startsWith('...'))) continue;
    if (produced.size === 0) continue;

    const missing: FieldMismatch['missing'] = [];
    const renameSuspects: FieldMismatch['renameSuspects'] = [];
    const consumedNames = new Set<string>();
    const reported = new Set<string>();

    for (const access of call.accesses) {
      if (access.chain.length < 2) continue;
      const pathFromRoot = access.chain.slice(1);
      if (pathFromRoot.length === 0) continue;
      consumedNames.add(pathFromRoot[0]);

      const verdict = checkChain(access.chain, produced, route.responseShapes ?? {});
      if (!verdict.missingHop) continue;

      const key = verdict.missingHop;
      const dedupeKey = `${key}|${pathFromRoot.slice(0, verdict.depth).join('.')}`;
      if (reported.has(dedupeKey)) continue;
      reported.add(dedupeKey);

      missing.push({
        key,
        chain: access.chain,
        line: access.line,
        file: access.file,
        snippet: access.snippet,
        depth: verdict.depth,
        via: verdict.via,
      });

      // Only a top-level miss can be a rename of a produced field.
      if (verdict.depth === 1) {
        let best: { name: string; score: number } | null = null;
        for (const name of produced) {
          const sim = nameSimilarity(key, name);
          if (!best || sim.score > best.score) best = { name, score: sim.score };
        }
        if (best && best.score >= 0.4) {
          renameSuspects.push({
            consumed: key,
            produced: best.name,
            score: best.score,
            chain: access.chain,
            line: access.line,
            file: access.file,
            snippet: access.snippet,
          });
        }
      }
    }

    if (missing.length === 0 && renameSuspects.length === 0) continue;

    const unusedProduced = [...produced].filter((k) => !consumedNames.has(k) && !k.startsWith('...'));
    mismatches.push({ call, route, missing, renameSuspects, unusedProduced });
  }

  for (const mismatch of mismatches) {
    const { call, route, missing, renameSuspects, unusedProduced } = mismatch;
    const ev: Evidence[] = [];
    const contractStatement = `${route.method} ${route.path} sends { ${[...new Set(route.responseKeys.map((k) => k.name))].join(', ')} }`;

    ev.push(codeEvidence(
      'api',
      route.file,
      route.responseLiteralLine ?? route.line,
      `Producer: ${contractStatement}`,
      `{ ${[...new Set(route.responseKeys.map((k) => k.name))].join(', ')} }`,
      route.handler ?? undefined,
    ));
    for (const m of missing.slice(0, 6)) {
      ev.push(codeEvidence(
        'api',
        m.file,
        m.line,
        m.depth > 1
          ? `Consumer reads ${q(m.chain.join('.'))}, one level deeper than ${m.via ?? 'the producer'} can supply`
          : `Consumer reads ${q(m.chain.join('.'))} but ${route.method} ${route.path} never sends ${q(m.key)}`,
        m.snippet,
      ));
    }

    const mSignals: Signal[] = [];

    for (const m of missing) {
      // Corroboration: did the runtime actually report this exact name missing?
      const runtimeHit = ctx.expectations.missingProperties.find((p) => p.name === m.key);
      const stackHit = ctx.expectations.frames.find((f) => f.file === m.file);
      const pathHit = ctx.expectations.requestPaths.find((p) => matchRoute([route], p.path) !== null);

      let weight = 0.45;
      if (pathHit) weight += 0.15;
      if (stackHit) weight += 0.1;
      if (runtimeHit) weight += 0.25;
      // Same function the stack frame points at is the strongest possible link.
      if (stackHit && m.line >= (stackHit.line - 20) && m.line <= (stackHit.line + 20)) weight += 0.1;
      // A statically proven shape mismatch does not need runtime help.
      if (m.depth > 1) weight = Math.max(weight, 0.7);

      const statement = m.depth > 1
        ? `Consumer reads ${q(m.chain.join('.'))}, but ${m.via ?? 'the producer'} returns { ${route.responseShapes[Object.keys(route.responseShapes)[0]]?.keys.join(', ') ?? ''} } — there is no ${q(m.key)} at that depth.`
        : `Consumer ${q(m.chain.join('.'))} reads ${q(m.key)}, which ${route.method} ${route.path} never sends.`;

      mSignals.push(signal({
        kind: 'api-field-missing',
        statement,
        subject: m.key,
        source: 'api',
        weight: Math.min(0.98, weight),
        evidence: ev.slice(-2),
        detail: {
          consumedKey: m.key,
          chain: m.chain,
          depth: m.depth,
          shapeSource: m.via,
          consumerFile: m.file,
          consumerLine: m.line,
          consumerSnippet: m.snippet,
          routeMethod: route.method,
          routePath: route.path,
          routeFile: route.file,
          routeHandler: route.handler,
          producedKeys: [...new Set(route.responseKeys.map((k) => k.name))],
          runtimeCorroborated: Boolean(runtimeHit),
          stackCorroborated: Boolean(stackHit),
        },
      }));
    }

    for (const r of renameSuspects) {
      mSignals.push(signal({
        kind: 'api-field-rename-suspect',
        statement: `"${r.consumed}" looks like a rename of the produced field ${q(r.produced)} (similarity ${r.score.toFixed(2)}).`,
        subject: r.consumed,
        source: 'api',
        weight: Math.min(0.9, 0.3 + r.score * 0.5),
        evidence: ev.slice(-1),
        detail: {
          consumedKey: r.consumed,
          producedKey: r.produced,
          similarity: r.score,
          consumerFile: r.file,
          consumerLine: r.line,
          consumerSnippet: r.snippet,
          routeMethod: route.method,
          routePath: route.path,
          routeFile: route.file,
        },
      }));
    }

    const severity = mSignals.some((s) => s.weight >= 0.7) ? 'high' : 'medium';
    const consumedList = missing.map((x) => q(x.chain.join('.'))).join(', ') || 'no matching field';
    const producedList = [...new Set(route.responseKeys.map((k) => k.name))].join(', ');
    findings.push(finding({
      agent: 'api',
      title: `Contract mismatch: ${route.method} ${route.path}`,
      summary: [
        `Consumer ${call.file}:${call.line} (${call.functionName ?? 'module scope'}) reads ${consumedList}.`,
        `Producer sends { ${producedList} }.`,
        unusedProduced.length > 0 ? `Fields sent but never read: ${unusedProduced.join(', ')}.` : '',
      ].filter(Boolean).join(' '),
      severity,
      confidence: Math.max(...mSignals.map((s) => s.weight), 0.3),
      impact: `Any request to ${route.method} ${route.path} produces undefined values in the consumer.`,
      files: [call.file, route.file],
      functions: [call.functionName, route.handler].filter(Boolean) as string[],
      evidence: ev,
      signals: mSignals,
    }));
    signals.push(...mSignals);
  }

  return { findings, signals };
}

/* ------------------------------------------------------------------ */
/* Environment configuration                                          */
/* ------------------------------------------------------------------ */

function findEnvIssues(ctx: AgentContext, index: CodeIndex): { findings: Finding[]; signals: Signal[] } {
  const findings: Finding[] = [];
  const signals: Signal[] = [];
  const declared = new Map(index.envDeclarations.map((d) => [d.name, d]));

  const unreadDeclared = [...declared.keys()].filter(
    (name) => !index.envRefs.some((r) => r.name === name));

  for (const ref of index.envRefs) {
    if (declared.has(ref.name)) continue;

    // Is there a similarly-named variable that *is* declared?
    const nearMatch = [...declared.keys()]
      .map((name) => ({ name, sim: nameSimilarity(ref.name, name) }))
      .filter((c) => c.sim.score >= 0.55)
      .sort((a, b) => b.sim.score - a.sim.score)[0];

    // Is the undefined value visible in the evidence?
    const malformed = ctx.expectations.malformedPaths;
    const pathWithName = malformed.some((m) => m.path.includes('undefined'));
    const inFailingFile = ctx.expectations.frames.some((f) => f.file === ref.file);

    let weight = 0.5;
    if (pathWithName) weight += 0.3;
    if (inFailingFile) weight += 0.12;
    if (nearMatch) weight += 0.12;

    const ev: Evidence[] = [
      codeEvidence('api', ref.file, ref.line, `Reads \`${ref.accessor}${ref.name}\`, which no env file declares`, ref.snippet),
    ];
    if (nearMatch) {
      const d = declared.get(nearMatch.name) as (typeof declared extends Map<string, infer V> ? V : never);
      ev.push(evidence({
        kind: 'config',
        description: `${q(nearMatch.name)} IS declared in ${d.file}:${d.line} (value ${d.value})`,
        snippet: `${nearMatch.name}=${d.value}`,
        location: { file: d.file, line: d.line },
        source: 'api',
      }));
    }
    for (const m of malformed.slice(0, 3)) {
      ev.push(evidence({
        kind: 'log',
        description: `Request path observed with a literal \`undefined\` segment: ${m.path}`,
        snippet: m.path,
        source: 'api',
      }));
    }

    const statement = nearMatch
      ? `${q(ref.file)} reads ${q(ref.name)} (never declared) while ${q(nearMatch.name)} is the declared variable.`
      : `${q(ref.file)} reads ${q(ref.name)}, which is not declared in any env file.`;

    signals.push(signal({
      kind: 'env-undeclared',
      statement,
      subject: ref.name,
      source: 'api',
      weight: Math.min(0.97, weight),
      evidence: ev,
      detail: {
        readName: ref.name,
        readFile: ref.file,
        readLine: ref.line,
        readSnippet: ref.snippet,
        accessor: ref.accessor,
        declaredName: nearMatch?.name ?? null,
        declaredFile: nearMatch ? (declared.get(nearMatch.name)?.file ?? null) : null,
        declaredLine: nearMatch ? (declared.get(nearMatch.name)?.line ?? null) : null,
        similarity: nearMatch?.sim.score ?? 0,
        undefinedObservedInEvidence: pathWithName,
      },
    }));
  }

  const undeclaredRefs = signals.filter((s) => s.kind === 'env-undeclared');
  if (undeclaredRefs.length > 0) {
    findings.push(finding({
      agent: 'api',
      title: `${undeclaredRefs.length} undeclared environment variable read(s)`,
      summary: undeclaredRefs.map((s) => s.statement).join(' '),
      severity: 'high',
      confidence: Math.max(...undeclaredRefs.map((s) => s.weight)),
      impact: 'The value is undefined at build or start-up, which propagates into every request the code makes.',
      files: [...new Set(undeclaredRefs.map((s) => String((s.detail as Record<string, unknown>).readFile)))],
      functions: [],
      evidence: undeclaredRefs.flatMap((s) => s.evidence).slice(0, 8),
      signals: [],
    }));
  }

  if (unreadDeclared.length > 0) {
    const ev: Evidence[] = [];
    for (const name of unreadDeclared.slice(0, 8)) {
      const d = declared.get(name) as { file: string; line: number; value: string };
      ev.push(evidence({
        kind: 'config',
        description: `${q(name)} is declared in ${d.file}:${d.line} but no code reads it`,
        snippet: `${name}=${d.value}`,
        location: { file: d.file, line: d.line },
        source: 'api',
      }));
    }
    signals.push(signal({
      kind: 'env-declared-unused',
      statement: `Declared but never read: ${unreadDeclared.join(', ')}.`,
      subject: unreadDeclared[0],
      source: 'api',
      weight: 0.3,
      evidence: ev,
      detail: { names: unreadDeclared },
    }));
  }

  return { findings, signals };
}

/* ------------------------------------------------------------------ */
/* Outbound service calls                                             */
/* ------------------------------------------------------------------ */

function describeServiceCalls(index: CodeIndex): { findings: Finding[]; signals: Signal[] } {
  const findings: Finding[] = [];
  const signals: Signal[] = [];
  const outbound = index.clientCalls.filter((c) => c.url && /^https?:\/\//.test(c.url));
  if (outbound.length === 0) return { findings, signals };

  const ev: Evidence[] = [];
  for (const call of outbound.slice(0, 10)) {
    ev.push(codeEvidence('api', call.file, call.line, `Outbound ${call.method} ${call.url}`, call.urlExpression));
  }
  findings.push(finding({
    agent: 'api',
    title: `${outbound.length} outbound service call(s)`,
    summary: outbound.slice(0, 8).map((c) => `${c.method} ${c.url} (${c.file}:${c.line})`).join('\n'),
    severity: 'info',
    confidence: 0.9,
    impact: 'External contracts that a change here could break.',
    files: outbound.map((c) => c.file),
    functions: outbound.map((c) => c.functionName).filter(Boolean) as string[],
    evidence: ev,
    signals,
  }));

  return { findings, signals };
}

export { findFieldMismatches, findEnvIssues };
export type { FieldMismatch };

