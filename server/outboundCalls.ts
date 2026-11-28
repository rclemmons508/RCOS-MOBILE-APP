/**
 * Outbound dialing — dial a real phone number from the app through
 * LiveKit SIP (server/outboundCalls.ts).
 *
 * How it works: the server creates a LiveKit room, asks LiveKit to dial
 * the number into it as a SIP participant (CreateSIPParticipant), and
 * hands the app a publish-capable token so the owner can talk. Hanging
 * up deletes the room, which drops the SIP leg too.
 *
 * What this deliberately does NOT do:
 * - No agent is dispatched into an outbound room (unlike
 *   POST /api/voice/token): the receptionist must never join a call the
 *   owner dialed out.
 * - No outbound trunk is created here. LiveKit cannot dial out on its
 *   own number alone — CreateSIPParticipant needs a stored outbound SIP
 *   trunk (a SIP provider such as Vonage, which the business already
 *   uses for SMS). The trunk id comes from
 *   LIVEKIT_SIP_OUTBOUND_TRUNK_ID; until it is set, dialing answers
 *   503 with code `outbound_trunk_not_configured` and the app says so
 *   instead of pretending to call. Setup steps live in SETUP.md §4.
 * - Destination policy is the same as every other dial-out path
 *   (server/phone-policy.ts): strict E.164, US/Canada by default,
 *   Caribbean and premium-rate +1 numbers blocked, plus a per-business
 *   daily cap (OUTBOUND_CALLS_DAILY_CAP, default 100) as a fraud brake.
 */

import { AccessToken, RoomServiceClient, SipClient } from 'livekit-server-sdk';
import { checkDestination, envInt, takeDailyQuota } from './phone-policy';

/** Outbound rooms are named `outbound-<businessId>-<epochMs>`. The live-
 *  call registry (server/liveCalls.ts) ignores this prefix: an outbound
 *  call is the owner's own call, not a receptionist call to listen in on. */
export const OUTBOUND_ROOM_PREFIX = 'outbound-';

/**
 * Audit Phase 2 (finding 15) — a server-side cap on how long an
 * outbound call may run. Nothing capped it before: if the app died or
 * the hangup request was lost, the SIP leg could run until someone
 * noticed the bill. A normal business call is minutes; two hours is a
 * generous ceiling for a stuck one. Override with
 * MAX_CALL_DURATION_MINUTES. The cap is enforced twice: a timer set
 * when the call is dialed, and a sweeper (below) that reaps any
 * outbound room older than the cap — the sweeper also covers rooms
 * orphaned by a restart, which the in-process timer cannot.
 */
export function maxOutboundCallDurationMs(): number {
  const mins = Number(process.env.MAX_CALL_DURATION_MINUTES);
  return (Number.isFinite(mins) && mins > 0 ? mins : 120) * 60_000;
}

/** In-process timers for live outbound calls, so a hangup cancels the
 *  cap timer instead of leaving it to fire on a dead room. */
const callCapTimers = new Map<string, NodeJS.Timeout>();

function scheduleOutboundCallCap(roomName: string): void {
  const existing = callCapTimers.get(roomName);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    callCapTimers.delete(roomName);
    console.error(`[outbound] Call ${roomName} hit the ${Math.round(maxOutboundCallDurationMs() / 60_000)}-minute cap — hanging up.`);
    void hangupOutboundCall(roomName);
  }, maxOutboundCallDurationMs());
  timer.unref?.();
  callCapTimers.set(roomName, timer);
}

export class OutboundNotConfiguredError extends Error {}
export class OutboundDialError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export interface OutboundDialResult {
  token: string;
  url: string;
  room: string;
  to: string;
  sipParticipantId: string;
  sipCallId: string;
}

/** True when the server has everything needed to dial out (LiveKit
 *  credentials + a stored outbound SIP trunk id). */
export function isOutboundConfigured(): boolean {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_SIP_OUTBOUND_TRUNK_ID } = process.env;
  return Boolean(
    LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_SIP_OUTBOUND_TRUNK_ID?.trim(),
  );
}

function livekitEnv(): { url: string; key: string; secret: string; trunkId: string } {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_SIP_OUTBOUND_TRUNK_ID } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new OutboundDialError(
      'Voice calling is not configured yet (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET).',
      503,
    );
  }
  const trunkId = (LIVEKIT_SIP_OUTBOUND_TRUNK_ID || '').trim();
  if (!trunkId) {
    throw new OutboundNotConfiguredError(
      'Outbound calling is not set up yet — no outbound SIP trunk is configured on this server (LIVEKIT_SIP_OUTBOUND_TRUNK_ID). See SETUP.md §4.',
    );
  }
  return { url: LIVEKIT_URL, key: LIVEKIT_API_KEY, secret: LIVEKIT_API_SECRET, trunkId };
}

/**
 * Dial `to` from the app. Creates the room, dials the number in as a SIP
 * participant, and returns a publish-capable token for the caller. The
 * room is deleted again when the dial itself fails, so a failed dial
 * never leaves an empty room behind.
 */
export async function dialOutboundCall(opts: {
  to: string;
  businessId: string;
  callerUid: string;
  callerEmail: string;
}): Promise<OutboundDialResult> {
  const { url, key, secret, trunkId } = livekitEnv();

  const dest = checkDestination(opts.to);
  if (!dest.ok) throw new OutboundDialError(dest.error, 400);

  const cap = envInt('OUTBOUND_CALLS_DAILY_CAP', 100);
  if (!takeDailyQuota('outbound-call', opts.businessId, cap)) {
    throw new OutboundDialError(
      `Daily outbound call limit reached (${cap} calls). Try again tomorrow.`,
      429,
    );
  }

  const roomName = `${OUTBOUND_ROOM_PREFIX}${opts.businessId}-${Date.now()}`;
  const roomClient = new RoomServiceClient(url, key, secret);
  let roomCreated = false;
  try {
    await roomClient.createRoom({
      name: roomName,
      emptyTimeout: 60,
      departureTimeout: 20,
      maxParticipants: 2,
      // No `agents` dispatch: the receptionist never joins an outbound call.
      metadata: JSON.stringify({ businessId: opts.businessId, direction: 'outbound', to: dest.e164 }),
    });
    roomCreated = true;

    const sip = new SipClient(url, key, secret);
    // Caller ID shown to the callee: the trunk's own number by default.
    // Override only when the owner knows a number their trunk is allowed
    // to present (LIVEKIT_SIP_OUTBOUND_CALLER_ID).
    const fromNumber = (process.env.LIVEKIT_SIP_OUTBOUND_CALLER_ID || '').trim() || undefined;
    const info = await sip.createSipParticipant(trunkId, dest.e164, roomName, {
      playDialtone: true,
      ringingTimeout: 60,
      participantName: dest.e164,
      ...(fromNumber ? { fromNumber } : {}),
    });

    const token = new AccessToken(key, secret, {
      identity: `owner-dial-${opts.callerUid}-${Date.now()}`,
      name: opts.callerEmail || 'Owner',
    });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    const jwt = await token.toJwt();
    // Cap the call from the moment it is live (finding 15). Scheduled
    // only now, so a failed dial never leaves a timer behind.
    scheduleOutboundCallCap(roomName);
    return {
      token: jwt,
      url,
      room: roomName,
      to: dest.e164,
      sipParticipantId: info.participantId || '',
      sipCallId: info.sipCallId || '',
    };
  } catch (err: any) {
    // A failed dial must not leave an empty room behind.
    if (roomCreated) await roomClient.deleteRoom(roomName).catch(() => {});
    if (err instanceof OutboundDialError) throw err;
    const message = String(err?.message || err || '');
    if (/trunk/i.test(message)) {
      throw new OutboundDialError(
        'The outbound SIP trunk could not be reached — it may be misconfigured or deleted. Check the trunk in the LiveKit dashboard and LIVEKIT_SIP_OUTBOUND_TRUNK_ID on the server.',
        502,
      );
    }
    throw new OutboundDialError(
      'Could not place the call. Check the number and that the outbound trunk is working, then try again.',
      502,
    );
  }
}

/**
 * End an outbound call: deleting the room drops the SIP leg and
 * disconnects the app. Never throws — hanging up a room that already
 * finished (callee hung up, timeout) is still a successful hangup.
 *
 * Audit Phase 2 (finding 15): a failed delete is retried, not
 * swallowed — a room whose delete keeps failing would otherwise leave
 * the SIP leg running with nobody watching. If it still fails after
 * the retries, the error is logged and the sweeper below reaps the
 * room on its next pass (within 10 minutes).
 */
export async function hangupOutboundCall(roomName: string): Promise<void> {
  const capTimer = callCapTimers.get(roomName);
  if (capTimer) {
    clearTimeout(capTimer);
    callCapTimers.delete(roomName);
  }
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return;
  const roomClient = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await roomClient.deleteRoom(roomName);
      return;
    } catch (err) {
      if (attempt === 3) {
        console.error(`[outbound] Could not delete room ${roomName} after 3 hangup attempts — the stale-room sweeper will retry:`, (err as Error)?.message || err);
      } else {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
}

/**
 * Reap outbound rooms older than the duration cap. The room name
 * carries its creation time (`outbound-<businessId>-<epochMs>`), so no
 * LiveKit metadata is needed to tell how old a room is. Rooms whose
 * name does not parse are left alone — only rooms this server created
 * are ever deleted.
 */
export async function sweepStaleOutboundRooms(): Promise<number> {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return 0;
  const capMs = maxOutboundCallDurationMs();
  const now = Date.now();
  let reaped = 0;
  try {
    const roomClient = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const rooms = await roomClient.listRooms();
    for (const room of rooms) {
      const name = room.name || '';
      if (!name.startsWith(OUTBOUND_ROOM_PREFIX)) continue;
      const startedMs = Number(name.slice(name.lastIndexOf('-') + 1));
      if (!Number.isFinite(startedMs) || startedMs <= 0) continue;
      if (now - startedMs < capMs) continue;
      try {
        await roomClient.deleteRoom(name);
        reaped++;
        console.error(`[outbound] Sweeper deleted stale outbound room ${name} (age ${Math.round((now - startedMs) / 60_000)} min).`);
      } catch (err) {
        console.error(`[outbound] Sweeper could not delete stale room ${name}:`, (err as Error)?.message || err);
      }
    }
  } catch (err) {
    console.error('[outbound] Stale-room sweep failed:', (err as Error)?.message || err);
  }
  return reaped;
}

let sweeperStarted = false;

/** Start the stale-room sweeper: one pass at boot, then every 10
 *  minutes. Safe to call repeatedly; only the first call starts it.
 *  No-ops (silently) when LiveKit is not configured. */
export function startOutboundCallSweeper(): void {
  if (sweeperStarted) return;
  sweeperStarted = true;
  void sweepStaleOutboundRooms();
  const timer = setInterval(() => {
    void sweepStaleOutboundRooms();
  }, 10 * 60_000);
  timer.unref?.();
}
