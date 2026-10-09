import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Check, 
  X, 
  Building2, 
  ShieldCheck, 
  Wrench, 
  Volume2, 
  AlertCircle, 
  Layers, 
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Bot
} from 'lucide-react';
import { BusinessAccount, IndustryOptimizationSuggestion, IndustryPreset } from '../types';
import { INDUSTRY_PRESETS } from '../data/presets';
import { haptic } from '../utils/haptics';

interface ProactiveIndustrySuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: IndustryOptimizationSuggestion;
  business: BusinessAccount;
  onApplyOptimization: (updatedBusiness: BusinessAccount) => void;
  onDismissSuggestion: () => void;
}

export const ProactiveIndustrySuggestionModal: React.FC<ProactiveIndustrySuggestionModalProps> = ({
  isOpen,
  onClose,
  suggestion,
  business,
  onApplyOptimization,
  onDismissSuggestion
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [customizeBeforeApply, setCustomizeBeforeApply] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>(() => {
    // Combine current services with recommended preset services
    const combined = Array.from(new Set([...business.services, ...suggestion.suggestedServices]));
    return combined.slice(0, 8);
  });
  const [selectedRoleTitle, setSelectedRoleTitle] = useState(suggestion.technicianRoleName);
  const [selectedTone, setSelectedTone] = useState(suggestion.recommendedTone);

  if (!isOpen) return null;

  const targetPreset = INDUSTRY_PRESETS.find(p => p.id === suggestion.suggestedPresetId) || {
    id: suggestion.suggestedPresetId,
    name: suggestion.suggestedPresetName,
    description: 'Specialized autonomous operating environment.',
    defaultServices: suggestion.suggestedServices,
    recommendedTone: suggestion.recommendedTone,
    technicianRoleName: suggestion.technicianRoleName,
    sampleJobPacks: []
  };

  const currentPreset = INDUSTRY_PRESETS.find(p => p.id === business.industry) || {
    id: business.industry,
    name: business.industry.replace(/_/g, ' ').toUpperCase(),
    description: 'Current active profile'
  };

  const handleConfirmApply = async () => {
    setIsApplying(true);
    await haptic.success();

    const updatedEmployees = { ...business.activeEmployees };
    if (suggestion.activeEmployees) {
      Object.entries(suggestion.activeEmployees).forEach(([empId, active]) => {
        if (active) updatedEmployees[empId] = true;
      });
    }

    const updatedBiz: BusinessAccount = {
      ...business,
      industry: suggestion.suggestedPresetId,
      services: selectedServices.length > 0 ? selectedServices : suggestion.suggestedServices,
      brandTone: selectedTone,
      activeEmployees: updatedEmployees,
      updatedAt: new Date().toISOString()
    };

    onApplyOptimization(updatedBiz);
    setIsApplying(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-zinc-950 border border-lime-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl shadow-lime-500/10 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon with AI Badge */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-lime-500/15 border border-lime-500/30 flex items-center justify-center text-lime-400 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-lime-500 text-black uppercase font-mono tracking-wider">
                  Proactive AI Insight
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {suggestion.matchScore}% Optimal Match
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                Optimize Industry Profile to "{suggestion.suggestedPresetName}"
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              haptic.light();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 py-3 text-xs pr-0.5">
          {/* Transition Comparison Card */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-zinc-500 font-mono uppercase block mb-0.5">Current Preset:</span>
              <div className="text-xs font-bold text-zinc-300 truncate">
                {currentPreset.name}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-zinc-800 text-zinc-400 shrink-0">
              <ArrowRight className="w-4 h-4 text-lime-400" />
            </div>

            <div className="min-w-0 flex-1 text-right">
              <span className="text-[10px] text-lime-400/80 font-mono uppercase block mb-0.5">Suggested Profile:</span>
              <div className="text-xs font-extrabold text-lime-400 truncate">
                {suggestion.suggestedPresetName}
              </div>
            </div>
          </div>

          {/* AI Monitor Context Reasoning */}
          <div className="p-3.5 rounded-2xl bg-lime-950/20 border border-lime-500/25 space-y-2">
            <div className="flex items-center gap-1.5 text-lime-400 font-extrabold text-[11px]">
              <Bot className="w-4 h-4" />
              <span>Why the AI Agent is suggesting this change:</span>
            </div>
            <p className="text-zinc-200 text-xs leading-relaxed">
              {suggestion.reason}
            </p>
          </div>

          {/* Trigger Services Identified */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
              Services Triggering This Upgrade:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {business.services.map((svc, idx) => (
                <span 
                  key={idx} 
                  className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 text-[11px] font-medium flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                  {svc}
                </span>
              ))}
            </div>
          </div>

          {/* What Unlocks with this Profile */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2.5">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-lime-400" />
              <span>Operational Benefits Unlocked:</span>
            </div>
            
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-start gap-2 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-lime-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Field Role Title:</strong> Calibrated to <span className="text-white font-mono">"{suggestion.technicianRoleName}"</span>.
                </span>
              </div>
              <div className="flex items-start gap-2 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-lime-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Brand Voice:</strong> Switched to <span className="text-white italic">"{suggestion.recommendedTone}"</span> for customer quotes and follow-ups.
                </span>
              </div>
              <div className="flex items-start gap-2 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-lime-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Job Pack Checklists:</strong> Auto-loads industry standard safety protocols, toolkits, and execution sequences for {suggestion.suggestedPresetName}.
                </span>
              </div>
            </div>
          </div>

          {/* Optional Customization Accordion */}
          <div className="border border-zinc-800/80 rounded-2xl p-3 bg-zinc-900/30 space-y-2.5">
            <button
              type="button"
              onClick={() => {
                haptic.selection();
                setCustomizeBeforeApply(!customizeBeforeApply);
              }}
              className="w-full flex items-center justify-between text-left text-xs font-bold text-zinc-300 hover:text-white cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-lime-400" />
                <span>Customize details before approving</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {customizeBeforeApply ? 'Collapse' : 'Expand'}
              </span>
            </button>

            {customizeBeforeApply && (
              <div className="space-y-3 pt-2 border-t border-zinc-800 animate-in fade-in duration-150">
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1">
                    Front-line Specialist Title:
                  </label>
                  <input
                    type="text"
                    value={selectedRoleTitle}
                    onChange={(e) => setSelectedRoleTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1">
                    Brand Tone & Communication Style:
                  </label>
                  <input
                    type="text"
                    value={selectedTone}
                    onChange={(e) => setSelectedTone(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onDismissSuggestion();
              onClose();
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition cursor-pointer text-center"
          >
            Keep Current ({currentPreset.name})
          </button>

          <button
            type="button"
            onClick={handleConfirmApply}
            disabled={isApplying}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-lime-500/25 transition cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Approve & Switch to {suggestion.suggestedPresetName}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
