import React from 'react';
import { ClipboardCheck, ChevronRight } from 'lucide-react';

interface AppCheckCardProps {
  /** Takes the user straight to the guided app check in Settings. */
  onOpenAppCheck: () => void;
}

/**
 * Dashboard entry point for the guided first-run app check.
 *
 * The check itself is NOT built here: it already lives in Settings
 * (AppCheckPanel, read-only, changes nothing). This card only surfaces
 * it, so a new user can find it from the dashboard instead of hunting
 * through Settings. It is always visible — there is no "seen it, hide
 * it" flag, so the check stays one tap away at any time.
 */
export const AppCheckCard: React.FC<AppCheckCardProps> = ({ onOpenAppCheck }) => (
  <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-4 flex items-center gap-3">
    <div className="p-2 rounded-xl bg-lime-500/10 text-lime-400 border border-lime-500/20 shrink-0">
      <ClipboardCheck className="w-5 h-5" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-xs font-bold text-white">Check my app</div>
      <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
        Run a guided check of each part of the app, in plain words. It changes nothing —
        it only tells you what is working and what needs a look. You can also find it any
        time in Settings.
      </p>
    </div>
    <button
      type="button"
      onClick={onOpenAppCheck}
      className="shrink-0 px-3.5 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-black text-xs font-extrabold flex items-center gap-1 cursor-pointer min-h-[44px]"
    >
      Check my app <ChevronRight className="w-4 h-4" />
    </button>
  </div>
);
