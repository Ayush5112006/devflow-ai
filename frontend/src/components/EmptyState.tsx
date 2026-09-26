import React from 'react';

interface EmptyStateProps {
  /** Icon — emoji or text character */
  icon?: string;
  /** Primary message */
  title: string;
  /** Supporting text */
  text?: string;
  /** Optional call-to-action */
  action?: React.ReactNode;
  /** Optional className override */
  className?: string;
}

/**
 * Shared empty-state component.
 *
 * Use for every page/section that has no data yet.
 * Always provide a useful `text` that tells the user what to do.
 */
export function EmptyState({ icon, title, text, action, className }: EmptyStateProps) {
  return (
    <div className={`empty ${className ?? ''}`} role="status">
      {icon && <span className="empty-icon" aria-hidden="true">{icon}</span>}
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
