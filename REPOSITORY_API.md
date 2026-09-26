# FixFlow AI Repository API Reference

All repository management, Git introspection, GitHub syncing, and issue-to-investigation endpoints.

---

## 1. Repository Management

### `GET /api/repositories`
List all connected repositories (local git roots, imported GitHub repositories, and demo projects).

**Response `200 OK`**:
```json
{
  "repositories": [
    {
      "id": "devflow-ai",
      "name": "devflow-ai",
      "fullName": "Ayush5112006/devflow-ai",
      "provider": "local",
      "defaultBranch": "main",
      "currentBranch": "ASHISH",
      "isLocal": true,
      "syncStatus": "synced",
      "openIssuesCount": 2,
      "openPrsCount": 1
    }
  ]
}
```

### `GET /api/repositories/:id`
Get full repository metadata, working tree status, branches, commits, and activity.

### `POST /api/repositories/local`
Register a validated local Git repository on disk.
**Body**: `{ "path": "c:/path/to/project" }`

### `POST /api/repositories/:id/sync`
Trigger manual synchronization of branches, commits, issues, and PRs.

---

## 2. Git Introspection

### `GET /api/repositories/:id/branches`
Returns list of branches, current branch marker, latest commit hash, and protection status.

### `GET /api/repositories/:id/commits?limit=30`
Returns chronological commit log with commit SHA, message, author, date, and diff stats.

### `GET /api/repositories/:id/commits/:commitHash`
Returns single commit details including author, timestamp, full commit message, and file diffs.

### `GET /api/repositories/:id/working-diff`
Returns unstaged and staged changes in the local repository working tree.

### `GET /api/repositories/:id/files`
Browse repository directory structure and inspect files.
- `GET /api/repositories/:id/files?path=backend/src&depth=2`
- `GET /api/repositories/:id/files?filePath=backend/package.json`

---

## 3. GitHub Remote Integration

### `GET /api/repositories/github/auth`
Check GitHub connection status and get authenticated user info.
**Response**:
```json
{
  "configured": true,
  "user": {
    "login": "octocat",
    "name": "Mona Lisa",
    "avatarUrl": "https://github.com/images/error/octocat_happy.gif",
    "scopes": ["repo", "read:user"]
  }
}
```

### `GET /api/repositories/github/repos`
List repositories accessible to the configured GitHub PAT.

### `POST /api/repositories/github/import`
Import a GitHub repository into FixFlow AI.
**Body**: `{ "owner": "octocat", "name": "Hello-World" }`

---

## 4. Issues & Investigation Bridge

### `GET /api/repositories/:id/issues`
List open issues for the repository.

### `POST /api/repositories/:id/issues`
Create a new issue (either local or published to GitHub if permissions permit).

### `POST /api/repositories/:id/issues/:issueNumber/investigate`
⚡ **The Core AI Bridge**: Creates a new FixFlow investigation session preloaded with the issue's title, description, repository metadata, and source context.

---

## 5. Pull Requests & Automated PRs

### `GET /api/repositories/:id/pulls`
List open and closed pull requests.

### `POST /api/repositories/:id/pulls`
Create a new pull request on GitHub or local review queue.

### `POST /api/repositories/:id/pulls/automated`
Generate an automated PR preview from a verified FixFlow AI investigation patch.

---

## 6. Code Intelligence & Webhooks

### `POST /api/repositories/:id/query`
Natural language code intelligence lookup.
**Body**: `{ "query": "Where is authentication handled?" }`

### `POST /api/repositories/github/webhook`
Cryptographically verified GitHub webhook receiver.
