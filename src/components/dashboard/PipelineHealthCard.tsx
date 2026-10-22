import React, { useMemo } from 'react';
import { HeartPulse, ChevronRight, CheckCircle2 } from 'lucide-react';
import { ActionRecord, Client, TabType } from '../../types';
import { computePipelineFlags } from '../../utils/pipelineHealth';

interface PipelineHealthCardProps {
  actions: ActionRecord[];
  clients?: Client[];
  onNavigateTab: (tab: TabType) => void;
}

/**
 * Pipeline Health — quiet problems, surfaced in plain words.
 * Read-only: flags are computed from records already loaded; tapping a
 * flag opens the screen where the owner can act on it.
 */
export const PipelineHealthCard: React.FC<PipelineHealthCardProps> = ({
  actions,
  clients,
  onNavigateTab,
}) => {
  const flags = useMemo(
    () => computePipelineFlags({ actions, clients: clients ?? [] }),
    [actions, clients]
  );

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
          {flags.map((flag) => (
            <button
              key={flag.id}
              type="button"
              onClick={() => onNavigateTab(flag.tab)}
              className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-900 transition-colors cursor-pointer min-h-[44px]"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  flag.severity === 'high' ? 'bg-rose-400' : 'bg-amber-400'
                }`}
              />
              <span className="flex-1 text-xs leading-relaxed text-zinc-200">{flag.text}</span>
              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
