import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { BusinessAccount, ActionRecord } from '../types';

interface CommandBarProps {
  business: BusinessAccount;
  onActionCreated: (action: ActionRecord) => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({ business, onActionCreated }) => {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    employeeName?: string;
  } | null>(null);

  // Dynamic quick suggestions based on business profile
  const suggestions = [
    `Send a quote for ${business.services[0] || 'our service'} to a new client`,
    `Draft an invoice for completed work`,
    `Schedule next week's ${business.services[1] || business.services[0] || 'service'} appointment`,
    `Review safety protocol for team`
  ];

  const handleSubmit = async (textToSubmit?: string) => {
    const text = (textToSubmit || input).trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/business/${business.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: text })
      });

      if (!res.ok) {
        throw new Error('Failed to execute command');
      }

      const createdAction: ActionRecord = await res.json();
      setInput('');
      setFeedback({
        type: 'success',
        message: createdAction.stepSummary || 'Task assigned to your AI team. Working on it now...',
        employeeName: createdAction.employeeId
      });
      onActionCreated(createdAction);

      // Dismiss feedback after 5 seconds
      setTimeout(() => {
        setFeedback(null);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: 'Could not submit task. Please check your connection and try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800/90 rounded-2xl p-3 sm:p-4 shadow-xl relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 w-72 h-16 bg-lime-500/5 blur-2xl pointer-events-none" />

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-lime-400 animate-pulse" />
            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider font-mono">
              RCOS AI Command Bar
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
            <ShieldCheck className="w-3 h-3 text-lime-400 shrink-0" />
            <span className="truncate max-w-[190px] sm:max-w-none">
              {business.autonomyMode === 'autonomous' 
                ? `Auto (Approval over $${business.dollarThreshold})` 
                : 'Supervised (Manual sign-off)'}
            </span>
          </div>
        </div>

        {/* Input box */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSubmitting}
            placeholder={`Instruct AI team: e.g. "Send quote to John" or "Schedule maintenance"...`}
            className="w-full bg-black text-zinc-100 placeholder-zinc-500 rounded-xl pl-3 pr-20 py-2.5 text-xs sm:text-sm border border-zinc-800 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition shadow-inner"
          />

          <button
            type="submit"
            disabled={!input.trim() || isSubmitting}
            className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-lime-500 text-black font-extrabold text-xs hover:bg-lime-400 disabled:opacity-40 disabled:hover:bg-lime-500 transition flex items-center gap-1 shadow-md shadow-lime-500/20 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                <span className="hidden sm:inline">Routing...</span>
              </>
            ) : (
              <>
                <span>Run</span>
                <ArrowRight className="w-3 h-3" />
              </>
            )}
          </button>
        </form>

        {/* Live Feedback banner if recent command fired */}
        {feedback && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border transition animate-in fade-in duration-200 ${
            feedback.type === 'success' 
              ? 'bg-lime-500/10 text-lime-400 border-lime-500/30 font-medium' 
              : 'bg-rose-950/40 text-rose-300 border-rose-800/40'
          }`}>
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{feedback.message}</span>
          </div>
        )}

        {/* Horizontal scrollable quick task suggestion chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <span className="text-[10px] text-zinc-500 font-mono shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-lime-400" /> Quick:
          </span>
          {suggestions.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSubmit(sug)}
              disabled={isSubmitting}
              className="text-[10.5px] text-zinc-300 bg-zinc-900 hover:bg-zinc-800 hover:text-lime-300 border border-zinc-800 rounded-lg px-2.5 py-1 whitespace-nowrap transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
