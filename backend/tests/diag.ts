import path from 'node:path';
import { buildCodeIndex } from '../src/analysis/codeIndex.js';
import { config } from '../src/config.js';

const root = path.join(config.demoDir, 'projects', 'insightboard');
const index = await buildCodeIndex(root);

for (const c of index.contractChecks) {
  const hops = c.hops.map((h) => (h.keys ? `[${h.keys.join(',')}]` : '[?]')).join(' -> ');
  const verdict = verdictOf(c);
  console.log(`${c.file}:${c.line}  root+${c.chain.join('.')}  readIn=${c.readIn ?? '-'}  ${verdict}`);
  console.log(`   hops ${hops}`);
}
console.log(`total=${index.contractChecks.length}`);

function verdictOf(c: { hops: { keys: string[] | null }[]; chain: string[] }): string {
  for (let i = 0; i < c.chain.length; i += 1) {
    const shape = c.hops[i];
    if (!shape || !shape.keys) return 'unknown-after';
    if (!shape.keys.includes(c.chain[i])) return `MISSING "${c.chain[i]}" at depth ${i + 1}`;
  }
  return 'ok';
}
