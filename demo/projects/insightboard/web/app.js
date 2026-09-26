import { getJson, predictionsUrl, predictionUrl } from './api.js';
import { formatClass, formatPercent, formatDate } from './lib/format.js';

const listEl = document.querySelector('#prediction-list');
const detailEl = document.querySelector('#prediction-detail');

export async function loadPredictions() {
  const response = await fetch(predictionsUrl());
  const payload = await response.json();
  renderList(payload.predictions);
}

function renderList(predictions) {
  listEl.innerHTML = predictions
    .map((item) => `
      <li class="prediction-row" data-id="${item.id}">
        <span class="badge ${formatClass(item.label)}">${formatClass(item.label)}</span>
        <span class="customer">${item.customer}</span>
        <span class="confidence">${formatPercent(item.confidence)}</span>
        <span class="date">${formatDate(item.createdAt)}</span>
      </li>
    `)
    .join('');
}

export async function loadPredictionDetail(id) {
  const response = await fetch(predictionUrl(id));
  const payload = await response.json();
  renderDetail(payload.prediction);
}

function renderDetail(prediction) {
  detailEl.innerHTML = `
    <h3>Prediction #${prediction.id}</h3>
    <p class="badge">${formatClass(prediction.prediction.label)}</p>
    <p class="confidence">${formatPercent(prediction.confidence)}</p>
    <p class="customer">${prediction.customer}</p>
  `;
}

document.addEventListener('click', (event) => {
  const row = event.target.closest('.prediction-row');
  if (!row) return;
  loadPredictionDetail(row.dataset.id);
});

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    loadPredictions().catch((err) => console.error('failed to load predictions', err));
  });
}

export { getJson };


