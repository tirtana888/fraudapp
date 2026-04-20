import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Render crash:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const err = this.state.error;
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#0f172a',
        color: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ maxWidth: 720, width: '100%' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: '#f87171' }}>
            Terjadi error di aplikasi
          </h1>
          <p style={{ marginBottom: 16, color: '#cbd5e1' }}>
            Halaman ini gagal dirender. Detail error ada di bawah — kirimkan ini ke developer
            agar bisa diperbaiki.
          </p>
          <pre style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 16,
            overflow: 'auto',
            fontSize: 13,
            color: '#fca5a5',
            maxHeight: 320,
          }}>
            {err?.name}: {err?.message}
            {'\n\n'}
            {err?.stack}
          </pre>
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleReset}
              style={{
                background: '#D95D00',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Coba lagi
            </button>
            <button
              onClick={this.handleReload}
              style={{
                background: '#334155',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload halaman
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
