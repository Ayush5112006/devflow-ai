import React from 'react';
import type { ActivityEntry } from '../types/index.js';

interface Props {
  entries: ActivityEntry[];
}

const LEVEL_COLOR: Record<string, string> = {
  info: 'text-slate-400',
  success: 'text-emerald-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const AGENT_COLOR: Record<string, string> = {
  manager: 'text-purple-400',
  code: 'text-blue-400',
  api: 'text-cyan-400',
  database: 'text-orange-400',
  test: 'text-green-400',
  evidence: 'text-yellow-400',
  history: 'text-pink-400',
  rootCause: 'text-red-400',
  implementation: 'text-indigo-400',
  verification: 'text-teal-400',
  regression: 'text-amber-400',
  reporting: 'text-lime-400',
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
      <div className="text-sm text-slate-500 italic py-4 text-center">
        Waiting for activity…
      </div>
    );
  }

  return (
    <div className="space-y-0.5 font-mono text-xs max-h-96 overflow-y-auto">
      {entries.map((e) => (
        <div key={e.id} className="flex gap-2 py-0.5 hover:bg-slate-700/30 px-1 rounded">
          <span className="text-slate-500 shrink-0">[{formatTime(e.at)}]</span>
          <span className={`shrink-0 ${AGENT_COLOR[e.agent] ?? 'text-slate-400'}`}>
            {e.agent}
          </span>
          <span className={`${LEVEL_COLOR[e.level] ?? 'text-slate-300'} break-all`}>
            {e.message}
          </span>
        </div>
      ))}
    </div>
  );
}
