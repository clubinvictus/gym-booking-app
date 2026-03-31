import { Component, type ErrorInfo, type ReactNode } from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed:', err);
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          background: '#f9f9f9',
          color: '#000',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ 
            maxWidth: '480px', 
            padding: '40px', 
            background: '#fff', 
            border: '4px solid #000',
            boxShadow: '8px 8px 0px #000'
          }}>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '16px', fontWeight: 800 }}>SOMETHING WENT WRONG</h1>
            <p className="text-muted" style={{ marginBottom: '24px', fontSize: '1rem', lineHeight: '1.5' }}>
              The application encountered an unexpected error. This usually happens when data is incomplete or there is a connection issue.
            </p>
            
            <div style={{ textAlign: 'left', background: '#f5f5f5', padding: '12px', border: '2px solid #000', marginBottom: '24px', overflowX: 'auto', fontSize: '0.8rem' }}>
                <code>{this.state.error?.message || 'Unknown Error'}</code>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  onClick={() => window.location.reload()}
                  style={{
                    padding: '14px 24px',
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  RELOAD PAGE
                </button>
                <button 
                  onClick={this.handleLogout}
                  style={{
                    padding: '14px 24px',
                    background: '#fff',
                    color: '#000',
                    border: '2px solid #000',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  LOGOUT & RESET
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
