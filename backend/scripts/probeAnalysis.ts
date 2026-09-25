/**
 * Development probe. Runs the code indexer and the six investigation agents
 * against a project and prints what they found, so the analysis engine can be
 * inspected without starting the server.
 *
 *   npx tsx scripts/probeAnalysis.ts <projectPath> [bugId]
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { buildCodeIndex, buildProjectMap } from '../src/analysis/codeIndex.js';
import { deriveExpectations } from '../src/analysis/expectations.js';
import { managerAgent } from '../src/agents/manager/managerAgent.js';
import { runRootCauseEngine } from '../src/agents/rootCause/rootCauseAgent.js';
import { generateChangePlan } from '../src/agents/rootCause/changePlan.js';
import { loadDemoBug } from '../src/repositories/demoCatalog.js';
import { config } from '../src/config.js';
import { clearReadCache } from '../src/utils/fsSafe.js';
import type { EvidenceAttachment } from '../src/types/index.js';
import { id as makeId } from '../src/utils/id.js';

const target = process.argv[2] ?? path.join(config.demoDir, 'projects', 'insightboard');
const bugId = process.argv[3] ?? 'd1';
const root = path.resolve(target);

async function main() {
  clearReadCache();
  const bug = await loadDemoBug(bugId);
  const abs = path.join(config.demoDir, 'evidence', bugId);
  const files = await fs.readdir(abs);

  const evidence: EvidenceAttachment[] = [];
  for (const name of files) {
    const content = await fs.readFile(path.join(abs, name), 'utf8');
    evidence.push({
      id: makeId('att'),
      name,
      kind: name.includes('console') || name.includes('log') ? 'log' : 'http',
      bytes: content.length,
      excerpt: content,
      addedAt: new Date().toISOString(),
    });
  }

  console.log(`\n=== INDEX: ${root} ===`);
  const index = await buildCodeIndex(root);
  const map = buildProjectMap(index);
  console.log(`files=${index.fileCount} routes=${index.routes.length} clients=${index.clientCalls.length} tables=${index.tables.length} queries=${index.queries.length} tests=${index.tests.length} envRefs=${index.envRefs.length} declared=${index.envDeclarations.length}`);
  console.log(`frameworks=${index.frameworks.join(', ')}  runner=${index.testRunner}`);

  console.log('\n--- routes ---');
  for (const r of index.routes) {
    console.log(`  ${r.method} ${r.path}  [${r.file}:${r.line}]  keys={${r.responseKeys.map((k) => k.name).join(', ')}}`);
  }
  console.log('\n--- client calls ---');
  for (const c of index.clientCalls) {
    console.log(`  ${c.client}.${c.method} ${c.url ?? c.urlExpression}  [${c.file}:${c.line}] in ${c.functionName ?? '<module>'}`);
    console.log(`      accesses: ${c.accesses.slice(0, 8).map((a) => a.chain.join('.')).join(' | ')}`);
  }
  console.log('\n--- tables ---');
  for (const t of index.tables) console.log(`  ${t.name} [${t.file}:${t.line}]: ${t.columns.map((x) => x.name).join(', ')}`);
  console.log('\n--- queries ---');
  for (const q of index.queries) console.log(`  [${q.file}:${q.line}] tables=${q.tables.join(',')} cols=${q.columns.join(',')}`);
  console.log('\n--- env ---');
  console.log(`  declared: ${index.envDeclarations.map((d) => `${d.name}@${d.file}:${d.line}`).join(', ') || 'none'}`);
  console.log(`  read:     ${index.envRefs.map((r) => `${r.name}@${r.file}:${r.line}`).join(', ') || 'none'}`);

  console.log(`\n=== INVESTIGATE (bug ${bugId}: ${bug.report.title}) ===`);
  const expectations = deriveExpectations(evidence);
  console.log(`expectations: missingProps=${JSON.stringify(expectations.missingProperties)} frames=${expectations.frames.length} dbErrors=${expectations.databaseErrors.length} malformed=${JSON.stringify(expectations.malformedPaths.map((m) => m.path))}`);

  const notes: string[] = [];
  const { runs, findings, signals } = await managerAgent.investigate(
    {
      investigationId: 'probe',
      workspacePath: root,
      index,
      expectations,
      bug: bug.report,
      evidence,
      note: (m) => notes.push(m),
    },
    {
      onAgentStart: (a) => console.log(`  [start] ${a.title}`),
      onAgentNote: (a, m) => console.log(`  [note ] ${a.id}: ${m}`),
      onAgentFinish: (r) => console.log(`  [done ] ${r.title}: ${r.status} (${r.findingCount} findings, ${r.signalCount} signals, ${r.durationMs}ms) ${r.error?.message ?? ''}`),
    },
  );

  console.log(`\nruns: ${runs.length}, findings: ${findings.length}, signals: ${signals.length}`);
  console.log('\n=== SIGNALS (sorted by weight) ===');
  for (const s of [...signals].sort((a, b) => b.weight - a.weight)) {
    console.log(`  [${s.weight.toFixed(2)}] (${s.source}/${s.kind}) ${s.subject}\n      ${s.statement}`);
  }

  const agentCtx = {
    investigationId: 'probe',
    workspacePath: root,
    index,
    expectations,
    bug: bug.report,
    evidence,
    note: (m: string) => notes.push(m),
  };

  const { rootCause } = await runRootCauseEngine(agentCtx, signals, findings);
  console.log(`\n=== ROOT CAUSE (confidence ${rootCause.confidence.toFixed(2)}, margin ${rootCause.margin.toFixed(2)}) ===`);
  console.log(`  ${rootCause.statement}`);
  console.log(`  ${rootCause.detail}`);
  console.log('  hypotheses:');
  for (const h of rootCause.hypotheses) {
    console.log(`    [${h.status}] score=${h.score.toFixed(2)} ${h.category} — ${h.statement}`);
  }

  const plan = generateChangePlan({
    investigationId: 'probe',
    rootCause,
    index,
    expectations,
  });
  console.log(`\n=== CHANGE PLAN (hash ${plan.planHash.slice(0, 12)}…) ===`);
  console.log(`  ${plan.summary}`);
  for (const change of plan.changes) {
    console.log(`  - ${change.file}  ${change.currentBehavior} → ${change.requiredChange}`);
    console.log(`      ${change.reason}`);
  }
  if (plan.remediations.length > 0) {
    console.log('  remediations:');
    for (const r of plan.remediations) console.log(`    - [${r.risk}] ${r.title}`);
  }
  if (plan.consideredAndRejected.length > 0) {
    console.log('  considered and rejected:');
    for (const c of plan.consideredAndRejected) console.log(`    - ${c.statement}: ${c.why}`);
  }

  console.log(`\ncomponents: ${map.components.map((c) => `${c.layer}:${c.files.length}`).join(', ')}`);
  console.log(`path edges: ${map.path.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
