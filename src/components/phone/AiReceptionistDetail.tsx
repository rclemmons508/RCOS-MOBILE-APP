import React from 'react';
import {
  ArrowLeft,
  AudioWaveform,
  BookOpen,
  ChevronRight,
  FileText,
  Sliders,
} from 'lucide-react';
import { sidebarCard } from '../ui/cards';

/**
 * AI Receptionist detail screen (sidebar rebuild, Stage 4).
 *
 * The screen the Dashboard's AI Receptionist card and the Calls screen's
 * receptionist card open. Every number is real: calls today from the
 * server's call record, leads captured from customer requests created
 * today, appointments booked from jobs booked today. A number that cannot
 * be computed from real data is omitted, never invented — there are no
 * deltas or baselines here.
 *
 * Rows only exist when they open something real:
 * - Call Flow Settings → the AI Team screen (receptionist agent setup).
 * - Knowledge Base → Settings, where Teach Your Team lives.
 * - Call Transcripts → back to the call log, where transcripts live.
 * There is no "Voice & Greeting" row: no greeting setting exists in the
 * app, so the row would be dead.
 */

export type AnsweringMode = 'ai' | 'manual';

export interface ReceptionistStatus {
  label: string;
  subline: string;
  /** 'active' | 'manual' | 'offline' | 'checking' — drives pill colors. */
  tone: 'active' | 'manual' | 'offline' | 'checking';
}

/** One definition of the receptionist's live status, shared by this
 *  screen and the Calls screen's receptionist card. Status follows the
 *  same server-reachability signal as the Dashboard's Online badge. */
export function receptionistStatus(
  serverOnline: boolean | null,
  answeringMode: AnsweringMode
): ReceptionistStatus {
  if (serverOnline === false) {
    return {
      label: 'Offline',
      subline: "The server can't be reached right now.",
      tone: 'offline',
    };
  }
  if (answeringMode === 'manual') {
    return {
      label: 'Manual',
      subline: 'Manual mode — calls ring for a human to answer.',
      tone: 'manual',
    };
  }
  if (serverOnline === null) {
    return { label: 'Checking…', subline: 'Checking the connection…', tone: 'checking' };
  }
  return {
    label: 'Active',
    subline: 'Your AI receptionist is active and ready.',
    tone: 'active',
  };
}

const statusPillClass = (tone: ReceptionistStatus['tone']): string => {
  if (tone === 'active') return 'bg-[#22ec72]/10 text-[#22ec72] border-[#22ec72]/30';
  if (tone === 'manual' || tone === 'checking')
    return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
};

const statusDotClass = (tone: ReceptionistStatus['tone']): string => {
  if (tone === 'active') return 'bg-[#22ec72]';
  if (tone === 'manual' || tone === 'checking') return 'bg-amber-400';
  return 'bg-rose-400';
};

interface AiReceptionistDetailProps {
  serverOnline: boolean | null;
  answeringMode: AnsweringMode;
  /** AI-answered or all server-recorded calls with a timestamp of today. */
  callsToday: number;
  /** Customer requests created today. */
  leadsCaptured: number;
  /** Jobs booked today (createdAt stamped today). */
  appointmentsBooked: number;
  onClose: () => void;
  onOpenCallFlow: () => void;
  onOpenKnowledgeBase: () => void;
  onOpenTranscripts: () => void;
}

export const AiReceptionistDetail: React.FC<AiReceptionistDetailProps> = ({
  serverOnline,
  answeringMode,
  callsToday,
  leadsCaptured,
  appointmentsBooked,
  onClose,
  onOpenCallFlow,
  onOpenKnowledgeBase,
  onOpenTranscripts,
}) => {
  const status = receptionistStatus(serverOnline, answeringMode);

  const stats = [
    { label: 'Calls Today', value: callsToday },
    { label: 'Leads Captured', value: leadsCaptured },
    { label: 'Appts Booked', value: appointmentsBooked },
  ];

  const rows = [
    {
      key: 'call-flow',
      icon: <Sliders className="w-4 h-4 text-[#22ec72] shrink-0" />,
      title: 'Call Flow Settings',
      subtitle: 'Receptionist agent setup & tone',
      onClick: onOpenCallFlow,
    },
    {
      key: 'knowledge',
      icon: <BookOpen className="w-4 h-4 text-[#22ec72] shrink-0" />,
      title: 'Knowledge Base',
      subtitle: 'What your AI team knows',
      onClick: onOpenKnowledgeBase,
    },
    {
      key: 'transcripts',
      icon: <FileText className="w-4 h-4 text-[#22ec72] shrink-0" />,
      title: 'Call Transcripts',
      subtitle: 'Full transcripts in the call log',
      onClick: onOpenTranscripts,
    },
  ];

  return (
    <div className="space-y-4 pb-12 px-3 sm:px-4 pt-3 max-w-full overflow-x-hidden">
      {/* Header — back arrow, title, live status pill (as in the reference). */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to Calls"
          className="min-h-[48px] w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-[#22ec72]/40 flex items-center justify-center transition shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-extrabold text-white tracking-tight flex-1 min-w-0">
          AI Receptionist
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${statusPillClass(
            status.tone
          )}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(status.tone)}`} />
          {status.label === 'Active' ? 'Online' : status.label}
        </span>
      </div>
      <p className="-mt-2 px-1 text-xs text-zinc-400">{status.subline}</p>

      {/* Orb — the reference's big waveform circle. */}
      <div className="flex justify-center py-2">
        <div className="w-32 h-32 rounded-full border-2 border-[#22ec72] bg-[#22ec72]/5 shadow-[0_0_40px_rgba(34,236,114,0.25)] flex items-center justify-center">
          <AudioWaveform className="w-12 h-12 text-[#22ec72]" />
        </div>
      </div>

      {/* Today's real numbers — no deltas, no baselines. */}
      <div className={`grid grid-cols-3 gap-2 ${sidebarCard} p-3`}>
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-2xl font-extrabold text-white leading-none">{s.value}</div>
            <div className="text-xs font-bold text-zinc-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Settings rows — each opens a real screen. */}
      <div className={`${sidebarCard} divide-y divide-zinc-800/80 overflow-hidden`}>
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={row.onClick}
            className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-zinc-800/40 active:bg-zinc-800/60 transition cursor-pointer min-h-[48px]"
          >
            {row.icon}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">{row.title}</span>
              <span className="block text-xs text-zinc-400 truncate">{row.subtitle}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
