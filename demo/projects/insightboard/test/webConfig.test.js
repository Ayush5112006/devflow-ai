import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function declaredEnvKeys(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const keys = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (m) keys.add(m[1]);
  }
  return keys;
}

test('every env var read by the web bundle is declared in .env.example', () => {
  const declared = declaredEnvKeys('.env.example');
  const sources = ['web/api.js', 'web/app.js', 'web/lib/format.js'];

  const undeclared = [];
  for (const rel of sources) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const m of text.matchAll(/import\.meta\.env\.([A-Z][A-Z0-9_]*)/g)) {
      if (!declared.has(m[1])) undeclared.push(`${rel} reads import.meta.env.${m[1]}`);
    }
  }

  assert.deepEqual(
    undeclared,
    [],
    `web code reads env vars that are not declared:\n  ${undeclared.join('\n  ')}`,
  );
});

test('every env var read by the server is declared in .env.example', () => {
  const declared = declaredEnvKeys('.env.example');
  const undeclared = [];
  for (const rel of ['server/index.js', 'server/services/billingClient.js']) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      if (!declared.has(m[1])) undeclared.push(`${rel} reads process.env.${m[1]}`);
    }
  }
  assert.deepEqual(undeclared, []);
});
