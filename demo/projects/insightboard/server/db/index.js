import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.DB_FILE ?? path.join(here, 'insightboard.db');

let db;

export function getDb() {
  if (db) return db;
  db = new DatabaseSync(dbFile);
  const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  db.exec(schema);
  seedIfEmpty(db);
  return db;
}

function seedIfEmpty(database) {
  const row = database.prepare('SELECT COUNT(*) AS n FROM feedback').get();
  if (row.n > 0) return;

  const insertFeedback = database.prepare(
    'INSERT INTO feedback (id, customer, channel, body, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const insertPrediction = database.prepare(
    'INSERT INTO predictions (id, feedback_id, label, confidence, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const insertOrder = database.prepare(
    'INSERT INTO orders (id, customer, amount, status, created_at) VALUES (?, ?, ?, ?, ?)',
  );

  const feedback = [
    [1, 'Northwind Traders', 'email', 'Checkout crashed twice before I could pay.', '2026-02-02T09:14:00Z'],
    [2, 'Contoso', 'chat', 'The invoice PDF is missing my VAT number.', '2026-02-02T11:40:00Z'],
    [3, 'Fabrikam', 'survey', 'Support replied in under an hour, really happy.', '2026-02-03T08:02:00Z'],
    [4, 'Tailspin Toys', 'email', 'Pricing page shows the old price in EUR.', '2026-02-03T15:21:00Z'],
  ];
  for (const row of feedback) insertFeedback.run(...row);

  const predictions = [
    [1, 1, 'negative', 0.94, '2026-02-02T09:15:00Z'],
    [2, 2, 'negative', 0.88, '2026-02-02T11:41:00Z'],
    [3, 3, 'positive', 0.91, '2026-02-03T08:03:00Z'],
    [4, 4, 'negative', 0.77, '2026-02-03T15:22:00Z'],
  ];
  for (const row of predictions) insertPrediction.run(...row);

  const orders = [
    [1, 'Northwind Traders', 24900, 'paid', '2026-01-28T10:00:00Z'],
    [2, 'Contoso', 15800, 'paid', '2026-01-29T12:30:00Z'],
    [3, 'Fabrikam', 9900, 'refunded', '2026-01-30T16:05:00Z'],
    [4, 'Tailspin Toys', 45200, 'pending', '2026-02-01T09:45:00Z'],
  ];
  for (const row of orders) insertOrder.run(...row);
}
