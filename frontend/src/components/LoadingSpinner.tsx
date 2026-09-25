import React from 'react';

export function LoadingSpinner({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
