import React, { useState } from 'react';
import { Job } from '../../types';
import { 
  Briefcase, 
  MapPin, 
  UserCheck, 
  Plus, 
  Search, 
  Sparkles, 
  Navigation,
  X,
  Send,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  ArrowRight,
  Phone,
  Eye,
  AlertCircle
} from 'lucide-react';
import { JobDetailModal } from '../jobs/JobDetailModal';
import { haptic } from '../../utils/haptics';

interface JobsTabProps {
  jobs: Job[];
  onAddJob: (newJob: Job) => void;
  onUpdateJob?: (updatedJob: Job) => void;
  onDeleteJob?: (id: string) => void;
  onTriggerNotification?: (title: string, message: string) => void;
}

export const JobsTab: React.FC<JobsTabProps> = ({ 
  jobs, 
  onAddJob,
  onUpdateJob,
  onDeleteJob,
  onTriggerNotification
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<Job | null>(null);
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);

  // New Job Form State
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('+1 (555) 234-8901');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<Job['category']>('HVAC');
  const [priority, setPriority] = useState<Job['priority']>('high');
  const [estimatedValue, setEstimatedValue] = useState<number>(1850);
  const [description, setDescription] = useState('');

  const categories = ['All', 'HVAC', 'Automation', 'Security', 'Software AI', 'Electrical', 'Plumbing'];
  const statuses = ['All', 'urgent', 'dispatched', 'in_progress', 'completed'];

  const filteredJobs = jobs.filter((j) => {
    const matchesCategory = filterCategory === 'All' || j.category === filterCategory;
    const matchesStatus = filterStatus === 'All' || j.status === filterStatus;
    const matchesSearch =
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.assignedTechnician && j.assignedTechnician.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesStatus && matchesSearch;
  });

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !clientName) return;

    if (priority === 'critical') {
      await haptic.warning();
    } else {
      await haptic.medium();
    }

    const newJob: Job = {
      id: `RC-${Math.floor(1000 + Math.random() * 9000)}`,
      title,
      clientName,
      clientPhone: clientPhone || '+1 (555) 234-8901',
      address: address || 'RC Solutions Commercial Hub, Austin TX',
      status: priority === 'critical' ? 'urgent' : 'dispatched',
      priority,
      assignedTechnician: 'Marcus Vance (Senior Specialist)',
      estimatedValue: Number(estimatedValue) || 1850,
      scheduledTime: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: description || 'Inbound service request captured and processed via RCOS Job Engine.',
      aiNotes: 'RCOS AI automatically optimized route and dispatched nearest specialist.',
      category
    };

    onAddJob(newJob);
    setShowCreateModal(false);
    setTitle('');
    setClientName('');
    setAddress('');
    setDescription('');
    if (onTriggerNotification) {
      onTriggerNotification('New Task Created', `Task ${newJob.id} dispatched for ${clientName}.`);
    }
  };

  const handleSmsClient = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    haptic.light();
    setSmsFeedback(`Dispatched automated SMS ETA alert to ${job.clientName} (${job.clientPhone || '+1 (555) 000-1234'}).`);
    setTimeout(() => setSmsFeedback(null), 3000);
  };

  const handleQuickStatusChange = (e: React.MouseEvent, job: Job, nextStatus: Job['status']) => {
    e.stopPropagation();
    haptic.medium();
    if (onUpdateJob) {
      onUpdateJob({ ...job, status: nextStatus });
    }
    if (onTriggerNotification) {
      onTriggerNotification(
        'Task Status Advanced',
        `Job ${job.id} changed to ${nextStatus.toUpperCase()}`
      );
    }
  };

  const getStatusBadge = (st: Job['status']) => {
    switch (st) {
      case 'completed':
        return 'bg-lime-500/10 text-lime-400 border-lime-500/30';
      case 'in_progress':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'urgent':
        return 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse';
      case 'unassigned':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    }
  };

  return (
    <div className="space-y-4 pb-8 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden">
      {/* Toast Feedback */}
      {smsFeedback && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-lime-500 text-black px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Send className="w-3.5 h-3.5" />
          <span>{smsFeedback}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 truncate">
                RCOS Operations & Tasks
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-lime-400 font-mono font-bold">
                {jobs.length} Total
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate">Smart Resource Routing, Updates & Customer Review</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.light();
            setShowCreateModal(true);
          }}
          className="p-2 sm:px-3 sm:py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-lime-500/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Search & Category Filter Ribbon */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by ID, title, client, or technician..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
          />
        </div>

        {/* Status Filter Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono font-bold pr-1 shrink-0">
            Status:
          </span>
          {statuses.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                haptic.selection();
                setFilterStatus(st);
              }}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                filterStatus === st
                  ? 'bg-lime-500/20 text-lime-300 border-lime-500/50 font-bold shadow'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800/80 hover:text-zinc-200'
              }`}
            >
              {st === 'All' ? 'All Statuses' : st.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {/* Category Filter Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono font-bold pr-1 shrink-0">
            Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                haptic.selection();
                setFilterCategory(cat);
              }}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                filterCategory === cat
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 font-bold'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800/80 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Job Cards List */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
            <Briefcase className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="text-sm font-bold text-zinc-300">No tasks match active filters</div>
            <p className="text-xs text-zinc-500">Try changing status filters or dispatch a new work order.</p>
            <button
              type="button"
              onClick={() => {
                setFilterCategory('All');
                setFilterStatus('All');
                setSearchQuery('');
              }}
              className="mt-2 px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:text-white transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <div
              key={job.id}
              onClick={() => {
                haptic.light();
                setSelectedJobForDetail(job);
              }}
              className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3 hover:border-lime-500/40 transition-all shadow-md cursor-pointer group"
            >
              {/* Top Info Bar */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400">{job.id}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border font-mono ${getStatusBadge(job.status)}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800 font-mono">
                      {job.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1 leading-snug group-hover:text-lime-300 transition-colors">
                    {job.title}
                  </h3>
                </div>
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border font-mono shrink-0 ${
                    job.priority === 'critical'
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : job.priority === 'high'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                  }`}
                >
                  {job.priority}
                </span>
              </div>

              {/* Customer & Technician details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-300 pt-0.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <span className="text-[10px] text-zinc-500 uppercase font-mono">Customer:</span>
                    <strong className="text-white truncate">{job.clientName}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="truncate">{job.address}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="flex items-center gap-1.5 truncate">
                      <UserCheck className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <strong className="text-zinc-200 truncate">{job.assignedTechnician}</strong>
                    </span>
                    <span className="text-zinc-500 text-[10px] font-mono shrink-0">{job.scheduledTime}</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    Value: <span className="text-lime-400 font-bold">${job.estimatedValue.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* AI Router Notes / Customer Insight */}
              {job.aiNotes && (
                <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-300 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-lime-400 shrink-0 mt-0.5" />
                  <p className="leading-snug font-sans truncate">{job.aiNotes}</p>
                </div>
              )}

              {/* Bottom Card Action Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-xs">
                {/* 1-Tap Advance Status */}
                <div className="flex items-center gap-1.5">
                  {job.status === 'dispatched' && (
                    <button
                      type="button"
                      onClick={(e) => handleQuickStatusChange(e, job, 'in_progress')}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Start Job</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {job.status === 'in_progress' && (
                    <button
                      type="button"
                      onClick={(e) => handleQuickStatusChange(e, job, 'completed')}
                      className="px-2.5 py-1 rounded-lg bg-lime-500/10 hover:bg-lime-500/20 text-lime-300 border border-lime-500/30 text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Complete</span>
                    </button>
                  )}
                  {job.status === 'urgent' && (
                    <button
                      type="button"
                      onClick={(e) => handleQuickStatusChange(e, job, 'in_progress')}
                      className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Acknowledge Urgent</span>
                    </button>
                  )}
                </div>

                {/* Communication and Review Details */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => handleSmsClient(e, job)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
                  >
                    SMS Client
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      haptic.light();
                      setSelectedJobForDetail(job);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-lime-500/10 border border-lime-500/30 text-lime-400 hover:bg-lime-500/20 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Review & Update</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dispatch New Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-amber-400" />
                <span>Dispatch New RCOS Task</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chiller Loop Calibration & Sensor Overhaul"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-lime-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Apex Biotech"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-lime-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Client Phone
                  </label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-lime-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Site Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 8840 Research Blvd, Austin TX"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-lime-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-white focus:outline-none focus:border-lime-500"
                  >
                    <option value="HVAC">HVAC</option>
                    <option value="Automation">Automation</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Security">Security</option>
                    <option value="Software AI">Software AI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-white focus:outline-none focus:border-lime-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Est. Value ($)
                  </label>
                  <input
                    type="number"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-white focus:outline-none focus:border-lime-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Customer Issue Notes
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details of the customer request..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-lime-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold shadow-lg shadow-lime-500/20"
                >
                  Confirm & Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect & Update Job Modal */}
      <JobDetailModal
        isOpen={!!selectedJobForDetail}
        onClose={() => setSelectedJobForDetail(null)}
        job={selectedJobForDetail}
        onUpdateJob={(updated) => {
          if (onUpdateJob) onUpdateJob(updated);
          setSelectedJobForDetail(updated);
        }}
        onDeleteJob={(id) => {
          if (onDeleteJob) onDeleteJob(id);
          setSelectedJobForDetail(null);
        }}
        onTriggerNotification={onTriggerNotification}
      />
    </div>
  );
};
