# FixFlow AI — Feature Registry

> Every feature with frontend / backend / data status and priority.  
> Status: ✅ LIVE | ⚠️ PARTIAL | 🟡 DEMO | 🔲 COMING SOON | ❌ MISSING

---

## Core Investigation Pipeline

| Feature | Frontend | Backend | Data | Status | Priority |
|---------|----------|---------|------|--------|----------|
| Create investigation (form) | `NewInvestigationPage` | `POST /api/investigations` | LIVE | ✅ LIVE | — |
| Start investigation (pipeline) | `NewInvestigationPage` | `POST /api/investigations/:id/start` | LIVE | ✅ LIVE | — |
| Demo quickstart | `DashboardPage`, `InvestigationsListPage` | `POST /api/investigations/demo/:id/quickstart` | LIVE | ✅ LIVE | — |
| SSE streaming updates | `InvestigationPage` (useInvestigation hook) | `GET /api/investigations/:id/stream` | LIVE | ✅ LIVE | — |
| Human approval gate | `InvestigationPage` ChangePlanTab | `POST /api/investigations/:id/approve` | LIVE | ✅ LIVE | — |
| Replan with feedback | `InvestigationPage` ChangePlanTab | `POST /api/investigations/:id/replan` | LIVE | ✅ LIVE | — |
| Implementation trigger | `InvestigationPage` | `POST /api/investigations/:id/implement` | LIVE | ✅ LIVE | — |
| View findings (9 tabs) | `InvestigationPage` | `GET /api/investigations/:id` | LIVE | ✅ LIVE | — |
| Evidence paste input | `NewInvestigationPage` | Included in `POST /api/investigations` | LIVE | ✅ LIVE | — |
| Evidence file upload | ❌ Missing | N/A | — | ❌ MISSING | P0 |
| Environment fields in bug intake | ❌ Missing | N/A | — | ❌ MISSING | P0 |
| List investigations | `InvestigationsListPage` | `GET /api/investigations` | LIVE | ✅ LIVE | — |
| Investigation detail — Pipeline tab | `InvestigationPage` PipelineTab | GET investigation | LIVE | ✅ LIVE | — |
| Investigation detail — Findings tab | `InvestigationPage` FindingsTab | GET investigation | LIVE | ✅ LIVE | — |
| Investigation detail — Root Cause tab | `InvestigationPage` RootCauseTab | GET investigation | LIVE | ✅ LIVE | — |
| Investigation detail — Change Plan tab | `InvestigationPage` ChangePlanTab | GET investigation | LIVE | ✅ LIVE | — |
| Investigation detail — Implementation tab | `InvestigationPage` ImplementationTab | GET investigation | LIVE | ✅ LIVE | — |
| Investigation detail — Verification tab | `InvestigationPage` VerificationTab | GET investigation | LIVE | ✅ LIVE | — |
| Investigation detail — Regression tab | `InvestigationPage` RegressionTab | GET investigation | LIVE | ✅ LIVE | — |
| Investigation detail — Report tab | `InvestigationPage` ReportTab | GET investigation | LIVE | ✅ LIVE | — |

---

## Dashboard

| Feature | Frontend | Backend | Data | Status | Priority |
|---------|----------|---------|------|--------|----------|
| Engineering Command Center hero | `DashboardPage` | — | Static | ✅ LIVE | — |
| Status bar (active/pending/completed) | `DashboardPage` | `GET /api/investigations` | LIVE | ✅ LIVE | — |
| Pipeline facts (parallel agents, stages) | `DashboardPage` | `GET /api/pipeline` | LIVE | ✅ LIVE | — |
| Pending approvals banner | `DashboardPage` | `GET /api/investigations` | LIVE | ✅ LIVE | — |
| Demo scenarios launcher | `DashboardPage` | `GET /api/demo/bugs` | LIVE | ✅ LIVE | — |
| Recent investigations list | `DashboardPage` | `GET /api/investigations` | LIVE | ✅ LIVE | — |
| Engineering workflows quick nav | `DashboardPage` | — | Static | ✅ LIVE | — |
| Workflow comparison (manual vs AI) | `DashboardPage` | `GET /api/pipeline` | LIVE | ✅ LIVE | — |
| Measured performance section | `DashboardPage` | `GET /api/pipeline` | LIVE | ✅ LIVE | — |
| Backend health check (sidebar) | `App.tsx` Sidebar | `GET /health` | LIVE | ❌ MISSING | P0 |

---

## Issues

| Feature | Frontend | Backend | Data | Status | Priority |
|---------|----------|---------|------|--------|----------|
| Issue list with filters | `IssuesPage` | None | 🟡 DEMO | 🟡 DEMO | P0 badge |
| Issue detail panel | `IssuesPage` IssueDetail | None | 🟡 DEMO | 🟡 DEMO | — |
| Create issue form | `IssuesPage` | None | In-memory | ⚠️ PARTIAL | — |
| Lifecycle progress bar | `IssuesPage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Link to investigation | `IssuesPage` | None | 🟡 DEMO | 🟡 DEMO | — |
| DEMO badge indicator | ❌ Missing | — | — | ❌ MISSING | P0 |

---

## Incidents

| Feature | Frontend | Backend | Data | Status | Priority |
|---------|----------|---------|------|--------|----------|
| Incident list | `IncidentsPage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Incident timeline | `IncidentsPage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Postmortem generator | `IncidentsPage` | None | 🟡 DEMO | 🟡 DEMO | P1 improve |
| Export postmortem (Markdown) | ❌ Button no-op | None | — | ❌ BROKEN | P1 |
| Add to Knowledge Base | ❌ Button no-op | None | — | ❌ BROKEN | P1 |

---

## Analytics

| Feature | Frontend | Backend | Data | Status | Priority |
|---------|----------|---------|------|--------|----------|
| DORA metrics (fix time, success rate) | `AnalyticsPage` | `GET /api/pipeline` | LIVE | ✅ LIVE | — |
| Session performance (when obs available) | `AnalyticsPage` | `GET /api/pipeline` | LIVE | ✅ LIVE | — |
| Engineering scorecard | `AnalyticsPage` | None | 🟡 DEMO | 🟡 HARDCODED | P1 |
| Audit log | `AnalyticsPage` | None | 🟡 DEMO | 🟡 DEMO | — |

---

## Knowledge Base

| Feature | Frontend | Backend | Data | Status | Priority |
|---------|----------|---------|------|--------|----------|
| Knowledge articles list | `KnowledgePage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Article detail panel | `KnowledgePage` | None | 🟡 DEMO | 🟡 DEMO | — |
| AI project memory (editable) | `KnowledgePage` | None | In-memory | ⚠️ PARTIAL | — |
| Onboarding tour | `KnowledgePage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Create new article | ❌ Button no-op | None | — | ❌ BROKEN | P1 |

---

## Code Analysis

| Feature | Frontend | Backend | Data | Status | Priority |
|---------|----------|---------|------|--------|----------|
| Code Intelligence symbols | `CodeIntelligencePage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Code Review diff view | `CodeReviewPage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Security CWE findings | `SecurityPage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Test suites + coverage | `TestCenterPage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Log Intelligence | `DebuggingPage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Dependencies health | `DependenciesPage` | None | 🟡 DEMO | 🟡 DEMO | — |

---

## Delivery

| Feature | Frontend | Backend | Data | Status | Priority |
|---------|----------|---------|------|--------|----------|
| Git center — branch info | `GitCenterPage` | `GET /api/investigations/:id/git` | LIVE | ✅ LIVE | — |
| Git center — branch creation | `GitCenterPage` | ❌ None | UI-only | ❌ BROKEN | P2 |
| Pull requests — from investigations | `PullRequestsPage` | `GET /api/investigations` | LIVE | ⚠️ PARTIAL | — |
| Pull requests — create on GitHub | ❌ UI-only | None | — | 🔲 COMING SOON | — |
| Releases list | `ReleasesPage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Feature flags | `ReleasesPage` | None | 🟡 DEMO | 🟡 DEMO | — |

---

## Judge Mode / Reports

| Feature | Frontend | Backend | Data | Status | Priority |
|---------|----------|---------|------|--------|----------|
| 26-step workflow navigator | `JudgeModePage` | `GET /api/pipeline` | LIVE | ⚠️ PARTIAL | P1 polish |
| Metrics summary tab | `JudgeModePage` | `GET /api/pipeline` | LIVE | ✅ LIVE | — |
| Before vs After comparison | `JudgeModePage` | None | 🟡 DEMO | 🟡 DEMO | — |
| Reports list (completed investigations) | `ReportsPage` | `GET /api/investigations` | LIVE | ✅ LIVE | — |
| Full investigation report export | `InvestigationPage` ReportTab | `GET /api/investigations/:id/report` | LIVE | ✅ LIVE | — |

---

## System / Infrastructure

| Feature | Frontend | Backend | Data | Status | Priority |
|---------|----------|---------|------|--------|----------|
| Integrations — GitHub configure | `IntegrationsPage` | None | UI-only | ⚠️ PARTIAL | — |
| Integrations — other tools | `IntegrationsPage` | None | — | 🔲 COMING SOON | — |
| Settings page | `SettingsPage` | None | In-memory | ✅ LIVE | — |
| Metrics / Agent registry | `MetricsPage` | `GET /api/pipeline` | LIVE | ✅ LIVE | — |
| CommandPalette (Ctrl+K) | `CommandPalette` | — | Static | ✅ LIVE | — |
| Error boundary | `ErrorBoundary` | — | — | ✅ LIVE | — |
| Toast notifications | `ToastProvider` | — | — | ✅ LIVE | — |
| Performance page | ❌ Not created | None | — | ❌ MISSING | P0 |
| Repositories page | ❌ Not created | None | — | ❌ MISSING | P1 |

---

## Missing Work Summary

### P0 — COMPLETE ✅
- [x] Add DEMO badge to IssuesPage header (was already present)
- [x] Sidebar health check pings real `/health` endpoint (was already done in App.tsx)
- [x] `/performance` route exists and works
- [x] Environment/context fields added to NewInvestigationPage
- [x] Multiple evidence items supported in NewInvestigationPage

### P1 — COMPLETE ✅
- [x] `/repositories` page created with real local git data + COMING SOON for GitHub
- [x] Fix "Export postmortem" button in IncidentsPage (Markdown download)
- [x] Fix "Add to Knowledge Base" button in IncidentsPage (session state)
- [x] Fix "New Article" button in KnowledgePage (create form)
- [x] Added DEMO DATA label to AnalyticsPage scorecard
- [x] JudgeModePage step "done" state now computed from real investigation status
- [x] Created shared `ComingSoon` component (`components/ComingSoon.tsx`)
- [x] Created shared `EmptyState` component (`components/EmptyState.tsx`)

### P2 — COMPLETE ✅
- [x] Removed dead code: `Dashboard.tsx`, `InvestigationView.tsx`
- [x] Removed unused `components/Layout.tsx`
- [x] ProjectsPage already uses `api.projects()` (done earlier)
