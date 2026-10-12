import React, { useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface DiagCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

interface ScanResult {
  overall: 'pass' | 'warn' | 'fail';
  score: number;
  checks: DiagCheck[];
  scannedAt: string;
}

/**
 * Diagnostics & Optimization panel — per the RCOS Master Dashboard spec.
 * System status checks with PASS/WARN/FAIL indicators and a readiness score.
 */
export const DiagnosticsPanel: React.FC = () => {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const data = await apiFetch<ScanResult>('/api/diagnostics/scan');
      setResult(data);
    } catch (e: any) {
      setError(e?.message || 'Scan failed. Is the server reachable?');
    } finally {
      setScanning(false);
    }
  };

  const statusIcon = (s: string) => {
    if (s === 'pass') return <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />;
    if (s === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
    return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  };

  const statusBadge = (s: string) => {
    const styles =
      s === 'pass'
        ? 'bg-lime-500/15 text-lime-400 border-lime-500/30'
        : s === 'warn'
          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          : 'bg-red-500/15 text-red-400 border-red-500/30';
    return (
      <span className={`text-[9px] px-2 py-0.5 rounded-full border font-mono font-bold uppercase ${styles}`}>
        {s}
      </span>
    );
  };

  const overallColor =
    result?.overall === 'pass' ? 'text-lime-400' : result?.overall === 'warn' ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-lime-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Diagnostics</h3>
        </div>
        <button
          type="button"
          onClick={runScan}
          disabled={scanning}
          className="px-3 py-1.5 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:opacity-60 text-black text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
          <span>{scanning ? 'Scanning…' : result ? 'Re-scan' : 'Run System Scan'}</span>
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{error}</p>
      )}

      {result && (
        <>
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 ${overallColor}`} />
              <div>
                <div className="text-xs font-bold text-white">Readiness Score</div>
                <div className="text-[10px] text-zinc-400">
                  {new Date(result.scannedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className={`text-2xl font-mono font-bold ${overallColor}`}>{result.score}%</div>
          </div>

          <div className="space-y-2">
            {result.checks.map((check) => (
              <div
                key={check.id}
                className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-2.5"
              >
                {statusIcon(check.status)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-white truncate">{check.label}</div>
                    {statusBadge(check.status)}
                  </div>
                  <div className="text-[10.5px] text-zinc-400 mt-0.5">{check.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!result && !error && (
        <p className="text-[11px] text-zinc-500 text-center py-2">
          Run a scan to check system health, configuration, and readiness.
        </p>
      )}
    </div>
  );
};
