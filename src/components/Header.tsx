import React, { useState, useEffect } from 'react';
import { RCLogo } from './RCLogo';
import { Bell, User as UserIcon, MessageSquare, ShieldCheck, Mail, Fingerprint, Lock, Inbox, Menu } from 'lucide-react';
import { TabType, User } from '../types';
import { useBiometrics } from '../context/BiometricContext';

interface HeaderProps {
  activeTab: TabType;
  titleOverride?: string;
  currentUser?: User | null;
  onOpenNotifications?: () => void;
  onOpenInbox?: () => void;
  onOpenAuth?: () => void;
  onOpenChat?: () => void;
  onOpenGmail?: () => void;
  /** Opens the sidebar drawer (top-left hamburger). */
  onOpenDrawer?: () => void;
  /** Real server reachability (null = still checking). Drives the Online/Offline badge — never hardcoded. */
  serverOnline?: boolean | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  titleOverride,
  currentUser,
  onOpenNotifications,
  onOpenInbox,
  onOpenAuth,
  onOpenChat,
  onOpenGmail,
  onOpenDrawer,
  serverOnline = null,
}) => {
  const [time, setTime] = useState<string>('12:00');
  const { isBiometricEnabled, lockDashboard, biometryLabel } = useBiometrics();

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

  // A broken avatar URL used to render a broken-image icon. Track the
  // failure and show the icon tile instead; reset when the URL changes.
  const [avatarBroken, setAvatarBroken] = useState(false);
  useEffect(() => {
    setAvatarBroken(false);
  }, [currentUser?.avatar]);

  const getTitle = () => {
    if (titleOverride) return titleOverride;
    switch (activeTab) {
      case 'dashboard':
        return 'Home';
      case 'phone':
        return 'Calls';
      case 'gmail':
        return 'Email';
      case 'jobs':
        return 'Jobs';
      case 'clients':
        return 'Clients';
      case 'chat':
        return 'AI Chat';
      case 'settings':
        return 'Settings';
      case 'team':
        return 'AI Team';
      case 'approvals':
        return 'Review';
      case 'team-chat':
        return 'Team Chat';
      case 'more':
        return 'More';
      case 'requests':
        return 'Customer Requests';
      default:
        return 'RCOS Mobile';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full shrink-0 bg-black/95 backdrop-blur-xl border-b border-zinc-900/80 pl-[max(0.6rem,env(safe-area-inset-left))] pr-[max(0.6rem,env(safe-area-inset-right))] pt-[max(0.45rem,calc(env(safe-area-inset-top)+0.25rem))] pb-2 transition-all">
      {/* Top Bar with Logo, Title, and Action Controls */}
      <div className="flex items-center justify-between gap-1.5 max-w-full overflow-hidden">
        {/* Left: Hamburger (sidebar drawer), Brand Logo & Title */}
        {onOpenDrawer && (
          <button
            type="button"
            onClick={onOpenDrawer}
            className="min-h-[48px] min-w-[48px] w-8 h-8 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white hover:border-[#22ec72]/50 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
            title="Open menu"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <RCLogo variant="compact" showText={false} className="shrink-0" />
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate leading-tight">
              {getTitle()}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${serverOnline === true ? 'bg-[#22ec72] animate-pulse' : serverOnline === false ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'} shrink-0`} />
              <span className={`font-semibold shrink-0 ${serverOnline === true ? 'text-[#22ec72]' : serverOnline === false ? 'text-rose-400' : 'text-amber-400'}`}>{serverOnline === true ? 'Online' : serverOnline === false ? 'Offline' : 'Checking…'}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400 font-mono truncate">{time}</span>
            </div>
          </div>
        </div>

        {/* Right Header Controls: Gmail Workspace, AI Chat Quick Toggle, Notifications Bell, Operator Profile */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Quick Gmail Workspace Icon */}
          {onOpenGmail && (
            <button
              type="button"
              onClick={onOpenGmail}
              className={`min-h-[48px] min-w-[48px] w-8 h-8 rounded-xl border hidden min-[420px]:flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                activeTab === 'gmail'
                  ? 'bg-red-500/20 text-red-400 border-red-500/50'
                  : 'bg-zinc-900/90 text-zinc-400 hover:text-white border-zinc-800'
              }`}
              title="Open Gmail Workspace"
              aria-label="Gmail Workspace"
            >
              <Mail className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Quick AI Chat Icon */}
          {onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              className={`min-h-[48px] min-w-[48px] w-8 h-8 rounded-xl border hidden min-[420px]:flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-[#22ec72]/20 text-[#22ec72] border-[#22ec72]/50'
                  : 'bg-zinc-900/90 text-zinc-400 hover:text-white border-zinc-800'
              }`}
              title="Open AI Operations Chat"
              aria-label="AI Chat"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Quick Biometric Lock Button */}
          {isBiometricEnabled && (
            <button
              type="button"
              onClick={lockDashboard}
              className="min-h-[48px] min-w-[48px] w-8 h-8 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-[#22ec72]/50 text-zinc-400 hover:text-[#22ec72] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title={`Lock Dashboard (${biometryLabel} Protected)`}
              aria-label="Lock Dashboard with Biometrics"
            >
              <Fingerprint className="w-3.5 h-3.5 text-[#22ec72]" />
            </button>
          )}

          {/* Agent Inbox — opens the Operations feed at the AI Team
              section. No badge here: the single Operations badge on the
              bottom nav is the one count for these items. */}
          <button
            type="button"
            onClick={onOpenInbox}
            className="min-h-[48px] min-w-[48px] relative w-8 h-8 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white hover:border-[#22ec72]/50 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            aria-label="Open AI Team in Operations"
            title="AI Team"
          >
            <Inbox className="w-3.5 h-3.5 text-[#22ec72]" />
          </button>

          {/* Notification bell — opens the Operations feed at the Alerts
              section. No badge here: the single Operations badge on the
              bottom nav is the one count for these items. */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="min-h-[48px] min-w-[48px] relative w-8 h-8 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            aria-label="Open alerts in Operations"
            title="Alerts"
          >
            <Bell className="w-3.5 h-3.5 text-zinc-300" />
          </button>

          {/* User Auth Profile Button */}
          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[48px] min-w-[48px] w-8 h-8 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-[#22ec72]/40 flex items-center justify-center transition-all active:scale-95 cursor-pointer p-0.5"
            title={currentUser?.authenticated ? `Authenticated as ${currentUser.fullName}` : 'Login / Register Operator'}
            aria-label="User Profile"
          >
            {currentUser?.authenticated && currentUser.avatar && !avatarBroken ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.fullName}
                  onError={() => setAvatarBroken(true)}
                  className="w-full h-full rounded-lg object-cover border border-[#22ec72]/60"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#22ec72] border border-black" />
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
