import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import {
  PhoneOff,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  TrendingUp,
  Kanban,
  Megaphone,
  HeartHandshake,
  ShieldAlert,
  Wrench,
  Receipt,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  enableEarpieceForCall,
  setCallSpeakerphone,
  restoreAudioAfterCall,
} from '../../utils/audioRoute';

export type TalkPersona = 'sales' | 'operations' | 'marketing' | 'support' | 'executive' | 'technician' | 'finance';

export const TALK_PERSONA_INFO: Record<
  TalkPersona,
  { name: string; role: string; hint: string }
> = {
  sales: {
    name: 'Sales',
    role: 'Quotes, pricing & lead follow-up',
    hint: 'Ask about a quote, a price, or following up a lead.',
  },
  operations: {
    name: 'Operations',
    role: 'Scheduling, dispatch & job status',
    hint: 'Talk through today\'s jobs, scheduling, or dispatch.',
  },
  marketing: {
    name: 'Marketing',
    role: 'Promotions, reviews & outreach',
    hint: 'Brainstorm a promotion, a review request, or a post.',
  },
  support: {
    name: 'Support',
    role: 'Customer issues & follow-ups',
    hint: 'Talk through a customer issue or complaint.',
  },
  executive: {
    name: 'Executive',
    role: 'Escalations, safety & owner decisions',
    hint: 'Talk through an escalation, a safety issue, or a decision that needs your call.',
  },
  technician: {
    name: 'Field Technician',
    role: 'Job Pack checklists & safety steps',
    hint: 'Walk through a Job Pack checklist or the safety steps before work starts.',
  },
  finance: {
    name: 'Finance',
    role: 'Invoices, balances & payments',
    hint: 'Check what is owed, what has been paid, or what to follow up on.',
  },
};

const PERSONA_ICONS: Record<TalkPersona, React.ReactNode> = {
  sales: <TrendingUp className="w-5 h-5 text-lime-400" />,
  operations: <Kanban className="w-5 h-5 text-purple-400" />,
  marketing: <Megaphone className="w-5 h-5 text-yellow-400" />,
  support: <HeartHandshake className="w-5 h-5 text-pink-400" />,
  executive: <ShieldAlert className="w-5 h-5 text-red-400" />,
  technician: <Wrench className="w-5 h-5 text-orange-400" />,
  finance: <Receipt className="w-5 h-5 text-emerald-400" />,
};

interface VoiceTokenResponse {
  token: string;
  url: string;
  room: string;
}

interface AgentTalkConsoleProps {
  persona: TalkPersona;
  agentName: string;
  agentRole: string;
  businessId?: string;
  onClose: () => void;
}

type TalkPhase = 'connecting' | 'connected' | 'error';

/**
 * Push-to-talk voice conversation with one of the seven AI agents.
 * Walkie-talkie style: hold the button to talk, release to listen.
 * On desktop, clicking the button toggles the mic instead of holding.
 * Audio starts on the earpiece (same as the receptionist call), with a
 * speaker toggle. The mic stays muted until the button is held.
 */
export const AgentTalkConsole: React.FC<AgentTalkConsoleProps> = ({
  persona,
  agentName,
  agentRole,
  businessId,
  onClose,
}) => {
  const [phase, setPhase] = useState<TalkPhase>('connecting');
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [talking, setTalking] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const agentTimeoutRef = useRef<number | null>(null);
  const closedRef = useRef(false);
  const lastPointerTypeRef = useRef<string>('touch');

  const info = TALK_PERSONA_INFO[persona];

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const cleanupRoom = () => {
    stopTimer();
    if (agentTimeoutRef.current) window.clearTimeout(agentTimeoutRef.current);
    agentTimeoutRef.current = null;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) room.disconnect();
    if (audioElRef.current) {
      audioElRef.current.remove();
      audioElRef.current = null;
    }
  };

  const endCall = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    cleanupRoom();
    setSpeakerOn(false);
    void restoreAudioAfterCall();
    onClose();
  };

  const failNoAgent = () => {
    agentTimeoutRef.current = null;
    cleanupRoom();
    setPhase('error');
    setError(
      `The ${info.name} agent did not answer. The voice worker may be offline — check that the rcos-voice-agent service is running in Railway.`
    );
  };

  // Connect once on mount; disconnect + restore audio on unmount.
  useEffect(() => {
    let cancelled = false;
    const connect = async () => {
      try {
        const { token, url } = await apiFetch<VoiceTokenResponse>('/api/voice/token', {
          method: 'POST',
          body: JSON.stringify({ businessId: businessId || 'default', persona }),
        });
        if (cancelled) return;

        const room = new Room();
        roomRef.current = room;
        room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind === Track.Kind.Audio && !participant.isLocal) {
            if (agentTimeoutRef.current) window.clearTimeout(agentTimeoutRef.current);
            agentTimeoutRef.current = null;
            const el = track.attach();
            el.style.display = 'none';
            document.body.appendChild(el);
            audioElRef.current = el;
            setPhase('connected');
          }
        });
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setAgentSpeaking(speakers.some((p) => !p.isLocal));
        });
        room.on(RoomEvent.Disconnected, () => {
          if (!closedRef.current) endCall();
        });
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (participant.isLocal) return;
          // The agent left the room — say so instead of sitting on a
          // fake "connected" screen in silence. Don't disconnect here:
          // disconnecting would fire RoomEvent.Disconnected and close
          // the console before the user sees this message. Cleanup
          // happens when the user taps Close/End or the console unmounts.
          stopTimer();
          if (agentTimeoutRef.current) window.clearTimeout(agentTimeoutRef.current);
          agentTimeoutRef.current = null;
          if (audioElRef.current) {
            audioElRef.current.remove();
            audioElRef.current = null;
          }
          setAgentSpeaking(false);
          setPhase('error');
          setError(
            `The ${info.name} agent left the call. Tap Close to end this conversation.`
          );
        });

        // Route call audio to the earpiece before any audio plays.
        await enableEarpieceForCall();
        setSpeakerOn(false);
        if (cancelled) {
          room.disconnect();
          return;
        }

        await room.connect(url, token);
        // Mic stays muted until the talk button is held.
        await room.localParticipant.setMicrophoneEnabled(false);
        if (cancelled) {
          room.disconnect();
          return;
        }
        setCallSeconds(0);
        timerRef.current = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
        // If no agent audio arrives within 25s, the worker is down — fail loudly.
        agentTimeoutRef.current = window.setTimeout(failNoAgent, 25000);
      } catch (e: any) {
        if (cancelled) return;
        setPhase('error');
        setError(
          e?.message ||
            'Could not start the conversation. Make sure the voice service is configured and you allowed microphone access.'
        );
      }
    };
    void connect();
    return () => {
      cancelled = true;
      cleanupRoom();
      void restoreAudioAfterCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTalking = async () => {
    const room = roomRef.current;
    if (!room || phase !== 'connected') return;
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      setTalking(true);
    } catch {
      // Mic could not be enabled (permission denied) — stay muted.
    }
  };

  const stopTalking = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
    } catch {
      // Already muted — nothing to do.
    }
    setTalking(false);
  };

  const toggleTalking = () => {
    if (talking) void stopTalking();
    else void startTalking();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    lastPointerTypeRef.current = e.pointerType;
    if (e.pointerType === 'mouse') return; // desktop uses click-to-toggle
    e.preventDefault();
    void startTalking();
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse') return;
    void stopTalking();
  };

  const handleClick = () => {
    if (lastPointerTypeRef.current === 'mouse') toggleTalking();
  };

  const toggleSpeaker = async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    await setCallSpeakerphone(next);
  };

  const mm = String(Math.floor(callSeconds / 60)).padStart(2, '0');
  const ss = String(callSeconds % 60).padStart(2, '0');

  const statusText =
    phase === 'connecting'
      ? 'Connecting…'
      : phase === 'error'
        ? 'Conversation ended'
        : agentSpeaking
          ? `${info.name} is speaking…`
          : talking
            ? 'You are talking…'
            : 'Listening… hold the button to talk';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
            {PERSONA_ICONS[persona]}
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-white truncate">
              {agentName} · {info.name}
            </div>
            <div className="text-[11px] text-zinc-400 truncate">{agentRole}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={endCall}
          aria-label="Close"
          className="p-2 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 cursor-pointer shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Status */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 min-h-0">
        <div className="relative flex items-center justify-center">
          {agentSpeaking && phase === 'connected' && (
            <span className="animate-ping absolute inline-flex h-32 w-32 rounded-full bg-lime-400 opacity-20" />
          )}
          <div
            className={`w-28 h-28 rounded-full border-2 flex items-center justify-center transition ${
              agentSpeaking && phase === 'connected'
                ? 'border-lime-400 bg-lime-500/10'
                : talking
                  ? 'border-red-400 bg-red-500/10'
                  : 'border-zinc-700 bg-zinc-900'
            }`}
          >
            {phase === 'connecting' ? (
              <Loader2 className="w-10 h-10 text-lime-400 animate-spin" />
            ) : agentSpeaking && phase === 'connected' ? (
              <Volume2 className="w-10 h-10 text-lime-400" />
            ) : talking ? (
              <Mic className="w-10 h-10 text-red-400" />
            ) : (
              <MicOff className="w-10 h-10 text-zinc-400" />
            )}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-white">{statusText}</div>
          {phase === 'connected' && (
            <div className="text-xs text-zinc-400 font-mono mt-1">{mm}:{ss}</div>
          )}
          {phase === 'connected' && (
            <div className="text-[11px] text-zinc-500 mt-2 max-w-xs">{info.hint}</div>
          )}
        </div>

        {phase === 'error' && error && (
          <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 max-w-sm text-center">
            {error}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="px-6 pb-8 pt-2 flex flex-col items-center gap-3">
        {phase !== 'error' ? (
          <>
            <button
              type="button"
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerEnd}
              onPointerLeave={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onClick={handleClick}
              disabled={phase !== 'connected'}
              aria-label={talking ? 'Stop talking' : 'Hold to talk'}
              className={`w-24 h-24 rounded-full border-4 font-bold text-xs flex flex-col items-center justify-center gap-1 transition select-none touch-none cursor-pointer active:scale-95 disabled:opacity-50 ${
                talking
                  ? 'bg-red-500 border-red-300 text-white'
                  : 'bg-lime-500 border-lime-300 text-black'
              }`}
            >
              {talking ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
              <span>{talking ? 'Talking…' : 'Hold to talk'}</span>
            </button>
            <div className="text-[11px] text-zinc-500 text-center">
              Hold the button to talk, release to listen.
              <br />
              On desktop, click once to talk, click again to stop.
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={endCall}
            className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm border border-zinc-700 cursor-pointer"
          >
            Close
          </button>
        )}

        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={toggleSpeaker}
            aria-pressed={speakerOn}
            title={speakerOn ? 'Switch to earpiece' : 'Switch to speakerphone'}
            className={`p-3 rounded-xl border flex items-center transition cursor-pointer active:scale-95 ${
              speakerOn
                ? 'bg-lime-500 text-black border-lime-500'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            {speakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={endCall}
            className="px-5 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm flex items-center gap-1.5 transition cursor-pointer active:scale-95"
          >
            <PhoneOff className="w-5 h-5" />
            <span>End</span>
          </button>
        </div>
      </div>
    </div>
  );
};
