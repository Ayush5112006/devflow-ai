import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';

export function NewInvestigationPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'high' as const,
    expectedBehavior: '',
    actualBehavior: '',
    reproSteps: '',
    reproCommand: '',
    logContent: '',
  });

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const evidence = form.logContent ? [{
        name: 'pasted-log.log',
        kind: 'log' as const,
        content: form.logContent,
      }] : [];

      const { investigation } = await api.createInvestigation({
        projectId: 'insightboard',
        bug: {
          title: form.title,
          description: form.description,
          severity: form.severity,
          expectedBehavior: form.expectedBehavior,
          actualBehavior: form.actualBehavior,
          reproSteps: form.reproSteps.split('\n').filter(Boolean),
          reproCommand: form.reproCommand || undefined,
        },
        evidence,
      });

      await api.start(investigation.id);
      navigate(`/investigations/${investigation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">New Investigation</h1>
      <form onSubmit={submit} className="space-y-5">
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Bug Report</h2>

          {[
            { label: 'Title', field: 'title', placeholder: 'Short description of the bug', required: true },
          ].map(({ label, field, placeholder, required }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-slate-300 mb-1">{label}</label>
              <input
                type="text"
                value={(form as any)[field]}
                onChange={(e) => update(field, e.target.value)}
                placeholder={placeholder}
                required={required}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Severity</label>
            <select
              value={form.severity}
              onChange={(e) => update('severity', e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {['critical', 'high', 'medium', 'low'].map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {[
            { label: 'Description', field: 'description', rows: 4, placeholder: 'Describe the issue in detail…' },
            { label: 'Expected Behavior', field: 'expectedBehavior', rows: 2, placeholder: 'What should happen…' },
            { label: 'Actual Behavior', field: 'actualBehavior', rows: 2, placeholder: 'What actually happens…' },
            { label: 'Reproduction Steps (one per line)', field: 'reproSteps', rows: 4, placeholder: '1. Start the app\n2. Navigate to…' },
          ].map(({ label, field, rows, placeholder }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-slate-300 mb-1">{label}</label>
              <textarea
                value={(form as any)[field]}
                onChange={(e) => update(field, e.target.value)}
                rows={rows}
                placeholder={placeholder}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Reproduction Command (optional)</label>
            <input
              type="text"
              value={form.reproCommand}
              onChange={(e) => update('reproCommand', e.target.value)}
              placeholder="npm run repro:d1"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Evidence (optional)</h2>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Log / Console Output</label>
            <textarea
              value={form.logContent}
              onChange={(e) => update('logContent', e.target.value)}
              rows={6}
              placeholder="Paste log output, stack traces, browser console errors…"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !form.title || !form.description}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating Investigation…' : 'Start Investigation'}
        </button>
      </form>
    </div>
  );
}
