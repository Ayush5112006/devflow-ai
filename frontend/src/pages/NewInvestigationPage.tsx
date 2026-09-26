import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api.js';

type EvidenceKind = 'log' | 'screenshot' | 'http' | 'json' | 'stacktrace' | 'text';

interface EvidenceItem {
  name: string;
  kind: EvidenceKind;
  content: string;
}

const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  log: 'Server / application log',
  screenshot: 'Screenshot description',
  http: 'HTTP request / response',
  json: 'JSON payload',
  stacktrace: 'Stack trace',
  text: 'Other text',
};

/** Guess the best evidence kind from a file extension. */
function guessKind(filename: string): EvidenceKind {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['log', 'txt'].includes(ext)) return 'log';
  if (ext === 'json') return 'json';
  if (['har'].includes(ext)) return 'http';
  return 'text';
}

export function NewInvestigationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as { title?: string; description?: string; severity?: string } | null) ?? {};

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: prefill.title ?? '',
    description: prefill.description ?? '',
    severity: (prefill.severity ?? 'high') as 'critical' | 'high' | 'medium' | 'low',
    expectedBehavior: '',
    actualBehavior: '',
    reproSteps: '',
    reproCommand: '',
    environment: '',
    nodeVersion: '',
    os: '',
    deployTarget: '',
  });

  // Multiple evidence items support
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([
    { name: 'pasted-log.log', kind: 'log', content: '' },
  ]);

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function readFilesAsEvidence(files: FileList | File[]) {
    const arr = Array.from(files);
    arr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = (e.target?.result as string) ?? '';
        setEvidenceItems((prev) => [
          ...prev,
          { name: file.name, kind: guessKind(file.name), content },
        ]);
      };
      reader.readAsText(file);
    });
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      readFilesAsEvidence(e.dataTransfer.files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addEvidence() {
    setEvidenceItems((prev) => [...prev, { name: '', kind: 'log', content: '' }]);
  }

  function updateEvidence(idx: number, field: keyof EvidenceItem, value: string) {
    setEvidenceItems((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  function removeEvidence(idx: number) {
    setEvidenceItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const ready = form.title.trim().length > 0 && form.description.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const evidence = evidenceItems
        .filter((e) => e.content.trim())
        .map((e) => ({
          name: e.name || `evidence.${e.kind}`,
          kind: e.kind,
          content: e.content,
        }));

      // Append environment info to description if provided
      let enrichedDescription = form.description;
      const envParts: string[] = [];
      if (form.environment) envParts.push(`Environment: ${form.environment}`);
      if (form.nodeVersion) envParts.push(`Node: ${form.nodeVersion}`);
      if (form.os) envParts.push(`OS: ${form.os}`);
      if (form.deployTarget) envParts.push(`Deploy target: ${form.deployTarget}`);
      if (envParts.length > 0) {
        enrichedDescription += `\n\n--- Environment ---\n${envParts.join('\n')}`;
      }

      const { investigation } = await api.createInvestigation({
        projectId: 'insightboard',
        bug: {
          title: form.title,
          description: enrichedDescription,
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
    <div style={{ maxWidth: 780, margin: '0 auto' }} className="stack">
      <header>
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/">Dashboard</a>
          <span aria-hidden="true">›</span>
          <span>New investigation</span>
        </nav>
        <h1 className="page-title">Report a bug</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6, maxWidth: '62ch' }}>
          The more precisely you describe the failure, the better the analysis agents can narrow it down.
          Title and description are required. All other fields improve accuracy.
        </p>
      </header>

      {/* Project context chip */}
      <div className="banner banner-info" style={{ padding: '10px 14px' }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge badge-info">Project</span>
          <span style={{ fontSize: 12, color: 'var(--ink)' }}>InsightBoard</span>
          <span style={{ color: 'var(--subtle)', fontSize: 12 }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Node.js + Express + SQLite demo project</span>
        </div>
      </div>

      <form onSubmit={submit} className="stack">

        {/* ── THE BUG ── */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">The bug</h2>
          </div>
          <div className="panel-body stack">
            <label className="field">
              <span className="field-label">Title <span aria-hidden="true" style={{ color: 'var(--danger)' }}>*</span></span>
              <input
                className="input"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Orders endpoint returns 500 after deploy"
                required
                autoFocus
              />
            </label>

            <div className="card-grid-2" style={{ gap: 14 }}>
              <label className="field">
                <span className="field-label">Severity</span>
                <select className="select" value={form.severity} onChange={(e) => update('severity', e.target.value)}>
                  <option value="critical">Critical — system down / data loss</option>
                  <option value="high">High — major feature broken</option>
                  <option value="medium">Medium — degraded experience</option>
                  <option value="low">Low — minor issue</option>
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
                placeholder="What is broken? What is the impact on users or the system?"
                required
              />
            </label>
          </div>
        </section>

        {/* ── EXPECTED VS ACTUAL ── */}
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
                  placeholder="The API should return a 200 with the orders list."
                />
              </label>
              <label className="field">
                <span className="field-label">Actual behaviour</span>
                <textarea
                  className="textarea"
                  value={form.actualBehavior}
                  onChange={(e) => update('actualBehavior', e.target.value)}
                  rows={3}
                  placeholder="The API returns 500 Internal Server Error."
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
                placeholder={'1. Deploy latest main branch\n2. GET /api/orders\n3. Observe 500 response'}
              />
            </label>
          </div>
        </section>

        {/* ── ENVIRONMENT ── */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Environment</h2>
            <span className="subtle" style={{ fontSize: 11 }}>optional — helps agents narrow the scope</span>
          </div>
          <div className="panel-body">
            <div className="card-grid-2" style={{ gap: 14 }}>
              <label className="field">
                <span className="field-label">Environment</span>
                <select className="select" value={form.environment} onChange={(e) => update('environment', e.target.value)}>
                  <option value="">Select…</option>
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development / local</option>
                  <option value="ci">CI / test runner</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Deploy target</span>
                <select className="select" value={form.deployTarget} onChange={(e) => update('deployTarget', e.target.value)}>
                  <option value="">Select…</option>
                  <option value="local">Local machine</option>
                  <option value="docker">Docker container</option>
                  <option value="vercel">Vercel</option>
                  <option value="railway">Railway</option>
                  <option value="heroku">Heroku</option>
                  <option value="aws">AWS</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Node.js version</span>
                <input className="input mono" value={form.nodeVersion} onChange={(e) => update('nodeVersion', e.target.value)} placeholder="e.g. 20.11.0" />
              </label>
              <label className="field">
                <span className="field-label">Operating system</span>
                <input className="input" value={form.os} onChange={(e) => update('os', e.target.value)} placeholder="e.g. Ubuntu 22.04, macOS 14" />
              </label>
            </div>
          </div>
        </section>

        {/* ── EVIDENCE ── */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Evidence</h2>
            <div className="row" style={{ gap: 8 }}>
              <span className="subtle" style={{ fontSize: 11 }}>optional — strongly recommended</span>
              <button type="button" className="btn btn-sm" onClick={addEvidence}>+ Add evidence</button>
            </div>
          </div>
          <div className="panel-body stack">
            {/* File drop zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop evidence files here or click to browse"
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--line-strong)'}`,
                borderRadius: 10,
                padding: '18px 24px',
                textAlign: 'center',
                background: dragOver ? 'var(--accent-soft2)' : 'var(--panel-sunken)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            >
              <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
                Drop log files / stack traces here
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>
                or <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>browse files</span> · .log, .txt, .json, .har supported · read in browser, not uploaded to any server
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".log,.txt,.json,.har,.md"
                style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files) readFilesAsEvidence(e.target.files); e.target.value = ''; }}
                aria-label="Upload evidence files"
              />
            </div>

            {evidenceItems.map((ev, idx) => (
              <div key={idx} style={{ padding: '14px 16px', background: 'var(--panel-sunken)', borderRadius: 10, border: '1px solid var(--line)' }}>
                <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span className="field-label">Type</span>
                      <select
                        className="select"
                        value={ev.kind}
                        onChange={(e) => updateEvidence(idx, 'kind', e.target.value)}
                        style={{ marginTop: 4 }}
                      >
                        {(Object.keys(EVIDENCE_KIND_LABELS) as EvidenceKind[]).map((k) => (
                          <option key={k} value={k}>{EVIDENCE_KIND_LABELS[k]}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span className="field-label">Filename (optional)</span>
                      <input
                        className="input mono"
                        value={ev.name}
                        onChange={(e) => updateEvidence(idx, 'name', e.target.value)}
                        placeholder={`evidence-${idx + 1}.${ev.kind === 'log' ? 'log' : ev.kind === 'json' ? 'json' : 'txt'}`}
                        style={{ marginTop: 4 }}
                      />
                    </label>
                  </div>
                  {evidenceItems.length > 1 && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeEvidence(idx)} style={{ alignSelf: 'flex-end' }}>
                      ✕
                    </button>
                  )}
                </div>
                <label className="field">
                  <span className="field-label">Content</span>
                  <textarea
                    className="textarea mono"
                    value={ev.content}
                    onChange={(e) => updateEvidence(idx, 'content', e.target.value)}
                    rows={ev.kind === 'log' || ev.kind === 'stacktrace' ? 7 : 4}
                    placeholder={
                      ev.kind === 'log' ? 'Paste server or application log output here…'
                      : ev.kind === 'stacktrace' ? 'TypeError: Cannot read properties of undefined…'
                      : ev.kind === 'http' ? 'GET /api/orders HTTP/1.1\n\n--- Response ---\nHTTP/1.1 500 Internal Server Error…'
                      : ev.kind === 'json' ? '{\n  "error": "no such column: o.customer_name"\n}'
                      : 'Paste or describe evidence here…'
                    }
                    style={{ marginTop: 4 }}
                  />
                </label>
              </div>
            ))}
            <p className="field-hint">
              Stack traces and log output are the strongest signals. The more evidence you provide, the more the agents can correlate.
            </p>
          </div>
        </section>

        {error && <div className="alert" role="alert"><span>{error}</span></div>}

        <div className="row" style={{ gap: 12 }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!ready || submitting}>
            {submitting ? '⟳ Starting investigation…' : '▶ Start investigation'}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            {ready ? 'Agents will begin analysis immediately.' : 'Add a title and description to continue.'}
          </span>
        </div>
      </form>
    </div>
  );
}
