/**
 * Live receptionist calls — the in-memory registry behind GET /api/calls/live.
 *
 * How a call gets here: LiveKit posts webhook events to POST
 * /api/livekit/webhook (signature-verified with the LiveKit API secret).
 * An inbound phone call shows up as a participant with kind SIP joining a
 * room; the receptionist agent joining the same room marks it answered.
 * The call leaves the registry when the caller hangs up
 * (participant_left / room_finished).
 *
 * What this deliberately does NOT do:
 * - App-created in-app calls (POST /api/voice/token rooms) never appear
 *   here: they have no SIP participant, so no record is ever created.
 * - No business is attributed at webhook time: the event carries no
 *   business id, and the business record has no phone number to match
 *   the called number against. Records therefore carry businessId null,
 *   and the read endpoint scopes them with the same rule the phone call
 *   log already uses (phoneScopeFilter): a record with no business id is
 *   shown only when the server holds exactly one business and it is in
 *   scope. If a second business is ever added, the fix is to record each
 *   business's LiveKit number and match on the called number.
 * - This is live-only data: the registry lives in memory and resets on a
 *   server restart/redeploy. A stale-entry sweep (3h) drops anything a
 *   missed webhook left behind.
 */

// livekit ParticipantInfo_Kind values (see @livekit/protocol):
// STANDARD = 0, INGRESS = 1, EGRESS = 2, SIP = 3, AGENT = 4.
const PARTICIPANT_KIND_SIP = 3;
const PARTICIPANT_KIND_AGENT = 4;

// The voice-agent worker registers under this name (server/voice-agent.ts).
const RECEPTIONIST_AGENT_IDENTITY = 'rcos-receptionist';

// A registry entry older than this with no event touching its room is
// stale (a missed webhook) and is dropped on the next read.
const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export type LiveCallStatus = 'ringing' | 'answered';

export interface LiveCall {
  /** LiveKit room name for the call (needed to join it to listen in). */
  roomName: string;
  roomSid: string;
  /** The caller's number (sip.phoneNumber), or 'Unknown caller'. */
  callerNumber: string;
  /** The business number that was called (sip.trunkPhoneNumber). */
  calledNumber: string;
  /** SIP call id (sip.callID), for support lookups. */
  callId: string;
  /** ISO timestamp the call started (room creation time). */
  startedAt: string;
  /** 'ringing' until the receptionist agent joins the room. */
  status: LiveCallStatus;
  /** Always null: the webhook carries no business id (see header). */
  businessId: string | null;
  /** Last webhook event touching this room, for the stale sweep. */
  lastSeenAt: number;
}

/** The webhook event fields this module reads (a structural subset of
 *  LiveKit's WebhookEvent — the handler passes the verified event). */
export interface LivekitWebhookPayload {
  event: string;
  room?: {
    name?: string;
    sid?: string;
    creationTimeMs?: bigint | number | string;
  };
  participant?: {
    identity?: string;
    name?: string;
    kind?: number;
    attributes?: { [key: string]: string };
    joinedAtMs?: bigint | number | string;
  };
}

const liveCalls = new Map<string, LiveCall>();

function toMs(value: bigint | number | string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function looksLikePhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7;
}

function callerNumberOf(p: NonNullable<LivekitWebhookPayload['participant']>): string {
  const attrs = p.attributes || {};
  if (attrs['sip.phoneNumber']) return attrs['sip.phoneNumber'];
  if (p.identity && looksLikePhoneNumber(p.identity)) return p.identity;
  if (p.name && looksLikePhoneNumber(p.name)) return p.name;
  return 'Unknown caller';
}

function isReceptionist(p: NonNullable<LivekitWebhookPayload['participant']>): boolean {
  const id = p.identity || '';
  return id === RECEPTIONIST_AGENT_IDENTITY || id.startsWith(RECEPTIONIST_AGENT_IDENTITY + '-');
}

function sweepStale(now = Date.now()): void {
  for (const [roomName, call] of liveCalls) {
    if (now - call.lastSeenAt > STALE_AFTER_MS) liveCalls.delete(roomName);
  }
}

/** Apply one verified LiveKit webhook event to the live-call registry.
 * Returns the call when this event newly marks it ANSWERED (the
 * receptionist agent just joined a ringing call), so the caller can alert
 * the owner — null for every other event, including a duplicate agent
 * join for a call that is already answered. */
export function applyLivekitEvent(ev: LivekitWebhookPayload): LiveCall | null {
  const roomName = ev.room?.name || '';
  if (!roomName) return null;
  const now = Date.now();
  const participant = ev.participant;
  const kind = participant ? Number(participant.kind) : NaN;

  switch (ev.event) {
    case 'participant_joined': {
      if (!participant) return null;
      if (kind === PARTICIPANT_KIND_SIP) {
        // An inbound phone call just arrived in this room.
        const startedMs =
          toMs(ev.room?.creationTimeMs) ?? toMs(participant.joinedAtMs) ?? now;
        const existing = liveCalls.get(roomName);
        liveCalls.set(roomName, {
          roomName,
          roomSid: ev.room?.sid || existing?.roomSid || '',
          callerNumber: callerNumberOf(participant),
          calledNumber: participant.attributes?.['sip.trunkPhoneNumber'] || existing?.calledNumber || '',
          callId: participant.attributes?.['sip.callID'] || existing?.callId || '',
          startedAt: existing?.startedAt || new Date(startedMs).toISOString(),
          // Keep 'answered' if the agent already joined before this event arrived.
          status: existing?.status || 'ringing',
          businessId: null,
          lastSeenAt: now,
        });
      } else if (kind === PARTICIPANT_KIND_AGENT && isReceptionist(participant)) {
        // The receptionist answered.
        const existing = liveCalls.get(roomName);
        if (existing && existing.status !== 'answered') {
          existing.status = 'answered';
          existing.lastSeenAt = now;
          return { ...existing };
        }
      }
      return null;
    }
    case 'participant_left':
    case 'participant_connection_aborted': {
      if (!participant) return null;
      if (kind === PARTICIPANT_KIND_SIP) {
        // The caller hung up — the call is over.
        liveCalls.delete(roomName);
      } else if (kind === PARTICIPANT_KIND_AGENT && isReceptionist(participant)) {
        // The receptionist left but the caller is still there: back to
        // ringing so the card never claims she is on a call she left.
        const existing = liveCalls.get(roomName);
        if (existing) {
          existing.status = 'ringing';
          existing.lastSeenAt = now;
        }
      }
      return null;
    }
    case 'room_finished': {
      liveCalls.delete(roomName);
      return null;
    }
    default:
      // room_started, track_*, egress_*, ingress_*: nothing to track.
      return null;
  }
}

/** All live calls, oldest first, with stale entries dropped. */
export function getLiveCalls(): LiveCall[] {
  sweepStale();
  return Array.from(liveCalls.values()).sort((a, b) =>
    a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0,
  );
}

/** One live call by room name, or undefined once it has ended. */
export function getLiveCall(roomName: string): LiveCall | undefined {
  sweepStale();
  return liveCalls.get(roomName);
}
