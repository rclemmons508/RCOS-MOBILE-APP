import React from 'react';
import { MessageSquare, Mail, Phone, Inbox, LayoutList } from 'lucide-react';
import { TabType } from '../../types';
import { haptic } from '../../utils/haptics';

interface MessagesHubSwitcherProps {
  activeTab: TabType;
  onNavigate: (tab: TabType) => void;
}

/**
 * Messages hub switcher — sits above the Inbox / Chat / Email / Phone /
 * Requests screens so the views behave as one hub. Old tab ids stay valid
 * view targets. Inbox is first: it is the hub's landing screen.
 */
export const MessagesHubSwitcher: React.FC<MessagesHubSwitcherProps> = ({ activeTab, onNavigate }) => {
  const items: { id: TabType; label: string; icon: any }[] = [
    { id: 'inbox', label: 'Inbox', icon: LayoutList },
    { id: 'team-chat', label: 'Chat', icon: MessageSquare },
    { id: 'gmail', label: 'Email', icon: Mail },
    { id: 'phone', label: 'Phone', icon: Phone },
    { id: 'requests', label: 'Requests', icon: Inbox },
  ];

  return (
    <div className="flex gap-1 p-1 rounded-2xl bg-zinc-950 border border-zinc-800/80" role="tablist" aria-label="Messages hub">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              haptic.light();
              onNavigate(item.id);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[44px] ${
              isActive
                ? 'bg-lime-500 text-black'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
