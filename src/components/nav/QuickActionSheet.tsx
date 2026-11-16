import React from 'react';
import { Briefcase, UserPlus, MessageSquare, X, ChevronRight } from 'lucide-react';
import { haptic } from '../../utils/haptics';

interface QuickActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNewJob: () => void;
  onAddCustomer: () => void;
  onAskAI: () => void;
}

/**
 * Quick-action sheet behind the bottom bar's center + button.
 * Only actions with a real handler appear here: New Job opens the Jobs
 * tab's real create form, Add Customer opens the Clients tab's real
 * add form, Ask AI opens the AI chat. An action with no handler is
 * left out entirely — never shown as a dead button.
 */
export const QuickActionSheet: React.FC<QuickActionSheetProps> = ({
  isOpen,
  onClose,
  onNewJob,
  onAddCustomer,
  onAskAI,
}) => {
  if (!isOpen) return null;

  const actions: { label: string; subtitle: string; icon: any; run: () => void }[] = [
    { label: 'New Job', subtitle: 'Create a job for a customer', icon: Briefcase, run: onNewJob },
    { label: 'Add Customer', subtitle: 'Add someone to your client list', icon: UserPlus, run: onAddCustomer },
    { label: 'Ask AI', subtitle: 'Talk to your AI team', icon: MessageSquare, run: onAskAI },
  ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Quick actions">
      <button
        type="button"
        aria-label="Close quick actions"
        onClick={onClose}
        className="min-h-[48px] absolute inset-0 w-full h-full bg-black/70 cursor-pointer"
      />
      <div className="absolute inset-x-0 bottom-0 bg-[#05090a] border-t border-[#1d2b26] rounded-t-3xl px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-extrabold text-white px-1">Quick actions</span>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onClose();
            }}
            className="min-h-[48px] w-10 h-10 rounded-xl bg-[#0c1211] border border-[#1d2b26] text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Close quick actions"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  haptic.light();
                  action.run();
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-[#0c1211] border border-[#1d2b26] hover:border-[#22ec72]/40 transition text-left cursor-pointer min-h-[56px]"
              >
                <span className="p-2.5 rounded-xl bg-[#22ec72]/15 text-[#22ec72] shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{action.label}</span>
                  <span className="block text-xs text-zinc-400 truncate">{action.subtitle}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
