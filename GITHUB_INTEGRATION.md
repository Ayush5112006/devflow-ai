<<<<<<< HEAD
# GitHub Integration

## Overview

FixFlow AI connects to GitHub through the REST API v3 using a Personal Access Token.
No OAuth app registration is required for read-only access.

## Status

| Feature | Status | Notes |
|---------|--------|-------|
| Verify token / user | **LIVE** | `GET /api/integrations/github/status` |
| List accessible repos | **LIVE** | `GET /api/integrations/github/repos` |
| Import repository | **LIVE** | `POST /api/integrations/github/import` |
| Repository branches | **LIVE** | `GET /api/repositories/:id/branches` |
| Repository commits | **LIVE** | `GET /api/repositories/:id/commits` |
| Commit detail + diff | **LIVE** | `GET /api/repositories/:id/commits/:sha` |
| File tree | **LIVE** | `GET /api/repositories/:id/files` |
| File content (< 500KB) | **LIVE** | `GET /api/repositories/:id/file-content` |
| Issues list | **LIVE** | `GET /api/repositories/:id/issues` |
| Pull requests list | **LIVE** | `GET /api/repositories/:id/pull-requests` |
| Repository sync | **LIVE** | `POST /api/repositories/:id/sync` |
| Webhook receive + verify | **LIVE** | `POST /api/integrations/github/webhook` |
| Create GitHub PR | **COMING SOON** | Requires write access + branch push |
| Automatic background sync | **COMING SOON** | No scheduler in current architecture |
| GitHub OAuth app flow | **COMING SOON** | Requires OAuth app registration |

---

## Setup

### 1. Create a Personal Access Token

1. Visit https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Select scopes:
   - `repo` — for private repository access
   - `public_repo` — for public repositories only
4. Copy the token

### 2. Set the environment variable

```bash
export GITHUB_TOKEN=ghp_yourTokenHere
```

Add this to your `.env` file (never commit it):

```
GITHUB_TOKEN=ghp_yourTokenHere
```

### 3. Restart the backend

```bash
cd backend
npm run dev
```

### 4. Verify connection

```bash
curl http://localhost:4000/api/integrations/github/status
```

Expected response:
```json
{
  "github": {
    "configured": true,
    "login": "your-username",
    "name": "Your Name",
    "rateLimitRemaining": 4998,
    "error": null
  }
}
=======
# GitHub Integration in FixFlow AI

FixFlow AI connects GitHub repositories to the AI debugging swarm for automated issue investigation, code repair, and pull request generation.

## 1. Authentication & Security Model

FixFlow AI enforces strict non-falsification and security principles:
- **No Mock Connections**: If GitHub credentials are missing or invalid, the platform reports `configured: false` and guides the developer.
- **Never Expose Secrets**: GitHub Personal Access Tokens and OAuth tokens are never transmitted to the browser or leaked in API payloads.
- **Token Configuration**: Configured exclusively via environment variables:
  - `GITHUB_TOKEN`: GitHub Personal Access Token (classic with `repo` scope, or fine-grained PAT with Repository permissions: Contents (Read & Write), Pull Requests (Read & Write), Issues (Read & Write)).
  - `GITHUB_API_URL`: Optional custom enterprise or proxy URL (defaults to `https://api.github.com`).
  - `GITHUB_WEBHOOK_SECRET`: Secret key used for HMAC-SHA256 signature validation.

---

## 2. GitHub Connection Flow

```
Developer connects GitHub
       ↓
FixFlow Backend calls GET /api/repositories/github/auth
       ↓
GitHub API /user verified
       ↓
Returns Authenticated User (login, name, avatar, scopes)
       ↓
Developer selects from accessible repos (GET /api/repositories/github/repos)
       ↓
Imports repository into FixFlow (POST /api/repositories/github/import)
       ↓
Syncs Branches, Commits, Issues & Pull Requests
>>>>>>> origin/main
```

---

<<<<<<< HEAD
## Importing a Repository

### Via UI

1. Navigate to `/repositories`
2. Click **Connect GitHub** or **+ Add Repository**
3. Select the **GitHub** tab
4. Choose from the list of accessible repositories, or type `owner/repo` manually
5. Click **Import from GitHub**

### Via API

```bash
curl -X POST http://localhost:4000/api/integrations/github/import \
  -H "Content-Type: application/json" \
  -d '{"fullName": "octocat/hello-world"}'
```

---

## Permissions

| Permission | Required For |
|-----------|-------------|
| `repo` scope | Private repository access, issues, PRs |
| `public_repo` scope | Public repositories only |
| No special permissions | Reading public repository data |

GitHub token is **only read from the `GITHUB_TOKEN` environment variable**.
It is **never**:
- Stored in the database
- Returned to the frontend
- Logged (only the authenticated username is logged)

---

## Rate Limits

GitHub allows 5000 API requests per hour for authenticated tokens.
The current integration status endpoint shows the remaining count.

FixFlow does **not** automatically exhaust pagination — it fetches one page
per request to stay within rate limits.

---

## Security

- Token read exclusively from `GITHUB_TOKEN` env var
- Token never included in any API response
- All file paths validated against project root before serving
- Branch names validated against `/^[a-zA-Z0-9._\-\/]{1,200}$/`
- File content capped at 500KB to prevent memory exhaustion
- All git operations use the `ALLOWED_PROGRAMS` allowlist in `exec.ts`
=======
## 3. Supported Capabilities (Classification)

| Feature | Status | Description |
|---|---|---|
| **Verify Auth** | **LIVE** | Real roundtrip to `https://api.github.com/user` with configured PAT |
| **List User Repositories** | **LIVE** | Queries GitHub API with search, visibility, and pagination |
| **Import GitHub Repository** | **LIVE** | Registers repo in FixFlow, syncing metadata and issues |
| **Pull Issue Data** | **LIVE** | Fetches live GitHub issues with numbers, state, labels, and authors |
| **Create Issue** | **LIVE** | Creates issues directly on GitHub via POST `/repos/{owner}/{repo}/issues` |
| **Pull PRs** | **LIVE** | Fetches pull requests with branches, checks, and state |
| **Create Pull Request** | **LIVE** | Opens real GitHub pull requests via POST `/repos/{owner}/{repo}/pulls` |
| **Issue → Investigation** | **LIVE** | 1-click bridge passing GitHub issue context directly to FixFlow AI Swarm |
| **Automated PR Generation** | **LIVE** | FixFlow agent writes patches, passes tests, and generates PR preview |

---

## 4. Setup Guide

1. Generate a GitHub Personal Access Token:
   - Go to **GitHub Settings → Developer Settings → Personal Access Tokens → Tokens (classic)**.
   - Select scopes: `repo` (Full control of private repositories).
2. Configure `.env` in `backend/`:
   ```bash
   GITHUB_TOKEN=ghp_yourPersonalAccessTokenHere
   GITHUB_WEBHOOK_SECRET=your_webhook_hmac_secret
   ```
3. Restart the backend service.
4. Navigate to `/repositories` and click **Connect GitHub**.
>>>>>>> origin/main
