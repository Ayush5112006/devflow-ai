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
```

---

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
