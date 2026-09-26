# Repository Implementation Plan

## Audit Summary

### Architecture Reality

| Layer | Current State | Plan |
|-------|--------------|------|
| Backend | Express + TypeScript (ESM), in-memory store, no database | Add in-memory repository registry (same pattern as investigations) |
| Git util | `getGitInfo()` in `backend/src/utils/git.ts` — read-only git commands via `tryRun` | Extend with branches, file tree, full status, commit detail |
| GitHub | Not implemented | GitHub REST API via native `fetch` using `GITHUB_TOKEN` env var |
| Frontend | `RepositoriesPage.tsx` shows Coming Soon sections | Full replacement — repository workspace with tabs |
| Routing | `/repositories` single route | Add `/repositories/:id` detail route |
| API | `/api/investigations/:id/git` — only connected to investigations | Add `/api/repositories/*` namespace |
| Webhooks | None | Add `/api/integrations/github/webhook` with HMAC-SHA256 verification |
| Tests | `backend/test/` + `backend/tests/` | Add `backend/test/repositories.test.ts` |

---

## Files to Change / Create

### Backend

| File | Component/Function | Current | Required Change | Regression Risk | Test Strategy |
|------|--------------------|---------|-----------------|-----------------|---------------|
| `backend/src/repositories/repositoryStore.ts` | NEW: in-memory repository registry | — | Create Repository model + CRUD | None | Unit test CRUD operations |
| `backend/src/utils/git.ts` | `getGitInfo`, new `getGitBranches`, `getGitFileTree`, `getGitCommitDetail`, `getGitStatus` | Read-only basics | Add branch list, file tree, detailed status, commit diff | Low — additive only | Test against the workspace git repo |
| `backend/src/routes/repositories.ts` | NEW router `/api/repositories` | — | Full REST endpoints | None | Integration tests |
| `backend/src/routes/integrations.ts` | NEW router `/api/integrations/github/webhook` | — | Webhook receiver + HMAC verification | None | Unit test signature validation |
| `backend/src/server.ts` | Mount new routers | Only `router` mounted at `/api` | Add repositories + integrations routers | Low — additive | E2E smoke test |
| `backend/src/types/index.ts` | Add `Repository`, `RepositoryBranch`, `GitFileEntry`, `WebhookEvent` types | No repo types | Add types | None | TypeScript compile |

### Frontend

| File | Component/Function | Current | Required Change | Regression Risk | Test Strategy |
|------|--------------------|---------|-----------------|-----------------|---------------|
| `frontend/src/pages/RepositoriesPage.tsx` | Main page | Coming Soon UI | Complete rewrite — repository workspace | Low — isolated page | Manual + visual |
| `frontend/src/pages/RepositoryDetailPage.tsx` | NEW: detail view | — | Overview/Files/Branches/Commits/Issues/PRs tabs | None | Manual |
| `frontend/src/services/api.ts` | API client | Investigation-only | Add repository endpoints | Low | TypeScript compile |
| `frontend/src/App.tsx` | Router | No `:id` route | Add `/repositories/:id` route | Low | Visual smoke |
| `frontend/src/types/index.ts` | Types | No repo types | Add `Repository`, `Branch`, etc. | None | TypeScript compile |

---

## Feature Classification

| Feature | Status | Condition |
|---------|--------|-----------|
| Local repository registration (register workspace as repo) | **LIVE** | Always available — workspace has `.git` |
| Local git status (branch, modified files, recent commits) | **LIVE** | Uses existing `git.ts` util |
| Local file explorer | **LIVE** | Uses `walkProject` + `readTextFile` from `fsSafe.ts` |
| Local branch list | **LIVE** | `git branch -a` via `tryRun` |
| Local commit history | **LIVE** | `git log` via `tryRun` |
| Local git status panel | **LIVE** | `git status --short` via `tryRun` |
| GitHub integration — read repos | **LIVE** when `GITHUB_TOKEN` configured | Uses GitHub REST API v3 |
| GitHub issues list | **LIVE** when `GITHUB_TOKEN` + repo configured | GitHub REST API |
| GitHub PR list | **LIVE** when `GITHUB_TOKEN` + repo configured | GitHub REST API |
| GitHub branch list | **LIVE** when `GITHUB_TOKEN` + repo configured | GitHub REST API |
| GitHub commits | **LIVE** when `GITHUB_TOKEN` + repo configured | GitHub REST API |
| GitHub repository file tree | **LIVE** when `GITHUB_TOKEN` + repo configured | GitHub REST API |
| Issue → Investigation | **LIVE** | Reuses existing investigation creation API |
| PR generation from investigation | **LIVE** | Reuses existing report.prSummary |
| Webhook receive + verify | **LIVE** when `GITHUB_WEBHOOK_SECRET` configured | HMAC-SHA256 |
| Webhook issue events | **LIVE** | Stores events in memory |
| Create GitHub PR | **COMING SOON** | Requires push access + branch management |
| Automatic sync / background jobs | **COMING SOON** | No scheduler in current architecture |
| GitHub OAuth flow | **COMING SOON** | Requires OAuth app registration |
| GitLab / Bitbucket | **COMING SOON** | Out of scope |

---

## Security Decisions

- `GITHUB_TOKEN` and `GITHUB_WEBHOOK_SECRET` are read only from environment variables, never stored or returned to the frontend
- All file paths validated with existing `assertInside()` helper
- Branch names validated against `/^[a-zA-Z0-9._\-\/]{1,200}$/`
- All git commands go through the existing `tryRun` / `ALLOWED_PROGRAMS` allowlist
- Webhook endpoint validates `X-Hub-Signature-256` before processing any payload
- File content returned has a hard size cap (reuses `config.maxFileBytes`)

---

## API Endpoints

```
GET    /api/repositories                        — list registered repositories
POST   /api/repositories                        — register a repository (local path or GitHub)
DELETE /api/repositories/:id                    — remove a repository

GET    /api/repositories/:id                    — repository detail + health summary
POST   /api/repositories/:id/sync              — trigger a sync
GET    /api/repositories/:id/git               — git status (branch, modified files)
GET    /api/repositories/:id/branches          — branch list
GET    /api/repositories/:id/commits           — commit history (paginated)
GET    /api/repositories/:id/commits/:sha      — commit detail + diff
GET    /api/repositories/:id/files             — file tree
GET    /api/repositories/:id/files/*           — file content
GET    /api/repositories/:id/issues            — issues (GitHub or local demo)
GET    /api/repositories/:id/pull-requests     — PRs (GitHub or local demo)

POST   /api/integrations/github/webhook        — webhook receiver
GET    /api/integrations/github/status         — GitHub connection status
GET    /api/integrations/github/repos          — list accessible GitHub repos (requires token)
```
