import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface PaletteAction {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: string;
  action(): void;
}

interface Props {
  open: boolean;
  onClose(): void;
  extraActions?: PaletteAction[];
}

export function CommandPalette({ open, onClose, extraActions = [] }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const baseActions: PaletteAction[] = [
    // --- Actions ---
    { id: 'new-investigation', label: 'New Investigation', description: 'Start investigating a bug with AI agents', icon: '+', shortcut: 'N', action: () => { navigate('/new'); onClose(); } },
    { id: 'judge', label: 'Open Judge Mode', description: 'Full 26-step lifecycle demo', icon: '◬', action: () => { navigate('/judge'); onClose(); } },
    // --- Workspace ---
    { id: 'dashboard', label: 'Dashboard', description: 'Engineering command center', icon: '▦', action: () => { navigate('/'); onClose(); } },
    { id: 'projects', label: 'Projects', description: 'Project hub', icon: '◫', action: () => { navigate('/projects'); onClose(); } },
    { id: 'analytics', label: 'Analytics', description: 'Metrics, DORA, audit log', icon: '◉', action: () => { navigate('/analytics'); onClose(); } },
    // --- Engineering ---
    { id: 'issues', label: 'Issues', description: 'Track and triage bugs', icon: '◎', action: () => { navigate('/issues'); onClose(); } },
    { id: 'investigations', label: 'Investigations', description: 'View all investigations', icon: '◐', action: () => { navigate('/investigations'); onClose(); } },
    { id: 'debugging', label: 'Debugging', description: 'Log analysis and runtime debug', icon: '⊘', action: () => { navigate('/debugging'); onClose(); } },
    // --- Quality ---
    { id: 'code-intelligence', label: 'Code Intelligence', description: 'Symbol search and explorer', icon: '◑', action: () => { navigate('/code-intelligence'); onClose(); } },
    { id: 'code-review', label: 'Code Review', description: 'AI-powered code review', icon: '◧', action: () => { navigate('/code-review'); onClose(); } },
    { id: 'security', label: 'Security Center', description: 'Vulnerability findings', icon: '◻', action: () => { navigate('/security'); onClose(); } },
    { id: 'test-center', label: 'Test Center', description: 'Test suites and coverage', icon: '✓', action: () => { navigate('/test-center'); onClose(); } },
    { id: 'dependencies', label: 'Dependencies', description: 'Package health and CVE tracking', icon: '◈', action: () => { navigate('/dependencies'); onClose(); } },
    { id: 'performance', label: 'Performance', description: 'Latency, API speed, frontend metrics', icon: '⚡', action: () => { navigate('/performance'); onClose(); } },
    // --- Delivery ---
    { id: 'repositories', label: 'Repositories', description: 'Repository overview and git data', icon: '⊟', action: () => { navigate('/repositories'); onClose(); } },
    { id: 'git', label: 'Git Center', description: 'Branches, commits, git info', icon: '⑂', action: () => { navigate('/git'); onClose(); } },
    { id: 'pull-requests', label: 'Pull Requests', description: 'Generate and review PRs', icon: '⊕', action: () => { navigate('/pull-requests'); onClose(); } },
    { id: 'releases', label: 'Releases', description: 'Release readiness and flags', icon: '◬', action: () => { navigate('/releases'); onClose(); } },
    // --- Operations ---
    { id: 'incidents', label: 'Incidents', description: 'Incident management and postmortems', icon: '⚡', action: () => { navigate('/incidents'); onClose(); } },
    { id: 'monitoring', label: 'Monitoring', description: 'Observability and health checks', icon: '◉', action: () => { navigate('/monitoring'); onClose(); } },
    // --- Knowledge ---
    { id: 'knowledge', label: 'Knowledge Base', description: 'Articles and AI project memory', icon: '▤', action: () => { navigate('/knowledge'); onClose(); } },
    { id: 'reports', label: 'Reports', description: 'Investigation reports', icon: '⊞', action: () => { navigate('/reports'); onClose(); } },
    // --- System ---
    { id: 'integrations', label: 'Integrations', description: 'Connect to GitHub, Jira, Sentry…', icon: '⌥', action: () => { navigate('/integrations'); onClose(); } },
    { id: 'metrics', label: 'Metrics', description: 'Pipeline performance metrics', icon: '▦', action: () => { navigate('/metrics'); onClose(); } },
    { id: 'settings', label: 'Settings', description: 'Platform configuration', icon: '⚙', action: () => { navigate('/settings'); onClose(); } },
  ];

  const actions = [...baseActions, ...extraActions];
  const filtered = query.trim()
    ? actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()) || (a.description ?? '').toLowerCase().includes(query.toLowerCase()))
    : actions;

  const run = useCallback((a: PaletteAction) => {
    a.action();
    onClose();
    setQuery('');
  }, [onClose]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelected(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && filtered[selected]) { e.preventDefault(); run(filtered[selected]); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selected, run, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        style={{
          position: 'fixed', top: '18vh', left: '50%', transform: 'translateX(-50%)',
          zIndex: 901, width: 'min(560px, calc(100vw - 32px))',
          background: 'var(--panel-raised)', border: '1px solid var(--line)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 72px rgba(0,0,0,.6)',
        }}
      >
        {/* Search box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 14, color: 'var(--subtle)' }} aria-hidden="true">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            aria-label="Search commands"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--ink)', fontSize: 15, caretColor: 'var(--accent)',
            }}
          />
          <kbd style={{ fontSize: 10, color: 'var(--subtle)', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 5, padding: '2px 6px', fontFamily: 'var(--mono)' }}>
            ESC
          </kbd>
        </div>
        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}>
          {filtered.length === 0 ? (
            <p style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--subtle)', fontSize: 13 }}>
              No commands found for "{query}"
            </p>
          ) : (
            filtered.map((a, i) => (
              <button
                key={a.id}
                onMouseEnter={() => setSelected(i)}
                onClick={() => run(a)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '10px 16px', background: i === selected ? 'rgba(183,243,107,.07)' : 'none',
                  border: 'none', textAlign: 'left', cursor: 'pointer',
                  borderLeft: i === selected ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: '120ms ease',
                }}
              >
                {a.icon && (
                  <span style={{ fontSize: 14, color: 'var(--subtle)', flex: 'none', width: 18, textAlign: 'center' }}>
                    {a.icon}
                  </span>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', fontWeight: 600, lineHeight: 1.4 }}>
                    {a.label}
                  </p>
                  {a.description && (
                    <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4, marginTop: 1 }}>
                      {a.description}
                    </p>
                  )}
                </div>
                {a.shortcut && (
                  <kbd style={{ fontSize: 10, color: 'var(--subtle)', background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 5, padding: '2px 6px', fontFamily: 'var(--mono)', flex: 'none' }}>
                    {a.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
        {/* Footer hint */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 16 }}>
          {[['↑↓', 'navigate'], ['↵', 'select'], ['esc', 'close']].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--subtle)' }}>
              <kbd style={{ background: 'var(--panel-sunken)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', fontFamily: 'var(--mono)', fontSize: 10 }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
