# REPOSITORY_IMPLEMENTATION_PLAN.md

## FixFlow AI — Repository Management System Plan

### Executive Summary
FixFlow AI is an agentic software maintenance and bug resolution platform. Currently, the application has robust code indexing, 6 parallel investigation agents, a root cause engine, and an automated verification pipeline. However, `/repositories` was not yet built and lacked the bridge connecting a code repository (local Git and remote GitHub) to the AI investigation workflow.

This plan details the full implementation of the **Repository Management System**:
1. Connecting real repositories (Local Git worktree + verified GitHub API integration)
2. Interactive Repository Workspace (`/repositories` & `/repositories/:repositoryId`)
3. File Tree Explorer with source viewing and syntax/symbol intelligence
4. Branch & Commit history viewer with unified diffs
5. Git Working Tree Status (Modified, Added, Deleted, Untracked)
6. Issue Management & Issue-to-Investigation 1-click bridge
7. Pull Request Center, Automated PR Generation from verified fixes, and PR creation
8. Secure GitHub Webhooks with HMAC signature verification
9. Code Intelligence repository QA search
10. End-to-end integration with FixFlow's existing Investigation pipeline

---

### Detailed Component & Function Audit

| File | Component / Function | Current Behavior | Required Change | Reason | Regression Risk | Testing Strategy |
|---|---|---|---|---|---|---|
| `backend/src/config.ts` | Configuration | Has `PORT`, `DATA_DIR`, `WORKSPACES_DIR`, etc. | Add `githubToken`, `githubWebhookSecret`, `githubApiUrl` | Required for GitHub API & secure webhook verification | Low — defaults to empty/unconfigured | Unit test config loading & fallback behavior |
| `backend/src/utils/git.ts` | `getGitInfo`, `git` | Only provides branch, latest commit, and untracked file list for a workspace | Expand with safe Git operations: branches, commit log with stats, commit diff, file tree, file content, status summary | Need real local Git repository inspection for local workspace repositories | Medium — ensure all commands run in allowed program whitelist (`git`) without shell execution | Unit tests verifying status, log, diff, and tree on real Git repository |
| `backend/src/services/githubService.ts` | New Service | None | Implement verified GitHub API client (auth verify, list repos, get repo, branches, commits, issues, PRs, create issue, create PR, file content) | Enables real GitHub integration when `GITHUB_TOKEN` is present, returns clear configuration instructions when missing | Low — isolated service module | Unit tests with mock responses + live test when configured |
| `backend/src/services/repositoryService.ts` | New Service | None (`demoCatalog.ts` has hardcoded `PROJECTS`) | Implement repository manager storing connected repositories (local git & imported GitHub), syncing metadata, issues, PRs | Manages connected repositories, sync status, and persistence | Low — integrates alongside `PROJECTS` | Test repo registration, local git detection, sync, and retrieval |
| `backend/src/services/webhookService.ts` | New Service | None | Implement GitHub webhook verification (HMAC SHA-256), event logging, and issue/PR notification dispatch | Handles incoming webhooks securely without accepting unauthorized payloads | Low — isolated webhook logic | Unit test HMAC validation, payload handling, rejection of invalid signatures |
| `backend/src/routes/repositories.ts` | New Route Module | None | API routes for `/api/repositories`, `/api/repositories/:id`, `/api/repositories/local/detect`, `/api/repositories/github/*`, `/api/integrations/github/webhook`, etc. | Exposes clean, typed REST endpoints for the frontend | Low — new routes under `/api/repositories` and `/api/integrations` | Integration tests with supertest or node:test HTTP requests |
| `backend/src/server.ts` | Express Server | Mounts only `/api` router for investigations | Mount repositories router and raw body middleware for webhook signature validation | Connects new endpoints to the server | Low | Server health check and route tests |
| `backend/src/investigations/investigationService.ts` | `create`, `run` | Resolves projects through `demoCatalog.ts` | Allow resolving projects from `repositoryService` (local Git or imported repository workspace) | Allows any connected repository to be the target of an investigation | Low — backward compatible fallback to `demoCatalog` | Run existing backend test suite |
| `frontend/src/services/api.ts` | Frontend API client | Only investigation and demo endpoints | Add typed API methods for repositories, files, branches, commits, issues, PRs, webhooks, code intelligence | Gives frontend typed communication with backend | Low — additions only | Verify all frontend requests return matching types |
| `frontend/src/App.tsx` | Layout & Routes | Nav contains only Dashboard & New Investigation; routes don't include `/repositories` | Add `Repositories` to topbar nav; add routes for `/repositories` and `/repositories/:repositoryId` | Primary navigation entry point for repository workspace | Low | Route tests, visual check |
| `frontend/src/pages/RepositoriesPage.tsx` | New Page | None | Complete Repository management workspace: Table of connected repos, search/filter/sort, local Git detection card, GitHub connection card, repository health cards | Core requirement for Phase 2, 3, 4, 5, 29 | Low | Component test & end-to-end user flow |
| `frontend/src/pages/RepositoryDetailPage.tsx` | New Page | None | Full tabbed view: Overview, Files, Branches, Commits, Issues, Pull Requests, Actions, Settings, Code Intelligence, Webhooks | Core requirement for Phase 6 through 23 | Low | Test tab switching, sub-views, and actions |
| `frontend/src/components/CommandPalette.tsx` | Actions | Only Dashboard and New Investigation | Add `Open Repositories` action | Fast keyboard navigation (Ctrl+K) | Low | Keyboard palette test |

---

### Classification: LIVE vs DEMO vs SIMULATED vs COMING SOON

1. **LIVE**:
   - Local Git repository detection, inspection, working tree status (modified/untracked/staged), diff viewer, commit log, branch listing, and file tree.
   - FixFlow AI Investigation from Repository Issue: Click "Start Investigation" on any repository issue (local or GitHub) -> automatically populates project, bug details, creates investigation, launches 6 parallel agents, derives root cause, generates change plan, human approval gate, executes fix, verifies with tests, and prepares PR summary.
   - GitHub Integration (when `GITHUB_TOKEN` is configured in environment / `.env`): Verifies token, lists user/org repositories, imports repository metadata, views live remote branches, commits, issues, PRs, creates issues, generates & submits Pull Requests.
   - GitHub Webhook endpoint (`/api/integrations/github/webhook`): Cryptographic HMAC-SHA256 signature verification, event logging, status monitoring.
   - Code Intelligence search: Symbol search, route inspection, file query.

2. **SIMULATED / DEMO**:
   - InsightBoard demo repository with 3 known real bugs as initial seed project.
   - When GitHub credentials are not configured, clear setup instructions and option to test against Local Git repository or simulated GitHub sandbox demo without faking active authentication status.

3. **COMING SOON**:
   - Automated periodic cron sync (requires external background worker queue like Redis/BullMQ or Cloud Tasks; clearly marked with required setup).
   - Automated write-back merge to protected remote branches without human review (safely restricted by security policy).

---

### Implementation Phases

1. **Backend Git & Repository Engine**:
   - Extended Git wrapper in `backend/src/utils/git.ts`.
   - `backend/src/services/repositoryService.ts` managing repository metadata, local Git detection, syncing, and file tree exploration.
   - `backend/src/services/githubService.ts` managing GitHub REST API interactions using `fetch` (with rate limit handling, secure headers, error diagnostics).
   - `backend/src/services/webhookService.ts` managing HMAC validation and event queue.
   - `backend/src/routes/repositories.ts` providing all API endpoints.

2. **Backend Server Integration**:
   - Update `backend/src/config.ts` for GitHub credentials.
   - Update `backend/src/server.ts` to register repository routes and webhook raw body handling.
   - Update `backend/src/investigations/investigationService.ts` to support connected repository workspaces.

3. **Frontend API & Routing**:
   - Update `frontend/src/services/api.ts` with repository methods.
   - Update `frontend/src/App.tsx` navigation and routes (`/repositories`, `/repositories/:repositoryId`).
   - Update `frontend/src/components/CommandPalette.tsx`.

4. **Frontend UI Components**:
   - `RepositoriesPage.tsx`: Header, Stats, Repository Table, Local Git auto-detection card, GitHub Connect dialog.
   - `RepositoryDetailPage.tsx`: Overview tab, File Explorer tab, Branches tab, Commits tab, Issues tab (with 1-click "Start Investigation"), Pull Requests tab (with PR generation preview and review), Git Status tab, Code Intelligence tab, Settings & Webhooks tab.

5. **Testing & End-to-End Verification**:
   - Backend unit and integration tests (`backend/test/repositories.test.ts`, `backend/test/webhooks.test.ts`).
   - End-to-end workflow verification: Local repository inspection -> Issue detection -> Start investigation -> AI agent analysis -> Change approval -> Verification -> PR Generation.
