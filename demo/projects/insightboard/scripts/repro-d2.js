/**
 * Reproduction for the reported "dashboard is empty, 404 on every request" bug.
 *
 * Mirrors how Vite substitutes import.meta.env at build time: only the vars
 * declared in the env files exist, everything else becomes undefined.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnvFile(file) {
  const env = {};
  const text = fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const buildEnv = { ...readEnvFile('.env'), ...readEnvFile('.env.local') };

// web/api.js line 2:  const API_BASE = import.meta.env.VITE_API_BASE;
const API_BASE = buildEnv.VITE_API_BASE;

console.log('declared env keys:', Object.keys(buildEnv).join(', '));
console.log('import.meta.env.VITE_API_BASE =', API_BASE);

const url = `${API_BASE}/api/predictions`;
console.log('fetch target:', url);

let parsed;
try {
  parsed = new URL(url);
} catch {
  parsed = null;
}

if (!parsed || !/^https?:$/.test(parsed.protocol)) {
  console.error(`\nREPRODUCED: request URL is not absolute — the browser resolves it relative to the page origin.`);
  console.error(`Browser requests: GET ${url} -> static server answers 404 with an HTML body`);
  console.error('response.json() then throws SyntaxError: Unexpected token \'<\'');
  process.exit(1);
}

console.log(`\nNOT REPRODUCED: request URL is absolute (${parsed.href})`);
