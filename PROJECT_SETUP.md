# FixFlow AI — Project Setup & Environment Discovery

> Phase A/B deliverable. Written **before** any application code, per the project brief.

---

## 1. Environment Discovered

Discovery was performed on the actual development machine before writing code.

| Item | Value | Notes |
|---|---|---|
| Operating system | Windows 11 Home Single Language, build 10.0.26200 | win32 |
| Architecture | AMD64 | |
| Node.js | **v24.14.1** | Ships `node:sqlite` and `node:test` built-ins |
| npm | 11.11.0 | Present on PATH |
| pnpm | 11.1.2 | Present, but not required |
| yarn | **not installed** | Not used |
| Python | 3.11.9 | Present, not required for this project |
| Git | 2.53.0.windows.2 | Configured: `Ayush5112006 <thummarayush05@gmail.com>` |
| Docker | **not installed** | No container strategy used |
| Local Ollama | Running on `127.0.0.1:11434` | Models: `llama3.2`, `minimax-m3:cloud`. **Optional** — see §6 |
| Cloud LLM API keys | **None present** in environment | No `*_API_KEY` / token env vars found |
| Repository state | Empty git repo, only `README.md` | Nothing to delete; no user files touched |
| npm registry | Reachable (`PONG 800ms`) | Installs work offline-of-GitHub too |

### Port availability (checked via `Get-NetTCPConnection -State Listen`)

Already occupied: `5000`, `5432`, `8080`, `27017`, `11434`, and a large block of
`496xx`/`497xx`/`50xxx` ephemeral ports.

Ports reserved for this project (verified free):

- **4000** — FixFlow backend API
- **5173** — Vite dev server (frontend)

### Implication of the discovery

The single most important finding is that **no cloud LLM credential is available**.
Therefore the agent reasoning engine must be able to run with **zero** network
calls and **zero** API keys, otherwise the hackathon demo fails on any judge's
machine. See §6 for how this shaped the design.

---

## 2. Selected Technology Stack

Chosen for reliability of the live demo, not for popularity.

### Backend (agent orchestration engine)

| Concern | Choice | Rationale |
|---|---|---|
| Runtime | Node.js 24 + TypeScript 5 | Recommended stack; native TS stripping available |
| HTTP | Express 5 | Recommended stack, universally understood |
| Persistence | **`node:sqlite` (built-in)** | Zero native-build risk on Windows. `better-sqlite3` would need a prebuild for Node 24 |
| Validation | `zod` | Small, typed, one dependency instead of four |
| Dev runner | `tsx` | Watch mode without a build step |
| Tests | **`node:test`** built-in runner | Zero test dependencies; already proven working on Node 24 |
| Typecheck | `tsc --noEmit` | Ships with TypeScript |
| Real-time | SSE (`text/event-stream`) | One-way server→client push, no socket lib needed |
| Repo ops | `git` CLI via allow-listed runner | Spec requires git history analysis |

**Deliberately not used:** no LLM SDK, no vector DB, no Prisma/TypeORM, no
Docker, no Redis, no queue library, no auth framework.

### Frontend

| Concern | Choice | Rationale |
|---|---|---|
| Framework | React 19 + Vite 7 | Recommended stack |
| Language | TypeScript | |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` | No `tailwind.config.js` / PostCSS setup needed |
| Routing | `react-router-dom` | |
| Server state | Plain `fetch` + a small SSE hook | React Query would be a second state system for one page's worth of data |
| Components | Hand-written, no UI kit | A kit would fight the dark engineering-dashboard aesthetic |

### Repository layout

```
fixflow-ai/
├─ backend/                 Express + TS agent engine (the product)
├─ frontend/                React + Vite dashboard (the UI)
├─ demo/                    The full-stack app FixFlow debugs, + seeded bugs
├─ tests/                   Cross-package end-to-end workflow tests
├─ workspaces/              Per-run git clones of demo projects (gitignored)
├─ docs/                    Architecture + agent spec
├─ PROJECT_SETUP.md         This file
└─ README.md
```

`workspaces/` exists so FixFlow never mutates a source tree in place. Every
investigation clones (or copies) the target project into a disposable worktree,
so a run is isolated, reproducible, and re-runnable.

---

## 3. Project Architecture

```
                    ┌──────────────────────────────────────┐
  Browser  ◀──SSE──┤  React Dashboard (Vite :5173)         │
        ──HTTP───▶ └──────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────────────────────┐
                    │ Express API (:4000)                       │
                    │  routes/  ·  investigations/  ·  reports/  │
                    └─────────────┬─────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────────────────────┐
                    │ Orchestrator — the Manager Agent           │
                    │  owns state machine, stages, approval gate │
                    └──┬──┬──┬──┬──┬──┬────────────────────────┘
       ┌───────────────┘  │  │  │  │  └──────────────┐
       ▼                  ▼  ▼  ▼  ▼                 ▼
   ┌────────┐        ┌────────┐ ┌────────┐  ┌────────────┐   parallel
   │ Code   │        │ API    │ │ DB     │  │ Test       │
   ├────────┤        ├────────┤ ├────────┤  ├────────────┤
   │Evidence│        │History │ │        │  │            │
   └────────┘        └────────┘ └────────┘  └────────────┘
                              │
                    ┌─────────▼──────────┐   findings  ┌──────────────┐
                    │ Root Cause Engine  ├───────────▶│ Evidence      │
                    │ hypotheses+scoring │            │ Matrix        │
                    └─────────┬──────────┘            └──────────────┘
                              │ ranked root cause + remediations
                    ┌─────────▼──────────┐
                    │ Change Plan        │──▶ HUMAN APPROVAL ──▶ Implementation
                    └─────────┬──────────┘                              │
                              │                                ┌─────────▼────────┐
                              │                                │ Verification     │
                              │                                │ + Regression     │
                              ▼                                └─────────┬────────┘
                    ┌──────────────────┐                               │
                    │ Report + Metrics │◀─────────────────────────────┘
                    └──────────────────┘

  Every agent reads through:  WorkspaceScanner  →  CodeIndex (symbols, routes,
  schemas, clients)  →  SandboxedRunner (allow-listed commands, cwd-scoped)
  Every agent writes through: finding objects → SQLite, never the filesystem.
```

### Design invariants

1. **Investigation is read-only.** Agents write *only* structured findings. The
   only agent permitted to touch source files is the Implementation Agent, and
   only after explicit human approval.
2. **No agent short-circuits another.** Each investigation agent derives its
   conclusions from the parsed code index and the evidence bundle, so no demo bug
   is special-cased anywhere in production code.
3. **Every claim is traceable.** A finding carries `evidence[]` with a file
   path + line range, or a log line, so the UI can show *why* a conclusion was
   reached.
4. **Real measurements only.** Metrics come from `Date.now()` deltas around real
   phases and real command execution. Nothing is estimated or hard-coded.

---

## 4. Development Commands

```bash
npm install                 # install all workspaces
npm run dev                 # backend :4000 + frontend :5173 concurrently
npm run dev:backend         # backend only
npm run dev:frontend        # frontend only
npm run build               # typecheck + production build of both
npm test                    # unit + integration tests
npm run test:e2e            # full FixFlow workflow against a demo bug
npm run seed:demo           # (re)generate the demo project + evidence
```

Ports are overridable via `PORT` and `VITE_API_BASE`.

---

## 5. Assumptions

1. **Target project under analysis is JavaScript/TypeScript.** The indexer parses
   JS/TS/JSON/SQL/MD/YAML. Other languages appear in the project map as
   "unanalysable" rather than being silently skipped.
2. **A git history exists on the target project** for the History Agent.
   Without it, that agent reports `NOT AVAILABLE` — it does not guess.
3. **Tests in the target project use a runner we can detect** (`node:test`,
   `vitest`, `jest`). If none is detectable, verification reports
   `NOT AVAILABLE` for tests rather than passing vacuously.
4. **Single-user, local prototype.** No authentication, no multi-tenancy, no
   RBAC. Deliberately out of scope for a hackathon demo.
5. **The demo project is the primary target**, but any local git repo path
   provided by the user can be analysed.
6. **Approval is a real gate, not a UI decoration.** The API refuses to run
   implementation without a persisted approval record carrying the exact plan
   hash that was shown to the human.

---

## 6. Dependencies Required

### Backend (`backend/package.json`)

| Package | Type | Why |
|---|---|---|
| `express` | runtime | HTTP layer |
| `zod` | runtime | request/response validation |
| `cors` | runtime | allow Vite origin |
| `tsx` | dev | TypeScript watch runner |
| `typescript` | dev | typecheck |
| `@types/*` | dev | types |

### Frontend (`frontend/package.json`)

| Package | Type |
|---|---|
| `react`, `react-dom`, `react-router-dom` | runtime |
| `vite`, `@vitejs/plugin-react`, `typescript`, `@types/*` | dev |
| `tailwindcss`, `@tailwindcss/vite` | dev |

### Root

| Package | Type | Why |
|---|---|---|
| `concurrently` | dev | one-command `npm run dev` |

**Total runtime dependency count across the whole product: 5.**

### On the optional LLM layer

The spec forbids fake AI responses presented as real agent reasoning. This
environment has Ollama but no cloud credential, and a 3.2B local model produces
unreliable structured output for a live judge demo.

So FixFlow's reasoning is implemented as a **deterministic analysis engine**:
it parses the target repository, builds a symbol/route/schema/client index,
extracts signals from logs and stack traces, and scores competing hypotheses
against that evidence. This is *real* analysis, fully reproducible, and it is
what actually discovers the root cause in the demo.

`backend/src/agents/llm/` contains a pluggable, **off-by-default** LLM advisor
that can narrate or re-rank findings when `FIXFLOW_LLM_URL` is set. The
workflow does not depend on it, and no LLM output is presented as evidence.
