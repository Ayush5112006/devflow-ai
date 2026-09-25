# InsightBoard

Customer-feedback sentiment dashboard. The web bundle reads predictions and
renders them; the API serves them from SQLite.

## Running

```bash
cp .env.example .env
npm start        # http://localhost:3000
npm test
```

There are no runtime dependencies — the server uses `node:http` and
`node:sqlite`, and the tests use `node:test`.

## API

| Method | Path | Response |
|---|---|---|
| GET | `/api/predictions` | `{ predictions: Prediction[] }` |
| GET | `/api/predictions/:id` | `{ prediction: Prediction }` |
| GET | `/api/feedback` | `{ feedback: Feedback[] }` |
| GET | `/api/orders` | `{ orders: Order[] }` |
| GET | `/api/orders/:id` | `{ order: Order }` |
| GET | `/api/orders/:id/gateway-payload` | `{ payload: GatewayCharge }` |
| GET | `/api/revenue` | `{ totals: { status, total }[] }` |

### Prediction object

| Field | Type | Notes |
|---|---|---|
| `id` | number | |
| `feedbackId` | number | source feedback row |
| `label` | string | the sentiment class: `positive`, `negative`, `neutral` |
| `tone` | string | presentation hint derived from `label` |
| `confidence` | number | 0..1 |
| `createdAt` | string | ISO timestamp |
| `customer` | string | joined from `feedback` |

> The contract field for the sentiment class is **`label`**. The database column
> is also `label`. Consumers must read `prediction.label`.

## Layout

```
server/index.js              HTTP entry point
server/routes/               routers
server/services/             business logic
server/db/schema.sql         schema
web/                         browser bundle
test/                        node:test suites
docs/                        integration contracts
```
