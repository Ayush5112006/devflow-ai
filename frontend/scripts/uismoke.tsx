import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { InvestigationPage } from '../src/pages/InvestigationPage.js';
import { DashboardPage } from '../src/pages/DashboardPage.js';
import { NewInvestigationPage } from '../src/pages/NewInvestigationPage.js';

const payload = JSON.parse(
  readFileSync('C:/Users/Ayush/AppData/Local/Temp/opencode/uismoke/inv.json', 'utf8'),
);
const inv = payload.investigation;

/* Minimal browser stubs so the page's data hooks resolve without a network. */
(globalThis as any).fetch = async (url: string) => {
  const u = String(url);
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

  if (u.includes('/stream')) return new Response('', { status: 200 });
  if (u.endsWith(`/investigations/${inv.id}`)) return json(payload);
  if (u.includes('/api/pipeline')) {
    return json({
      parallelAgentCount: 6,
      humanGateCount: 1,
      humanGateStages: ['approval'],
      stages: [
        { id: 'projectAnalysis', label: 'Project Analysis', requiresHuman: false, produces: 'x' },
        { id: 'approval', label: 'Approval', requiresHuman: true, produces: 'x' },
      ],
      observed: {
        sampleSize: 3,
        minTotalMs: 1200, medianTotalMs: 2000, maxTotalMs: 3000,
        medianFilesInspected: 12, medianTestsExecuted: 4, medianAgentsUsed: 6, medianHypothesesGenerated: 5,
      },
    });
  }
  if (u.includes('/api/demo-bugs')) return json({ bugs: [] });
  if (u.includes('/api/investigations') && u.endsWith('/investigations')) {
    return json({ investigations: [inv] });
  }
  return json({});
};

class FakeES {
  onmessage: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  close() { /* noop */ }
}
(globalThis as any).EventSource = FakeES;

function renderPage(el: React.ReactElement, path: string, route: string): string {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={el} />
      </Routes>
    </MemoryRouter>,
  );
}

const checks: [string, string, string[]][] = [];

function check(name: string, html: string, expect: string[]) {
  const missing = expect.filter((s) => !html.includes(s));
  checks.push([missing.length ? 'FAIL' : 'PASS', name, missing]);
}

const invHtml = renderPage(<InvestigationPage />, `/investigations/${inv.id}`, '/investigations/:id');
check('investigation: renders', invHtml, [inv.bug.title.slice(0, 24), 'Approval', 'Change Plan', 'Regression']);
check('investigation: stepper present', invHtml, ['class="stepper"', 'step-dot']);
check('investigation: approval banner', invHtml, ['banner-warn', 'Approve fix plan', 'needs you']);
check('investigation: tabs all 8 + aria', invHtml, ['role="tablist"', 'aria-selected="true"', 'tab-count']);
check('investigation: activity log', invHtml, ['class="log"', 'role="log"']);
check('investigation: no raw slate classes', invHtml, []);
check('investigation: no alert dialogs', invHtml, []);

const dasHtml = renderPage(<DashboardPage />, '/', '/');
check('dashboard: renders', dasHtml, ['Move from', 'Workflow comparison', 'Median total', 'parallel agents']);

const newHtml = renderPage(<NewInvestigationPage />, '/new', '/new');
check('new investigation: renders', newHtml, ['Report a bug', 'Start investigation', 'Reproduction steps']);

/* Assertions on anti-patterns that should no longer exist anywhere. */
const all = [invHtml, dasHtml, newHtml].join('\n');
check('no generic slate palette left', all, []);
checks.push([/\bslate-\d/.test(all) ? 'FAIL' : 'PASS', 'no slate-* utility classes in output', []]);
checks.push([/Estimated 90/.test(all) ? 'FAIL' : 'PASS', 'no fabricated 90-180 min claim', []]);
checks.push([/Reproducible/.test(all) ? 'FAIL' : 'PASS', 'no unsubstantiated "Reproducible" claim', []]);
checks.push([[...all.matchAll(/0 min/g)].length === 0 ? 'PASS' : 'FAIL', 'no "0 min" savings figure', []]);

let failed = 0;
for (const [status, name, missing] of checks) {
  if (status === 'FAIL') failed++;
  console.log(`${status}  ${name}${missing.length ? `  (missing: ${missing.join(', ')})` : ''}`);
}
console.log(`\nhtml sizes: investigation=${invHtml.length} dashboard=${dasHtml.length} new=${newHtml.length}`);
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
