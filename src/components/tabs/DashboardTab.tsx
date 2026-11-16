import React, { useState } from 'react';
import { PhoneCall, Job, Client, ActionRecord, TabType, User, IndustryOptimizationSuggestion, CustomerRequest } from '../../types';
import {
  PhoneCall as PhoneIcon,
  Briefcase,
  UserPlus,
  AudioWaveform,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Bell,
  Calendar,
  Inbox,
  Share2,
  Link2,
  DollarSign,
  Info
} from 'lucide-react';
import { RCLogoIcon } from '../RCLogo';
import { dashboardCard, sectionLabel } from '../ui/cards';
import { haptic } from '../../utils/haptics';
import { buildPublicBookingLink } from '../../config/api';
import { ProactiveSuggestionBanner } from '../ProactiveSuggestionBanner';
import { RequestDetailModal } from '../RequestDetailModal';
import { GlobalSearchBar } from '../GlobalSearchBar';

interface DashboardTabProps {
  calls: PhoneCall[];
  jobs: Job[];
  actions: ActionRecord[];
  currentUser: User | null;
  businessName?: string;
  proactiveSuggestion?: IndustryOptimizationSuggestion | null;
  onReviewSuggestion?: () => void;
  onDismissSuggestion?: () => void;
  businessId?: string;
  serverOnline?: boolean | null;
  pendingApprovals?: number;
  customerRequests?: CustomerRequest[];
  clients?: Client[];
  /** Server-recorded calls — drives the stat tiles. */
  serverCalls?: PhoneCall[];
  onNavigateTab: (tab: TabType) => void;
  /** Opens the Operations feed at the Alerts section. */
  onOpenAlerts: () => void;
  /** Opens the AI Receptionist detail screen (Stage 4). Falls back to
      the AI Team tab when not provided. */
  onOpenReceptionist?: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  calls,
  jobs,
  actions = [],
  currentUser,
  businessName = 'My Business',
  proactiveSuggestion,
  onReviewSuggestion,
  onDismissSuggestion,
  businessId = '',
  serverOnline = null,
  pendingApprovals = 0,
  customerRequests = [],
  clients = [],
  serverCalls = [],
  onNavigateTab,
  onOpenAlerts,
  onOpenReceptionist,
}) => {
  const urgentJobs = jobs.filter(j => j.priority === 'critical' || j.status === 'urgent');
  const upcomingJobs = jobs.filter(j => j.status !== 'completed').slice(0, 3);

  // Design 1 "Today's Priorities" + stat tiles — same live data the
  // "What needs you" strip and the counters used, in the Design 1 layout.
  // Jobs today reuses the Morning Briefing's filter; unpaid invoices and
  // waiting quotes reuse its money-loop definitions. Nothing here invents
  // a number: every count is computed from jobs, actions, calls, and
  // requests the Dashboard already loads.
  const todaysJobs = jobs.filter(
    (j) =>
      j.scheduledTime.includes('Today') ||
      j.status === 'dispatched' ||
      j.status === 'in_progress' ||
      j.status === 'urgent'
  );
  const unpaidInvoices = actions.filter(
    (a) => a.status === 'approved' && a.result?.invoiceDetails && a.paymentStatus !== 'paid'
  );
  const pendingRequestCount = customerRequests.filter((r) => r.status === 'pending').length;
  const missedCallCount = calls.filter((c) => c.status === 'missed').length;
  const activeJobsCount = jobs.filter((j) => j.status !== 'completed').length;
  const firstName = currentUser?.authenticated ? currentUser.fullName.split(' ')[0] : '';

  // Sidebar-design stat tiles — every number is real app data, same
  // honesty rules as the weekly card. A timestamp that does not parse
  // simply does not count; no delta is shown anywhere, because there is
  // no prior-period baseline to compare against — never invented.
  const sameDay = (iso: string | undefined, now: Date) => {
    if (!iso) return false;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return false;
    return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate();
  };
  const sameMonth = (iso: string | undefined, now: Date) => {
    if (!iso) return false;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return false;
    return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth();
  };
  const now = new Date();
  // Server-recorded calls are the persistent record; the session-local
  // list resets on sign-in and would undercount the day.
  const callsToday = serverCalls.filter((c) => sameDay(c.timestamp, now)).length;
  const aiHandledToday = serverCalls.filter(
    (c) =>
      c.answeredBy === 'ai_receptionist' &&
      (c.status === 'completed' || c.status === 'transferred') &&
      sameDay(c.timestamp, now)
  ).length;
  // Revenue this month: paid invoices only, stamped when they were paid.
  // Unpaid or unstamped records do not count — the figure grows as
  // payments land, it is never padded.
  const revenueMTD = actions
    .filter((a) => a.paymentStatus === 'paid' && sameMonth(a.paidAt, now))
    .reduce(
      (sum, a) =>
        sum + (a.paidAmount ?? a.result?.invoiceDetails?.totalAmount ?? a.dollarAmount ?? 0),
      0
    );
  // Time-aware greeting, as in the reference ("Good Morning, Ryan").
  const hour = now.getHours();
  const daypart = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const slaFor = (req: CustomerRequest) => {
    const urgent = req.urgency === 'urgent' || req.urgency === 'emergency';
    const limitMs = urgent ? 8 * 3600 * 1000 : 24 * 3600 * 1000; // same-day vs 24h
    const elapsed = Date.now() - new Date(req.createdAt).getTime();
    return { urgent, breached: elapsed > limitMs, leftMs: Math.max(0, limitMs - elapsed) };
  };
  const timeLeft = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m left`;
    if (h < 24) return `${h}h left`;
    return `${Math.floor(h / 24)}d left`;
  };
  const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };
  // Grok-style job rows: plain status words, not the raw status keys.
  const jobStatusLabel = (status: Job['status']) => {
    if (status === 'in_progress') return 'In Progress';
    if (status === 'dispatched') return 'Scheduled';
    if (status === 'urgent') return 'Urgent';
    if (status === 'completed') return 'Done';
    return 'New';
  };
  const jobStatusClass = (status: Job['status']) => {
    if (status === 'in_progress') return 'border-blue-500/40 bg-blue-500/15 text-blue-400';
    if (status === 'dispatched') return 'border-[#22ec72]/40 bg-[#22ec72]/15 text-[#22ec72]';
    if (status === 'urgent') return 'border-rose-500/40 bg-rose-500/15 text-rose-300';
    return 'border-zinc-700 bg-zinc-800 text-zinc-300';
  };
  // "Today at 2:00 PM" is too long for the time slot — the date part is
  // already implied by the "Today's Work" heading.
  const shortTime = (t: string) => t.replace(/^Today at /i, '');
  const [linkCopied, setLinkCopied] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CustomerRequest | null>(null);
  const bookingLink = buildPublicBookingLink(businessId);
  const shareBookingLink = async () => {
    if (!bookingLink) return;
    haptic.light();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${businessName} — Request Service`,
          text: 'Request service online:',
          url: bookingLink,
        });
      } else {
        await navigator.clipboard.writeText(bookingLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  // "Today's Priorities" — the live situations, in Design 1's card.
  // Each row is one clear tap to the screen that handles it. Rows only
  // appear when their count is above zero, so the card never invents a
  // situation: approvals, jobs, invoices, requests, and missed calls all
  // come straight from data the Dashboard already loads.
  const priorities: { key: string; icon: React.ReactNode; title: string; tab: TabType }[] = [];
  if (pendingApprovals > 0) {
    priorities.push({
      key: 'approvals',
      icon: <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />,
      title: `${pendingApprovals} waiting for your approval`,
      tab: 'approvals',
    });
  }
  if (todaysJobs.length > 0) {
    priorities.push({
      key: 'jobs',
      icon: <CheckCircle2 className="w-4 h-4 text-[#22ec72] shrink-0" />,
      title: `${todaysJobs.length} Job${todaysJobs.length === 1 ? '' : 's'} Scheduled`,
      tab: 'jobs',
    });
  }
  if (unpaidInvoices.length > 0) {
    priorities.push({
      key: 'unpaid',
      icon: <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />,
      title: `${unpaidInvoices.length} Unpaid Invoice${unpaidInvoices.length === 1 ? '' : 's'}`,
      tab: 'approvals',
    });
  }
  if (pendingRequestCount > 0) {
    priorities.push({
      key: 'requests',
      icon: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
      title: `${pendingRequestCount} Customer Follow-Up${pendingRequestCount === 1 ? '' : 's'}`,
      tab: 'requests',
    });
  }
  if (missedCallCount > 0) {
    priorities.push({
      key: 'missed',
      icon: <PhoneIcon className="w-4 h-4 text-rose-400 shrink-0" />,
      title: `${missedCallCount} Missed Call${missedCallCount === 1 ? '' : 's'}`,
      tab: 'phone',
    });
  }

  return (
    <div className="space-y-4 pb-8 px-3.5 sm:px-4 pt-2 max-w-full overflow-x-hidden">
      {/* Business header: RCOS logo, business name, "Business
          Operating System", and a real Online badge from the server status
          the Dashboard already receives. The bell opens notifications.
          Sign-in lives in the global header's profile button, so this card
          does not repeat it. Restyled to the sidebar design in Stage 6 —
          the badge and the business name are unchanged, only the shell. */}
      <div className="p-3.5 rounded-2xl bg-[#0c1211] border border-[#1d2b26] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <RCLogoIcon className="h-11 w-11 rounded-2xl" />
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-white tracking-tight truncate">
              {businessName}
            </h2>
            <p className="text-xs text-zinc-400 truncate">Business Operating System</p>
            <span className={`mt-1 inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border ${
              serverOnline === true
                ? 'bg-[#22ec72]/10 text-[#22ec72] border-[#22ec72]/30'
                : serverOnline === false
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${serverOnline === true ? 'bg-[#22ec72] animate-pulse' : serverOnline === false ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'}`} />
              {serverOnline === true ? 'Online' : serverOnline === false ? 'Offline' : 'Checking…'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.light();
            onOpenAlerts();
          }}
          className="min-h-[48px] relative w-10 h-10 rounded-xl bg-[#0c1211] border border-[#1d2b26] text-zinc-300 hover:text-white hover:border-[#22ec72]/40 flex items-center justify-center transition shrink-0 cursor-pointer"
          aria-label="Open alerts in Operations"
          title="Alerts"
        >
          <Bell className="w-4 h-4" />
        </button>
      </div>

      {/* Greeting — time-aware, as in the reference. */}
      <div className="px-1">
        <h2 className="text-xl font-extrabold text-white tracking-tight">
          {firstName ? `${daypart}, ${firstName}!` : `${daypart}!`}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">Here&apos;s what&apos;s happening with your business today.</p>
      </div>

      {/* Sidebar-design stat tiles — 2x2, real numbers only, no deltas.
          Each tile is one tap to the screen that owns the number. */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            haptic.light();
            onNavigateTab('phone');
          }}
          className="p-3.5 rounded-2xl bg-[#0c1211] border border-[#1d2b26] hover:border-[#22ec72]/40 transition cursor-pointer text-left min-h-[96px] flex flex-col justify-between gap-1"
        >
          <span className="p-1.5 rounded-lg bg-[#22ec72]/10 text-[#22ec72] self-start">
            <PhoneIcon className="w-4 h-4" />
          </span>
          <span className="text-2xl font-extrabold text-white leading-none">{callsToday}</span>
          <span className="text-xs font-bold text-zinc-400">Today&apos;s Calls</span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptic.light();
            onNavigateTab('requests');
          }}
          className="p-3.5 rounded-2xl bg-[#0c1211] border border-[#1d2b26] hover:border-[#22ec72]/40 transition cursor-pointer text-left min-h-[96px] flex flex-col justify-between gap-1"
        >
          <span className="p-1.5 rounded-lg bg-[#22ec72]/10 text-[#22ec72] self-start">
            <UserPlus className="w-4 h-4" />
          </span>
          <span className="text-2xl font-extrabold text-white leading-none">{pendingRequestCount}</span>
          <span className="text-xs font-bold text-zinc-400">New Leads</span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptic.light();
            onNavigateTab('jobs');
          }}
          className="p-3.5 rounded-2xl bg-[#0c1211] border border-[#1d2b26] hover:border-[#22ec72]/40 transition cursor-pointer text-left min-h-[96px] flex flex-col justify-between gap-1"
        >
          <span className="p-1.5 rounded-lg bg-[#22ec72]/10 text-[#22ec72] self-start">
            <Briefcase className="w-4 h-4" />
          </span>
          <span className="text-2xl font-extrabold text-white leading-none">{activeJobsCount}</span>
          <span className="text-xs font-bold text-zinc-400">Jobs Scheduled</span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptic.light();
            onNavigateTab('approvals');
          }}
          className="p-3.5 rounded-2xl bg-[#0c1211] border border-[#1d2b26] hover:border-[#22ec72]/40 transition cursor-pointer text-left min-h-[96px] flex flex-col justify-between gap-1"
        >
          <span className="p-1.5 rounded-lg bg-[#22ec72]/10 text-[#22ec72] self-start">
            <DollarSign className="w-4 h-4" />
          </span>
          <span className="text-2xl font-extrabold text-white leading-none">${revenueMTD.toLocaleString('en-US')}</span>
          <span className="text-xs font-bold text-zinc-400">Revenue (MTD)</span>
        </button>
      </div>

      {/* AI Receptionist card — status follows the same server reachability
          the Online badge uses; the count is AI-answered calls today from
          the server's call record. One tap opens the dedicated
          receptionist detail screen (Stage 4). */}
      <button
        type="button"
        onClick={() => {
          haptic.light();
          if (onOpenReceptionist) onOpenReceptionist();
          else onNavigateTab('team');
        }}
        className="min-h-[48px] w-full p-3.5 rounded-2xl bg-[#0c1211] border border-[#1d2b26] hover:border-[#22ec72]/40 transition cursor-pointer text-left"
      >
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-full border-2 border-[#22ec72] text-[#22ec72] shrink-0">
            <AudioWaveform className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-white">AI Receptionist</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                serverOnline === true
                  ? 'bg-[#22ec72]/10 text-[#22ec72] border-[#22ec72]/30'
                  : serverOnline === false
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}>
                {serverOnline === true ? 'Active' : serverOnline === false ? 'Offline' : 'Checking…'}
              </span>
            </span>
            <span className="block text-xs text-zinc-400 mt-0.5">
              {aiHandledToday === 0
                ? 'No calls handled yet today'
                : `${aiHandledToday} call${aiHandledToday === 1 ? '' : 's'} handled today`}
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
        </div>
      </button>

      {/* Today's Focus — the reference's name for the same live
          situations the Design 1 card showed. Each row is one tap to
          the screen that handles it. */}
      <div className={`p-3.5 ${dashboardCard} space-y-2`}>
        <div className="flex items-center justify-between">
          <span className={sectionLabel}>Today&apos;s Focus</span>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onNavigateTab('approvals');
            }}
            className="min-h-[48px] text-xs font-semibold text-[#22ec72] hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {priorities.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-[#22ec72] shrink-0" />
            <span>You're all caught up — nothing needs you right now.</span>
          </div>
        ) : (
          <div className="space-y-1">
            {priorities.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  haptic.light();
                  onNavigateTab(item.tab);
                }}
                className="w-full flex items-center gap-2.5 min-h-[44px] px-2 py-2 rounded-xl text-left hover:bg-zinc-800/60 active:bg-zinc-800 transition cursor-pointer"
              >
                {item.icon}
                <span className="flex-1 text-sm font-semibold text-white">{item.title}</span>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Global search — one box that finds jobs, clients, requests, quotes, invoices.
          Kept as Home chrome: it is the only global search in the app. */}
      <GlobalSearchBar
        jobs={jobs}
        clients={clients}
        customerRequests={customerRequests}
        actions={actions}
        onNavigateTab={onNavigateTab}
      />

      {/* The weekly card moved to the top of the Operations feed in
          Stage 2 (same component, same real data). Home now matches the
          reference more closely. */}

      {/* Proactive AI Industry Profile Optimization Banner */}
      {proactiveSuggestion && onReviewSuggestion && onDismissSuggestion && (
        <ProactiveSuggestionBanner
          suggestion={proactiveSuggestion}
          onReview={onReviewSuggestion}
          onDismiss={onDismissSuggestion}
        />
      )}

      {/* Today's Work — Grok-style rows: time, client + job, status pill.
          One tap opens the Jobs tab. */}
      <div className={`p-3.5 ${dashboardCard} space-y-2`}>
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#22ec72]" />
            <span>Today&apos;s Work</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onNavigateTab('jobs');
            }}
            className="min-h-[48px] text-xs font-bold text-[#22ec72] hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {upcomingJobs.length === 0 ? (
          <div className="text-center space-y-3 py-2">
            <p className="text-sm text-zinc-400">No jobs on the schedule today.</p>
            <button
              type="button"
              onClick={() => {
                haptic.light();
                onNavigateTab('jobs');
              }}
              className="min-h-[48px] px-4 py-2.5 rounded-full bg-[#22ec72] hover:bg-[#22ec72] text-black text-xs font-extrabold transition cursor-pointer"
            >
              Add a job
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {upcomingJobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => {
                  haptic.light();
                  onNavigateTab('jobs');
                }}
                className="min-h-[48px] flex w-full items-center gap-3 py-2.5 text-left cursor-pointer"
              >
                <span className="w-24 shrink-0 text-xs font-extrabold text-white whitespace-nowrap truncate">
                  {shortTime(job.scheduledTime)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-white">{job.clientName}</span>
                  <span className="block truncate text-xs text-zinc-400">{job.title}</span>
                </span>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold border ${jobStatusClass(job.status)}`}>
                  {jobStatusLabel(job.status)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* The AI Team preview lived here and duplicated the AI Team tab.
          Removed: the tab is the one list now. */}

      {/* Customer Requests with SLA badges */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <Inbox className="w-3.5 h-3.5 text-[#22ec72]" />
            <span>Customer Requests</span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono">{customerRequests.length} open</span>
            {bookingLink && (
              <button
                type="button"
                onClick={shareBookingLink}
                className="min-h-[48px] text-xs font-bold text-[#22ec72] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {linkCopied ? <Link2 className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{linkCopied ? 'Copied!' : 'Share booking link'}</span>
              </button>
            )}
          </div>
        </div>
        {customerRequests.length === 0 ? (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-center space-y-2">
            <p className="text-xs text-zinc-400">No requests yet.</p>
            {bookingLink && (
              <button
                type="button"
                onClick={shareBookingLink}
                className="min-h-[48px] px-3.5 py-2 rounded-xl bg-[#22ec72] hover:bg-[#22ec72] text-black text-xs font-extrabold transition cursor-pointer"
              >
                {linkCopied ? 'Link copied!' : 'Share your booking link'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {customerRequests.slice(0, 5).map((req) => {
              const sla = slaFor(req);
              return (
                <div
                  key={req.id}
                  onClick={() => {
                    haptic.light();
                    setSelectedRequest(req);
                  }}
                  className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1.5 cursor-pointer hover:border-[#22ec72]/40 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">{req.customerName}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                        sla.breached
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                          : sla.urgent
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}>
                        {sla.breached ? 'Overdue' : sla.urgent ? `Same-day · ${timeLeft(sla.leftMs)}` : `24h · ${timeLeft(sla.leftMs)}`}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 truncate">
                    {req.serviceType || 'General Service'} — {req.description}
                  </p>
                  <div className="text-xs text-zinc-500 font-mono">
                    {timeAgo(req.createdAt)} · {req.stage || 'Intake'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RequestDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </div>
  );
};
