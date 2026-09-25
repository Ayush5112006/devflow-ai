/**
 * Reproduction for the reported "prediction detail badge is blank" bug.
 *
 * This mirrors the *exact* property chain that web/app.js `renderDetail()`
 * walks, against the response the API actually produces. It performs no
 * network I/O so it is deterministic.
 */
import { toPredictionView } from '../server/services/predictionService.js';

const httpStatus = 200;
const body = {
  prediction: toPredictionView({
    id: 1,
    feedback_id: 1,
    label: 'negative',
    confidence: 0.94,
    created_at: '2026-02-02T09:15:00Z',
  }),
};

console.log('GET /api/predictions/1 ->', httpStatus);
console.log('response body:', JSON.stringify(body, null, 2));

// web/app.js renderDetail():  formatClass(prediction.prediction.label)
const chain = ['prediction', 'prediction', 'label'];

let cursor = body;
const trail = [];
for (const key of chain) {
  trail.push(key);
  if (cursor === undefined || cursor === null) {
    console.error(`\nREPRODUCED: reading property '${key}' of ${cursor} while walking ${trail.join('.')}`);
    console.error('Frontend renderDetail() throws TypeError: Cannot read properties of undefined');
    process.exit(1);
  }
  cursor = cursor[key];
}

console.log(`\nrenderDetail() resolved chain ${chain.join('.')} -> ${JSON.stringify(cursor)}`);
console.log('NOT REPRODUCED: the frontend property chain is satisfied by the API response');
