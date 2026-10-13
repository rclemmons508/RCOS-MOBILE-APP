import React from 'react';
import {
  Sunrise,
  PhoneMissed,
  Briefcase,
  FileText,
  DollarSign,
  Inbox,
  ChevronRight,
} from 'lucide-react';
import { PhoneCall, Job, ActionRecord, CustomerRequest, TabType } from '../../types';
import { AGENT_META } from '../../services/agentInboxService';
import { AgentId } from '../../types';
import { getFollowupWindowMs } from '../../utils/automation';

interface MorningBriefingCardProps {
  ownerName: string;
  calls: PhoneCall[];
  jobs: Job[];
  actions: ActionRecord[];
  customerRequests: CustomerRequest[];
  unreadInboxCount: number;
  onOpenInbox: () => void;
  onNavigateTab: (tab: TabType) => void;
  industry?: string;
  industryModifierOn?: boolean;
}

interface Suggestion {
  agent: AgentId;
  text: string;
  actionLabel?: string;
  actionTab?: TabType;
}

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export const MorningBriefingCard: React.FC<MorningBriefingCardProps> = ({
  ownerName,
  calls,
  jobs,
  actions,
  customerRequests,
  unreadInboxCount,
  onOpenInbox,
  onNavigateTab,
  industry,
  industryModifierOn = true,
}) => {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const overnightCutoff = now.getTime() - 14 * 60 * 60 * 1000;
  const overnightCalls = calls.filter((c) => new Date(c.timestamp).getTime() >= overnightCutoff);
  const missedOvernight = overnightCalls.filter((c) => c.type === 'missed' || c.status === 'missed').length;

  const todaysJobs = jobs.filter(
    (j) =>
      j.scheduledTime.includes('Today') ||
      j.status === 'dispatched' ||
      j.status === 'in_progress' ||
      j.status === 'urgent'
  );

  const pendingQuotes = actions.filter(
    (a) => a.status === 'awaiting_approval' && (a.result?.quoteDetails || a.result?.invoiceDetails)
  );
  const quotesTotal = pendingQuotes.reduce(
    (sum, a) => sum + (a.result?.quoteDetails?.totalAmount || a.result?.invoiceDetails?.totalAmount || 0),
    0
  );

  const followupWindow = getFollowupWindowMs(industry, industryModifierOn);
  const overdueRequests = customerRequests.filter(
    (r) =>
      (r.status === 'pending' || r.status === 'in_progress') &&
      new Date(r.createdAt).getTime() < now.getTime() - followupWindow
  );
  const openRequests = customerRequests.filter(
    (r) => r.status === 'pending' || r.status === 'in_progress'
  );

  // Money loop: approved but unpaid invoices.
  const unpaidInvoices = actions.filter(
    (a) => a.status === 'approved' && a.result?.invoiceDetails && a.paymentStatus !== 'paid'
  );
  const owedTotal = unpaidInvoices.reduce(
    (sum, a) => sum + (a.result?.invoiceDetails?.totalAmount || 0),
    0
  );

  const suggestions: Suggestion[] = [];
  if (missedOvernight > 0) {
    suggestions.push({
      agent: 'receptionist',
      text: `${missedOvernight} call${missedOvernight === 1 ? ' was' : 's were'} missed overnight. Want to see who called?`,
      actionLabel: 'View calls',
      actionTab: 'phone',
    });
  }
  if (pendingQuotes.length > 0) {
    suggestions.push({
      agent: 'sales',
      text: `${pendingQuotes.length} quote${pendingQuotes.length === 1 ? '' : 's'} (${money(
        quotesTotal
      )}) waiting for your approval. Approving today keeps jobs moving.`,
      actionLabel: 'Review quotes',
      actionTab: 'approvals',
    });
  }
  if (overdueRequests.length > 0) {
    const windowH = Math.round(followupWindow / 3600000);
    suggestions.push({
      agent: 'support',
      text: `${overdueRequests.length} request${overdueRequests.length === 1 ? ' is' : 's are'} waiting over ${windowH}h. A quick follow-up keeps customers happy.`,
      actionLabel: 'View requests',
      actionTab: 'dashboard',
    });
  }
  if (todaysJobs.length === 0 && openRequests.length > 0) {
    suggestions.push({
      agent: 'operations',
      text: `Nothing on the schedule today — a good day to work through ${openRequests.length} open request${openRequests.length === 1 ? '' : 's'}.`,
    });
  }

  const stats = [
    { icon: PhoneMissed, label: 'Overnight calls', value: String(overnightCalls.length) },
    { icon: Briefcase, label: "Today's jobs", value: String(todaysJobs.length) },
    { icon: DollarSign, label: 'Money owed', value: unpaidInvoices.length ? money(owedTotal) : '$0' },
    { icon: FileText, label: 'Quotes waiting', value: pendingQuotes.length ? money(quotesTotal) : '$0' },
  ];

  return (
    <div className="rounded-3xl border border-lime-500/25 bg-gradient-to-b from-lime-500/10 to-transparent p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-lime-500/20 border border-lime-500/30 flex items-center justify-center shrink-0">
          <Sunrise className="w-5 h-5 text-lime-400" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-lime-400/80">
            Daily briefing
          </div>
          <div className="text-base font-extrabold text-white leading-tight">
            {greeting}{ownerName ? `, ${ownerName.split(' ')[0]}` : ''}
          </div>
          <div className="text-[11px] text-zinc-500">{dateStr}</div>
        </div>
        <button
          onClick={onOpenInbox}
          className="ml-auto relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-bold text-white active:scale-98 shrink-0"
        >
          <Inbox className="w-4 h-4 text-lime-400" />
          Inbox
          {unreadInboxCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center">
              {unreadInboxCount > 9 ? '9+' : unreadInboxCount}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-zinc-950/70 border border-zinc-800 px-2 py-2.5 text-center">
            <s.icon className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
            <div className="text-sm font-extrabold text-white leading-none">{s.value}</div>
            <div className="text-[9px] text-zinc-500 mt-1 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {suggestions.length > 0 ? (
        <div className="mt-3 space-y-2">
          {suggestions.slice(0, 3).map((s, i) => {
            const meta = AGENT_META[s.agent];
            return (
              <div key={i} className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg}`}>
                    <span className={meta.color}>{meta.name}</span>
                  </span>
                </div>
                <div className="mt-1.5 text-xs text-zinc-300 leading-relaxed">{s.text}</div>
                {s.actionLabel && s.actionTab && (
                  <button
                    onClick={() => onNavigateTab(s.actionTab!)}
                    className="mt-2 text-[11px] font-extrabold text-lime-400 flex items-center gap-0.5"
                  >
                    {s.actionLabel} <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 text-xs text-zinc-500 text-center py-2">
          All quiet — your team has nothing urgent this morning.
        </div>
      )}
    </div>
  );
};
