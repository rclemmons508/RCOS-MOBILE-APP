import React from 'react';
import { Bot, ClipboardCheck, Phone, Briefcase, Users, Settings as SettingsIcon, MessageSquare } from 'lucide-react';
import { TabType } from '../../types';

interface QuickLaunchItem {
  label: string;
  icon: React.ReactNode;
  tab: TabType;
}

/**
 * Quick Launch Bar — per the RCOS Master Dashboard spec (§11).
 * One-tap shortcuts to the system's key destinations.
 */
export const QuickLaunchBar: React.FC<{ onNavigate: (tab: TabType) => void }> = ({ onNavigate }) => {
  const items: QuickLaunchItem[] = [
    { label: 'AI Team', icon: <Bot className="w-4 h-4 text-lime-400" />, tab: 'team' },
    { label: 'Team Chat', icon: <MessageSquare className="w-4 h-4 text-lime-400" />, tab: 'team-chat' },
    { label: 'Approvals', icon: <ClipboardCheck className="w-4 h-4 text-lime-400" />, tab: 'approvals' },
    { label: 'Phone', icon: <Phone className="w-4 h-4 text-lime-400" />, tab: 'phone' },
    { label: 'Jobs', icon: <Briefcase className="w-4 h-4 text-lime-400" />, tab: 'jobs' },
    { label: 'Clients', icon: <Users className="w-4 h-4 text-lime-400" />, tab: 'clients' },
    { label: 'Automations', icon: <SettingsIcon className="w-4 h-4 text-lime-400" />, tab: 'settings' },
  ];

  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-3">
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">
        Quick Launch
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => (
          <button
            key={item.tab}
            type="button"
            onClick={() => onNavigate(item.tab)}
            className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-lime-500/40 transition cursor-pointer shrink-0 min-w-[72px]"
          >
            {item.icon}
            <span className="text-[10px] font-bold text-zinc-300">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
