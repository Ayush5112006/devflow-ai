# FixFlow AI — Complete Codebase Audit Report

> Last updated: Full Phase 0 audit + P0/P1 repair pass (current session).  
> Statuses: **FUNCTIONAL** | **PARTIALLY FUNCTIONAL** | **MOCKED** | **EMPTY** | **BROKEN** | **DUPLICATE** | **COMING SOON**

---

## Frontend Pages (26 routes, 25 active files)

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| `DashboardPage.tsx` | `/` | **FUNCTIONAL** | Real data from `api.pipeline` + `api.listInvestigations`. Hero, status bar, demo launch, recent invs, pipeline comparison, measured perf all present. |
| `NewInvestigationPage.tsx` | `/new` | **FUNCTIONAL** | Creates real investigations via `api.createInvestigation` + `api.start`. Multi-evidence form, env fields. File upload added. |
| `InvestigationsListPage.tsx` | `/investigations` | **FUNCTIONAL** | Real investigation list from API. Demo launcher works. Status badges correct. |
| `InvestigationPage.tsx` | `/investigations/:id` | **FUNCTIONAL** | 9-tab detail page. SSE streaming. All tabs render. Approval gate, replan, implement all work. |
| `ProjectsPage.tsx` | `/projects` | **PARTIALLY FUNCTIONAL** | Reads real `api.projects()`. Hardcoded health checks and demo files clearly labeled. |
| `IssuesPage.tsx` | `/issues` | **MOCKED** | `DEMO` and `DEMO DATA` badges present. Local state only. Create-issue + Investigate → flow improved. |
| `GitCenterPage.tsx` | `/git` | **PARTIALLY FUNCTIONAL** | Real git info from `api.git`. Branch creation UI is front-end-only (no backend call). |
| `PullRequestsPage.tsx` | `/pull-requests` | **PARTIALLY FUNCTIONAL** | Reads completed investigations for PR summaries. Live data surfaced prominently. GitHub PR creation COMING SOON. |
| `ReleasesPage.tsx` | `/releases` | **MOCKED** | Hardcoded releases list, feature flags all demo. |
| `IncidentsPage.tsx` | `/incidents` | **MOCKED** | `DEMO_INCIDENTS` local data. Export postmortem (Markdown) works. Add to Knowledge Base works. |
| `KnowledgePage.tsx` | `/knowledge` | **PARTIALLY FUNCTIONAL** | Demo articles. AI memory editable in-memory. New Article form works in-memory. |
| `CodeIntelligencePage.tsx` | `/code-intelligence` | **MOCKED** | 4 hardcoded demo symbols. |
| `DebuggingPage.tsx` | `/debugging` | **MOCKED** | Log Intelligence — demo log entries, demo timeline. |
| `CodeReviewPage.tsx` | `/code-review` | **MOCKED** | Diff view and checklist — all demo data. |
| `SecurityPage.tsx` | `/security` | **MOCKED** | CWE codes, detail panel — all demo data. |
| `TestCenterPage.tsx` | `/test-center` | **MOCKED** | Test suites, coverage charts — all demo data. |
| `AnalyticsPage.tsx` | `/analytics` | **PARTIALLY FUNCTIONAL** | Reads `api.pipeline` + `api.listInvestigations`. Scorecard labeled DEMO. Audit trail from real investigation events added. |
| `MetricsPage.tsx` | `/metrics` | **PARTIALLY FUNCTIONAL** | Real pipeline data + agent registry shown. Some metrics labeled MEASURED vs DEMO. |
| `JudgeModePage.tsx` | `/judge` | **PARTIALLY FUNCTIONAL** | 26-step workflow, step done state dynamic from real investigation status. |
| `ReportsPage.tsx` | `/reports` | **PARTIALLY FUNCTIONAL** | Links to real completed investigations. List refreshes from API. |
| `SettingsPage.tsx` | `/settings` | **FUNCTIONAL** | Save feedback works (toast). Demo disclaimer present. |
| `IntegrationsPage.tsx` | `/integrations` | **FUNCTIONAL** | GitHub configure panel + coming-soon cards for other integrations. |
| `DependenciesPage.tsx` | `/dependencies` | **MOCKED** | Package health table, CVE count — demo data clearly labeled. |
| `PerformancePage.tsx` | `/performance` | **PARTIALLY FUNCTIONAL** | Shows real measured data when available; proper Coming Soon/empty state when not. |
| `RepositoriesPage.tsx` | `/repositories` | **PARTIALLY FUNCTIONAL** | Real local git data from first investigation. GitHub coming soon. |
| `MonitoringPage.tsx` | `/monitoring` | **COMING SOON** | New page — integration placeholders, observability connection state. |

### Previously Dead Code — Removed
- `Dashboard.tsx` — **REMOVED** (old duplicate)
- `InvestigationView.tsx` — **REMOVED** (old duplicate)
- `components/Layout.tsx` — **REMOVED** (unused, layout lives in App.tsx)

---

## Frontend Components (Active)

| Component | Status | Notes |
|-----------|--------|-------|
| `Badge.tsx` | **FUNCTIONAL** | `Badge`, `severityBadge`, `statusBadge` used across all pages. |
| `Card.tsx` | **FUNCTIONAL** | Wrapper with optional `title` and `action`. Used widely. |
| `CommandPalette.tsx` | **FUNCTIONAL** | Ctrl+K, links to all routes. More commands added. |
| `ErrorBoundary.tsx` | **FUNCTIONAL** | Wraps entire app. |
| `InvestigationTimeline.tsx` | **FUNCTIONAL** | Used in InvestigationPage timeline tab. |
| `LoadingSpinner.tsx` | **FUNCTIONAL** | Used on DashboardPage and multiple pages. |
| `PipelineDiagram.tsx` | **FUNCTIONAL** | Used in InvestigationPage pipeline tab. |
| `StageStepper.tsx` | **FUNCTIONAL** | Stage definitions, used in InvestigationPage. |
| `ToastProvider.tsx` | **FUNCTIONAL** | Used in App.tsx. SettingsPage uses it. |
| `ActivityLog.tsx` | **FUNCTIONAL** | Used in InvestigationPage activity log. |
| `ComingSoon.tsx` | **FUNCTIONAL** | Shared coming-soon placeholder component. |
| `EmptyState.tsx` | **FUNCTIONAL** | Shared empty-state component. |

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
| `GET /api/investigations/:id/change-plan` | GET | **FUNCTIONAL** | Change plan detail. |
| `GET /api/investigations/:id/verify` | GET | **FUNCTIONAL** | Verification result. |
| `GET /api/investigations/:id/stream` | GET | **FUNCTIONAL** | SSE real-time streaming. |
| `GET /api/investigations/:id/git` | GET | **FUNCTIONAL** | Git info for investigation workspace. |
| `GET /api/investigations/:id/report` | GET | **FUNCTIONAL** | Final report + metrics. |
| `POST /api/investigations/demo/:id/quickstart` | POST | **FUNCTIONAL** | Demo quick-start flow. |

---

## Backend Agents

| Agent | Status | Notes |
|-------|--------|-------|
| `managerAgent` | **FUNCTIONAL** | Orchestrates parallel investigation agents. |
| `evidenceAgent` | **FUNCTIONAL** | Parses and indexes evidence attachments. |
| `codeAgent` | **FUNCTIONAL** | Inspects source files and detects patterns. |
| `apiAgent` | **FUNCTIONAL** | Analyzes API contracts and responses. |
| `databaseAgent` | **FUNCTIONAL** | Checks DB schema, queries, column names. |
| `testAgent` | **FUNCTIONAL** | Runs existing test suites. |
| `historyAgent` | **FUNCTIONAL** | Checks git history for related changes. |
| `rootCauseAgent` | **FUNCTIONAL** | Synthesizes findings into root cause with confidence. |
| `implementationAgent` | **FUNCTIONAL** | Applies approved changes to source files. |
| `verificationAgent` | **FUNCTIONAL** | Runs tests after implementation to verify fix. |
| `regressionAgent` | **FUNCTIONAL** | Checks for unintended side effects of changes. |
| `reportingAgent` | **FUNCTIONAL** | Generates PR summary + engineering report. |

---

## Known Issues / Gaps

### P0 — Must Fix
1. **`/monitoring` route missing** — nav item not listed, no page
2. **`NewInvestigationPage` file upload** — evidence only paste-able, no file drop zone
3. **`IssuesPage` "Investigate →"** — goes to `/new` without pre-filling issue data
4. **Nav groups mismatch** — sidebar doesn't match spec (missing Operations group with Monitoring)

### P1 — Important
5. **`PullRequestsPage` live data** — real PR summary from investigations exists but buried below demo data
6. **`AnalyticsPage` audit trail** — shows placeholder instead of real investigation events
7. **Command Palette** — limited set of actions, missing deep navigation
8. **`RepositoriesPage`** — no repo management, just read-only git reflection

### Architecture Notes
- **No database persistence** — all investigations stored in-memory (`investigationService`). Restart loses all data. Intentional for demo but must be labeled.
- **No auth** — no user management. Intentional for demo.
- **GitHub integration** — not connected. All GitHub features are COMING SOON with proper labels.
- **Two CSS files** — `index.css` (legacy Tailwind-based, partially used) and `styles.css` (v2 design system). Some pages mix both. Should be consolidated long-term.
