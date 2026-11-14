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
  Plus,
  Bot,
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  Mail,
  Inbox,
  Share2,
  Link2,
  MessageSquare,
  DollarSign,
  FileText,
  Info
} from 'lucide-react';
import { RCLogoIcon } from '../RCLogo';
import { dashboardCard, sectionLabel } from '../ui/cards';
import { QuickLaunchBar } from '../dashboard/QuickLaunchBar';
import { MorningBriefingCard } from '../dashboard/MorningBriefingCard';
import { PipelineHealthCard } from '../dashboard/PipelineHealthCard';
import { haptic } from '../../utils/haptics';
import { buildPublicBookingLink } from '../../config/api';
import { ProactiveSuggestionBanner } from '../ProactiveSuggestionBanner';
import { RequestDetailModal } from '../RequestDetailModal';
import { GlobalSearchBar } from '../GlobalSearchBar';
import { GetStartedChecklist } from '../GetStartedChecklist';

interface DashboardTabProps {
  calls: PhoneCall[];
  jobs: Job[];
  actions: ActionRecord[];
  currentUser: User | null;
  unreadNotifCount: number;
  unreadInboxCount: number;
  businessName?: string;
  industryName?: string;
  proactiveSuggestion?: IndustryOptimizationSuggestion | null;
  onReviewSuggestion?: () => void;
  onDismissSuggestion?: () => void;
  onOpenServiceManager?: () => void;
  businessId?: string;
  serverOnline?: boolean | null;
  pendingApprovals?: number;
  activeEmployees?: Record<string, boolean>;
  customerRequests?: CustomerRequest[];
  clients?: Client[];
  onNavigateTab: (tab: TabType) => void;
  onSimulateCall: () => void;
  onTriggerEmergencyJob: () => void;
  onOpenNotifications: () => void;
  onOpenInbox: () => void;
  /** One-tap dashboard actions — the exact handlers the Approvals screen uses. */
  onApproveQuote?: (actionId: string) => Promise<void> | void;
  onScheduleJob?: (action: ActionRecord) => Promise<void> | void;
  onMarkPaid?: (action: ActionRecord) => Promise<void> | void;
  industry?: string;
  industryModifierOn?: boolean;
  followupsDraftedYesterday?: number;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  calls,
  jobs,
  actions = [],
  currentUser,
  unreadNotifCount,
  unreadInboxCount = 0,
  businessName = 'My Business',
  industryName = 'Field Services',
  proactiveSuggestion,
  onReviewSuggestion,
  onDismissSuggestion,
  onOpenServiceManager,
  businessId = '',
  serverOnline = null,
  pendingApprovals = 0,
  activeEmployees = {},
  customerRequests = [],
  clients = [],
  onNavigateTab,
  onSimulateCall,
  onTriggerEmergencyJob,
  onOpenNotifications,
  onOpenInbox,
  onApproveQuote,
  onScheduleJob,
  onMarkPaid,
  industry,
  industryModifierOn,
  followupsDraftedYesterday = 0,
}) => {
  const urgentJobs = jobs.filter(j => j.priority === 'critical' || j.status === 'urgent');
  const upcomingJobs = jobs.filter(j => j.status !== 'completed').slice(0, 3);
  const recentCalls = calls.slice(0, 3);

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

  // Master Dashboard helpers
  const empOn = (id: string) => activeEmployees[id] !== false;
  const empBadge = (id: string) =>
    empOn(id) ? (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20 shrink-0">
        Active
      </span>
    ) : (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700 shrink-0">
        Paused
      </span>
    );
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

  const handleQuickAction = async (action: () => void, type: 'light' | 'warning' = 'light') => {
    if (type === 'warning') {
      await haptic.warning();
    } else {
      await haptic.light();
    }
    action();
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

      {/* Get started — the Dashboard checklist that replaced the overlay
          App Guide tour. Inline on the Dashboard, never a dimmed card
          over the screen, so the user always sees the real app. */}
      <GetStartedChecklist
        currentUser={currentUser}
        businessId={businessId}
        onNavigateTab={onNavigateTab}
      />

      {/* Morning Briefing — the team reports in */}
      <MorningBriefingCard
        ownerName={currentUser?.fullName || ''}
        calls={calls}
        jobs={jobs}
        actions={actions}
        customerRequests={customerRequests}
        unreadInboxCount={unreadInboxCount}
        followupsDraftedYesterday={followupsDraftedYesterday}
        onOpenInbox={onOpenInbox}
        onNavigateTab={onNavigateTab}
        onApproveQuote={onApproveQuote}
        onOpenRequest={(req) => setSelectedRequest(req)}
        industry={industry}
        industryModifierOn={industryModifierOn}
      />

      {/* Global search — one box that finds jobs, clients, requests, quotes, invoices */}
      <GlobalSearchBar
        jobs={jobs}
        clients={clients}
        customerRequests={customerRequests}
        actions={actions}
        onNavigateTab={onNavigateTab}
      />

      {/* Pipeline health — stalled quotes, aging invoices, quiet customers */}
      <PipelineHealthCard
        actions={actions}
        clients={clients}
        onNavigateTab={onNavigateTab}
        onScheduleJob={onScheduleJob}
        onMarkPaid={onMarkPaid}
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

      {/* Quick Action Touch Targets (Optimized for Mobile Field Work) */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleQuickAction(() => onNavigateTab('jobs'))}
          className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-lime-500/40 transition-all flex items-center gap-2.5 text-left active:scale-98 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-lime-500/20 text-lime-400 flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">New Work Order</div>
            <div className="text-[10px] text-zinc-400 truncate">Create & dispatch job</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleQuickAction(() => onNavigateTab('team-chat'))}
          className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-lime-500/40 transition-all flex items-center gap-2.5 text-left active:scale-98 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-lime-500/20 text-lime-400 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">Team Chat</div>
            <div className="text-[10px] text-zinc-400 truncate">Message your team</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleQuickAction(onTriggerEmergencyJob, 'warning')}
          className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-rose-500/40 transition-all flex items-center gap-2.5 text-left active:scale-98 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate group-hover:text-rose-300">
              Emergency Dispatch
            </div>
            <div className="text-[10px] text-zinc-400 truncate">Immediate response</div>
          </div>
        </button>
      </div>

      {/* Today's Work Schedule / Active Jobs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-lime-400" />
            <span>Today's Work Schedule</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onNavigateTab('jobs');
            }}
            className="text-[11px] font-semibold text-lime-400 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>View All ({jobs.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {upcomingJobs.length === 0 ? (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-center text-xs text-zinc-400">
            No active jobs in the queue. Tap &quot;New Work Order&quot; to add one.
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => {
                  haptic.light();
                  onNavigateTab('jobs');
                }}
                className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] font-mono text-zinc-500 font-bold">{job.id}</span>
                    <h4 className="text-xs font-bold text-white truncate">{job.title}</h4>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-1 truncate">
                      <Users className="w-3 h-3 text-zinc-500 shrink-0" />
                      <span className="truncate">{job.clientName}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider ${
                    job.priority === 'critical'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : job.priority === 'high'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {job.priority}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1.5 border-t border-zinc-900/80">
                  <div className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                    <span className="truncate">{job.address}</span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-lime-400 shrink-0">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{job.scheduledTime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active AI Team for This Industry */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-lime-400" />
            <span>AI Team for {industryName}</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onNavigateTab('team');
            }}
            className="text-[11px] font-semibold text-lime-400 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>Manage Team</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                <PhoneIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">AI Receptionist</div>
                <div className="text-[10px] text-zinc-400 truncate">Answers calls 24/7</div>
              </div>
            </div>
            {empBadge('ai_receptionist')}
          </div>

          <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Operations Assistant</div>
                <div className="text-[10px] text-zinc-400 truncate">Routes technicians</div>
              </div>
            </div>
            {empBadge('operations')}
          </div>

          <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Sales Assistant</div>
                <div className="text-[10px] text-zinc-400 truncate">Drafts trade proposals</div>
              </div>
            </div>
            {empBadge('sales')}
          </div>

          <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Support Assistant</div>
                <div className="text-[10px] text-zinc-400 truncate">SMS updates & reviews</div>
              </div>
            </div>
            {empBadge('customer_service')}
          </div>
        </div>
      </div>

      {/* Quick Launch Bar — RCOS Master Dashboard spec */}
      <QuickLaunchBar onNavigate={onNavigateTab} />

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

      {/* Recent Inbound Inquiries */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <PhoneIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>Recent Phone Calls</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              onNavigateTab('phone');
            }}
            className="text-[11px] font-semibold text-lime-400 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {recentCalls.map((call) => (
            <div
              key={call.id}
              onClick={() => {
                haptic.light();
                onNavigateTab('phone');
              }}
              className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5 truncate">
                  <PhoneIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">{call.callerName}</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">{call.timestamp}</span>
              </div>
              <p className="text-zinc-300 text-xs leading-relaxed line-clamp-2">
                {call.summary}
              </p>
              {call.actionRequired && (
                <div className="pt-1 text-[10px] text-lime-400 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{call.actionRequired}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gmail Workspace Quick Card */}
      <div 
        onClick={() => {
          haptic.light();
          onNavigateTab('gmail');
        }}
        className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-red-500/40 flex items-center justify-between gap-3 shadow-lg transition-all cursor-pointer"
      >
        <div className="space-y-0.5 min-w-0">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-red-400" />
            <span>Connected Email & Work Orders</span>
          </div>
          <p className="text-[11px] text-zinc-400 truncate">
            Review client emails, dispatch requests, and service receipts
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-red-400 font-semibold shrink-0">
          <span>Open</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>

      <RequestDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </div>
  );
};
