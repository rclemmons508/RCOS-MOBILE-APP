import React, { useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { PhoneCall as PhoneIcon, PhoneOff, Loader2, Mic } from 'lucide-react';
import { apiFetch } from '../../lib/api';

type CallState = 'idle' | 'connecting' | 'in-call' | 'error';

interface VoiceTokenResponse {
  token: string;
  url: string;
  room: string;
}

/**
 * "Call us" button — free in-app voice call to the AI receptionist over WebRTC.
 * Used for testing/review while the Twilio carrier is parked. No phone number needed.
 */
export const VoiceCallButton: React.FC<{ businessId?: string }> = ({ businessId }) => {
  const [state, setState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const roomRef = useRef<Room | null>(null);
  const timerRef = useRef<number | null>(null);

  const startTimer = () => {
    setCallSeconds(0);
    timerRef.current = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const endCall = () => {
    stopTimer();
    const room = roomRef.current;
    roomRef.current = null;
    if (room) room.disconnect();
    setState('idle');
  };

  const startCall = async () => {
    setError(null);
    setState('connecting');
    try {
      // 1. Ask our server for a voice-call token (requires login)
      const { token, url } = await apiFetch<VoiceTokenResponse>('/api/voice/token', {
        method: 'POST',
        body: JSON.stringify({ businessId: businessId || 'default' }),
      });

      // 2. Connect to the voice room and turn on the microphone
      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.style.display = 'none';
          document.body.appendChild(el);
        }
      });
      room.on(RoomEvent.Disconnected, () => endCall());

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      setState('in-call');
      startTimer();
    } catch (e: any) {
      setState('error');
      setError(
        e?.message ||
          'Could not start the call. Make sure the voice service is configured and you allowed microphone access.'
      );
    }
  };

  const mm = String(Math.floor(callSeconds / 60)).padStart(2, '0');
  const ss = String(callSeconds % 60).padStart(2, '0');

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-b from-lime-500/10 to-zinc-950 border border-lime-500/30 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-lime-500/15 border border-lime-500/30">
          <Mic className="w-4 h-4 text-lime-400" />
        </div>
        <div>
          <div className="text-xs font-bold text-white">Call us — free voice call</div>
          <div className="text-[10.5px] text-zinc-400">
            Talk to the AI receptionist right from the app. No phone number needed.
          </div>
        </div>
      </div>

      {state === 'in-call' ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-zinc-300 font-mono">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-lime-400" />
            </span>
            On the call — {mm}:{ss}
          </div>
          <button
            type="button"
            onClick={endCall}
            className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End call</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startCall}
          disabled={state === 'connecting'}
          className="w-full px-4 py-3 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:opacity-60 text-black font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-lime-500/20 active:scale-98"
        >
          {state === 'connecting' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting…</span>
            </>
          ) : (
            <>
              <PhoneIcon className="w-4 h-4" />
              <span>Call the AI receptionist</span>
            </>
          )}
        </button>
      )}

      {state === 'error' && error && (
        <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
};
