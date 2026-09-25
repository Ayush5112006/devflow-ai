import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warn' | 'danger' | 'info' | 'muted';
  size?: 'sm' | 'md';
}

const VARIANTS: Record<string, string> = {
  default: 'bg-slate-700 text-slate-200',
  success: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  warn: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  danger: 'bg-red-500/20 text-red-300 border border-red-500/30',
  info: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  muted: 'bg-slate-800 text-slate-400',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span className={`inline-flex items-center rounded font-mono font-medium ${sizeClass} ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}

export function severityBadge(s: string | undefined) {
  const v = s === 'critical' || s === 'high' ? 'danger'
    : s === 'medium' ? 'warn'
    : s === 'low' ? 'info'
    : 'muted';
  return <Badge variant={v}>{s ?? '—'}</Badge>;
}

export function statusBadge(s: string | undefined) {
  const v = s === 'completed' || s === 'passed' || s === 'clean' ? 'success'
    : s === 'failed' || s === 'risk-detected' ? 'danger'
    : s === 'running' || s === 'investigating' ? 'info'
    : s === 'awaiting_approval' ? 'warn'
    : 'muted';
  return <Badge variant={v}>{s ?? '—'}</Badge>;
}
