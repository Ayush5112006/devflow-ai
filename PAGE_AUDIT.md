# FixFlow AI — Page Audit & Repair Plan

> Per-page: current problem → root cause → required change → files → risk → verification

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

## IssuesPage (`/issues`)

**Current State:** MOCKED  
**Problems:**
1. No DEMO badge — users/judges see issue data and think it's real
2. The "issue-row", "issue-lifecycle", "issue-lifecycle-step", "issue-lifecycle-dot", "issue-lifecycle-label" CSS classes are likely not in `styles.css` — rendering will be broken/unstyled

**Root Cause:** IssuesPage was added but CSS selectors were not verified against `styles.css`.

**Required Change:**
1. Add DEMO notice banner at the top of the page
2. Add missing CSS classes: `.issue-row`, `.issue-lifecycle`, `.issue-lifecycle-step`, `.issue-lifecycle-dot`, `.issue-lifecycle-label`
3. Add DEMO badge to page title area

**Files:** `frontend/src/pages/IssuesPage.tsx`, `frontend/src/styles.css`  
**Risk:** LOW  
**Verification:** IssuesPage renders lifecycle bar correctly; issue rows are clickable and styled.

---

## Sidebar / App.tsx (Health Check)

**Current State:** Static "Backend connected" text, always green  
**Problems:** No actual check of backend health. If backend is down, user sees no feedback.

**Root Cause:** `api.health()` exists in api.ts but is never called in the sidebar.

**Required Change:**
- In `App.tsx` Sidebar component: call `api.health()` on mount (and every 30s)
- Show green dot if `status === 'ok'`, red dot with "Backend offline" if null/error
- Show uptime in tooltip or subtitle

**Files:** `frontend/src/App.tsx`  
**Risk:** LOW — additive change  
**Verification:** Start frontend without backend → sidebar shows red "Backend offline"

---

## Performance Page (`/performance`) — NEW

**Current State:** MISSING — no route, no page file  
**Problems:** Route doesn't exist.

**Root Cause:** Was never created.

**Required Change:**
- Create `frontend/src/pages/PerformancePage.tsx` with Coming Soon content
- Add meaningful content: pipeline timing, agent stats from real API calls
- Add route in `App.tsx`
- Add to NAV_SECTIONS (System or Analytics section)

**Files:** `frontend/src/pages/PerformancePage.tsx` (new), `frontend/src/App.tsx`  
**Risk:** LOW — new file  
**Verification:** Navigate to `/performance` — page loads, shows real pipeline data.

---

## NewInvestigationPage (`/new`)

**Current State:** FUNCTIONAL but minimal  
**Problems:**
1. No file upload for evidence — only paste-in text box
2. No environment / context fields (environment name, branch, deploy version)
3. `projectId` hardcoded to `'insightboard'` — not surfaced to user
4. No visual "what happens next" to reassure user

**Root Cause:** Evidence was the simplest approach for initial MVP.

**Required Change:**
1. Add environment fields section: environment name (staging/prod/local), branch, version/tag
2. Add evidence file drop zone UI (read file as text, pass as evidence attachment) — mark "SIMULATED: file read in browser"
3. Add visual pipeline preview showing what agents will run
4. Show the hardcoded `projectId` visually as a "Project: InsightBoard" chip

**Files:** `frontend/src/pages/NewInvestigationPage.tsx`  
**Risk:** MEDIUM — adding new form sections  
**Verification:** Submit form with an uploaded text file; file content should appear in investigation evidence.

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

## KnowledgePage (`/knowledge`)

**Current State:** PARTIALLY FUNCTIONAL  
**Problems:**
1. `.panel-selected` CSS was recently added — needs verification it applies to article cards
2. "New Article" button does nothing — no click handler
3. "Edit" button on memory entries does nothing

**Root Cause:** CSS was added but panel-selected is being applied correctly (checked); buttons lack handlers.

**Required Change:**
1. Verify `.panel-selected` renders correctly on article selection
2. Add inline new-article form (similar to memory "Add fact" form)
3. Add inline edit for memory entries

**Files:** `frontend/src/pages/KnowledgePage.tsx`  
**Risk:** LOW  
**Verification:** Click article → border highlights. Click "+ New Article" → form appears.

---

## Repositories Page (`/repositories`) — NEW

**Current State:** MISSING  
**Problems:** No route, no page.

**Required Change:**
- Create `frontend/src/pages/RepositoriesPage.tsx`
- Show real git info from `api.git` (using the insightboard demo project git data)
- Show: branch, latest commit, recent commits, modified files
- GitHub integration section: Coming Soon with connect button
- Add route `/repositories` in `App.tsx`
- Add to sidebar under Delivery section

**Files:** `frontend/src/pages/RepositoriesPage.tsx` (new), `frontend/src/App.tsx`  
**Risk:** LOW  
**Verification:** Page loads, real git data appears.

---

## IncidentsPage (`/incidents`)

**Current State:** MOCKED  
**Problems:**
1. "Export postmortem (Markdown)" button is a no-op
2. "Add to Knowledge Base" button is a no-op  
3. No DEMO badge
4. Switching from list tab to detail by clicking — works but timeline styling needs confirmation

**Required Change:**
1. Add DEMO notice at top
2. Implement "Export postmortem" — generate and trigger download of a `.md` file
3. Implement "Add to Knowledge Base" — add to local `KnowledgePage` state (or at minimum show a toast "Added to Knowledge Base — DEMO")
4. Verify timeline CSS renders

**Files:** `frontend/src/pages/IncidentsPage.tsx`  
**Risk:** LOW  
**Verification:** Click "Export postmortem" → file downloads. "Add to KB" → toast.

---

## AnalyticsPage (`/analytics`)

**Current State:** PARTIALLY FUNCTIONAL  
**Problems:**
1. Engineering Scorecard is completely hardcoded (no connection to real data)
2. Audit log is all DEMO data  
3. Scorecard values don't change even after running real investigations

**Root Cause:** Scorecard was initially designed to be connected but never was.

**Required Change:**
1. Connect scorecard metrics to real data where possible:
   - "Incidents" score: 100 if 0 active incidents, scale otherwise
   - "Test Coverage" score: derive from pipeline's `medianTestsExecuted` if available
   - Keep "Code Quality", "Security", "Documentation" as clearly labeled DEMO
2. Add `DEMO` badge on scorecard section
3. Add investigation-based stats: total completed, total failed, fix success rate

**Files:** `frontend/src/pages/AnalyticsPage.tsx`  
**Risk:** LOW  
**Verification:** Run 2 investigations; "Fix Success Rate" card updates correctly.

---

## JudgeModePage (`/judge`)

**Current State:** PARTIALLY FUNCTIONAL  
**Problems:**
1. All steps 7-26 are `done: false` regardless of actual investigation state
2. No real connection to completed investigations for "done" state
3. "Metrics Summary" tab shows data from pipeline but could be much richer

**Required Change:**
1. Dynamically compute which steps are "done" based on `investigations` state:
   - Steps 1-6: always done (project setup)
   - Steps 7-16: done if any investigation is `completed` or beyond
   - Steps 17-26: done if investigation is `completed`
2. Link to the most recent completed investigation where applicable
3. Add richer "wow" metrics — numbers that impress judges

**Files:** `frontend/src/pages/JudgeModePage.tsx`  
**Risk:** LOW  
**Verification:** Run complete investigation; steps 7-26 should show as done.

---

## Shared Components (new)

### ComingSoon Component
**Required Change:** Create `frontend/src/components/ComingSoon.tsx`
- Props: `feature`, `description`, optional `eta`
- Show consistent "Coming Soon" UI with accent styling
- Used by: PerformancePage, RepositoriesPage, IntegrationsPage

### EmptyState Component  
**Required Change:** Create `frontend/src/components/EmptyState.tsx`
- Props: `title`, `description`, optional `action`
- Consistent empty state used instead of ad-hoc `.empty` divs

---

## Risk Assessment Summary

| Change | Risk | Breaking Potential |
|--------|------|--------------------|
| Add health check to sidebar | LOW | None — additive only |
| Add DEMO badges | LOW | None — additive only |
| Create PerformancePage | LOW | None — new file + route |
| Create RepositoriesPage | LOW | None — new file + route |
| Add CSS classes for IssuesPage | LOW | Could affect other pages if selector is too broad |
| NewInvestigationPage evidence upload | MEDIUM | Could break form submission if evidence parsing fails |
| AnalyticsPage scorecard update | LOW | None — changes display logic only |
| JudgeModePage step state | LOW | None — changes display state only |
| IncidentsPage postmortem export | LOW | None — new functionality |
