# FixFlow AI — Page Audit & Repair Plan

> Per-page: current problem → root cause → required change → files → risk → verification
> **Last updated:** After P0/P1 repair pass. Fixed items are marked ✅.

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
**Fix Applied:** `DEMO` banner and `DEMO DATA` badge were already present. CSS classes `.issue-row`, `.issue-lifecycle` are defined in `styles.css` (lines 848+). No changes needed.

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

**Current State:** PARTIALLY FUNCTIONAL — FIXED
**Fix Applied:**
1. Engineering Scorecard now has `DEMO DATA` badge clearly labeling it as static analysis of the InsightBoard demo project
2. DORA-style metrics (Fix Success Rate, Lead Time) already connect to real investigation data
3. Audit log is clearly labeled DEMO

**Files:** `frontend/src/pages/AnalyticsPage.tsx`
**Verification:** Scorecard section shows "DEMO DATA" badge.

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
