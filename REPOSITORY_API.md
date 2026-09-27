# Repository API Reference

## Base URL

```
http://localhost:4000
```

---

## Repository Endpoints

### List repositories

```
GET /api/repositories
```

Returns all registered repositories.

```json
{
  "repositories": [
    {
      "id": "repo_abc123",
      "name": "fixflow-ai",
      "provider": "local",
      "path": "/path/to/workspace",
      "defaultBranch": "main",
      "syncStatus": "synced",
      ...
    }
  ]
}
```

### Register a repository

```
POST /api/repositories
```

**Local:**
```json
{
  "provider": "local",
  "path": "/absolute/path/to/git/repo",
  "name": "my-repo"
}
```

**GitHub:**
```json
{
  "provider": "github",
  "fullName": "owner/repo"
}
```

### Get repository

```
GET /api/repositories/:id
```

### Remove repository

```
DELETE /api/repositories/:id
```

### Sync repository

```
POST /api/repositories/:id/sync
```

### Git status (local only)

```
GET /api/repositories/:id/git
```

Returns branch, working tree status, ahead/behind, recent commits.

### Branches

```
GET /api/repositories/:id/branches
```

### Commits

```
GET /api/repositories/:id/commits?page=1&per_page=20&branch=main
```

### Commit detail

```
GET /api/repositories/:id/commits/:sha
```

Returns commit metadata + diff.

### File tree

```
GET /api/repositories/:id/files?path=src
```

### File content

```
GET /api/repositories/:id/file-content?path=src/index.ts
```

Capped at 500KB. Returns `{ content, size, error }`.

### Issues (GitHub only)

```
GET /api/repositories/:id/issues?state=open&page=1&per_page=30
```

### Pull Requests (GitHub only)

```
GET /api/repositories/:id/pull-requests?state=open&page=1&per_page=20
```

### Repository health

```
GET /api/repositories/:id/health
```

---

## GitHub Integration Endpoints

### Connection status

```
GET /api/integrations/github/status
```

Returns authenticated user info and rate limit. Token is **never** included.

### List accessible repositories

```
GET /api/integrations/github/repos?type=all&per_page=30
```

### Import a GitHub repository

```
POST /api/integrations/github/import
```

```json
{ "fullName": "octocat/hello-world" }
```

### Webhook configuration

```
GET /api/integrations/github/webhook/config
```

### Webhook events log

```
GET /api/integrations/github/webhook/events
```

### Receive webhook

```
POST /api/integrations/github/webhook
```

Validates `X-Hub-Signature-256` when `GITHUB_WEBHOOK_SECRET` is set.

---

## Error Responses

All errors follow the shape:

```json
{
  "error": "Human-readable description",
  "code": "machine_code",
  "detail": "optional additional context"
}
```

Common codes:
- `bad_request` — 400: invalid input
- `not_found` — 404: resource not found
- `forbidden` — 403: path traversal or permission denied
- `validation_error` — 400: schema validation failure
- `internal_error` — 500: unexpected server error
