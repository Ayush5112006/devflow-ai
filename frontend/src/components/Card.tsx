import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  flush?: boolean;
}

export function Card({ title, children, className = '', action, flush }: CardProps) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-head">
          <h3 className="panel-title">{title}</h3>
          {action}
        </div>
      )}
      <div className={flush ? 'panel-body-flush' : 'panel-body'}>{children}</div>
    </section>
  );
}
