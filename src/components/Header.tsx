import React, { useState, useEffect } from 'react';
import { RCLogo } from './RCLogo';
import { Bell, User as UserIcon, MessageSquare, ShieldCheck } from 'lucide-react';
import { TabType, User } from '../types';

interface HeaderProps {
  activeTab: TabType;
  titleOverride?: string;
  unreadCount?: number;
  currentUser?: User | null;
  onOpenNotifications?: () => void;
  onOpenAuth?: () => void;
  onOpenChat?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  titleOverride,
  unreadCount = 0,
  currentUser,
  onOpenNotifications,
  onOpenAuth,
  onOpenChat,
}) => {
  const [time, setTime] = useState<string>('12:00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const mins = now.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const getTitle = () => {
    if (titleOverride) return titleOverride;
    switch (activeTab) {
      case 'dashboard':
        return 'Operations Dashboard';
      case 'phone':
        return 'Voice AI Phone';
      case 'jobs':
        return 'Jobs & Dispatch';
      case 'clients':
        return 'Clients CRM';
      case 'chat':
        return 'AI Ops Chat';
      case 'more':
        return 'RCOS Architecture';
      case 'settings':
        return 'Settings & Rules';
      default:
        return 'RCOS Mobile';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full shrink-0 bg-black/95 backdrop-blur-xl border-b border-zinc-900/80 pl-[max(0.6rem,env(safe-area-inset-left))] pr-[max(0.6rem,env(safe-area-inset-right))] pt-[max(0.45rem,calc(env(safe-area-inset-top)+0.25rem))] pb-2 transition-all">
      {/* Top Bar with Logo, Title, and Action Controls */}
      <div className="flex items-center justify-between gap-1.5 max-w-full">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <RCLogo variant="compact" className="shrink-0" />
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate leading-tight">
              {getTitle()}
            </h1>
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-zinc-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-500 animate-pulse shrink-0" />
              <span className="text-lime-400 font-semibold shrink-0">ONLINE</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400 font-mono truncate">{time}</span>
            </div>
          </div>
        </div>

        {/* Right Header Controls: AI Chat Quick Toggle, Notifications Bell, Operator Profile */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Quick AI Chat Icon */}
          {onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-lime-500/20 text-lime-400 border-lime-500/50'
                  : 'bg-zinc-900/90 text-zinc-400 hover:text-white border-zinc-800'
              }`}
              title="Open AI Operations Chat"
              aria-label="AI Chat"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Notification Center Bell with Unread Badge */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative w-8 h-8 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            aria-label="Open Notifications Center"
            title="Notifications"
          >
            <Bell className="w-3.5 h-3.5 text-zinc-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-lime-500 text-black font-black text-[8px] flex items-center justify-center border border-black">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Auth Profile Button */}
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-8 h-8 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-lime-500/40 flex items-center justify-center transition-all active:scale-95 cursor-pointer p-0.5"
            title={currentUser?.authenticated ? `Authenticated as ${currentUser.fullName}` : 'Login / Register Operator'}
            aria-label="User Profile"
          >
            {currentUser?.authenticated ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.fullName}
                  className="w-full h-full rounded-lg object-cover border border-lime-500/60"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-lime-500 border border-black" />
              </div>
            ) : (
              <div className="w-full h-full rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
