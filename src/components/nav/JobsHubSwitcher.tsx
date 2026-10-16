import React from 'react';
import { Briefcase, ShieldCheck, Users } from 'lucide-react';
import { TabType } from '../../types';
import { haptic } from '../../utils/haptics';

interface JobsHubSwitcherProps {
  activeTab: TabType;
  onNavigate: (tab: TabType) => void;
}

/**
 * Jobs hub switcher — sits above the Jobs / Review / Clients screens so the
 * three views behave as one hub. Old tab ids stay valid view targets.
 */
export const JobsHubSwitcher: React.FC<JobsHubSwitcherProps> = ({ activeTab, onNavigate }) => {
  const items: { id: TabType; label: string; icon: any }[] = [
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'approvals', label: 'Review', icon: ShieldCheck },
    { id: 'clients', label: 'Clients', icon: Users },
  ];

  return (
    <div className="flex gap-1 p-1 rounded-2xl bg-zinc-950 border border-zinc-800/80" role="tablist" aria-label="Jobs hub">
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
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[44px] ${
              isActive
                ? 'bg-lime-500 text-black'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
