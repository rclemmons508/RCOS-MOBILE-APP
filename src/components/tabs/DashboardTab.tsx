import React, { useState } from 'react';
import { PhoneCall, Job, Client, ActionRecord, TabType, User, IndustryOptimizationSuggestion, CustomerRequest } from '../../types';
import {
  PhoneCall as PhoneIcon,
  Briefcase,
  Users,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Bell,
  Calendar,
  Inbox,
  Share2,
  Link2,
  DollarSign,
  FileText,
  Info
} from 'lucide-react';
import { RCLogoIcon } from '../RCLogo';
import { dashboardCard, sectionLabel } from '../ui/cards';
import { WeeklyCard } from '../dashboard/WeeklyCard';
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
  unreadNotifCount: number;
  businessName?: string;
  proactiveSuggestion?: IndustryOptimizationSuggestion | null;
  onReviewSuggestion?: () => void;
  onDismissSuggestion?: () => void;
  businessId?: string;
  serverOnline?: boolean | null;
  pendingApprovals?: number;
  customerRequests?: CustomerRequest[];
  clients?: Client[];
  /** Server-recorded calls — drives the weekly card. See WeeklyCard. */
  serverCalls?: PhoneCall[];
  onNavigateTab: (tab: TabType) => void;
  onOpenNotifications: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  calls,
  jobs,
  actions = [],
  currentUser,
  unreadNotifCount,
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
  onOpenNotifications,
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
  const owedTotal = unpaidInvoices.reduce(
    (sum, a) => sum + (a.result?.invoiceDetails?.totalAmount || 0),
    0
  );
  const pendingQuotes = actions.filter(
    (a) => a.status === 'awaiting_approval' && (a.result?.quoteDetails || a.result?.invoiceDetails)
  );
  const pendingRequestCount = customerRequests.filter((r) => r.status === 'pending').length;
  const missedCallCount = calls.filter((c) => c.status === 'missed').length;
  const activeJobsCount = jobs.filter((j) => j.status !== 'completed').length;
  const activeClientCount = clients.filter((c) => c.status !== 'inactive').length;
  const firstName = currentUser?.authenticated ? currentUser.fullName.split(' ')[0] : '';

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
    if (status === 'dispatched') return 'border-lime-500/40 bg-lime-500/15 text-lime-400';
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
      icon: <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />,
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
      {/* Design 1 business header: RCOS logo, business name, "Business
          Operating System", and a real Online badge from the server status
          the Dashboard already receives. The bell opens notifications.
          Sign-in lives in the global header's profile button, so this card
          does not repeat it. */}
      <div className={`p-3.5 ${dashboardCard} flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-3 min-w-0">
          <RCLogoIcon className="h-11 w-11 rounded-2xl" />
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-white tracking-tight truncate">
              {businessName}
            </h2>
            <p className="text-xs text-zinc-400 truncate">Business Operating System</p>
            <span className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              serverOnline === true
                ? 'bg-lime-500/10 text-lime-400 border-lime-500/30'
                : serverOnline === false
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${serverOnline === true ? 'bg-lime-400 animate-pulse' : serverOnline === false ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'}`} />
              {serverOnline === true ? 'Online' : serverOnline === false ? 'Offline' : 'Checking…'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.light();
            onOpenNotifications();
          }}
          className="relative w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-lime-500/40 flex items-center justify-center transition shrink-0 cursor-pointer"
          aria-label="Open Notifications Center"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-lime-500 text-black text-[10px] font-bold flex items-center justify-center border border-black">
              {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
            </span>
          )}
        </button>
      </div>

      {/* Greeting */}
      <div className="px-1">
        <h2 className="text-xl font-extrabold text-white tracking-tight">
          {firstName ? `Welcome Back, ${firstName}!` : 'Welcome Back!'}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">Let's get your business done today.</p>
      </div>

      {/* Today's Priorities — Design 1 card. Same live situations the
          "What needs you" strip showed, plus jobs scheduled today. Each
          row is one tap to the screen that handles it. */}
      <div className={`p-3.5 ${dashboardCard} space-y-2`}>
        <div className="flex items-center justify-between">
          <span className={sectionLabel}>Today&apos;s Priorities</span>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onNavigateTab('approvals');
            }}
            className="text-[11px] font-semibold text-lime-400 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {priorities.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
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

      {/* This week — what the AI team did. Leads Home. Every number is
          real app data; see WeeklyCard for the definitions. */}
      <WeeklyCard
        serverCalls={serverCalls}
        jobs={jobs}
        actions={actions}
        onNavigateTab={onNavigateTab}
      />

      {/* Proactive AI Industry Profile Optimization Banner */}
      {proactiveSuggestion && onReviewSuggestion && onDismissSuggestion && (
        <ProactiveSuggestionBanner
          suggestion={proactiveSuggestion}
          onReview={onReviewSuggestion}
          onDismiss={onDismissSuggestion}
        />
      )}

      {/* Design 1 stat tiles — Jobs, Invoices ($ owed), Quotes waiting,
          Clients. One row, one tap each. The Clients tile counts the real
          client list instead of the stale metrics counter the old tile
          used; the Invoices tile shows the money-loop owed total. */}
      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => {
            haptic.light();
            onNavigateTab('jobs');
          }}
          className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-lime-500/40 transition cursor-pointer text-center min-h-[92px] flex flex-col items-center justify-center gap-1"
        >
          <span className="p-1.5 rounded-lg bg-lime-500/10 text-lime-400">
            <Briefcase className="w-4 h-4" />
          </span>
          <span className="text-base font-extrabold text-white leading-none">{activeJobsCount}</span>
          <span className="text-[10px] font-bold text-zinc-400">Jobs</span>
          <span className="text-[9px] text-zinc-500 leading-none">{urgentJobs.length} urgent</span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptic.light();
            onNavigateTab('approvals');
          }}
          className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-lime-500/40 transition cursor-pointer text-center min-h-[92px] flex flex-col items-center justify-center gap-1"
        >
          <span className="p-1.5 rounded-lg bg-lime-500/10 text-lime-400">
            <DollarSign className="w-4 h-4" />
          </span>
          <span className="text-base font-extrabold text-white leading-none">${owedTotal.toLocaleString('en-US')}</span>
          <span className="text-[10px] font-bold text-zinc-400">Invoices</span>
          <span className="text-[9px] text-zinc-500 leading-none">{unpaidInvoices.length} unpaid</span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptic.light();
            onNavigateTab('approvals');
          }}
          className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-lime-500/40 transition cursor-pointer text-center min-h-[92px] flex flex-col items-center justify-center gap-1"
        >
          <span className="p-1.5 rounded-lg bg-lime-500/10 text-lime-400">
            <FileText className="w-4 h-4" />
          </span>
          <span className="text-base font-extrabold text-white leading-none">{pendingQuotes.length}</span>
          <span className="text-[10px] font-bold text-zinc-400">Quotes</span>
          <span className="text-[9px] text-zinc-500 leading-none">waiting</span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptic.light();
            onNavigateTab('clients');
          }}
          className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-lime-500/40 transition cursor-pointer text-center min-h-[92px] flex flex-col items-center justify-center gap-1"
        >
          <span className="p-1.5 rounded-lg bg-lime-500/10 text-lime-400">
            <Users className="w-4 h-4" />
          </span>
          <span className="text-base font-extrabold text-white leading-none">{clients.length}</span>
          <span className="text-[10px] font-bold text-zinc-400">Clients</span>
          <span className="text-[9px] text-zinc-500 leading-none">{activeClientCount} active</span>
        </button>
      </div>

      {/* Today's Work — Grok-style rows: time, client + job, status pill.
          One tap opens the Jobs tab. */}
      <div className={`p-3.5 ${dashboardCard} space-y-2`}>
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-lime-400" />
            <span>Today&apos;s Work</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onNavigateTab('jobs');
            }}
            className="text-xs font-bold text-lime-400 hover:underline flex items-center gap-0.5 cursor-pointer"
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
              className="px-4 py-2.5 rounded-full bg-lime-500 hover:bg-lime-400 text-black text-xs font-extrabold transition cursor-pointer"
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
                className="flex w-full items-center gap-3 py-2.5 text-left cursor-pointer"
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
            <Inbox className="w-3.5 h-3.5 text-lime-400" />
            <span>Customer Requests</span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 font-mono">{customerRequests.length} open</span>
            {bookingLink && (
              <button
                type="button"
                onClick={shareBookingLink}
                className="text-[11px] font-bold text-lime-400 hover:underline flex items-center gap-1 cursor-pointer"
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
                className="px-3.5 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black text-xs font-extrabold transition cursor-pointer"
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
                  className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1.5 cursor-pointer hover:border-lime-500/40 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">{req.customerName}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
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
                  <p className="text-[11px] text-zinc-400 truncate">
                    {req.serviceType || 'General Service'} — {req.description}
                  </p>
                  <div className="text-[10px] text-zinc-500 font-mono">
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
