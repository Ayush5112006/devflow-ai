/**
 * Unit tests for the evidence parser.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStackFrames, parseRuntimeErrors, findDatabaseErrors,
  findUndefinedInPaths, findJsonParseErrors,
} from '../src/analysis/evidenceParse.js';

describe('parseStackFrames', () => {
  it('extracts frames from a standard Node.js stack trace', () => {
    const stack = `TypeError: Cannot read properties of undefined (reading 'label')
    at renderDetail (web/app.js:42:18)
    at HTMLElement.<anonymous> (web/app.js:20:5)`;
    const frames = parseStackFrames(stack);
    assert.ok(frames.length > 0, 'should find at least one frame');
    assert.equal(frames[0].symbol, 'renderDetail');
    assert.ok(frames[0].file.includes('app.js'));
    assert.equal(frames[0].line, 42);
  });
});

describe('parseRuntimeErrors', () => {
  it('identifies a null-property-access error', () => {
    const text = "TypeError: Cannot read properties of undefined (reading 'prediction')";
    const errors = parseRuntimeErrors(text);
    assert.ok(errors.length > 0);
    const err = errors.find((e) => e.kind === 'null-property-access');
    assert.ok(err, 'should identify null-property-access');
    assert.equal(err?.subject, 'prediction');
  });
});

describe('findDatabaseErrors', () => {
  it('extracts SQLite no-such-column errors', () => {
    const text = 'SqliteError: no such column: o.customer_name at Object.<anonymous>';
    const errors = findDatabaseErrors(text);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].message.includes('customer_name'));
  });

  it('extracts no-such-table errors', () => {
    const text = 'Error: no such table: orders_v2';
    const errors = findDatabaseErrors(text);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].message.includes('orders_v2'));
  });
});

describe('findUndefinedInPaths', () => {
  it('detects /undefined/ in request paths', () => {
    const log = 'GET /undefined/api/predictions 404';
    const paths = findUndefinedInPaths(log);
    assert.ok(paths.length > 0);
    assert.ok(paths[0].path.includes('undefined'));
  });
});

describe('findJsonParseErrors', () => {
  it('detects SyntaxError from response.json()', () => {
    const log = 'SyntaxError: Unexpected token < in JSON at position 0';
    const errors = findJsonParseErrors(log);
    assert.ok(errors.length > 0);
  });
});
