# FixFlow AI — Complete Error Audit
Generated: 2025-01-28 | Auditor: Senior Engineering Review

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 7     |
| HIGH     | 9     |
| MEDIUM   | 8     |
| LOW      | 6     |

---

## P0 — CRITICAL

### ERR-001
- **Page:** All pages (Sidebar)
- **File:** `frontend/src/App.tsx:159`
- **Component:** `Sidebar` health check
- **Error:** Health check URL mismatch
- **Current:** `fetch('/api/health')` → 404 (proxied as `/api/health`, backend serves `/health`)
- **Expected:** Backend responds to `/health`, vite proxies `/api/*` → backend, so correct URL should be `/api/health` on backend OR the sidebar must call `/api/health` and the backend must register the route at `/api/health`
- **Root Cause:** Vite proxy forwards `/api/...` → `http://127.0.0.1:4000/api/...` (no rewrite). Backend mounts health at `/health` not `/api/health`. So `/api/health` → 404 on backend.
- **Severity:** CRITICAL
- **Fix:** Add `/api/health` alias route in `backend/src/server.ts` OR move health check to `/api/health`
- **Regression Risk:** LOW — isolated route addition
- **Verification:** `curl http://localhost:4000/api/health` returns `{status:'ok'}`

### ERR-002
- **Page:** All pages using `services/api.ts`
- **File:** `frontend/src/services/api.ts:275`
- **Component:** `api.health()`
- **Error:** `/health` endpoint called without `/api` prefix — will fail in browser (not proxied)
- **Current:** `get('/health')` → `fetch('/api/health')` → 404
- **Expected:** Returns `{status:'ok', version, uptime}`
- **Root Cause:** Same as ERR-001. The `get()` function prepends `BASE = '/api'` so this becomes `/api/health` which isn't on the backend.
- **Severity:** CRITICAL
- **Fix:** Same as ERR-001 — add `/api/health` to backend
- **Regression Risk:** LOW
- **Verification:** Sidebar shows "Backend connected" after fix

### ERR-003
- **Page:** Dashboard, Investigations, all pages using demoBugs
- **File:** `demo/evidence/` — missing d1 and d2 directories
- **Component:** `demoCatalog.ts:loadDemoBugs()`
- **Error:** `ENOENT: no such file or directory, open 'demo/evidence/d1/browser-console.log'`
- **Current:** Backend crashes on `/demo/bugs` API call with ENOENT
- **Expected:** Returns 3 demo bug scenarios with evidence
- **Root Cause:** Seed script (`backend/scripts/seedDemo.ts`) was never run. Evidence files for d1 and d2 don't exist.
- **Severity:** CRITICAL
- **Fix:** Create missing evidence files `demo/evidence/d1/browser-console.log`, `demo/evidence/d2/browser-console.log`, `demo/evidence/d2/server-access.log` with appropriate content matching the demo bugs
- **Regression Risk:** NONE — new files only
- **Verification:** `GET /api/demo/bugs` returns 3 bugs with evidence

### ERR-004
- **Page:** Dashboard
- **File:** `frontend/src/pages/DashboardPage.tsx:25`
- **Component:** `DashboardPage` data loading
- **Error:** `b.bugs` is undefined — API returns `{bugs:[]}` but code does `setDemoBugs(b.bugs)` where `b` is already the unwrapped array
- **Current:** `api.demoBugs()` returns `DemoBug[]` (unwrapped by `fetchEnveloped`), but code does `b.bugs` → TypeError
- **Expected:** Demo bugs populate the list
- **Root Cause:** `DashboardPage` imports from `../services/api.js` which returns `{bugs:[]}` wrapper, not the unwrapped array. But `api.demoBugs()` in services/api.ts returns `get<{bugs:DemoBug[]}>('/demo/bugs')` — the full object. So `b.bugs` is correct. BUT `api.pipeline()` returns a `PipelineFacts` object directly. Then `setDemoBugs(b.bugs)` and `setPipeline(p)` and `setInvestigations(i.investigations)` — these match the return types.
- **Severity:** CRITICAL (cascades if demo bugs fail to load)
- **Fix:** This is actually correct — depends on ERR-003 fix
- **Regression Risk:** NONE

### ERR-005
- **Page:** NewInvestigation, all project-related pages
- **File:** `backend/src/repositories/demoCatalog.ts:28`
- **Component:** `resolveProjectPath`
- **Error:** `sourcePath` field is a relative path (`demo/projects/insightboard`) but `ProjectTarget` interface in `frontend/src/types/index.ts` doesn't have `sourcePath`
- **Current:** Backend `PROJECTS` has `sourcePath` but frontend `ProjectTarget` type doesn't — type mismatch
- **Expected:** Types are consistent
- **Root Cause:** Backend type extension not reflected in frontend types
- **Severity:** HIGH
- **Fix:** Add `sourcePath?: string` to `ProjectTarget` in frontend types, or just ignore (it's used only server-side)
- **Regression Risk:** LOW

### ERR-006
- **Page:** All investigation pages
- **File:** `backend/src/investigations/investigationService.ts`
- **Component:** `run()` method
- **Error:** Backend crashes when `demo/evidence/d1/` files are missing — investigations cannot start
- **Current:** `loadDemoBugs()` throws ENOENT, causing quickstart to fail
- **Expected:** Demo quickstart creates investigation and starts agents
- **Root Cause:** Same as ERR-003 — missing evidence files
- **Severity:** CRITICAL
- **Fix:** Same as ERR-003
- **Regression Risk:** NONE

### ERR-007
- **Page:** Repositories page
- **File:** `frontend/src/pages/RepositoriesPage.tsx`
- **Component:** Local repository detect — `api.detectLocalRepo()`
- **Error:** The detect button calls `/api/repositories/local/detect` but backend has a router conflict: `GET /repositories/:id` matches before `GET /repositories/local/detect`
- **Current:** Route `GET /api/repositories/local/detect` is matched by `GET /api/repositories/:id` with `id = 'local'` which then calls `getRepository('local')` → 404
- **Expected:** Returns detected local repository
- **Root Cause:** Express route ordering — specific route `/local/detect` must be registered BEFORE `/:id`
- **Severity:** CRITICAL
- **Fix:** Move `/repositories/local/detect` route BEFORE `/:id` route in `repositories.ts`
- **Regression Risk:** LOW

---

## P1 — HIGH

### ERR-008
- **Page:** Investigation page
- **File:** `frontend/src/pages/InvestigationPage.tsx`
- **Component:** SSE stream connection
- **Error:** `useSSE` is imported from `../api.js` (old file) but InvestigationPage uses `../services/api.js`
- **Current:** `frontend/src/api.ts` exists alongside `frontend/src/services/api.ts` — duplicate API client
- **Expected:** Single API client
- **Root Cause:** Old `api.ts` was not removed when `services/api.ts` was created
- **Severity:** HIGH
- **Fix:** Check all imports; InvestigationPage uses `services/api.ts` correctly with `api.stream()`
- **Regression Risk:** LOW

### ERR-009
- **Page:** Git Center
- **File:** `frontend/src/pages/GitCenterPage.tsx:38`
- **Component:** Git info loading
- **Error:** `api.git(completed.id)` uses old API structure expecting `{git: g}` but services/api.ts correctly returns `{git: GitWorkingStatus}`
- **Current:** Works correctly — returns git info from investigation
- **Expected:** Shows real git information
- **Root Cause:** N/A — actually works, but depends on having a completed investigation
- **Severity:** MEDIUM

### ERR-010
- **Page:** Settings page
- **File:** `frontend/src/pages/SettingsPage.tsx:17`
- **Component:** `handleSave()`
- **Error:** Save button uses `setTimeout` fake — settings are never persisted
- **Current:** Shows "Saved!" after 800ms timeout without actually saving
- **Expected:** Settings persist OR clearly states demo-only with honest feedback
- **Root Cause:** No backend settings endpoint
- **Severity:** HIGH — misleads user
- **Fix:** The alert already says "session-only demo" — add honest label to save button text
- **Regression Risk:** LOW

### ERR-011
- **Page:** Pull Requests page
- **File:** `frontend/src/pages/PullRequestsPage.tsx`
- **Component:** PR list
- **Error:** Shows only demo MERGED PRs — no connection to real repository PRs from repositories API
- **Current:** Hardcoded demo PRs
- **Expected:** Shows real PRs from connected repositories, with clear DEMO label if using demo data
- **Root Cause:** Missing API integration
- **Severity:** HIGH
- **Fix:** Fetch from `/api/repositories` and get PRs for connected repos. Fall back to demo data with clear "DEMO DATA" label
- **Regression Risk:** LOW

### ERR-012
- **Page:** Code Review page
- **File:** `frontend/src/pages/CodeReviewPage.tsx`
- **Component:** Review comments
- **Error:** Shows only hardcoded demo review comments — not connected to real investigations
- **Current:** Hardcoded DEMO_DIFF and REVIEW_COMMENTS
- **Expected:** Shows code review from completed investigations
- **Root Cause:** Missing API integration
- **Severity:** HIGH
- **Fix:** Load review data from completed investigations; label demo data clearly
- **Regression Risk:** LOW

### ERR-013
- **Page:** Test Center
- **File:** `frontend/src/pages/TestCenterPage.tsx`
- **Component:** Test suite loading
- **Error:** Falls back to DEMO_SUITES with `lastRun: 'demo'` without clear labeling in the UI
- **Current:** Loads real test data from investigations (good) but falls back to demo data silently
- **Expected:** Clear "DEMO DATA" label when using fallback suites
- **Root Cause:** Label exists in code but not always displayed
- **Severity:** MEDIUM

### ERR-014
- **Page:** Releases page
- **File:** `frontend/src/pages/ReleasesPage.tsx`
- **Component:** Release list
- **Error:** Entirely hardcoded demo releases — never connected to API
- **Current:** `DEMO_RELEASES` always used; `api` is imported but never called
- **Expected:** Real release data or clear DEMO label
- **Root Cause:** api import unused
- **Severity:** HIGH

### ERR-015
- **Page:** Incidents, Monitoring, Postmortems
- **File:** Multiple pages
- **Component:** Page content
- **Error:** ComingSoon placeholders or hardcoded demo data without labels
- **Current:** Varies by page
- **Expected:** Clear DEMO/COMING SOON labels
- **Severity:** HIGH

### ERR-016
- **Page:** All pages with `import { api } from '../api.js'`
- **File:** `frontend/src/api.ts`
- **Component:** Old API client file
- **Error:** There are TWO api client files: `src/api.ts` and `src/services/api.ts`. Dashboard imports from `services/api.ts` which is correct.
- **Current:** `src/api.ts` is a legacy file — check if any page imports it
- **Expected:** Single canonical API client
- **Root Cause:** Refactor left old file in place
- **Severity:** HIGH
- **Fix:** grep all imports; redirect any `../api.js` imports to `../services/api.js`
- **Regression Risk:** MEDIUM

---

## P2 — MEDIUM

### ERR-017
- **Page:** All pages
- **File:** `frontend/src/index.css` vs `frontend/src/styles.css`
- **Component:** CSS design system
- **Error:** Two CSS files with overlapping variables (`--ff-*` vs `--canvas`, `--ink`, etc.)
- **Current:** `index.css` uses `--ff-*` prefix, `styles.css` uses direct names
- **Expected:** Single design token system
- **Severity:** MEDIUM
- **Fix:** `styles.css` is the canonical file. Verify `index.css` doesn't override it

### ERR-018
- **Page:** InvestigationPage
- **File:** `frontend/src/pages/InvestigationPage.tsx`
- **Component:** Tab keyboard navigation
- **Error:** Tab key navigation in `onTabKey` function — minor accessibility issue
- **Severity:** LOW

### ERR-019
- **Page:** All pages
- **File:** Multiple
- **Component:** Error boundaries
- **Error:** `ErrorBoundary` is mounted at App level only — page-level errors crash the entire layout
- **Severity:** MEDIUM
- **Fix:** Wrap each `<Route element>` with ErrorBoundary or add per-page try/catch

### ERR-020
- **Page:** Debugging page
- **File:** `frontend/src/pages/DebuggingPage.tsx`
- **Component:** Log entries
- **Error:** Entirely hardcoded demo log data with no real connection
- **Severity:** MEDIUM (demo context is clear from the page)

---

## P3 — LOW

### ERR-021 — `console.log` / `console.error` in backend
- Multiple `console.error` calls in `investigations.ts` routes (lines 129, 218)
- These are acceptable for fire-and-forget error logging, but should use the logger
- **Severity:** LOW

### ERR-022 — Unused `api` import in ReleasesPage
- `ReleasesPage` imports `api` but never uses it
- **Severity:** LOW — TypeScript doesn't flag unused imports by default in this config

### ERR-023 — Missing `<title>` updates per page
- `index.html` has static `<title>FixFlow AI</title>` — no dynamic title per route
- **Severity:** LOW

### ERR-024 — Navigation items without explanatory text for "Coming Soon" features
- Some sidebar items lead to pages that are purely ComingSoon wrappers
- **Severity:** LOW

### ERR-025 — `MetricsPage`, `PerformancePage`, `MonitoringPage`, `PostmortemsPage`
- These pages load correctly but show mostly demo/placeholder content
- **Severity:** LOW — acceptable for demo

### ERR-026 — Missing ARIA labels on some icon buttons
- Several icon-only buttons lack `aria-label`
- **Severity:** LOW
