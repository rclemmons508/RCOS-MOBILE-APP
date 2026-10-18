import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw, ClipboardCheck } from 'lucide-react';
import { runAppCheck, type AppCheckResult, type AppCheckVerdict } from '../../utils/appCheck';
import type { AutomationTask, BusinessAccount, User } from '../../types';

interface AppCheckPanelProps {
  currentUser?: User | null;
  businessId?: string;
  business?: BusinessAccount | null;
  automationTasks: AutomationTask[];
  automationMasterOn: boolean;
}

const VERDICT_LABEL: Record<AppCheckVerdict, string> = {
  working: 'Working',
  'wrong-step': 'Wrong step',
  'system-error': 'System error',
  'not-yet': 'Not yet',
};

const verdictIcon = (verdict: AppCheckVerdict) => {
  if (verdict === 'working') return <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />;
  if (verdict === 'wrong-step') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  if (verdict === 'system-error') return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <Clock className="w-4 h-4 text-zinc-400 shrink-0" />;
};

const verdictBadge = (verdict: AppCheckVerdict) => {
  const styles =
    verdict === 'working'
      ? 'bg-lime-500/15 text-lime-400 border-lime-500/30'
      : verdict === 'wrong-step'
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        : verdict === 'system-error'
          ? 'bg-red-500/15 text-red-400 border-red-500/30'
          : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-full border font-mono font-bold uppercase ${styles}`}>
      {VERDICT_LABEL[verdict]}
    </span>
  );
};

/**
 * Guided first-run app check. Lives in Settings only.
 * Runs read-only checks over each core flow in order and shows one
 * plain-words verdict per flow. Running it changes nothing and
 * deletes nothing.
 */
export const AppCheckPanel: React.FC<AppCheckPanelProps> = ({
  currentUser,
  businessId,
  business,
  automationTasks,
  automationMasterOn,
}) => {
  const [results, setResults] = useState<AppCheckResult[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setChecking(true);
    setError(null);
    try {
      const next = await runAppCheck({
        currentUser,
        businessId,
        business,
        automationTasks,
        automationMasterOn,
      });
      setResults(next);
      setCheckedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e?.message || 'The check could not run. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const counts = results
    ? {
        working: results.filter((r) => r.verdict === 'working').length,
        wrongStep: results.filter((r) => r.verdict === 'wrong-step').length,
        systemError: results.filter((r) => r.verdict === 'system-error').length,
        notYet: results.filter((r) => r.verdict === 'not-yet').length,
      }
    : null;

  const overallLine = counts
    ? counts.systemError > 0
      ? 'Some parts need fixing. Start with the first system error below.'
      : counts.wrongStep > 0
        ? 'Follow the steps under each wrong step below.'
        : counts.notYet > 0
          ? 'Finish setting up your company, then run the check again.'
          : 'Everything looks good.'
    : null;

  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-lime-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">App Check</h3>
        </div>
        <button
          type="button"
          onClick={runCheck}
          disabled={checking}
          className="px-3 py-1.5 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:opacity-60 text-black text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Checking…' : results ? 'Run again' : 'Run app check'}</span>
        </button>
      </div>

      {!results && !error && (
        <p className="text-[11px] text-zinc-400">
          Checks each part of the app in order and tells you what is working, what step to fix, and what is a system
          error. Running it changes nothing and deletes nothing.
        </p>
      )}

      {error && (
        <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{error}</p>
      )}

      {results && counts && (
        <>
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div className="text-xs font-bold text-white">{overallLine}</div>
            <div className="text-[10.5px] text-zinc-400 mt-1">
              {counts.working} working · {counts.wrongStep} wrong step · {counts.systemError} system error ·{' '}
              {counts.notYet} not yet
              {checkedAt ? ` · Checked at ${checkedAt}` : ''}
            </div>
          </div>

          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={result.id}
                className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-2.5"
              >
                {verdictIcon(result.verdict)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-white truncate">
                      {index + 1}. {result.title}
                    </div>
                    {verdictBadge(result.verdict)}
                  </div>
                  <div className="text-[10.5px] text-zinc-400 mt-0.5">{result.detail}</div>
                  {result.fix.length > 0 && (
                    <ol className="list-decimal list-inside mt-1.5 space-y-0.5">
                      {result.fix.map((step, stepIndex) => (
                        <li key={stepIndex} className="text-[10.5px] text-zinc-300">
                          {step}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
