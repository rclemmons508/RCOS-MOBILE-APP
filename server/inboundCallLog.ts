/**
 * Inbound receptionist call log — one call record when a
 * receptionist-answered inbound call ends, so it shows in the Calls log
 * (GET /api/phone/calls) and counts on the weekly "calls answered" card.
 *
 * Before this, the only writer of the call log was the outbound dialer:
 * the receptionist always answered and did her job, but nothing was ever
 * recorded, so the Calls list stayed empty and the weekly card read 0
 * for receptionist calls. The writer runs on the LiveKit webhook's
 * call-end signal (server/liveCalls.ts reports a finished answered call
 * when the caller hangs up or the room closes), in server.ts.
 *
 * Only what the call itself carries is recorded — caller, time, and
 * duration. Nothing is invented: the caller name is the caller number
 * (the webhook carries no name), the time is when the call started, and
 * the duration is end minus start. A call the receptionist never
 * answered is never logged.
 *
 * Dedupe is two layers deep: the registry entry is gone after the first
 * end event, so a redelivered end event reports nothing — and the record
 * id is the LiveKit room, so even a second write updates the same record
 * (db.saveCall upserts by id) instead of creating a second one.
 *
 * Caveat, stated plainly: this only runs when the LiveKit webhook
 * actually reaches this server. If the webhook is not delivering (the
 * API service is missing its own LIVEKIT_API_KEY / LIVEKIT_API_SECRET,
 * or the webhook is not registered in LiveKit Cloud), no record is
 * written — the log is not fixed end to end until the webhook delivers.
 */

import { db, type ScopedPhoneCall } from './db';
import type { LiveCall } from './liveCalls';

/** Stable record id for a finished receptionist call: the LiveKit room
 *  sid when present, else the room name. One room is one call. */
export function inboundCallRecordId(call: LiveCall): string {
  const key = (call.roomSid || call.roomName || '').trim();
  return `inbound_${key}`;
}

/** "Xm YYs" — the same duration string the outbound dialer writes. */
export function formatCallDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/** Caller number shown the way the app shows it (+1 (470) 555-0100) —
 *  the same formatting the outbound dialer uses for the name it writes. */
export function formatInboundCallerNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

/** Build the call-log record for a finished receptionist-answered call.
 *  type 'inbound' + status 'completed' + a start timestamp inside the
 *  last 7 days is exactly what the weekly "calls answered" card counts
 *  (src/components/dashboard/WeeklyCard.tsx). */
export function buildInboundCallRecord(call: LiveCall, endedAtMs: number = Date.now()): ScopedPhoneCall {
  const startedMs = Date.parse(call.startedAt);
  const durationSeconds = Number.isFinite(startedMs)
    ? Math.max(0, (endedAtMs - startedMs) / 1000)
    : 0;
  return {
    id: inboundCallRecordId(call),
    callerName: formatInboundCallerNumber(call.callerNumber),
    callerNumber: call.callerNumber,
    type: 'inbound',
    status: 'completed',
    timestamp: call.startedAt,
    duration: formatCallDuration(durationSeconds),
    summary: 'Inbound call answered by the AI receptionist.',
    answeredBy: 'ai_receptionist',
    isRealPstnCall: true,
  };
}

/** Persist one finished receptionist call to the Calls log. Idempotent:
 *  a second write for the same room updates the same record. The record
 *  carries no business id — db.saveCall attributes it to the phone
 *  line's business (the only business on a single-tenant server), the
 *  same rule the live-call list already uses. */
export function logFinishedReceptionistCall(call: LiveCall, endedAtMs: number = Date.now()): ScopedPhoneCall {
  return db.saveCall(buildInboundCallRecord(call, endedAtMs));
}
