import React, { createContext, useCallback, useContext, useState } from 'react';

export type ToastLevel = 'info' | 'success' | 'warn' | 'error';

export interface Toast {
  id: string;
  level: ToastLevel;
  title: string;
  message?: string;
  durationMs?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  push(t: Omit<Toast, 'id'>): void;
  dismiss(id: string): void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  push: () => undefined,
  dismiss: () => undefined,
});

let _seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `toast-${++_seq}`;
    setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
    const dur = t.durationMs ?? (t.level === 'error' ? 6000 : 4000);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, dur);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_COLORS: Record<ToastLevel, { bg: string; bd: string; icon: string; iconColor: string }> = {
  info: { bg: 'var(--panel-raised)', bd: 'rgba(96,165,250,.32)', icon: 'ℹ', iconColor: 'var(--info)' },
  success: { bg: 'var(--panel-raised)', bd: 'rgba(183,243,107,.32)', icon: '✓', iconColor: 'var(--accent)' },
  warn: { bg: 'var(--panel-raised)', bd: 'rgba(251,191,36,.32)', icon: '⚠', iconColor: 'var(--warn)' },
  error: { bg: 'var(--panel-raised)', bd: 'rgba(248,113,113,.32)', icon: '✕', iconColor: 'var(--danger)' },
};

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss(id: string): void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 380,
        minWidth: 280,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const c = TOAST_COLORS[t.level];
        return (
          <div
            key={t.id}
            role="alert"
            style={{
              pointerEvents: 'all',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              background: c.bg,
              border: `1px solid ${c.bd}`,
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,.4)',
              animation: 'slideInToast 0.25s ease-out',
            }}
          >
            <span style={{ fontSize: 15, color: c.iconColor, flex: 'none', lineHeight: 1.4 }} aria-hidden="true">
              {c.icon}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4 }}>
                {t.title}
              </p>
              {t.message && (
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {t.message}
                </p>
              )}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--subtle)',
                fontSize: 14,
                cursor: 'pointer',
                padding: '0 2px',
                flex: 'none',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
