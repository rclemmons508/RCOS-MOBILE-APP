import React, { useMemo, useState } from 'react';
import { HeartPulse, ChevronRight, CheckCircle2, Briefcase, DollarSign } from 'lucide-react';
import { ActionRecord, Client, TabType } from '../../types';
import { computePipelineFlags } from '../../utils/pipelineHealth';

interface PipelineHealthCardProps {
  actions: ActionRecord[];
  clients?: Client[];
  onNavigateTab: (tab: TabType) => void;
  /** Same handler the Approvals screen uses — schedules a job from an approved quote. */
  onScheduleJob?: (action: ActionRecord) => Promise<void> | void;
  /** Same handler the Approvals screen uses — records an approved invoice as paid. */
  onMarkPaid?: (action: ActionRecord) => Promise<void> | void;
}

/**
 * Pipeline Health — quiet problems, surfaced in plain words.
 * Flags that have a safe one-tap action act right here, using the exact
 * same handlers as the Approvals screen (no new rules, no new endpoints).
 * Tapping a flag's text still opens the screen where it lives, as before.
 * Quiet-customer flags have no safe one-tap action, so they stay
 * navigate-only on purpose.
 */
export const PipelineHealthCard: React.FC<PipelineHealthCardProps> = ({
  actions,
  clients,
  onNavigateTab,
  onScheduleJob,
  onMarkPaid,
}) => {
  const flags = useMemo(
    () => computePipelineFlags({ actions, clients: clients ?? [] }),
    [actions, clients]
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const runInline = async (flagId: string, run: () => Promise<void> | void) => {
    setBusyId(flagId);
    try {
      await run();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
          <HeartPulse className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-bold text-white">Pipeline health</h3>
        {flags.length > 0 && (
          <span className="text-[10px] font-mono text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
            {flags.length} to look at
          </span>
        )}
      </div>

      {flags.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
          <span>All clear — nothing is stalled, unpaid too long, or going quiet.</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {flags.map((flag) => {
            const action = flag.actionId
              ? actions.find((a) => a.id === flag.actionId)
              : undefined;
            const busy = busyId === flag.id;
            return (
              <div
                key={flag.id}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 min-h-[44px]"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    flag.severity === 'high' ? 'bg-rose-400' : 'bg-amber-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => onNavigateTab(flag.tab)}
                  className="flex-1 flex items-center gap-2 text-left cursor-pointer min-w-0"
                >
                  <span className="flex-1 text-xs leading-relaxed text-zinc-200">{flag.text}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                </button>
                {flag.kind === 'stalled_quote' && action && onScheduleJob && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runInline(flag.id, () => onScheduleJob(action))}
                    className="shrink-0 px-3 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    {busy ? 'Working…' : 'Schedule job'}
                  </button>
                )}
                {flag.kind === 'unpaid_invoice' && action && onMarkPaid && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runInline(flag.id, () => onMarkPaid(action))}
                    className="shrink-0 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    {busy ? 'Working…' : 'Mark paid'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
