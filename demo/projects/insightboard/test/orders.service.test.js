import test from 'node:test';
import assert from 'node:assert/strict';
import { listOrders, getOrder, revenueTotals } from '../server/services/orderService.js';

test('listOrders returns every seeded order', () => {
  const orders = listOrders();
  assert.equal(orders.length, 4, 'seed data contains 4 orders');
  assert.deepEqual(orders.map((o) => o.id), [1, 2, 3, 4]);
});

test('listOrders exposes the order view fields', () => {
  const [order] = listOrders();
  assert.equal(typeof order.customer, 'string');
  assert.equal(typeof order.amount, 'number');
  assert.equal(typeof order.status, 'string');
});

test('getOrder returns a single order', () => {
  const order = getOrder(1);
  assert.ok(order);
  assert.equal(order.id, 1);
  assert.equal(typeof order.amount, 'number');
});

test('revenueTotals groups by status', () => {
  const totals = revenueTotals();
  const paid = totals.find((t) => t.status === 'paid');
  assert.ok(paid, 'paid bucket should exist');
  assert.equal(paid.total, 24900 + 15800);
});
