import React from 'react';
import type { AgentRun, StageTiming } from '../types/index.js';
import { STAGE_LABEL, STAGE_ORDER, stageTone } from './StageStepper.js';

const AGENT_LABELS: Record<string, string> = {
  evidence: 'Evidence',
  code: 'Code',
  api: 'API / Service',
  database: 'Database',
  test: 'Tests',
  history: 'Git History',
};

interface Props {
  stages: Record<string, StageTiming>;
  agents: AgentRun[];
}

const DOT: Record<string, string> = {
  done: 'var(--accent)',
  active: 'var(--info)',
  fail: 'var(--danger)',
  wait: 'var(--warn)',
  idle: 'var(--line)',
};

/** Agent-level detail; the StageStepper covers the top-level progression. */
export function PipelineDiagram({ stages, agents }: Props) {
  const investigationAgents = agents.filter((a) =>
    ['evidence', 'code', 'api', 'database', 'test', 'history'].includes(a.agent));

  return (
    <div className="stack-sm">
      {STAGE_ORDER.map((stageId) => {
        const s = stages[stageId];
        const tone = stageTone(s?.status, false);
        const isInvestigation = stageId === 'investigation';

        return (
          <React.Fragment key={stageId}>
            <div className="row" style={{ gap: 10, paddingTop: 4 }}>
              <span
                aria-hidden="true"
                style={{ width: 8, height: 8, borderRadius: 999, background: DOT[tone], flex: 'none' }}
              />
              <span style={{ fontSize: 12.5, color: tone === 'idle' ? 'var(--subtle)' : 'var(--ink)' }}>
                {STAGE_LABEL[stageId]}
              </span>
              {s?.durationMs ? (
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--subtle)' }}>
                  {(s.durationMs / 1000).toFixed(1)}s
                </span>
              ) : null}
              {s?.status && s.status !== 'pending' && (
                <span
                  className="mono"
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    color: DOT[tone],
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                  }}
                >
                  {s.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            {isInvestigation && investigationAgents.length > 0 && (
              <div style={{ marginLeft: 14, paddingLeft: 12, borderLeft: '1px solid var(--line)' }} className="stack-sm">
                {investigationAgents.map((a) => (
                  <div key={a.agent} className="row" style={{ gap: 9, padding: '1px 0' }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6, height: 6, borderRadius: 999, flex: 'none',
                        background: a.status === 'completed' ? 'var(--accent)' : a.status === 'failed' ? 'var(--danger)' : a.status === 'running' ? 'var(--info)' : 'var(--line)',
                      }}
                    />
                    <span style={{ fontSize: 12, color: a.status === 'pending' ? 'var(--subtle)' : 'var(--muted)' }}>
                      {AGENT_LABELS[a.agent] ?? a.agent}
                    </span>
                    {a.status === 'completed' && (
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--subtle)' }}>
                        {a.findingCount} finding{a.findingCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {a.durationMs ? (
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--subtle)' }}>
                        {(a.durationMs / 1000).toFixed(1)}s
                      </span>
                    ) : null}
                    {a.status === 'failed' && a.error && (
                      <span className="truncate-2" style={{ fontSize: 11, color: 'var(--danger)', maxWidth: 220 }}>
                        {a.error.message}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
