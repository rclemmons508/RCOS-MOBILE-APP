import React, { useState } from 'react';
import { PhoneCall, Job, SystemMetric, TabType, User, IndustryOptimizationSuggestion, CustomerRequest } from '../../types';
import { 
  PhoneCall as PhoneIcon, 
  Briefcase, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Bell, 
  ShieldCheck, 
  Lock,
  Plus,
  Bot,
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  Mail,
  ArrowRight,
  Wrench,
  Inbox,
  Activity,
  Share2,
  Link2
} from 'lucide-react';
import { haptic } from '../../utils/haptics';
import { ProactiveSuggestionBanner } from '../ProactiveSuggestionBanner';

interface DashboardTabProps {
  calls: PhoneCall[];
  jobs: Job[];
  metrics: SystemMetric;
  telemetrySeries?: TelemetryPoint[];
  currentUser: User | null;
  unreadNotifCount: number;
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
  automationsOn?: number;
  automationsTotal?: number;
  onNavigateTab: (tab: TabType) => void;
  onSimulateCall: () => void;
  onTriggerEmergencyJob: () => void;
  onOpenAuth: () => void;
  onOpenNotifications: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  calls,
  jobs,
  metrics,
  currentUser,
  unreadNotifCount,
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
  automationsOn = 0,
  automationsTotal = 0,
  onNavigateTab,
  onSimulateCall,
  onTriggerEmergencyJob,
  onOpenAuth,
  onOpenNotifications,
}) => {
  const urgentJobs = jobs.filter(j => j.priority === 'critical' || j.status === 'urgent');
  const upcomingJobs = jobs.filter(j => j.status !== 'completed').slice(0, 3);
  const recentCalls = calls.slice(0, 3);

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
  const bookingLink = businessId ? `${window.location.origin}/#/book/${businessId}` : '';
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

  return (
    <div className="space-y-4 pb-8 px-3.5 sm:px-4 pt-2 max-w-full overflow-x-hidden">
      {/* Friendly Header with Business & Operator Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20">
              {industryName}
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight truncate">
            {businessName}
          </h2>
        </div>

        {/* User Profile / Status Chip */}
        <button
          type="button"
          onClick={() => {
            haptic.light();
            onOpenAuth();
          }}
          className="flex items-center gap-2 p-1.5 pr-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer shrink-0"
        >
          {currentUser?.authenticated ? (
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.fullName}
                className="w-7 h-7 rounded-xl object-cover border border-lime-500/60"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-lime-400 border border-black" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="text-left text-xs min-w-0">
            <div className="font-semibold text-white truncate max-w-[100px]">
              {currentUser?.authenticated ? currentUser.fullName.split(' ')[0] : 'Sign In'}
            </div>
            <div className="text-[9px] text-zinc-400 font-mono">
              {currentUser?.authenticated ? 'Online' : 'Guest'}
            </div>
          </div>
        </button>
      </div>

      {/* System Status Strip — Master Dashboard command view */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${serverOnline === true ? 'bg-lime-400 animate-pulse' : serverOnline === false ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'}`} />
          <div className="min-w-0">
            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">System</div>
            <div className="text-xs font-bold text-white truncate">
              {serverOnline === true ? 'Online' : serverOnline === false ? 'Offline' : 'Checking…'}
            </div>
          </div>
        </div>
        <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center gap-2 min-w-0">
          <Activity className="w-3.5 h-3.5 text-lime-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Automations</div>
            <div className="text-xs font-bold text-white truncate">{automationsOn}/{automationsTotal} on</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.light();
            onNavigateTab('approvals');
          }}
          className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-amber-500/40 flex items-center gap-2 min-w-0 text-left transition cursor-pointer"
        >
          <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${pendingApprovals > 0 ? 'text-amber-400' : 'text-zinc-500'}`} />
          <div className="min-w-0">
            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Approvals</div>
            <div className={`text-xs font-bold truncate ${pendingApprovals > 0 ? 'text-amber-300' : 'text-white'}`}>
              {pendingApprovals > 0 ? `${pendingApprovals} waiting` : 'All clear'}
            </div>
          </div>
        </button>
      </div>

      {/* Proactive AI Industry Profile Optimization Banner */}
      {proactiveSuggestion && onReviewSuggestion && onDismissSuggestion && (
        <ProactiveSuggestionBanner
          suggestion={proactiveSuggestion}
          onReview={onReviewSuggestion}
          onDismiss={onDismissSuggestion}
        />
      )}

      {/* Primary Operational Summary Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div 
          onClick={() => {
            haptic.light();
            onNavigateTab('jobs');
          }}
          className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-amber-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Active Jobs</span>
            <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">
            {jobs.filter(j => j.status !== 'completed').length}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
            <span className="text-amber-400 font-semibold">{urgentJobs.length} urgent</span>
            <span>in queue</span>
          </div>
        </div>

        <div 
          onClick={() => {
            haptic.light();
            onNavigateTab('phone');
          }}
          className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-blue-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Voice AI Calls</span>
            <div className="p-1 rounded-lg bg-blue-500/10 text-blue-400">
              <PhoneIcon className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">
            {metrics.callsHandled}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
            <span className="text-blue-400 font-semibold">24/7 Active</span>
            <span>Receptionist</span>
          </div>
        </div>

        <div 
          onClick={() => {
            haptic.light();
            onNavigateTab('clients');
          }}
          className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-purple-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Clients</span>
            <div className="p-1 rounded-lg bg-purple-500/10 text-purple-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">
            {metrics.activeClients}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            Directory & History
          </div>
        </div>

        <div 
          onClick={() => {
            haptic.light();
            onNavigateTab('team');
          }}
          className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-lime-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">AI Helpers</span>
            <div className="p-1 rounded-lg bg-lime-500/10 text-lime-400">
              <Bot className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-lime-400 mt-1">
            Ready
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
            Automating tasks
          </div>
        </div>
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
          <div className="space-y-2">
            {customerRequests.slice(0, 5).map((req) => {
              const sla = slaFor(req);
              return (
                <div
                  key={req.id}
                  className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">{req.customerName}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider border ${
                      sla.breached
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                        : sla.urgent
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}>
                      {sla.breached ? 'Overdue' : sla.urgent ? `Same-day · ${timeLeft(sla.leftMs)}` : `24h · ${timeLeft(sla.leftMs)}`}
                    </span>
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
    </div>
  );
};
