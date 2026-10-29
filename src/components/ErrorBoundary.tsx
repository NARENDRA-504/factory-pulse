import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ZIRO Manufacturing Platform - Runtime Caught Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-white text-slate-900 font-sans">
          <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 shrink-0">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200 uppercase tracking-wider">
                    SYSTEM RECOVERABLE FAULT
                  </span>
                  <span className="text-xs font-mono text-slate-500">ISO-13849 Safety Guard</span>
                </div>
                <h2 className="text-lg font-bold font-display text-slate-900">
                  {this.props.fallbackTitle || 'Component Rendering Interrupted'}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  A client-side runtime exception occurred during dashboard view rendering. The platform safety boundary caught the fault to prevent system lockup.
                </p>
              </div>
            </div>

            {/* Error Technical Diagnostics */}
            <div className="p-4 bg-slate-100/90 border border-slate-200 rounded-xl font-mono text-xs space-y-2">
              <div className="flex items-center gap-2 text-rose-700 font-semibold">
                <Terminal className="w-4 h-4" />
                <span>{this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unknown runtime error'}</span>
              </div>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[10px] text-slate-600 max-h-36 overflow-y-auto whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-200">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            {/* Recovery Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-900 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors font-mono"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Render
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg border border-slate-200 transition-colors font-mono"
                >
                  Reload Page
                </button>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                ZIRO Incident Platform v2.4
              </span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
