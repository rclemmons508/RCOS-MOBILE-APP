import React from 'react';
import {
  Home,
  ClipboardList,
  Users,
  Ellipsis,
  Plus
} from 'lucide-react';
import { TabType, User } from '../types';
import { haptic } from '../utils/haptics';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  currentUser?: User | null;
  /** One Inbox badge: AI Team unread + new requests +
   *  alerts unread + team unread (the team count is folded into
   *  messagesBadge by App.tsx). 0 hides it. Shown on Operations,
   *  which is the inbox destination in the sidebar design. */
  messagesBadge?: number;
  /** Opens the quick-action sheet (New Job, Add Customer, Ask AI). */
  onOpenQuickActions: () => void;
}

/**
 * Bottom bar from the sidebar design: Home · Operations · + · Customers · More.
 *
 * Calls lives in the sidebar drawer in this design (Ryan's pick, Nov 16),
 * so the bar carries Operations — the inbox destination — instead. Jobs
 * is reached from the drawer's Schedule row and from Home; AI Team and
 * AI Chat live under More. Labels are 12px minimum and every button is
 * 48dp tall so the bar is usable with gloves on.
 */
export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  messagesBadge = 0,
  onOpenQuickActions,
}) => {
  const tabs: { id: TabType; label: string; icon: any; activeWhen: TabType[] }[] = [
    { id: 'dashboard', label: 'Home', icon: Home, activeWhen: ['dashboard'] },
    { id: 'inbox', label: 'Operations', icon: ClipboardList, activeWhen: ['inbox', 'team-chat', 'gmail', 'requests'] },
    { id: 'clients', label: 'Customers', icon: Users, activeWhen: ['clients'] },
    { id: 'more', label: 'More', icon: Ellipsis, activeWhen: ['more', 'settings', 'team', 'chat', 'reports', 'assistant'] },
  ];

  const navButton = (tab: { id: TabType; label: string; icon: any; activeWhen: TabType[] }) => {
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
        className={`relative flex flex-col items-center justify-center flex-1 min-w-0 py-1 px-0.5 rounded-xl transition-all active:scale-95 cursor-pointer min-h-[48px] ${
          isActive
            ? 'text-[#22ec72] font-bold bg-[#22ec72]/10 border border-[#22ec72]/30'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#0c1211]'
        }`}
        aria-label={
          tab.id === 'inbox' && messagesBadge > 0
            ? `${tab.label}, ${messagesBadge} unread`
            : tab.label
        }
        aria-current={isActive ? 'page' : undefined}
      >
        <div className="relative flex items-center justify-center">
          <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-[#22ec72]' : ''}`} />
          {isActive && (
            <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#22ec72] animate-pulse" />
          )}
          {tab.id === 'inbox' && messagesBadge > 0 && (
            <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border border-black">
              {messagesBadge > 99 ? '99+' : messagesBadge}
            </span>
          )}
        </div>
        <span className={`text-xs tracking-tight mt-0.5 truncate max-w-full font-medium ${isActive ? 'text-[#22ec72] font-bold' : 'text-zinc-400'}`}>
          {tab.label}
        </span>
      </button>
    );
  };

  return (
    <footer className="shrink-0 z-40 w-full bg-[#05090a]/95 backdrop-blur-xl border-t border-[#1d2b26] shadow-2xl transition-all select-none">
      <div className="w-full px-1 pt-1 pb-[max(0.45rem,env(safe-area-inset-bottom))]">
        <nav aria-label="Main navigation" className="flex items-center justify-between gap-0.5">
          {navButton(tabs[0])}
          {navButton(tabs[1])}
          {/* Center + : quick actions. A real sheet, never a dead button. */}
          <div className="flex-1 flex items-center justify-center min-w-0">
            <button
              type="button"
              onClick={() => {
                haptic.medium();
                onOpenQuickActions();
              }}
              className="w-14 h-14 -mt-6 rounded-full bg-[#22ec72] text-black shadow-lg shadow-[#22ec72]/30 flex items-center justify-center transition active:scale-95 cursor-pointer border-4 border-[#05090a]"
              aria-label="Quick actions"
            >
              <Plus className="w-7 h-7" strokeWidth={2.5} />
            </button>
          </div>
          {navButton(tabs[2])}
          {navButton(tabs[3])}
        </nav>
      </div>
    </footer>
  );
};
