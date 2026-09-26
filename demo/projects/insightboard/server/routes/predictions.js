import { Router } from './router.js';
import { listPredictions, getPrediction, listFeedback } from '../services/predictionService.js';

export const predictionsRouter = new Router();

predictionsRouter.get('/api/predictions', (req, res) => {
  res.json(200, { predictions: listPredictions() });
});

predictionsRouter.get('/api/predictions/:id', (req, res) => {
  const prediction = getPrediction(Number(req.params.id));
  if (!prediction) {
    res.json(404, { error: 'prediction_not_found' });
    return;
  }
  res.json(200, { prediction });
});

predictionsRouter.get('/api/feedback', (req, res) => {
  res.json(200, { feedback: listFeedback() });
});
