import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useInvestigation } from '../hooks/useInvestigation.js';
import { api } from '../services/api.js';
import type { GitInfo } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge, severityBadge, statusBadge } from '../components/Badge.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { PipelineDiagram } from '../components/PipelineDiagram.js';
import { ActivityLog } from '../components/ActivityLog.js';
import { StageStepper, STAGE_ORDER, STAGE_LABEL, stageTone } from '../components/StageStepper.js';
import { InvestigationTimeline } from '../components/InvestigationTimeline.js';
import { useToast } from '../components/ToastProvider.js';
import type { ActivityEntry, AgentRun, Evidence, Finding, Hypothesis, Investigation, StageId } from '../types/index.js';

/**
 * Human-readable elapsed time.
 */
function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec ? `${min}m ${sec}s` : `${min}m`;
}

/** Which stage the investigation is currently sitting in. */
function currentStage(inv: Investigation): StageId | null {
  if (inv.status === 'awaiting_approval') return 'approval';
  const running = STAGE_ORDER.find((id) => inv.stages[id]?.status === 'running');
  if (running) return running;
  if (inv.status === 'implementing') return 'implementation';
  if (inv.status === 'completed') return 'report';
  return null;
}

const TABS: { id: string; label: string; stage: StageId }[] = [
  { id: 'pipeline', label: 'Pipeline', stage: 'projectAnalysis' },
  { id: 'findings', label: 'Findings', stage: 'investigation' },
  { id: 'rootcause', label: 'Root Cause', stage: 'rootCause' },
  { id: 'changeplan', label: 'Change Plan', stage: 'changePlan' },
  { id: 'implementation', label: 'Implementation', stage: 'implementation' },
  { id: 'verification', label: 'Verification', stage: 'verification' },
  { id: 'regression', label: 'Regression', stage: 'regression' },
  { id: 'report', label: 'Report', stage: 'report' },
  { id: 'timeline', label: 'Timeline', stage: 'projectAnalysis' },
];

/** Tabs stay present even before data exists, so the structure does not shift. */
function tabAvailable(id: string, inv: Investigation): boolean {
  switch (id) {
    case 'rootcause': return !!inv.rootCause;
    case 'changeplan': return !!inv.changePlan;
    case 'implementation': return !!inv.implementation;
    case 'verification': return !!inv.verification;
    case 'regression': return !!inv.regression;
    case 'report': return !!inv.report;
    case 'timeline': return inv.activity.length > 0;
    default: return true;
  }
}

const AGENT_META: Record<string, { label: string; role: string; icon: string }> = {
  evidence: { label: 'Evidence Agent', role: 'Parses logs, stack traces, and HTTP evidence', icon: '🔍' },
  code: { label: 'Code Investigator', role: 'Traces symbols, call paths, and property chains', icon: '⚙️' },
  api: { label: 'API/Service Investigator', role: 'Audits routes, contracts, and response shapes', icon: '🌐' },
  database: { label: 'Database Investigator', role: 'Inspects queries, schema, and SQL errors', icon: '🗄️' },
  test: { label: 'Test Investigator', role: 'Scans test coverage and known failures', icon: '🧪' },
  history: { label: 'Git History Investigator', role: 'Reviews recent commits and regressions', icon: '📜' },
};

export function InvestigationPage() {
  const { id } = useParams<{ id: string }>();
  const { investigation: inv, activity, loading, error, refresh } = useInvestigation(id);
  const [activeTab, setActiveTab] = useState<string>('pipeline');
  const [approving, setApproving] = useState(false);
  const [implementing, setImplementing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const toast = useToast();

  // Previous status ref for notification diffing
  const prevStatusRef = useRef<string | null>(null);

  // Fetch git info when investigation is available
  useEffect(() => {
    if (!id || !inv) return;
    api.git(id).then(({ git }) => setGitInfo(git)).catch(() => setGitInfo(null));
  }, [id, inv?.status]);

  // Fire toasts on status transitions
  useEffect(() => {
    if (!inv) return;
    const prev = prevStatusRef.current;
    const curr = inv.status;
    if (prev !== null && prev !== curr) {
      if (curr === 'awaiting_approval') {
        toast.push({ level: 'warn', title: '⏸ Approval required', message: 'Review the change plan and approve to continue.' });
      } else if (curr === 'completed') {
        toast.push({ level: 'success', title: '✓ Investigation complete', message: 'Tests passed and report is ready.' });
      } else if (curr === 'failed') {
        toast.push({ level: 'error', title: '✕ Investigation failed', message: inv.errors[0]?.message });
      }
    }
    prevStatusRef.current = curr;
  }, [inv?.status]);

  // Fire toast when root cause is identified
  const hadRootCause = useRef(false);
  useEffect(() => {
    if (inv?.rootCause && !hadRootCause.current) {
      hadRootCause.current = true;
      toast.push({
        level: 'info',
        title: 'Root cause identified',
        message: inv.rootCause.statement.slice(0, 100),
      });
    }
  }, [inv?.rootCause]);

  if (loading) return <LoadingSpinner message="Loading investigation…" />;
  if (error) return <div className="alert" role="alert">{error}</div>;
  if (!inv) {
    return (
      <div className="empty">
        <p className="empty-title">Investigation not found</p>
        <p className="empty-text">It may have been cleared by a backend restart. Investigations are currently held in memory.</p>
        <Link to="/" className="btn btn-primary btn-sm" style={{ marginTop: 6 }}>Back to dashboard</Link>
      </div>
    );
  }

  const stage = currentStage(inv);
  const awaitingApproval = inv.status === 'awaiting_approval';
  const awaitingApply = (inv.status === 'approved' || inv.status === 'implementing') && !inv.implementation;

  async function approve(note: string) {
    if (!id) return;
    setApproving(true);
    setActionError(null);
    try {
      await api.approve(id, 'developer', note);
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setApproving(false);
    }
  }

  async function implement() {
    if (!id) return;
    setImplementing(true);
    setActionError(null);
    try {
      await api.implement(id);
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setImplementing(false);
    }
  }

  function onTabKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (index + dir + TABS.length) % TABS.length;
    setActiveTab(TABS[next].id);
    document.getElementById(`tab-${TABS[next].id}`)?.focus();
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <header>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Dashboard</Link>
          <span aria-hidden="true">›</span>
          <span className="mono">{inv.projectName}</span>
        </nav>
        <h1 className="page-title">{inv.bug.title}</h1>
        <div className="meta-row">
          {severityBadge(inv.bug.severity)}
          {statusBadge(inv.status)}
          <span className="chip mono">{id?.slice(0, 12)}</span>
          {stage && <span className="chip">stage: {STAGE_LABEL[stage]}</span>}
        </div>
      </header>

      {actionError && <div className="alert" role="alert"><span>{actionError}</span></div>}

      {awaitingApproval && (
        <div className="banner banner-warn">
          <div>
            <p className="banner-title" style={{ color: 'var(--warn)' }}>⏸ Human approval required</p>
            <p className="banner-text">
              Nothing has been written yet. Review the change plan — it contains{' '}
              <strong>{inv.changePlan?.changes.length ?? 0}</strong> proposed change
              {inv.changePlan?.changes.length === 1 ? '' : 's'} — then approve to authorise
              the implementation agent to apply exactly that plan.
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setActiveTab('changeplan')}>Review change plan</button>
            <button className="btn btn-warn btn-sm" onClick={() => approve('')} disabled={approving}>
              {approving ? 'Approving…' : '✓ Approve fix plan'}
            </button>
          </div>
        </div>
      )}

      {awaitingApply && (
        <div className="banner banner-info">
          <div>
            <p className="banner-title" style={{ color: 'var(--info)' }}>✓ Plan approved</p>
            <p className="banner-text">
              Approved by <strong>{inv.approval?.approvedBy}</strong> at{' '}
              {inv.approval?.approvedAt ? new Date(inv.approval.approvedAt).toLocaleString() : '—'}.{' '}
              Bound to plan hash{' '}
              <span className="mono">{inv.changePlan?.planHash.slice(0, 12)}</span>. Applying writes
              only the approved edits to the isolated workspace.
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={implement} disabled={implementing}>
            {implementing ? 'Applying…' : 'Apply fix'}
          </button>
        </div>
      )}

      {inv.status === 'completed' && (
        <div className="banner banner-ok">
          <div>
            <p className="banner-title" style={{ color: 'var(--accent)' }}>✓ Investigation complete</p>
            <p className="banner-text">
              Implementation applied {inv.implementation?.appliedChanges.length ?? 0} of{' '}
              {inv.changePlan?.changes.length ?? 0} planned change
              {inv.changePlan?.changes.length === 1 ? '' : 's'}. Check the verification and regression
              tabs before trusting the result.
            </p>
          </div>
          <button className="btn btn-sm" onClick={() => setActiveTab('verification')}>See checks</button>
        </div>
      )}

      <StageStepper
        stages={inv.stages}
        activeStage={stage}
        onSelect={(s) => {
          const match = TABS.find((t) => t.stage === s);
          if (match && tabAvailable(match.id, inv)) setActiveTab(match.id);
          else if (s === 'approval') setActiveTab('changeplan');
        }}
      />

      <div>
        <div className="tabs" role="tablist" aria-label="Investigation sections">
          {TABS.map((t, i) => {
            const available = tabAvailable(t.id, inv);
            const tone = stageTone(inv.stages[t.stage]?.status, stage === t.stage);
            const dotClass =
              tone === 'done' ? 'tab-dot-done'
              : tone === 'fail' ? 'tab-dot-fail'
              : tone === 'active' || tone === 'wait' ? 'tab-dot-active'
              : '';
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                aria-selected={activeTab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={activeTab === t.id ? 0 : -1}
                onKeyDown={(e) => onTabKey(e, i)}
                onClick={() => setActiveTab(t.id)}
                className={`tab ${available ? '' : 'tab-idle'}`}
              >
                <span className={`tab-dot ${dotClass}`} aria-hidden="true" />
                {t.label}
                {t.id === 'findings' && inv.findings.filter(f => f.severity !== 'info').length > 0 && (
                  <span className="tab-count">{inv.findings.filter(f => f.severity !== 'info').length}</span>
                )}
              </button>
            );
          })}
        </div>

        <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} style={{ paddingTop: 18 }}>
          {activeTab === 'pipeline' && <PipelineTab inv={inv} activity={activity} />}
          {activeTab === 'findings' && <FindingsTab inv={inv} />}
          {activeTab === 'rootcause' && <RootCauseTab inv={inv} />}
          {activeTab === 'changeplan' && (
            <ChangePlanTab inv={inv} onApprove={approve} approving={approving} />
          )}
          {activeTab === 'implementation' && <ImplementationTab inv={inv} />}
          {activeTab === 'verification' && <VerificationTab inv={inv} />}
          {activeTab === 'regression' && <RegressionTab inv={inv} />}
          {activeTab === 'report' && <ReportTab inv={inv} gitInfo={gitInfo} />}
          {activeTab === 'timeline' && (
            <div className="stack">
              <Card title="Investigation timeline">
                <InvestigationTimeline entries={activity} />
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function Pending({ what, hint }: { what: string; hint: string }) {
  return (
    <div className="empty">
      <p className="empty-title">{what} not available yet</p>
      <p className="empty-text">{hint}</p>
    </div>
  );
}

function ConfidenceMeter({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'var(--accent)' : pct >= 60 ? 'var(--info)' : 'var(--warn)';
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="meter" style={{ flex: 1 }} role="img" aria-label={`${label ?? 'Confidence'} ${pct}%`}>
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>
        {pct}%
      </span>
      {label && <span className="subtle" style={{ fontSize: 11 }}>{label}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pipeline Tab                                                        */
/* ------------------------------------------------------------------ */

function AgentCard({ agent }: { agent: AgentRun }) {
  const [expanded, setExpanded] = useState(false);
  const meta = AGENT_META[agent.agent] ?? { label: agent.title, role: '', icon: '🤖' };
  const statusColor =
    agent.status === 'completed' ? 'var(--accent)' :
    agent.status === 'failed' ? 'var(--danger)' :
    agent.status === 'running' ? 'var(--info)' :
    'var(--subtle)';

  return (
    <article className="panel" style={{ borderColor: agent.status === 'failed' ? 'rgba(248,113,113,.3)' : undefined }}>
      <button
        className="panel-head"
        style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="row" style={{ gap: 10, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 16, flex: 'none' }} aria-hidden="true">{meta.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{meta.label}</span>
              <span
                className="mono"
                style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: statusColor }}
              >
                {agent.status}
              </span>
            </div>
            <p className="subtle" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.4, marginTop: 2 }}>
              {meta.role}
            </p>
          </div>
        </div>
        <div className="row" style={{ gap: 8, flex: 'none' }}>
          {agent.durationMs != null && agent.durationMs > 0 && (
            <span className="chip mono">{duration(agent.durationMs)}</span>
          )}
          {agent.status === 'completed' && (
            <span className="chip" style={{ color: 'var(--accent)' }}>
              {agent.findingCount} finding{agent.findingCount === 1 ? '' : 's'}
            </span>
          )}
          {agent.status === 'completed' && agent.signalCount > 0 && (
            <span className="chip" style={{ color: 'var(--info)' }}>
              {agent.signalCount} signal{agent.signalCount === 1 ? '' : 's'}
            </span>
          )}
          <span className="subtle" style={{ fontSize: 11 }} aria-hidden="true">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="panel-body stack-sm" style={{ borderTop: '1px solid var(--line)' }}>
          {agent.status === 'failed' && agent.error && (
            <div className="alert">
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 12.5 }}>Agent failed</p>
                <p className="mono" style={{ margin: '4px 0 0', fontSize: 12 }}>{agent.error.message}</p>
                {agent.error.detail && (
                  <p className="subtle" style={{ margin: '4px 0 0', fontSize: 11.5 }}>{agent.error.detail}</p>
                )}
              </div>
            </div>
          )}
          {agent.notes && agent.notes.length > 0 && (
            <div>
              <p className="panel-title" style={{ marginBottom: 6 }}>Activity</p>
              <ul className="list-plain" style={{ gap: 4 }}>
                {agent.notes.map((n, i) => (
                  <li key={i} className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>· {n}</li>
                ))}
              </ul>
            </div>
          )}
          {agent.status === 'completed' && agent.findingCount === 0 && agent.signalCount === 0 && (
            <p className="subtle" style={{ fontSize: 12 }}>No actionable findings from this agent — scope of this bug is elsewhere.</p>
          )}
        </div>
      )}
    </article>
  );
}

function PipelineTab({ inv, activity }: { inv: Investigation; activity: ActivityEntry[] }) {
  const investigationAgents = inv.agents.filter((a) =>
    ['evidence', 'code', 'api', 'database', 'test', 'history'].includes(a.agent),
  );

  // Show manager agent as a separate concept
  const hasAgents = investigationAgents.length > 0;
  const completedAgents = investigationAgents.filter((a) => a.status === 'completed').length;
  const failedAgents = investigationAgents.filter((a) => a.status === 'failed').length;
  const runningAgents = investigationAgents.filter((a) => a.status === 'running').length;

  return (
    <div className="card-grid-sidebar">
      <div className="stack">
        {/* Manager Agent summary */}
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Manager Agent</h3>
            <Badge variant="info" dot>Orchestrator</Badge>
          </div>
          <div className="panel-body stack-sm">
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              Coordinates parallel investigation agents, merges findings, runs root cause correlation,
              generates the change plan, and enforces the human approval gate.
            </p>
            {hasAgents && (
              <div className="row" style={{ gap: 10 }}>
                <span className="chip" style={{ color: 'var(--accent)' }}>{completedAgents} completed</span>
                {runningAgents > 0 && <span className="chip" style={{ color: 'var(--info)' }}>{runningAgents} running</span>}
                {failedAgents > 0 && <span className="chip" style={{ color: 'var(--danger)' }}>{failedAgents} failed</span>}
                <span className="chip">{investigationAgents.length} total agents</span>
              </div>
            )}
          </div>
        </div>

        {/* Parallel investigation agents */}
        {hasAgents ? (
          <div className="stack">
            <div className="section-heading" style={{ marginBottom: 0 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                Parallel investigation agents
              </h3>
              <span className="subtle" style={{ fontSize: 11 }}>click to expand details</span>
            </div>
            {investigationAgents.map((agent) => (
              <AgentCard key={agent.agent} agent={agent} />
            ))}
          </div>
        ) : (
          inv.status === 'investigating' || inv.status === 'draft' ? (
            <div className="panel">
              <div className="panel-body">
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  Parallel agents will appear here as they launch…
                </p>
              </div>
            </div>
          ) : null
        )}

        {inv.errors.length > 0 && (
          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title" style={{ color: 'var(--danger)' }}>Blocking errors</h3>
              <Badge variant="danger" dot>{inv.errors.length}</Badge>
            </div>
            <div className="panel-body stack-sm">
              {inv.errors.map((e, i) => (
                <div key={i} className="alert">
                  <span className="mono">{e.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="stack">
        <Card title="Stage detail">
          <PipelineDiagram stages={inv.stages} agents={inv.agents} />
        </Card>
        {inv.projectMap && (
          <Card title="Indexed project">
            <dl className="kv">
              <dt>Files</dt><dd>{inv.projectMap.fileCount}</dd>
              <dt>Frameworks</dt><dd>{inv.projectMap.frameworks.join(', ') || '—'}</dd>
              <dt>Test runner</dt><dd>{inv.projectMap.testRunner || '—'}</dd>
              <dt>Languages</dt><dd>{Object.keys(inv.projectMap.languageBreakdown).join(', ') || '—'}</dd>
            </dl>
          </Card>
        )}
        <Card title="Agent activity">
          <ActivityLog entries={activity} />
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Findings Tab                                                        */
/* ------------------------------------------------------------------ */

function EvidenceBlock({ items, max = 4 }: { items: Evidence[]; max?: number }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, max);
  if (items.length === 0) return null;
  return (
    <div className="stack-sm">
      <span className="panel-title">Evidence</span>
      {visible.map((ev) => (
        <div key={ev.id} style={{ paddingLeft: 12, borderLeft: '2px solid var(--line)' }}>
          <div className="row" style={{ gap: 8 }}>
            {ev.location?.file && <span className="chip mono">{ev.location.file}{ev.location.line ? `:${ev.location.line}` : ''}</span>}
            <span className="subtle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>{ev.kind}</span>
          </div>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.55 }}>{ev.description}</p>
          {ev.snippet && (
            <pre className="code" style={{ marginTop: 6, fontSize: 11 }}>{ev.snippet}</pre>
          )}
        </div>
      ))}
      {items.length > max && !showAll && (
        <button className="btn btn-link btn-sm" onClick={() => setShowAll(true)} style={{ alignSelf: 'flex-start' }}>
          + {items.length - max} more evidence items
        </button>
      )}
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const agentMeta = AGENT_META[finding.agent] ?? { label: finding.agent, icon: '🤖' };

  return (
    <article className="panel">
      <button
        className="panel-head"
        style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12 }} aria-hidden="true">{agentMeta.icon}</span>
            <span className="subtle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em' }}>{agentMeta.label}</span>
          </div>
          <h3 className="page-title-sm" style={{ fontSize: 14 }}>{finding.title}</h3>
        </div>
        <div className="row" style={{ gap: 6, flex: 'none' }}>
          <Badge variant={finding.severity === 'high' ? 'danger' : finding.severity === 'medium' ? 'warn' : 'info'} dot>
            {finding.severity}
          </Badge>
          <Badge variant="muted">{Math.round(finding.confidence * 100)}%</Badge>
          <span className="subtle" style={{ fontSize: 11 }} aria-hidden="true">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      <div className="panel-body stack-sm">
        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{finding.summary}</p>
        {finding.impact && (
          <p className="subtle" style={{ margin: 0, fontSize: 12, fontStyle: 'italic' }}>Impact: {finding.impact}</p>
        )}
        {finding.files.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            {finding.files.slice(0, 6).map((file) => (
              <span key={file} className="chip">{file}</span>
            ))}
            {finding.files.length > 6 && <span className="chip">+{finding.files.length - 6}</span>}
          </div>
        )}
      </div>

      {expanded && (
        <div className="panel-body stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          {finding.functions.length > 0 && (
            <div>
              <p className="panel-title" style={{ marginBottom: 6 }}>Functions / Components</p>
              <div className="row" style={{ gap: 6 }}>
                {finding.functions.slice(0, 10).map((fn) => (
                  <span key={fn} className="chip mono">{fn}</span>
                ))}
              </div>
            </div>
          )}
          <EvidenceBlock items={finding.evidence} />
          <div className="spread" style={{ paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            <div>
              <span className="subtle" style={{ fontSize: 11 }}>Confidence</span>
              <div style={{ width: 180, marginTop: 4 }}>
                <ConfidenceMeter value={finding.confidence} />
              </div>
            </div>
            {finding.durationMs > 0 && (
              <span className="chip mono">{duration(finding.durationMs)}</span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function FindingsTab({ inv }: { inv: Investigation }) {
  const findings = inv.findings.filter((f) => f.severity !== 'info');
  if (findings.length === 0) {
    return <Pending what="Findings" hint="The analysis agents have not reported anything actionable yet." />;
  }

  // Group by agent for clarity
  const byAgent = new Map<string, Finding[]>();
  for (const f of findings) {
    const group = byAgent.get(f.agent) ?? [];
    group.push(f);
    byAgent.set(f.agent, group);
  }

  // Agent order: root cause last, code/api/database first
  const agentOrder = ['evidence', 'code', 'api', 'database', 'test', 'history', 'rootCause'];
  const sortedAgents = [...byAgent.keys()].sort(
    (a, b) => agentOrder.indexOf(a) - agentOrder.indexOf(b),
  );

  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-body">
          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
              {findings.length} actionable finding{findings.length !== 1 ? 's' : ''}
            </span>
            {sortedAgents.map((agentId) => {
              const count = byAgent.get(agentId)!.length;
              const meta = AGENT_META[agentId] ?? { label: agentId, icon: '🤖' };
              return (
                <span key={agentId} className="row" style={{ gap: 5, fontSize: 12, color: 'var(--muted)' }}>
                  <span aria-hidden="true">{meta.icon}</span>
                  {meta.label.replace(' Agent', '').replace(' Investigator', '')}: {count}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      {sortedAgents.flatMap((agentId) =>
        (byAgent.get(agentId) ?? []).map((f) => <FindingCard key={f.id} finding={f} />),
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Root Cause Tab                                                      */
/* ------------------------------------------------------------------ */

function HypothesisCard({ h, index }: { h: Hypothesis; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const statusVariant = h.status === 'supported' ? 'success' : h.status === 'possible' ? 'info' : 'muted';
  const statusLabel = h.status === 'supported' ? '✓ SUPPORTED' : h.status === 'possible' ? '~ POSSIBLE' : '✕ REJECTED';

  return (
    <article className="panel" style={{
      borderColor: h.status === 'supported' ? 'rgba(183,243,107,.3)' : h.status === 'rejected' ? 'rgba(255,255,255,.04)' : undefined,
      opacity: h.status === 'rejected' ? 0.7 : 1,
    }}>
      <button
        className="panel-head"
        style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="subtle" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>
            Hypothesis {index + 1}
          </span>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: h.status === 'rejected' ? 'var(--muted)' : 'var(--ink)' }}>
            {h.statement}
          </p>
        </div>
        <div className="row" style={{ gap: 8, flex: 'none' }}>
          <Badge variant={statusVariant} dot>{statusLabel}</Badge>
          <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            {Math.round(h.score * 100)}%
          </span>
          <span className="subtle" style={{ fontSize: 11 }} aria-hidden="true">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="panel-body stack" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="card-grid-2" style={{ gap: 12 }}>
            <div>
              <p className="panel-title" style={{ marginBottom: 8, color: 'var(--accent)' }}>Supporting evidence</p>
              {h.supporting.length > 0 ? (
                <ul className="list-plain" style={{ gap: 6 }}>
                  {h.supporting.slice(0, 4).map((ev) => (
                    <li key={ev.id} style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                      {ev.location?.file && <span className="chip mono" style={{ fontSize: 10, marginRight: 6 }}>{ev.location.file}</span>}
                      {ev.description}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="subtle" style={{ fontSize: 12 }}>No direct supporting evidence.</p>
              )}
            </div>
            <div>
              <p className="panel-title" style={{ marginBottom: 8, color: 'var(--danger)' }}>Contradicting evidence</p>
              {h.contradicting.length > 0 ? (
                <ul className="list-plain" style={{ gap: 6 }}>
                  {h.contradicting.slice(0, 4).map((ev) => (
                    <li key={ev.id} style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                      {ev.location?.file && <span className="chip mono" style={{ fontSize: 10, marginRight: 6 }}>{ev.location.file}</span>}
                      {ev.description}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="subtle" style={{ fontSize: 12 }}>No contradicting evidence.</p>
              )}
            </div>
          </div>
          {h.corroboratedBy.length > 0 && (
            <div>
              <span className="panel-title" style={{ marginRight: 8 }}>Corroborated by</span>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                {h.corroboratedBy.map((agentId) => {
                  const meta = AGENT_META[agentId] ?? { label: agentId, icon: '🤖' };
                  return (
                    <span key={agentId} className="chip" style={{ fontSize: 11 }}>
                      {meta.icon} {meta.label.replace(' Agent', '').replace(' Investigator', '')}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <ConfidenceMeter value={h.score} label="score" />
          </div>
        </div>
      )}
    </article>
  );
}

function RootCauseTab({ inv }: { inv: Investigation }) {
  const rc = inv.rootCause;
  if (!rc) return <Pending what="Root cause" hint="Correlation runs after the analysis agents finish." />;

  const supported = rc.hypotheses.filter((h) => h.status === 'supported');
  const possible = rc.hypotheses.filter((h) => h.status === 'possible');
  const rejected = rc.hypotheses.filter((h) => h.status === 'rejected');

  return (
    <div className="stack">
      {/* Root cause verdict */}
      <Card title="Root cause">
        <div className="stack">
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.45, color: 'var(--ink)' }}>
            {rc.statement}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>{rc.detail}</p>
          <ConfidenceMeter value={rc.confidence} label="confidence" />
          {rc.margin < 0.2 && (
            <div className="alert" style={{ borderColor: 'rgba(251,191,36,.34)', background: 'var(--warn-soft)', color: 'var(--warn)' }}>
              <span>Low margin over the next hypothesis — treat this ranking as a shortlist, not a verdict.</span>
            </div>
          )}
          {rc.affectedComponents.length > 0 && (
            <div>
              <p className="panel-title" style={{ marginBottom: 6 }}>Affected components</p>
              <div className="row" style={{ gap: 6 }}>
                {rc.affectedComponents.map((c) => (
                  <span key={c} className="chip">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Evidence chain → root cause */}
      {rc.evidence.length > 0 && (
        <Card title="Evidence chain">
          <div className="stack">
            {rc.evidence.slice(0, 6).map((ev, i) => (
              <div key={ev.id}>
                <div style={{ paddingLeft: 12, borderLeft: '2px solid var(--accent)', marginBottom: 4 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="subtle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em' }}>
                      Evidence #{i + 1}
                    </span>
                    <span className="subtle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {ev.kind}
                    </span>
                  </div>
                  {ev.location?.file && (
                    <span className="chip mono" style={{ fontSize: 10, marginTop: 4, display: 'inline-flex' }}>
                      {ev.location.file}{ev.location.line ? `:${ev.location.line}` : ''}
                    </span>
                  )}
                  <p className="muted" style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55 }}>{ev.description}</p>
                  {ev.snippet && (
                    <pre className="code" style={{ marginTop: 8, fontSize: 11 }}>{ev.snippet}</pre>
                  )}
                </div>
                {i < rc.evidence.slice(0, 6).length - 1 && (
                  <div style={{ paddingLeft: 5, color: 'var(--accent)', fontSize: 14, margin: '4px 0' }}>↓</div>
                )}
              </div>
            ))}
            <div style={{ paddingLeft: 5, color: 'var(--accent)', fontSize: 14 }}>↓</div>
            <div style={{ padding: '10px 14px', background: 'var(--accent-soft)', border: '1px solid rgba(183,243,107,.3)', borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Root cause identified</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{rc.statement}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Failure path */}
      {rc.failurePath.length > 0 && (
        <Card title="Execution failure path">
          <ol className="list-num">
            {rc.failurePath.map((step, i) => (
              <li key={i} style={{ paddingBottom: 6 }}>
                <span style={{ color: 'var(--ink)', lineHeight: 1.5 }}>{step.step}</span>
                {step.file && (
                  <span className="chip mono" style={{ fontSize: 10, marginLeft: 8 }}>{step.file}{step.line ? `:${step.line}` : ''}</span>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Hypothesis analysis */}
      <div className="section-heading" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Hypothesis analysis</h3>
        <div className="row" style={{ gap: 8 }}>
          {supported.length > 0 && <Badge variant="success" dot>{supported.length} supported</Badge>}
          {possible.length > 0 && <Badge variant="info" dot>{possible.length} possible</Badge>}
          {rejected.length > 0 && <Badge variant="muted" dot>{rejected.length} rejected</Badge>}
        </div>
      </div>

      {rc.hypotheses.map((h, i) => (
        <HypothesisCard key={h.id} h={h} index={i} />
      ))}

      {rc.rejected.length > 0 && (
        <Card title="Rejected hypotheses (summary)">
          <ul className="list-plain">
            {rc.rejected.map((r, i) => (
              <li key={i} style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>
                <span style={{ color: 'var(--danger)', marginRight: 6 }}>✕</span>{r}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Change Plan Tab                                                     */
/* ------------------------------------------------------------------ */

function ChangePlanTab({
  inv, onApprove, approving,
}: {
  inv: Investigation;
  onApprove: (note: string) => void;
  approving: boolean;
}) {
  const plan = inv.changePlan;
  const [note, setNote] = useState('');
  const [replanFeedback, setReplanFeedback] = useState('');
  const [replanning, setReplanning] = useState(false);
  const [replanError, setReplanError] = useState<string | null>(null);
  const [showReplan, setShowReplan] = useState(false);
  const toast = useToast();

  async function submitReplan() {
    if (!inv.id || !replanFeedback.trim()) return;
    setReplanning(true);
    setReplanError(null);
    try {
      await api.replan(inv.id, replanFeedback.trim());
      setShowReplan(false);
      setReplanFeedback('');
      toast.push({ level: 'info', title: 'Plan regenerated', message: 'Review the updated change plan.' });
    } catch (e) {
      setReplanError(e instanceof Error ? e.message : String(e));
    } finally {
      setReplanning(false);
    }
  }

  if (!plan) return <Pending what="Change plan" hint="A plan is generated once a root cause is confirmed." />;

  const filesAffected = [...new Set(plan.changes.map((c) => c.file))];

  return (
    <div className="stack">
      {/* Plan summary header */}
      <Card title="Change plan summary">
        <div className="stack">
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>{plan.summary}</p>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span className="chip"><strong style={{ color: 'var(--ink)' }}>{plan.changes.length}</strong> change{plan.changes.length !== 1 ? 's' : ''}</span>
            <span className="chip"><strong style={{ color: 'var(--ink)' }}>{filesAffected.length}</strong> file{filesAffected.length !== 1 ? 's' : ''}</span>
            <span className="chip"><strong style={{ color: 'var(--ink)' }}>0</strong> new dependencies</span>
          </div>
          <div className="spread" style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <span className="subtle" style={{ fontSize: 12 }}>Plan hash (approval is bound to this value)</span>
            <span className="chip mono">{plan.planHash}</span>
          </div>
        </div>
      </Card>

      {/* Structured change cards */}
      {plan.changes.map((c) => (
        <article key={c.id} className="panel" style={{ borderColor: 'rgba(183,243,107,.12)' }}>
          <div className="panel-head">
            <div className="row" style={{ gap: 10 }}>
              <span className="panel-title" style={{ color: 'var(--accent)' }}>Change #{c.number}</span>
              <span className="chip mono">{c.file}</span>
              {c.symbol && c.symbol !== c.file && (
                <span className="chip mono" style={{ color: 'var(--info)' }}>{c.symbol}</span>
              )}
            </div>
          </div>
          <div className="panel-body stack">
            <div className="card-grid-2" style={{ gap: 12 }}>
              <div>
                <p className="panel-title" style={{ marginBottom: 6, color: 'var(--danger)' }}>Current behaviour</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>{c.currentBehavior}</p>
              </div>
              <div>
                <p className="panel-title" style={{ marginBottom: 6, color: 'var(--accent)' }}>Required change</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.55 }}>{c.requiredChange}</p>
              </div>
            </div>
            <div style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <dl className="kv">
                <dt>Reason</dt>
                <dd style={{ color: 'var(--muted)' }}>{c.reason}</dd>
                <dt style={{ color: 'var(--warn)' }}>Regression risk</dt>
                <dd style={{ color: 'var(--muted)' }}>{c.regressionRisk}</dd>
                <dt style={{ color: 'var(--accent)' }}>Verification method</dt>
                <dd style={{ color: 'var(--muted)' }}>{c.verification}</dd>
              </dl>
            </div>
            {c.diffPreview && (
              <div>
                <p className="panel-title" style={{ marginBottom: 6 }}>Diff preview</p>
                <pre className="code">{c.diffPreview}</pre>
              </div>
            )}
          </div>
        </article>
      ))}

      {/* Considered and rejected alternatives */}
      {plan.consideredAndRejected.length > 0 && (
        <Card title="Considered and rejected alternatives">
          <ul className="list-plain">
            {plan.consideredAndRejected.map((r, i) => (
              <li key={i} style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--danger)', marginRight: 6 }}>✕</span>
                <span style={{ color: 'var(--ink)' }}>{r.statement}</span>
                <span className="muted"> — {r.why}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Human approval gate */}
      {inv.status === 'awaiting_approval' && (
        <div className="panel" style={{ borderColor: 'rgba(251,191,36,.4)' }}>
          <div className="panel-head">
            <p className="banner-title" style={{ color: 'var(--warn)', margin: 0 }}>⏸ Human approval required</p>
          </div>
          <div className="panel-body stack">
            <div className="card-grid-2" style={{ gap: 12 }}>
              <div className="stack-sm">
                <p className="panel-title">Files to modify</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{filesAffected.length}</p>
              </div>
              <div className="stack-sm">
                <p className="panel-title">New dependencies</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>0</p>
              </div>
              <div className="stack-sm">
                <p className="panel-title">Regression risk</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--warn)' }}>
                  {plan.changes[0]?.regressionRisk ?? 'Low — targeted fix'}
                </p>
              </div>
              <div className="stack-sm">
                <p className="panel-title">Verification planned</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  {plan.changes[0]?.verification ?? 'Run existing test suite'}
                </p>
              </div>
            </div>
            <p className="banner-text" style={{ margin: 0 }}>
              Approving authorises the implementation agent to apply <strong>only the changes above</strong>.
              If the plan changes after this point, the approval is rejected on the hash check.
              Clicking <em>Reject</em> returns to the change plan without writing any files.
            </p>
            <label className="field">
              <span className="field-label">Approval note (optional)</span>
              <textarea
                className="textarea"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why you are approving this plan…"
              />
            </label>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-sm" onClick={() => setShowReplan((s) => !s)}>
                ⟳ Request changes
              </button>
              <button className="btn btn-warn btn-lg" onClick={() => onApprove(note)} disabled={approving}>
                {approving ? 'Approving…' : '✓ Approve fix plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Changes panel */}
      {showReplan && inv.status === 'awaiting_approval' && (
        <div className="panel" style={{ borderColor: 'rgba(96,165,250,.3)' }}>
          <div className="panel-head">
            <p className="panel-title" style={{ margin: 0 }}>⟳ Request plan changes</p>
          </div>
          <div className="panel-body stack">
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              Describe what should be different. The change plan will be regenerated based on your feedback.
              The investigation does not restart — only the plan is rebuilt.
            </p>
            <label className="field">
              <span className="field-label">Feedback</span>
              <textarea
                className="textarea"
                rows={3}
                value={replanFeedback}
                onChange={(e) => setReplanFeedback(e.target.value)}
                placeholder='e.g. "Do not modify the API response. Update the frontend consumer instead."'
              />
            </label>
            {replanError && (
              <div className="alert"><span>{replanError}</span></div>
            )}
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-sm" onClick={() => setShowReplan(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={submitReplan}
                disabled={replanning || !replanFeedback.trim()}
              >
                {replanning ? 'Regenerating…' : 'Regenerate plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show approval record after approval */}
      {inv.approval && (
        <Card title="Approval record">
          <dl className="kv">
            <dt>Approved by</dt><dd>{inv.approval.approvedBy}</dd>
            <dt>Approved at</dt><dd>{new Date(inv.approval.approvedAt).toLocaleString()}</dd>
            <dt>Plan hash</dt><dd className="mono" style={{ fontSize: 12 }}>{inv.approval.planHash}</dd>
            {inv.approval.note && <><dt>Note</dt><dd>{inv.approval.note}</dd></>}
          </dl>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Implementation Tab                                                  */
/* ------------------------------------------------------------------ */

function ImplementationTab({ inv }: { inv: Investigation }) {
  const impl = inv.implementation;
  if (!impl) return <Pending what="Implementation" hint="The implementation agent runs after the plan is approved." />;
  const [showFullDiff, setShowFullDiff] = useState(false);

  return (
    <div className="stack">
      <Card title="Implementation summary">
        <div className="stack">
          <div className="row" style={{ gap: 8 }}>
            {statusBadge(impl.status)}
            <span className="chip mono">{duration(impl.durationMs)}</span>
            <span className="chip mono">{impl.diffStat || '—'}</span>
            <span className="chip">{impl.filesModified.length} file{impl.filesModified.length !== 1 ? 's' : ''} modified</span>
          </div>
          {impl.filesModified.length > 0 && (
            <div>
              <p className="panel-title" style={{ marginBottom: 6 }}>Files changed</p>
              <div className="row" style={{ gap: 6 }}>
                {impl.filesModified.map((f) => <span key={f} className="chip mono">{f}</span>)}
              </div>
            </div>
          )}
          {impl.notes.length > 0 && (
            <ul className="list-plain" style={{ gap: 4 }}>
              {impl.notes.map((n, i) => (
                <li key={i} className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {impl.appliedChanges.length === 0 ? (
        <div className="alert">
          <span>No change was written to the workspace. The applied count is the honest result — the run did not modify files.</span>
        </div>
      ) : (
        impl.appliedChanges.map((c) => (
          <article key={c.plannedChangeId} className="panel">
            <div className="panel-head">
              <span className="chip mono">{c.file}</span>
              {statusBadge(c.status)}
            </div>
            <div className="panel-body stack-sm">
              {c.note && <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>{c.note}</p>}
              {c.diff && (
                <div>
                  <p className="panel-title" style={{ marginBottom: 6 }}>Applied diff</p>
                  <pre className="code" style={{ fontSize: 11 }}>{c.diff.slice(0, showFullDiff ? undefined : 600)}</pre>
                  {c.diff.length > 600 && (
                    <button
                      className="btn btn-link btn-sm"
                      onClick={() => setShowFullDiff((s) => !s)}
                      style={{ marginTop: 6 }}
                    >
                      {showFullDiff ? '▲ Collapse' : `▼ Show full diff (${c.diff.length} chars)`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Verification Tab                                                    */
/* ------------------------------------------------------------------ */

function VerificationTab({ inv }: { inv: Investigation }) {
  const ver = inv.verification;
  if (!ver) return <Pending what="Verification" hint="Verification runs once the implementation stage finishes." />;

  const passed = ver.checks.filter((c) => c.status === 'pass').length;
  const failed = ver.checks.filter((c) => c.status === 'fail').length;
  const skipped = ver.checks.filter((c) => c.status === 'skipped' || c.status === 'not_available').length;

  return (
    <div className="stack">
      {/* Overall result */}
      <Card title="Verification result">
        <div className="stack-sm">
          <div className="row" style={{ gap: 8 }}>
            {statusBadge(ver.status)}
            <span className="chip" style={{ color: 'var(--accent)' }}>{passed} passed</span>
            {failed > 0 && <span className="chip" style={{ color: 'var(--danger)' }}>{failed} failed</span>}
            {skipped > 0 && <span className="chip" style={{ color: 'var(--subtle)' }}>{skipped} skipped</span>}
            <span className="chip mono">{duration(ver.durationMs)}</span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>{ver.summary}</p>
        </div>
      </Card>

      {/* Before / After comparison — prominently placed */}
      {ver.before && (
        <div>
          <div className="section-heading" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Before / After comparison</h3>
          </div>
          <div className="card-grid-2">
            <article className="panel" style={{ borderColor: 'rgba(248,113,113,.3)' }}>
              <div className="panel-head">
                <h4 className="panel-title">BEFORE</h4>
                <Badge variant="danger" dot>FAIL</Badge>
              </div>
              <div className="panel-body stack-sm">
                <dl className="kv">
                  <dt>Expected</dt><dd>{ver.before.bugReproduction.expected}</dd>
                  <dt>Observed</dt><dd style={{ color: 'var(--danger)' }}>{ver.before.bugReproduction.observed}</dd>
                </dl>
                {ver.before.bugReproduction.status && (
                  <p className="subtle" style={{ margin: 0, fontSize: 12 }}>Status: {ver.before.bugReproduction.status}</p>
                )}
              </div>
            </article>
            <article className="panel" style={{ borderColor: 'rgba(183,243,107,.3)' }}>
              <div className="panel-head">
                <h4 className="panel-title">AFTER</h4>
                <Badge variant={ver.before.postFix.status === 'pass' ? 'success' : 'danger'} dot>
                  {ver.before.postFix.status.toUpperCase()}
                </Badge>
              </div>
              <div className="panel-body stack-sm">
                <dl className="kv">
                  <dt>Expected</dt><dd>{ver.before.postFix.expected}</dd>
                  <dt>Observed</dt>
                  <dd style={{ color: ver.before.postFix.status === 'pass' ? 'var(--accent)' : 'var(--danger)' }}>
                    {ver.before.postFix.observed}
                  </dd>
                </dl>
              </div>
            </article>
          </div>
        </div>
      )}

      {/* Individual checks */}
      <div>
        <div className="section-heading" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Individual checks</h3>
        </div>
        <div className="stack">
          {ver.checks.map((c) => (
            <article key={c.id} className="panel" style={{
              borderColor: c.status === 'fail' ? 'rgba(248,113,113,.3)' : c.status === 'pass' ? 'rgba(183,243,107,.18)' : undefined,
            }}>
              <div className="panel-head">
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <h3 className="page-title-sm" style={{ fontSize: 14 }}>{c.name}</h3>
                    {c.origin === 'repro' && (
                      <span className="chip" style={{ fontSize: 10, color: 'var(--warn)' }}>Bug reproduction</span>
                    )}
                    {c.origin === 'regression' && (
                      <span className="chip" style={{ fontSize: 10, color: 'var(--info)' }}>Regression check</span>
                    )}
                  </div>
                  {c.totalTests != null && (
                    <span className="subtle" style={{ fontSize: 11 }}>
                      {c.passedTests ?? 0}/{c.totalTests} tests passed
                    </span>
                  )}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <Badge variant={
                    c.status === 'pass' ? 'success' :
                    c.status === 'fail' ? 'danger' :
                    c.status === 'not_available' ? 'muted' : 'warn'
                  } dot>
                    {c.status === 'pass' ? '✓ PASS' :
                     c.status === 'fail' ? '✕ FAIL' :
                     c.status.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                  <span className="chip mono">{duration(c.durationMs)}</span>
                </div>
              </div>
              <div className="panel-body stack-sm">
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>{c.summary}</p>
                {c.command && <pre className="code" style={{ fontSize: 11 }}>{c.command}</pre>}
                {c.failedTests.length > 0 && (
                  <div className="stack-sm">
                    <span className="subtle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                      Failed tests ({c.failedTests.length})
                    </span>
                    {c.failedTests.slice(0, 8).map((t, i) => (
                      <pre key={i} className="code" style={{ color: 'var(--danger)', fontSize: 11 }}>{t}</pre>
                    ))}
                  </div>
                )}
                {c.outputTail && c.status === 'fail' && (
                  <div>
                    <p className="panel-title" style={{ marginBottom: 4 }}>Output</p>
                    <pre className="code" style={{ fontSize: 11, color: 'var(--danger)', maxHeight: 160, overflow: 'auto' }}>
                      {c.outputTail}
                    </pre>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Regression Tab                                                      */
/* ------------------------------------------------------------------ */

function RegressionTab({ inv }: { inv: Investigation }) {
  const reg = inv.regression;
  if (!reg) return <Pending what="Regression analysis" hint="Regression analysis runs after verification." />;

  return (
    <div className="stack">
      <Card title="Regression analysis">
        <div className="stack-sm">
          <div className="row" style={{ gap: 8 }}>
            <Badge
              variant={reg.status === 'clean' ? 'success' : reg.status === 'risk-detected' ? 'warn' : 'muted'}
              dot
            >
              {reg.status === 'clean' ? '✓ Clean' : reg.status === 'risk-detected' ? '⚠ Risk detected' : 'Not available'}
            </Badge>
            <span className="chip mono">{duration(reg.durationMs)}</span>
            {reg.impacts.length > 0 && (
              <span className="chip">{reg.impacts.length} impact{reg.impacts.length !== 1 ? 's' : ''} found</span>
            )}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>{reg.summary}</p>
        </div>
      </Card>

      {/* Original bug re-test — most important result */}
      {reg.originalBugRetested && (
        <article className="panel" style={{
          borderColor: reg.originalBugRetested.status === 'pass' ? 'rgba(183,243,107,.3)' : 'rgba(248,113,113,.3)',
        }}>
          <div className="panel-head">
            <div>
              <p className="panel-title" style={{ marginBottom: 4 }}>Original bug re-test</p>
              <span style={{ fontSize: 13, color: 'var(--ink)' }}>{reg.originalBugRetested.name}</span>
            </div>
            <Badge
              variant={reg.originalBugRetested.status === 'pass' ? 'success' : 'danger'}
              dot
            >
              {reg.originalBugRetested.status === 'pass' ? '✓ FIXED' : '✕ STILL FAILING'}
            </Badge>
          </div>
          <div className="panel-body stack-sm">
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>{reg.originalBugRetested.summary}</p>
            {reg.originalBugRetested.command && (
              <pre className="code" style={{ fontSize: 11 }}>{reg.originalBugRetested.command}</pre>
            )}
          </div>
        </article>
      )}

      {/* Impact analysis */}
      {reg.impacts.length > 0 && (
        <Card title="Regression impact analysis">
          <div className="stack-sm">
            <p className="subtle" style={{ margin: 0, fontSize: 12 }}>
              Components and symbols affected by the change, ranked by severity.
            </p>
            <div className="stack-sm" style={{ marginTop: 8 }}>
              {reg.impacts.map((impact, i) => (
                <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <Badge
                    variant={impact.severity === 'high' ? 'danger' : impact.severity === 'medium' ? 'warn' : 'info'}
                    dot
                  >
                    {impact.severity}
                  </Badge>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="chip mono">{impact.file}</span>
                      {impact.symbol && impact.symbol !== impact.file && (
                        <span className="chip mono" style={{ color: 'var(--info)' }}>{impact.symbol}</span>
                      )}
                      <span className="subtle" style={{ fontSize: 11 }}>{impact.kind}</span>
                    </div>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.55 }}>{impact.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Regression tests executed */}
      {reg.executed.length > 0 && (
        <Card title="Regression checks executed">
          <div className="stack-sm">
            {reg.executed.map((c) => (
              <div key={c.id} className="spread">
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>{c.name}</span>
                <div className="row" style={{ gap: 8 }}>
                  <Badge
                    variant={c.status === 'pass' ? 'success' : c.status === 'fail' ? 'danger' : 'muted'}
                    dot
                  >
                    {c.status === 'pass' ? '✓ PASS' : c.status === 'fail' ? '✕ FAIL' : c.status}
                  </Badge>
                  <span className="chip mono">{duration(c.durationMs)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Generated regression tests */}
      {reg.createdTests && reg.createdTests.length > 0 && (
        <Card title="Generated regression tests">
          <ul className="list-plain">
            {reg.createdTests.map((t, i) => (
              <li key={i}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="chip mono">{t.file}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>{t.name}</span>
                </div>
                <p className="muted" style={{ margin: '5px 0 0', fontSize: 12.5 }}>{t.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reg.relatedTestFiles.length > 0 && (
        <Card title="Related test files">
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {reg.relatedTestFiles.map((f) => (
              <span key={f} className="chip mono">{f}</span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Report Tab                                                          */
/* ------------------------------------------------------------------ */

function ReportTab({ inv, gitInfo }: { inv: Investigation; gitInfo: GitInfo | null }) {
  const report = inv.report;
  const metrics = inv.metrics;
  const [copied, setCopied] = useState<'report' | 'pr' | null>(null);
  const [copiedCommit, setCopiedCommit] = useState(false);

  if (!report) return <Pending what="Engineering report" hint="The report is written once the workflow completes." />;

  function copyText(text: string, which: 'report' | 'pr') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => undefined);
  }

  const prText = [
    `## Summary\n${report.prSummary.summary}`,
    `## Root Cause\n${report.prSummary.rootCause}`,
    `## Changes\n${report.prSummary.changes}`,
    `## Testing\n${report.prSummary.testing}`,
    `## Regression Status\n${report.prSummary.regressionStatus}`,
  ].join('\n\n');

  return (
    <div className="stack">
      {/* Metrics overview */}
      {metrics && (
        <div className="metric-grid">
          {[
            { label: 'Total duration', value: duration(metrics.totalWorkflowDurationMs) },
            { label: 'Files inspected', value: String(metrics.filesInspected) },
            { label: 'Hypotheses', value: `${metrics.hypothesesGenerated}` },
            { label: 'Hypotheses rejected', value: `${metrics.hypothesesRejected}` },
            { label: 'Tests executed', value: `${metrics.testsExecuted}` },
            { label: 'Tests passed', value: `${metrics.testsPassed}` },
            { label: 'Agents used', value: `${metrics.agentsUsed}${metrics.agentsFailed ? ` (${metrics.agentsFailed} failed)` : ''}` },
            { label: 'Steps automated', value: `${metrics.manualStepsAutomatedPct}%` },
          ].map((m) => (
            <div key={m.label} className="metric">
              <p className="metric-value">{m.value}</p>
              <p className="metric-label">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Workflow comparison */}
      {metrics?.comparison && (
        <Card title="Workflow comparison">
          <div className="card-grid-3" style={{ alignItems: 'center' }}>
            <div>
              <p className="metric-label" style={{ marginBottom: 6 }}>Traditional (estimated)</p>
              <p className="metric-value">{metrics.comparison.baseline.totalMinutes} min</p>
              <p className="subtle" style={{ margin: '4px 0 0', fontSize: 12 }}>
                {metrics.comparison.baseline.manualSteps} manual steps
              </p>
            </div>
            <div style={{ textAlign: 'center', color: 'var(--accent)', fontSize: 22 }} aria-hidden="true">→</div>
            <div>
              <p className="metric-label" style={{ marginBottom: 6 }}>FixFlow AI (measured)</p>
              <p className="metric-value" style={{ color: 'var(--accent)' }}>
                {duration(metrics.comparison.fixflow.totalMinutes * 60_000)}
              </p>
              <p className="subtle" style={{ margin: '4px 0 0', fontSize: 12 }}>
                {metrics.comparison.fixflow.manualSteps} manual{' '}
                {metrics.comparison.fixflow.manualSteps === 1 ? 'step' : 'steps'}
              </p>
            </div>
          </div>
          <p className="subtle" style={{ margin: '14px 0 0', paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 12 }}>
            Saved {duration(metrics.comparison.deltas.timeSavedMinutes * 60_000)} against the
            estimated baseline · {metrics.comparison.deltas.manualStepsReduced} steps automated.{' '}
            <em>The baseline is an estimate, not a measurement.</em>
          </p>
          {metrics.comparison.notes.length > 0 && (
            <ul className="list-plain" style={{ marginTop: 10 }}>
              {metrics.comparison.notes.map((n, i) => (
                <li key={i} className="subtle" style={{ fontSize: 12 }}>{n}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Productivity Scorecard */}
      {metrics && (
        <Card title="Developer productivity scorecard">
          <div className="scorecard-grid">
            {[
              { label: 'Investigation time', value: duration(metrics.investigationDurationMs), icon: '⏱', sub: 'parallel agents' },
              { label: 'Manual steps avoided', value: `${metrics.manualStepsAutomated}`, icon: '🤖', sub: `of ${metrics.manualSteps + metrics.manualStepsAutomated} total` },
              { label: 'Files auto-inspected', value: `${metrics.filesInspected}`, icon: '🔍', sub: 'without manual search' },
              { label: 'Parallel tasks', value: `${metrics.agentsUsed}`, icon: '⚡', sub: 'concurrent agents' },
              { label: 'Root cause confidence', value: `${Math.round((inv.rootCause?.confidence ?? 0) * 100)}%`, icon: '🎯', sub: 'evidence-backed' },
              { label: 'Files modified', value: `${metrics.filesModified}`, icon: '✏️', sub: 'minimal patch' },
              { label: 'Tests executed', value: `${metrics.testsExecuted}`, icon: '✓', sub: `${metrics.testsPassed} passed` },
              { label: 'Rework cycles', value: `${metrics.reworkCycles ?? 0}`, icon: '🔄', sub: 'avoided' },
            ].map((item) => (
              <div key={item.label} className="scorecard-item">
                <span className="scorecard-icon" aria-hidden="true">{item.icon}</span>
                <p className="scorecard-value">{item.value}</p>
                <p className="scorecard-label">{item.label}</p>
                {item.sub && <p className="scorecard-sub">{item.sub}</p>}
              </div>
            ))}
          </div>
          {metrics.comparison && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
              <p className="panel-title" style={{ marginBottom: 10 }}>Time saved vs traditional workflow</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Traditional</p>
                  <p style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--muted)' }}>{metrics.comparison.baseline.totalMinutes}m</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>{metrics.comparison.baseline.manualSteps} manual steps (est.)</p>
                </div>
                <span style={{ color: 'var(--accent)', fontSize: 18, fontWeight: 700 }}>→</span>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.07em' }}>FixFlow AI</p>
                  <p style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{duration(metrics.totalWorkflowDurationMs)}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>{metrics.comparison.fixflow.manualSteps} manual step (measured)</p>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Time saved</p>
                  <p style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                    ~{metrics.comparison.baseline.totalMinutes}m
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>baseline is an estimate</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Git information */}
      {gitInfo && (
        <Card title="Git information">
          {gitInfo.available ? (
            <div className="stack">
              <dl className="kv">
                <dt>Branch</dt>
                <dd className="mono">{gitInfo.branch ?? '—'}</dd>
                <dt>Latest commit</dt>
                <dd className="mono">{gitInfo.latestCommit ?? '—'}</dd>
                <dt>Message</dt>
                <dd>{gitInfo.latestMessage ?? '—'}</dd>
                <dt>Author</dt>
                <dd>{gitInfo.latestAuthor ?? '—'}</dd>
                {gitInfo.modifiedFiles.length > 0 && (
                  <>
                    <dt>Modified files</dt>
                    <dd>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {gitInfo.modifiedFiles.slice(0, 8).map((f: string) => (
                          <span key={f} className="chip mono">{f}</span>
                        ))}
                        {gitInfo.modifiedFiles.length > 8 && (
                          <span className="chip">+{gitInfo.modifiedFiles.length - 8}</span>
                        )}
                      </div>
                    </dd>
                  </>
                )}
              </dl>
              {gitInfo.suggestedBranch && (
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <p className="panel-title" style={{ marginBottom: 8 }}>Suggested fix branch</p>
                  <div className="row" style={{ gap: 10 }}>
                    <code className="mono" style={{ fontSize: 12, color: 'var(--accent)', background: 'var(--panel-sunken)', padding: '4px 10px', borderRadius: 6 }}>
                      {gitInfo.suggestedBranch}
                    </code>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `git checkout -b ${gitInfo.suggestedBranch}`
                        ).then(() => { setCopiedCommit(true); setTimeout(() => setCopiedCommit(false), 2000); }).catch(() => undefined);
                      }}
                    >
                      {copiedCommit ? '✓ Copied' : '⎘ Copy checkout command'}
                    </button>
                  </div>
                </div>
              )}
              {gitInfo.recentCommits.length > 0 && (
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <p className="panel-title" style={{ marginBottom: 8 }}>Recent commits</p>
                  <div className="stack-sm">
                    {gitInfo.recentCommits.map((c: any) => (
                      <div key={c.hash} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                        <span className="chip mono" style={{ fontSize: 10 }}>{c.hash}</span>
                        <span style={{ fontSize: 12.5, color: 'var(--muted)', flex: 1 }}>{c.message}</span>
                        <span className="subtle" style={{ fontSize: 11, flex: 'none' }}>{c.author}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Git not available in this workspace. The project may not be a git repository.
            </p>
          )}
        </Card>
      )}

      {/* PR Summary card */}
      <Card
        title="Pull Request summary"
        action={
          <button
            className="btn btn-sm"
            onClick={() => copyText(prText, 'pr')}
          >
            {copied === 'pr' ? '✓ Copied' : '⎘ Copy PR summary'}
          </button>
        }
      >
        <div className="stack">
          {[
            { label: 'Summary', content: report.prSummary.summary },
            { label: 'Root cause', content: report.prSummary.rootCause },
            { label: 'Changes', content: report.prSummary.changes },
            { label: 'Testing', content: report.prSummary.testing },
            { label: 'Regression status', content: report.prSummary.regressionStatus },
          ].map(({ label, content }) => (
            <div key={label} style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <p className="panel-title" style={{ margin: '0 0 5px' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>
                {content}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Full engineering report */}
      <Card
        title="Engineering report"
        action={
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn btn-sm"
              onClick={() => copyText(report.markdown, 'report')}
            >
              {copied === 'report' ? '✓ Copied' : '⎘ Copy report'}
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                const blob = new Blob([report.markdown], { type: 'text/markdown' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `fixflow-report-${inv.id.slice(0, 8)}.md`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              ↓ Download .md
            </button>
          </div>
        }
      >
        <div className="stack">
          {[
            { label: 'Bug summary', content: report.bugSummary },
            { label: 'Root cause', content: report.rootCause },
            { label: 'Evidence', content: report.evidence },
            { label: 'Affected execution path', content: report.affectedExecutionPath },
            { label: 'Files changed', content: report.filesChanged },
            { label: 'Fix implemented', content: report.fixImplemented },
            { label: 'Tests executed', content: report.testsExecuted },
            { label: 'Before / after behaviour', content: report.beforeAfterBehavior },
            { label: 'Regression results', content: report.regressionResults },
            { label: 'Remaining risks', content: report.remainingRisks },
            { label: 'Recommended follow-up', content: report.recommendedFollowUp },
          ].map(({ label, content }) => (
            <div key={label} style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <p className="panel-title" style={{ margin: '0 0 6px' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>
                {content}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
