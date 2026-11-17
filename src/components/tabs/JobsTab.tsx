import React, { useEffect, useRef, useState } from 'react';
import { Client, Job, InvoicePrefill } from '../../types';
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
  AlertCircle,
  DollarSign,
  CalendarDays,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { JobDetailModal } from '../jobs/JobDetailModal';
import { haptic } from '../../utils/haptics';
import { getJobCategories } from '../../lib/jobCategories';
import { buildClientDropdownOptions, JobPrefill } from '../../lib/jobClientLink';

interface JobsTabProps {
  jobs: Job[];
  onAddJob: (newJob: Job) => void;
  onUpdateJob?: (updatedJob: Job) => void;
  onDeleteJob?: (id: string) => void;
  onTriggerNotification?: (title: string, message: string) => void;
  onCreateInvoice?: (prefill: InvoicePrefill) => void;
  /** Quick-action signal: when App bumps this number, the create-job
      form opens. Lets the bottom bar's + button open the real form
      instead of just navigating to the tab. */
  openCreateSignal?: number;
  /** The business's industry id (e.g. 'it_services') and its own
      services list. Job categories come from these — see
      getJobCategories — never from a hardcoded trade list. */
  industry?: string;
  businessServices?: string[];
  /** Saved customers, for the customer dropdown on the Dispatch New Job
      form. Optional — the form works without it, with free-text
      name/phone only. */
  clients?: Client[];
  /** Pre-filled details for the next Dispatch open (e.g. "Start a job"
      from a customer profile). Read when openCreateSignal fires. */
  jobPrefill?: JobPrefill | null;
}

export const JobsTab: React.FC<JobsTabProps> = ({
  jobs,
  onAddJob,
  onUpdateJob,
  onDeleteJob,
  onTriggerNotification,
  onCreateInvoice,
  openCreateSignal = 0,
  industry,
  businessServices,
  clients = [],
  jobPrefill,
}) => {
  // Job categories come from the business itself (its own services, then
  // its industry preset's default services). The same list feeds the
  // filter ribbon, the Dispatch New Job picker, and the detail editor.
  const jobCategories = getJobCategories(industry, businessServices);

  // Active / Completed split: finished jobs move off the active list
  // into their own view instead of sitting there until deleted.
  const [jobView, setJobView] = useState<'active' | 'completed'>('active');
  const activeJobCount = jobs.filter((j) => j.status !== 'completed').length;
  const completedJobCount = jobs.length - activeJobCount;

  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Job Form State
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  // The saved customer this job is for (Client.id), or null for a
  // walk-in typed in by hand. Set by the customer dropdown or by a
  // "Start a job" prefill; cleared the moment the name or phone is
  // edited by hand, so a job never carries a link to a customer whose
  // details no longer match.
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<Job['category']>(jobCategories[0] ?? '');
  const [priority, setPriority] = useState<Job['priority']>('high');
  const [estimatedValue, setEstimatedValue] = useState<number>(1850);
  const [description, setDescription] = useState('');

  // Saved customers for the dropdown, in the order the list is given.
  const clientOptions = buildClientDropdownOptions(clients);

  // Open the Dispatch form: blank for a walk-in, or pre-filled from a
  // saved customer (name, phone, link, and the category from the
  // customer's service when it is one of the business's own services).
  const openCreateForm = (prefill?: JobPrefill | null) => {
    setTitle('');
    setAddress('');
    setDescription('');
    setPriority('high');
    setEstimatedValue(1850);
    if (prefill) {
      setClientName(prefill.name);
      setClientPhone(prefill.phone);
      setSelectedClientId(prefill.clientId);
      setCategory(
        prefill.serviceType && jobCategories.includes(prefill.serviceType)
          ? prefill.serviceType
          : (jobCategories[0] ?? ''),
      );
    } else {
      setClientName('');
      setClientPhone('');
      setSelectedClientId(null);
      setCategory(jobCategories[0] ?? '');
    }
    setShowCreateModal(true);
  };

  // Quick-action signal from the bottom bar's + button: a new value
  // opens the create form. The ref stops a re-render from reopening
  // it after the user closes it.
  const lastCreateSignalRef = useRef(0);
  // Identity of the last prefill object this tab consumed. App keeps
  // its copy until the next start-a-job action, so a later manual
  // Dispatch (same signal family, same object) must not re-apply a
  // stale customer's details — only a fresh prefill object is applied.
  const lastJobPrefillRef = useRef<JobPrefill | null>(null);
  useEffect(() => {
    if (openCreateSignal && openCreateSignal !== lastCreateSignalRef.current) {
      lastCreateSignalRef.current = openCreateSignal;
      if (jobPrefill && jobPrefill !== lastJobPrefillRef.current) {
        lastJobPrefillRef.current = jobPrefill;
        openCreateForm(jobPrefill);
      } else {
        openCreateForm();
      }
    }
    // openCreateForm is stable in practice (it only sets state); the
    // signal + prefill are the real triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreateSignal, jobPrefill]);
  // Stage 2 assembly (L5): one create at a time — double-click used to
  // create two jobs (random RC-#### ids, no dedupe).
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<Job | null>(null);
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);

  // Calendar strip (Stage 5): jobs carry a real date in `createdAt` (ISO,
  // stamped when the job is created). Older jobs have none — they show in
  // the unfiltered list but never under a day. Never guessed or backfilled.
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const jobDayKey = (j: Job): string | null => {
    if (!j.createdAt) return null;
    const d = new Date(j.createdAt);
    return Number.isNaN(d.getTime()) ? null : dayKey(d);
  };
  const startOfWeek = (d: Date) => {
    const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    c.setDate(c.getDate() - c.getDay());
    return c;
  };
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  // No day selected by default: the list shows every job, like before.
  // Tapping a day filters to that day's jobs.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const jobsByDay = new Map<string, number>();
  jobs.forEach((j) => {
    const k = jobDayKey(j);
    if (k) jobsByDay.set(k, (jobsByDay.get(k) || 0) + 1);
  });
  const selectedDayLabel = selectedDay
    ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    : null;
  const shiftWeek = (deltaDays: number) => {
    haptic.selection();
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + deltaDays);
      return d;
    });
  };

  const categories = ['All', ...jobCategories];
  const statuses = ['All', 'urgent', 'dispatched', 'in_progress', 'completed'];
  // In the Completed view the status filter has nothing to narrow — a
  // completed job is completed — so only 'All' shows there.
  const viewStatuses = jobView === 'active'
    ? statuses.filter((s) => s !== 'completed')
    : ['All'];

  const filteredJobs = jobs.filter((j) => {
    const matchesView = jobView === 'active' ? j.status !== 'completed' : j.status === 'completed';
    const matchesCategory = filterCategory === 'All' || j.category === filterCategory;
    const matchesStatus = filterStatus === 'All' || j.status === filterStatus;
    const matchesDay = !selectedDay || jobDayKey(j) === selectedDay;
    const matchesSearch =
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.assignedTechnician && j.assignedTechnician.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesView && matchesCategory && matchesStatus && matchesSearch && matchesDay;
  });

  // A selected day shows that day's jobs in booked order (earliest first).
  const sortedJobs = selectedDay
    ? [...filteredJobs].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    : filteredJobs;

  // Pick a saved customer: fill in their details, link the job to
  // them, and default the category to the service they use when it is
  // one of the business's own. Picking "New customer" keeps whatever
  // is typed — a walk-in is never blocked.
  const handleSelectClient = (id: string) => {
    if (!id) {
      setSelectedClientId(null);
      return;
    }
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    setSelectedClientId(client.id);
    setClientName(client.name);
    setClientPhone(client.phone);
    if (client.serviceType && jobCategories.includes(client.serviceType)) {
      setCategory(client.serviceType);
    }
  };

  // A hand edit to the name or phone means the job is no longer exactly
  // that saved customer's record — drop the link so it saves as free
  // text instead of pointing at the wrong customer.
  const handleClientNameChange = (value: string) => {
    setClientName(value);
    if (selectedClientId) setSelectedClientId(null);
  };
  const handleClientPhoneChange = (value: string) => {
    setClientPhone(value);
    if (selectedClientId) setSelectedClientId(null);
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingJob) return;
    if (!title || !clientName) return;
    setIsCreatingJob(true);

    if (priority === 'critical') {
      await haptic.warning();
    } else {
      await haptic.medium();
    }

    const newJob: Job = {
      id: `RC-${Math.floor(1000 + Math.random() * 9000)}`,
      title,
      clientName,
      clientPhone: clientPhone.trim(),
      // Only present when the job was started for a saved customer —
      // the key is left off entirely for walk-ins, so nothing
      // undefined ever reaches the save path.
      ...(selectedClientId ? { clientId: selectedClientId } : {}),
      address: address.trim(),
      status: priority === 'critical' ? 'urgent' : 'dispatched',
      priority,
      assignedTechnician: 'Unassigned',
      estimatedValue: Number(estimatedValue) || 1850,
      scheduledTime: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: description || 'Inbound service request captured and processed via RCOS Job Engine.',
      category
    };

    onAddJob(newJob);
    setShowCreateModal(false);
    setTitle('');
    setClientName('');
    setClientPhone('');
    setSelectedClientId(null);
    setAddress('');
    setDescription('');
    if (onTriggerNotification) {
      onTriggerNotification('New Job Created', `Job ${newJob.id} dispatched for ${clientName}.`);
    }
    setIsCreatingJob(false);
  };

  const handleSmsClient = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    haptic.light();
    if (!job.clientPhone) {
      setSmsFeedback(`No phone number on file for ${job.clientName}. Add one to the job first.`);
    } else {
      setSmsFeedback(`Dispatched automated SMS ETA alert to ${job.clientName} (${job.clientPhone}).`);
    }
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
        'Job Status Advanced',
        `Job ${job.id} changed to ${nextStatus.toUpperCase()}`
      );
    }
  };

  const getStatusBadge = (st: Job['status']) => {
    switch (st) {
      case 'completed':
        return 'bg-[#22ec72]/10 text-[#22ec72] border-[#22ec72]/30';
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
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#22ec72] text-black px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Send className="w-3.5 h-3.5" />
          <span>{smsFeedback}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0c1211] border border-[#1d2b26] flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-[#22ec72]/10 border border-[#22ec72]/30 text-[#22ec72] shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 truncate">
                Schedule
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 border border-[#1d2b26] text-[#22ec72] font-mono font-bold">
                {jobs.length} Total
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate">Manage your team's schedule</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.light();
            openCreateForm();
          }}
          className="min-h-[48px] p-2 sm:px-3 sm:py-2 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] text-black font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-[#22ec72]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Job</span>
        </button>
      </div>

      {/* Calendar strip — tap a day to see that day's jobs. A dot marks a
          day with jobs. Weeks move with the arrows; Today jumps back. */}
      <div className="rounded-2xl bg-[#0c1211] border border-[#1d2b26] p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => shiftWeek(-7)}
              className="min-h-[48px] p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900/60 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-white min-w-[110px] text-center">
              {weekDays[3].toLocaleDateString([], { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => shiftWeek(7)}
              className="min-h-[48px] p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900/60 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              setWeekStart(startOfWeek(new Date()));
              setSelectedDay(dayKey(new Date()));
            }}
            className="min-h-[48px] text-xs font-bold text-[#22ec72] hover:text-white px-2 py-1 rounded-lg cursor-pointer"
          >
            Today
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d) => {
            const k = dayKey(d);
            const isToday = k === dayKey(new Date());
            const isSelected = k === selectedDay;
            const hasJobs = jobsByDay.has(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}${hasJobs ? `, ${jobsByDay.get(k)} job${(jobsByDay.get(k) || 0) === 1 ? '' : 's'}` : ', no jobs'}`}
                onClick={() => {
                  haptic.selection();
                  setSelectedDay(isSelected ? null : k);
                }}
                className={`py-2 rounded-xl text-center transition-all cursor-pointer min-h-[52px] ${
                  isSelected
                    ? 'bg-[#22ec72] text-black'
                    : 'bg-[#0c1211]/60 text-zinc-300 hover:bg-zinc-900/60'
                } ${isToday && !isSelected ? 'border border-[#22ec72]/50' : 'border border-transparent'}`}
              >
                <div className="text-xs font-bold uppercase tracking-wide opacity-70">
                  {d.toLocaleDateString([], { weekday: 'short' })}
                </div>
                <div className="text-sm font-extrabold leading-tight">{d.getDate()}</div>
                <div className="h-1.5 flex items-center justify-center">
                  {hasJobs && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black' : 'bg-[#22ec72]'}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {selectedDay && selectedDayLabel && (
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>
              Showing jobs for <span className="text-white font-semibold">{selectedDayLabel}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                haptic.light();
                setSelectedDay(null);
              }}
              className="min-h-[48px] text-[#22ec72] font-bold hover:text-white cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Search & Category Filter Ribbon */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search jobs by ID, title, client, or technician..."
            className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#22ec72]"
          />
        </div>

        {/* Active / Completed switch — finished jobs live in their own
            view so the active list only ever shows work still to do. */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            aria-pressed={jobView === 'active'}
            onClick={() => {
              haptic.selection();
              setJobView('active');
              setFilterStatus('All');
            }}
            className={`min-h-[48px] px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              jobView === 'active'
                ? 'bg-[#22ec72]/20 text-[#22ec72] border-[#22ec72]/50 shadow'
                : 'bg-[#0c1211] text-zinc-400 border-[#1d2b26] hover:text-zinc-200'
            }`}
          >
            Active ({activeJobCount})
          </button>
          <button
            type="button"
            aria-pressed={jobView === 'completed'}
            onClick={() => {
              haptic.selection();
              setJobView('completed');
              setFilterStatus('All');
            }}
            className={`min-h-[48px] px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              jobView === 'completed'
                ? 'bg-[#22ec72]/20 text-[#22ec72] border-[#22ec72]/50 shadow'
                : 'bg-[#0c1211] text-zinc-400 border-[#1d2b26] hover:text-zinc-200'
            }`}
          >
            Completed ({completedJobCount})
          </button>
        </div>

        {/* Status Filter Ribbon — only in the Active view; in the
            Completed view every job is completed, so there is nothing
            left to narrow by status. */}
        {jobView === 'active' && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono font-bold pr-1 shrink-0">
            Status:
          </span>
          {viewStatuses.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                haptic.selection();
                setFilterStatus(st);
              }}
              className={`min-h-[48px] px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                filterStatus === st
                  ? 'bg-[#22ec72]/20 text-[#22ec72] border-[#22ec72]/50 font-bold shadow'
                  : 'bg-[#0c1211] text-zinc-400 border-[#1d2b26] hover:text-zinc-200'
              }`}
            >
              {st === 'All' ? 'All Statuses' : st.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
        )}

        {/* Category Filter Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono font-bold pr-1 shrink-0">
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
              className={`min-h-[48px] px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                filterCategory === cat
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 font-bold'
                  : 'bg-[#0c1211] text-zinc-400 border-[#1d2b26] hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Job Cards List */}
      <div className="space-y-3">
        {sortedJobs.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#0c1211] border border-[#1d2b26] space-y-2">
            <Briefcase className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="text-sm font-bold text-zinc-300">
              {selectedDay && selectedDayLabel
                ? `No jobs on ${selectedDayLabel}`
                : jobView === 'completed'
                  ? 'No completed jobs yet'
                  : 'No jobs match these filters'}
            </div>
            <p className="text-xs text-zinc-500">
              {selectedDay && selectedDayLabel
                ? 'Nothing is booked for this day yet.'
                : jobView === 'completed'
                  ? 'Finished jobs move here on their own — nothing to delete.'
                  : 'Try changing status filters or dispatch a new work order.'}
            </p>
            {selectedDay ? (
              <button
                type="button"
                onClick={() => {
                  haptic.light();
                  setSelectedDay(null);
                }}
                className="min-h-[48px] mt-2 px-3 py-1.5 rounded-xl bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/30 text-xs font-semibold hover:bg-[#22ec72]/20 transition-colors cursor-pointer"
              >
                Show all jobs
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFilterCategory('All');
                  setFilterStatus('All');
                  setSearchQuery('');
                }}
                className="min-h-[48px] mt-2 px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:text-white transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          sortedJobs.map((job) => (
            <div
              key={job.id}
              onClick={() => {
                haptic.light();
                setSelectedJobForDetail(job);
              }}
              className="p-3.5 sm:p-4 rounded-2xl bg-[#0c1211] border border-[#1d2b26] space-y-3 hover:border-[#22ec72]/40 transition-all shadow-md cursor-pointer group"
            >
              {/* Top Info Bar */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400">{job.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase border font-mono ${getStatusBadge(job.status)}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-[#1d2b26] font-mono">
                      {job.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1 leading-snug group-hover:text-[#22ec72] transition-colors">
                    {job.title}
                  </h3>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase border font-mono shrink-0 ${
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
                    <span className="text-xs text-zinc-500 uppercase font-mono">Customer:</span>
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
                      <UserCheck className="w-3.5 h-3.5 text-[#22ec72] shrink-0" />
                      <strong className="text-zinc-200 truncate">{job.assignedTechnician}</strong>
                    </span>
                    <span className="text-zinc-500 text-xs font-mono shrink-0">{job.scheduledTime}</span>
                  </div>
                  <div className="text-xs text-zinc-400 font-mono">
                    Value: <span className="text-[#22ec72] font-bold">${(job.estimatedValue ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* AI Router Notes / Customer Insight */}
              {job.aiNotes && (
                <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-[#1d2b26] text-xs text-zinc-300 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#22ec72] shrink-0 mt-0.5" />
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
                      className="min-h-[48px] px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Start Job</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {job.status === 'in_progress' && (
                    <button
                      type="button"
                      onClick={(e) => handleQuickStatusChange(e, job, 'completed')}
                      className="min-h-[48px] px-2.5 py-1 rounded-lg bg-[#22ec72]/10 hover:bg-[#22ec72]/20 text-[#22ec72] border border-[#22ec72]/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Complete</span>
                    </button>
                  )}
                  {job.status === 'completed' && !job.invoiceId && onCreateInvoice && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        haptic.medium();
                        onCreateInvoice({
                          clientName: job.clientName,
                          serviceName: job.title,
                          amount: job.estimatedValue || 0,
                          details: job.description || '',
                          jobId: job.id,
                        });
                      }}
                      className="min-h-[48px] px-2.5 py-1 rounded-lg bg-[#22ec72]/10 hover:bg-[#22ec72]/20 text-[#22ec72] border border-[#22ec72]/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <DollarSign className="w-3 h-3" />
                      <span>Create Invoice</span>
                    </button>
                  )}
                  {job.status === 'completed' && job.invoiceId && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/30">
                      Invoiced
                    </span>
                  )}
                  {job.status === 'urgent' && (
                    <button
                      type="button"
                      onClick={(e) => handleQuickStatusChange(e, job, 'in_progress')}
                      className="min-h-[48px] px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
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
                    className="min-h-[48px] px-2.5 py-1 rounded-lg bg-zinc-900 border border-[#1d2b26] text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer"
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
                    className="min-h-[48px] px-2.5 py-1 rounded-lg bg-[#22ec72]/10 border border-[#22ec72]/30 text-[#22ec72] hover:bg-[#22ec72]/20 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
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

      {/* Dispatch New Job Modal */}
      {showCreateModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0c1211] border border-[#1d2b26] rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1d2b26] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-amber-400" />
                <span>Dispatch New Job</span>
              </h3>
              <button aria-label="Close"
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="min-h-[48px] text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Describe the work needed"
                  className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#22ec72]"
                />
              </div>

              {/* Saved customer — pick one to fill in their details and
                  link the job to them, or leave it on "New customer" and
                  type the details in by hand. */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Saved Customer
                </label>
                {clientOptions.length > 0 ? (
                  <select
                    value={selectedClientId ?? ''}
                    onChange={(e) => handleSelectClient(e.target.value)}
                    aria-label="Saved customer"
                    className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#22ec72]"
                  >
                    <option value="">New customer — enter details below</option>
                    {clientOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    disabled
                    value=""
                    aria-label="No saved customers yet"
                    className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl px-3 py-2 text-zinc-500 focus:outline-none opacity-60"
                  >
                    <option value="">No saved customers yet — enter details below</option>
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => handleClientNameChange(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#22ec72]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Client Phone
                  </label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => handleClientPhoneChange(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#22ec72] font-mono"
                  />
                </div>
              </div>

              {selectedClientId ? (
                <p className="flex items-center gap-1.5 text-xs text-[#22ec72]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Linked to a saved customer — editing the name or phone unlinks the job.</span>
                </p>
              ) : null}

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Site Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 8840 Research Blvd, Austin TX"
                  className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#22ec72]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  {jobCategories.length > 0 ? (
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl px-2 py-2 text-white focus:outline-none focus:border-[#22ec72]"
                    >
                      {jobCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      disabled
                      value=""
                      aria-label="No services set up yet"
                      className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl px-2 py-2 text-zinc-500 focus:outline-none opacity-60"
                    >
                      <option value="">No services set up — add services in Settings</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl px-2 py-2 text-white focus:outline-none focus:border-[#22ec72]"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Est. Value ($)
                  </label>
                  <input
                    type="number"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl px-2 py-2 text-white focus:outline-none focus:border-[#22ec72] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Customer Issue Notes
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details of the customer request..."
                  className="w-full bg-zinc-900 border border-[#1d2b26] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#22ec72]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingJob}
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-[#22ec72] hover:bg-[#4bf28a] text-black font-extrabold shadow-lg shadow-[#22ec72]/20 disabled:opacity-60"
                >
                  {isCreatingJob ? 'Creating…' : 'Confirm & Dispatch'}
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
        categories={jobCategories}
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
