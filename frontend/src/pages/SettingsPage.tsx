import React, { useState } from 'react';
import { Card } from '../components/Card.js';

export function SettingsPage() {
  const [section, setSection] = useState('General');
  const [maxParallel, setMaxParallel] = useState('4');
  const [llmProvider, setLlmProvider] = useState('openai');
  const [logLevel, setLogLevel] = useState('info');
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [autoRunTests, setAutoRunTests] = useState(true);
  const [autoCleanInstrumentation, setAutoCleanInstrumentation] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const SETTINGS_SECTIONS = ['General', 'Agents', 'Git Integration', 'Notifications', 'About'];

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 800);
  }

  return (
    <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24, alignItems: 'start' }}>
      {/* Sidebar nav */}
      <div className="panel" style={{ padding: 8 }}>
        {SETTINGS_SECTIONS.map(s => (
          <button
            key={s}
            className={`sidenav-link ${section === s ? 'active' : ''}`}
            onClick={() => setSection(s)}
          >
            <span className="sidenav-label">{s}</span>
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="stack">
        {/* Demo notice */}
        <div className="alert alert-info" style={{ fontSize: 12 }}>
          <span>
            Settings are session-only in this demo — changes are not persisted across page reloads or server restarts.
            In production, settings would be written to the backend configuration.
          </span>
        </div>

        {/* ── GENERAL ── */}
        {section === 'General' && (
          <div className="panel" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>General Settings</h2>
            <div className="stack" style={{ gap: 20 }}>
              <label className="field">
                <span className="field-label">Platform Name</span>
                <input className="input" defaultValue="FixFlow AI" readOnly />
                <span className="field-hint">Display name shown in the UI.</span>
              </label>
              <label className="field">
                <span className="field-label">Log Level</span>
                <select className="select" value={logLevel} onChange={e => setLogLevel(e.target.value)}>
                  <option value="debug">Debug — all messages</option>
                  <option value="info">Info — standard</option>
                  <option value="warn">Warn — warnings and errors only</option>
                  <option value="error">Error — errors only</option>
                </select>
              </label>
              <ToggleSetting
                label="Require human approval before implementation"
                description="An agent-generated fix plan must be explicitly approved before any file is changed. Disabling this allows fully autonomous execution."
                value={approvalRequired}
                onChange={setApprovalRequired}
              />
              <ToggleSetting
                label="Auto-run tests after implementation"
                description="Run the full test suite automatically after the implementation agent applies changes."
                value={autoRunTests}
                onChange={setAutoRunTests}
              />
              <ToggleSetting
                label="Auto-remove temporary instrumentation"
                description="Automatically remove debug log statements and temporary tracing code after verification completes."
                value={autoCleanInstrumentation}
                onChange={setAutoCleanInstrumentation}
              />
            </div>
          </div>
        )}

        {/* ── AGENTS ── */}
        {section === 'Agents' && (
          <div className="panel" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>Agent Configuration</h2>
            <div className="stack" style={{ gap: 20 }}>
              <label className="field">
                <span className="field-label">LLM Provider</span>
                <select className="select" value={llmProvider} onChange={e => setLlmProvider(e.target.value)}>
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="anthropic">Anthropic (Claude Sonnet)</option>
                  <option value="local">Local / Ollama</option>
                </select>
                <span className="field-hint">Provider used for all AI agent operations.</span>
              </label>
              <label className="field">
                <span className="field-label">Max Parallel Agents</span>
                <select className="select" value={maxParallel} onChange={e => setMaxParallel(e.target.value)}>
                  {['1','2','3','4','6','8'].map(n => <option key={n} value={n}>{n} agents</option>)}
                </select>
                <span className="field-hint">Maximum number of investigation agents running concurrently.</span>
              </label>
              <div className="panel" style={{ padding: '14px 16px', background: 'var(--panel-sunken)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Available Agents
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['Code Investigator', 'API Investigator', 'Database Investigator', 'Test Investigator',
                    'Evidence Investigator', 'Git History Investigator', 'Security Investigator',
                    'Implementation Agent', 'Verification Agent', 'Report Agent'].map(a => (
                    <span key={a} className="chip">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GIT ── */}
        {section === 'Git Integration' && (
          <div className="panel" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>Git Integration</h2>
            <div className="stack" style={{ gap: 20 }}>
              <label className="field">
                <span className="field-label">Repository Path</span>
                <input className="input" defaultValue="." placeholder="/absolute/path/or/relative" />
                <span className="field-hint">Path to the repository root. Defaults to the working directory.</span>
              </label>
              <label className="field">
                <span className="field-label">Default Branch</span>
                <input className="input" defaultValue="main" placeholder="main" />
              </label>
              <label className="field">
                <span className="field-label">Fix Branch Prefix</span>
                <input className="input" defaultValue="fixflow/" placeholder="fixflow/" />
                <span className="field-hint">FixFlow will create branches like fixflow/fix-{'{'}investigation-id{'}'}.</span>
              </label>
              <div className="alert alert-warn" style={{ fontSize: 12 }}>
                FixFlow never merges branches or pushes to remote without explicit human approval.
                All Git operations are logged and reversible.
              </div>
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {section === 'Notifications' && (
          <div className="panel" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>Notifications</h2>
            <div className="stack" style={{ gap: 16 }}>
              <ToggleSetting
                label="Investigation completed"
                description="Notify when an investigation reaches the approval stage."
                value={true}
                onChange={() => {}}
              />
              <ToggleSetting
                label="Implementation succeeded"
                description="Notify when the implementation agent applies a fix successfully."
                value={true}
                onChange={() => {}}
              />
              <ToggleSetting
                label="Tests failed"
                description="Notify when the regression or verification agent detects test failures."
                value={true}
                onChange={() => {}}
              />
              <ToggleSetting
                label="Security findings"
                description="Notify when new high-severity security findings are detected."
                value={false}
                onChange={() => {}}
              />
              <div className="panel" style={{ padding: '12px 14px', background: 'var(--panel-sunken)', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Slack and webhook integrations are coming soon. Currently notifications appear as in-app toasts only.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── ABOUT ── */}
        {section === 'About' && (
          <div className="panel" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>About FixFlow AI</h2>
            <dl className="kv" style={{ rowGap: 12 }}>
              <dt>Version</dt><dd style={{ fontFamily: 'var(--mono)' }}>v2.0.0-demo</dd>
              <dt>Architecture</dt><dd>React + TypeScript frontend · Express + TypeScript backend</dd>
              <dt>Agent pipeline</dt><dd>Manager → 6 parallel investigators → Root Cause → Change Plan → Implementation → Verification → Report</dd>
              <dt>Backend port</dt><dd style={{ fontFamily: 'var(--mono)' }}>4000</dd>
              <dt>Frontend port</dt><dd style={{ fontFamily: 'var(--mono)' }}>5173</dd>
              <dt>State persistence</dt><dd>In-memory (session only) — no database in this demo</dd>
              <dt>Real features</dt>
              <dd>
                <ul style={{ margin: 0, padding: '0 0 0 16px', lineHeight: 1.8, fontSize: 13 }}>
                  <li>Full investigation pipeline with parallel agents</li>
                  <li>Real-time SSE streaming during investigations</li>
                  <li>Human approval gate before any code changes</li>
                  <li>Git info reader (reads from actual .git directory)</li>
                  <li>Report generation from completed investigations</li>
                  <li>23/23 backend tests passing</li>
                </ul>
              </dd>
            </dl>
          </div>
        )}

        {/* Save button (only for editable sections) */}
        {['General', 'Agents', 'Git Integration', 'Notifications'].includes(section) && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className={`btn ${saved ? 'btn-success' : 'btn-primary'}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '⟳ Saving…' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
            {saved && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Changes saved to session (not persisted).
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleSetting({
  label, description, value, onChange
}: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--line)' }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--subtle)', lineHeight: 1.5 }}>{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          flexShrink: 0,
          width: 40,
          height: 22,
          borderRadius: 11,
          border: 'none',
          background: value ? 'var(--accent)' : 'var(--line-strong)',
          position: 'relative',
          transition: '200ms ease',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: value ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: '200ms ease',
          }}
        />
      </button>
    </div>
  );
}
