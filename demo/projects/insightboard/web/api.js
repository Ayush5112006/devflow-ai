// Base URL for the InsightBoard API, injected at build time by Vite.
const API_BASE = import.meta.env.VITE_API_BASE;

export async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  return response.json();
}

export function predictionsUrl() {
  return `${API_BASE}/api/predictions`;
}

export function predictionUrl(id) {
  return `${API_BASE}/api/predictions/${id}`;
}


