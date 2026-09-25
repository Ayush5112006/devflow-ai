/**
 * Runs one investigation agent at a time against a project so a failure can be
 * attributed to a single agent.
 *
 *   npx tsx scripts/probeAgent.ts <agentId> [projectPath] [bugId]
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { buildCodeIndex } from '../src/analysis/codeIndex.js';
import { deriveExpectations } from '../src/analysis/expectations.js';
import { config } from '../src/config.js';
import { clearReadCache } from '../src/utils/fsSafe.js';
import { id as makeId } from '../src/utils/id.js';
import type { AgentId, EvidenceAttachment } from '../src/types/index.js';
import type { AgentDefinition, AgentResult } from '../src/agents/types.js';
import { runAgentSafely } from '../src/agents/types.js';
import { codeAgent } from '../src/agents/code/codeAgent.js';
import { apiAgent } from '../src/agents/api/apiAgent.js';
import { databaseAgent } from '../src/agents/database/databaseAgent.js';
import { testAgent } from '../src/agents/testing/testAgent.js';
import { evidenceAgent } from '../src/agents/evidence/evidenceAgent.js';
import { historyAgent } from '../src/agents/history/historyAgent.js';
import { loadDemoBug } from '../src/repositories/demoCatalog.js';

const log = (m: string) => process.stderr.write(`${m}\n`);

const AGENTS: Record<string, AgentDefinition> = {
  code: codeAgent,
  api: apiAgent,
  database: databaseAgent,
  test: testAgent,
  evidence: evidenceAgent,
  history: historyAgent,
};

async function main() {
  const agentId = (process.argv[2] ?? 'code') as AgentId;
  const root = path.resolve(process.argv[3] ?? path.join(config.demoDir, 'projects', 'insightboard'));
  const bugId = process.argv[4] ?? 'd1';

  const agent = AGENTS[agentId];
  if (!agent) throw new Error(`unknown agent ${agentId}`);

  clearReadCache();
  const bug = await loadDemoBug(bugId);
  const dir = path.join(config.demoDir, 'evidence', bugId);
  const evidence: EvidenceAttachment[] = [];
  for (const name of await fs.readdir(dir)) {
    const content = await fs.readFile(path.join(dir, name), 'utf8');
    evidence.push({
      id: makeId('att'),
      name,
      kind: name.includes('console') || name.includes('log') ? 'log' : 'http',
      bytes: content.length,
      excerpt: content,
      addedAt: new Date().toISOString(),
    });
  }

  log(`[probe] indexing ${root}`);
  const index = await buildCodeIndex(root);
  log(`[probe] routes=${index.routes.length} clients=${index.clientCalls.length} tables=${index.tables.length} queries=${index.queries.length} tests=${index.tests.length}`);
  for (const r of index.routes) {
    log(`  route ${r.method} ${r.path} [${r.file}:${r.line}] handler=${r.handler} keys={${r.responseKeys.map((k) => k.name).join(', ')}}`);
  }
  for (const c of index.clientCalls) {
    log(`  call  ${c.method} ${c.url ?? '?'} (${c.urlSource}) [${c.file}:${c.line}] in ${c.functionName ?? '<module>'} helper=${c.helper ?? '-'}`);
  }

  const expectations = deriveExpectations(evidence);
  log(`[probe] expectations missingProps=${JSON.stringify(expectations.missingProperties.map((m) => m.name))}`);
  log(`[probe] expectations dbErrors=${JSON.stringify(expectations.databaseErrors.map((d) => d.message))}`);
  log(`[probe] expectations frames=${JSON.stringify(expectations.frames.map((f) => `${f.file}:${f.line}`))}`);
  log(`[probe] expectations malformedPaths=${JSON.stringify(expectations.malformedPaths.map((m) => m.path))}`);

  log(`[probe] running ${agentId}`);
  const { run, result } = await runAgentSafely(
    agent,
    {
      investigationId: 'probe',
      workspacePath: root,
      index,
      expectations,
      bug: bug.report,
      evidence,
      note: (m) => log(`[note] ${m}`),
    },
    { onStart: () => log(`[start] ${agent.title}`), onFinish: (r) => log(`[done] ${r.status} findings=${r.findingCount} signals=${r.signalCount} ${r.durationMs}ms`) },
  );

  log(`\n=== run ${run.agent} ${run.status} ${run.durationMs}ms ===`);
  if (run.error) log(`error: ${run.error.message}`);
  printResult(result);
}

function printResult(result: AgentResult | null) {
  if (!result) return;
  for (const f of result.findings) {
    log(`\n--- finding [${f.severity}] ${f.title} (confidence ${f.confidence})`);
    log(f.summary);
    if (f.impact) log(`impact: ${f.impact}`);
    if (f.files?.length) log(`files: ${f.files.join(', ')}`);
    for (const e of f.evidence ?? []) log(`  ev[${e.kind}] ${e.description}${e.snippet ? ` | ${e.snippet.replace(/\s+/g, ' ').slice(0, 120)}` : ''}`);
  }
  const signals = [...(result.findings.flatMap((f) => f.signals) ?? []), ...(result.signals ?? [])];
  if (signals.length > 0) {
    log('\n=== signals ===');
    for (const s of signals.sort((a, b) => b.weight - a.weight)) {
      log(`[${s.weight.toFixed(2)}] ${s.source}/${s.kind} :: ${s.subject} :: ${s.statement}`);
    }
  }
}

main().catch((err: unknown) => {
  log(`FATAL ${err instanceof Error ? err.message : String(err)}`);
  log(err instanceof Error ? (err.stack ?? '') : '');
  process.exit(1);
});
