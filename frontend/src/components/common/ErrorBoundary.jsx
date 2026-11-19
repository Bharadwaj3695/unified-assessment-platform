import React from 'react';
import ErrorState from '../ui/ErrorState';
import Button from '../ui/Button';
import { RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error, this.handleReset)
          : this.props.fallback;
      }

      const errorMessage =
        this.state.error?.message ||
        'An unexpected error occurred while rendering this view.';

      return (
        <div className="w-full py-8 px-4 flex flex-col items-center justify-center">
          <div className="w-full max-w-xl">
            <ErrorState
              title={this.props.title || 'Something went wrong'}
              message={errorMessage}
              onRetry={this.handleReset}
            />
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Home}
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                Return to Home
              </Button>
            </div>
            {process.env.NODE_ENV !== 'production' && this.state.errorInfo && (
              <details className="mt-4 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 overflow-auto max-h-48">
                <summary className="cursor-pointer font-semibold text-rose-600 dark:text-rose-400">
                  Developer Error Stack Trace
                </summary>
                <pre className="mt-2 whitespace-pre-wrap">
                  {this.state.error?.stack}
                  {'\n\nComponent Stack:\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
