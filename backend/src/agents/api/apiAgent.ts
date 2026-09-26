import type { AgentContext, AgentDefinition, AgentResult } from '../types.js';
import type { ClientCall, CodeIndex, ContractCheck, RouteDef } from '../../analysis/codeIndex.js';
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
  missing: { key: string; chain: string[]; line: number; file: string; snippet: string; depth: number; via: string | null; readIn: string | null }[];
  renameSuspects: { consumed: string; produced: string; score: number; chain: string[]; line: number; file: string; snippet: string }[];
  unusedProduced: string[];
}

/**
 * Walks a consumer chain against the shapes the indexer resolved for it, one
 * hop at a time, and reports the first hop that cannot be satisfied.
 *
 * The indexer has already followed the payload through any local function it
 * was handed to, so a read inside a render helper is judged against the value
 * that helper actually receives. A hop whose shape is unknown ends the walk
 * without a verdict rather than inventing a mismatch.
 */
function firstBrokenHop(check: ContractCheck): { key: string; depth: number; available: string[] } | null {
  for (let i = 0; i < check.chain.length; i += 1) {
    const hop = check.hops[i];
    if (!hop?.keys) return null; // shape unknown past this point
    if (!hop.keys.includes(check.chain[i])) {
      return { key: check.chain[i], depth: i + 1, available: hop.keys };
    }
  }
  return null;
}

function findFieldMismatches(ctx: AgentContext, index: CodeIndex): { findings: Finding[]; signals: Signal[] } {
  const findings: Finding[] = [];
  const signals: Signal[] = [];

  // Group the checks by the request they belong to, so one request produces one
  // finding rather than one per read site.
  const groups = new Map<string, { check: ContractCheck; broken: { key: string; depth: number; available: string[] } }[]>();
  for (const check of index.contractChecks) {
    const broken = firstBrokenHop(check);
    if (!broken) continue;
    const key = `${check.call.id}|${check.route.id}`;
    const bucket = groups.get(key) ?? [];
    bucket.push({ check, broken });
    groups.set(key, bucket);
  }

  for (const bucket of groups.values()) {
    const { call, route } = bucket[0].check;
    const produced = new Set(route.responseKeys.map((k) => k.name));
    const missing: FieldMismatch['missing'] = [];
    const renameSuspects: FieldMismatch['renameSuspects'] = [];
    const consumedNames = new Set<string>();
    const reported = new Set<string>();

    for (const { check, broken } of bucket) {
      const key = broken.key;
      const pathSoFar = check.chain.slice(0, broken.depth);
      const dedupe = `${key}|${pathSoFar.join('.')}|${check.file}:${check.line}`;
      if (reported.has(dedupe)) continue;
      reported.add(dedupe);

      consumedNames.add(pathSoFar[0]);
      missing.push({
        key,
        chain: [check.root, ...check.chain],
        line: check.line,
        file: check.file,
        snippet: check.snippet,
        depth: broken.depth,
        via: check.hops[broken.depth - 1]?.via ?? null,
        readIn: check.readIn,
      });

      // Only a miss on the response's own keys can be a rename of one of them.
      if (broken.depth === 1) {
        let best: { name: string; score: number } | null = null;
        for (const name of produced) {
          const sim = nameSimilarity(key, name);
          if (!best || sim.score > best.score) best = { name, score: sim.score };
        }
        if (best && best.score >= 0.55 && best.score < 0.97) {
          renameSuspects.push({
            consumed: key,
            produced: best.name,
            score: best.score,
            chain: [check.root, ...check.chain],
            line: check.line,
            file: check.file,
            snippet: check.snippet,
          });
        }
      }
    }

    if (missing.length === 0) continue;
    const unusedProduced = [...produced].filter((k) => !consumedNames.has(k) && !k.startsWith('...'));

    const ev: Evidence[] = [];
    const producedList = [...new Set(route.responseKeys.map((k) => k.name))];
    ev.push(codeEvidence(
      'api',
      route.file,
      route.responseLiteralLine ?? route.line,
      `Producer: ${route.method} ${route.path} sends { ${producedList.join(', ')} }`,
      `{ ${producedList.join(', ')} }`,
      route.handler ?? undefined,
    ));
    for (const m of missing.slice(0, 6)) {
      ev.push(codeEvidence(
        'api',
        m.file,
        m.line,
        m.via
          ? `Consumer reads ${q(m.chain.join('.'))} inside ${m.readIn ?? 'a helper'}; the value it receives has no ${q(m.key)} (${m.via})`
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
      // When the shape of the value at the failing hop is known, this is a proof
      // rather than a guess, so it does not need runtime corroboration.
      if (m.via) weight = Math.max(weight, 0.7);

      // A miss on the response's own keys blames the route. A miss one level in
      // blames the value behind a key, which is a different bug in a different
      // place, and saying otherwise would send a fixer to the wrong file.
      const statement = m.via && m.depth > 1
        ? `Consumer reads ${q(m.chain.join('.'))} inside ${m.readIn ?? 'a helper'}, but the value it is given has no ${q(m.key)}: ${m.via}.`
        : m.via
          ? `Consumer reads ${q(m.chain.join('.'))}, but the value behind ${q(m.chain[m.depth - 1])} has no ${q(m.key)}: ${m.via}.`
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
          readIn: m.readIn,
          consumerFile: m.file,
          consumerLine: m.line,
          consumerSnippet: m.snippet,
          routeMethod: route.method,
          routePath: route.path,
          routeFile: route.file,
          routeHandler: route.handler,
          producedKeys: producedList,
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
    findings.push(finding({
      agent: 'api',
      title: `Contract mismatch: ${route.method} ${route.path}`,
      summary: [
        `Consumer ${call.file}:${call.line} (${call.functionName ?? 'module scope'}) reads ${consumedList}.`,
        `Producer sends { ${producedList.join(', ')} }.`,
        unusedProduced.length > 0 ? `Fields sent but never read: ${unusedProduced.join(', ')}.` : '',
      ].filter(Boolean).join(' '),
      severity,
      confidence: Math.max(...mSignals.map((s) => s.weight), 0.3),
      impact: `Any request to ${route.method} ${route.path} produces undefined values in the consumer.`,
      files: [call.file, route.file],
      functions: [call.functionName, route.handler, ...missing.map((m) => m.readIn)].filter(Boolean) as string[],
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

