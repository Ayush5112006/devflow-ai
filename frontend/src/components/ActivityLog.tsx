import React from 'react';
import type { ActivityEntry } from '../types/index.js';

interface Props {
  entries: ActivityEntry[];
}

const LEVEL_COLOR: Record<string, string> = {
  info: 'var(--muted)',
  success: 'var(--accent)',
  warn: 'var(--warn)',
  error: 'var(--danger)',
};

const AGENT_COLOR: Record<string, string> = {
  manager: '#c084fc',
  code: '#60a5fa',
  api: '#22d3ee',
  database: '#fb923c',
  test: '#4ade80',
  evidence: '#fbbf24',
  history: '#f472b6',
  rootCause: '#f87171',
  implementation: '#818cf8',
  verification: '#2dd4bf',
  regression: '#fcd34d',
  reporting: '#a3e635',
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso.slice(11, 19);
  }
}

export function ActivityLog({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">No activity yet</p>
        <p className="empty-text">
          Agent events appear here as the investigation runs. This log is stored with the
          investigation, so it stays available after a reload.
        </p>
      </div>
    );
  }

  return (
    <div className="log" role="log" aria-live="polite" aria-label="Agent activity">
      {entries.map((e) => (
        <div key={e.id} className="log-row">
          <span className="log-time">{formatTime(e.at)}</span>
          <span className="log-agent" style={{ color: AGENT_COLOR[e.agent] ?? 'var(--muted)' }}>
            {e.agent}
          </span>
          <span className="log-msg" style={{ color: LEVEL_COLOR[e.level] ?? 'var(--muted)' }}>
            {e.message}
          </span>
        </div>
      ))}
    </div>
  );
}
