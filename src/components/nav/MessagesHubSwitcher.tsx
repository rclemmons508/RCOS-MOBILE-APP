import React from 'react';
import { MessageSquare, Mail, Phone, Inbox, LayoutList } from 'lucide-react';
import { TabType } from '../../types';
import { haptic } from '../../utils/haptics';
import { hubSwitcherButton, hubSwitcherContainer } from '../ui/cards';

interface MessagesHubSwitcherProps {
  activeTab: TabType;
  onNavigate: (tab: TabType) => void;
  /** Unread Team Chat messages from other people; badge on Chat. */
  unreadTeamCount?: number;
}

/**
 * Messages hub switcher — sits above the Inbox / Chat / Email / Phone /
 * Requests screens so the views behave as one hub. Old tab ids stay valid
 * view targets. Inbox is first: it is the hub's landing screen.
 */
export const MessagesHubSwitcher: React.FC<MessagesHubSwitcherProps> = ({ activeTab, onNavigate, unreadTeamCount = 0 }) => {
  const items: { id: TabType; label: string; icon: any }[] = [
    { id: 'inbox', label: 'Inbox', icon: LayoutList },
    { id: 'team-chat', label: 'Chat', icon: MessageSquare },
    { id: 'gmail', label: 'Email', icon: Mail },
    { id: 'phone', label: 'Phone', icon: Phone },
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
            className={`relative ${hubSwitcherButton(isActive)}`}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
            {item.id === 'team-chat' && unreadTeamCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadTeamCount > 99 ? '99+' : unreadTeamCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
