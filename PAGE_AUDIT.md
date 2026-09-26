# FixFlow AI — Page Audit & Repair Plan

> Per-page: current problem → root cause → required change → files → risk → verification
> **Last updated:** Current session — full P0/P1 pass complete.

---

## DashboardPage (`/`)

**Current State:** FUNCTIONAL  
**Problems:**
- Information hierarchy doesn't put "health first" — hero occupies too much space before you see critical pending-approval alerts
- Pending approval banner appears below the status bar (correct), but the status bar itself doesn't call out urgency visually enough
- Demo scenarios section has no DEMO badge

**Root Cause:** Hero is full-width and very tall; status bar comes after it. The pending-approval banner is second in the DOM.

**Required Change:**
- Move pending-approval banner to immediately after the header if approvals exist
- Add DEMO badge chip to Demo Scenarios section heading
- The hero can stay but should not block critical operational info

**Files:** `frontend/src/pages/DashboardPage.tsx`  
**Risk:** LOW — only cosmetic/layout  
**Verification:** Load page with an active pending-approval investigation; banner must appear prominently before demo scenarios.

---

## IssuesPage (`/issues`) ✅

**Current State:** MOCKED — CORRECTLY LABELED
**Fix Applied:**
- `DEMO` banner and `DEMO DATA` badge already present.
- **NEW:** "Investigate →" button now passes `state: { title, description, severity }` to `/new` via React Router. The NewInvestigationPage reads this and pre-fills the form.
- Users can now click any issue's "Investigate →" and land on `/new` with the issue data already populated.

**Remaining Limitation:** Data is in-memory only. No backend persistence. Correctly labeled.

---

## Sidebar / App.tsx (Health Check) ✅

**Current State:** FUNCTIONAL
**Fix Applied:** Sidebar already calls `api.health()` on mount and every 30 seconds (confirmed in `App.tsx` lines 144-161). Shows green/red dot + uptime correctly. No changes needed.

---

## Performance Page (`/performance`) ✅

**Current State:** PARTIALLY FUNCTIONAL
**Fix Applied:** Page exists (`PerformancePage.tsx`), route exists in `App.tsx`, shows real measured pipeline data when available. Clean empty state when no investigations have run.

---

## NewInvestigationPage (`/new`) ✅

**Current State:** FUNCTIONAL
**Fix Applied:**
1. **File drop zone added** — users can drag-and-drop `.log`, `.txt`, `.json`, `.har` files or click to browse. Files are read as text in the browser (never uploaded to any server — labeled clearly). Extension-based auto-detection of evidence kind.
2. **Pre-fill from Issues** — when navigating from IssuesPage "Investigate →", URL state `{ title, description, severity }` is read via `useLocation()` and the form auto-populates.
3. Environment fields already existed (environment, deployTarget, nodeVersion, os).
4. Project context chip "InsightBoard" already visible.

**Files:** `frontend/src/pages/NewInvestigationPage.tsx`
**Risk:** LOW — additive changes, no changes to form submission logic
**Verification:** Drag a `.log` file onto the evidence drop zone → new evidence item appears with file content. Navigate from Issues "Investigate →" → form pre-filled.

---

## InvestigationPage (`/investigations/:id`)

**Current State:** FUNCTIONAL  
**Problems (to verify):**
1. Tab availability logic — tabs should be grayed/disabled when stage hasn't run yet
2. Evidence display in tabs — each tab should show related evidence
3. "Pipeline" tab should prominently show agent names and parallel structure

**Root Cause:** Likely fine — this is the most battle-tested page.

**Required Change (verification):**
- Run a full investigation and check all 9 tabs
- Confirm tab keyboard navigation works
- Confirm evidence blocks expand correctly

**Files:** `frontend/src/pages/InvestigationPage.tsx`  
**Risk:** NONE  
**Verification:** Run demo investigation D1, navigate all 9 tabs.

---

## KnowledgePage (`/knowledge`) ✅

**Current State:** PARTIALLY FUNCTIONAL — FIXED
**Fix Applied:**
1. `.panel-selected` CSS is defined in `styles.css` — renders correctly on article selection
2. "+ New Article" button **FIXED** — now opens an inline create form with title/category/content/tags fields
3. New articles save to session state and immediately appear in the list

**Files:** `frontend/src/pages/KnowledgePage.tsx`
**Verification:** Click "+ New Article" → form appears. Fill and save → article appears in list.

---

## Repositories Page (`/repositories`) ✅

**Current State:** PARTIALLY FUNCTIONAL
**Fix Applied:** Page exists, route exists. Shows real local git data (branch, latest commit, recent commits, modified files). GitHub integration shows COMING SOON with connect button. `LOCAL GIT` badge on header.

---

## IncidentsPage (`/incidents`) ✅

**Current State:** MOCKED — FIXED
**Fix Applied:**
1. "Export postmortem (Markdown)" **FIXED** — triggers real browser download of `.md` file with full postmortem content
2. "Add to Knowledge Base" **FIXED** — updates session state, shows confirmation message, disables button after use
3. Timeline CSS confirmed working (`.timeline-item`, `.timeline-dot` defined in `styles.css`)

**Files:** `frontend/src/pages/IncidentsPage.tsx`
**Verification:** Click "Export postmortem" on postmortem tab → file downloads. "Add to KB" → button disabled with confirmation.

---

## AnalyticsPage (`/analytics`) ✅

**Current State:** PARTIALLY FUNCTIONAL — IMPROVED
**Fix Applied:**
1. Engineering Scorecard labeled `DEMO DATA`.
2. DORA metrics connect to real investigation data.
3. **Audit log now LIVE** — derives real entries from actual investigation state transitions. Shows LIVE badge when investigations exist; falls back to DEMO DATA with label when session is empty.

**Files:** `frontend/src/pages/AnalyticsPage.tsx`
**Verification:** Run an investigation → audit log shows real entry with LIVE badge.

---

## JudgeModePage (`/judge`) ✅

**Current State:** PARTIALLY FUNCTIONAL — FIXED
**Fix Applied:**
1. Added `computeDoneSteps()` function that maps real investigation status to step completion
2. Steps 1-6: always done (project is set up, demo scenarios exist)
3. Steps 7+: progress based on investigation status (`awaiting_approval` → step 13, `completed` → step 26)
4. PENDING label added to steps not yet reached

**Files:** `frontend/src/pages/JudgeModePage.tsx`
**Verification:** Run a demo investigation; step completion advances as investigation progresses.

---

## Shared Components ✅

### ComingSoon Component — CREATED
**File:** `frontend/src/components/ComingSoon.tsx`
- Props: `feature`, `description`, `benefit`, `planned`
- Uses `.coming-soon-box` / `.coming-soon-label` CSS classes from `styles.css`

### EmptyState Component — CREATED
**File:** `frontend/src/components/EmptyState.tsx`
- Props: `icon`, `title`, `text`, `action`
- Uses `.empty`, `.empty-icon`, `.empty-title`, `.empty-text` CSS classes

---

## MonitoringPage (`/monitoring`) ✅ NEW

**Current State:** CREATED — COMING SOON
**What was built:**
- New page at `/monitoring` with proper empty state showing no integrations are connected
- Metric grid shows `—` values (not fake data) until a provider is connected
- Info banner linking to `/integrations`
- 6 integration cards (Datadog, Sentry, PagerDuty, Prometheus/Grafana, CloudWatch, New Relic) each with COMING SOON badge and "Planned" description
- "What monitoring enables" section explaining future capabilities
- Link to existing Incidents page for demo scenarios

**Files:** `frontend/src/pages/MonitoringPage.tsx`, `frontend/src/App.tsx`
**Risk:** NONE — new page, no changes to existing functionality
**Verification:** Navigate to `/monitoring` → page loads, no fake metrics shown, integration cards visible.

---

## Navigation (App.tsx) ✅ UPDATED

**Current State:** FIXED
**Fix Applied:**
- Sidebar nav groups restructured to match product spec: Workspace / Engineering / Quality / Delivery / Operations / Knowledge / System
- **Operations group added** with Incidents + Monitoring
- Incidents moved from Engineering to Operations
- `/monitoring` route added
- `MonitoringPage` imported and wired

**Files:** `frontend/src/App.tsx`
**Verification:** Sidebar shows 7 groups including "Operations" with Incidents and Monitoring.

---

## PullRequestsPage (`/pull-requests`) ✅ IMPROVED

**Current State:** PARTIALLY FUNCTIONAL — IMPROVED
**Fix Applied:**
- When a completed investigation exists with a PR summary, a prominent banner now appears at the TOP of the page (before the tabs) with a "View live PR draft →" button
- Generate PR tab now shows a LIVE badge when real data is available
- Previously the live data was a low-visibility banner inside a tab

**Files:** `frontend/src/pages/PullRequestsPage.tsx`
**Verification:** Complete a demo investigation → banner appears prominently at top of PR page.

---

## Risk Assessment Summary

| Change | Risk | Breaking Potential |
|--------|------|--------------------|
| Add health check to sidebar | LOW | None — additive only |
| Add DEMO badges | LOW | None — additive only |
| Create PerformancePage | LOW | None — new file + route |
| Create RepositoriesPage | LOW | None — new file + route |
| Add CSS classes for IssuesPage | LOW | Could affect other pages if selector is too broad |
| NewInvestigationPage evidence file drop zone | LOW | Additive only — drop zone appends to existing evidence items |
| NewInvestigationPage prefill from Issues | LOW | Uses router state — no effect if state is absent |
| AnalyticsPage audit log from real data | LOW | Falls back to demo data when no investigations exist |
| JudgeModePage step state | LOW | None — changes display state only |
| IncidentsPage postmortem export | LOW | None — new functionality |
| MonitoringPage creation | NONE | New page, no existing code touched |
| Sidebar nav group restructure | LOW | Visual only — all routes unchanged |
