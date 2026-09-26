/**
 * End-to-end smoke test over HTTP: quickstart -> approve -> implement, then
 * read /api/pipeline to confirm the dashboard has real measured numbers to
 * show. Run against a live server.
 *
 *   npx tsx scripts/e2eFlow.ts [baseUrl] [bugId]
 */
const base = process.argv[2] ?? 'http://localhost:4111';
const bugId = process.argv[3] ?? 'd3';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

const waitFor = async (id: string, want: string[], timeoutMs = 120_000) => {
  const started = Date.now();
  for (;;) {
    const { investigation } = await call<{ investigation: any }>(`/api/investigations/${id}`);
    if (want.includes(investigation.status)) return investigation;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`timed out in status "${investigation.status}" (wanted ${want.join('|')})`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
};

async function main() {
  console.log(`→ quickstart ${bugId}`);
  const { investigation } = await call<{ investigation: any }>(
    `/api/investigations/demo/${bugId}/quickstart`,
    { method: 'POST' },
  );
  const id = investigation.id;
  console.log(`  id=${id}`);

  const planned = await waitFor(id, ['awaiting_approval', 'failed']);
  if (planned.status === 'failed') throw new Error('investigation failed before approval');
  console.log(`  root cause: ${planned.rootCause?.hypotheses?.[0]?.statement ?? '(none)'}`);
  console.log(`  plan hash: ${planned.changePlan?.planHash?.slice(0, 12)}…`);
  console.log(`  changes:   ${planned.changePlan?.changes?.length ?? 0}`);

  console.log('→ approve');
  await call(`/api/investigations/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'e2e', note: 'smoke test' }),
  });

  await call(`/api/investigations/${id}/implement`, { method: 'POST' });
  const done = await waitFor(id, ['completed', 'failed'], 300_000);
  if (done.status === 'failed') {
    throw new Error(`investigation failed: ${JSON.stringify(done.errors).slice(0, 400)}`);
  }

  console.log(`\n=== implementation ===`);
  const impl = done.implementation;
  console.log(`  status: ${impl?.status ?? '(none)'}  filesModified: ${impl?.filesModified?.length ?? 0}`);
  for (const c of impl?.appliedChanges ?? []) {
    console.log(`    [${c.status}] ${c.file}${c.note ? ` — ${c.note}` : ''}`);
    if (c.diff) console.log(`      diff: ${c.diff.split('\n').join(' / ').slice(0, 160)}`);
  }
  for (const n of impl?.notes ?? []) console.log(`    note: ${n}`);

  console.log(`\n=== verification ===`);
  for (const c of done.verification?.checks ?? []) {
    const out = (c.output ?? '').split('\n').filter(Boolean).slice(0, 2).join(' | ').slice(0, 150);
    console.log(`    [${c.status}] ${c.name}${out ? `: ${out}` : ''}`);
  }

  console.log(`\n=== regression ===`);
  const r = done.regression;
  console.log(`  ${r?.summary ?? '(none)'} — passed=${r?.passed ?? 0} failed=${r?.failed ?? 0}`);

  console.log(`\n=== completed ===`);
  console.log(`  status:  ${done.status}`);
  console.log(`  metrics:    ${JSON.stringify(done.metrics, null, 0).slice(0, 400)}`);

  const pipeline = await call<any>('/api/pipeline');
  console.log('\n=== GET /api/pipeline ===');
  console.log(`  agents:        ${pipeline.parallelAgentCount}`);
  console.log(`  human gates:   ${pipeline.humanGateCount} (${pipeline.humanGateStages.join(', ')})`);
  console.log(`  sample size:   ${pipeline.sampleSize}`);
  if (pipeline.observed) {
    const o = pipeline.observed;
    console.log(`  observed total: ${o.minTotalMs}–${o.maxTotalMs}ms (median ${o.medianTotalMs}ms)`);
    console.log(`  manual steps:   ${o.medianManualSteps}`);
    console.log(`  agents used:    ${o.medianAgentsUsed}`);
  } else {
    console.log('  observed:      null — dashboard will show "no duration claimed"');
  }
}

main().catch((err) => {
  console.error('\nE2E FAILED:', err.message);
  process.exit(1);
});
