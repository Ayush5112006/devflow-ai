import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DemoBug, PipelineFacts } from '../types/index.js';
import { api } from '../services/api.js';
import { Badge, severityBadge } from '../components/Badge.js';
import { Card } from '../components/Card.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

/** Steps a person performs when investigating by hand. Not measured here. */
const MANUAL_STEPS = [
  'Receive bug report',
  'Gather logs manually',
  'Context switch across files',
  'Form a hypothesis',
  'Manually trace call paths',
  'Write a fix',
  'Run tests manually',
  'Document changes',
  'Hope for no regression',
];

/** Render a real duration without pretending to more precision than we have. */
function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function DashboardPage() {
  const [demoBugs, setDemoBugs] = React.useState<DemoBug[]>([]);
  const [facts, setFacts] = React.useState<PipelineFacts | null>(null);
  const [investigations, setInvestigations] = React.useState<Array<{
    id: string;
    bug: { title: string; severity: DemoBug['severity'] };
    status: string;
  }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [launching, setLaunching] = React.useState<string | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    Promise.all([api.demoBugs(), api.projects(), api.listInvestigations(), api.pipeline()])
      .then(([b, p, i, f]) => {
        setDemoBugs(b.bugs);
        setFacts(f);
        setInvestigations(i.investigations as typeof investigations);
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

  const observed = facts?.observed ?? null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-white mb-3">
          <span className="text-blue-400">Fix</span>Flow AI
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Agentic bug resolution platform. Select a demo bug to start a fully automated investigation.
        </p>
      </div>

      {/* Demo bugs */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Demo Scenarios
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {demoBugs.map((bug) => (
            <div key={bug.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex flex-col gap-3 hover:border-blue-500/50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-mono text-slate-500 uppercase">{bug.id}</span>
                {severityBadge(bug.severity)}
              </div>
              <p className="text-sm font-semibold text-white leading-snug">{bug.title}</p>
              <p className="text-xs text-slate-400 leading-relaxed flex-1">{bug.oneLine}</p>
              <button
                onClick={() => launchDemo(bug.id)}
                disabled={launching !== null}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {launching === bug.id ? 'Launching…' : 'Investigate with FixFlow'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow comparison */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Workflow Comparison
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Traditional Manual Workflow">
            <ol className="space-y-2 text-sm text-slate-400 list-decimal list-inside">
              {MANUAL_STEPS.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-500">
              {MANUAL_STEPS.length} steps, all performed by a person.
              <span className="block mt-1 text-slate-600 italic">
                FixFlow cannot measure this side — no timings below are claimed for manual work.
              </span>
            </div>
          </Card>

          <Card title="FixFlow AI Workflow">
            <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
              {(facts?.stages ?? []).map((s) => (
                <li key={s.id} className={s.requiresHuman ? 'text-amber-300' : undefined}>
                  {s.label}
                  {s.requiresHuman && <span className="ml-2 text-[11px] text-amber-400/80">(human gate)</span>}
                </li>
              ))}
            </ol>
            <div className="mt-4 pt-4 border-t border-slate-700 text-xs space-y-1">
              {observed ? (
                <>
                  <p className="text-emerald-400">
                    Measured over {observed.sampleSize} completed{' '}
                    {observed.sampleSize === 1 ? 'investigation' : 'investigations'}:{' '}
                    {duration(observed.minTotalMs)}–{duration(observed.maxTotalMs)} end to end
                    (median {duration(observed.medianTotalMs)}).
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-400">
                    <dt>Analysis</dt>
                    <dd className="text-slate-200">{duration(observed.medianInvestigationMs)}</dd>
                    <dt>Implementation</dt>
                    <dd className="text-slate-200">{duration(observed.medianImplementationMs)}</dd>
                    <dt>Verification</dt>
                    <dd className="text-slate-200">{duration(observed.medianVerificationMs)}</dd>
                    <dt>Analysis agents</dt>
                    <dd className="text-slate-200">{observed.medianAgentsUsed}</dd>
                    <dt>Files inspected</dt>
                    <dd className="text-slate-200">{observed.medianFilesInspected}</dd>
                    <dt>Tests run</dt>
                    <dd className="text-slate-200">{observed.medianTestsExecuted}</dd>
                    <dt>Hypotheses rejected</dt>
                    <dd className="text-slate-200">
                      {observed.medianHypothesesGenerated - observed.medianHypothesesRejected} kept,{' '}
                      {observed.medianHypothesesRejected} discarded
                    </dd>
                    <dt>Human steps</dt>
                    <dd className="text-slate-200">{observed.medianManualSteps}</dd>
                  </dl>
                </>
              ) : (
                <p className="text-slate-500 italic">
                  No completed investigation yet, so no duration is claimed. Run one and
                  this panel fills in with its own recorded timings.
                </p>
              )}
              <p className="text-slate-500 pt-1">
                {facts?.parallelAgentCount ?? 0} analysis agents ·{' '}
                {facts?.humanGateCount ?? 0} human gate
                {facts?.humanGateCount === 1 ? '' : 's'}
                {facts && facts.humanGateCount > 0 && ` (${facts.humanGateStages.join(', ')})`}
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* Recent investigations */}
      {investigations.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Recent Investigations
          </h2>
          <div className="space-y-2">
            {investigations.slice(0, 5).map((inv) => (
              <Link
                key={inv.id}
                to={`/investigations/${inv.id}`}
                className="flex items-center gap-4 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg hover:border-blue-500/40 transition-colors"
              >
                <span className="text-xs font-mono text-slate-500">{inv.id.slice(0, 12)}</span>
                <span className="text-sm text-slate-200 flex-1 truncate">{inv.bug.title}</span>
                {severityBadge(inv.bug.severity)}
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
