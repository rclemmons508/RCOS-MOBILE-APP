import React from 'react';
import { Agent, PhoneCall, Job, SystemMetric, TabType, TelemetryPoint, User } from '../../types';
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
  ArrowRight
} from 'lucide-react';
import { haptic } from '../../utils/haptics';

interface DashboardTabProps {
  agents: Agent[];
  calls: PhoneCall[];
  jobs: Job[];
  metrics: SystemMetric;
  telemetrySeries?: TelemetryPoint[];
  currentUser: User | null;
  unreadNotifCount: number;
  businessName?: string;
  industryName?: string;
  onNavigateTab: (tab: TabType) => void;
  onSimulateCall: () => void;
  onTriggerEmergencyJob: () => void;
  onOpenAuth: () => void;
  onOpenNotifications: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  agents,
  calls,
  jobs,
  metrics,
  currentUser,
  unreadNotifCount,
  businessName = 'My Business',
  industryName = 'Field Services',
  onNavigateTab,
  onSimulateCall,
  onTriggerEmergencyJob,
  onOpenAuth,
  onOpenNotifications,
}) => {
  const urgentJobs = jobs.filter(j => j.priority === 'critical' || j.status === 'urgent');
  const upcomingJobs = jobs.filter(j => j.status !== 'completed').slice(0, 3);
  const recentCalls = calls.slice(0, 3);

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
                <div className="text-xs font-bold text-white truncate">Voice Receptionist</div>
                <div className="text-[10px] text-zinc-400 truncate">Answers calls 24/7</div>
              </div>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20 shrink-0">
              Active
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Dispatch Specialist</div>
                <div className="text-[10px] text-zinc-400 truncate">Routes technicians</div>
              </div>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20 shrink-0">
              Active
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Estimator & Quotes</div>
                <div className="text-[10px] text-zinc-400 truncate">Drafts trade proposals</div>
              </div>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20 shrink-0">
              Active
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Client Follow-up</div>
                <div className="text-[10px] text-zinc-400 truncate">SMS updates & reviews</div>
              </div>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20 shrink-0">
              Active
            </span>
          </div>
        </div>
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
