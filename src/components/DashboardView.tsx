import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  DollarSign,
  TrendingUp,
  Layers,
  Send,
  UserCheck
} from 'lucide-react';
import { BusinessAccount, ActionRecord, CustomerRequest, PipelineStage } from '../types';
import { CommandBar } from './CommandBar';
import { AI_EMPLOYEES } from '../data/employees';

interface DashboardViewProps {
  business: BusinessAccount;
  actions: ActionRecord[];
  requests: CustomerRequest[];
  onActionCreated: (action: ActionRecord) => void;
  onNavigate: (tab: 'dashboard' | 'activity' | 'approvals' | 'team' | 'jobpacks' | 'portal' | 'settings') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  business,
  actions,
  requests,
  onActionCreated,
  onNavigate
}) => {
  const pendingApprovals = actions.filter(a => a.status === 'awaiting_approval');
  const recentActions = actions.slice(0, 5);

  // Requests by stage
  const stages: PipelineStage[] = ['Intake', 'Qualification', 'Routing', 'Execution', 'Follow-Up', 'Completion'];
  const stageCounts = stages.map(st => ({
    stage: st,
    count: requests.filter(r => r.stage === st).length
  }));

  // Schedules extracted from scheduled jobs
  const scheduledJobs = actions.filter(
    a => a.actionType === 'schedule_job' && a.result?.scheduleDetails && a.status === 'completed'
  );

  return (
    <div className="space-y-6">
      {/* Front & Center Command Bar */}
      <CommandBar business={business} onActionCreated={onActionCreated} />

      {/* Primary Simple Status Banner */}
      <div className="p-4 rounded-2xl bg-[#0e1118] border border-[#1f2638] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {pendingApprovals.length > 0 ? (
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center text-[#00ff66] shrink-0 glow-rc-sm">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}

          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{pendingApprovals.length > 0 ? 'Action Needed' : 'Everything is Running Smoothly'}</span>
              <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-pulse" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {pendingApprovals.length > 0
                ? `You have ${pendingApprovals.length} item${pendingApprovals.length > 1 ? 's' : ''} awaiting your sign-off in the Approval Queue.`
                : `All 12 AI employees are active. Autonomy safeguards protecting transactions over $${business.dollarThreshold}.`}
            </p>
          </div>
        </div>

        {pendingApprovals.length > 0 && (
          <button
            type="button"
            onClick={() => onNavigate('approvals')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#090b0e] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-center"
          >
            <span>Review {pendingApprovals.length} Pending</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Grid: Open Requests by Pipeline Stage */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00ff66]" />
            <span>Operations Pipeline</span>
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('portal')}
            className="text-xs text-slate-400 hover:text-[#00ff66] transition cursor-pointer font-medium"
          >
            + New Client Request Form
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {stageCounts.map(({ stage, count }) => (
            <div
              key={stage}
              className="p-3.5 rounded-xl bg-[#0e1118] border border-[#1f2638] text-center space-y-1 hover:border-slate-700 transition"
            >
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                {stage}
              </span>
              <div className="text-xl font-bold font-mono text-white">
                {count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Scheduled Operations on Left, Live Recent Activity on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Scheduled Operations */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>This Week's Schedule</span>
            </h3>
          </div>

          {scheduledJobs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#0e1118] border border-[#1f2638] text-center text-xs text-slate-400 space-y-2">
              <Clock className="w-6 h-6 text-slate-600 mx-auto" />
              <div>No service appointments booked yet</div>
              <p className="text-[11px] text-slate-500">
                When you approve a quote or ask Operations to schedule, service appointments will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {scheduledJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-3.5 rounded-xl bg-[#0e1118] border border-[#21293a] text-left space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      {job.result?.scheduleDetails?.jobTitle || job.title}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      Confirmed
                    </span>
                  </div>
                  <div className="text-xs text-[#00ff66] font-medium">
                    {job.result?.scheduleDetails?.scheduledDate} ({job.result?.scheduleDetails?.timeWindow})
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Tech: {job.result?.scheduleDetails?.assignedTech || 'Lead Specialist'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Friendly Recent Activity Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00ff66]" />
              <span>Recent AI Team Activity</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('activity')}
              className="text-xs text-slate-400 hover:text-[#00ff66] transition cursor-pointer font-medium"
            >
              View All & Export →
            </button>
          </div>

          {recentActions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#0e1118] border border-[#1f2638] text-center text-xs text-slate-400 space-y-2">
              <UserCheck className="w-6 h-6 text-slate-600 mx-auto" />
              <div>No requests yet</div>
              <p className="text-[11px] text-slate-500">
                Type an instruction in the Command Bar above to assign your first task to your AI team.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentActions.map((action) => {
                const emp = AI_EMPLOYEES.find(e => e.id === action.employeeId) || AI_EMPLOYEES[0];
                return (
                  <div
                    key={action.id}
                    className="p-3.5 rounded-xl bg-[#0e1118] border border-[#21293a] flex items-center justify-between gap-3 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#141822] border border-[#263044] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {emp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{action.title}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          <span className="text-[#00ff66]">{emp.name}</span>: {action.stepSummary}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        action.status === 'completed'
                          ? 'bg-[#00ff66]/10 text-[#00ff66]'
                          : action.status === 'awaiting_approval'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-sky-500/10 text-sky-400'
                      }`}>
                        {action.status === 'awaiting_approval' ? 'Needs Approval' : action.status}
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
