# Billing gateway contract

Internal payments service, owned by the finance platform team.

## Create a charge

`POST {BILLING_GATEWAY_URL}/v1/charges`

Request body:

| Field | Type | Required | Description |
|---|---|---|---|
| `reference` | string | yes | Our order id, prefixed — e.g. `ord_42` |
| `currency` | string | yes | ISO 4217, always `EUR` for us |
| `amount_cents` | integer | yes | Minor units. Never a float. |
| `customer_ref` | string | yes | Customer display name |

## Notes

- The gateway is strict: unknown fields are rejected with `422 unknown_field`.
- Amounts are always in minor units. We store `orders.amount` in cents.
- No retries on `4xx`. Retries on `5xx` are handled by the gateway itself.
