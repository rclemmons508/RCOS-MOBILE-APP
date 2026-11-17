import { apiFetch } from './api';
import { withBusinessId } from './businessScope';

/** Whether the server can dial out right now (LiveKit + outbound trunk). */
export interface OutboundStatus {
  configured: boolean;
  livekitConfigured: boolean;
  trunkConfigured: boolean;
}

/** What POST /api/calls/dial returns: a publish-capable token for the
 *  outbound room the number was dialed into. */
export interface DialResponse {
  token: string;
  url: string;
  room: string;
  to: string;
  sipParticipantId?: string;
  sipCallId?: string;
}

/** Outbound readiness for this business (false until the server has a
 *  stored outbound SIP trunk — see SETUP.md §4). */
export async function fetchOutboundStatus(businessId: string): Promise<OutboundStatus> {
  return apiFetch<OutboundStatus>(withBusinessId('/api/calls/outbound-status', businessId));
}

/** Dial a number from the app. 30s timeout: the server creates the room
 *  and places the SIP call before it answers. */
export async function dialNumber(to: string, businessId: string): Promise<DialResponse> {
  return apiFetch<DialResponse>('/api/calls/dial', {
    method: 'POST',
    body: JSON.stringify({ businessId, to }),
    timeoutMs: 30000,
  });
}

/** Hang up an outbound call (deletes the room, which drops the SIP leg).
 *  Best-effort: a hangup that fails still ends the local call. */
export async function hangupOutboundCall(roomName: string, businessId: string): Promise<void> {
  try {
    await apiFetch(`/api/calls/dial/${encodeURIComponent(roomName)}/hangup`, {
      method: 'POST',
      body: JSON.stringify({ businessId }),
    });
  } catch {
    // The room may already be gone — the call is over either way.
  }
}

/** Format a dialed number for display as it is typed: US numbers as
 *  +1 (XXX) XXX-XXXX, anything else shown as typed. */
export function formatDialDisplay(raw: string): string {
  const hasPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (hasPlus && digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (!hasPlus && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (!hasPlus && digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

/** Seconds as m:ss for the in-call timer. */
export function callClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}
