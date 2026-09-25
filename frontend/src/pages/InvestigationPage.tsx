import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useInvestigation } from '../hooks/useInvestigation.js';
import { api } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge, severityBadge, statusBadge } from '../components/Badge.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { PipelineDiagram } from '../components/PipelineDiagram.js';
import { ActivityLog } from '../components/ActivityLog.js';
import { StageStepper, STAGE_ORDER, STAGE_LABEL, stageTone } from '../components/StageStepper.js';
import type { ActivityEntry, Investigation, StageId } from '../types/index.js';

/**
 * Human-readable elapsed time. Sub-minute runs used to round to a literal
 * "0 min", which made a fast (and successful) run look like it saved nothing.
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
    default: return true;
  }
}

export function InvestigationPage() {
  const { id } = useParams<{ id: string }>();
  const { investigation: inv, activity, loading, error, refresh } = useInvestigation(id);
  const [activeTab, setActiveTab] = useState<string>('pipeline');
  const [approving, setApproving] = useState(false);
  const [implementing, setImplementing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
            <p className="banner-title" style={{ color: 'var(--warn)' }}>⏸ This step needs you</p>
            <p className="banner-text">
              Nothing has been written yet. Review the change plan — it contains{' '}
              <strong>{inv.changePlan?.changes.length ?? 0}</strong> change
              {inv.changePlan?.changes.length === 1 ? '' : 's'} — then approve to let the
              implementation agent apply exactly that plan.
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setActiveTab('changeplan')}>Review plan</button>
            <button className="btn btn-warn btn-sm" onClick={() => approve('')} disabled={approving}>
              {approving ? 'Approving…' : '✓ Approve fix plan'}
            </button>
          </div>
        </div>
      )}

      {/*
        approve() transitions straight to `implementing`, so `approved` is never
        observed even though it exists in the status union. Gating only on
        `approved` made the control unreachable and dead-ended the workflow.
      */}
      {awaitingApply && (
        <div className="banner banner-info">
          <div>
            <p className="banner-title" style={{ color: 'var(--info)' }}>✓ Plan approved</p>
            <p className="banner-text">
              The decision is recorded against plan hash{' '}
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
            <p className="banner-title" style={{ color: 'var(--accent)' }}>✓ Investigation finished</p>
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
                {t.id === 'findings' && <span className="tab-count">{inv.findings.length}</span>}
              </button>
            );
          })}
        </div>

        <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} style={{ paddingTop: 18 }}>
          {activeTab === 'pipeline' && <PipelineTab inv={inv} activity={activity} />}
          {activeTab === 'findings' && <FindingsTab inv={inv} />}
          {activeTab === 'rootcause' && <RootCauseTab inv={inv} />}
          {activeTab === 'changeplan' && <ChangePlanTab inv={inv} onApprove={approve} approving={approving} />}
          {activeTab === 'implementation' && <ImplementationTab inv={inv} />}
          {activeTab === 'verification' && <VerificationTab inv={inv} />}
          {activeTab === 'regression' && <RegressionTab inv={inv} />}
          {activeTab === 'report' && <ReportTab inv={inv} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab panels                                                         */
/* ------------------------------------------------------------------ */

function Pending({ what, hint }: { what: string; hint: string }) {
  return (
    <div className="empty">
      <p className="empty-title">{what} not available yet</p>
      <p className="empty-text">{hint}</p>
    </div>
  );
}

function PipelineTab({ inv, activity }: { inv: Investigation; activity: ActivityEntry[] }) {
  return (
    <div className="card-grid-sidebar">
      <div className="stack">
        <Card title="Agent activity">
          <ActivityLog entries={activity} />
        </Card>
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
      </div>
    </div>
  );
}

function FindingsTab({ inv }: { inv: Investigation }) {
  const findings = inv.findings.filter((f) => f.severity !== 'info');
  if (findings.length === 0) {
    return <Pending what="Findings" hint="The analysis agents have not reported anything actionable yet." />;
  }
  return (
    <div className="stack">
      {findings.map((f) => (
        <article key={f.id} className="panel">
          <div className="panel-body stack-sm">
            <div className="spread">
              <h3 className="page-title-sm">{f.title}</h3>
              <div className="row" style={{ gap: 6 }}>
                <Badge variant={f.severity === 'high' ? 'danger' : f.severity === 'medium' ? 'warn' : 'info'} dot>
                  {f.severity}
                </Badge>
                <Badge variant="muted">{(f.confidence * 100).toFixed(0)}% confidence</Badge>
              </div>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{f.summary}</p>
            {f.impact && <p className="subtle" style={{ margin: 0, fontSize: 12, fontStyle: 'italic' }}>{f.impact}</p>}
            {f.files.length > 0 && (
              <div className="row" style={{ gap: 6 }}>
                {f.files.slice(0, 6).map((file) => <span key={file} className="chip">{file}</span>)}
                {f.files.length > 6 && <span className="chip">+{f.files.length - 6} more</span>}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function RootCauseTab({ inv }: { inv: Investigation }) {
  const rc = inv.rootCause;
  if (!rc) return <Pending what="Root cause" hint="Correlation runs after the analysis agents finish." />;

  return (
    <div className="stack">
      <Card title="Root cause">
        <div className="stack">
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{rc.statement}</p>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>{rc.detail}</p>
          <div className="row" style={{ gap: 12 }}>
            <div className="meter" style={{ flex: 1 }} role="img" aria-label={`Confidence ${(rc.confidence * 100).toFixed(0)} percent`}>
              <div className="meter-fill" style={{ width: `${rc.confidence * 100}%` }} />
            </div>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{(rc.confidence * 100).toFixed(0)}%</span>
          </div>
          {rc.margin < 0.2 && (
            <div className="alert" style={{ borderColor: 'rgba(251,191,36,.34)', background: 'var(--warn-soft)', color: 'var(--warn)' }}>
              <span>Low margin over the next hypothesis — treat this ranking as a shortlist, not a verdict.</span>
            </div>
          )}
        </div>
      </Card>

      {rc.failurePath.length > 0 && (
        <Card title="Failure path">
          <ol className="list-num">
            {rc.failurePath.map((step, i) => <li key={i}>{step.step}</li>)}
          </ol>
        </Card>
      )}

      <Card title="Evidence matrix" flush>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Hypothesis</th>
                <th>Status</th>
                <th>Score</th>
                <th>Corroborated by</th>
              </tr>
            </thead>
            <tbody>
              {rc.hypotheses.map((h) => (
                <tr key={h.id}>
                  <td style={{ maxWidth: 380 }}>
                    {h.statement.length > 90 ? `${h.statement.slice(0, 90).trimEnd()}…` : h.statement}
                  </td>
                  <td><Badge variant={h.status === 'supported' ? 'success' : h.status === 'possible' ? 'info' : 'muted'} dot>{h.status}</Badge></td>
                  <td className="mono" style={{ textAlign: 'right' }}>{(h.score * 100).toFixed(0)}%</td>
                  <td className="mono" style={{ fontSize: 11 }}>{h.corroboratedBy.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ChangePlanTab({
  inv, onApprove, approving,
}: {
  inv: Investigation;
  onApprove: (note: string) => void;
  approving: boolean;
}) {
  const plan = inv.changePlan;
  const [note, setNote] = useState('');

  if (!plan) return <Pending what="Change plan" hint="A plan is generated once a root cause is confirmed." />;

  return (
    <div className="stack">
      <Card title="Plan summary">
        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>{plan.summary}</p>
        <div className="spread" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <span className="subtle" style={{ fontSize: 12 }}>Plan hash (approval is bound to this value)</span>
          <span className="chip mono">{plan.planHash}</span>
        </div>
      </Card>

      {plan.changes.map((c) => (
        <article key={c.id} className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Change #{c.number}</h3>
            <span className="chip mono">{c.file}</span>
          </div>
          <div className="panel-body stack">
            <dl className="kv">
              <dt>Current</dt><dd>{c.currentBehavior}</dd>
              <dt>Required</dt><dd>{c.requiredChange}</dd>
              <dt>Reason</dt><dd>{c.reason}</dd>
              <dt style={{ color: 'var(--warn)' }}>Regression risk</dt><dd>{c.regressionRisk}</dd>
              <dt style={{ color: 'var(--accent)' }}>Verification</dt><dd>{c.verification}</dd>
            </dl>
            {c.diffPreview && <pre className="code">{c.diffPreview}</pre>}
          </div>
        </article>
      ))}

      {plan.consideredAndRejected.length > 0 && (
        <Card title="Considered and rejected">
          <ul className="list-plain">
            {plan.consideredAndRejected.map((r, i) => (
              <li key={i} style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--ink)' }}>{r.statement}</span>
                <span className="muted"> — {r.why}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {inv.status === 'awaiting_approval' && (
        <div className="panel" style={{ borderColor: 'rgba(251,191,36,.34)' }}>
          <div className="panel-body stack">
            <p className="banner-title" style={{ color: 'var(--warn)' }}>⏸ Approve to continue</p>
            <p className="banner-text" style={{ margin: 0 }}>
              Approving authorises the implementation agent to apply only the changes above. If the
              plan changes after this point, approval is rejected on the hash check.
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
            <button className="btn btn-warn btn-lg" onClick={() => onApprove(note)} disabled={approving}>
              {approving ? 'Approving…' : '✓ Approve fix plan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ImplementationTab({ inv }: { inv: Investigation }) {
  const impl = inv.implementation;
  if (!impl) return <Pending what="Implementation" hint="The implementation agent runs after the plan is approved." />;

  return (
    <div className="stack">
      <Card title="Implementation">
        <div className="stack">
          <div className="row" style={{ gap: 8 }}>
            {statusBadge(impl.status)}
            <span className="chip mono">{duration(impl.durationMs)}</span>
            <span className="chip mono">{impl.diffStat}</span>
          </div>
          {impl.notes.length > 0 && (
            <ul className="list-plain">
              {impl.notes.map((n, i) => <li key={i} className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{n}</li>)}
            </ul>
          )}
        </div>
      </Card>

      {impl.appliedChanges.length === 0 ? (
        <div className="alert">
          <span>No change was written to the workspace. The applied count is the honest result here — the run did not modify files.</span>
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
              {c.diff && <pre className="code">{c.diff}</pre>}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function VerificationTab({ inv }: { inv: Investigation }) {
  const ver = inv.verification;
  if (!ver) return <Pending what="Verification" hint="Verification runs once the implementation stage finishes." />;

  return (
    <div className="stack">
      <Card title="Verification">
        <div className="stack-sm">
          <div className="row" style={{ gap: 8 }}>{statusBadge(ver.status)}</div>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>{ver.summary}</p>
        </div>
      </Card>

      {ver.before && (
        <div className="card-grid-2">
          <Card title="Before">
            <dl className="kv">
              <dt>Expected</dt><dd>{ver.before.bugReproduction.expected}</dd>
              <dt>Observed</dt><dd>{ver.before.bugReproduction.observed}</dd>
            </dl>
            <div style={{ marginTop: 10 }}><Badge variant="danger" dot>fail</Badge></div>
          </Card>
          <Card title="After">
            <dl className="kv">
              <dt>Expected</dt><dd>{ver.before.postFix.expected}</dd>
              <dt>Observed</dt><dd>{ver.before.postFix.observed}</dd>
            </dl>
            <div style={{ marginTop: 10 }}>
              <Badge variant={ver.before.postFix.status === 'pass' ? 'success' : 'danger'} dot>
                {ver.before.postFix.status}
              </Badge>
            </div>
          </Card>
        </div>
      )}

      <div className="stack">
        {ver.checks.map((c) => (
          <article key={c.id} className="panel">
            <div className="panel-head">
              <h3 className="page-title-sm" style={{ fontSize: 14 }}>{c.name}</h3>
              <Badge variant={c.status === 'pass' ? 'success' : c.status === 'fail' ? 'danger' : c.status === 'not_available' ? 'muted' : 'warn'} dot>
                {c.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div className="panel-body stack-sm">
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>{c.summary}</p>
              {c.command && <pre className="code">{c.command}</pre>}
              {c.failedTests.length > 0 && (
                <div className="stack-sm">
                  <span className="subtle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Failed tests
                  </span>
                  {c.failedTests.slice(0, 8).map((t, i) => <pre key={i} className="code" style={{ color: 'var(--danger)' }}>{t}</pre>)}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function RegressionTab({ inv }: { inv: Investigation }) {
  const reg = inv.regression;
  if (!reg) return <Pending what="Regression" hint="Regression analysis runs after verification." />;

  return (
    <div className="stack">
      <Card title="Regression">
        <div className="stack-sm">
          <div className="row" style={{ gap: 8 }}>{statusBadge(reg.status)}</div>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>{reg.summary}</p>
        </div>
      </Card>

      {reg.impacts.length > 0 && (
        <Card title="Impact analysis">
          <ul className="list-plain">
            {reg.impacts.slice(0, 10).map((impact, i) => (
              <li key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <Badge variant={impact.severity === 'high' ? 'danger' : impact.severity === 'medium' ? 'warn' : 'info'} dot>
                  {impact.severity}
                </Badge>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="chip mono">{impact.file}</span>
                    <span className="subtle" style={{ fontSize: 11 }}>{impact.kind}</span>
                  </div>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.55 }}>{impact.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reg.originalBugRetested && (
        <Card title="Original bug re-test">
          <div className="stack-sm">
            <div className="spread">
              <span style={{ fontSize: 13 }}>{reg.originalBugRetested.name}</span>
              <Badge variant={reg.originalBugRetested.status === 'pass' ? 'success' : 'danger'} dot>
                {reg.originalBugRetested.status}
              </Badge>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>{reg.originalBugRetested.summary}</p>
          </div>
        </Card>
      )}

      {reg.createdTests.length > 0 && (
        <Card title="Generated regression tests">
          <ul className="list-plain">
            {reg.createdTests.map((t, i) => (
              <li key={i}>
                <span className="chip mono">{t.file}</span>
                <p className="muted" style={{ margin: '5px 0 0', fontSize: 12.5 }}>{t.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ReportTab({ inv }: { inv: Investigation }) {
  const report = inv.report;
  const metrics = inv.metrics;
  if (!report) return <Pending what="Report" hint="The engineering report is written once the workflow completes." />;

  return (
    <div className="stack">
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

      {metrics?.comparison && (
        <Card title="Workflow comparison">
          <div className="card-grid-3" style={{ alignItems: 'center' }}>
            <div>
              <p className="metric-label" style={{ marginBottom: 6 }}>Manual baseline (estimated)</p>
              <p className="metric-value">{metrics.comparison.baseline.totalMinutes} min</p>
              <p className="subtle" style={{ margin: '4px 0 0', fontSize: 12 }}>
                {metrics.comparison.baseline.manualSteps} manual steps
              </p>
            </div>
            <div style={{ textAlign: 'center', color: 'var(--accent)', fontSize: 22 }} aria-hidden="true">→</div>
            <div>
              <p className="metric-label" style={{ marginBottom: 6 }}>FixFlow (measured)</p>
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
            estimated baseline · {metrics.comparison.deltas.manualStepsReduced} steps automated.
            The baseline is an estimate, not a measurement.
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

      <Card
        title="Engineering report"
        action={
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
        }
      >
        <div className="stack">
          {[
            { label: 'PR summary', content: report.prSummary.summary },
            { label: 'Root cause', content: report.rootCause },
            { label: 'Files changed', content: report.filesChanged },
            { label: 'Tests executed', content: report.testsExecuted },
            { label: 'Before / after', content: report.beforeAfterBehavior },
            { label: 'Regression', content: report.regressionResults },
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
