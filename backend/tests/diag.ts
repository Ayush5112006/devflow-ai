import fs from 'node:fs';
import path from 'node:path';
import { buildCodeIndex } from '../src/analysis/codeIndex.js';
import { config } from '../src/config.js';

const root = path.join(config.demoDir, 'projects', 'insightboard');
const index = await buildCodeIndex(root);

for (const c of index.clientCalls) {
  console.log(`${c.file}:${c.line} url=${c.url ?? '?'} expr=${JSON.stringify(c.urlExpression)}`);
}

const src = fs.readFileSync(path.join(root, 'web', 'api.js'), 'utf8');
const line14 = src.split('\n')[13];
console.log('line14 =', JSON.stringify(line14));
const m = /`([^`]*)`/.exec(line14);
console.log('template =', JSON.stringify(m?.[1]));
const normalised = (m?.[1] ?? '').replace(/\/(\s*)\$\{[^}]*\}|\$\{[^}]*\}/g, (mm, slash) => (slash ? '/*' : ''));
console.log('normalised =', JSON.stringify(normalised));
