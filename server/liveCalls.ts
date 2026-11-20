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
 * - A finished call is reported exactly once, so the call log can be
 *   written from it (server/inboundCallLog.ts): the registry entry is
 *   gone after the first end event, so a redelivered end event finds
 *   nothing to report — and the log record id is the room, so even a
 *   second report would update the same record, never a second one.
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

// Outbound dialer rooms (server/outboundCalls.ts) — the live-call
// registry tracks receptionist calls only; see applyLivekitEvent.
const OUTBOUND_ROOM_PREFIX = 'outbound-';

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

/** What one verified LiveKit webhook event did to the live-call registry. */
export interface LivekitEventOutcome {
  /** The call the receptionist just answered (agent joined a ringing
   *  call), so the owner can be alerted. Null for every other event,
   *  including a duplicate agent join for a call already answered. */
  answered: LiveCall | null;
  /** A receptionist-answered call that just ended (caller hung up, or
   *  the room closed), so it can be written to the Calls log. Null when
   *  the call was never answered — a caller who hung up while still
   *  ringing is not a call she answered — and null on a duplicate
   *  delivery: the registry entry is gone after the first end event. */
  finished: LiveCall | null;
}

const NO_OUTCOME: LivekitEventOutcome = { answered: null, finished: null };

/** Apply one verified LiveKit webhook event to the live-call registry. */
export function applyLivekitEvent(ev: LivekitWebhookPayload): LivekitEventOutcome {
  const roomName = ev.room?.name || '';
  if (!roomName) return NO_OUTCOME;
  // Outbound rooms (the owner dialed out from the app) are the owner's
  // own call, not a receptionist call: the agent never joins them, so
  // without this guard they would sit in the live-call list stuck on
  // 'ringing' forever. The dialer UI tracks its own call.
  if (roomName.startsWith(OUTBOUND_ROOM_PREFIX)) return NO_OUTCOME;
  const now = Date.now();
  const participant = ev.participant;
  const kind = participant ? Number(participant.kind) : NaN;

  switch (ev.event) {
    case 'participant_joined': {
      if (!participant) return NO_OUTCOME;
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
          return { answered: { ...existing }, finished: null };
        }
      }
      return NO_OUTCOME;
    }
    case 'participant_left':
    case 'participant_connection_aborted': {
      if (!participant) return NO_OUTCOME;
      if (kind === PARTICIPANT_KIND_SIP) {
        // The caller hung up — the call is over. Only a call the
        // receptionist actually answered is reported as finished.
        const existing = liveCalls.get(roomName);
        liveCalls.delete(roomName);
        return existing && existing.status === 'answered'
          ? { answered: null, finished: { ...existing } }
          : NO_OUTCOME;
      } else if (kind === PARTICIPANT_KIND_AGENT && isReceptionist(participant)) {
        // The receptionist left but the caller is still there: back to
        // ringing so the card never claims she is on a call she left.
        const existing = liveCalls.get(roomName);
        if (existing) {
          existing.status = 'ringing';
          existing.lastSeenAt = now;
        }
      }
      return NO_OUTCOME;
    }
    case 'room_finished': {
      // The room closed — the call is over, however it ended. Same rule:
      // only a call she answered is reported as finished.
      const existing = liveCalls.get(roomName);
      liveCalls.delete(roomName);
      return existing && existing.status === 'answered'
        ? { answered: null, finished: { ...existing } }
        : NO_OUTCOME;
    }
    default:
      // room_started, track_*, egress_*, ingress_*: nothing to track.
      return NO_OUTCOME;
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
