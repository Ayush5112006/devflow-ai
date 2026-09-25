import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useInvestigation } from '../hooks/useInvestigation.js';
import { api } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge, severityBadge, statusBadge } from '../components/Badge.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { PipelineDiagram } from '../components/PipelineDiagram.js';
import { ActivityLog } from '../components/ActivityLog.js';

export function InvestigationPage() {
  const { id } = useParams<{ id: string }>();
  const { investigation: inv, activity, loading, error, refresh } = useInvestigation(id);
  const [activeTab, setActiveTab] = useState<string>('pipeline');
  const [approving, setApproving] = useState(false);
  const [implementing, setImplementing] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');

  if (loading) return <LoadingSpinner message="Loading investigation…" />;
  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!inv) return <div className="text-slate-400 text-sm p-4">Investigation not found.</div>;

  async function approve() {
    if (!id) return;
    setApproving(true);
    try {
      await api.approve(id, 'developer', approvalNote);
      refresh();
    } catch (e) {
      alert(`Approval failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setApproving(false);
    }
  }

  async function implement() {
    if (!id) return;
    setImplementing(true);
    try {
      await api.implement(id);
      refresh();
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      setImplementing(false);
    }
  }

  const tabs = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'findings', label: `Findings (${inv.findings.length})` },
    { id: 'rootcause', label: 'Root Cause' },
    { id: 'changeplan', label: 'Change Plan' },
    { id: 'implementation', label: 'Implementation' },
    { id: 'verification', label: 'Verification' },
    { id: 'regression', label: 'Regression' },
    { id: 'report', label: 'Report' },
  ].filter((t) => {
    if (t.id === 'rootcause' && !inv.rootCause) return false;
    if (t.id === 'changeplan' && !inv.changePlan) return false;
    if (t.id === 'implementation' && !inv.implementation) return false;
    if (t.id === 'verification' && !inv.verification) return false;
    if (t.id === 'regression' && !inv.regression) return false;
    if (t.id === 'report' && !inv.report) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="text-xs text-slate-500 hover:text-slate-300">Dashboard</Link>
            <span className="text-slate-600">›</span>
            <span className="text-xs text-slate-400">{id?.slice(0, 12)}</span>
          </div>
          <h1 className="text-xl font-bold text-white">{inv.bug.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            {severityBadge(inv.bug.severity)}
            {statusBadge(inv.status)}
            <span className="text-xs text-slate-500">{inv.projectName}</span>
          </div>
        </div>
        {/* Approval CTA */}
        {inv.status === 'awaiting_approval' && (
          <div className="shrink-0">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3 min-w-64">
              <p className="text-sm font-semibold text-yellow-300">⏸ Awaiting Approval</p>
              <p className="text-xs text-slate-400">Review the change plan and approve to proceed.</p>
              <textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Optional note…"
                rows={2}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-yellow-500 resize-none"
              />
              <button
                onClick={() => { setActiveTab('changeplan'); }}
                className="w-full py-1.5 text-xs text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700"
              >
                Review Change Plan ↗
              </button>
              <button
                onClick={approve}
                disabled={approving}
                className="w-full py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {approving ? 'Approving…' : '✓ Approve Fix Plan'}
              </button>
            </div>
          </div>
        )}
        {inv.status === 'approved' && !inv.implementation && (
          <div className="shrink-0">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-300">✓ Approved</p>
              <button
                onClick={implement}
                disabled={implementing}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {implementing ? 'Implementing…' : 'Apply Fix'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700 pb-0 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-medium whitespace-nowrap rounded-t-lg transition-colors ${
              activeTab === t.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'pipeline' && <PipelineTab inv={inv} activity={activity} />}
        {activeTab === 'findings' && <FindingsTab inv={inv} />}
        {activeTab === 'rootcause' && <RootCauseTab inv={inv} />}
        {activeTab === 'changeplan' && (
          <ChangePlanTab inv={inv} onApprove={approve} approving={approving} approvalNote={approvalNote} setApprovalNote={setApprovalNote} />
        )}
        {activeTab === 'implementation' && <ImplementationTab inv={inv} />}
        {activeTab === 'verification' && <VerificationTab inv={inv} />}
        {activeTab === 'regression' && <RegressionTab inv={inv} />}
        {activeTab === 'report' && <ReportTab inv={inv} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab panels                                                         */
/* ------------------------------------------------------------------ */

import type { Investigation } from '../types/index.js';

function PipelineTab({ inv, activity }: { inv: Investigation; activity: any[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <Card title="Workflow Pipeline">
          <PipelineDiagram stages={inv.stages} agents={inv.agents} />
        </Card>
      </div>
      <div className="lg:col-span-2 space-y-4">
        <Card title="Agent Activity">
          <ActivityLog entries={activity} />
        </Card>
        {inv.projectMap && (
          <Card title="Project Map">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-slate-500">Files indexed:</span> <span className="text-white">{inv.projectMap.fileCount}</span></div>
              <div><span className="text-slate-500">Frameworks:</span> <span className="text-white">{inv.projectMap.frameworks.join(', ') || '—'}</span></div>
              <div><span className="text-slate-500">Test runner:</span> <span className="text-white">{inv.projectMap.testRunner || '—'}</span></div>
              <div><span className="text-slate-500">Languages:</span> <span className="text-white">{Object.keys(inv.projectMap.languageBreakdown).join(', ')}</span></div>
            </div>
          </Card>
        )}
        {inv.errors.length > 0 && (
          <Card title="Errors">
            {inv.errors.map((e, i) => (
              <div key={i} className="text-xs text-red-400 font-mono py-1">{e.message}</div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function FindingsTab({ inv }: { inv: Investigation }) {
  const findings = inv.findings.filter((f) => f.severity !== 'info');
  return (
    <div className="space-y-3">
      {findings.length === 0 ? (
        <p className="text-slate-500 text-sm">No high-severity findings yet.</p>
      ) : (
        findings.map((f) => (
          <div key={f.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-white">{f.title}</p>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant={f.severity === 'high' ? 'danger' : f.severity === 'medium' ? 'warn' : 'info'}>{f.severity}</Badge>
                <Badge variant="muted">{(f.confidence * 100).toFixed(0)}%</Badge>
              </div>
            </div>
            <p className="text-xs text-slate-400 whitespace-pre-line">{f.summary}</p>
            {f.impact && <p className="text-xs text-slate-500 italic">{f.impact}</p>}
            {f.files.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {f.files.slice(0, 5).map((file) => (
                  <span key={file} className="font-mono text-xs px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">{file}</span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function RootCauseTab({ inv }: { inv: Investigation }) {
  const rc = inv.rootCause;
  if (!rc) return <p className="text-slate-500 text-sm">Root cause analysis not yet completed.</p>;

  return (
    <div className="space-y-4">
      <Card title="Root Cause">
        <div className="space-y-3">
          <p className="text-white font-medium">{rc.statement}</p>
          <p className="text-sm text-slate-400">{rc.detail}</p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500">Confidence</span>
            <div className="flex-1 bg-slate-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${rc.confidence * 100}%` }} />
            </div>
            <span className="text-white font-mono">{(rc.confidence * 100).toFixed(0)}%</span>
          </div>
          {rc.margin < 0.2 && (
            <p className="text-xs text-yellow-400">⚠ Low margin vs next hypothesis — manual review recommended.</p>
          )}
        </div>
      </Card>

      {rc.failurePath.length > 0 && (
        <Card title="Failure Path">
          <ol className="space-y-1">
            {rc.failurePath.map((step, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                <span className="text-slate-600">{i + 1}.</span>
                <span>{step.step}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card title="Evidence Matrix">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left py-2 pr-4">Hypothesis</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-right py-2 pr-4">Score</th>
                <th className="text-left py-2">Corroborated by</th>
              </tr>
            </thead>
            <tbody>
              {rc.hypotheses.map((h) => (
                <tr key={h.id} className="border-b border-slate-700/50">
                  <td className="py-2 pr-4 text-slate-300 max-w-xs">{h.statement.slice(0, 80)}…</td>
                  <td className="py-2 pr-4">
                    <Badge variant={h.status === 'supported' ? 'success' : h.status === 'possible' ? 'info' : 'muted'}>{h.status}</Badge>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-slate-400">{(h.score * 100).toFixed(0)}%</td>
                  <td className="py-2 text-slate-500">{h.corroboratedBy.join(', ')}</td>
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
  inv, onApprove, approving, approvalNote, setApprovalNote,
}: {
  inv: Investigation;
  onApprove: () => void;
  approving: boolean;
  approvalNote: string;
  setApprovalNote: (v: string) => void;
}) {
  const plan = inv.changePlan;
  if (!plan) return <p className="text-slate-500 text-sm">Change plan not yet generated.</p>;

  return (
    <div className="space-y-4">
      <Card title="Plan Summary">
        <p className="text-sm text-slate-300">{plan.summary}</p>
        <p className="text-xs text-slate-500 mt-2 font-mono">Plan hash: {plan.planHash}</p>
      </Card>

      {plan.changes.map((c) => (
        <div key={c.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Change #{c.number}</h3>
            <span className="font-mono text-xs text-blue-400">{c.file}</span>
          </div>
          <div className="grid gap-2 text-xs">
            <div><span className="text-slate-500">Current behavior: </span><span className="text-slate-300">{c.currentBehavior}</span></div>
            <div><span className="text-slate-500">Required change: </span><span className="text-slate-300">{c.requiredChange}</span></div>
            <div><span className="text-slate-500">Reason: </span><span className="text-slate-300">{c.reason}</span></div>
            <div><span className="text-yellow-500">Regression risk: </span><span className="text-slate-300">{c.regressionRisk}</span></div>
            <div><span className="text-green-500">Verification: </span><span className="text-slate-300">{c.verification}</span></div>
          </div>
          {c.diffPreview && (
            <pre className="bg-slate-900 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-slate-300">{c.diffPreview}</pre>
          )}
        </div>
      ))}

      {plan.consideredAndRejected.length > 0 && (
        <Card title="Considered & Rejected">
          {plan.consideredAndRejected.map((r, i) => (
            <div key={i} className="text-xs text-slate-400 py-1">
              <span className="text-slate-300">{r.statement}</span> — {r.why}
            </div>
          ))}
        </Card>
      )}

      {inv.status === 'awaiting_approval' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-yellow-300">⏸ Human Approval Required</h3>
          <p className="text-xs text-slate-400">
            Review the changes above. Once you approve, the Implementation Agent will apply only these exact changes.
          </p>
          <textarea
            value={approvalNote}
            onChange={(e) => setApprovalNote(e.target.value)}
            placeholder="Optional approval note…"
            rows={2}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-yellow-500 resize-none"
          />
          <button
            onClick={onApprove}
            disabled={approving}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {approving ? 'Approving…' : '✓ Approve Fix Plan'}
          </button>
        </div>
      )}
    </div>
  );
}

function ImplementationTab({ inv }: { inv: Investigation }) {
  const impl = inv.implementation;
  if (!impl) return <p className="text-slate-500 text-sm">Implementation not yet run.</p>;

  return (
    <div className="space-y-4">
      <Card title={`Implementation — ${impl.status.toUpperCase()}`}>
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div><span className="text-slate-500">Status: </span>
            <Badge variant={impl.status === 'completed' ? 'success' : impl.status === 'partial' ? 'warn' : 'danger'}>{impl.status}</Badge>
          </div>
          <div><span className="text-slate-500">Duration: </span><span className="text-white">{impl.durationMs}ms</span></div>
          <div className="col-span-2"><span className="text-slate-500">Diff stat: </span><span className="text-white">{impl.diffStat}</span></div>
        </div>
        <div className="space-y-1">
          {impl.notes.map((n, i) => (
            <p key={i} className="text-xs text-slate-400 font-mono">{n}</p>
          ))}
        </div>
      </Card>
      {impl.appliedChanges.map((c) => (
        <div key={c.plannedChangeId} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-blue-400">{c.file}</span>
            <Badge variant={c.status === 'applied' ? 'success' : c.status === 'skipped' ? 'muted' : 'danger'}>{c.status}</Badge>
          </div>
          {c.note && <p className="text-xs text-slate-400">{c.note}</p>}
          {c.diff && (
            <pre className="bg-slate-900 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-slate-300">{c.diff}</pre>
          )}
        </div>
      ))}
    </div>
  );
}

function VerificationTab({ inv }: { inv: Investigation }) {
  const ver = inv.verification;
  if (!ver) return <p className="text-slate-500 text-sm">Verification not yet run.</p>;

  return (
    <div className="space-y-4">
      <Card title={`Verification — ${ver.status.toUpperCase()}`}>
        <p className="text-sm text-slate-300">{ver.summary}</p>
      </Card>

      {ver.before && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card title="BEFORE">
            <div className="space-y-1 text-xs">
              <div><span className="text-slate-500">Expected: </span><span className="text-slate-300">{ver.before.bugReproduction.expected}</span></div>
              <div><span className="text-slate-500">Observed: </span><span className="text-slate-300">{ver.before.bugReproduction.observed}</span></div>
              <div className="pt-1">
                <Badge variant="danger">FAIL</Badge>
              </div>
            </div>
          </Card>
          <Card title="AFTER">
            <div className="space-y-1 text-xs">
              <div><span className="text-slate-500">Expected: </span><span className="text-slate-300">{ver.before.postFix.expected}</span></div>
              <div><span className="text-slate-500">Observed: </span><span className="text-slate-300">{ver.before.postFix.observed}</span></div>
              <div className="pt-1">
                <Badge variant={ver.before.postFix.status === 'pass' ? 'success' : 'danger'}>{ver.before.postFix.status.toUpperCase()}</Badge>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-2">
        {ver.checks.map((c) => (
          <div key={c.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">{c.name}</span>
              <Badge variant={c.status === 'pass' ? 'success' : c.status === 'fail' ? 'danger' : c.status === 'not_available' ? 'muted' : 'warn'}>{c.status}</Badge>
            </div>
            <p className="text-xs text-slate-400">{c.summary}</p>
            {c.command && <p className="text-xs font-mono text-slate-500 mt-1">{c.command}</p>}
            {c.failedTests.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-slate-500">Failed tests:</p>
                {c.failedTests.slice(0, 5).map((t, i) => (
                  <p key={i} className="text-xs text-red-400 font-mono">  {t}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RegressionTab({ inv }: { inv: Investigation }) {
  const reg = inv.regression;
  if (!reg) return <p className="text-slate-500 text-sm">Regression analysis not yet run.</p>;

  return (
    <div className="space-y-4">
      <Card title={`Regression — ${reg.status.toUpperCase()}`}>
        <p className="text-sm text-slate-300">{reg.summary}</p>
      </Card>

      {reg.impacts.length > 0 && (
        <Card title="Impact Analysis">
          <div className="space-y-2">
            {reg.impacts.slice(0, 10).map((impact, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <Badge variant={impact.severity === 'high' ? 'danger' : impact.severity === 'medium' ? 'warn' : 'info'}>{impact.severity}</Badge>
                <div>
                  <span className="font-mono text-slate-300">{impact.file}</span>
                  <span className="text-slate-500 ml-2">[{impact.kind}]</span>
                  <p className="text-slate-400">{impact.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {reg.originalBugRetested && (
        <Card title="Original Bug Re-test">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">{reg.originalBugRetested.name}</span>
            <Badge variant={reg.originalBugRetested.status === 'pass' ? 'success' : 'danger'}>{reg.originalBugRetested.status}</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">{reg.originalBugRetested.summary}</p>
        </Card>
      )}

      {reg.createdTests.length > 0 && (
        <Card title="Generated Regression Tests">
          {reg.createdTests.map((t, i) => (
            <div key={i} className="text-xs py-1">
              <span className="font-mono text-blue-400">{t.file}</span>
              <p className="text-slate-400">{t.description}</p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function ReportTab({ inv }: { inv: Investigation }) {
  const report = inv.report;
  const metrics = inv.metrics;

  if (!report) return <p className="text-slate-500 text-sm">Report not yet generated.</p>;

  return (
    <div className="space-y-4">
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Duration', value: `${(metrics.totalWorkflowDurationMs / 1000).toFixed(1)}s` },
            { label: 'Files Inspected', value: String(metrics.filesInspected) },
            { label: 'Hypotheses', value: `${metrics.hypothesesGenerated} (${metrics.hypothesesRejected} rejected)` },
            { label: 'Tests Executed', value: `${metrics.testsExecuted} (${metrics.testsPassed} passed)` },
            { label: 'Agents Used', value: `${metrics.agentsUsed}${metrics.agentsFailed ? ` (${metrics.agentsFailed} failed)` : ''}` },
            { label: 'Manual Steps', value: String(metrics.manualSteps) },
            { label: 'Steps Automated', value: `${metrics.manualStepsAutomatedPct}%` },
            { label: 'Files Modified', value: String(metrics.filesModified) },
          ].map((m) => (
            <div key={m.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{m.value}</p>
              <p className="text-xs text-slate-500 mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {metrics?.comparison && (
        <Card title="Workflow Comparison">
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-1">Manual Workflow</p>
              <p className="text-lg font-bold text-slate-300">{metrics.comparison.baseline.totalMinutes} min</p>
              <p className="text-xs text-slate-500">{metrics.comparison.baseline.manualSteps} manual steps</p>
            </div>
            <div className="flex items-center justify-center text-2xl text-blue-400">→</div>
            <div>
              <p className="text-xs text-slate-500 mb-1">FixFlow AI</p>
              <p className="text-lg font-bold text-emerald-400">{metrics.comparison.fixflow.totalMinutes} min</p>
              <p className="text-xs text-slate-500">{metrics.comparison.fixflow.manualSteps} manual step</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-emerald-400">
            ⚡ Saved ~{metrics.comparison.deltas.timeSavedMinutes.toFixed(0)} min · {metrics.comparison.deltas.manualStepsReduced} steps automated
          </div>
        </Card>
      )}

      <Card
        title="Engineering Report"
        action={
          <button
            onClick={() => {
              const blob = new Blob([report.markdown], { type: 'text/markdown' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `fixflow-report-${inv.id.slice(0, 8)}.md`;
              a.click();
            }}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            ↓ Download .md
          </button>
        }
      >
        <div className="space-y-4 text-xs text-slate-300">
          {[
            { label: 'PR Summary', content: report.prSummary.summary },
            { label: 'Root Cause', content: report.rootCause },
            { label: 'Files Changed', content: report.filesChanged },
            { label: 'Tests Executed', content: report.testsExecuted },
            { label: 'Before/After', content: report.beforeAfterBehavior },
            { label: 'Regression', content: report.regressionResults },
            { label: 'Remaining Risks', content: report.remainingRisks },
            { label: 'Recommended Follow-up', content: report.recommendedFollowUp },
          ].map(({ label, content }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
              <pre className="whitespace-pre-wrap leading-relaxed text-slate-300 font-sans">{content}</pre>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
