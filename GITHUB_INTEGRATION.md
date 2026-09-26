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
```

---

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
