import type { MainAiAlert, MainAiTrigger } from './mainAiAlerts';

/**
 * Morgan asks in the Assistant conversation — the same five approved
 * triggers as the main-AI attention alerts (see mainAiAlerts.ts), but
 * surfaced as a question from Morgan in the chat, with the choice
 * attached, instead of only as a message in the Operations feed:
 *  1. new_request    — a customer request arrives (status pending).
 *  2. quote_waiting  — a quote sits in the review queue (awaiting approval).
 *  3. invoice_unpaid — an approved invoice is still unpaid.
 *  4. missed_call    — a real missed call.
 *  5. job_stalled    — a job sits in progress/dispatched for 48+ hours.
 *
 * Detection itself is reused, not duplicated: the caller runs
 * detectMainAiAlerts first and hands the waiting alerts to
 * planMorganAlerts, which decides — from Morgan's own per-business
 * record — which ones speak up in the conversation.
 *
 * Dedupe (per record, per business, kept on this device):
 *  - A record speaks up once when it first waits.
 *  - If it is still waiting and the owner never answered it (no button
 *    tapped on its card), it speaks up exactly once more, no sooner
 *    than a day after the first time — then never again. It stays in
 *    the Operations feed, which is the backup.
 *  - Any tap on the card (approve, mark paid, view, not now) counts as
 *    answered: Morgan stops repeating that record.
 *  - A record that stops waiting (approved, paid, finished, answered
 *    elsewhere) is simply gone from the next check — nothing fires.
 *
 * Morgan only asks. Nothing is approved, sent, scheduled, or paid
 * until the owner taps a button on the card, and every button's result
 * comes from the real server reply. Plain language throughout: the
 * question is the alert's own words plus one short question.
 *
 * Pure decisions (plus tiny localStorage state helpers): never fetches,
 * never mutates its inputs.
 */

export type MorganAlertAction = 'approve' | 'mark_paid' | 'view' | 'dismiss';

export interface MorganAlertButton {
  id: MorganAlertAction;
  label: string;
}

export interface MorganRaisedEntry {
  /** 1 after the first time Morgan raised it, 2 after the one re-raise. */
  raises: number;
  firstRaisedAt: string;
  lastRaisedAt: string;
  /** True once the owner tapped any button on the card. */
  answered: boolean;
}

export interface MorganAlertState {
  raised: Record<string, MorganRaisedEntry>;
}

/** A still-waiting, unanswered record is raised once more after this long. */
export const MORGAN_RERAISE_AFTER_MS = 24 * 60 * 60 * 1000;

const MAX_RAISED = 200;

const QUESTIONS: Record<MainAiTrigger, string> = {
  new_request: 'Want to take a look?',
  quote_waiting: 'Want me to approve it?',
  invoice_unpaid: 'Want me to mark it paid?',
  missed_call: 'Want me to take you to your calls so you can call back?',
  job_stalled: 'Want me to open the job?',
};

const BUTTONS: Record<MainAiTrigger, MorganAlertButton[]> = {
  new_request: [
    { id: 'view', label: 'View request' },
    { id: 'dismiss', label: 'Not now' },
  ],
  quote_waiting: [
    { id: 'approve', label: 'Approve quote' },
    { id: 'view', label: 'View in Approvals' },
    { id: 'dismiss', label: 'Not now' },
  ],
  invoice_unpaid: [
    { id: 'mark_paid', label: 'Mark paid' },
    { id: 'view', label: 'View in Approvals' },
    { id: 'dismiss', label: 'Not now' },
  ],
  missed_call: [
    { id: 'view', label: 'View calls' },
    { id: 'dismiss', label: 'Not now' },
  ],
  job_stalled: [
    { id: 'view', label: 'View job' },
    { id: 'dismiss', label: 'Not now' },
  ],
};

/** Morgan's message for an alert: its own words, plus one short question. */
export function morganQuestion(alert: MainAiAlert): {
  content: string;
  actions: MorganAlertButton[];
} {
  return {
    content: `${alert.body} ${QUESTIONS[alert.trigger]}`,
    actions: BUTTONS[alert.trigger],
  };
}

/**
 * Which waiting alerts speak up in the conversation now, and the state
 * after this check. `alerts` is the full currently-waiting list (every
 * waiting record, whether or not Morgan has raised it before) — the
 * re-raise rule needs to see already-raised records, so the caller
 * must NOT pre-filter them out.
 */
export function planMorganAlerts(
  alerts: MainAiAlert[],
  state: MorganAlertState,
  now?: number
): { toRaise: MainAiAlert[]; nextState: MorganAlertState } {
  const at = now ?? Date.now();
  const toRaise: MainAiAlert[] = [];
  const raised: Record<string, MorganRaisedEntry> = { ...state.raised };

  for (const alert of alerts) {
    if (!alert.dedupeKey) continue;
    const entry = raised[alert.dedupeKey];
    if (!entry) {
      toRaise.push(alert);
      raised[alert.dedupeKey] = {
        raises: 1,
        firstRaisedAt: new Date(at).toISOString(),
        lastRaisedAt: new Date(at).toISOString(),
        answered: false,
      };
      continue;
    }
    if (entry.answered || entry.raises >= 2) continue;
    if (at - new Date(entry.firstRaisedAt).getTime() < MORGAN_RERAISE_AFTER_MS) continue;
    toRaise.push(alert);
    raised[alert.dedupeKey] = { ...entry, raises: 2, lastRaisedAt: new Date(at).toISOString() };
  }

  // Keep the map bounded, oldest first.
  const entries = Object.entries(raised).sort(
    (a, b) => new Date(a[1].lastRaisedAt).getTime() - new Date(b[1].lastRaisedAt).getTime()
  );
  const trimmed = Object.fromEntries(entries.slice(-MAX_RAISED));

  return { toRaise, nextState: { raised: trimmed } };
}

function storageKey(businessId: string): string {
  return `rcos_morgan_alerts_${businessId}`;
}

export function loadMorganAlertState(businessId: string): MorganAlertState {
  try {
    const raw = localStorage.getItem(storageKey(businessId));
    if (!raw) return { raised: {} };
    const parsed = JSON.parse(raw) as Partial<MorganAlertState>;
    return {
      raised: parsed.raised && typeof parsed.raised === 'object' ? parsed.raised : {},
    };
  } catch {
    return { raised: {} };
  }
}

export function saveMorganAlertState(businessId: string, state: MorganAlertState): void {
  try {
    localStorage.setItem(storageKey(businessId), JSON.stringify({ raised: state.raised }));
  } catch {
    /* storage full or unavailable — the next check re-reads and retries */
  }
}

/** Mark a record answered (any button tapped on its card): no re-raise. */
export function markMorganAlertAnswered(businessId: string, dedupeKey: string): void {
  const state = loadMorganAlertState(businessId);
  const entry = state.raised[dedupeKey];
  if (!entry) return;
  saveMorganAlertState(businessId, {
    raised: { ...state.raised, [dedupeKey]: { ...entry, answered: true } },
  });
}
