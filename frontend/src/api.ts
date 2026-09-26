const API_BASE = '/api';

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Every backend route answers with a single-key envelope, e.g.
 * `{ bugs: [...] }` or `{ investigation: {...} }`. Unwrap it here so callers
 * get the payload directly — otherwise a list response arrives as an object
 * and `.map` / `.filter` throw during render.
 */
async function fetchEnveloped<K extends string, T>(path: string, key: K, init?: RequestInit): Promise<T> {
  const body = await fetchJSON<Record<K, T>>(path, init);
  if (!(key in body)) {
    throw new Error(`Malformed response from ${path}: expected a "${key}" property`);
  }
  return body[key];
}

export const api = {
  health: () => fetchJSON<{ status: string; version: string; uptime: number }>('/health'),

  projects: () => fetchEnveloped<'projects', any[]>('/projects', 'projects'),
  demoBugs: () => fetchEnveloped<'bugs', any[]>('/demo/bugs', 'bugs'),

  investigations: () => fetchEnveloped<'investigations', any[]>('/investigations', 'investigations'),
  investigation: (id: string) => fetchEnveloped<'investigation', any>(`/investigations/${id}`, 'investigation'),

  agents: (id: string) => fetchEnveloped<'agents', any[]>(`/investigations/${id}/agents`, 'agents'),
  findings: (id: string) => fetchEnveloped<'findings', any[]>(`/investigations/${id}/findings`, 'findings'),

  /**
   * Launches a demo bug end to end. The backend creates the investigation,
   * attaches the seeded evidence and starts the agent run in one call, so the
   * UI does not have to stitch the steps together itself.
   */
  quickstartInvestigation: (bugId: string) =>
    fetchEnveloped<'investigation', any>(`/investigations/demo/${bugId}/quickstart`, 'investigation', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  approve: (investigationId: string) =>
    fetchEnveloped<'approval', any>(`/investigations/${investigationId}/approve`, 'approval', {
      method: 'POST',
      body: JSON.stringify({ approvedBy: 'user' }),
    }),
};

export function useSSE(investigationId: string | null, onEvent: (event: any) => void) {
  if (!investigationId) return;

  // The backend exposes the stream at /stream, not /events.
  const eventSource = new EventSource(`${API_BASE}/investigations/${investigationId}/stream`);

  const eventTypes = [
    'connected', 'investigation.created', 'stage.started', 'stage.finished',
    'agent.started', 'agent.progress', 'agent.finished', 'activity',
    'findings.updated', 'rootcause.updated', 'plan.updated', 'approval.updated',
    'implementation.updated', 'verification.updated', 'regression.updated',
    'report.updated', 'investigation.updated', 'error',
  ];

  for (const type of eventTypes) {
    eventSource.addEventListener(type, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        onEvent({ type, ...data });
      } catch {
        // skip invalid JSON
      }
    });
  }

  return () => eventSource.close();
}
