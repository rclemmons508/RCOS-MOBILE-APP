import { ActionRecord, Client, TabType } from '../types';

/**
 * Pipeline Health — read-only flags over data the app already has.
 *
 * Three watches, all computed from records the client already loaded:
 *  1. Stalled quotes: approved by the owner 2+ days ago, but no job has
 *     been scheduled from them yet (money loop step left undone).
 *  2. Aging invoices: approved and still unpaid after 7+ days.
 *  3. Quiet customers: active/VIP clients with no active jobs and no
 *     contact in 30+ days (churn watch), best customers first.
 *
 * Pure function: never mutates, never fetches. Bad or missing dates are
 * skipped, never guessed.
 */
export interface PipelineFlag {
  id: string;
  kind: 'stalled_quote' | 'unpaid_invoice' | 'quiet_client';
  severity: 'high' | 'medium';
  text: string;
  tab: TabType;
  /** Action this flag is about, when one exists — lets the card act in place. */
  actionId?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(iso: string | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY_MS);
}

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function computePipelineFlags(input: {
  actions: ActionRecord[];
  clients: Client[];
  now?: Date;
}): PipelineFlag[] {
  const now = (input.now ?? new Date()).getTime();
  const flags: PipelineFlag[] = [];

  // 1. Approved quotes with no job scheduled after 2+ days.
  for (const a of input.actions) {
    if (a.status !== 'approved' || !a.result?.quoteDetails || a.scheduledJobId) continue;
    const d = daysSince(a.approvalDecision?.decidedAt || a.updatedAt || a.createdAt, now);
    if (d === null || d < 2) continue;
    const q = a.result.quoteDetails;
    flags.push({
      id: `stalled-quote-${a.id}`,
      kind: 'stalled_quote',
      severity: d >= 4 ? 'high' : 'medium',
      text: `Quote for ${q.clientName} (${money(q.totalAmount)}) was approved ${d} days ago — no job scheduled yet.`,
      tab: 'jobs',
      actionId: a.id,
    });
  }

  // 2. Approved, unpaid invoices aging past 7 days (oldest first, cap 3).
  const unpaid = input.actions
    .filter((a) => a.status === 'approved' && a.result?.invoiceDetails && a.paymentStatus !== 'paid')
    .map((a) => ({ a, d: daysSince(a.approvalDecision?.decidedAt || a.createdAt, now) }))
    .filter((x): x is { a: ActionRecord; d: number } => x.d !== null && x.d >= 7)
    .sort((x, y) => y.d - x.d)
    .slice(0, 3);
  for (const { a, d } of unpaid) {
    const inv = a.result!.invoiceDetails!;
    flags.push({
      id: `unpaid-invoice-${a.id}`,
      kind: 'unpaid_invoice',
      severity: d >= 14 ? 'high' : 'medium',
      text: `Invoice ${inv.invoiceNumber} for ${inv.clientName} — ${money(inv.totalAmount)} unpaid for ${d} days.`,
      tab: 'jobs',
      actionId: a.id,
    });
  }

  // 3. Quiet customers (best customers first, cap 3).
  const quiet = input.clients
    .filter((c) => (c.status === 'active' || c.status === 'vip') && c.activeJobsCount === 0)
    .map((c) => ({ c, d: daysSince(c.lastContactDate, now) }))
    .filter((x): x is { c: Client; d: number } => x.d !== null && x.d >= 30)
    .sort((x, y) => y.c.totalSpent - x.c.totalSpent)
    .slice(0, 3);
  for (const { c, d } of quiet) {
    flags.push({
      id: `quiet-client-${c.id}`,
      kind: 'quiet_client',
      severity: 'medium',
      text: `You haven't heard from ${c.name} in ${d} days.`,
      tab: 'clients',
    });
  }

  // Most urgent first; keep the list short enough to act on.
  return flags
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1))
    .slice(0, 6);
}
