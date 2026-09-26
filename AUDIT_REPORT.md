# FixFlow AI — Complete Codebase Audit Report

> Last updated after full Phase 0 audit + P0/P1 repair pass.
> Statuses: **FUNCTIONAL** | **PARTIALLY FUNCTIONAL** | **MOCKED** | **EMPTY** | **BROKEN** | **DUPLICATE** | **COMING SOON**

---

## Frontend Pages (25 routes, 23 active files)

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| `DashboardPage.tsx` | `/` | **FUNCTIONAL** | Real data from `api.pipeline` + `api.listInvestigations`. Hero, status bar, demo launch, recent invs, pipeline comparison, measured perf all present. |
| `NewInvestigationPage.tsx` | `/new` | **FUNCTIONAL** | Creates real investigations via `api.createInvestigation` + `api.start`. Multi-evidence form, environment fields. `projectId` hardcoded to `'insightboard'` (intentional for demo). |
| `InvestigationsListPage.tsx` | `/investigations` | **FUNCTIONAL** | Real investigation list from API. Demo launcher works. Status badges correct. |
| `InvestigationPage.tsx` | `/investigations/:id` | **FUNCTIONAL** | 9-tab detail page. SSE streaming. All tabs render. Approval gate, replan, implement all work. |
| `ProjectsPage.tsx` | `/projects` | **PARTIALLY FUNCTIONAL** | Reads real `api.projects()`. Hardcoded HEALTH_CHECKS and DEMO_FILES are clearly labeled demo. |
| `IssuesPage.tsx` | `/issues` | **MOCKED** | `DEMO` and `DEMO DATA` badges present. Local state only. Create-issue form works in-memory. |
| `GitCenterPage.tsx` | `/git` | **PARTIALLY FUNCTIONAL** | Real git info from `api.git`. Branch creation UI is front-end-only (no backend call). |
| `PullRequestsPage.tsx` | `/pull-requests` | **PARTIALLY FUNCTIONAL** | Reads completed investigations for PR summaries. GitHub PR creation is `COMING SOON`. |
| `ReleasesPage.tsx` | `/releases` | **MOCKED** | Hardcoded releases list, feature flags all demo. |
| `IncidentsPage.tsx` | `/incidents` | **MOCKED** | `DEMO_INCIDENTS` local data. Export postmortem (Markdown download) **FIXED**. Add to Knowledge Base **FIXED**. |
| `KnowledgePage.tsx` | `/knowledge` | **PARTIALLY FUNCTIONAL** | Demo articles. AI memory is editable in-memory. "New Article" button **FIXED** — opens create form. |
| `CodeIntelligencePage.tsx` | `/code-intelligence` | **MOCKED** | 4 hardcoded demo symbols. |
| `DebuggingPage.tsx` | `/debugging` | **MOCKED** | Log Intelligence — demo log entries, demo timeline. |
| `CodeReviewPage.tsx` | `/code-review` | **MOCKED** | Diff view and checklist — all demo data. |
| `SecurityPage.tsx` | `/security` | **MOCKED** | CWE codes, detail panel — all demo data. |
| `TestCenterPage.tsx` | `/test-center` | **MOCKED** | Test suites, coverage charts — all demo data. |
| `AnalyticsPage.tsx` | `/analytics` | **PARTIALLY FUNCTIONAL** | Reads `api.pipeline` + `api.listInvestigations` for DORA metrics. Engineering Scorecard **NOW LABELED DEMO**. |
| `MetricsPage.tsx` | `/metrics` | **PARTIALLY FUNCTIONAL** | Real pipeline data + agent registry shown. Some metrics labeled MEASURED vs DEMO. |
| `JudgeModePage.tsx` | `/judge` | **PARTIALLY FUNCTIONAL** | 26-step workflow, step "done" state **NOW DYNAMIC** from real investigation status. |
| `ReportsPage.tsx` | `/reports` | **PARTIALLY FUNCTIONAL** | Links to real completed investigations. List refreshes from API. |
| `SettingsPage.tsx` | `/settings` | **FUNCTIONAL** | Save feedback works (toast). Demo disclaimer present. |
| `IntegrationsPage.tsx` | `/integrations` | **FUNCTIONAL** | GitHub configure panel + coming-soon cards for other integrations. |
| `DependenciesPage.tsx` | `/dependencies` | **MOCKED** | Package health table, CVE count — demo data. |
| `PerformancePage.tsx` | `/performance` | **PARTIALLY FUNCTIONAL** | Shows real measured data when available; proper Coming Soon/empty state when not. |
| `RepositoriesPage.tsx` | `/repositories` | **PARTIALLY FUNCTIONAL** | Real local git data from first investigation. GitHub coming soon. |

### Previously Dead Code — Now Removed
- `Dashboard.tsx` — **REMOVED** (old duplicate)
- `InvestigationView.tsx` — **REMOVED** (old duplicate)
- `components/Layout.tsx` — **REMOVED** (unused, layout lives in App.tsx)

---

## Frontend Components (Active)

| Component | Status | Notes |
|-----------|--------|-------|
| `Badge.tsx` | **FUNCTIONAL** | `Badge`, `severityBadge`, `statusBadge` used across all pages. |
| `Card.tsx` | **FUNCTIONAL** | Wrapper with optional `title` and `action`. Used widely. |
| `CommandPalette.tsx` | **FUNCTIONAL** | Ctrl+K, links to all routes. |
| `ErrorBoundary.tsx` | **FUNCTIONAL** | Wraps entire app. |
| `InvestigationTimeline.tsx` | **FUNCTIONAL** | Used in InvestigationPage timeline tab. |
| `LoadingSpinner.tsx` | **FUNCTIONAL** | Used on DashboardPage and multiple pages. |
| `PipelineDiagram.tsx` | **FUNCTIONAL** | Used in InvestigationPage pipeline tab. |
| `StageStepper.tsx` | **FUNCTIONAL** | Stage definitions, used in InvestigationPage. |
| `ToastProvider.tsx` | **FUNCTIONAL** | Used in App.tsx. SettingsPage uses it. |
| `ActivityLog.tsx` | **FUNCTIONAL** | Used in InvestigationPage activity log. |
| `ComingSoon.tsx` | **NEW** | Shared coming-soon placeholder component. |
| `EmptyState.tsx` | **NEW** | Shared empty-state component. |

---

## Backend Routes

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `GET /health` | GET | **FUNCTIONAL** | Returns `{status, version, uptime}`. Used by sidebar health check. |
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

## Backend Agents (All Functional)

| Agent | Status |
|-------|--------|
| Manager Agent | **FUNCTIONAL** |
| Evidence Agent | **FUNCTIONAL** |
| Code Investigator | **FUNCTIONAL** |
| API/Service Investigator | **FUNCTIONAL** |
| Database Investigator | **FUNCTIONAL** |
| Test Investigator | **FUNCTIONAL** |
| Git History Investigator | **FUNCTIONAL** |
| Root Cause Agent | **FUNCTIONAL** |
| Change Plan Generator | **FUNCTIONAL** |
| Implementation Agent | **FUNCTIONAL** |
| Verification Agent | **FUNCTIONAL** |
| Regression Agent | **FUNCTIONAL** |
| Reporting Agent | **FUNCTIONAL** |

---

## CSS Design System

| Area | Status |
|------|--------|
| Design tokens (`--accent`, `--success`, etc.) | **DEFINED** |
| `.coming-soon-box`, `.coming-soon-label` | **DEFINED** |
| `.demo-notice` | **DEFINED** |
| `.badge-demo`, `.badge-live`, `.badge-coming` | **DEFINED** |
| `.timeline-item`, `.timeline-dot`, `.timeline-event` | **DEFINED** |
| `.issue-row`, `.issue-lifecycle` | **DEFINED** |
| Responsive breakpoints | **DEFINED** |

---

## Key Issues Fixed in This Pass

| # | Issue | Fix |
|---|-------|-----|
| 1 | IncidentsPage "Export postmortem" was a no-op | Implemented markdown download |
| 2 | IncidentsPage "Add to Knowledge Base" was a no-op | Implemented with session state + confirmation message |
| 3 | KnowledgePage "+ New Article" was a no-op | Implemented create form with save-to-state |
| 4 | AnalyticsPage scorecard had no DEMO label | Added DEMO DATA badge |
| 5 | JudgeModePage step "done" was always static (steps 7-26 always false) | Now computed from real investigation status |
| 6 | Dead files `Dashboard.tsx`, `InvestigationView.tsx` in codebase | Removed |
| 7 | Unused `components/Layout.tsx` | Removed |
| 8 | No shared ComingSoon component | Created `components/ComingSoon.tsx` |
| 9 | No shared EmptyState component | Created `components/EmptyState.tsx` |

---

## Remaining Known Limitations (Not Blocking)

- Issues/Incidents data is demo-only (no backend persistence). Clearly labeled DEMO.
- GitHub integration is not connected (requires OAuth token). Correctly shows COMING SOON.
- Code Intelligence, Code Review, Security, Test Center, Dependencies, Releases, Git branch creation are demo/static. Clearly labeled.
- Analytics Engineering Scorecard is static demo data — labeled DEMO DATA.
- No file upload in evidence input (paste-only). Known limitation.
- Investigations are in-memory only (restart clears them). Correct for demo.

---

## What Is Definitely Working (Do Not Break)

- Full investigation pipeline: create → start → stream → approve → implement → verify → regress → report
- SSE streaming in InvestigationPage
- All 9 InvestigationPage tabs
- DashboardPage demo launcher
- CommandPalette (Ctrl+K)
- Toast notifications
- All 13 backend agents
- All 18 REST endpoints
- Backend test suite (23/23)
- PerformancePage with real measured data
- RepositoriesPage with real local git data
