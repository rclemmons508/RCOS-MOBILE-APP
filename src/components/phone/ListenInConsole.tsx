import React, { useEffect, useRef, useState } from 'react';
import { Ear, Loader2, PhoneOff, Volume2, VolumeX, X } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { fetchListenToken, formatCallerNumber, liveCallDuration, type LiveCall } from '../../lib/liveCalls';
import {
  enableEarpieceForCall,
  setCallSpeakerphone,
  restoreAudioAfterCall,
} from '../../utils/audioRoute';

interface ListenInConsoleProps {
  call: LiveCall;
  businessId: string;
  onClose: () => void;
}

type ListenPhase = 'connecting' | 'listening' | 'ended' | 'error';

/**
 * Listen in on a live receptionist call — silent observer only.
 *
 * Joins the call's LiveKit room with a subscribe-only token (the server
 * mints it with canPublish: false), attaches the remote audio tracks,
 * and NEVER enables the microphone: there is no mic button anywhere in
 * this console, so the caller and the receptionist cannot hear the
 * owner. Audio starts on the earpiece, with a speaker toggle.
 */
export const ListenInConsole: React.FC<ListenInConsoleProps> = ({ call, businessId, onClose }) => {
  const [phase, setPhase] = useState<ListenPhase>('connecting');
  const [speakerOn, setSpeakerOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const audioElsRef = useRef(new Map<string, HTMLElement>());
  const timerRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const heardRef = useRef(false);
  const closedRef = useRef(false);

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const removeAudioEls = () => {
    for (const el of audioElsRef.current.values()) el.remove();
    audioElsRef.current.clear();
  };

  const cleanupRoom = () => {
    stopTimer();
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) room.disconnect();
    removeAudioEls();
  };

  const stopListening = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    cleanupRoom();
    setSpeakerOn(false);
    void restoreAudioAfterCall();
    onClose();
  };

  const endCall = (message: string) => {
    // The call itself ended — say so and stay open on the message until
    // the owner taps Close, instead of vanishing mid-sentence.
    stopTimer();
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
    removeAudioEls();
    setPhase('ended');
    setError(message);
  };

  // Connect once on mount; disconnect + restore audio on unmount.
  useEffect(() => {
    let cancelled = false;
    const connect = async () => {
      try {
        heardRef.current = false;
        const { token, url } = await fetchListenToken(call.roomName, businessId);
        if (cancelled) return;

        const room = new Room();
        roomRef.current = room;
        room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind === Track.Kind.Audio && !participant.isLocal) {
            heardRef.current = true;
            if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
            watchdogRef.current = null;
            const el = track.attach();
            el.style.display = 'none';
            document.body.appendChild(el);
            audioElsRef.current.set(track.sid || `${participant.identity}-${Date.now()}`, el);
            setPhase('listening');
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          const el = audioElsRef.current.get(track.sid || '');
          if (el) {
            el.remove();
            audioElsRef.current.delete(track.sid || '');
          }
        });
        room.on(RoomEvent.Disconnected, () => {
          if (!closedRef.current) endCall('The call ended.');
        });
        room.on(RoomEvent.ParticipantDisconnected, () => {
          // The last person on the call left — the call is over.
          if (room.remoteParticipants.size === 0 && !closedRef.current) {
            endCall('The call ended.');
          }
        });

        // Route call audio to the earpiece before any audio plays.
        await enableEarpieceForCall();
        setSpeakerOn(false);
        if (cancelled) {
          room.disconnect();
          return;
        }

        await room.connect(url, token);
        // Silent observer: the microphone is never enabled in this
        // console, and the listen token cannot publish anyway
        // (canPublish: false), so the owner can never be heard.
        await room.localParticipant.setMicrophoneEnabled(false);
        if (cancelled) {
          room.disconnect();
          return;
        }
        const startMs = new Date(call.startedAt).getTime();
        const initial = Number.isNaN(startMs) ? 0 : Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        setCallSeconds(initial);
        timerRef.current = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
        // If no audio arrives within 25s, the room may be empty or the
        // call may have ended before we joined — say so loudly.
        if (!heardRef.current) {
          watchdogRef.current = window.setTimeout(() => {
            if (heardRef.current) return;
            cleanupRoom();
            setPhase('error');
            setError('Could not hear the call. It may have ended just as you joined — try again from the Calls screen.');
          }, 25000);
        }
      } catch (e: any) {
        if (cancelled) return;
        setPhase('error');
        setError(e?.message || 'Could not listen in on this call. Please try again.');
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

  const toggleSpeaker = async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    await setCallSpeakerphone(next);
  };

  const mm = String(Math.floor(callSeconds / 60)).padStart(2, '0');
  const ss = String(callSeconds % 60).padStart(2, '0');

  const statusText =
    phase === 'connecting'
      ? 'Joining the call to listen…'
      : phase === 'listening'
        ? 'Listening in — muted, they can’t hear you'
        : phase === 'ended'
          ? 'Call ended'
          : 'Could not listen in';

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/85 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
            <Ear className="w-5 h-5 text-[#22ec72]" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-white truncate">
              Listening in · {formatCallerNumber(call.callerNumber)}
            </div>
            <div className="text-xs text-zinc-400 truncate">
              {call.status === 'answered' ? 'Receptionist is on the call' : 'Ringing — waiting for the receptionist'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={stopListening}
          aria-label="Stop listening"
          className="min-h-[48px] p-2 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 cursor-pointer shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Status */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 min-h-0">
        <div className="relative flex items-center justify-center">
          {phase === 'listening' && (
            <span className="animate-ping absolute inline-flex h-32 w-32 rounded-full bg-[#22ec72] opacity-20" />
          )}
          <div
            className={`w-28 h-28 rounded-full border-2 flex items-center justify-center transition ${
              phase === 'listening'
                ? 'border-[#22ec72] bg-[#22ec72]/10'
                : 'border-zinc-700 bg-zinc-900'
            }`}
          >
            {phase === 'connecting' ? (
              <Loader2 className="w-10 h-10 text-[#22ec72] animate-spin" />
            ) : (
              <Ear className={`w-10 h-10 ${phase === 'listening' ? 'text-[#22ec72]' : 'text-zinc-400'}`} />
            )}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-white">{statusText}</div>
          {(phase === 'listening' || phase === 'connecting') && (
            <div className="text-xs text-zinc-400 font-mono mt-1">
              {phase === 'listening' ? `${mm}:${ss}` : liveCallDuration(call.startedAt, Date.now())}
            </div>
          )}
          <div className="text-xs text-zinc-500 mt-2 max-w-xs">
            You hear the call. The caller and the receptionist cannot hear you.
          </div>
        </div>

        {(phase === 'error' || phase === 'ended') && error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 max-w-sm text-center">
            {error}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="px-6 pb-8 pt-2 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={toggleSpeaker}
            aria-pressed={speakerOn}
            title={speakerOn ? 'Switch to earpiece' : 'Switch to speakerphone'}
            className={`min-h-[48px] p-3 rounded-xl border flex items-center transition cursor-pointer active:scale-95 ${
              speakerOn
                ? 'bg-[#22ec72] text-black border-[#22ec72]'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            {speakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={stopListening}
            className="min-h-[48px] px-5 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm flex items-center gap-1.5 transition cursor-pointer active:scale-95"
          >
            <PhoneOff className="w-5 h-5" />
            <span>{phase === 'ended' || phase === 'error' ? 'Close' : 'Stop listening'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
