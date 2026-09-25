import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { RCLogo } from './RCLogo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090b0e] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#0e1118] border border-[#21293a] rounded-3xl p-8 space-y-5 shadow-2xl">
            <RCLogo variant="compact" className="justify-center" />
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Something interrupted the dashboard</h2>
              <p className="text-xs text-slate-400">
                {this.state.error?.message || 'An unexpected rendering error occurred.'}
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-3 rounded-xl bg-[#00ff66] hover:bg-[#10e560] text-[#090b0e] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-lg shadow-[#00ff66]/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload RCOS Operations</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
