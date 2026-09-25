import { getDb } from '../db/index.js';

function toOrderView(row) {
  return {
    id: row.id,
    customer: row.customer,
    amount: row.amount,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function listOrders() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT o.id, o.customer_name, o.total_cents, o.status, o.created_at
         FROM orders o
        ORDER BY o.id ASC`,
    )
    .all();
  return rows.map(toOrderView);
}

export function getOrder(id) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT o.id, o.customer_name, o.total_cents, o.status, o.created_at
         FROM orders o
        WHERE o.id = ?`,
    )
    .get(id);
  return row ? toOrderView(row) : null;
}

export function revenueTotals() {
  const db = getDb();
  return db
    .prepare(
      `SELECT status, SUM(amount) AS total
         FROM orders
        GROUP BY status
        ORDER BY status ASC`,
    )
    .all();
}
