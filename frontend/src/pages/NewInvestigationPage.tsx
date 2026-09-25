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

  const ready = form.title.trim().length > 0 && form.description.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || submitting) return;
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
    <div style={{ maxWidth: 760, margin: '0 auto' }} className="stack" >
      <header>
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/">Dashboard</a>
          <span aria-hidden="true">›</span>
          <span>New investigation</span>
        </nav>
        <h1 className="page-title">Report a bug</h1>
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6, maxWidth: '62ch' }}>
          The more precisely you describe the failure, the more the analysis agents can narrow it
          down. Only the title and description are required.
        </p>
      </header>

      <form onSubmit={submit} className="stack">
        <section className="panel">
          <div className="panel-head"><h2 className="panel-title">The bug</h2></div>
          <div className="panel-body stack">
            <label className="field">
              <span className="field-label">Title <span aria-hidden="true" style={{ color: 'var(--danger)' }}>*</span></span>
              <input
                className="input"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Checkout totals the wrong amount"
                required
              />
            </label>

            <div className="card-grid-2" style={{ gap: 14 }}>
              <label className="field">
                <span className="field-label">Severity</span>
                <select
                  className="select"
                  value={form.severity}
                  onChange={(e) => update('severity', e.target.value)}
                >
                  {['critical', 'high', 'medium', 'low'].map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Reproduction command <span className="subtle">(optional)</span></span>
                <input
                  className="input mono"
                  value={form.reproCommand}
                  onChange={(e) => update('reproCommand', e.target.value)}
                  placeholder="npm run repro:d1"
                />
              </label>
            </div>

            <label className="field">
              <span className="field-label">Description <span aria-hidden="true" style={{ color: 'var(--danger)' }}>*</span></span>
              <textarea
                className="textarea"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={4}
                placeholder="What is broken, and what is the impact?"
                required
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2 className="panel-title">Expected vs actual</h2></div>
          <div className="panel-body stack">
            <div className="card-grid-2" style={{ gap: 14 }}>
              <label className="field">
                <span className="field-label">Expected behaviour</span>
                <textarea
                  className="textarea"
                  value={form.expectedBehavior}
                  onChange={(e) => update('expectedBehavior', e.target.value)}
                  rows={3}
                  placeholder="The cart should show the discounted total."
                />
              </label>
              <label className="field">
                <span className="field-label">Actual behaviour</span>
                <textarea
                  className="textarea"
                  value={form.actualBehavior}
                  onChange={(e) => update('actualBehavior', e.target.value)}
                  rows={3}
                  placeholder="The cart shows the undiscounted total."
                />
              </label>
            </div>
            <label className="field">
              <span className="field-label">Reproduction steps <span className="subtle">(one per line)</span></span>
              <textarea
                className="textarea"
                value={form.reproSteps}
                onChange={(e) => update('reproSteps', e.target.value)}
                rows={3}
                placeholder={'Add two items to the cart\nApply the SAVE10 code\nOpen the cart summary'}
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Evidence</h2>
            <span className="subtle" style={{ fontSize: 11 }}>optional</span>
          </div>
          <div className="panel-body stack">
            <label className="field">
              <span className="field-label">Log or console output</span>
              <textarea
                className="textarea mono"
                value={form.logContent}
                onChange={(e) => update('logContent', e.target.value)}
                rows={7}
                placeholder={'TypeError: Cannot read properties of undefined (reading \'label\')'}
              />
              <span className="field-hint">
                Stack traces and error text are the strongest signal for narrowing the root cause.
              </span>
            </label>
          </div>
        </section>

        {error && <div className="alert" role="alert"><span>{error}</span></div>}

        <div className="row" style={{ gap: 10 }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!ready || submitting}>
            {submitting ? 'Starting investigation…' : 'Start investigation'}
          </button>
          <span className="subtle" style={{ fontSize: 12 }}>
            {ready ? 'Analysis runs automatically after you submit.' : 'Add a title and description to continue.'}
          </span>
        </div>
      </form>
    </div>
  );
}
