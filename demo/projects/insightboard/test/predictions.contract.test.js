import test from 'node:test';
import assert from 'node:assert/strict';
import { listPredictions, getPrediction, toPredictionView } from '../server/services/predictionService.js';

test('prediction view exposes the documented fields', () => {
  const view = toPredictionView({
    id: 7,
    feedback_id: 3,
    label: 'positive',
    confidence: 0.91,
    created_at: '2026-02-03T08:03:00Z',
  });

  assert.equal(view.label, 'positive', 'the API contract field is `label`');
  assert.equal(view.tone, 'good');
  assert.equal(view.confidence, 0.91);
  assert.ok(!('prediction' in view), 'the API never nests a `prediction` field inside a prediction');
});

test('list endpoint returns the label field for every row', () => {
  const predictions = listPredictions();
  assert.ok(predictions.length > 0, 'seed data should be present');
  for (const p of predictions) {
    assert.ok('label' in p, `prediction ${p.id} is missing the contract field \`label\``);
    assert.ok(!('prediction' in p));
  }
});

test('detail endpoint returns the label field', () => {
  const prediction = getPrediction(1);
  assert.ok(prediction, 'seed prediction 1 should exist');
  assert.equal(typeof prediction.label, 'string');
  assert.ok(!('prediction' in prediction));
});

test('detail endpoint returns null for an unknown id', () => {
  assert.equal(getPrediction(9999), null);
});
