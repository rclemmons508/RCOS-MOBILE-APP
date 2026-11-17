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
    return {
      token: await token.toJwt(),
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
 */
export async function hangupOutboundCall(roomName: string): Promise<void> {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return;
  try {
    const roomClient = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    await roomClient.deleteRoom(roomName);
  } catch {
    // Room already gone — the call is over either way.
  }
}
