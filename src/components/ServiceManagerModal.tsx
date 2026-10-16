import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Plus, 
  X, 
  Check, 
  Wrench, 
  Loader2, 
  HelpCircle,
  Briefcase
} from 'lucide-react';
import { BusinessAccount, IndustryPreset } from '../types';
import { INDUSTRY_PRESETS } from '../data/presets';
import { haptic } from '../utils/haptics';
import { asText, asStringList } from '../utils/safeRender';

interface ServiceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: BusinessAccount;
  onUpdateServices: (updatedServices: string[]) => void;
  onRequestAISuggestionCheck?: () => void;
}

export const ServiceManagerModal: React.FC<ServiceManagerModalProps> = ({
  isOpen,
  onClose,
  business,
  onUpdateServices,
  onRequestAISuggestionCheck
}) => {
  // Services come from the server/Firestore record, so coerce to strings:
  // a service stored as an object would crash React (#310) when rendered.
  const [services, setServices] = useState<string[]>(asStringList(business.services));
  const [newServiceName, setNewServiceName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const currentPreset = INDUSTRY_PRESETS.find(p => p.id === business.industry);

  const handleAddService = (nameToAdd?: string) => {
    const text = (nameToAdd || newServiceName).trim();
    if (!text) return;
    if (services.includes(text)) return;

    haptic.selection();
    const next = [...services, text];
    setServices(next);
    setNewServiceName('');
  };

  const handleRemoveService = (indexToRemove: number) => {
    haptic.light();
    setServices(services.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await haptic.success();
    onUpdateServices(services);
    setIsSaving(false);
    onClose();

    if (onRequestAISuggestionCheck) {
      setTimeout(() => {
        onRequestAISuggestionCheck();
      }, 500);
    }
  };

  // Preset recommendations based on current trade
  const suggestedPills = [
    'Emergency Diagnostics & Triage',
    'Preventative Maintenance Agreement',
    'Equipment Replacement & Retrofit',
    'High-Efficiency System Overhaul',
    'Smart Monitoring & Telemetry Install',
    'On-Call After-Hours Rapid Dispatch'
  ].filter(p => !services.includes(p));

  // Live evaluation of services matching against presets
  const detectedPreset = React.useMemo(() => {
    if (services.length === 0) return null;
    const allServicesText = services.join(' ').toLowerCase();
    
    let bestMatch: IndustryPreset | null = null;
    let maxScore = 0;

    for (const preset of INDUSTRY_PRESETS) {
      let score = 0;
      // Check preset name keywords
      const nameWords = preset.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (const w of nameWords) {
        if (allServicesText.includes(w)) score += 3;
      }
      // Check default services overlap
      for (const ds of preset.defaultServices) {
        const dsWords = ds.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        for (const w of dsWords) {
          if (allServicesText.includes(w)) score += 1.5;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestMatch = preset;
      }
    }

    if (bestMatch && maxScore >= 3 && bestMatch.id !== business.industry) {
      return bestMatch;
    }
    return null;
  }, [services, business.industry]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-lime-500/10 border border-lime-500/30 flex items-center justify-center text-lime-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                Business Services Catalog
              </h3>
              <p className="text-[11px] text-zinc-400">
                {asText(business.name)} • {currentPreset?.name || asText(business.industry)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 py-3 text-xs">
          {/* Proactive AI Note / Live Detection Banner */}
          {detectedPreset ? (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-lime-500/20 via-emerald-500/15 to-zinc-900 border border-lime-500/40 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-lime-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-white">
                      AI Match Detected: {detectedPreset.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-lime-500/20 text-lime-400 font-mono font-bold">
                      Optimized Fit
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-1 leading-snug">
                    Your services match the specialized workflows of <strong className="text-lime-300">{detectedPreset.name}</strong>. Saving will prompt you with the proactive upgrade!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-lime-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                <strong>Autonomous Context Monitor:</strong> When you add or adjust services, RCOS proactively evaluates whether a more specialized Industry Profile matches your operations and suggests an upgrade.
              </p>
            </div>
          )}

          {/* Add New Service Input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleAddService();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              placeholder="e.g. EV Charger Installation, Sewer Camera..."
              className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newServiceName.trim()}
              className="px-3.5 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:opacity-40 text-black font-extrabold text-xs flex items-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add</span>
            </button>
          </form>

          {/* Current Services List */}
          <div>
            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1.5">
              Current Offered Services ({services.length}):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {services.map((svc, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs flex items-center gap-1.5 group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                  <span>{svc}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveService(idx)}
                    className="text-zinc-500 hover:text-rose-400 transition cursor-pointer ml-0.5"
                    title="Remove service"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {services.length === 0 && (
                <div className="text-zinc-500 italic text-[11px] py-2">
                  No specific services listed yet. Add one above.
                </div>
              )}
            </div>
          </div>

          {/* Quick Add Suggestions */}
          {suggestedPills.length > 0 && (
            <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                Quick Add Popular Capabilities:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {suggestedPills.slice(0, 4).map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddService(p)}
                    className="px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-lime-500/40 text-zinc-400 hover:text-lime-300 text-[11px] transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-lime-500/20 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Save & Check Optimization</span>
          </button>
        </div>
      </div>
    </div>
  );
};
