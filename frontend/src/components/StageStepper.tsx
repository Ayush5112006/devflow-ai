import React from 'react';
import type { StageId, StageTiming } from '../types/index.js';

export const STAGE_ORDER: StageId[] = [
  'projectAnalysis', 'investigation', 'rootCause', 'changePlan', 'approval',
  'implementation', 'verification', 'regression', 'report',
];

export const STAGE_LABEL: Record<StageId, string> = {
  projectAnalysis: 'Project Analysis',
  investigation: 'Investigation',
  rootCause: 'Root Cause',
  changePlan: 'Change Plan',
  approval: 'Approval',
  implementation: 'Implementation',
  verification: 'Verification',
  regression: 'Regression',
  report: 'Report',
};

export type StageTone = 'done' | 'active' | 'fail' | 'wait' | 'idle';

export function stageTone(status: string | undefined, isAwaiting: boolean): StageTone {
  if (status === 'completed' || status === 'clean' || status === 'passed') return 'done';
  if (status === 'failed') return 'fail';
  if (status === 'waiting_approval' || status === 'awaiting_approval') return 'wait';
  if (status === 'running') return 'active';
  if (isAwaiting) return 'wait';
  return 'idle';
}

const GLYPH: Record<StageTone, string> = { done: '✓', active: '', fail: '!', wait: '⏸', idle: '' };

interface Props {
  stages: Record<string, StageTiming>;
  activeStage: StageId | null;
  onSelect?: (stage: StageId) => void;
}

/**
 * Always-visible progress rail. Previously the pipeline only existed inside a
 * tab, so there was no indication of position or what was still to come.
 */
export function StageStepper({ stages, activeStage, onSelect }: Props) {
  return (
    <div className="stepper" role="list" aria-label="Investigation progress">
      {STAGE_ORDER.map((id, i) => {
        const s = stages[id];
        const isAwaiting = activeStage === id;
        const tone = stageTone(s?.status, isAwaiting);
        const last = i === STAGE_ORDER.length - 1;
        const done = tone === 'done';
        const label = `${STAGE_LABEL[id]}${id === 'approval' ? ' (you)' : ''}`;

        return (
          <button
            key={id}
            type="button"
            role="listitem"
            onClick={onSelect ? () => onSelect(id) : undefined}
            aria-current={isAwaiting ? 'step' : undefined}
            aria-label={`${label}: ${s?.status?.replace(/_/g, ' ') ?? 'not started'}`}
            className={[
              'step',
              done ? 'step-done' : '',
              tone === 'active' ? 'step-active' : '',
              tone === 'fail' ? 'step-fail' : '',
              tone === 'wait' ? 'step-wait' : '',
              !last && done ? 'step-linked' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="step-dot" aria-hidden="true">{GLYPH[tone]}</span>
            <span className="step-label">{label}</span>
            {s && s.durationMs > 0 && <span className="step-time">{(s.durationMs / 1000).toFixed(1)}s</span>}
          </button>
        );
      })}
    </div>
  );
}
