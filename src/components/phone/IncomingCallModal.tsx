import React, { useEffect } from 'react';
import { Phone, PhoneCall as PhoneIcon, Sparkles, User, PhoneOff, Radio } from 'lucide-react';
import { playRingtone, stopRingtone, playChime } from '../../utils/phoneAudio';

interface IncomingCallModalProps {
  isOpen: boolean;
  callerName: string;
  callerNumber: string;
  callerTopic?: string;
  autoAnswerMode?: 'ai' | 'manual';
  onAnswerAI: () => void;
  onAnswerHuman: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  isOpen,
  callerName,
  callerNumber,
  callerTopic = 'Service Inquiry',
  autoAnswerMode = 'ai',
  onAnswerAI,
  onAnswerHuman,
  onDecline
}) => {
  useEffect(() => {
    if (!isOpen) return;

    // Start telephone ringtone
    const stopFn = playRingtone();

    // If auto-answer is enabled, answer after 1.8 seconds
    let autoTimer: any = null;
    if (autoAnswerMode === 'ai') {
      autoTimer = setTimeout(() => {
        stopRingtone();
        playChime('pickup');
        onAnswerAI();
      }, 2000);
    }

    return () => {
      stopFn();
      if (autoTimer) clearTimeout(autoTimer);
    };
  }, [isOpen, autoAnswerMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-gradient-to-b from-zinc-900 to-zinc-950 border border-lime-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 text-center relative overflow-hidden">
        {/* Pulsing ring aura */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-lime-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Ringing Animation Icon */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-lime-500/20 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-lime-500/30 animate-pulse" />
          <div className="relative p-4 rounded-full bg-lime-500 text-black shadow-xl shadow-lime-500/40">
            <Phone className="w-8 h-8 animate-bounce" />
          </div>
        </div>

        {/* Caller Info */}
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-widest text-lime-400 font-bold flex items-center justify-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Incoming Business Call</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white">{callerName}</h2>
          <p className="text-xs text-zinc-400 font-mono">{callerNumber}</p>
          <div className="mt-2 inline-block px-3 py-1 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
            Topic: <strong className="text-white">{callerTopic}</strong>
          </div>
        </div>

        {/* Auto Answer Status */}
        {autoAnswerMode === 'ai' && (
          <div className="text-[11px] text-zinc-400 font-mono flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Receptionist answering automatically...</span>
          </div>
        )}

        {/* Answering Controls */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              stopRingtone();
              playChime('pickup');
              onAnswerAI();
            }}
            className="p-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-5 h-5 text-purple-200" />
            <span>Answer with AI</span>
            <span className="text-[9.5px] font-mono opacity-80">(Concierge Kore)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopRingtone();
              playChime('pickup');
              onAnswerHuman();
            }}
            className="p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all shadow-lg shadow-blue-600/30 cursor-pointer active:scale-95"
          >
            <User className="w-5 h-5 text-blue-200" />
            <span>Answer as Human</span>
            <span className="text-[9.5px] font-mono opacity-80">(Live Operator)</span>
          </button>
        </div>

        {/* Decline Button */}
        <button
          type="button"
          onClick={() => {
            stopRingtone();
            playChime('hangup');
            onDecline();
          }}
          className="w-full py-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 border border-zinc-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span>Send to Voicemail & Decline</span>
        </button>
      </div>
    </div>
  );
};
