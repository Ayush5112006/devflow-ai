import test from 'node:test';
import assert from 'node:assert/strict';
import { toGatewayCharge } from '../server/services/billingClient.js';

test('gateway charge carries a reference and a customer reference', () => {
  const payload = toGatewayCharge({ id: 4, customer: 'Tailspin Toys', amount: 45200 });
  assert.equal(payload.reference, 'ord_4');
  assert.equal(payload.customer_ref, 'Tailspin Toys');
  assert.equal(payload.currency, 'EUR');
  assert.equal(typeof payload.value_minor, 'number');
});
