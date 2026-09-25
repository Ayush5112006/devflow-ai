import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, useSSE } from '../api';

const STAGE_LABELS: Record<string, string> = {
  projectAnalysis: '📁 Project Analysis',
  investigation: '🔍 Investigation',
  rootCause: '🎯 Root Cause',
  changePlan: '📋 Change Plan',
  approval: '✅ Approval',
  implementation: '🔧 Implementation',
  verification: '🧪 Verification',
  regression: '🔄 Regression',
  report: '📊 Report',
};

const STAGE_ORDER = [
  'projectAnalysis', 'investigation', 'rootCause', 'changePlan',
  'approval', 'implementation', 'verification', 'regression', 'report',
];

export default function InvestigationView() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<any>(null);
  const [activity, setActivity] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.investigation(id)
      .then((data) => { setInv(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [id]);

  const handleEvent = useCallback((event: any) => {
    if (event.type === 'agent.progress') {
      setActivity((prev) => [`[${event.payload?.agent}] ${event.payload?.message}`, ...prev].slice(0, 50));
    }
    if (event.type === 'agent.started') {
      setActivity((prev) => [`▶ ${event.payload?.title} started`, ...prev].slice(0, 50));
    }
    if (event.type === 'agent.finished') {
      setActivity((prev) => [`✓ ${event.payload?.title} finished (${event.payload?.findingCount} findings)`, ...prev].slice(0, 50));
    }
    // Refresh investigation state periodically
    if (['stage.finished', 'findings.updated', 'rootcause.updated', 'investigation.updated'].includes(event.type)) {
      if (id) api.investigation(id).then(setInv).catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const cleanup = useSSE(id, handleEvent);
    return cleanup;
  }, [id, handleEvent]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
      </div>
    );
  }

  if (error || !inv) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>❌</p>
        <p style={{ color: 'var(--ff-error)' }}>{error ?? 'Investigation not found'}</p>
        <Link to="/" className="btn btn-ghost" style={{ marginTop: '1rem' }}>← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '2rem' }}>
        <Link to="/" style={{ color: 'var(--ff-text-muted)', fontSize: '0.8rem', textDecoration: 'none' }}>← Back to Dashboard</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
          <span className={`status-dot ${inv.status}`} style={{ width: 12, height: 12 }}></span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{inv.bug?.title ?? 'Investigation'}</h1>
          <span className={`badge badge-${inv.bug?.severity ?? 'info'}`}>{inv.status.replace(/_/g, ' ')}</span>
        </div>
        <p style={{ color: 'var(--ff-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', maxWidth: 800 }}>
          {inv.bug?.description}
        </p>
        <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--ff-text-dim)', marginTop: '0.4rem' }}>
          ID: {inv.id} • Project: {inv.projectName} • Started: {new Date(inv.createdAt).toLocaleString()}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
        {/* ─── Left Column ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Pipeline Stages */}
          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚡ Pipeline
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {STAGE_ORDER.map((stageId) => {
                const stage = inv.stages?.[stageId];
                const status = stage?.status ?? 'pending';
                return (
                  <div key={stageId} className={`pipeline-stage ${status}`}>
                    <span className={`status-dot ${status}`}></span>
                    <span style={{ flex: 1, fontWeight: 500 }}>{STAGE_LABELS[stageId] ?? stageId}</span>
                    {stage?.durationMs > 0 && (
                      <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--ff-text-dim)' }}>
                        {formatMs(stage.durationMs)}
                      </span>
                    )}
                    <span style={{ fontSize: '0.72rem', color: 'var(--ff-text-dim)', textTransform: 'capitalize' }}>
                      {status.replace(/_/g, ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent Runs */}
          {inv.agents?.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>🤖 Agent Runs</h2>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {inv.agents.map((agent: any, i: number) => (
                  <div key={i} className="animate-slide-in" style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1rem', borderRadius: 8,
                    background: 'var(--ff-bg)', border: '1px solid var(--ff-border)',
                    animationDelay: `${i * 0.05}s`,
                  }}>
                    <span className={`status-dot ${agent.status}`}></span>
                    <span style={{ flex: 1, fontWeight: 500, fontSize: '0.85rem' }}>{agent.title}</span>
                    <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--ff-text-dim)' }}>
                      {agent.findingCount} findings
                    </span>
                    {agent.durationMs != null && (
                      <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--ff-text-dim)' }}>
                        {formatMs(agent.durationMs)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          {inv.findings?.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📋 Findings ({inv.findings.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {inv.findings.map((finding: any, i: number) => (
                  <div key={i} style={{
                    padding: '1rem', borderRadius: 8,
                    background: 'var(--ff-bg)', border: '1px solid var(--ff-border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span className={`badge badge-${finding.severity}`}>{finding.severity}</span>
                      <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--ff-text-dim)' }}>{finding.agent}</span>
                      <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--ff-text-dim)' }}>
                        {(finding.confidence * 100).toFixed(0)}% conf
                      </span>
                    </div>
                    <h3 style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.3rem' }}>{finding.title}</h3>
                    <p style={{ color: 'var(--ff-text-muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>{finding.summary}</p>
                    {finding.files?.length > 0 && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {finding.files.map((f: string, j: number) => (
                          <code key={j} style={{
                            fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: 4,
                            background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                          }}>{f}</code>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Root Cause */}
          {inv.rootCause && (
            <div className="card glow-border">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>🎯 Root Cause</h2>
              <div style={{
                padding: '1rem', borderRadius: 8,
                background: 'rgba(99, 102, 241, 0.05)',
              }}>
                <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem' }}>{inv.rootCause.statement}</p>
                <p style={{ color: 'var(--ff-text-muted)', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {inv.rootCause.detail}
                </p>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ff-text-dim)' }}>
                    Confidence: <strong style={{ color: confidenceColor(inv.rootCause.confidence) }}>
                      {(inv.rootCause.confidence * 100).toFixed(0)}%
                    </strong>
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ff-text-dim)' }}>
                    Hypotheses: <strong>{inv.rootCause.hypotheses?.length ?? 0}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Right Column: Activity Feed ─── */}
        <div className="card" style={{ position: 'sticky', top: 80 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📡 Live Activity
          </h2>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.4rem',
            maxHeight: 500, overflowY: 'auto',
            fontSize: '0.78rem', color: 'var(--ff-text-muted)',
          }}>
            {activity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--ff-text-dim)' }}>
                {inv.status === 'investigating' ? (
                  <><div className="spinner" style={{ margin: '0 auto 0.75rem', width: 24, height: 24 }}></div>
                  Waiting for agent activity...</>
                ) : (
                  'Investigation complete.'
                )}
              </div>
            ) : (
              activity.map((msg, i) => (
                <div key={i} className="animate-slide-in" style={{
                  padding: '0.4rem 0.6rem', borderRadius: 6,
                  background: i === 0 ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  borderLeft: i === 0 ? '2px solid var(--ff-accent)' : '2px solid transparent',
                  animationDelay: '0s',
                }}>
                  {msg}
                </div>
              ))
            )}
          </div>

          {/* Bug Repro Steps */}
          {inv.bug?.reproSteps?.length > 0 && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--ff-border)', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Repro Steps</h3>
              <ol style={{ paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'var(--ff-text-muted)' }}>
                {inv.bug.reproSteps.map((step: string, i: number) => (
                  <li key={i} style={{ marginBottom: '0.3rem' }}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function confidenceColor(c: number): string {
  if (c >= 0.7) return 'var(--ff-success)';
  if (c >= 0.4) return 'var(--ff-warning)';
  return 'var(--ff-error)';
}
