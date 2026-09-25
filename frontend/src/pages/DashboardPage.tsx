import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DemoBug, ProjectTarget } from '../types/index.js';
import { api } from '../services/api.js';
import { Badge, severityBadge } from '../components/Badge.js';
import { Card } from '../components/Card.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

interface Props {
  demoBugs: DemoBug[];
  projects: ProjectTarget[];
  loading: boolean;
}

export function DashboardPage() {
  const [demoBugs, setDemoBugs] = React.useState<DemoBug[]>([]);
  const [projects, setProjects] = React.useState<ProjectTarget[]>([]);
  const [investigations, setInvestigations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [launching, setLaunching] = React.useState<string | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    Promise.all([api.demoBugs(), api.projects(), api.listInvestigations()])
      .then(([b, p, i]) => {
        setDemoBugs(b.bugs);
        setProjects(p.projects);
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
              {['Receive bug report', 'Gather logs manually', 'Context switch across files',
                'Form a hypothesis', 'Manually trace call paths', 'Write a fix',
                'Run tests manually', 'Document changes', 'Hope for no regression'].map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-500">
              ⏱ Typical time: 90–180 minutes · 15–20 manual steps · High rework risk
            </div>
          </Card>
          <Card title="FixFlow AI Workflow">
            <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
              {['Submit bug report + evidence', 'Manager Agent coordinates 6 parallel agents',
                'Evidence correlation & hypothesis scoring', 'Root cause identified with confidence score',
                'Change plan generated with regression risk',
                '⏸ Human approval checkpoint',
                'Implementation Agent applies minimal change',
                'Verification + Regression automated',
                'Final engineering report generated'].map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-emerald-400">
              ⚡ Typical time: 30–60 seconds · 1 manual step (approval) · Reproducible
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
