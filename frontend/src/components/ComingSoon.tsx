import React from 'react';

interface ComingSoonProps {
  /** Short feature name displayed as the heading */
  feature: string;
  /** One-sentence description of what this feature will do */
  description?: string;
  /** Why the feature matters to the user */
  benefit?: string;
  /** What integration / work is planned */
  planned?: string;
  /** Optional className override */
  className?: string;
}

/**
 * Shared Coming Soon placeholder.
 *
 * Use this for any feature/integration that is not yet implemented.
 * Never use fake data or simulate functionality — show this instead.
 */
export function ComingSoon({ feature, description, benefit, planned, className }: ComingSoonProps) {
  return (
    <div className={`coming-soon-box ${className ?? ''}`} role="status" aria-label={`${feature} — Coming Soon`}>
      <span className="coming-soon-label">🔜 Coming Soon</span>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{feature}</p>
      {description && (
        <p style={{ margin: 0, maxWidth: '52ch', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{description}</p>
      )}
      {benefit && (
        <div style={{ padding: '8px 14px', background: 'var(--panel-sunken)', borderRadius: 8, border: '1px solid var(--line)', maxWidth: '52ch', width: '100%' }}>
          <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Why it matters</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{benefit}</p>
        </div>
      )}
      {planned && (
        <div style={{ padding: '8px 14px', background: 'rgba(56,189,248,.06)', borderRadius: 8, border: '1px solid rgba(56,189,248,.15)', maxWidth: '52ch', width: '100%' }}>
          <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Planned</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{planned}</p>
        </div>
      )}
    </div>
  );
}
