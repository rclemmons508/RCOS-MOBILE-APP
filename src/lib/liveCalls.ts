import { apiFetch } from './api';
import { withBusinessId } from './businessScope';

/** One receptionist call happening right now (from GET /api/calls/live). */
export interface LiveCall {
  roomName: string;
  roomSid: string;
  callerNumber: string;
  calledNumber: string;
  callId: string;
  /** ISO timestamp the call started. */
  startedAt: string;
  /** 'ringing' until the receptionist agent joins the room. */
  status: 'ringing' | 'answered';
  businessId: string | null;
}

export interface ListenTokenResponse {
  token: string;
  url: string;
  room: string;
}

/** Live receptionist calls for this business (empty when none). */
export async function fetchLiveCalls(businessId: string): Promise<LiveCall[]> {
  const data = await apiFetch<LiveCall[]>(withBusinessId('/api/calls/live', businessId));
  return Array.isArray(data) ? data : [];
}

/** Subscribe-only token for listening in on one live call's room. */
export async function fetchListenToken(roomName: string, businessId: string): Promise<ListenTokenResponse> {
  return apiFetch<ListenTokenResponse>(
    `/api/calls/live/${encodeURIComponent(roomName)}/listen-token`,
    {
      method: 'POST',
      body: JSON.stringify({ businessId }),
    },
  );
}

/** Call length so far, as m:ss, from the call's start time. */
export function liveCallDuration(startedAt: string, nowMs: number): string {
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return '0:00';
  const secs = Math.max(0, Math.floor((nowMs - start) / 1000));
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/** Display a US number as +1 (XXX) XXX-XXXX; anything else is shown as-is. */
export function formatCallerNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}
