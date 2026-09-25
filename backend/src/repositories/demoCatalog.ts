import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import { readTextFile } from '../utils/fsSafe.js';
import { badRequest, notFound } from '../utils/errors.js';
import type { DemoBug, ProjectTarget, Severity } from '../types/index.js';

const INSIGHTBOARD = 'demo/projects/insightboard';

export const PROJECTS: ProjectTarget[] = [
  {
    id: 'insightboard',
    name: 'InsightBoard',
    description:
      'Customer-feedback sentiment dashboard. Node http API, SQLite storage, vanilla web bundle, node:test suites. Ships with three real, unreported defects.',
    sourcePath: INSIGHTBOARD,
    isDemo: true,
    bugCount: 3,
  },
];

/** Resolves a project id to an absolute path, refusing anything outside the repo. */
export function resolveProjectPath(projectId: string): { project: ProjectTarget; absPath: string } {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) throw notFound(`Unknown project: ${projectId}`);
  const absPath = path.resolve(config.repoRoot, project.sourcePath);
  const rel = path.relative(config.repoRoot, absPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw badRequest('Project path resolves outside the repository', project.sourcePath);
  }
  return { project, absPath };
}

export async function projectHasReadme(absPath: string): Promise<boolean> {
  try {
    await readTextFile(path.join(absPath, 'README.md'));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Demo bugs                                                          */
/* ------------------------------------------------------------------ */

const EVIDENCE_ROOT = path.join(config.demoDir, 'evidence');

async function evidence(name: string, kind: DemoBug['evidence'][number]['kind']) {
  const abs = path.join(EVIDENCE_ROOT, name);
  const content = await readTextFile(abs);
  return { name: path.basename(name), kind, content };
}

export async function loadDemoBugs(): Promise<DemoBug[]> {
  const d1 = await Promise.all([
    evidence('d1/browser-console.log', 'log'),
  ]);

  const d2 = await Promise.all([
    evidence('d2/browser-console.log', 'log'),
    evidence('d2/server-access.log', 'log'),
  ]);

  const d3 = await Promise.all([
    evidence('d3/server-error.log', 'log'),
    evidence('d3/curl-output.txt', 'http'),
  ]);

  return [
    {
      id: 'd1',
      title: 'Prediction detail card shows a blank sentiment badge',
      oneLine: 'Clicking a prediction row throws a TypeError and the detail panel never renders.',
      severity: 'high',
      expectedOutcome:
        'The API contract field for the sentiment class is `label`; the detail renderer reads it correctly and the badge shows NEGATIVE.',
      report: {
        title: 'Prediction detail card shows a blank sentiment badge',
        description: [
          'The predictions list renders fine and every row shows the correct sentiment badge.',
          'Clicking a row opens the detail panel, but the panel stays empty and the console logs a TypeError.',
          'The same data is used by the list view and it works there, so the API itself looks healthy.',
          'Reported by the product team after the last frontend release.',
        ].join(' '),
        severity: 'high',
        expectedBehavior:
          'Clicking a prediction row renders the detail card with the sentiment badge, confidence and customer.',
        actualBehavior:
          'The detail panel renders an empty shell and the browser console reports a TypeError from renderDetail.',
        reproSteps: [
          'Start the API: npm start',
          'Open http://localhost:5173 in the browser',
          'Click any row in the Predictions list',
          'Observe the console error and the blank badge',
        ],
        reproCommand: 'npm run repro:d1',
        lastKnownGoodRef: 'HEAD~3',
        reportedAt: '2026-02-24T12:10:00Z',
      },
      evidence: d1,
    },
    {
      id: 'd2',
      title: 'Dashboard is empty and every API call 404s',
      oneLine: 'The browser requests /undefined/api/predictions and gets an HTML 404 body back.',
      severity: 'critical',
      expectedOutcome:
        'The declared base URL variable is VITE_API_URL; the api module reads a name that no env file declares.',
      report: {
        title: 'Dashboard is empty and every API call 404s',
        description: [
          'Since the last deploy the dashboard shows no predictions at all.',
          'The network tab shows requests to a path beginning with the literal text "undefined".',
          'The server log confirms those paths are not registered routes.',
          'The API is running and /api/predictions works when called directly with curl.',
        ].join(' '),
        severity: 'critical',
        expectedBehavior: 'The browser loads predictions from the configured API base URL.',
        actualBehavior:
          'The browser requests /undefined/api/predictions, receives a 404 HTML page, and response.json() throws a SyntaxError.',
        reproSteps: [
          'Copy .env.example to .env and start the API with npm start',
          'Open the web bundle in a browser',
          'Open the network tab and reload',
          'Observe requests to /undefined/api/predictions returning 404',
        ],
        reproCommand: 'npm run repro:d2',
        reportedAt: '2026-02-24T12:08:00Z',
      },
      evidence: d2,
    },
    {
      id: 'd3',
      title: 'GET /api/orders returns 500',
      oneLine: 'The orders route throws "no such column: o.customer_name" while /api/revenue still works.',
      severity: 'critical',
      expectedOutcome:
        'The orders table columns are `customer` and `amount`; the query projects column names that do not exist.',
      report: {
        title: 'GET /api/orders returns 500',
        description: [
          'The orders page in the internal admin tool fails to load.',
          'The API returns 500 with "no such column: o.customer_name".',
          'Oddly, /api/revenue on the same service still returns data.',
          'Started after the last database performance change.',
        ].join(' '),
        severity: 'critical',
        expectedBehavior: 'GET /api/orders returns the list of orders with customer, amount and status.',
        actualBehavior: 'GET /api/orders returns HTTP 500 with "no such column: o.customer_name".',
        reproSteps: [
          'Start the API: npm start',
          'curl -i http://localhost:3000/api/orders',
          'Observe HTTP 500 and the SQLite error',
        ],
        reproCommand: 'npm run repro:d3',
        reportedAt: '2026-02-24T11:59:00Z',
      },
      evidence: d3,
    },
  ];
}

export async function loadDemoBug(id: string): Promise<DemoBug> {
  const bugs = await loadDemoBugs();
  const bug = bugs.find((b) => b.id === id);
  if (!bug) throw notFound(`Unknown demo bug: ${id}`);
  return bug;
}

/** Small helper so the seeder and the API agree on file layout. */
export async function listEvidenceFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(EVIDENCE_ROOT, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const files = await fs.readdir(path.join(EVIDENCE_ROOT, entry.name));
        for (const f of files) out.push(path.join(entry.name, f));
      }
    }
    return out;
  } catch {
    return [];
  }
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];
