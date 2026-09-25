import React from 'react';
import { Agent, PhoneCall, Job, SystemMetric, TabType, TelemetryPoint, User } from '../../types';
import { TelemetryChart } from '../dashboard/TelemetryChart';
import { AgentWorkloadChart } from '../dashboard/AgentWorkloadChart';
import { 
  Cpu, 
  PhoneCall as PhoneIcon, 
  Briefcase, 
  Users, 
  AlertCircle, 
  ArrowUpRight, 
  CheckCircle2, 
  ChevronRight, 
  Bell, 
  ShieldCheck, 
  Lock,
  MessageSquare
} from 'lucide-react';

interface DashboardTabProps {
  agents: Agent[];
  calls: PhoneCall[];
  jobs: Job[];
  metrics: SystemMetric;
  telemetrySeries: TelemetryPoint[];
  currentUser: User | null;
  unreadNotifCount: number;
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
  telemetrySeries,
  currentUser,
  unreadNotifCount,
  onNavigateTab,
  onSimulateCall,
  onTriggerEmergencyJob,
  onOpenAuth,
  onOpenNotifications,
}) => {
  const isAdmin = currentUser?.authenticated && currentUser.role === 'System Administrator';

  return (
    <div className="space-y-4 pb-6 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden">
      {/* Greeting Banner */}
      <div className="flex items-start justify-between">
        <div className="space-y-0.5 min-w-0">
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate">
            Welcome to your mobile system.
          </h2>
          <p className="text-xs text-zinc-400 flex items-center gap-1.5 flex-wrap">
            <span>RC Solutions RCOS Environment</span>
            <span className="text-lime-400 font-semibold">• 4/4 Agents Online</span>
          </p>
        </div>
      </div>

      {/* Operator Session Gate Status Pill */}
      <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-2 text-xs shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 shrink-0">
            {currentUser?.authenticated ? (
              <ShieldCheck className="w-4 h-4 text-lime-400" />
            ) : (
              <Lock className="w-4 h-4 text-zinc-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white flex items-center gap-1.5 truncate">
              <span className="truncate">{currentUser?.authenticated ? currentUser.fullName : 'Guest Session'}</span>
              {currentUser?.authenticated && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-lime-400 font-mono font-bold shrink-0">
                  {currentUser.role}
                </span>
              )}
            </div>
            <div className="text-[10px] text-zinc-400 truncate">
              {currentUser?.authenticated ? `Org: ${currentUser.organization}` : 'Sign in for full operator controls'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenAuth}
          className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-semibold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
        >
          {currentUser?.authenticated ? 'Profile' : 'Sign In'}
        </button>
      </div>

      {/* Quick Actions Bar with 3 mobile buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onSimulateCall}
          className="flex flex-col items-start gap-1 p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-blue-500/40 transition-all active:scale-98 cursor-pointer"
        >
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
            <PhoneIcon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 w-full text-left">
            <div className="text-[11px] font-bold text-white truncate">Test Voice AI</div>
            <div className="text-[9px] text-zinc-400 truncate">Inbound Call</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onTriggerEmergencyJob}
          className="flex flex-col items-start gap-1 p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-amber-500/40 transition-all active:scale-98 cursor-pointer"
        >
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 w-full text-left">
            <div className="text-[11px] font-bold text-white truncate">Priority Task</div>
            <div className="text-[9px] text-zinc-400 truncate">Auto-Route</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenNotifications}
          className="flex flex-col items-start gap-1 p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-lime-500/40 transition-all active:scale-98 relative cursor-pointer"
        >
          <div className="p-1.5 rounded-lg bg-lime-500/10 text-lime-400">
            <Bell className="w-3.5 h-3.5" />
          </div>
          {unreadNotifCount > 0 && (
            <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-lime-500 text-black font-extrabold text-[9px] flex items-center justify-center">
              {unreadNotifCount}
            </span>
          )}
          <div className="min-w-0 w-full text-left">
            <div className="text-[11px] font-bold text-white truncate">Push Alerts</div>
            <div className="text-[9px] text-zinc-400 truncate">Preferences</div>
          </div>
        </button>
      </div>

      {/* Real-Time Telemetry Graph Component (Recharts Area Chart) */}
      <TelemetryChart
        telemetrySeries={telemetrySeries}
        currentLatency={metrics.latencyMs}
        currentCpu={metrics.cpuUsagePct}
      />

      {/* Live Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
          <div className="text-[10px] text-zinc-400 flex items-center justify-between font-mono">
            <span>Calls Handled</span>
            <PhoneIcon className="w-3 h-3 text-blue-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-white mt-1 font-mono">{metrics.callsHandled}</div>
        </div>

        <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
          <div className="text-[10px] text-zinc-400 flex items-center justify-between font-mono">
            <span>Tasks Dispatched</span>
            <Briefcase className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-white mt-1 font-mono">{metrics.jobsDispatched}</div>
        </div>

        <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
          <div className="text-[10px] text-zinc-400 flex items-center justify-between font-mono">
            <span>Active Clients</span>
            <Users className="w-3 h-3 text-purple-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-white mt-1 font-mono">{metrics.activeClients}</div>
        </div>

        <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
          <div className="text-[10px] text-zinc-400 flex items-center justify-between font-mono">
            <span>Active Agents</span>
            <Cpu className="w-3 h-3 text-lime-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-lime-400 mt-1 font-mono">{metrics.agentsActive} / 4</div>
        </div>
      </div>

      {/* Multi-Agent Workload Visualizer (Recharts Bar Chart) */}
      <AgentWorkloadChart agents={agents} />

      {/* Multi-Agent Active Fleet List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-lime-400" />
            <span>Active RCOS Agent Subroutines</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {agents.map((ag) => (
            <div
              key={ag.id}
              className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-zinc-700 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={ag.avatar}
                    alt={ag.name}
                    className="w-10 h-10 rounded-xl object-cover border border-zinc-800"
                  />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black"
                    style={{ backgroundColor: ag.color }}
                  />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">{ag.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono shrink-0">
                      {ag.tasksCompletedToday} tasks
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    {ag.currentTask || ag.role}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-mono font-bold text-lime-400">{ag.accuracy}%</span>
                <span className="block text-[8px] text-zinc-500 font-mono">ACC</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Stream */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Live Activity Feed
          </h3>
          <button
            type="button"
            onClick={() => onNavigateTab('phone')}
            className="text-[11px] text-lime-400 hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
          >
            <span>View All</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-2">
          {calls.slice(0, 2).map((call) => (
            <div
              key={call.id}
              className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-xs space-y-1.5 hover:border-zinc-700 transition-all"
            >
              <div className="flex items-center justify-between text-zinc-400">
                <span className="font-semibold text-white flex items-center gap-1.5 truncate">
                  <PhoneIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">{call.callerName}</span>
                </span>
                <span className="text-[10px] text-zinc-500 shrink-0 font-mono">{call.timestamp}</span>
              </div>
              <p className="text-zinc-300 text-[11px] leading-snug">
                {call.summary}
              </p>
              {call.actionRequired && (
                <div className="pt-1 border-t border-zinc-900 text-[10px] text-lime-400 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">Action: {call.actionRequired}</span>
                </div>
              )}
            </div>
          ))}

          {jobs.slice(0, 1).map((job) => (
            <div
              key={job.id}
              className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-xs space-y-1.5 hover:border-zinc-700 transition-all"
            >
              <div className="flex items-center justify-between text-zinc-400">
                <span className="font-semibold text-white flex items-center gap-1.5 truncate">
                  <Briefcase className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{job.title}</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold uppercase shrink-0 font-mono">
                  {job.priority}
                </span>
              </div>
              <p className="text-zinc-300 text-[11px] truncate">
                Assigned: <span className="text-white font-medium">{job.assignedTechnician}</span> • {job.address}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* RCOS System Architecture Shortcut */}
      <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3 shadow-lg">
        <div className="space-y-0.5 min-w-0">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-lime-400" />
            <span>RCOS Architecture & File Systems</span>
          </div>
          <p className="text-[10px] text-zinc-400 truncate">
            HITL Guardrails, Telemetry Audit, Billing, and Vector RAG
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab('more')}
          className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-semibold text-xs whitespace-nowrap hover:bg-zinc-800 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
        >
          <span>Explore</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-lime-400" />
        </button>
      </div>
    </div>
  );
};
