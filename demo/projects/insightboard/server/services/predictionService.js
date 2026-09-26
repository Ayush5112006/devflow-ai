import { getDb } from '../db/index.js';

const LABEL_TO_TONE = {
  positive: 'good',
  negative: 'bad',
  neutral: 'meh',
};

/**
 * Maps a stored prediction into the shape the dashboard renders.
 * Both the list view and the detail view call this, so a change here
 * affects both.
 */
export function toPredictionView(row) {
  return {
    id: row.id,
    feedbackId: row.feedback_id,
    label: row.label,
    tone: LABEL_TO_TONE[row.label] ?? 'meh',
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

export function listPredictions() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.id, p.feedback_id, p.label, p.confidence, p.created_at, f.customer
         FROM predictions p
         JOIN feedback f ON f.id = p.feedback_id
        ORDER BY p.id ASC`,
    )
    .all();
  return rows.map(toPredictionView);
}

export function getPrediction(id) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT p.id, p.feedback_id, p.label, p.confidence, p.created_at, f.customer
         FROM predictions p
         JOIN feedback f ON f.id = p.feedback_id
        WHERE p.id = ?`,
    )
    .get(id);
  return row ? toPredictionView(row) : null;
}

export function listFeedback() {
  return getDb()
    .prepare('SELECT id, customer, channel, body, created_at FROM feedback ORDER BY id ASC')
    .all();
}
