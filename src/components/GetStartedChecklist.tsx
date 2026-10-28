import React, { useState } from 'react';
import { Check, ChevronRight, ListChecks, X } from 'lucide-react';
import type { TabType, User } from '../types';
import { dashboardCard, sectionLabel } from './ui/cards';
import { haptic } from '../utils/haptics';
import {
  dismissChecklist,
  GET_STARTED_ITEMS,
  getChecklistDone,
  isChecklistDismissed,
  markChecklistItemDone,
} from '../utils/getStartedChecklist';

/**
 * Dashboard "Get started" checklist — the replacement for the old
 * overlay App Guide tour. It renders inline on the Dashboard, never
 * as a full-screen dimmed card, so the user always sees the real
 * screen. Tapping an item navigates to that real screen and ticks
 * the item off; Dismiss hides the whole card, and Settings can
 * bring it back any time (dismissing is never permanent).
 *
 * The parent renders this only when the checklist is not dismissed;
 * this component owns the tick-off + dismiss writes.
 */
interface GetStartedChecklistProps {
  currentUser: User | null;
  businessId: string;
  onNavigateTab: (tab: TabType) => void;
}

export const GetStartedChecklist: React.FC<GetStartedChecklistProps> = ({
  currentUser,
  businessId,
  onNavigateTab,
}) => {
  const business = businessId ? { id: businessId } : null;
  const [done, setDone] = useState<string[]>(() => getChecklistDone(currentUser, business));
  const [dismissed, setDismissed] = useState<boolean>(() => isChecklistDismissed(currentUser, business));

  if (dismissed) return null;

  const allDone = GET_STARTED_ITEMS.every((item) => done.includes(item.id));

  const handleItemTap = (id: string, tab: TabType) => {
    haptic.light();
    markChecklistItemDone(currentUser, business, id);
    setDone((prev) => (prev.includes(id) ? prev : [...prev, id]));
    onNavigateTab(tab);
  };

  const handleDismiss = () => {
    haptic.light();
    dismissChecklist(currentUser, business);
    setDismissed(true);
  };

  return (
    <div className={`p-3.5 ${dashboardCard} space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-lime-400 shrink-0" />
          <span className={sectionLabel}>Get started</span>
        </span>
        <button
          type="button"
          aria-label="Dismiss the Get started checklist"
          onClick={handleDismiss}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {allDone ? (
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Check className="w-4 h-4 text-lime-400 shrink-0" />
          <span>You're all set — you've seen every part of the app. You can hide this card with the X above.</span>
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-400">
            Tap each item to visit that part of the app — it ticks off when you do. {done.length} of {GET_STARTED_ITEMS.length} done.
          </p>
          <div className="space-y-1.5">
            {GET_STARTED_ITEMS.map((item) => {
              const isDone = done.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemTap(item.id, item.tab)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-lime-500/40 text-left transition cursor-pointer min-h-[44px]"
                >
                  <span
                    className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
                      isDone ? 'bg-lime-500 border-lime-500' : 'border-zinc-700'
                    }`}
                  >
                    {isDone && <Check className="w-4 h-4 text-black" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-bold truncate ${isDone ? 'text-zinc-500 line-through' : 'text-white'}`}>
                      {item.title}
                    </span>
                    <span className="block text-[11px] text-zinc-400 truncate">{item.where}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
