/**
 * Post-call → Add Client prefill (Call-to-CRM Stage 2).
 *
 * After a call is answered, the caller can be added as a customer from
 * the Calls screen — live calls and call-log entries alike. The form
 * opens pre-filled with what the call record actually carries, and
 * nothing it does not:
 *
 * - Live calls carry only a caller number (LiveKit webhook → in-memory
 *   registry). No name, no summary — the name and notes stay blank for
 *   the user to fill in.
 * - Call-log entries carry a caller number, a caller name, and — when
 *   the receptionist wrote one — an AI intent summary. When a field is
 *   missing, it stays empty; the UI's display fallback
 *   ("Inbound call logged into RCOS communications repository.") is not
 *   data and is never saved as notes, and the server's placeholder name
 *   ("Inbound Caller") is never saved as the caller's name.
 * - The service is defaulted only when the call record names one of
 *   the business's own services exactly (its department). Anything else
 *   would be a guess — the user picks from their own catalog instead.
 */

/** What a call carries that can pre-fill the Add Client form. */
export interface CallerPrefillSource {
  callerNumber: string;
  callerName?: string | null;
  summary?: string | null;
  department?: string | null;
}

/** Pre-filled values for a brand-new client (no id — the form makes one). */
export interface ClientPrefill {
  name: string;
  phone: string;
  /** One of the business's own services, when the call named it exactly. */
  serviceType?: string;
  /** The call's AI intent summary, when the record has one. */
  notes: string;
}

/** Placeholder the server stores when no caller name was captured —
 *  not a real name, so it never pre-fills the name field. */
export const UNKNOWN_CALLER_NAME = 'Inbound Caller';

/** Build the Add Client prefill from a call record. Only fields the
 *  record actually carries are filled; everything else stays empty. */
export function buildClientPrefillFromCall(
  source: CallerPrefillSource,
  serviceOptions: string[],
): ClientPrefill {
  const name = (source.callerName || '').trim();
  const prefill: ClientPrefill = {
    name: name && name !== UNKNOWN_CALLER_NAME ? name : '',
    phone: (source.callerNumber || '').trim(),
    notes: (source.summary || '').trim(),
  };
  // Default the service only on an exact match with the business's own
  // catalog — a department that is not one of its services (or no
  // department at all) leaves the picker for the user.
  const department = (source.department || '').trim();
  if (department && serviceOptions.includes(department)) {
    prefill.serviceType = department;
  }
  return prefill;
}
