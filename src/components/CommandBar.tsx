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
    <div className="w-full bg-[#0d1017] border border-[#1f2637] rounded-2xl p-4 md:p-5 shadow-2xl relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-20 bg-[#00ff66]/5 blur-3xl pointer-events-none" />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#00ff66] animate-pulse" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              RCOS Operational Command
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00ff66]" />
            <span>
              {business.autonomyMode === 'autonomous' 
                ? `Autonomous (Safeguards over $${business.dollarThreshold})` 
                : 'Supervised (All actions reviewed)'}
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
            placeholder={`Tell your AI team what to do (e.g. "Send Mrs. Rodriguez a quote for a ${business.services[0] || 'service'}" or "Draft an invoice")...`}
            className="w-full bg-[#131722] text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3.5 pr-28 text-sm md:text-base border border-[#263044] focus:outline-none focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]/40 transition shadow-inner"
          />

          <button
            type="submit"
            disabled={!input.trim() || isSubmitting}
            className="absolute right-2 px-4 py-2 rounded-lg bg-[#00ff66] text-[#090b0e] font-semibold text-sm hover:bg-[#10e560] disabled:opacity-40 disabled:hover:bg-[#00ff66] transition flex items-center gap-1.5 shadow-md shadow-[#00ff66]/20 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#090b0e]" />
                <span>Routing...</span>
              </>
            ) : (
              <>
                <span>Execute</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Live Feedback banner if recent command fired */}
        {feedback && (
          <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs md:text-sm border transition animate-in fade-in duration-200 ${
            feedback.type === 'success' 
              ? 'bg-[#00ff66]/10 text-[#00ff66] border-[#00ff66]/30' 
              : 'bg-rose-950/40 text-rose-300 border-rose-800/40'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium">{feedback.message}</span>
          </div>
        )}

        {/* Friendly Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#00ff66]" /> Quick tasks:
          </span>
          {suggestions.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSubmit(sug)}
              disabled={isSubmitting}
              className="text-[11px] text-slate-300 bg-[#161c2b] hover:bg-[#1f273b] hover:text-[#00ff66] border border-[#273248] rounded-full px-3 py-1 transition cursor-pointer disabled:opacity-50"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
