import React from 'react';
import type { ActivityEntry } from '../types/index.js';

interface Props {
  entries: ActivityEntry[];
}

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

const LEVEL_ICON: Record<string, string> = {
  success: '✓',
  error: '✕',
  warn: '⚠',
  info: '·',
};

const LEVEL_COLOR: Record<string, string> = {
  info: 'var(--subtle)',
  success: 'var(--accent)',
  warn: 'var(--warn)',
  error: 'var(--danger)',
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso.slice(11, 19);
  }
}

/**
 * Shows a vertical timeline of agent activity events, newest-last
 * (reversed from the stored order which is newest-first).
 * Milestone events (success/error) are visually prominent.
 */
export function InvestigationTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">No timeline events yet</p>
        <p className="empty-text">Events appear as the investigation progresses.</p>
      </div>
    );
  }

  // Stored newest-first; display oldest-first for a natural timeline
  const ordered = [...entries].reverse();

  return (
    <div className="timeline" role="list" aria-label="Investigation timeline">
      {ordered.map((e, i) => {
        const isMilestone = e.level === 'success' || e.level === 'error';
        const agentColor = AGENT_COLOR[e.agent] ?? 'var(--muted)';
        const levelColor = LEVEL_COLOR[e.level] ?? 'var(--muted)';
        const icon = LEVEL_ICON[e.level] ?? '·';
        const isLast = i === ordered.length - 1;
        return (
          <div
            key={e.id}
            className={`timeline-row${isMilestone ? ' timeline-row-milestone' : ''}`}
            role="listitem"
          >
            {/* spine dot + connector */}
            <div className="timeline-spine">
              <span
                className="timeline-dot"
                aria-hidden="true"
                style={{
                  background: isMilestone ? levelColor : 'var(--panel-raised)',
                  borderColor: isMilestone ? levelColor : 'var(--line)',
                  color: isMilestone ? (e.level === 'success' ? '#17210e' : '#fff') : levelColor,
                }}
              >
                {isMilestone ? icon : ''}
              </span>
              {!isLast && <span className="timeline-connector" aria-hidden="true" />}
            </div>
            {/* content */}
            <div className="timeline-content">
              <div className="timeline-header">
                <span className="timeline-time mono">{formatTime(e.at)}</span>
                <span className="timeline-agent" style={{ color: agentColor }}>{e.agent}</span>
              </div>
              <p
                className="timeline-msg"
                style={{ color: isMilestone ? 'var(--ink)' : 'var(--muted)', fontWeight: isMilestone ? 600 : 400 }}
              >
                {e.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
