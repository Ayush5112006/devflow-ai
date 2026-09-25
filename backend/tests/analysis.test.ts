/** Focused unit checks for the source-analysis primitives. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankNonCode, lineAt, matchBrace, matchParen, objectKeys,
} from '../src/analysis/lexer.js';
import {
  buildCodeIndex, collectFunctionRanges, enclosingFunctionRange, extractColumnRefs,
  extractTables, firstArgument, matchRoute, nameSimilarity, resolveTableAlias,
  splitArguments, toRepoPath, type RouteDef,
} from '../src/analysis/codeIndex.js';
import { findDatabaseErrors, parseRuntimeErrors } from '../src/analysis/evidenceParse.js';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { config } from '../src/config.js';

const TEMPLATE_URL = '`${API_BASE}/api/predictions/${id}`';
const TEMPLATE_BASE = '`${API_BASE}/api/predictions`';

/* ------------------------------------------------------------------ */

test('blankNonCode preserves offsets and newlines', () => {
  const src = 'const a = "hello";\n// note\nconst b = 1;\n';
  const out = blankNonCode(src);
  assert.equal(out.length, src.length);
  assert.equal(lineAt(out, src.indexOf('const b')), 3);
});

test('blankNonCode keeps string bodies when asked', () => {
  const src = 'const a = "hello";';
  const out = blankNonCode(src, { stripStrings: false });
  assert.match(out, /"hello"/);
  assert.equal(out.length, src.length);
});

test('matchBrace and matchParen find the balanced end', () => {
  const src = 'function f() { if (a) { b(); } }';
  const open = src.indexOf('{');
  assert.equal(src[matchBrace(blankNonCode(src), open)], '}');
  const paren = src.indexOf('(');
  assert.equal(src[matchParen(blankNonCode(src), paren)], ')');
});

test('objectKeys finds keys of a nested literal without leaking values', () => {
  const src = 'res.json(200, { predictions: listPredictions(), total: 1, prediction, meta: { a: 1 } });';
  const blanked = blankNonCode(src);
  const open = src.indexOf('{');
  const keys = objectKeys(src, blanked, open).map((k) => k.name);
  assert.deepEqual(keys, ['predictions', 'total', 'prediction', 'meta']);
});

test('objectKeys handles a status-first response call', () => {
  const src = 'res.json(404, { error: "not_found" })';
  const open = src.indexOf('{');
  const keys = objectKeys(src, blankNonCode(src), open).map((k) => k.name);
  assert.deepEqual(keys, ['error']);
});

test('collectFunctionRanges finds inline arrow bodies', () => {
  const src = [
    "router.get('/a', (req, res) => {",
    '  res.json(200, { a: 1 });',
    '});',
    'export function other() {',
    '  return 2;',
    '}',
  ].join('\n');
  const ranges = collectFunctionRanges(blankNonCode(src));
  assert.ok(ranges.some((r) => r.startLine === 1 && r.endLine === 3));
  assert.ok(ranges.some((r) => r.name === 'other' && r.endLine === 6));
});

test('enclosingFunctionRange returns the innermost containing function', () => {
  const src = 'function a() {\n  const x = 1;\n}\nfunction b() {\n  const y = 2;\n}\n';
  const ranges = collectFunctionRanges(blankNonCode(src));
  const hit = enclosingFunctionRange(ranges, 5, 6);
  assert.equal(hit.name, 'b');
});

test('firstArgument ignores commas inside nested objects and later args', () => {
  const src = 'fetch(`/v1/charges`, { method: "POST", body: JSON.stringify({ a: 1, b: 2 }) });';
  const open = src.indexOf('(');
  const close = matchParen(blankNonCode(src), open);
  assert.equal(firstArgument(src, blankNonCode(src), open, close), '`/v1/charges`');
  const { rest } = splitArguments(src, blankNonCode(src), open, close);
  assert.match(rest, /method/);
  assert.ok(!rest.includes('`/v1/charges`'));
});

/* ------------------------------------------------------------------ */
/* SQL                                                                 */
/* ------------------------------------------------------------------ */

test('extractTables finds joined tables', () => {
  const sql = 'SELECT p.id FROM predictions p JOIN feedback f ON f.id = p.feedback_id';
  assert.deepEqual(extractTables(sql).sort(), ['feedback', 'predictions']);
});

test('extractColumnRefs ignores output aliases', () => {
  const refs = extractColumnRefs('SELECT COUNT(*) AS n FROM feedback').map((r) => r.column);
  assert.deepEqual(refs, []);
});

test('extractColumnRefs keeps aggregate arguments', () => {
  const refs = extractColumnRefs('SELECT status, SUM(amount) AS total FROM orders GROUP BY status').map((r) => r.column);
  assert.deepEqual(refs.sort(), ['amount', 'status']);
});

test('extractColumnRefs attributes qualified columns through aliases', () => {
  const sql = 'SELECT p.id, p.label, f.customer FROM predictions p JOIN feedback f ON f.id = p.feedback_id';
  const refs = extractColumnRefs(sql);
  const customer = refs.find((r) => r.column === 'customer');
  assert.equal(customer?.table, 'feedback');
  const label = refs.find((r) => r.column === 'label');
  assert.equal(label?.table, 'predictions');
});

test('extractColumnRefs does not treat ORDER BY direction as a column', () => {
  const refs = extractColumnRefs('SELECT o.id FROM orders o ORDER BY o.id ASC').map((r) => r.column);
  assert.deepEqual(refs, ['id']);
});

test('extractColumnRefs reads UPDATE set targets', () => {
  const refs = extractColumnRefs('UPDATE orders SET status = ?, total = ? WHERE id = ?').map((r) => r.column);
  assert.deepEqual(refs.sort(), ['id', 'status', 'total']);
});

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

test('parseRuntimeErrors extracts the missing property name', () => {
  const errs = parseRuntimeErrors("TypeError: Cannot read properties of undefined (reading 'label')");
  assert.equal(errs[0].kind, 'null-property-access');
  assert.equal(errs[0].subject, 'label');
});

test('parseRuntimeErrors terminates on repeated input', () => {
  const text = "TypeError: Cannot read properties of undefined (reading 'label')".repeat(200);
  assert.ok(parseRuntimeErrors(text).length <= 200);
});

test('findDatabaseErrors keeps the offending column name', () => {
  const errs = findDatabaseErrors('{"error":"internal_error","message":"no such column: o.customer_name"}');
  assert.equal(errs[0].message, 'no such column: o.customer_name');
});

/* ------------------------------------------------------------------ */
/* Route matching                                                      */
/* ------------------------------------------------------------------ */

function route(path: string, keys: string[]): RouteDef {
  return {
    id: path, framework: 'router', method: 'GET', path, file: 'r.js', line: 1,
    handler: null, responseKeys: keys.map((name) => ({ name, line: 1, offset: 0, kind: 'scalar' as const, value: '' })),
    responseLiteralLine: 1, responseShapes: {}, envRefs: [], sql: [],
  };
}

test('matchRoute prefers a parameterised route over the collection', () => {
  const routes = [route('/api/predictions', ['predictions']), route('/api/predictions/:id', ['prediction'])];
  assert.equal(matchRoute(routes, '/api/predictions/1')?.path, '/api/predictions/:id');
  assert.equal(matchRoute(routes, '/api/predictions')?.path, '/api/predictions');
});

test('matchRoute ignores a query string', () => {
  const routes = [route('/api/orders', ['orders'])];
  assert.equal(matchRoute(routes, '/api/orders?limit=5')?.path, '/api/orders');
});

test('nameSimilarity ranks a real rename highly', () => {
  const { score } = nameSimilarity('customer_name', 'customer');
  assert.ok(score > 0.3, `expected > 0.3, got ${score}`);
});

/* ------------------------------------------------------------------ */
/* End to end against the demo project                                 */
/* ------------------------------------------------------------------ */

const DEMO_ROOT = path.join(config.demoDir, 'projects', 'insightboard');

test('alias resolution finds the real table behind an alias', async () => {
  const index = await buildCodeIndex(DEMO_ROOT);
  assert.equal(resolveTableAlias(index, 'o'), 'orders');
});

test('indexer sees the demo routes, clients and tables', async () => {
  const index = await buildCodeIndex(DEMO_ROOT);
  const paths = index.routes.map((r) => `${r.method} ${r.path}`);
  assert.ok(paths.includes('GET /api/predictions/:id'), paths.join(', '));
  assert.ok(index.tables.some((t) => t.name === 'orders'));
  assert.ok(index.clientCalls.some((c) => c.url === '/api/predictions'), 'helper URL resolution');
});

test('a URL builder parameter becomes a wildcard, not a dropped segment', async () => {
  const index = await buildCodeIndex(DEMO_ROOT);
  // `predictionUrl(id)` inlines to `${API_BASE}/api/predictions/${id}`.
  const detail = index.clientCalls.find(
    (c) => c.file === 'web/app.js' && c.helper?.startsWith('predictionUrl@'),
  );
  assert.equal(detail?.url, '/api/predictions/*');
  const route = matchRoute(index.routes, detail?.url);
  assert.equal(route?.path, '/api/predictions/:id');
});

test('response shapes resolve the nested value behind a response key', async () => {
  const index = await buildCodeIndex(DEMO_ROOT);
  const orders = index.routes.find((r) => r.path === '/api/orders/:id');
  assert.deepEqual(orders?.responseKeys.map((k) => k.name), ['error', 'order']);
  assert.ok(orders?.responseShapes.order, `no shape resolved: ${JSON.stringify(orders?.responseShapes)}`);
});

test('a view mapper defines the shape, not the query behind it', async () => {
  const index = await buildCodeIndex(DEMO_ROOT);
  const detail = index.routes.find((r) => r.path === '/api/predictions/:id');
  // `getPrediction` runs a JOIN, but returns `toPredictionView(row)`, so the
  // view's keys are what a caller actually receives.
  assert.deepEqual(detail?.responseShapes.prediction?.keys.sort(), [
    'confidence', 'createdAt', 'feedbackId', 'id', 'label', 'tone',
  ]);
});

test('a read one function below the fetch is checked against the route shape', async () => {
  const index = await buildCodeIndex(DEMO_ROOT);
  // `renderDetail` receives `payload.prediction`; it must not read one level
  // deeper than the view mapper produces.
  const deep = index.contractChecks.find(
    (c) => c.file === 'web/app.js' && c.line === 35 && c.readIn === 'renderDetail',
  );
  assert.ok(deep, 'the renderDetail read was not traced back to the route');
  assert.deepEqual(deep.chain, ['prediction', 'label']);
  assert.ok(!deep.hops[0].keys?.includes('prediction'), 'view shape should not contain `prediction`');
});

test('contract checks do not leak between sibling functions', async () => {
  const index = await buildCodeIndex(DEMO_ROOT);
  // `payload.prediction` in loadPredictionDetail must be judged against
  // /api/predictions/:id, never against the collection route.
  const crossed = index.contractChecks.filter(
    (c) => c.file === 'web/app.js' && c.chain[0] === 'prediction'
      && c.route.path === '/api/predictions',
  );
  assert.deepEqual(crossed, []);
});

test('a container or browser path resolves to the indexed repository path', async () => {
  const index = await buildCodeIndex(DEMO_ROOT);
  assert.equal(toRepoPath(index, 'web/app.js'), 'web/app.js');
  assert.equal(toRepoPath(index, '/app/web/app.js'), 'web/app.js');
  assert.equal(toRepoPath(index, 'http://localhost:5173/app.js'), 'web/app.js');
  assert.equal(toRepoPath(index, '/app/server/services/orderService.js'),
    'server/services/orderService.js');
  assert.equal(toRepoPath(index, 'not/in/this/repo.ts'), null);
});

/* --- end to end: each bug must resolve to its own cause --- */

async function rootCauseFor(bugId: string) {
  const fs = await import('node:fs/promises');
  const { deriveExpectations } = await import('../src/analysis/expectations.js');
  const { managerAgent } = await import('../src/agents/manager/managerAgent.js');
  const { runRootCauseEngine } = await import('../src/agents/rootCause/rootCauseAgent.js');
  const { loadDemoBug } = await import('../src/repositories/demoCatalog.js');
  const { id: makeId } = await import('../src/utils/id.js');

  const bug = await loadDemoBug(bugId);
  const dir = path.join(config.demoDir, 'evidence', bugId);
  const names = await fs.readdir(dir);
  const evidence = [];
  for (const name of names) {
    const excerpt = await fs.readFile(path.join(dir, name), 'utf8');
    evidence.push({
      id: makeId('att'), name,
      kind: name.includes('console') || name.includes('log') ? ('log' as const) : ('http' as const),
      bytes: excerpt.length, excerpt, addedAt: '2026-01-01T00:00:00.000Z',
    });
  }

  const index = await buildCodeIndex(DEMO_ROOT);
  const expectations = deriveExpectations(evidence);
  const agentCtx = {
    investigationId: `t-${bugId}`,
    workspacePath: DEMO_ROOT,
    index,
    expectations,
    bug: bug.report,
    evidence,
    note: () => {},
  };
  const { signals, findings } = await managerAgent.investigate(agentCtx, {});
  if (signals.length === 0) {
    throw new Error(`no signals produced for ${bugId}; evidence=${evidence.length}`);
  }
  const { rootCause } = await runRootCauseEngine(agentCtx, signals, findings);
  return rootCause;
}

test('d1 resolves to the API contract mismatch, not another bug in the repo', async () => {
  const rc = await rootCauseFor('d1');
  assert.equal(rc.hypotheses[0].category, 'API contract mismatch');
  assert.equal(rc.hypotheses[0].subject, 'prediction');
  assert.equal(rc.hypotheses[0].status, 'supported');
  // The undeclared env var is a genuine defect, but it is bug d2's cause and
  // must not be selected for d1.
  const envHyp = rc.hypotheses.find((h) => h.category === 'Undeclared environment variable');
  assert.ok(envHyp, 'the env var should still be surfaced');
  assert.equal(envHyp.status, 'rejected');
});

test('d2 resolves to the undeclared environment variable', async () => {
  const rc = await rootCauseFor('d2');
  assert.equal(rc.hypotheses[0].category, 'Undeclared environment variable');
  assert.equal(rc.hypotheses[0].subject, 'VITE_API_BASE');
  assert.equal(rc.hypotheses[0].status, 'supported');
});

test('d3 resolves to the missing database column', async () => {
  const rc = await rootCauseFor('d3');
  assert.equal(rc.hypotheses[0].category, 'Database schema mismatch');
  assert.equal(rc.hypotheses[0].subject, 'customer_name');
  assert.equal(rc.hypotheses[0].status, 'supported');
});

test('a root cause never restates the symptom it is meant to explain', async () => {
  for (const bugId of ['d1', 'd2', 'd3']) {
    const rc = await rootCauseFor(bugId);
    assert.notEqual(
      rc.hypotheses[0].category, 'Runtime null/undefined access',
      `${bugId} selected the reported TypeError as its own root cause`,
    );
  }
});

void pathToFileURL;
void TEMPLATE_URL;
void TEMPLATE_BASE;
