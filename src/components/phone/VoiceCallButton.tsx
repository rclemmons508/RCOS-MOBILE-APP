import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { PhoneCall as PhoneIcon, PhoneOff, Loader2, Mic, Volume2, VolumeX, Grid3x3 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { enableEarpieceForCall, setCallSpeakerphone, restoreAudioAfterCall } from '../../utils/audioRoute';
import { playDtmfTone } from '../../utils/phoneAudio';
import { DtmfKeypad } from './DtmfKeypad';

type CallState = 'idle' | 'connecting' | 'in-call' | 'error';

/**
 * RFC 4733 DTMF event codes, as required by
 * LocalParticipant.publishDtmf(code, digit): 0–9 are their own digits,
 * '*' is 10, '#' is 11.
 */
const DTMF_CODES: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '*': 10, '#': 11,
};

interface VoiceTokenResponse {
  token: string;
  url: string;
  room: string;
}

/**
 * "Call us" button — free in-app voice call to the AI receptionist over WebRTC.
 * No phone number needed.
 */
export const VoiceCallButton: React.FC<{ businessId?: string }> = ({ businessId }) => {
  const [state, setState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(false);
  // In-call keypad: open state + the digits already sent this call live in
  // this call screen, so the record survives opening/closing the pad
  // mid-call. It cannot survive a tab switch — the Phone tab unmounts on
  // every tab switch and teardown() below ends the call by design.
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [sentDigits, setSentDigits] = useState('');
  const [dtmfError, setDtmfError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const timerRef = useRef<number | null>(null);
  const agentTimeoutRef = useRef<number | null>(null);
  // Set the moment the agent's audio track is heard — including during
  // room.connect(), before the no-agent watchdog below is armed.
  const agentHeardRef = useRef(false);
  // <audio> elements attached for remote tracks, so they can be detached.
  const audioElsRef = useRef<HTMLMediaElement[]>([]);
  // True once enableEarpieceForCall() ran, so the route is always restored.
  const audioRoutedRef = useRef(false);
  // Bumped by every start/teardown so a startCall() still awaiting the
  // token or room.connect() knows it was cancelled (unmount / End call).
  const callGenRef = useRef(0);
  const mountedRef = useRef(true);

  const startTimer = () => {
    setCallSeconds(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (mountedRef.current) setCallSeconds((s) => s + 1);
    }, 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  /**
   * Release everything a call holds: timers, the LiveKit room (which also
   * stops the local mic track), any attached <audio> elements, and the
   * Android audio route. Safe to call repeatedly and after unmount.
   */
  const teardown = () => {
    callGenRef.current += 1;
    stopTimer();
    setKeypadOpen(false);
    setSentDigits('');
    setDtmfError(null);
    if (agentTimeoutRef.current) window.clearTimeout(agentTimeoutRef.current);
    agentTimeoutRef.current = null;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.removeAllListeners();
      try {
        // Stop the mic explicitly; disconnect(true) also stops local tracks.
        room.localParticipant.trackPublications.forEach((pub) => pub.track?.stop());
      } catch {
        /* ignore */
      }
      void room.disconnect(true).catch(() => {});
    }
    audioElsRef.current.forEach((el) => {
      try {
        el.pause();
        el.srcObject = null;
      } catch {
        /* ignore */
      }
      el.remove();
    });
    audioElsRef.current = [];
    if (audioRoutedRef.current) {
      audioRoutedRef.current = false;
      void restoreAudioAfterCall();
    }
  };

  const endCall = () => {
    teardown();
    if (!mountedRef.current) return;
    setSpeakerOn(false);
    setState('idle');
  };

  /**
   * Send one DTMF digit on the live call, the real way: LiveKit's SIP
   * DTMF message (LocalParticipant.publishDtmf) travels over the room's
   * reliable data channel, and LiveKit forwards it to the SIP leg when the
   * room is bridged to a phone call. The local tone only plays once the
   * send succeeds — a failed send shows an error instead of a tone that
   * would pretend the digit went out.
   */
  const sendDtmf = async (digit: string) => {
    const room = roomRef.current;
    if (!room) {
      setDtmfError('No live call — the keypad only works during a call.');
      return;
    }
    try {
      await room.localParticipant.publishDtmf(DTMF_CODES[digit], digit);
      playDtmfTone(digit);
      setSentDigits((prev) => prev + digit);
      setDtmfError(null);
    } catch (e) {
      console.warn('[VoiceCall] DTMF send failed:', e);
      setDtmfError('That keypress did not go out — the call may have dropped. Try again, or end the call and redial.');
    }
  };

  // The Phone tab unmounts on every tab switch: never leave a live mic,
  // a connected room or MODE_IN_COMMUNICATION behind.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failNoAgent = () => {
    // Never kill a call the agent actually answered.
    if (agentHeardRef.current) return;
    agentTimeoutRef.current = null;
    teardown();
    if (!mountedRef.current) return;
    setSpeakerOn(false);
    setState('error');
    setError('The AI receptionist did not answer. The voice worker may be offline — check that the rcos-voice-agent service is running in Railway.');
  };

  const startCall = async () => {
    teardown(); // drop any half-open previous attempt
    const gen = callGenRef.current;
    const cancelled = () => gen !== callGenRef.current || !mountedRef.current;
    setError(null);
    agentHeardRef.current = false;
    setState('connecting');
    try {
      // 1. Ask our server for a voice-call token (requires login)
      const { token, url } = await apiFetch<VoiceTokenResponse>('/api/voice/token', {
        method: 'POST',
        body: JSON.stringify({ businessId: businessId || 'default' }),
      });
      if (cancelled()) return;

      // 2. Connect to the voice room and turn on the microphone
      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio && !participant.isLocal) {
          // Agent joined and is speaking - cancel the no-agent timeout
          agentHeardRef.current = true;
          if (agentTimeoutRef.current) window.clearTimeout(agentTimeoutRef.current);
          agentTimeoutRef.current = null;
          const el = track.attach();
          el.style.display = 'none';
          document.body.appendChild(el);
          audioElsRef.current.push(el);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        const detached = track.detach();
        detached.forEach((el) => el.remove());
        audioElsRef.current = audioElsRef.current.filter((el) => !detached.includes(el));
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) endCall();
      });

      // Route call audio to the earpiece (never the loudspeaker) before any audio plays
      audioRoutedRef.current = true;
      await enableEarpieceForCall();
      if (cancelled()) return;
      setSpeakerOn(false);

      await room.connect(url, token);
      if (cancelled()) return;
      await room.localParticipant.setMicrophoneEnabled(true);
      if (cancelled()) return;

      setState('in-call');
      startTimer();
      // If no agent audio arrives within 25s, the worker is down - fail loudly.
      // Arm ONLY if the agent has not already been heard: the agent is
      // dispatched into the room before this client connects, so its audio
      // track can subscribe during room.connect() — before this line runs.
      // Arming the watchdog anyway left nothing to cancel it, and it killed
      // healthy calls at exactly 25s (Oct 20, 2026).
      if (!agentHeardRef.current) {
        agentTimeoutRef.current = window.setTimeout(failNoAgent, 25000);
      }
    } catch (e: any) {
      // A failed connect must not leave the room half-open, the mic live
      // or Android stuck in call audio mode.
      const wasCancelled = cancelled();
      teardown();
      if (wasCancelled || !mountedRef.current) return;
      setSpeakerOn(false);
      setState('error');
      setError(
        e?.message ||
          'Could not start the call. Make sure the voice service is configured and you allowed microphone access.'
      );
    }
  };

  const toggleSpeaker = async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    await setCallSpeakerphone(next);
  };

  const mm = String(Math.floor(callSeconds / 60)).padStart(2, '0');
  const ss = String(callSeconds % 60).padStart(2, '0');

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-b from-[#22ec72]/10 to-zinc-950 border border-[#22ec72]/30 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-[#22ec72]/15 border border-[#22ec72]/30">
          <Mic className="w-4 h-4 text-[#22ec72]" />
        </div>
        <div>
          <div className="text-xs font-bold text-white">Call us — free voice call</div>
          <div className="text-xs text-zinc-400">
            Talk to the AI receptionist right from the app. No phone number needed.
          </div>
        </div>
      </div>

      {state === 'in-call' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-zinc-300 font-mono">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22ec72] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22ec72]" />
              </span>
              On the call — {mm}:{ss}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setKeypadOpen((open) => !open)}
                aria-pressed={keypadOpen}
                title={keypadOpen ? 'Hide keypad' : 'Show keypad'}
                className={`min-h-[48px] px-3 py-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition cursor-pointer active:scale-95 ${
                  keypadOpen
                    ? 'bg-[#22ec72] text-black border-[#22ec72]'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
                <span>Keypad</span>
              </button>
              <button
                type="button"
                onClick={toggleSpeaker}
                aria-pressed={speakerOn}
                title={speakerOn ? 'Switch to earpiece' : 'Switch to speakerphone'}
                className={`min-h-[48px] p-2.5 rounded-xl border flex items-center transition cursor-pointer active:scale-95 ${
                  speakerOn
                    ? 'bg-[#22ec72] text-black border-[#22ec72]'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                {speakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={endCall}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End call</span>
              </button>
            </div>
          </div>

          {keypadOpen && (
            <DtmfKeypad
              sentDigits={sentDigits}
              onDigit={(digit) => void sendDtmf(digit)}
              onClear={() => setSentDigits('')}
            />
          )}

          {dtmfError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
              {dtmfError}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={startCall}
          disabled={state === 'connecting'}
          className="min-h-[48px] w-full px-4 py-3 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] disabled:opacity-60 text-black font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-[#22ec72]/20 active:scale-98"
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
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
};
