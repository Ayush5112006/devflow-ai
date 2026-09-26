/**
 * Adapter for the external billing gateway.
 *
 * The gateway contract (see docs/billing-gateway.md) expects:
 *   { reference, currency, value_minor, customer_ref }
 */

const GATEWAY_BASE = process.env.BILLING_GATEWAY_URL ?? 'https://billing.internal.example.com';

export function toGatewayCharge(order) {
  return {
    reference: `ord_${order.id}`,
    currency: 'EUR',
    value_minor: order.amount,
    customer_ref: order.customer,
  };
}

export async function pushCharge(order) {
  const payload = toGatewayCharge(order);
  const response = await fetch(`${GATEWAY_BASE}/v1/charges`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}
