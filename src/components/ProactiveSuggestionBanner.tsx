import React from 'react';
import { Sparkles, ArrowRight, X, TrendingUp, Check } from 'lucide-react';
import { IndustryOptimizationSuggestion } from '../types';
import { haptic } from '../utils/haptics';

// Bug 5 (React #310) defense: the suggestion payload comes from unvalidated
// LLM JSON, so any field may arrive as an object/array instead of the scalar
// the type promises. Coerce every rendered field here so an object can never
// reach JSX as a React child ("Objects are not valid as a React child").
const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
};

const asScore = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

const asSafeSuggestion = (s: IndustryOptimizationSuggestion): IndustryOptimizationSuggestion => ({
  ...s,
  currentIndustryId: asText(s.currentIndustryId),
  suggestedPresetId: asText(s.suggestedPresetId),
  suggestedPresetName: asText(s.suggestedPresetName),
  confidence: asScore((s as { confidence?: unknown }).confidence),
  matchScore: asScore(s.matchScore),
  reason: asText(s.reason),
  newServicesDetected: asStringList(s.newServicesDetected),
  recommendedTone: asText(s.recommendedTone),
  technicianRoleName: asText(s.technicianRoleName),
  suggestedServices: asStringList(s.suggestedServices),
  activeEmployees:
    typeof s.activeEmployees === 'object' && s.activeEmployees !== null && !Array.isArray(s.activeEmployees)
      ? s.activeEmployees
      : {},
  triggers: asStringList(s.triggers),
});

interface ProactiveSuggestionBannerProps {
  suggestion: IndustryOptimizationSuggestion;
  onReview: () => void;
  onDismiss: () => void;
}

export const ProactiveSuggestionBanner: React.FC<ProactiveSuggestionBannerProps> = ({
  suggestion,
  onReview,
  onDismiss
}) => {
  const safe = asSafeSuggestion(suggestion);
  return (
    <div className="w-full p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-lime-950/40 via-zinc-950 to-zinc-950 border border-lime-500/40 shadow-xl shadow-lime-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-lime-500/20 border border-lime-500/40 flex items-center justify-center text-lime-400 shrink-0 mt-0.5 sm:mt-0">
          <Sparkles className="w-4 h-4 animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-lime-500 text-black">
              AI Context Monitor
            </span>
            <span className="text-[10px] text-lime-400 font-mono font-bold">
              {safe.matchScore}% Optimization Match
            </span>
          </div>
          <p className="text-xs font-bold text-white mt-0.5 leading-snug">
            Proactive recommendation: Switch to <span className="text-lime-400 font-extrabold">"{safe.suggestedPresetName}"</span> profile
          </p>
          <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
            {safe.reason}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-1 sm:pt-0">
        <button
          type="button"
          onClick={() => {
            haptic.light();
            onDismiss();
          }}
          className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition cursor-pointer"
        >
          Dismiss
        </button>

        <button
          type="button"
          onClick={() => {
            haptic.selection();
            onReview();
          }}
          className="px-3.5 py-1.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-lime-500/20 transition cursor-pointer"
        >
          <span>Review & Approve</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
