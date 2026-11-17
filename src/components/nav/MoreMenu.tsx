import React from 'react';
import { Settings2, Zap, Users, User, Building2, Bot, MessageSquare, ChevronRight } from 'lucide-react';
import { TabType } from '../../types';
import { haptic } from '../../utils/haptics';

type SettingsSection = 'user' | 'agents';

interface MoreMenuProps {
  onOpenSettings: (section: SettingsSection) => void;
  /** Navigate straight to a tab (AI Team, AI Chat). */
  onNavigateTab?: (tab: TabType) => void;
}

/**
 * More menu screen. Settings rows open Settings at a section; the
 * AI Team and AI Chat rows go straight to those screens, since the
 * bottom bar no longer carries an AI Team tab.
 */
export const MoreMenu: React.FC<MoreMenuProps> = ({ onOpenSettings, onNavigateTab }) => {
  const items: { label: string; subtitle: string; icon: any; section?: SettingsSection; tab?: TabType }[] = [
    { label: 'Assistant', subtitle: 'Your AI assistant — chat, documents, voice', icon: Bot, tab: 'assistant' },
    { label: 'AI Team', subtitle: 'Your AI employees', icon: Bot, tab: 'team' },
    { label: 'AI Chat', subtitle: 'Talk to your AI team', icon: MessageSquare, tab: 'chat' },
    { label: 'Settings', subtitle: 'App settings, profile, team', icon: Settings2, section: 'user' },
    { label: 'Automations', subtitle: 'Automation rules & engine', icon: Zap, section: 'agents' },
    { label: 'Team & Invites', subtitle: 'Members, invites, roles', icon: Users, section: 'user' },
    { label: 'Profile', subtitle: 'Your name, photo, contact', icon: User, section: 'user' },
    { label: 'Business info', subtitle: 'Company details', icon: Building2, section: 'user' },
  ];

  return (
    <div className="space-y-3 px-3.5 sm:px-4 pt-2 pb-8">
      <h2 className="text-xl font-extrabold text-white tracking-tight px-1">More</h2>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                haptic.light();
                if (item.tab && onNavigateTab) onNavigateTab(item.tab);
                else if (item.section) onOpenSettings(item.section);
              }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-[#22ec72]/40 active:scale-[0.99] transition-all cursor-pointer text-left min-h-[64px]"
            >
              <span className="p-2.5 rounded-xl bg-[#22ec72]/10 text-[#22ec72] shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">{item.label}</span>
                <span className="block text-xs text-zinc-400 truncate">{item.subtitle}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
