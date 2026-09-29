import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  Layers,
  Phone,
  Briefcase,
  Users,
  Cpu,
  BookOpen,
  UserCheck
} from 'lucide-react';
import { BusinessAccount, ActionRecord, CustomerRequest, PipelineStage, TabType } from '../types';
import { CommandBar } from './CommandBar';
import { AI_EMPLOYEES } from '../data/employees';

interface DashboardViewProps {
  business: BusinessAccount;
  actions: ActionRecord[];
  requests: CustomerRequest[];
  onActionCreated: (action: ActionRecord) => void;
  onNavigate: (tab: TabType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  business,
  actions,
  requests,
  onActionCreated,
  onNavigate
}) => {
  const pendingApprovals = actions.filter(a => a.status === 'awaiting_approval');
  const recentActions = actions.slice(0, 4);

  // Requests by stage
  const stages: PipelineStage[] = ['Intake', 'Qualification', 'Routing', 'Execution', 'Follow-Up', 'Completion'];
  const stageCounts = stages.map(st => ({
    stage: st,
    count: requests.filter(r => r.stage === st).length
  }));

  // Scheduled jobs
  const scheduledJobs = actions.filter(
    a => a.actionType === 'schedule_job' && a.result?.scheduleDetails && a.status === 'completed'
  );

  return (
    <div className="space-y-3.5 sm:space-y-4 max-w-full overflow-x-hidden">
      {/* 1. System Health & Safeguard Status Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          {pendingApprovals.length > 0 ? (
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-lime-500/10 border border-lime-500/30 flex items-center justify-center text-lime-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}

          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
              <span>{pendingApprovals.length > 0 ? `${pendingApprovals.length} Approval Required` : 'RCOS 100% Operational'}</span>
              <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse shrink-0" />
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate">
              {pendingApprovals.length > 0
                ? `Owner review needed in Approval Queue.`
                : `16 AI Agents active • Guardrail active over $${business.dollarThreshold}`}
            </p>
          </div>
        </div>

        {pendingApprovals.length > 0 ? (
          <button
            type="button"
            onClick={() => onNavigate('approvals')}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black transition flex items-center gap-1 cursor-pointer shrink-0 self-start sm:self-center shadow-md shadow-amber-500/20"
          >
            <span>Review ({pendingApprovals.length})</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('automation')}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-lime-400 border border-zinc-800 text-[10px] font-mono transition flex items-center gap-1 cursor-pointer shrink-0 self-start sm:self-center"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Auto Safeguard: ${business.dollarThreshold}</span>
          </button>
        )}
      </div>

      {/* 2. Direct 1-Tap Module Navigation Grid (Ensures full accessibility on mobile) */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2 text-center">
        <button
          type="button"
          onClick={() => onNavigate('phone')}
          className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-blue-500/50 hover:bg-zinc-900/60 transition cursor-pointer flex flex-col items-center justify-center gap-1 group active:scale-95"
        >
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
            <Phone className="w-4 h-4" />
          </div>
          <span className="text-[10.5px] font-bold text-white tracking-tight">Voice AI</span>
          <span className="text-[9px] text-zinc-500 font-mono">24/7 Calls</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('jobs')}
          className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-amber-500/50 hover:bg-zinc-900/60 transition cursor-pointer flex flex-col items-center justify-center gap-1 group active:scale-95"
        >
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
            <Briefcase className="w-4 h-4" />
          </div>
          <span className="text-[10.5px] font-bold text-white tracking-tight">Dispatch</span>
          <span className="text-[9px] text-zinc-500 font-mono">Work Orders</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('clients')}
          className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-emerald-500/50 hover:bg-zinc-900/60 transition cursor-pointer flex flex-col items-center justify-center gap-1 group active:scale-95"
        >
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-[10.5px] font-bold text-white tracking-tight">Clients</span>
          <span className="text-[9px] text-zinc-500 font-mono">CRM Nurture</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('team')}
          className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-purple-500/50 hover:bg-zinc-900/60 transition cursor-pointer flex flex-col items-center justify-center gap-1 group active:scale-95"
        >
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-[10.5px] font-bold text-white tracking-tight">16 Agents</span>
          <span className="text-[9px] text-zinc-500 font-mono">AI Workforce</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('automation')}
          className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-lime-500/50 hover:bg-zinc-900/60 transition cursor-pointer flex flex-col items-center justify-center gap-1 group active:scale-95"
        >
          <div className="p-2 rounded-xl bg-lime-500/10 text-lime-400 group-hover:scale-110 transition-transform">
            <Cpu className="w-4 h-4" />
          </div>
          <span className="text-[10.5px] font-bold text-white tracking-tight">Engine</span>
          <span className="text-[9px] text-zinc-500 font-mono">Auto Loader</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('docs')}
          className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-indigo-500/50 hover:bg-zinc-900/60 transition cursor-pointer flex flex-col items-center justify-center gap-1 group active:scale-95"
        >
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="text-[10.5px] font-bold text-white tracking-tight">100+ Docs</span>
          <span className="text-[9px] text-zinc-500 font-mono">Architecture</span>
        </button>
      </div>

      {/* 3. Front & Center AI Command Bar */}
      <CommandBar business={business} onActionCreated={onActionCreated} />

      {/* 4. Compact Operations Pipeline Status Ribbon */}
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Layers className="w-3.5 h-3.5 text-lime-400" />
            <span>Operations Pipeline</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('portal')}
            className="text-[10px] text-zinc-400 hover:text-lime-400 transition cursor-pointer font-medium"
          >
            + Public Intake Form
          </button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
          {stageCounts.map(({ stage, count }) => (
            <div
              key={stage}
              onClick={() => onNavigate('portal')}
              className="p-2 rounded-xl bg-black border border-zinc-800/80 space-y-0.5 cursor-pointer hover:border-zinc-700 transition"
            >
              <div className="text-[9.5px] font-medium text-zinc-400 truncate">
                {stage}
              </div>
              <div className="text-base font-bold font-mono text-white">
                {count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Two-Column Layout on Desktop / Single Column on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Column: Scheduled Appointments */}
        <div className="lg:col-span-5 p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2.5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Service Schedule</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('jobs')}
              className="text-[10px] text-sky-400 hover:underline cursor-pointer font-mono"
            >
              View Dispatch →
            </button>
          </div>

          {scheduledJobs.length === 0 ? (
            <div className="p-4 rounded-xl bg-black border border-zinc-900 text-center text-xs text-zinc-500 space-y-1">
              <Clock className="w-4 h-4 text-zinc-600 mx-auto" />
              <div className="text-[11px] text-zinc-400 font-medium">No appointments pending</div>
              <p className="text-[10px] text-zinc-500">
                Jobs scheduled by Voice AI or Dispatcher appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {scheduledJobs.slice(0, 3).map((job) => (
                <div
                  key={job.id}
                  className="p-2.5 rounded-xl bg-black border border-zinc-800 text-left space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white truncate">
                      {job.result?.scheduleDetails?.jobTitle || job.title}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                      Confirmed
                    </span>
                  </div>
                  <div className="text-[11px] text-lime-400 font-medium">
                    {job.result?.scheduleDetails?.scheduledDate} ({job.result?.scheduleDetails?.timeWindow})
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Tech: {job.result?.scheduleDetails?.assignedTech || 'Lead Specialist'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Recent AI Workforce Activity Feed */}
        <div className="lg:col-span-7 p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2.5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-lime-400" />
              <span>Live AI Agent Activity</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('activity')}
              className="text-[10px] text-zinc-400 hover:text-lime-400 transition cursor-pointer font-mono"
            >
              Full Trace →
            </button>
          </div>

          {recentActions.length === 0 ? (
            <div className="p-4 rounded-xl bg-black border border-zinc-900 text-center text-xs text-zinc-500 space-y-1">
              <UserCheck className="w-4 h-4 text-zinc-600 mx-auto" />
              <div className="text-[11px] text-zinc-400 font-medium">Workforce Idle</div>
              <p className="text-[10px] text-zinc-500">
                Type an instruction in the Command Bar to assign your first task.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentActions.map((action) => {
                const emp = AI_EMPLOYEES.find(e => e.id === action.employeeId) || AI_EMPLOYEES[0];
                return (
                  <div
                    key={action.id}
                    className="p-2.5 rounded-xl bg-black border border-zinc-800 flex items-center justify-between gap-2 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {emp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{action.title}</div>
                        <div className="text-[10px] text-zinc-400 truncate">
                          <span className="text-lime-400">{emp.name}</span>: {action.stepSummary}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-semibold ${
                        action.status === 'completed'
                          ? 'bg-lime-500/10 text-lime-400'
                          : action.status === 'awaiting_approval'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-sky-500/10 text-sky-400'
                      }`}>
                        {action.status === 'awaiting_approval' ? 'Needs Review' : action.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

