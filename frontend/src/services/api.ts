import type { Investigation, DemoBug, ProjectTarget, PipelineFacts } from '../types/index.js';

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  /* Projects */
  projects: () => get<{ projects: ProjectTarget[] }>('/projects'),

  /* Demo */
  demoBugs: () => get<{ bugs: DemoBug[] }>('/demo/bugs'),
  /** Live agent registry, real stage list, and measured durations. */
  pipeline: () => get<PipelineFacts>('/pipeline'),
  demoQuickstart: (bugId: string) =>
    post<{ investigation: Investigation }>(`/investigations/demo/${bugId}/quickstart`),

  /* Investigations */
  listInvestigations: () => get<{ investigations: Partial<Investigation>[] }>('/investigations'),
  getInvestigation: (id: string) => get<{ investigation: Investigation }>(`/investigations/${id}`),

  createInvestigation: (body: {
    projectId: string;
    bug: Investigation['bug'];
    evidence?: { name: string; kind: string; content: string }[];
  }) => post<{ investigation: Investigation }>('/investigations', body),

  start: (id: string) => post<{ started: boolean }>(`/investigations/${id}/start`),
  approve: (id: string, approvedBy: string, note: string) =>
    post<{ approval: Investigation['approval'] }>(`/investigations/${id}/approve`, { approvedBy, note }),
  implement: (id: string) => post<{ started: boolean }>(`/investigations/${id}/implement`),

  /* Getters */
  findings: (id: string) => get<{ findings: Investigation['findings'] }>(`/investigations/${id}/findings`),
  rootCause: (id: string) => get<{ rootCause: Investigation['rootCause'] }>(`/investigations/${id}/root-cause`),
  changePlan: (id: string) => get<{ changePlan: Investigation['changePlan'] }>(`/investigations/${id}/change-plan`),
  report: (id: string) => get<{ report: Investigation['report']; metrics: Investigation['metrics'] }>(`/investigations/${id}/report`),

  /* SSE */
  stream: (id: string) => new EventSource(`/api/investigations/${id}/stream`),
};
