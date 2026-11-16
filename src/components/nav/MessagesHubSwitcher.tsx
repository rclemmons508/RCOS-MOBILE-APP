import React from 'react';
import { MessageSquare, Mail, Inbox, LayoutList } from 'lucide-react';
import { TabType } from '../../types';
import { haptic } from '../../utils/haptics';
import { hubSwitcherButton, hubSwitcherContainer } from '../ui/cards';

interface MessagesHubSwitcherProps {
  activeTab: TabType;
  onNavigate: (tab: TabType) => void;
}

/**
 * Messages hub switcher — sits above the Inbox / Chat / Email /
 * Requests screens so the views behave as one hub. Old tab ids stay valid
 * view targets. Inbox is first: it is the hub's landing screen.
 * Phone is NOT here anymore: Calls is its own bottom-bar tab.
 * No badge on Chat: the single Operations badge on the bottom nav
 * already counts team unread — the same item is never badged twice.
 */
export const MessagesHubSwitcher: React.FC<MessagesHubSwitcherProps> = ({ activeTab, onNavigate }) => {
  const items: { id: TabType; label: string; icon: any }[] = [
    { id: 'inbox', label: 'Inbox', icon: LayoutList },
    { id: 'team-chat', label: 'Chat', icon: MessageSquare },
    { id: 'gmail', label: 'Email', icon: Mail },
    { id: 'requests', label: 'Requests', icon: Inbox },
  ];

  return (
    <div className={hubSwitcherContainer} role="tablist" aria-label="Messages hub">
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
            className={`min-h-[48px] relative ${hubSwitcherButton(isActive)}`}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
