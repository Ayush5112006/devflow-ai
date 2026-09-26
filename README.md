<<<<<<< HEAD
# 🚀 [Your Project Title Here]

> ⚠️ **Replace everything in `[ ]` brackets with your actual content before submission.**

---

## 👥 Team

| Field | Value |
|---|---|
| **Team Name** | [Your Team Name] |
| **Track** | [AI / DevOps / Sustainability / Open] |
| **Team Lead** | [Name] — [email@ibm.com] |
| **Members** | [Name 1], [Name 2], [Name 3] |

---

## 🎯 Problem Statement

> In 2–3 sentences: What problem does your project solve? Who experiences this problem?

[Describe the real-world problem your project addresses. Be specific about who the user is and what pain point they face.]

---

## 💡 Solution

> In 2–3 sentences: What did you build? How does it solve the problem above?

[Describe your solution clearly. Explain the core mechanism — what makes it work.]

---

## ✨ Key Features

- **Feature 1:** [Brief description — e.g., "Real-time anomaly detection using watsonx.ai"]
- **Feature 2:** [Brief description]
- **Feature 3:** [Brief description]
- **Feature 4:** [Optional]
- **Feature 5:** [Optional]

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | [e.g., Python, TypeScript] |
| **Frameworks** | [e.g., FastAPI, React] |
| **IBM Technologies** | [e.g., watsonx.ai, IBM Bob, IBM Cloud] |
| **Databases** | [e.g., PostgreSQL, Redis] |
| **Other** | [e.g., Docker, GitHub Actions] |

---

## 📁 Repository Structure

```
├── src/                  # All source code
├── docs/                 # Written documentation
│   ├── problem-statement.md
│   ├── solution-overview.md
│   ├── architecture.md
│   └── setup-guide.md
├── demo/                 # Demo artifacts
│   ├── screenshots/      # App screenshots
│   └── demo-video-link.txt  # Link to demo video
├── presentation/         # Slide deck
└── submission.yaml       # Structured submission metadata
=======
# FixFlow AI
### AI Software Engineering Operating System
*From production bug to verified fix — one connected agentic workflow.*

> **IBM Bob 2.0 AI Innovation Hackathon**

---

## Problem

In real software teams, a bug report contains incomplete and fragmented information.
A developer may receive a description, a screenshot, browser console errors, backend logs,
a stack trace, API responses, and repository access — and must **manually connect all of these pieces**.

For a full-stack application, debugging often requires tracing:

```
Frontend → API client → Backend route → Controller → Service → Database → Response → Frontend
```

This creates measurable pain:

| Problem | Impact |
|---|---|
| Long investigation time | 90–180 min for a typical field-mismatch or schema bug |
| Excessive context switching | 8–12 manual file opens per investigation |
| Incorrect root-cause assumptions | ~35% rework rate on first fixes |
| Insufficient regression testing | Bugs re-introduced in related code paths |
| Incomplete documentation | Institutional knowledge lost |

---

## Solution

**FixFlow AI** is an agentic software maintenance platform.

A developer provides a project repository, a bug report, and any available evidence (logs, stack traces, screenshots).
Six specialized agents investigate in parallel, a root-cause engine correlates the findings, a change plan is generated,
a **human approval checkpoint** gates implementation, and the full workflow is verified and documented automatically.

The developer stays in control of every code change. FixFlow provides the evidence — humans make the decision.

---

## Architecture

```
┌─────────────────────────────────────┐
│  React Dashboard (Vite :5173)        │  SSE push
│  Investigation Workspace             │◄────────────────────────────┐
└──────────────────────┬──────────────┘                             │
                       │ HTTP/REST                                   │
┌──────────────────────▼──────────────────────────────────────────┐ │
│                 Express API (:4000)                               │ │
│  /api/investigations  /api/demo  /api/projects                   │ │
└──────────────────────┬──────────────────────────────────────────┘ │
                       │                                             │
┌──────────────────────▼──────────────────────────────────────────┐ │
│                Manager Agent                                     ├─┘
│   owns the state machine · gates approval · fans out agents      │
└──┬──┬──┬──┬──┬──┬───────────────────────────────────────────────┘
   │  │  │  │  │  └──────────────┐
   ▼  ▼  ▼  ▼  ▼                 ▼
[Evidence] [Code] [API] [DB] [Test] [History]
      ↓ parallel, isolated, read-only
      Findings + Signals (structured, traceable)
                       │
          ┌────────────▼────────────┐
          │  Root Cause Engine      │
          │  evidence matrix        │
          │  hypothesis scoring     │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  Change Plan            │
          │  (per-file, minimal)    │
          └────────────┬────────────┘
                       │
              ⏸ HUMAN APPROVAL
                       │
          ┌────────────▼────────────┐
          │  Implementation Agent   │  (write-only to workspacePath)
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  Verification + Regression │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  Report + Metrics       │
          └─────────────────────────┘
```

### Design Invariants

1. **Investigation is read-only.** Six agents run concurrently and never write to source files.
2. **Human approval is a real gate**, not a decoration. The API cryptographically checks that the approved plan hash matches before implementation begins.
3. **Every claim is traceable.** Every finding carries `evidence[]` with a file path + line range.
4. **Real measurements only.** Metrics come from `Date.now()` deltas around real phases. Nothing is estimated in production code.
5. **No LLM required.** The reasoning engine is a deterministic code analyser — fully reproducible, works offline, on any machine.

---

## Agent Architecture

| Agent | Responsibility |
|---|---|
| **Manager Agent** | Owns the state machine; fans out investigation agents; blocks at approval gate |
| **Code Investigation Agent** | Locates reported symbols, traces call paths, audits error handling |
| **API / Service Agent** | Compares producer response shapes vs consumer field reads; detects env mismatches |
| **Database Agent** | Cross-references SQL schemas and ORM models against query column references |
| **Test Agent** | Runs the test suite baseline; identifies coverage gaps for the reported symptom |
| **Evidence Agent** | Parses logs, stack traces, and bug report for runtime facts (missing properties, DB errors, HTTP failures) |
| **Change History Agent** | Uses `git log` to correlate recent file changes with implicated tokens; never assumes causation |
| **Root Cause Engine** | Builds a hypothesis matrix, scores each against corroborating signals, selects the most evidence-supported root cause |
| **Change Plan Generator** | Produces minimal file edits with regression risk and verification method for each change |
| **Implementation Agent** | Applies only approved changes via search-and-replace; never touches unrelated files |
| **Verification Agent** | Runs tests, linting, type-checking, and the original reproduction command post-fix |
| **Regression Agent** | Analyses callers and dependents; runs regression tests; generates a focused test if coverage is missing |
| **Reporting Agent** | Generates a professional engineering report and a PR summary with real metrics |

---

## Workflow

```
1. Create Investigation      → provide bug report + evidence
2. Project Analysis          → index all files, routes, schemas, tests
3. Parallel Investigation    → 6 agents run concurrently (read-only)
4. Root Cause Analysis       → evidence matrix + confidence score
5. Change Plan               → minimal per-file edits with risk assessment
6. ⏸ HUMAN APPROVAL         → developer reviews and approves
7. Implementation            → approved changes applied to workspace copy
8. Verification              → tests, lint, type-check, repro command
9. Regression Analysis       → impact analysis + regression test suite
10. Final Report             → engineering report + PR summary + metrics
>>>>>>> 6772e4c46e4964627df97de5aba316c3490dd1cb
```

---

<<<<<<< HEAD
## ⚡ How to Run

> **Copy these exact steps from your [`docs/setup-guide.md`](docs/setup-guide.md)**

```bash
# 1. Clone the repo
git clone https://github.com/[your-repo].git
cd [your-repo]

# 2. Install dependencies
[your install command here]

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Run the project
[your run command here]
=======
## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | Node.js 24 + TypeScript 5 + Express 4 | Recommended; Node 24 ships `node:sqlite` and `node:test` built-in |
| Validation | Zod | Single runtime dependency for request/response validation |
| Frontend | React 18 + Vite 6 + Tailwind CSS v4 | Recommended; zero config with `@tailwindcss/vite` |
| Routing | React Router v6 | Standard SPA routing |
| Persistence | In-memory (prototype) | Zero-dependency; SQLite available as an upgrade path |
| Real-time | SSE (`text/event-stream`) | Server-push, no WebSocket library needed |
| Tests | `node:test` built-in | Zero test-framework dependencies |
| Repo ops | `git` CLI via allow-listed sandboxed runner | History analysis with no arbitrary command execution |
| LLM | **Off by default** | Pluggable via `FIXFLOW_LLM_URL` env var; demo works entirely offline |

---

## Installation

**Prerequisites:** Node.js ≥ 22.5 (tested on 24.14.1), npm ≥ 10, Git

```bash
# Clone the repository
git clone <repo-url>
cd fixflow-ai

# Install all workspaces
npm install
>>>>>>> 6772e4c46e4964627df97de5aba316c3490dd1cb
```

---

<<<<<<< HEAD
## 🖥️ Demo

| Artifact | Link |
|---|---|
| 📹 Demo Video | [See demo/demo-video-link.txt](demo/demo-video-link.txt) |
| 🌐 Live Demo | [See demo/live-demo-url.txt](demo/live-demo-url.txt) |
| 🖼️ Screenshots | [See demo/screenshots/](demo/screenshots/) |
| 📊 Presentation | [See presentation/slides.pdf](presentation/) |

---

## ⚠️ Known Limitations

> Be honest — judges appreciate transparency over overclaiming.

- [Limitation 1: e.g., "Authentication is mocked — not production-ready"]
- [Limitation 2: e.g., "Only tested on Chrome"]
- [Limitation 3: e.g., "Feature X is scaffolded but not fully implemented"]

---

## 🏅 What We're Most Proud Of

[Tell the judges what part of your submission is strongest and worth paying close attention to.]

---
=======
## Environment Setup

No environment variables are required to run the demo.

Optional variables (all have sensible defaults):

```bash
PORT=4000                          # Backend API port
FIXFLOW_LLM_URL=http://...         # Enable optional LLM narration (off by default)
FIXFLOW_LLM_MODEL=llama3.2        # LLM model name when LLM is enabled
FIXFLOW_LOG_LEVEL=info             # debug | info | warn | error
```

---

## Running the Project

```bash
# Start backend (port 4000) + frontend (port 5173) together:
npm run dev

# Or separately:
npm run dev:backend     # http://127.0.0.1:4000
npm run dev:frontend    # http://localhost:5173
```

---

## Running Tests

```bash
npm test                # backend unit + integration tests (23 tests)
npm run typecheck       # typecheck both backend and frontend
```

---

## Demo Instructions

1. Start the application: `npm run dev`
2. Open http://localhost:5173 in your browser
3. Select one of the three demo bugs on the Dashboard
4. Click **"Investigate with FixFlow"**
5. Watch the Pipeline tab as six agents run in parallel
6. Review the Agent Activity log for timestamped progress
7. On the **Root Cause** tab, see the evidence matrix and confidence score
8. On the **Change Plan** tab, review the proposed changes
9. Click **"Approve Fix Plan"** to proceed
10. Watch Implementation, Verification, and Regression tabs populate
11. View the **Report** tab for the engineering report + metrics comparison

---

## Example Bugs (InsightBoard Demo Project)

InsightBoard is a customer-feedback sentiment dashboard with three realistic, intentionally seeded defects.

### Bug D1 — Prediction Detail Card Shows Blank Badge

**Symptom:** Clicking a prediction row shows a blank sentiment badge and throws a TypeError.

**Root cause (discovered by FixFlow, not hard-coded):**  
The API route `GET /api/predictions/:id` sends `{ prediction: { label, confidence } }` but the consumer
reads `prediction.prediction.label` — one extra `.prediction` hop. The code was written expecting the
outer wrapper key name to match the resource name, but the service returns `{ prediction: ... }` directly.

**How FixFlow finds it:**  
The API Agent detects that `renderDetail` (in `web/app.js:35`) reads `prediction.label` while
`GET /api/predictions/:id` returns `{ label }` at the top level of `prediction`. The Evidence Agent
confirms the TypeError from the browser console log. The Root Cause Engine correlates both signals.

---

### Bug D2 — Dashboard Empty, Every API Call 404s

**Symptom:** The browser requests `/undefined/api/predictions` and gets HTML 404 pages back.

**Root cause (discovered by FixFlow):**  
`web/api.js` reads `import.meta.env.VITE_API_BASE`, but `.env.example` declares `VITE_API_URL`.
The undefined variable is interpolated into the URL, producing the literal path `/undefined/api/...`.

**How FixFlow finds it:**  
The API Agent sees `VITE_API_BASE` referenced in `web/api.js` but not declared in any env file,
while `VITE_API_URL` is declared with a similarity score of 0.88. The Evidence Agent confirms
the `/undefined/` path from the server access log. Combined confidence: 92%.

---

### Bug D3 — `GET /api/orders` Returns 500

**Symptom:** The orders endpoint fails with `no such column: o.customer_name`.

**Root cause (discovered by FixFlow):**  
The SQL query in `server/services/orderService.js` references `o.customer_name` and `o.total_cents`,
but the `orders` table schema declares `customer` and `amount`. The query was written with invented
column names that do not match the actual schema.

**How FixFlow finds it:**  
The Database Agent indexes `server/db/schema.sql` (declaring `customer`, `amount`) and cross-references
it against the SQL query (using `customer_name`, `total_cents`). The Evidence Agent confirms the
runtime SQLite error. Similarity scores map `customer_name → customer` (0.60) and `total_cents → amount` (0.55).

---

## Before/After Workflow

### Without FixFlow (Manual)

```
Bug report received
→ Open browser console → Find stack trace → Identify file
→ Open file → Trace call path → Open API route
→ Compare field names manually → Check schema manually
→ Form hypothesis → Write fix → Run tests manually
→ Check for regression manually → Write PR description
Total: ~90–180 min · 15+ manual steps
```

### With FixFlow AI

```
Bug report submitted
→ Manager Agent coordinates 6 parallel agents (automatic)
→ Evidence + Code + API + DB + Test + History agents run concurrently
→ Root Cause Engine correlates findings with confidence score
→ Change Plan generated with regression risk
→ ⏸ Human reviews and approves (1 manual step)
→ Implementation + Verification + Regression automated
→ Engineering report + metrics generated
Total: ~30–90 seconds · 1 manual step (approval)
```

---

## Metrics

All metrics are measured from real execution timestamps — nothing is estimated.

| Metric | Measured |
|---|---|
| Total workflow duration | `Date.now()` delta from start to report |
| Files inspected | Count of files walked by `buildCodeIndex` |
| Hypotheses generated | Count from Root Cause Engine |
| Tests executed | Sum of `totalTests` across all `CheckResult` records |
| Manual steps | 1 (the approval gate) |
| Steps automated | All other investigation + implementation + verification + reporting steps |
| Time saved | Baseline (90 min) − FixFlow measured time |

---

## Future Improvements

- **Persistent storage:** Replace in-memory state with SQLite for investigation history across restarts
- **LLM narration layer:** Use the pluggable LLM advisor to generate natural-language explanations alongside the deterministic analysis
- **Multi-project support:** Allow connecting any local git repository, not just the demo project
- **Diff review UI:** Show a proper diff viewer with syntax highlighting before approval
- **Regression test editor:** Let the developer edit the generated regression test before saving
- **CI integration:** POST a FixFlow investigation result to GitHub/GitLab as a PR comment
- **Python/Go/Java indexer:** Extend the code indexer to support non-JS project stacks

---

## Project Structure

```
fixflow-ai/
├── backend/
│   └── src/
│       ├── agents/
│       │   ├── manager/          Manager Agent (orchestrator)
│       │   ├── code/             Code Investigation Agent
│       │   ├── api/              API / Service Agent
│       │   ├── database/         Database Agent
│       │   ├── testing/          Test Agent
│       │   ├── evidence/         Evidence Agent
│       │   ├── history/          Change History Agent
│       │   ├── rootCause/        Root Cause Engine + Change Plan
│       │   ├── implementation/   Implementation Agent
│       │   ├── verification/     Verification Agent
│       │   ├── regression/       Regression Agent
│       │   └── reporting/        Report + Metrics
│       ├── analysis/             Code indexer, lexer, expectations
│       ├── investigations/       Investigation service (state machine)
│       ├── repositories/         Demo catalog + project resolution
│       ├── routes/               Express route handlers
│       ├── types/                Shared domain types
│       └── utils/                Logger, ID, time, fs, exec sandbox
├── frontend/
│   └── src/
│       ├── pages/                Dashboard, NewInvestigation, Investigation
│       ├── components/           Badge, Card, PipelineDiagram, ActivityLog
│       ├── hooks/                useInvestigation (SSE + polling)
│       ├── services/             API client
│       └── types/                Frontend domain types
├── demo/
│   ├── projects/insightboard/    Full-stack demo app with 3 seeded bugs
│   └── evidence/                 Log files and HTTP captures per bug
├── tests/                        Cross-package e2e tests (WIP)
├── PROJECT_SETUP.md              Environment discovery + architecture
└── README.md                     This file
```

---

*Built for the IBM Bob 2.0 AI Innovation Hackathon.*
>>>>>>> 6772e4c46e4964627df97de5aba316c3490dd1cb
