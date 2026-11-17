import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import {
  Delete,
  Grid3x3,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneCall as PhoneIcon,
  PhoneOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { withBusinessId } from '../../lib/businessScope';
import {
  callClock,
  dialNumber,
  fetchOutboundStatus,
  formatDialDisplay,
  hangupOutboundCall,
  type OutboundStatus,
} from '../../lib/outboundCalls';
import { formatCallerNumber } from '../../lib/liveCalls';
import { enableEarpieceForCall, setCallSpeakerphone, restoreAudioAfterCall } from '../../utils/audioRoute';
import { playDtmfTone } from '../../utils/phoneAudio';
import { DtmfKeypad } from './DtmfKeypad';

/**
 * RFC 4733 DTMF event codes, as required by
 * LocalParticipant.publishDtmf(code, digit): 0–9 are their own digits,
 * '*' is 10, '#' is 11. (Same table as VoiceCallButton.)
 */
const DTMF_CODES: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '*': 10, '#': 11,
};

const DIAL_KEYS: { digit: string; letters: string }[] = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

type DialerState = 'idle' | 'dialing' | 'in-call' | 'ended' | 'error';

/** Outbound calling is not set up yet — the dialer says so and shows
 *  the setup, instead of a Call button that pretends to work. */
const SETUP_MESSAGE =
  'Outbound calling is not set up yet. The server needs a stored outbound SIP trunk: 1) in the Vonage dashboard (Voice → SIP) create a SIP trunk and link a Vonage number to it, 2) in the LiveKit dashboard (Telephony → SIP trunks) create an outbound trunk with that Vonage trunk, 3) set LIVEKIT_SIP_OUTBOUND_TRUNK_ID to the trunk id in Railway. Full steps: SETUP.md §4.';

/**
 * Dial out from the app — a real phone keypad that calls a real number.
 *
 * The number is dialed through the server (POST /api/calls/dial), which
 * creates a LiveKit room and dials the number into it as a SIP
 * participant over the business's outbound SIP trunk. The owner talks
 * through the room with the mic on. Earpiece by default, with an
 * on-screen speakerphone switch; mute, keypad (DTMF), and End call in
 * the call screen. When the call ends, the real call is written to the
 * call log (POST /api/phone/calls) — nothing here is ever invented.
 */
export const OutboundDialer: React.FC<{ businessId: string }> = ({ businessId }) => {
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState<OutboundStatus | null>(null);
  const [state, setState] = useState<DialerState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [sentDigits, setSentDigits] = useState('');
  const [dtmfError, setDtmfError] = useState<string | null>(null);
  const [dialedTo, setDialedTo] = useState('');

  const roomRef = useRef<Room | null>(null);
  const roomNameRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const noAudioTimeoutRef = useRef<number | null>(null);
  const audioElsRef = useRef<HTMLMediaElement[]>([]);
  const audioRoutedRef = useRef(false);
  const heardRef = useRef(false);
  const callGenRef = useRef(0);
  const mountedRef = useRef(true);
  const callStartedAtRef = useRef<number>(0);
  // Refs mirror the call state for the room-event handlers, which close
  // over the render where the call started — reading state there would
  // see the stale (0 / '') values from before the call began.
  const callSecondsRef = useRef(0);
  const dialedToRef = useRef('');

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const clearNoAudioTimeout = () => {
    if (noAudioTimeoutRef.current) window.clearTimeout(noAudioTimeoutRef.current);
    noAudioTimeoutRef.current = null;
  };

  /** Release everything a call holds: timers, the LiveKit room (which
   *  also stops the local mic track), attached <audio> elements, and
   *  the Android audio route. Safe to call repeatedly and after unmount. */
  const teardown = () => {
    callGenRef.current += 1;
    stopTimer();
    clearNoAudioTimeout();
    setKeypadOpen(false);
    setSentDigits('');
    setDtmfError(null);
    const room = roomRef.current;
    roomRef.current = null;
    roomNameRef.current = null;
    if (room) {
      room.removeAllListeners();
      try {
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

  // Outbound readiness on mount; a failed read leaves the status
  // unknown (null) and the dial attempt surfaces the real error.
  useEffect(() => {
    mountedRef.current = true;
    if (businessId) {
      fetchOutboundStatus(businessId)
        .then((s) => {
          if (mountedRef.current) setStatus(s);
        })
        .catch(() => {});
    }
    return () => {
      mountedRef.current = false;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  /** Write the real outbound call to the call log so it shows up in the
   *  Calls list. Only real calls are ever logged — never a placeholder. */
  const logCall = (to: string, seconds: number) => {
    if (!businessId || seconds <= 0) return;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    void apiFetch(withBusinessId('/api/phone/calls', businessId), {
      method: 'POST',
      body: JSON.stringify({
        callerName: formatCallerNumber(to),
        callerNumber: to,
        type: 'outbound',
        status: 'completed',
        timestamp: new Date(callStartedAtRef.current || Date.now()).toISOString(),
        duration: `${m}m ${String(s).padStart(2, '0')}s`,
        summary: `Outbound call to ${formatCallerNumber(to)} from the app dialer.`,
        isRealPstnCall: true,
      }),
    }).catch(() => {});
  };

  const endCall = (message?: string) => {
    const roomName = roomNameRef.current;
    const seconds = callSecondsRef.current;
    const to = dialedToRef.current;
    // Tell the server to drop the SIP leg (best-effort: the room may
    // already be gone if the callee hung up).
    if (roomName) void hangupOutboundCall(roomName, businessId);
    teardown();
    if (!mountedRef.current) return;
    setSpeakerOn(false);
    setMuted(false);
    if (to && seconds > 0) logCall(to, seconds);
    if (message) {
      setError(message);
      setState('error');
    } else {
      setState('ended');
    }
  };

  const failNoAudio = () => {
    // Never kill a call that is actually connected.
    if (heardRef.current) return;
    noAudioTimeoutRef.current = null;
    endCall('No answer — the call was not picked up within 50 seconds.');
  };

  const startCall = async () => {
    const digits = number.replace(/\D/g, '');
    if (digits.length < 7) {
      setError('Enter a full phone number first.');
      return;
    }
    if (status && !status.configured) {
      setError(SETUP_MESSAGE);
      return;
    }
    teardown(); // drop any half-open previous attempt
    const gen = callGenRef.current;
    const cancelled = () => gen !== callGenRef.current || !mountedRef.current;
    setError(null);
    heardRef.current = false;
    setDialedTo(number);
    dialedToRef.current = number;
    setState('dialing');
    try {
      // 1. Ask the server to dial the number (room + SIP participant).
      const { token, url, room } = await dialNumber(number, businessId);
      if (cancelled()) return;
      roomNameRef.current = room;
      callStartedAtRef.current = Date.now();

      // 2. Join the room and turn on the microphone — this is a call
      //    the owner is ON, not one they listen in on.
      const livekitRoom = new Room();
      roomRef.current = livekitRoom;
      livekitRoom.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio && !participant.isLocal) {
          heardRef.current = true;
          clearNoAudioTimeout();
          const el = track.attach();
          el.style.display = 'none';
          document.body.appendChild(el);
          audioElsRef.current.push(el);
          if (!cancelled()) {
            setState('in-call');
            setCallSeconds(0);
            callSecondsRef.current = 0;
            if (timerRef.current) window.clearInterval(timerRef.current);
            timerRef.current = window.setInterval(() => {
              if (mountedRef.current) {
                callSecondsRef.current += 1;
                setCallSeconds(callSecondsRef.current);
              }
            }, 1000);
          }
        }
      });
      livekitRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        const detached = track.detach();
        detached.forEach((el) => el.remove());
        audioElsRef.current = audioElsRef.current.filter((el) => !detached.includes(el));
      });
      livekitRoom.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === livekitRoom) endCall();
      });
      livekitRoom.on(RoomEvent.ParticipantDisconnected, () => {
        // The other side left — the call is over.
        if (livekitRoom.remoteParticipants.size === 0 && !cancelled()) endCall();
      });

      // Route call audio to the earpiece (never the loudspeaker)
      // before any audio plays.
      audioRoutedRef.current = true;
      await enableEarpieceForCall();
      if (cancelled()) return;
      setSpeakerOn(false);
      setMuted(false);

      await livekitRoom.connect(url, token);
      if (cancelled()) return;
      await livekitRoom.localParticipant.setMicrophoneEnabled(true);
      if (cancelled()) return;

      // If no audio (ring tone or voice) arrives within 50s, the call
      // was not picked up — say so instead of ringing forever. The
      // server's own 60s ring timeout ends the SIP leg either way.
      if (!heardRef.current) {
        noAudioTimeoutRef.current = window.setTimeout(failNoAudio, 50000);
      }
    } catch (e: any) {
      const wasCancelled = cancelled();
      teardown();
      if (wasCancelled || !mountedRef.current) return;
      setSpeakerOn(false);
      setState('error');
      setError(
        e?.message ||
          'Could not place the call. Make sure the number is right and outbound calling is set up, then try again.',
      );
    }
  };

  const toggleSpeaker = async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    await setCallSpeakerphone(next);
  };

  const toggleMute = async () => {
    const room = roomRef.current;
    const next = !muted;
    setMuted(next);
    if (room) {
      try {
        await room.localParticipant.setMicrophoneEnabled(!next);
      } catch {
        setMuted(!next);
      }
    }
  };

  /**
   * Send one DTMF digit on the live call, the real way: LiveKit's SIP
   * DTMF message (LocalParticipant.publishDtmf) travels over the room's
   * reliable data channel, and LiveKit forwards it to the SIP leg. The
   * local tone only plays once the send succeeds — a failed send shows
   * an error instead of a tone that would pretend the digit went out.
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
      console.warn('[OutboundDialer] DTMF send failed:', e);
      setDtmfError('That keypress did not go out — the call may have dropped. Try again, or end the call and redial.');
    }
  };

  const appendDigit = (digit: string) => {
    if (state !== 'idle' && state !== 'error' && state !== 'ended') return;
    setError(null);
    setNumber((prev) => {
      // Keep the dial string to plausible phone characters only.
      const next = `${prev}${digit}`.replace(/[^0-9+*#]/g, '');
      return next.slice(0, 20);
    });
  };

  const backspace = () => {
    if (state !== 'idle' && state !== 'error' && state !== 'ended') return;
    setNumber((prev) => prev.slice(0, -1));
  };

  const onNumberInput = (value: string) => {
    if (state !== 'idle' && state !== 'error' && state !== 'ended') return;
    setError(null);
    setNumber(value.replace(/[^0-9+*#]/g, '').slice(0, 20));
  };

  const canDial = number.replace(/\D/g, '').length >= 7 && state !== 'dialing';
  const notConfigured = status !== null && !status.configured;

  // --- In-call screen (full-screen overlay, like ListenInConsole) ---
  if (state === 'dialing' || state === 'in-call') {
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/95 flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
              <PhoneIcon className="w-5 h-5 text-[#22ec72]" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold text-white truncate">
                {formatCallerNumber(dialedTo)}
              </div>
              <div className="text-xs text-zinc-400 truncate">
                {state === 'dialing' ? 'Calling…' : `On the call — ${callClock(callSeconds)}`}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 min-h-0">
          <div className="relative flex items-center justify-center">
            {state === 'in-call' && (
              <span className="animate-ping absolute inline-flex h-32 w-32 rounded-full bg-[#22ec72] opacity-20" />
            )}
            <div
              className={`w-28 h-28 rounded-full border-2 flex items-center justify-center transition ${
                state === 'in-call'
                  ? 'border-[#22ec72] bg-[#22ec72]/10'
                  : 'border-zinc-700 bg-zinc-900'
              }`}
            >
              {state === 'dialing' ? (
                <Loader2 className="w-10 h-10 text-[#22ec72] animate-spin" />
              ) : (
                <PhoneIcon className="w-10 h-10 text-[#22ec72]" />
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-white">
              {state === 'dialing' ? 'Calling…' : 'On the call'}
            </div>
            <div className="text-xs text-zinc-400 font-mono mt-1">
              {state === 'in-call' ? callClock(callSeconds) : 'Waiting for an answer'}
            </div>
            <div className="text-xs text-zinc-500 mt-2 max-w-xs">
              {muted ? 'You are muted — they cannot hear you.' : 'They can hear you. Audio starts on the earpiece.'}
            </div>
          </div>
        </div>

        <div className="px-6 pb-8 pt-2 flex flex-col items-center gap-3">
          {keypadOpen && (
            <div className="w-full max-w-sm">
              <DtmfKeypad
                sentDigits={sentDigits}
                onDigit={(digit) => void sendDtmf(digit)}
                onClear={() => setSentDigits('')}
              />
            </div>
          )}
          {dtmfError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 max-w-sm text-center">
              {dtmfError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void toggleMute()}
              aria-pressed={muted}
              title={muted ? 'Unmute' : 'Mute'}
              className={`min-h-[48px] p-3 rounded-xl border flex items-center transition cursor-pointer active:scale-95 ${
                muted
                  ? 'bg-[#22ec72] text-black border-[#22ec72]'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setKeypadOpen((open) => !open)}
              aria-pressed={keypadOpen}
              title={keypadOpen ? 'Hide keypad' : 'Show keypad'}
              className={`min-h-[48px] p-3 rounded-xl border flex items-center transition cursor-pointer active:scale-95 ${
                keypadOpen
                  ? 'bg-[#22ec72] text-black border-[#22ec72]'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => void toggleSpeaker()}
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
              onClick={() => endCall()}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <PhoneOff className="w-5 h-5" />
              <span>End call</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Dial pad ---
  return (
    <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-[#22ec72]/15 border border-[#22ec72]/30">
          <Phone className="w-4 h-4 text-[#22ec72]" />
        </div>
        <div>
          <div className="text-xs font-bold text-white">Dial out</div>
          <div className="text-xs text-zinc-400">
            Call any number from the app — it rings from your business line.
          </div>
        </div>
      </div>

      {notConfigured && (
        <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {SETUP_MESSAGE}
        </p>
      )}

      {/* Number display — type, paste, or use the keypad below. */}
      <div className="flex items-center gap-2">
        <input
          type="tel"
          inputMode="tel"
          value={formatDialDisplay(number)}
          onChange={(e) => onNumberInput(e.target.value)}
          placeholder="(555) 123-4567"
          aria-label="Number to call"
          className="flex-1 min-w-0 min-h-[48px] px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-base text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-[#22ec72]"
        />
        <button
          type="button"
          onClick={backspace}
          disabled={!number}
          aria-label="Delete last digit"
          className="min-h-[48px] min-w-[48px] p-2.5 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-40 transition cursor-pointer active:scale-95 flex items-center justify-center"
        >
          <Delete className="w-4 h-4" />
        </button>
      </div>

      {/* Keys — 48dp minimum touch targets, 12px minimum text */}
      <div className="grid grid-cols-3 gap-2">
        {DIAL_KEYS.map(({ digit, letters }) => (
          <button
            key={digit}
            type="button"
            onClick={() => {
              appendDigit(digit);
              playDtmfTone(digit);
            }}
            aria-label={`Dial ${digit}`}
            className="min-h-[56px] rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border border-zinc-700 transition cursor-pointer active:scale-95 flex flex-col items-center justify-center"
          >
            <span className="text-xl font-bold text-white leading-none">{digit}</span>
            {letters && (
              <span className="text-xs text-zinc-400 font-bold tracking-widest mt-0.5">{letters}</span>
            )}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void startCall()}
        disabled={!canDial || notConfigured}
        title={notConfigured ? 'Outbound calling is not set up yet — see the note above' : undefined}
        className="min-h-[48px] w-full px-4 py-3 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] disabled:opacity-40 text-black font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-[#22ec72]/20 active:scale-98"
      >
        <PhoneIcon className="w-4 h-4" />
        <span>Call</span>
      </button>

      {(state === 'error' || state === 'ended') && (
        <p
          className={`text-xs rounded-xl px-3 py-2 ${
            state === 'error'
              ? 'text-red-400 bg-red-500/10 border border-red-500/30'
              : 'text-zinc-400 bg-zinc-900 border border-zinc-800'
          }`}
        >
          {state === 'error' ? error : 'Call ended.'}
        </p>
      )}
      {state === 'error' && !error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          Could not place the call. Please try again.
        </p>
      )}
    </div>
  );
};
