import type { ActionRecord, CustomerRequest, Job, PhoneCall, TabType } from '../types';

/**
 * Main-AI attention alerts — the main AI coming to the owner when
 * something needs attention (Ryan-approved spec, Oct 27 2026).
 *
 * Exactly five triggers, all from REAL records the app already loaded —
 * nothing here invents a request, quote, invoice, call, or job:
 *  1. new_request    — a customer request arrives (status pending).
 *  2. quote_waiting  — a quote sits in the review queue (awaiting approval).
 *  3. invoice_unpaid — an approved invoice is still unpaid.
 *  4. missed_call    — a real missed call (simulator/test calls never fire).
 *  5. job_stalled    — a job sits in progress/dispatched for 48+ hours.
 *
 * Dedupe: one alert per triggering record, enforced two ways — the
 * caller passes every dedupeKey already in the Agent Inbox, and fired
 * keys are also kept on this device (see load/saveMainAiAlertState), so
 * a server store wipe can never re-fire an old alert.
 *
 * Jobs carry no timestamp in this app (scheduledTime is display text
 * like "Today at 2:00 PM", not a date), so a stalled job is detected by
 * first-seen tracking: the first poll that sees a job in progress or
 * dispatched stamps it, and only a job still unfinished 48 hours later
 * alerts. Fresh jobs never alert.
 *
 * Pure detection (plus tiny localStorage state helpers): never fetches,
 * never mutates its inputs. Bad or missing fields are skipped, never
 * guessed.
 */
export type MainAiTrigger =
  | 'new_request'
  | 'quote_waiting'
  | 'invoice_unpaid'
  | 'missed_call'
  | 'job_stalled';

export interface MainAiAlert {
  trigger: MainAiTrigger;
  title: string;
  body: string;
  actionLabel: string;
  actionTab: TabType;
  /** Stable key: `mainai:<trigger>:<record id>` — one alert per record. */
  dedupeKey: string;
}

export interface MainAiAlertState {
  /** DedupeKeys already fired on this device. */
  alerted: string[];
  /** jobId -> ISO timestamp of the first poll that saw it unfinished. */
  jobFirstSeen: Record<string, string>;
}

/** A job still unfinished this long after first being seen counts as stalled. */
export const STALLED_JOB_AFTER_MS = 48 * 60 * 60 * 1000;

const MAX_TRACKED_JOBS = 200;

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function key(trigger: MainAiTrigger, id: string): string {
  return `mainai:${trigger}:${id}`;
}

export function detectMainAiAlerts(input: {
  requests: CustomerRequest[];
  actions: ActionRecord[];
  calls: PhoneCall[];
  jobs: Job[];
  /** DedupeKeys to skip — inbox keys plus keys fired on this device. */
  alerted: ReadonlySet<string | undefined>;
  jobFirstSeen: Record<string, string>;
  now?: number;
}): { alerts: MainAiAlert[]; jobFirstSeen: Record<string, string> } {
  const now = input.now ?? Date.now();
  const alerts: MainAiAlert[] = [];

  // 1. New customer request.
  for (const r of input.requests) {
    if (r.status !== 'pending' || !r.id) continue;
    const dedupeKey = key('new_request', r.id);
    if (input.alerted.has(dedupeKey)) continue;
    const service = r.serviceCategory || r.serviceType;
    alerts.push({
      trigger: 'new_request',
      title: `New customer request from ${r.customerName || 'a customer'}`,
      body: `A new request just came in${service ? ` for ${service}` : ''}. It needs your attention.`,
      actionLabel: 'View requests',
      actionTab: 'requests',
      dedupeKey,
    });
  }

  // 2. Quote sitting waiting for approval.
  for (const a of input.actions) {
    if (a.status !== 'awaiting_approval' || !a.result?.quoteDetails || !a.id) continue;
    const dedupeKey = key('quote_waiting', a.id);
    if (input.alerted.has(dedupeKey)) continue;
    const q = a.result.quoteDetails;
    alerts.push({
      trigger: 'quote_waiting',
      title: `Quote waiting: ${q.clientName} — ${money(q.totalAmount)}`,
      body: `A quote for ${q.clientName} (${money(q.totalAmount)}) is sitting in your review queue waiting for approval.`,
      actionLabel: 'Review quotes',
      actionTab: 'approvals',
      dedupeKey,
    });
  }

  // 3. Approved invoice still unpaid.
  for (const a of input.actions) {
    if (a.status !== 'approved' || !a.result?.invoiceDetails || a.paymentStatus === 'paid' || !a.id) continue;
    const dedupeKey = key('invoice_unpaid', a.id);
    if (input.alerted.has(dedupeKey)) continue;
    const inv = a.result.invoiceDetails;
    alerts.push({
      trigger: 'invoice_unpaid',
      title: `Invoice unpaid: ${inv.clientName} — ${money(inv.totalAmount)}`,
      body: `Invoice ${inv.invoiceNumber} for ${inv.clientName} (${money(inv.totalAmount)}) is approved but still unpaid.`,
      actionLabel: 'Review invoices',
      actionTab: 'approvals',
      dedupeKey,
    });
  }

  // 4. Real missed call only — simulator/test calls never fire, matching
  // the missed-call follow-up rule's real-call check.
  for (const c of input.calls) {
    if (c.isRealPstnCall !== true) continue;
    if (c.type !== 'missed' && c.status !== 'missed') continue;
    if (!c.callerNumber || !c.id) continue;
    const dedupeKey = key('missed_call', c.id);
    if (input.alerted.has(dedupeKey)) continue;
    alerts.push({
      trigger: 'missed_call',
      title: `Missed call from ${c.callerName || 'Unknown caller'}`,
      body: c.summary || 'A real call was missed. Call back when you can.',
      actionLabel: 'View calls',
      actionTab: 'phone',
      dedupeKey,
    });
  }

  // 5. Stalled job: unfinished 48+ hours after first being seen.
  const nextFirstSeen: Record<string, string> = {};
  for (const j of input.jobs) {
    if (!j.id) continue;
    if (j.status !== 'in_progress' && j.status !== 'dispatched') continue;
    const firstSeen = input.jobFirstSeen[j.id] ?? new Date(now).toISOString();
    nextFirstSeen[j.id] = firstSeen;
    if (now - new Date(firstSeen).getTime() < STALLED_JOB_AFTER_MS) continue;
    const dedupeKey = key('job_stalled', j.id);
    if (input.alerted.has(dedupeKey)) continue;
    alerts.push({
      trigger: 'job_stalled',
      title: `Job stalled: ${j.title}`,
      body: `The job "${j.title}" for ${j.clientName || 'a customer'} has been unfinished for over 2 days. Check on it.`,
      actionLabel: 'View jobs',
      actionTab: 'jobs',
      dedupeKey,
    });
  }
  // Keep the map bounded and drop finished jobs.
  const trimmed = Object.fromEntries(Object.entries(nextFirstSeen).slice(-MAX_TRACKED_JOBS));

  return { alerts, jobFirstSeen: trimmed };
}

function storageKey(businessId: string): string {
  return `rcos_main_ai_alerts_${businessId}`;
}

export function loadMainAiAlertState(businessId: string): MainAiAlertState {
  try {
    const raw = localStorage.getItem(storageKey(businessId));
    if (!raw) return { alerted: [], jobFirstSeen: {} };
    const parsed = JSON.parse(raw) as Partial<MainAiAlertState>;
    return {
      alerted: Array.isArray(parsed.alerted) ? parsed.alerted.filter((k) => typeof k === 'string') : [],
      jobFirstSeen:
        parsed.jobFirstSeen && typeof parsed.jobFirstSeen === 'object' ? parsed.jobFirstSeen : {},
    };
  } catch {
    return { alerted: [], jobFirstSeen: {} };
  }
}

export function saveMainAiAlertState(businessId: string, state: MainAiAlertState): void {
  try {
    localStorage.setItem(
      storageKey(businessId),
      JSON.stringify({ alerted: state.alerted.slice(-500), jobFirstSeen: state.jobFirstSeen })
    );
  } catch {
    /* storage full or unavailable — the inbox dedupe check still applies */
  }
}
