import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DemoBug, PipelineFacts } from '../types/index.js';
import { api } from '../services/api.js';
import { Badge, severityBadge } from '../components/Badge.js';
import { Card } from '../components/Card.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

export function DashboardPage() {
  const [demoBugs, setDemoBugs] = React.useState<DemoBug[]>([]);
  const [pipeline, setPipeline] = React.useState<PipelineFacts | null>(null);
  const [investigations, setInvestigations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [launching, setLaunching] = React.useState<string | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    Promise.all([
      api.demoBugs(),
      api.pipeline(),
      api.listInvestigations(),
    ])
      .then(([b, p, i]) => {
        setDemoBugs(b.bugs);
        setPipeline(p);
        setInvestigations(i.investigations);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function launchDemo(bugId: string) {
    setLaunching(bugId);
    try {
      const { investigation } = await api.demoQuickstart(bugId);
      navigate(`/investigations/${investigation.id}`);
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      setLaunching(null);
    }
  }

  if (loading) return <LoadingSpinner message="Loading FixFlow AI…" />;

  return (
    <div className="dashboard">
      {/* Hero */}
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Autonomous engineering operations</p>
          <h1 className="dashboard-title">Move from <span>signal</span> to shipped fix.</h1>
          <p className="dashboard-subtitle">
            Investigate production bugs with coordinated agents, auditable evidence, and a human approval gate before changes land.
          </p>
        </div>
        <Link to="/new" className="hero-action">+ New investigation</Link>
        {pipeline && (
          <div className="stats-row">
            <Stat label="parallel agents" value={pipeline.parallelAgentCount} />
            <Stat label="manual step" value={pipeline.humanGateCount} />
            <Stat label="workflow stages" value={pipeline.stages.length} />
            {pipeline.observed && (
              <Stat label="median run" value={`${(pipeline.observed.medianTotalMs / 1000).toFixed(1)}s`} />
            )}
          </div>
        )}
      </div>

      {/* Demo bugs */}
      <section>
        <div className="section-heading"><h2>Start with a known failure</h2><p>Curated scenarios from InsightBoard</p></div>
        <div className="scenario-grid">
          {demoBugs.map((bug) => (
            <div key={bug.id} className="scenario-card">
              <div className="scenario-meta">
                <span>{bug.id}</span>
                {severityBadge(bug.severity)}
              </div>
              <p className="scenario-title">{bug.title}</p>
              <p className="scenario-description">{bug.oneLine}</p>
              <button
                onClick={() => launchDemo(bug.id)}
                disabled={launching !== null}
                className="scenario-button"
              >
                {launching === bug.id ? 'Launching…' : 'Investigate with FixFlow'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow comparison — numbers from the live pipeline endpoint */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Workflow Comparison
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Traditional Manual Workflow">
            <ol className="space-y-2 text-sm text-slate-400 list-decimal list-inside">
              {['Receive bug report', 'Gather logs manually', 'Context switch across files',
                'Form a hypothesis', 'Manually trace call paths', 'Write a fix',
                'Run tests manually', 'Document changes', 'Hope for no regression'].map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-500">
              ⏱ Estimated 90–180 min · 15–20 manual steps · High rework risk
            </div>
          </Card>
          <Card title="FixFlow AI Workflow">
            <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
              {pipeline?.stages.map((s) => (
                <li key={s.id} className={s.requiresHuman ? 'text-yellow-300 font-medium' : ''}>
                  {s.requiresHuman ? '⏸ ' : ''}{s.label}
                  {s.requiresHuman && <span className="text-slate-500 font-normal"> — human decision</span>}
                </li>
              )) ?? []}
            </ol>
            <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-emerald-400">
              {pipeline
                ? `⚡ ${pipeline.parallelAgentCount} parallel agents · ${pipeline.humanGateCount} manual step (${pipeline.humanGateStages.join(', ')}) · Reproducible`
                : '⚡ Parallel agents · 1 manual step · Reproducible'}
            </div>
          </Card>
        </div>
      </section>

      {/* Live stats from completed runs (only shown when there is real data) */}
      {pipeline?.observed && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Measured Performance ({pipeline.observed.sampleSize} completed run{pipeline.observed.sampleSize !== 1 ? 's' : ''})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Median total', value: `${(pipeline.observed.medianTotalMs / 1000).toFixed(1)}s` },
              { label: 'Files inspected', value: pipeline.observed.medianFilesInspected },
              { label: 'Hypotheses', value: pipeline.observed.medianHypothesesGenerated },
              { label: 'Agents used', value: pipeline.observed.medianAgentsUsed },
            ].map((m) => (
              <div key={m.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-emerald-400">{m.value}</p>
                <p className="text-xs text-slate-500 mt-1">{m.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent investigations */}
      {investigations.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Recent Investigations
          </h2>
          <div className="space-y-2">
            {investigations.slice(0, 5).map((inv: any) => (
              <Link
                key={inv.id}
                to={`/investigations/${inv.id}`}
                className="flex items-center gap-4 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg hover:border-blue-500/40 transition-colors"
              >
                <span className="text-xs font-mono text-slate-500">{inv.id?.slice(0, 12)}</span>
                <span className="text-sm text-slate-200 flex-1 truncate">{inv.bug?.title}</span>
                {severityBadge(inv.bug?.severity)}
                <Badge variant={inv.status === 'completed' ? 'success' : inv.status === 'failed' ? 'danger' : 'info'}>
                  {inv.status}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
