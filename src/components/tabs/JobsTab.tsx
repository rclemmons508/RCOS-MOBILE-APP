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
  Send
} from 'lucide-react';

interface JobsTabProps {
  jobs: Job[];
  onAddJob: (newJob: Job) => void;
}

export const JobsTab: React.FC<JobsTabProps> = ({ jobs, onAddJob }) => {
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);

  // New Job Form State
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<Job['category']>('HVAC');
  const [priority, setPriority] = useState<Job['priority']>('high');

  const categories = ['All', 'HVAC', 'Automation', 'Security', 'Software AI', 'Electrical'];

  const filteredJobs = jobs.filter((j) => {
    const matchesCategory = filterCategory === 'All' || j.category === filterCategory;
    const matchesSearch =
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !clientName) return;

    const newJob: Job = {
      id: `RC-${Math.floor(1000 + Math.random() * 9000)}`,
      title,
      clientName,
      clientPhone: '+1 (555) 000-1234',
      address: address || 'RC Solutions Commercial Hub',
      status: priority === 'critical' ? 'urgent' : 'dispatched',
      priority,
      assignedTechnician: 'Marcus Vance (Senior Specialist)',
      estimatedValue: 1850,
      scheduledTime: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: 'Auto-dispatched via RCOS Smart Job Router.',
      aiNotes: 'RCOS AI automatically optimized route and dispatched nearest specialist.',
      category
    };

    onAddJob(newJob);
    setShowCreateModal(false);
    setTitle('');
    setClientName('');
    setAddress('');
  };

  const handleSmsClient = (job: Job) => {
    setSmsFeedback(`Dispatched automated SMS ETA alert to ${job.clientName} (${job.clientPhone}).`);
    setTimeout(() => setSmsFeedback(null), 3000);
  };

  return (
    <div className="space-y-4 pb-6 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden">
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
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 truncate">
              RCOS Operations & Tasks
            </h2>
            <p className="text-xs text-zinc-400 truncate">Smart Resource Routing & Allocation</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
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
            placeholder="Search tasks by ID, title, or client..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                filterCategory === cat
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold'
                  : 'bg-zinc-950 text-zinc-400 border border-zinc-800/80 hover:text-zinc-200'
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
            <div className="text-sm font-bold text-zinc-300">No active jobs or tasks</div>
            <p className="text-xs text-zinc-500">Dispatch a new operational task or simulate an incoming request.</p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-2 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30 cursor-pointer hover:bg-amber-500/30 transition-colors"
            >
              + Dispatch First Job
            </button>
          </div>
        ) : (
          filteredJobs.map((job) => (
          <div
            key={job.id}
            className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3 hover:border-zinc-700 transition-all shadow-md"
          >
            {/* Top Info Bar */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-400">{job.id}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800 font-mono">
                    {job.category}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mt-1 leading-snug">{job.title}</h3>
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

            {/* Address & Technician details */}
            <div className="space-y-1.5 text-xs text-zinc-300">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">{job.address}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400 pt-0.5">
                <span className="flex items-center gap-1.5 truncate">
                  <UserCheck className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                  <strong className="text-white truncate">{job.assignedTechnician}</strong>
                </span>
                <span className="text-zinc-500 text-[10px] font-mono shrink-0">{job.scheduledTime}</span>
              </div>
            </div>

            {/* AI Router Notes */}
            {job.aiNotes && (
              <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-300 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-lime-400 shrink-0 mt-0.5" />
                <p className="leading-snug font-sans">{job.aiNotes}</p>
              </div>
            )}

            {/* Bottom Card Action Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-xs">
              <div className="text-zinc-400 font-mono">
                Value: <span className="text-lime-400 font-bold">${job.estimatedValue}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSmsClient(job)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
                >
                  SMS Client
                </button>
                <button
                  type="button"
                  onClick={() => alert(`Resource route navigation optimized for ${job.id}`)}
                  className="px-2.5 py-1 rounded-lg bg-lime-500/10 border border-lime-500/30 text-lime-400 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Route</span>
                </button>
              </div>
            </div>
          </div>
        ))
        )}
      </div>

      {/* Dispatch New Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
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

            <form onSubmit={handleCreateJob} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase">Task Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Chill Water Sensor Diagnostic"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 mt-1 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase">Client Name</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g., Apex Tower"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 mt-1 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white mt-1 focus:border-amber-500"
                  >
                    <option value="HVAC">HVAC</option>
                    <option value="Automation">Automation</option>
                    <option value="Security">Security</option>
                    <option value="Software AI">Software AI</option>
                    <option value="Electrical">Electrical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase">Site Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., 450 Tech Parkway, Suite 1200"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 mt-1 focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 text-xs font-bold hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-black font-extrabold text-xs hover:bg-amber-400 transition-all cursor-pointer shadow-md shadow-amber-500/20"
                >
                  Auto-Dispatch Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
