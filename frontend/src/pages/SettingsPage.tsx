import React, { useState } from 'react';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';

const SETTINGS_SECTIONS = ['General', 'Agents', 'Security', 'Notifications', 'Git Integration'];

export function SettingsPage() {
  const [section, setSection] = useState('General');
  const [maxParallel, setMaxParallel] = useState('4');
  const [llmProvider, setLlmProvider] = useState('openai');
  const [logLevel, setLogLevel] = useState('info');
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [autoRunTests, setAutoRunTests] = useState(true);
  const [autoCleanInstrumentation, setAutoCleanInstrumentation] = useState(true);

  return (
    <div className="page-content">
      <div className="card-grid-sidebar" style={{ '--sidebar-width': '200px' } as any}>
        {/* Sidebar nav */}
        <div style={{ gridColumn: '2', gridRow: '1' }}>
          <div className="panel" style={{ padding: 8 }}>
            {SETTINGS_SECTIONS.map((s) => (
              <button
                key={s}
                className={`sidenav-link ${section === s ? 'active' : ''}`}
                style={{ width: '100%', margin: '2px 0' }}
                onClick={() => setSection(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ gridColumn: '1', gridRow: '1' }}>
          {section === 'General' && (
            <Card title="General Settings">
              <div className="stack" style={{ gap: 20 }}>
                <label className="field">
                  <span className="field-label">Platform Name</span>
                  <input className="input" defaultValue="FixFlow AI" readOnly />
                  <span className="field-hint">The product name shown in the UI.</span>
                </label>
                <label className="field">
                  <span className="field-label">Log Level</span>
                  <select className="select" value={logLevel} onChange={(e) => setLogLevel(e.target.value)}>
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error only</option>
                  </select>
                </label>
                <ToggleSetting
                  label="Require human approval before implementation"
                  description="When enabled, an agent-generated fix plan must be explicitly approved before any file is changed."
                  value={approvalRequired}
                  onChange={setApprovalRequired}
                />
                <ToggleSetting
                  label="Auto-run tests after implementation"
                  description="Run the test suite automatically after the implementation agent applies changes."
                  value={autoRunTests}
                  onChange={setAutoRunTests}
                />
                <ToggleSetting
                  label="Auto-remove instrumentation after verification"
                  description="Automatically remove temporary debug code after the fix is verified."
                  value={autoCleanInstrumentation}
                  onChange={setAutoCleanInstrumentation}
                />
                <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Save changes</button>
              </div>
            </Card>
          )}

          {section === 'Agents' && (
            <Card title="Agent Configuration">
              <div className="stack" style={{ gap: 20 }}>
                <label className="field">
                  <span className="field-label">Max parallel agents</span>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="12"
                    value={maxParallel}
                    onChange={(e) => setMaxParallel(e.target.value)}
                  />
                  <span className="field-hint">How many investigation agents can run simultaneously.</span>
                </label>

                <label className="field">
                  <span className="field-label">LLM Provider</span>
                  <select className="select" value={llmProvider} onChange={(e) => setLlmProvider(e.target.value)}>
                    <option value="openai">OpenAI GPT-4</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="local">Local (Ollama)</option>
                    <option value="none">None (static analysis only)</option>
                  </select>
                </label>

                <div>
                  <p className="field-label">Active Agents</p>
                  <div className="stack-sm">
                    {[
                      { id: 'evidence', title: 'Evidence Agent', enabled: true },
                      { id: 'code', title: 'Code Investigator', enabled: true },
                      { id: 'api', title: 'API Investigator', enabled: true },
                      { id: 'database', title: 'Database Investigator', enabled: true },
                      { id: 'test', title: 'Test Investigator', enabled: true },
                      { id: 'history', title: 'Git History Investigator', enabled: true },
                      { id: 'rootCause', title: 'Root Cause Agent', enabled: true },
                      { id: 'implementation', title: 'Implementation Agent', enabled: true },
                      { id: 'verification', title: 'Verification Agent', enabled: true },
                      { id: 'regression', title: 'Regression Agent', enabled: true },
                      { id: 'reporting', title: 'Reporting Agent', enabled: true },
                    ].map((agent) => (
                      <div key={agent.id} className="spread" style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--panel-sunken)', border: '1px solid var(--line)' }}>
                        <span style={{ fontSize: 13, color: 'var(--ink)' }}>{agent.title}</span>
                        <Badge variant="success" dot>Active</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {section === 'Security' && (
            <Card title="Security Settings">
              <div className="stack" style={{ gap: 20 }}>
                <ToggleSetting
                  label="Auto-scan for vulnerabilities on new investigation"
                  description="Run the security agent automatically when a new investigation starts."
                  value={true}
                  onChange={() => {}}
                />
                <ToggleSetting
                  label="Enforce parameterised query checks"
                  description="Flag any SQL queries with string interpolation as a high-severity finding."
                  value={true}
                  onChange={() => {}}
                />
                <ToggleSetting
                  label="Check for exposed secrets"
                  description="Scan source files for hardcoded API keys, passwords, and tokens."
                  value={true}
                  onChange={() => {}}
                />
                <div className="banner banner-info">
                  <p className="banner-text">
                    Security scanning is read-only. FixFlow AI never modifies files during a security scan.
                    All findings require human review before any action is taken.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {section === 'Notifications' && (
            <Card title="Notifications">
              <div className="stack" style={{ gap: 16 }}>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  Notification integrations let FixFlow AI post investigation updates to your preferred channels.
                  Currently available channels are shown below.
                </p>
                {[
                  { name: 'Slack', status: 'coming-soon' },
                  { name: 'GitHub Issues', status: 'coming-soon' },
                  { name: 'Jira', status: 'coming-soon' },
                  { name: 'Email', status: 'coming-soon' },
                  { name: 'Webhook', status: 'coming-soon' },
                ].map((n) => (
                  <div key={n.name} className="spread" style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--panel-sunken)', border: '1px solid var(--line)', opacity: 0.7 }}>
                    <span style={{ fontSize: 13, color: 'var(--ink)' }}>{n.name}</span>
                    <Badge variant="muted">Coming soon</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {section === 'Git Integration' && (
            <Card title="Git Integration">
              <div className="stack" style={{ gap: 16 }}>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  Connect FixFlow AI to your Git provider to enable PR creation, commit analysis, and branch-level investigations.
                </p>
                <label className="field">
                  <span className="field-label">Git provider</span>
                  <select className="select">
                    <option>GitHub</option>
                    <option>GitLab</option>
                    <option>Bitbucket</option>
                    <option>Azure DevOps</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Repository URL</span>
                  <input className="input" placeholder="https://github.com/org/repo" />
                </label>
                <label className="field">
                  <span className="field-label">Access token</span>
                  <input className="input" type="password" placeholder="ghp_…" />
                  <span className="field-hint">Token is stored only in server memory and never persisted to disk.</span>
                </label>
                <div className="banner banner-info">
                  <p className="banner-text">
                    Git integration is a preview capability. PR creation and branch analysis are available in investigations that complete successfully.
                  </p>
                </div>
                <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Connect repository</button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleSetting({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="spread" style={{ gap: 20, alignItems: 'flex-start' }}>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          flex: 'none',
          width: 44,
          height: 24,
          borderRadius: 999,
          border: 'none',
          background: value ? 'var(--accent)' : 'var(--line)',
          cursor: 'pointer',
          position: 'relative',
          transition: '160ms ease',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: value ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: value ? '#17210e' : 'var(--muted)',
          transition: '160ms ease',
        }} />
      </button>
    </div>
  );
}
