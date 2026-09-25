import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warn' | 'danger' | 'info' | 'muted';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const VARIANTS: Record<string, { bg: string; fg: string; bd: string; dot: string }> = {
  default: { bg: 'rgba(255,255,255,.04)', fg: '#c3cbdb', bd: 'var(--line)', dot: '#8993a8' },
  success: { bg: 'var(--accent-soft)', fg: 'var(--accent)', bd: 'rgba(183,243,107,.32)', dot: 'var(--accent)' },
  warn: { bg: 'var(--warn-soft)', fg: 'var(--warn)', bd: 'rgba(251,191,36,.32)', dot: 'var(--warn)' },
  danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)', bd: 'rgba(248,113,113,.32)', dot: 'var(--danger)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'rgba(96,165,250,.32)', dot: 'var(--info)' },
  muted: { bg: 'transparent', fg: 'var(--subtle)', bd: 'var(--line)', dot: 'var(--subtle)' },
};

export function Badge({ children, variant = 'default', size = 'sm', dot }: BadgeProps) {
  const v = VARIANTS[variant] ?? VARIANTS.default;
  const pad = size === 'sm' ? '4px 9px' : '6px 12px';
  const fs = size === 'sm' ? 11 : 12;
  return (
    <span
      className="inline-flex items-center"
      style={{
        padding: pad,
        fontSize: fs,
        fontWeight: 600,
        lineHeight: 1.4,
        borderRadius: 999,
        background: v.bg,
        color: v.fg,
        border: `1px solid ${v.bd}`,
        fontFamily: 'var(--mono)',
        whiteSpace: 'nowrap',
        gap: 6,
      }}
    >
      {dot && (
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: v.dot, flex: 'none' }} />
      )}
      {children}
    </span>
  );
}

function variantFor(value: string | undefined, groups: Record<string, BadgeProps['variant']>): BadgeProps['variant'] {
  if (!value) return 'muted';
  return groups[value] ?? 'default';
}

export function severityBadge(s: string | undefined) {
  return (
    <Badge variant={variantFor(s, { critical: 'danger', high: 'danger', medium: 'warn', low: 'info' })} dot>
      {s ?? 'unknown'}
    </Badge>
  );
}

export function statusBadge(s: string | undefined) {
  return (
    <Badge
      variant={variantFor(s, {
        completed: 'success',
        passed: 'success',
        pass: 'success',
        clean: 'success',
        applied: 'success',
        supported: 'success',
        resolved: 'success',
        failed: 'danger',
        fail: 'danger',
        'risk-detected': 'danger',
        partial: 'warn',
        awaiting_approval: 'warn',
        waiting_approval: 'warn',
        running: 'info',
        investigating: 'info',
        implementing: 'info',
        draft: 'muted',
        pending: 'muted',
        possible: 'info',
      })}
      dot
    >
      {(s ?? 'unknown').replace(/_/g, ' ')}
    </Badge>
  );
}
