import React, { useState } from 'react';
import { 
  Building, 
  ChevronDown, 
  Plus, 
  Activity, 
  CheckCircle, 
  Users, 
  Briefcase, 
  ExternalLink, 
  Settings, 
  LayoutDashboard,
  ShieldCheck,
  LogIn,
  LogOut,
  User as UserIcon,
  MessageSquare
} from 'lucide-react';
import { BusinessAccount, ActionRecord } from '../types';
import { RCLogo } from './RCLogo';
import { useAuth } from '../context/AuthContext';
import { GoogleAuthModal } from './GoogleAuthModal';

interface NavbarProps {
  currentBusiness: BusinessAccount | null;
  allBusinesses: BusinessAccount[];
  activeTab: 'dashboard' | 'activity' | 'approvals' | 'team' | 'chat' | 'jobpacks' | 'portal' | 'settings';
  actions: ActionRecord[];
  onSelectBusiness: (biz: BusinessAccount) => void;
  onNewBusiness: () => void;
  onTabChange: (tab: 'dashboard' | 'activity' | 'approvals' | 'team' | 'chat' | 'jobpacks' | 'portal' | 'settings') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentBusiness,
  allBusinesses,
  activeTab,
  actions,
  onSelectBusiness,
  onNewBusiness,
  onTabChange
}) => {
  const { user, logout } = useAuth();
  const [showBizDropdown, setShowBizDropdown] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const pendingApprovalsCount = actions.filter(a => a.status === 'awaiting_approval').length;
  const workingActionsCount = actions.filter(a => a.status === 'running' || a.status === 'queued').length;

  interface NavItem {
    id: 'dashboard' | 'activity' | 'approvals' | 'team' | 'chat' | 'jobpacks' | 'portal' | 'settings';
    label: string;
    icon: any;
    badge?: number;
    badgeColor?: string;
  }

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { 
      id: 'activity', 
      label: 'Live Activity', 
      icon: Activity,
      badge: workingActionsCount > 0 ? workingActionsCount : undefined,
      badgeColor: 'bg-sky-500 text-sky-950 font-bold'
    },
    { 
      id: 'approvals', 
      label: 'Approvals', 
      icon: CheckCircle,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      badgeColor: 'bg-amber-400 text-amber-950 font-bold animate-pulse'
    },
    { id: 'team', label: 'AI Team', icon: Users },
    { id: 'chat', label: 'AI Chat', icon: MessageSquare },
    { id: 'jobpacks', label: 'Job Packs', icon: Briefcase },
    { id: 'portal', label: 'Customer Portal', icon: ExternalLink },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#090b0e]/90 backdrop-blur-md border-b border-[#1b2233]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Business Selector */}
          <div className="flex items-center gap-4">
            <RCLogo variant="compact" />

            {/* Business Dropdown Switcher */}
            {currentBusiness && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBizDropdown(!showBizDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#131722] hover:bg-[#1a2130] text-xs text-slate-200 border border-[#232c3f] transition cursor-pointer"
                >
                  <Building className="w-3.5 h-3.5 text-[#00ff66]" />
                  <span className="font-semibold truncate max-w-[140px]">{currentBusiness.name}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {showBizDropdown && (
                  <div className="absolute left-0 mt-1.5 w-60 rounded-2xl bg-[#0e1118] border border-[#232c3f] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                      Select Account
                    </div>
                    {allBusinesses.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          onSelectBusiness(b);
                          setShowBizDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                          b.id === currentBusiness.id
                            ? 'bg-[#00ff66]/15 text-[#00ff66] font-semibold'
                            : 'text-slate-300 hover:bg-[#151b27]'
                        }`}
                      >
                        <span className="truncate">{b.name}</span>
                        {b.id === currentBusiness.id && <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66]" />}
                      </button>
                    ))}
                    <div className="border-t border-[#1d2537] mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowBizDropdown(false);
                          onNewBusiness();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#00ff66] hover:bg-[#00ff66]/10 flex items-center gap-1.5 transition cursor-pointer font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Onboard New Business</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 bg-[#10131c] p-1 rounded-2xl border border-[#1d2435]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`relative px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                    isActive
                      ? 'bg-[#182030] text-[#00ff66] font-semibold shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#141a27]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00ff66]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono leading-none ${item.badgeColor || 'bg-slate-700 text-white'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Status Pill & Firebase Auth */}
          <div className="flex items-center gap-2.5">
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#121622] border border-[#21293a] text-[11px] text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00ff66]" />
              <span>12 Employees Live</span>
            </div>

            {user ? (
              <div className="flex items-center gap-2 pl-1 border-l border-[#1f2638]">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition"
                  title="View Connected Systems"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Owner'}
                      className="w-7 h-7 rounded-full border border-[#00ff66]/40 object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#171e2c] border border-[#00ff66]/40 flex items-center justify-center text-[11px] font-bold text-[#00ff66]">
                      {user.email?.slice(0, 1).toUpperCase() || 'U'}
                    </div>
                  )}
                  <span className="hidden xl:inline text-[11px] text-slate-300 font-medium truncate max-w-[120px]">
                    {user.email}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer p-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="px-3 py-1.5 rounded-xl bg-[#131722] hover:bg-[#1a2130] text-[#00ff66] text-xs font-semibold flex items-center gap-1.5 border border-[#00ff66]/30 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign in with Google</span>
                <span className="sm:hidden">Sign in</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Google Auth & Connected Systems Modal */}
      <GoogleAuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />

      {/* Mobile Sub-Nav */}
      <div className="md:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 bg-[#0e1118] border-t border-[#1b2233] text-xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`px-2.5 py-1.5 rounded-lg shrink-0 flex items-center gap-1 ${
                isActive
                  ? 'bg-[#182030] text-[#00ff66] font-semibold'
                  : 'text-slate-400'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="px-1 rounded-full text-[9px] bg-[#00ff66] text-black font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
