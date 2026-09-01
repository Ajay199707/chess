import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: '#fee2e2', color: '#991b1b', height: '100vh', overflow: 'auto' }}>
          <h2>Oops! Something went wrong in the UI.</h2>
          <p>Please take a screenshot of this error message and send it to me:</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', background: '#f87171', padding: '1rem', borderRadius: '8px', color: 'black' }}>
            <summary style={{fontWeight: 'bold', cursor: 'pointer'}}>Click to view technical details</summary>
            {this.state.error && this.state.error.toString()}
            <br /><br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#991b1b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Reload Game
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
