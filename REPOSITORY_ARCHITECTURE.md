# FixFlow AI Repository Architecture

This document outlines the architecture connecting code repositories, local Git worktrees, GitHub remote APIs, and FixFlow's multi-agent AI investigation system.

## 1. System Overview

```
┌────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)              │
│  - RepositoriesPage (/repositories)                    │
│  - RepositoryDetailPage (/repositories/:id)            │
│  - FileExplorer, GitCommitGraph, IssueInvestigationBar │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP REST
┌───────────────────────────▼────────────────────────────┐
│                    FixFlow AI Backend                  │
│                                                        │
│  ┌───────────────────────┐   ┌───────────────────────┐ │
│  │   RepositoryService   │   │     GitHubService     │ │
│  │ (Catalog, State, Sync)│   │ (REST API, Issues, PR)│ │
│  └───────────┬───────────┘   └───────────┬───────────┘ │
│              │                           │             │
│  ┌───────────▼───────────┐   ┌───────────▼───────────┐ │
│  │       GitUtils        │   │    WebhookService     │ │
│  │(Spawn safely, no sh)  │   │  (HMAC SHA256 Verify) │ │
│  └───────────┬───────────┘   └───────────────────────┘ │
└──────────────┼─────────────────────────────────────────┘
               │
   ┌───────────┴───────────┐
   │                       │
┌──▼────────────────┐  ┌───▼─────────────────────────────┐
│  Local Worktree   │  │   FixFlow AI Investigation Swarm │
│(Git branches,     │  │  - Manager Agent                │
│ commits, diffs)   │  │  - Code Intelligence Indexer    │
│                   │  │  - Diagnosis & Root Cause Engine│
│                   │  │  - Patch Generator & Test Suite │
│                   │  │  - Automated Pull Request Engine│
└───────────────────┘  └─────────────────────────────────┘
```

## 2. Core Modules

### `RepositoryService` (`backend/src/services/repositoryService.ts`)
- Manages repository entities (`id`, `name`, `fullName`, `provider`, `defaultBranch`, `isLocal`, `syncStatus`).
- Auto-detects local Git workspace root (`devflow-ai`) and seeds curated demo projects (`InsightBoard`).
- Synchronizes repository metadata, issues, pull requests, and commit logs.

### `GitUtils` (`backend/src/utils/git.ts`)
- Runs Git commands with **strict parameter sanitization** through `exec.ts` (`spawn`, `shell: false`).
- Rejects any shell metacharacters (`|`, `;`, `&&`, `$()`, etc.).
- Inspects working trees (`git status --porcelain`), diffs (`git diff`), branch lists, commit history, and directory trees with depth limiting.

### `GitHubService` (`backend/src/services/githubService.ts`)
- Implements authenticated calls against GitHub REST API v3 using standard `fetch`.
- Provides real authentication verification, listing repos, querying issues and PRs, and posting new issues/PRs.
- Never fabricates fake success when GitHub credentials are absent.

### `WebhookService` (`backend/src/services/webhookService.ts`)
- Receives inbound GitHub events (`issues`, `pull_request`, `push`).
- Validates payload authenticity using crypto `createHmac('sha256')` against `X-Hub-Signature-256`.
- Logs event delivery audit trail with timestamp, event type, action, and delivery latency.

## 3. The Issue → Investigation Pipeline

FixFlow connects issues directly to AI code repair:
1. **Developer opens repository issues** in FixFlow AI.
2. Clicks **⚡ Start Investigation** on any issue.
3. FixFlow's `POST /api/repositories/:id/issues/:issueNumber/investigate` endpoint executes:
   - Links the issue number, title, and description.
   - Attaches repository context (`name`, `defaultBranch`, `localPath`).
   - Creates a new active FixFlow investigation session (`/investigate?investigationId=...`).
4. **FixFlow AI Swarm** activates:
   - Manager Agent reads issue reproduction notes.
   - Code Intelligence queries files for symbol references.
   - Sandbox runner reproduces the error.
   - Code Patch is tested against regression test suites.
5. **PR Engine** generates clean pull request preview ready for human approval and submission to GitHub.
