import React from 'react';

interface State {
  error: Error | null;
}

/** Keeps one broken investigation from blanking the whole app. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ui] unhandled render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-shell">
          <main className="app-main">
            <div className="empty">
              <p className="empty-title">Something broke while rendering this page</p>
              <p className="empty-text mono">{this.state.error.message}</p>
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: 6 }}
                onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              >
                Reload
              </button>
            </div>
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}
