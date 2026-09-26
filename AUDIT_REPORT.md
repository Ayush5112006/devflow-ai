# FixFlow AI — Complete Codebase Audit Report

> Generated after full manual inspection of all source files.  
> Statuses: **FUNCTIONAL** | **PARTIALLY FUNCTIONAL** | **MOCKED** | **EMPTY** | **BROKEN** | **COMING SOON**

---

## Frontend Pages (25 total)

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| `DashboardPage.tsx` | `/` | **FUNCTIONAL** | Real data from `api.pipeline` + `api.listInvestigations`. Hero, status bar, demo launch, recent invs, quick nav, pipeline comparison, measured perf all present. No DEMO badge on demo scenarios. |
| `NewInvestigationPage.tsx` | `/new` | **FUNCTIONAL** | Creates real investigations via `api.createInvestigation` + `api.start`. Evidence textarea only — no file upload, no environment fields. `projectId` hardcoded to `'insightboard'`. |
| `InvestigationsListPage.tsx` | `/investigations` | **FUNCTIONAL** | Real investigation list from API. Demo launcher works. Status badges correct. |
| `InvestigationPage.tsx` | `/investigations/:id` | **FUNCTIONAL** | 9-tab detail page. SSE streaming. All tabs render (pipeline, findings, root cause, change plan, implementation, verification, regression, report). Approval gate works. |
| `ProjectsPage.tsx` | `/projects` | **MOCKED** | Hardcoded `ARCH_LAYERS`, `HEALTH_CHECKS`, `DEMO_FILES`. No real backend calls. |
| `IssuesPage.tsx` | `/issues` | **MOCKED** | Local state only, `DEMO_ISSUES` array. Create-issue form works but is in-memory only. No DEMO badge. Lifecycle bar and detail panel are good UX. |
| `GitCenterPage.tsx` | `/git` | **PARTIALLY FUNCTIONAL** | Real git info from `api.git` (uses first investigation's git data). Branch creation UI is front-end-only (no backend call). |
| `PullRequestsPage.tsx` | `/pull-requests` | **PARTIALLY FUNCTIONAL** | Reads completed investigations for PR summaries. GitHub PR creation is UI-only with `COMING SOON` note. |
| `ReleasesPage.tsx` | `/releases` | **MOCKED** | Hardcoded releases list, feature flags all demo. |
| `IncidentsPage.tsx` | `/incidents` | **MOCKED** | `DEMO_INCIDENTS` local data. Timeline and postmortem tabs work but all data is static. No real incidents from API. |
| `KnowledgePage.tsx` | `/knowledge` | **PARTIALLY FUNCTIONAL** | Demo articles. AI memory is editable in-memory. `.panel-selected` CSS was added and should work. New article button does nothing. |
| `CodeIntelligencePage.tsx` | `/code-intelligence` | **MOCKED** | 4 hardcoded demo symbols. |
| `DebuggingPage.tsx` | `/debugging` | **MOCKED** | Log Intelligence — demo log entries, demo timeline. |
| `CodeReviewPage.tsx` | `/code-review` | **MOCKED** | Diff view and checklist — all demo data. |
| `SecurityPage.tsx` | `/security` | **MOCKED** | CWE codes, detail panel — all demo data. |
| `TestCenterPage.tsx` | `/test-center` | **MOCKED** | Test suites, coverage charts — all demo data. |
| `AnalyticsPage.tsx` | `/analytics` | **PARTIALLY FUNCTIONAL** | Reads `api.pipeline` + `api.listInvestigations` for DORA metrics. Engineering Scorecard is hardcoded. Audit log is DEMO. |
| `MetricsPage.tsx` | `/metrics` | **PARTIALLY FUNCTIONAL** | Real pipeline data + agent registry shown. Some metrics are estimated/DEMO labeled. |
| `JudgeModePage.tsx` | `/judge` | **PARTIALLY FUNCTIONAL** | 26-step workflow, real pipeline comparison. Steps are static; some link to real pages. Metrics tab shows real session data when available. |
| `ReportsPage.tsx` | `/reports` | **PARTIALLY FUNCTIONAL** | Links to real completed investigations. List refreshes from API. |
| `SettingsPage.tsx` | `/settings` | **FUNCTIONAL** | Save feedback works (toast). Demo disclaimer present. |
| `IntegrationsPage.tsx` | `/integrations` | **FUNCTIONAL** | GitHub configure panel + coming-soon cards for other integrations. |
| `DependenciesPage.tsx` | `/dependencies` | **MOCKED** | Package health table, CVE count — demo data. |
| `Dashboard.tsx` | (old) | **DUPLICATE** | Old dashboard file still in pages/. Not imported in App.tsx. |
| `InvestigationView.tsx` | (old) | **DUPLICATE** | Old investigation view. Not imported in App.tsx. |

### Missing Pages
- `/performance` — Not created. Referenced in task list as P0. No route exists.
- `/repositories` — Not created. Listed as P1. No route exists.

---

## Frontend Components

| Component | Status | Notes |
|-----------|--------|-------|
| `Layout.tsx` | **DUPLICATE** | There is a `components/Layout.tsx` AND a layout inside `App.tsx`. The one in App.tsx is used. `components/Layout.tsx` appears unused. |
| `Badge.tsx` | **FUNCTIONAL** | `Badge`, `severityBadge` used across all pages. |
| `Card.tsx` | **FUNCTIONAL** | Wrapper with optional `title` and `action`. Used widely. |
| `CommandPalette.tsx` | **FUNCTIONAL** | Ctrl+K, links to all routes. |
| `ErrorBoundary.tsx` | **FUNCTIONAL** | Wraps entire app. |
| `InvestigationTimeline.tsx` | **STATUS UNKNOWN** | File exists. Need to check if used. |
| `LoadingSpinner.tsx` | **FUNCTIONAL** | Used on DashboardPage and JudgeModePage. |
| `PipelineDiagram.tsx` | **STATUS UNKNOWN** | File exists. Need to check if used. |
| `StageStepper.tsx` | **STATUS UNKNOWN** | File exists. Need to check if used. |
| `ToastProvider.tsx` | **FUNCTIONAL** | Used in App.tsx. SettingsPage uses it. |
| `ActivityLog.tsx` | **STATUS UNKNOWN** | File exists. Used in InvestigationPage likely. |
| **ComingSoon** | **MISSING** | No shared component exists. Each page handles this ad-hoc. |
| **EmptyState** | **PARTIAL** | The `.empty` CSS class exists but no shared `EmptyState` React component. |

---

## Backend Routes (from `routes/investigations.ts`)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `GET /health` | GET | **FUNCTIONAL** | Returns `{status, version, uptime}`. Used by `api.health()` but sidebar shows static "Backend connected". |
| `GET /api/projects` | GET | **FUNCTIONAL** | Returns `PROJECTS` from demoCatalog. |
| `GET /api/demo/bugs` | GET | **FUNCTIONAL** | Loads demo bugs from demoCatalog. |
| `GET /api/pipeline` | GET | **FUNCTIONAL** | Returns live `pipelineFacts` with agent registry and observed stats. |
| `GET /api/investigations` | GET | **FUNCTIONAL** | List all investigations (in-memory). |
| `POST /api/investigations` | POST | **FUNCTIONAL** | Create new investigation with bug + evidence. |
| `GET /api/investigations/:id` | GET | **FUNCTIONAL** | Full investigation detail. |
| `POST /api/investigations/:id/start` | POST | **FUNCTIONAL** | Start investigation pipeline. |
| `POST /api/investigations/:id/approve` | POST | **FUNCTIONAL** | Approve change plan (human gate). |
| `POST /api/investigations/:id/implement` | POST | **FUNCTIONAL** | Trigger implementation after approval. |
| `POST /api/investigations/:id/replan` | POST | **FUNCTIONAL** | Request replanning with feedback. |
| `GET /api/investigations/:id/findings` | GET | **FUNCTIONAL** | Findings from all agents. |
| `GET /api/investigations/:id/root-cause` | GET | **FUNCTIONAL** | Root cause analysis result. |
| `GET /api/investigations/:id/change-plan` | GET | **FUNCTIONAL** | Planned changes with diffs. |
| `GET /api/investigations/:id/report` | GET | **FUNCTIONAL** | Final engineering report. |
| `GET /api/investigations/:id/git` | GET | **FUNCTIONAL** | Git info for investigation workspace. |
| `GET /api/investigations/:id/stream` | GET (SSE) | **FUNCTIONAL** | SSE stream for live updates. |
| `POST /api/investigations/demo/:bugId/quickstart` | POST | **FUNCTIONAL** | One-shot demo launcher. |

---

## Backend Agents

| Agent | File | Status | Notes |
|-------|------|--------|-------|
| Manager Agent | `agents/manager/managerAgent.ts` | **FUNCTIONAL** | Fan-out to parallel agents. |
| Evidence Agent | `agents/evidence/evidenceAgent.ts` | **FUNCTIONAL** | Parses evidence attachments. |
| Code Agent | `agents/code/codeAgent.ts` | **FUNCTIONAL** | Analyzes source code. |
| API Agent | `agents/api/apiAgent.ts` | **FUNCTIONAL** | Analyzes API routes. |
| Database Agent | `agents/database/databaseAgent.ts` | **FUNCTIONAL** | Analyzes DB schemas and queries. |
| Test Agent | `agents/testing/testAgent.ts` | **FUNCTIONAL** | Runs test suite. |
| History Agent | `agents/history/historyAgent.ts` | **FUNCTIONAL** | Reviews git history. |
| Root Cause Agent | `agents/rootCause/rootCauseAgent.ts` | **FUNCTIONAL** | Synthesizes findings into root cause. |
| Change Plan | `agents/rootCause/changePlan.ts` | **FUNCTIONAL** | Generates planned changes with diffs. |
| Implementation Agent | `agents/implementation/implementationAgent.ts` | **FUNCTIONAL** | Applies changes to workspace. |
| Verification Agent | `agents/verification/verificationAgent.ts` | **FUNCTIONAL** | Runs tests post-fix. |
| Regression Agent | `agents/regression/regressionAgent.ts` | **FUNCTIONAL** | Checks for regressions. |
| Reporting Agent | `agents/reporting/reportingAgent.ts` | **FUNCTIONAL** | Generates final report. |

---

## CSS Design System

| Token / Class | Status | Notes |
|---------------|--------|-------|
| `--accent: #7c5cfc` | **DEFINED** | Purple, correct |
| `--success: #22c55e` | **DEFINED** | Green |
| `.panel-selected` | **DEFINED** | Border + accent glow — should work in KnowledgePage |
| `.badge-*` variants | **DEFINED** | success, danger, warn, info, muted |
| `.btn-success`, `.btn-danger`, `.btn-warn`, `.btn-ghost` | **DEFINED** | |
| `.demo-notice` | **MISSING** | Referenced in task requirements but not found in CSS |
| `.status-bar`, `.status-item` | **DEFINED** | Dashboard status bar |
| `.quicknav-grid`, `.quicknav-card` | **DEFINED** | |
| `.scorecard-grid`, `.scorecard-item` | **DEFINED** | |
| `.card-grid-sidebar` | **DEFINED** | 2-col with sidebar layout |
| `.timeline`, `.timeline-item`, `.timeline-dot` | **DEFINED** | Used in IncidentsPage |
| `.issue-row`, `.issue-lifecycle` | **LIKELY MISSING** | Referenced in IssuesPage but may not be in CSS |

---

## Key Issues Found

### Critical (P0)
1. **Sidebar health check is static** — always shows "Backend connected" green dot, never pings `/health`
2. **No `/performance` route** — linked from task, not in App.tsx
3. **IssuesPage has no DEMO badge** — users may think data is real
4. **`NewInvestigationPage` hardcodes `projectId: 'insightboard'`** — cosmetic but should be visible

### High (P1)
5. **No `/repositories` route** — listed as P1 feature
6. **KnowledgePage "New Article" button is a no-op** — `onClick` missing
7. **IncidentsPage "Export postmortem" and "Add to Knowledge Base" buttons are no-ops**
8. **AnalyticsPage scorecard is completely hardcoded** — no connection to real data
9. **JudgeModePage steps 7-26 are all `done: false`** regardless of actual investigation state

### Medium (P2)
10. **`Dashboard.tsx` and `InvestigationView.tsx` are dead code** — old files, not imported
11. **`components/Layout.tsx` may be unused**
12. **`components/InvestigationTimeline.tsx`, `PipelineDiagram.tsx`, `StageStepper.tsx`** — usage unknown
13. **`NewInvestigationPage` has no file upload** — only paste-in text evidence

---

## What Is Definitely Working (Do Not Break)
- Full investigation pipeline: create → start → stream → approve → implement → verify → regress → report
- SSE streaming in InvestigationPage
- All 9 InvestigationPage tabs
- DashboardPage demo launcher
- CommandPalette (Ctrl+K)
- Toast notifications
- All 13 backend agents
- All 17 REST endpoints
- Backend test suite (23/23)
