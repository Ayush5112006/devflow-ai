# FixFlow AI — Architecture

## Overview

FixFlow AI is a full-stack TypeScript application with a Node.js + Express backend and a React + Vite frontend. It implements a multi-agent software engineering workflow that takes a bug report from creation through investigation, root cause analysis, human-approved implementation, verification, and reporting.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                   │
│  Sidebar Nav · Pages · SSE Stream · Command Palette     │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP + SSE
┌──────────────────────▼──────────────────────────────────┐
│              Express API Server (Node.js)                │
│  /api/investigations  /api/pipeline  /api/demo          │
│  /api/projects  /api/health  /api/git                   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Investigation Service                       │
│  In-memory store · SSE event emitter · workflow runner  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                Manager Agent                             │
│  Orchestrates parallel investigation agents             │
│  Enforces approval gate before implementation           │
└──┬──────────┬──────────┬──────────┬──────────┬──────────┘
   │          │          │          │          │
  Code      API      Database    Test      Evidence
  Agent    Agent      Agent     Agent       Agent
   │
History
Agent
└──────────────────────┬──────────────────────────────────┘
                       │ findings + signals
┌──────────────────────▼──────────────────────────────────┐
│  Root Cause Agent → Change Plan Agent → Approval Gate   │
└──────────────────────┬──────────────────────────────────┘
                       │ (human must approve)
┌──────────────────────▼──────────────────────────────────┐
│  Implementation Agent → Verification Agent              │
│  → Regression Agent → Reporting Agent                   │
└─────────────────────────────────────────────────────────┘
```

---

## Backend Structure

```
backend/src/
├── server.ts               # Express entry point
├── config.ts               # Runtime config (repoRoot, maxParallel, etc.)
├── types/index.ts          # Domain types (Investigation, AgentRun, Finding, etc.)
├── agents/
│   ├── types.ts            # AgentDefinition, AgentContext interfaces
│   ├── manager/            # Manager Agent — orchestrates parallel agents
│   ├── code/               # Code Investigator Agent
│   ├── api/                # API Contract Investigator Agent
│   ├── database/           # Database Schema Investigator Agent
│   ├── testing/            # Test Coverage Investigator Agent
│   ├── evidence/           # Evidence Parser Agent
│   ├── history/            # Git History Agent
│   ├── rootCause/          # Root Cause + Change Plan Agents
│   ├── implementation/     # File Modification Agent
│   ├── verification/       # Test Runner Agent
│   ├── regression/         # Regression Impact Agent
│   ├── reporting/          # Report Generation Agent
│   └── llm/                # LLM adapter (pattern-based by default)
├── analysis/
│   ├── codeIndex.ts        # AST-lite file indexer
│   ├── evidenceParse.ts    # Log/stacktrace/HTTP parser
│   ├── lexer.ts            # Token-level code analysis
│   ├── patterns.ts         # Error pattern recognition
│   ├── pipelineFacts.ts    # Live pipeline metadata
│   └── expectations.ts     # Evidence expectations extractor
├── investigations/
│   └── investigationService.ts  # In-memory store + workflow runner
├── repositories/
│   └── demoCatalog.ts      # Demo project + demo bug definitions
├── routes/
│   └── investigations.ts   # All REST + SSE endpoints
└── utils/
    ├── exec.ts             # Sandboxed command runner
    ├── git.ts              # Git info reader
    └── ...
```

---

## Frontend Structure

```
frontend/src/
├── App.tsx                 # Root: sidebar, topbar, routes, command palette
├── main.tsx                # Entry: ToastProvider wrapper
├── styles.css              # Global CSS (dark theme, design system)
├── types/index.ts          # TypeScript types mirroring backend
├── services/api.ts         # Typed API client (fetch + SSE)
├── hooks/
│   └── useInvestigation.ts # SSE + polling hook for investigation state
├── components/
│   ├── Badge.tsx           # Status/severity badges
│   ├── Card.tsx            # Panel wrapper
│   ├── CommandPalette.tsx  # Ctrl+K command palette (22 commands)
│   ├── ActivityLog.tsx     # Real-time activity stream
│   ├── StageStepper.tsx    # Pipeline stage visualization
│   ├── InvestigationTimeline.tsx  # Chronological event timeline
│   ├── PipelineDiagram.tsx # Agent execution board
│   ├── ToastProvider.tsx   # Toast notification system
│   ├── LoadingSpinner.tsx  # Loading state
│   └── ErrorBoundary.tsx   # React error boundary
└── pages/
    ├── DashboardPage.tsx           # Engineering Command Center
    ├── ProjectsPage.tsx            # Project Hub (health, architecture, files)
    ├── IssuesPage.tsx              # Issue management + triage
    ├── InvestigationsListPage.tsx  # All investigations + demo launcher
    ├── InvestigationPage.tsx       # Investigation detail (9 tabs)
    ├── NewInvestigationPage.tsx    # Bug report intake
    ├── DebuggingPage.tsx           # Log intelligence + runtime debug
    ├── CodeIntelligencePage.tsx    # Symbol search + code explorer
    ├── CodeReviewPage.tsx          # AI code review (5 targets)
    ├── SecurityPage.tsx            # Security findings + dependency health
    ├── TestCenterPage.tsx          # Test suites + coverage + suggestions
    ├── GitCenterPage.tsx           # Git overview + branch creation
    ├── PullRequestsPage.tsx        # PR list + PR generator
    ├── ReleasesPage.tsx            # Release readiness + feature flags
    ├── IncidentsPage.tsx           # Incident lifecycle + postmortem
    ├── KnowledgePage.tsx           # Knowledge base + AI memory + onboarding
    ├── AnalyticsPage.tsx           # Engineering scorecard + DORA + audit log
    ├── ReportsPage.tsx             # Investigation reports
    ├── MetricsPage.tsx             # Pipeline metrics + agent registry
    ├── JudgeModePage.tsx           # 26-step demo + wow screen + comparison
    └── SettingsPage.tsx            # Platform configuration
```

---

## Data Flow

### Investigation Lifecycle

```
POST /investigations          → create Investigation record
POST /investigations/:id/start → Manager Agent runs
  ├── Evidence Agent          → parse logs/stacktraces
  ├── Code Agent              → index files, detect mismatches
  ├── API Agent               → compare request/response contracts
  ├── Database Agent          → analyze schemas/queries
  ├── Test Agent              → locate test coverage
  └── History Agent           → analyze git blame/log
         ↓
  Root Cause Agent            → rank hypotheses by evidence
  Change Plan Agent           → generate minimal patch
         ↓ SSE: awaiting_approval
POST /investigations/:id/approve → human approves plan hash
POST /investigations/:id/implement →
  Implementation Agent        → apply approved changes
  Verification Agent          → run test suite
  Regression Agent            → impact analysis
  Reporting Agent             → generate full report
         ↓ SSE: completed
GET /investigations/:id/report → report + metrics
```

### Real-time Updates

The browser connects to `GET /investigations/:id/stream` (SSE). The backend emits:
- `snapshot` — full investigation state
- `activity` — single log entry (agent note)
- `stage_change`, `agent_start`, `agent_finish`, etc.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| In-memory investigation store | Simple, no DB required, acceptable for demo/hackathon |
| Pattern-based analysis (no LLM) | Deterministic, fast, no API key required, auditable |
| Hash-verified approval gate | Prevents implementation with a different plan than reviewed |
| SSE over WebSocket | Simpler, HTTP-compatible, one-directional (server push) |
| Parallel agent fan-out | Speed + isolation — one failing agent doesn't block others |
| TypeScript throughout | Type safety across frontend/backend without code generation |

---

## Changelog — P0/P1 Repair Pass

| Change | File | Impact |
|--------|------|--------|
| Export Postmortem (Markdown download) | `IncidentsPage.tsx` | Real browser download |
| Add to Knowledge Base (session state) | `IncidentsPage.tsx` | Functional button |
| New Article form | `KnowledgePage.tsx` | Creates articles in session state |
| DEMO DATA label on Analytics scorecard | `AnalyticsPage.tsx` | Honest data labeling |
| Dynamic JudgeMode step completion | `JudgeModePage.tsx` | Based on real investigation status |
| Removed `Dashboard.tsx`, `InvestigationView.tsx` | — | Dead code cleanup |
| Removed `components/Layout.tsx` | — | Unused file cleanup |
| Added `components/ComingSoon.tsx` | NEW | Shared coming-soon component |
| Added `components/EmptyState.tsx` | NEW | Shared empty-state component |
