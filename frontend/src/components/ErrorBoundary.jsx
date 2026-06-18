import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console or telemetry service
    console.error("ErrorBoundary caught an uncaught exception:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    } catch (e) {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 selection:bg-amber-500/30 selection:text-amber-200">
          {/* Decorative absolute ambient background glows */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-600/5 rounded-full blur-[140px] pointer-events-none animate-pulse delay-75"></div>

          <div className="w-full max-w-xl bg-stone-900/60 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-stone-100 z-10">
            {/* Header/Banner Accent */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-yellow-600 to-amber-400"></div>

            {/* Warning Icon & Title */}
            <div className="flex flex-col items-center text-center space-y-4 mb-8 mt-2">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl animate-bounce">
                ⚠️
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-amber-100">
                  Application Exception Detected
                </h1>
                <p className="text-xs sm:text-sm text-stone-400 max-w-sm mt-2">
                  A fatal runtime error occurred. We have securely intercepted it to prevent a blank display.
                </p>
              </div>
            </div>

            {/* Error Message and Collapsible Details */}
            <div className="bg-stone-950/80 border border-amber-500/10 rounded-2xl p-4 sm:p-5 mb-8 space-y-3 font-mono">
              <div className="text-amber-400 font-bold text-xs uppercase tracking-wider">
                Error Message:
              </div>
              <div className="text-sm text-stone-250 break-words leading-relaxed">
                {this.state.error?.toString() || 'Unknown runtime error.'}
              </div>

              {this.state.errorInfo?.componentStack && (
                <details className="group mt-2">
                  <summary className="text-[11px] text-amber-300/60 hover:text-amber-400 cursor-pointer outline-none select-none transition-colors py-1 flex items-center gap-1.5 font-sans font-bold">
                    <span className="inline-block transition-transform duration-200 group-open:rotate-90">▶</span>
                    Show Technical Details
                  </summary>
                  <pre className="text-[10px] text-stone-400 overflow-x-auto mt-2 max-h-48 p-3 bg-stone-900/90 rounded-lg border border-stone-800 leading-normal scrollbar-thin scrollbar-thumb-stone-800">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            {/* Quick Interactive Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 hover:from-amber-600 hover:to-yellow-700 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🔄</span> Reload Application
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 px-5 py-3 bg-stone-800 hover:bg-stone-750 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 font-bold text-sm rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🧹</span> Reset Cache & App
              </button>
            </div>

            {/* Brand/Footer */}
            <div className="mt-8 text-center text-[10px] tracking-wide text-stone-500 uppercase font-semibold">
              🔒 INK SECURE SHELL SYSTEM
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
