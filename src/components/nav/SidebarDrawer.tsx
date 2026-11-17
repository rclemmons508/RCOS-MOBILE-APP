import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Bot,
  ClipboardList,
  Users,
  Zap,
  Phone,
  Calendar,
  Receipt,
  BarChart3,
  Settings,
  X,
  User as UserIcon,
  ChevronRight
} from 'lucide-react';
import { TabType, User } from '../../types';
import { RCLogoIcon } from '../RCLogo';
import { haptic } from '../../utils/haptics';

type SettingsSection = 'user' | 'agents';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabType;
  /** 'agents' when Settings is open on the automation section. */
  settingsSection?: SettingsSection;
  currentUser?: User | null;
  businessName: string;
  /** The single Operations badge count — the same number as the
   *  bottom-nav Operations badge. 0 hides it. */
  operationsBadge?: number;
  onNavigateTab: (tab: TabType) => void;
  onOpenSettings: (section: SettingsSection) => void;
}

/**
 * Sidebar drawer from the sidebar-design reference: RC Solutions logo,
 * Dashboard / Assistant / Operations / Customers / Automation / Calls / Schedule /
 * Invoices / Reports / Settings, and the signed-in user at the bottom.
 *
 * Every item goes to a real screen — the mapping is the Stage 1 mapping
 * (see the sidebar stage plan). Invoices opens the money-loop Review
 * screen (quotes + invoices + Mark Paid); Reports opens the dedicated
 * Reports screen built in Stage 6. Neither item is dead.
 */
export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  settingsSection = 'user',
  currentUser,
  businessName,
  operationsBadge = 0,
  onNavigateTab,
  onOpenSettings,
}) => {
  // A broken avatar URL used to render a broken-image icon. Same guard
  // as the header: fall back to the icon tile.
  const [avatarBroken, setAvatarBroken] = useState(false);
  useEffect(() => {
    setAvatarBroken(false);
  }, [currentUser?.avatar]);

  if (!isOpen) return null;

  const go = (tab: TabType) => {
    haptic.light();
    onClose();
    onNavigateTab(tab);
  };
  const goSettings = (section: SettingsSection) => {
    haptic.light();
    onClose();
    onOpenSettings(section);
  };

  // Which drawer row is the current screen, so it reads as selected.
  // Jobs live under Schedule, Review under Invoices, chat/team under
  // More (no drawer row of their own — the drawer stays unhighlighted).
  const activeItem: string | null =
    activeTab === 'dashboard' ? 'dashboard'
    : activeTab === 'assistant' ? 'assistant'
    : activeTab === 'inbox' || activeTab === 'team-chat' || activeTab === 'gmail' || activeTab === 'requests' ? 'operations'
    : activeTab === 'clients' ? 'customers'
    : activeTab === 'phone' ? 'calls'
    : activeTab === 'jobs' ? 'schedule'
    : activeTab === 'approvals' ? 'invoices'
    : activeTab === 'reports' ? 'reports'
    : activeTab === 'settings' ? (settingsSection === 'agents' ? 'automation' : 'settings')
    : null;

  const items: { id: string; label: string; icon: any; run: () => void }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, run: () => go('dashboard') },
    { id: 'assistant', label: 'Assistant', icon: Bot, run: () => go('assistant') },
    { id: 'operations', label: 'Operations', icon: ClipboardList, run: () => go('inbox') },
    { id: 'customers', label: 'Customers', icon: Users, run: () => go('clients') },
    { id: 'automation', label: 'Automation', icon: Zap, run: () => goSettings('agents') },
    { id: 'calls', label: 'Calls', icon: Phone, run: () => go('phone') },
    { id: 'schedule', label: 'Schedule', icon: Calendar, run: () => go('jobs') },
    { id: 'invoices', label: 'Invoices', icon: Receipt, run: () => go('approvals') },
    { id: 'reports', label: 'Reports', icon: BarChart3, run: () => go('reports') },
    { id: 'settings', label: 'Settings', icon: Settings, run: () => goSettings('user') },
  ];

  const userName = currentUser?.authenticated ? currentUser.fullName : '';
  const userRole = currentUser?.authenticated && currentUser.role ? currentUser.role : businessName;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
      {/* Backdrop — tap to close. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="min-h-[48px] absolute inset-0 w-full h-full bg-black/70 cursor-pointer"
      />
      <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-[#05090a] border-r border-[#1d2b26] flex flex-col">
        {/* Logo + close, as in the reference. */}
        <div className="flex items-start justify-between px-4 pt-5 pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <RCLogoIcon className="h-11 w-11 rounded-2xl shrink-0" />
            <div className="min-w-0">
              <div className="text-base font-extrabold text-white tracking-tight leading-none truncate">
                RC SOLUTIONS
              </div>
              <div className="text-xs font-bold text-zinc-500 tracking-[0.2em] mt-1">
                PEOPLE · PROPERTY · PROGRESS
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onClose();
            }}
            className="min-h-[48px] w-10 h-10 rounded-xl bg-[#0c1211] border border-[#1d2b26] text-zinc-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav aria-label="Main menu" className="flex-1 overflow-y-auto px-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.run}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition cursor-pointer min-h-[48px] ${
                  isActive
                    ? 'bg-[#22ec72]/15 text-[#22ec72] border border-[#22ec72]/30 font-bold'
                    : 'text-zinc-300 hover:bg-[#0c1211] hover:text-white border border-transparent'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1 text-sm">{item.label}</span>
                {item.id === 'operations' && operationsBadge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border border-black shrink-0">
                    {operationsBadge > 99 ? '99+' : operationsBadge}
                  </span>
                )}
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#22ec72] shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* Signed-in user — taps through to the profile in Settings. */}
        <div className="p-3 border-t border-[#1d2b26]">
          <button
            type="button"
            onClick={() => goSettings('user')}
            className="min-h-[48px] w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-[#0c1211] transition text-left cursor-pointer"
          >
            {currentUser?.authenticated && currentUser.avatar && !avatarBroken ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.fullName}
                onError={() => setAvatarBroken(true)}
                className="w-10 h-10 rounded-full object-cover border border-[#22ec72]/50 shrink-0"
              />
            ) : (
              <span className="w-10 h-10 rounded-full bg-[#0c1211] border border-[#1d2b26] flex items-center justify-center text-zinc-400 shrink-0">
                <UserIcon className="w-5 h-5" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white truncate">
                {userName || 'Sign in'}
              </span>
              <span className="block text-xs text-zinc-500 truncate">{userRole}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
