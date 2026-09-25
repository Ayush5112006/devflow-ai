/**
 * Integration test: index the InsightBoard demo project and verify the
 * expected signals are extracted for each of the three demo bugs.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCodeIndex } from '../src/analysis/codeIndex.js';
import { deriveExpectations } from '../src/analysis/expectations.js';
import { clearReadCache } from '../src/utils/fsSafe.js';
import type { CodeIndex } from '../src/analysis/codeIndex.js';
import { loadDemoBug } from '../src/repositories/demoCatalog.js';
import { id as makeId } from '../src/utils/id.js';
import type { EvidenceAttachment } from '../src/types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INSIGHTBOARD = path.resolve(__dirname, '../../demo/projects/insightboard');

let index: CodeIndex;

describe('CodeIndex — InsightBoard project', () => {
  before(async () => {
    clearReadCache();
    index = await buildCodeIndex(INSIGHTBOARD);
  });

  it('indexes files', () => {
    assert.ok(index.fileCount > 0, 'should find files');
  });

  it('detects at least one HTTP route', () => {
    assert.ok(index.routes.length > 0, `routes: ${JSON.stringify(index.routes.map((r) => `${r.method} ${r.path}`))}`);
  });

  it('detects client calls in the web bundle', () => {
    assert.ok(index.clientCalls.length > 0, 'should find at least one fetch/axios call');
  });

  it('finds the orders SQL table or model', () => {
    const hasOrders = index.tables.some((t) => /order/i.test(t.name))
      || index.models.some((m) => /order/i.test(m.name));
    assert.ok(hasOrders, `tables: ${index.tables.map((t) => t.name)}`);
  });

  it('detects test files', () => {
    assert.ok(index.tests.length > 0, 'should find test cases');
  });
});

describe('EvidenceExpectations — Demo Bug D1', () => {
  it('extracts the missing property from the browser console log', async () => {
    const bug = await loadDemoBug('d1');
    const evidence: EvidenceAttachment[] = bug.evidence.map((e) => ({
      id: makeId('att'),
      name: e.name,
      kind: e.kind,
      bytes: e.content.length,
      excerpt: e.content,
      addedAt: new Date().toISOString(),
    }));
    const exp = deriveExpectations(evidence);
    assert.ok(exp.missingProperties.length > 0, 'should detect missing property from TypeError');
  });
});

describe('EvidenceExpectations — Demo Bug D2', () => {
  it('detects /undefined/ in logged request paths', async () => {
    const bug = await loadDemoBug('d2');
    const evidence: EvidenceAttachment[] = bug.evidence.map((e) => ({
      id: makeId('att'),
      name: e.name,
      kind: e.kind,
      bytes: e.content.length,
      excerpt: e.content,
      addedAt: new Date().toISOString(),
    }));
    const exp = deriveExpectations(evidence);
    assert.ok(exp.malformedPaths.length > 0 || exp.jsonParseFailures.length > 0,
      'should detect malformed paths or JSON parse failures');
  });
});

describe('EvidenceExpectations — Demo Bug D3', () => {
  it('extracts database error with column name', async () => {
    const bug = await loadDemoBug('d3');
    const evidence: EvidenceAttachment[] = bug.evidence.map((e) => ({
      id: makeId('att'),
      name: e.name,
      kind: e.kind,
      bytes: e.content.length,
      excerpt: e.content,
      addedAt: new Date().toISOString(),
    }));
    const exp = deriveExpectations(evidence);
    assert.ok(exp.databaseErrors.length > 0, 'should detect database errors');
    const colErr = exp.databaseErrors.find((e) => e.column !== null);
    assert.ok(colErr, `should extract column name from error, got: ${JSON.stringify(exp.databaseErrors)}`);
  });
});
