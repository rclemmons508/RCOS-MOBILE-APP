import React from 'react';
import { 
  Gauge, 
  Briefcase, 
  Bot,
  MessagesSquare,
  Ellipsis
} from 'lucide-react';
import { TabType, User } from '../types';
import { haptic } from '../utils/haptics';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  currentUser?: User | null;
  /** One Inbox badge on Messages: AI Team unread + new requests +
   *  alerts unread + team unread (the team count is folded into
   *  messagesBadge by App.tsx). 0 hides it. */
  messagesBadge?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  messagesBadge = 0
}) => {
  const tabs: { id: TabType; label: string; icon: any; activeWhen: TabType[] }[] = [
    { id: 'dashboard', label: 'Home', icon: Gauge, activeWhen: ['dashboard'] },
    { id: 'jobs', label: 'Jobs / $', icon: Briefcase, activeWhen: ['jobs', 'approvals', 'clients'] },
    { id: 'team', label: 'AI Team', icon: Bot, activeWhen: ['team'] },
    { id: 'inbox', label: 'Messages', icon: MessagesSquare, activeWhen: ['inbox', 'team-chat', 'gmail', 'phone', 'requests'] },
    { id: 'more', label: 'More', icon: Ellipsis, activeWhen: ['more', 'settings'] },
  ];

  return (
    <footer className="shrink-0 z-40 w-full bg-black/95 backdrop-blur-xl border-t border-zinc-800/80 shadow-2xl transition-all select-none">
      <div className="w-full px-1 pt-1 pb-[max(0.45rem,env(safe-area-inset-bottom))]">
        <nav className="flex items-center justify-between gap-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.activeWhen.includes(activeTab);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  haptic.light();
                  setActiveTab(tab.id);
                }}
                className={`relative flex flex-col items-center justify-center flex-1 min-w-0 py-1 px-0.5 rounded-xl transition-all active:scale-95 cursor-pointer min-h-[44px] ${
                  isActive
                    ? 'text-lime-400 font-bold bg-lime-500/10 border border-lime-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
                }`}
                aria-label={tab.label}
              >
                <div className="relative flex items-center justify-center">
                  <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform ${isActive ? 'scale-110 text-lime-400' : ''}`} />
                  {isActive && (
                    <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-lime-400 animate-pulse" />
                  )}
                  {tab.id === 'inbox' && messagesBadge > 0 && (
                    <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border border-black">
                      {messagesBadge > 99 ? '99+' : messagesBadge}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] sm:text-[10px] tracking-tight mt-0.5 truncate max-w-full font-medium ${isActive ? 'text-lime-300 font-bold' : 'text-zinc-400'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </footer>
  );
};
