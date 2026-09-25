import React from 'react';
import type { AgentRun, StageId, StageTiming } from '../types/index.js';

const STAGE_LABELS: Record<string, string> = {
  projectAnalysis: 'Project Analysis',
  investigation: 'Investigation',
  rootCause: 'Root Cause',
  changePlan: 'Change Plan',
  approval: 'Approval (human)',
  implementation: 'Implementation',
  verification: 'Verification',
  regression: 'Regression',
  report: 'Report',
};

const AGENT_LABELS: Record<string, string> = {
  evidence: 'Evidence',
  code: 'Code',
  api: 'API/Service',
  database: 'Database',
  test: 'Tests',
  history: 'Git History',
};

interface Props {
  stages: Record<string, StageTiming>;
  agents: AgentRun[];
}

function statusIcon(status: string): string {
  if (status === 'completed' || status === 'passed' || status === 'clean') return '✓';
  if (status === 'running' || status === 'investigating') return '◎';
  if (status === 'failed') return '✗';
  if (status === 'waiting_approval' || status === 'awaiting_approval') return '⏸';
  return '○';
}

function statusColor(status: string): string {
  if (status === 'completed' || status === 'clean' || status === 'passed') return 'text-emerald-400';
  if (status === 'running' || status === 'investigating') return 'text-blue-400 animate-pulse';
  if (status === 'failed') return 'text-red-400';
  // Both spellings occur: the stage record uses waiting_approval, the
  // investigation status uses awaiting_approval.
  if (status === 'waiting_approval' || status === 'awaiting_approval') return 'text-yellow-400';
  return 'text-slate-500';
}

export function PipelineDiagram({ stages, agents }: Props) {
  const stageOrder: StageId[] = [
    'projectAnalysis', 'investigation', 'rootCause', 'changePlan', 'approval',
    'implementation', 'verification', 'regression', 'report',
  ];

  const investigationAgents = agents.filter((a) =>
    ['evidence', 'code', 'api', 'database', 'test', 'history'].includes(a.agent));

  return (
    <div className="space-y-1">
      {stageOrder.map((stageId, i) => {
        const s = stages[stageId];
        const status = s?.status ?? 'pending';
        const isInvestigation = stageId === 'investigation';

        return (
          <React.Fragment key={stageId}>
            {i > 0 && (
              <div className="ml-3 w-px h-3 border-l-2 border-dashed border-slate-700" />
            )}
            <div className={`flex items-center gap-3 px-3 py-2 rounded-md ${status === 'running' ? 'bg-blue-500/10' : status === 'completed' ? 'bg-emerald-500/5' : ''}`}>
              <span className={`text-sm font-mono w-4 text-center ${statusColor(status)}`}>
                {statusIcon(status)}
              </span>
              <span className={`text-sm flex-1 ${status === 'pending' ? 'text-slate-500' : 'text-slate-200'}`}>
                {STAGE_LABELS[stageId] ?? stageId}
              </span>
              {s?.durationMs > 0 && (
                <span className="text-xs text-slate-500 font-mono">{s.durationMs}ms</span>
              )}
            </div>

            {isInvestigation && investigationAgents.length > 0 && (
              <div className="ml-6 pl-3 border-l-2 border-slate-700 space-y-1 py-1">
                {investigationAgents.map((a) => (
                  <div key={a.agent} className="flex items-center gap-2 py-0.5">
                    <span className={`text-xs font-mono w-3 text-center ${statusColor(a.status)}`}>
                      {statusIcon(a.status)}
                    </span>
                    <span className={`text-xs ${a.status === 'pending' ? 'text-slate-500' : 'text-slate-300'}`}>
                      {AGENT_LABELS[a.agent] ?? a.agent}
                    </span>
                    {a.status === 'completed' && (
                      <span className="text-xs text-slate-500">
                        {a.findingCount} finding(s)
                      </span>
                    )}
                    {a.status === 'failed' && a.error && (
                      <span className="text-xs text-red-400 truncate max-w-32">{a.error.message}</span>
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
