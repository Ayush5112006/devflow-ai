/**
 * Unit tests for the lexer / source scanner.
 * These run with node:test, no dependencies.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blankNonCode, matchBrace, objectKeys, lineAt } from '../src/analysis/lexer.js';

describe('blankNonCode', () => {
  it('removes single-line comments while preserving newlines', () => {
    const src = 'const x = 1; // comment\nconst y = 2;';
    const blanked = blankNonCode(src);
    assert.ok(!blanked.includes('comment'));
    assert.ok(blanked.includes('\n'));
    assert.ok(blanked.includes('const x'));
  });

  it('removes block comments', () => {
    const src = 'a /* block\n comment */ b';
    const blanked = blankNonCode(src);
    assert.ok(!blanked.includes('block'));
    assert.ok(blanked.includes('\n'));
  });

  it('preserves template expression contents', () => {
    const src = 'const url = `${BASE}/api`;';
    const blanked = blankNonCode(src);
    assert.ok(blanked.includes('BASE'));
  });
});

describe('matchBrace', () => {
  it('finds the matching closing brace', () => {
    const s = '{ a: 1, b: { c: 2 } }';
    assert.equal(matchBrace(s, 0), s.length - 1);
  });

  it('returns -1 for unclosed brace', () => {
    assert.equal(matchBrace('{ unclosed', 0), -1);
  });
});

describe('objectKeys', () => {
  it('extracts top-level keys from an object literal', () => {
    const src = '({ label: "foo", count: 42, nested: { x: 1 } })';
    const blanked = blankNonCode(src);
    const openIdx = src.indexOf('{');
    const keys = objectKeys(src, blanked, openIdx);
    const names = keys.map((k) => k.name);
    assert.ok(names.includes('label'), `expected label in ${names}`);
    assert.ok(names.includes('count'), `expected count in ${names}`);
    assert.ok(names.includes('nested'), `expected nested in ${names}`);
  });

  it('identifies spread shorthand', () => {
    const src = '({ ...rest, x: 1 })';
    const blanked = blankNonCode(src);
    const keys = objectKeys(src, blanked, src.indexOf('{'));
    const names = keys.map((k) => k.name);
    assert.ok(names.some((n) => n.startsWith('...')));
  });
});

describe('lineAt', () => {
  it('returns 1 for offset 0', () => {
    assert.equal(lineAt('hello\nworld', 0), 1);
  });

  it('returns 2 after the first newline', () => {
    const src = 'hello\nworld';
    assert.equal(lineAt(src, 6), 2);
  });
});
