import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// Axios instance — points to FastAPI backend (not yet running)
// Replace baseURL and add auth headers when backend is ready.
// ─────────────────────────────────────────────────────────────────────────────

const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    console.error('[API Error]', error?.response?.data ?? error.message);
    return Promise.reject(error);
  },
);

export default http;
