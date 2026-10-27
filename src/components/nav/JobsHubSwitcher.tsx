import React from 'react';
import { Briefcase, ShieldCheck, Users } from 'lucide-react';
import { TabType } from '../../types';
import { haptic } from '../../utils/haptics';
import { hubSwitcherButton, hubSwitcherContainer } from '../ui/cards';

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
    <div className={hubSwitcherContainer} role="tablist" aria-label="Jobs hub">
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
            className={hubSwitcherButton(isActive)}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
