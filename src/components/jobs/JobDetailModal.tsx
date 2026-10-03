import React, { useState } from 'react';
import { Job } from '../../types';
import { haptic } from '../../utils/haptics';
import { 
  X, 
  Briefcase, 
  MapPin, 
  Phone, 
  UserCheck, 
  Clock, 
  DollarSign, 
  Sparkles, 
  Send, 
  Save, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  FileText, 
  Navigation,
  MessageSquare,
  ShieldAlert,
  User,
  Building2,
  Calendar
} from 'lucide-react';

interface JobDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  onUpdateJob: (updated: Job) => void;
  onDeleteJob?: (id: string) => void;
  onTriggerNotification?: (title: string, message: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  isOpen,
  onClose,
  job,
  onUpdateJob,
  onDeleteJob,
  onTriggerNotification
}) => {
  if (!isOpen || !job) return null;

  const [title, setTitle] = useState(job.title);
  const [clientName, setClientName] = useState(job.clientName);
  const [clientPhone, setClientPhone] = useState(job.clientPhone || '+1 (555) 000-1234');
  const [address, setAddress] = useState(job.address);
  const [status, setStatus] = useState<Job['status']>(job.status);
  const [priority, setPriority] = useState<Job['priority']>(job.priority);
  const [assignedTechnician, setAssignedTechnician] = useState(job.assignedTechnician);
  const [scheduledTime, setScheduledTime] = useState(job.scheduledTime);
  const [estimatedValue, setEstimatedValue] = useState(job.estimatedValue);
  const [category, setCategory] = useState(job.category);
  const [description, setDescription] = useState(job.description || '');
  const [aiNotes, setAiNotes] = useState(job.aiNotes || '');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'customer' | 'edit'>('overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSave = async () => {
    await haptic.medium();
    const updated: Job = {
      ...job,
      title,
      clientName,
      clientPhone,
      address,
      status,
      priority,
      assignedTechnician,
      scheduledTime,
      estimatedValue: Number(estimatedValue),
      category,
      description: operatorNotes 
        ? `${description}\n\n[Operator Update]: ${operatorNotes}`
        : description,
      aiNotes
    };

    onUpdateJob(updated);
    if (onTriggerNotification) {
      onTriggerNotification(
        'Job Record Updated',
        `Task ${job.id} (${title}) status set to ${status.toUpperCase()}.`
      );
    }
    showToast('Job record saved successfully.');
    setTimeout(() => onClose(), 400);
  };

  const handleSmsClient = () => {
    haptic.light();
    showToast(`Automated SMS dispatched to ${clientName} (${clientPhone}).`);
  };

  const handleCallClient = () => {
    haptic.light();
    showToast(`Dialing client contact ${clientPhone} via RCOS Voice carrier...`);
  };

  const handleAdvanceStatus = (newStatus: Job['status']) => {
    haptic.medium();
    setStatus(newStatus);
    const updated = { ...job, status: newStatus };
    onUpdateJob(updated);
    showToast(`Job status changed to ${newStatus.toUpperCase()}`);
  };

  const getStatusColor = (st: Job['status']) => {
    switch (st) {
      case 'completed':
        return 'bg-lime-500/10 text-lime-400 border-lime-500/30';
      case 'in_progress':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'urgent':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'unassigned':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[92vh] bg-zinc-950 border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden">
        {/* Toast Feedback */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-lime-500 text-black px-4 py-2 rounded-full font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-900 bg-zinc-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-amber-400">{job.id}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase border ${getStatusColor(status)}`}>
                  {status}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
                  {category}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center border-b border-zinc-900 px-4 sm:px-6 bg-zinc-900/30 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 border-b-2 font-bold transition cursor-pointer ${
              activeTab === 'overview'
                ? 'border-lime-400 text-lime-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Overview & Quick Actions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customer')}
            className={`py-2.5 px-3 border-b-2 font-bold transition cursor-pointer ${
              activeTab === 'customer'
                ? 'border-lime-400 text-lime-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Customer Request Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`py-2.5 px-3 border-b-2 font-bold transition cursor-pointer ${
              activeTab === 'edit'
                ? 'border-lime-400 text-lime-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Edit Job Details
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Quick Status Bar */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Update Operational Status
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {(['unassigned', 'dispatched', 'in_progress', 'urgent', 'completed'] as Job['status'][]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleAdvanceStatus(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                        status === st
                          ? getStatusColor(st) + ' font-bold ring-1 ring-lime-400/50'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {st === 'in_progress' ? 'In Progress' : st === 'unassigned' ? 'Unassigned' : st.charAt(0).toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer & Location Quick Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1.5">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono font-bold">Client Account</div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <User className="w-4 h-4 text-purple-400" />
                    <span>{clientName}</span>
                  </div>
                  <div className="text-zinc-400 flex items-center gap-1 text-[11px]">
                    <Phone className="w-3 h-3 text-zinc-500" />
                    <span>{clientPhone}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1.5">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono font-bold">Assigned Crew</div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-lime-400" />
                    <span>{assignedTechnician}</span>
                  </div>
                  <div className="text-zinc-400 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    <span>{scheduledTime}</span>
                  </div>
                </div>
              </div>

              {/* Service Address */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-zinc-500 uppercase font-mono">Service Site</div>
                    <div className="text-zinc-200 font-medium truncate">{address}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-zinc-500 uppercase font-mono">Contract Value</div>
                  <div className="text-lime-400 font-mono font-black text-sm">${estimatedValue.toLocaleString()}</div>
                </div>
              </div>

              {/* Quick Communication Actions */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={handleCallClient}
                  className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-lime-400" />
                  <span>Call Client</span>
                </button>
                <button
                  type="button"
                  onClick={handleSmsClient}
                  className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-purple-400" />
                  <span>SMS Status</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert(`Optimized GPS route dispatched for ${address}`)}
                  className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Navigate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className="p-2.5 rounded-xl bg-lime-500/10 hover:bg-lime-500/20 border border-lime-500/30 text-lime-400 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Edit Task</span>
                </button>
              </div>

              {/* AI Dispatch History & Insights */}
              {aiNotes && (
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-lime-400 font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>RCOS AI Routing Insight</span>
                  </div>
                  <p className="text-zinc-300 font-sans leading-relaxed">{aiNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CUSTOMER REQUEST INFORMATION */}
          {activeTab === 'customer' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-purple-400" />
                    <span>Customer Inbound Scope</span>
                  </h4>
                  <span className="text-[10px] text-zinc-400 font-mono">Channel: Voice / Inbound Intake</span>
                </div>

                <div className="p-3 rounded-xl bg-black/60 border border-zinc-850 text-zinc-300 space-y-2 leading-relaxed">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Reported Problem Description</div>
                  <p className="text-xs text-zinc-200 font-sans">{description || 'Customer reported operational disruption requiring immediate specialist dispatch.'}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase font-mono">Customer Urgency</div>
                    <div className="font-bold text-white capitalize flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${priority === 'critical' ? 'bg-red-400 animate-pulse' : 'bg-lime-400'}`} />
                      <span>{priority} Priority</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase font-mono">Service Category</div>
                    <div className="font-bold text-white">{category}</div>
                  </div>
                </div>
              </div>

              {/* Add Operator Notes to Customer History */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                  Add Operator / Customer Service Follow-Up Notes
                </label>
                <textarea
                  rows={3}
                  value={operatorNotes}
                  onChange={(e) => setOperatorNotes(e.target.value)}
                  placeholder="Record customer updates, gate access codes, equipment serial numbers, or approval timestamps..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-lime-500"
                />
              </div>
            </div>
          )}

          {/* TAB 3: EDIT JOB DETAILS */}
          {activeTab === 'edit' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Task / Job Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Service Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  >
                    <option value="HVAC">HVAC</option>
                    <option value="Automation">Automation</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Security">Security</option>
                    <option value="Software AI">Software AI</option>
                    <option value="Plumbing">Plumbing</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
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
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Service Site Location Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Assigned Specialist
                  </label>
                  <input
                    type="text"
                    value={assignedTechnician}
                    onChange={(e) => setAssignedTechnician(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Scheduled Time
                  </label>
                  <input
                    type="text"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Contract Value ($)
                  </label>
                  <input
                    type="number"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Task Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="normal">Normal Priority</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical Urgent Outage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  >
                    <option value="unassigned">Unassigned / Pending</option>
                    <option value="dispatched">Dispatched</option>
                    <option value="in_progress">In Progress</option>
                    <option value="urgent">Urgent</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Description / Customer Problem Statement
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-lime-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-900/60 flex items-center justify-between gap-2 shrink-0">
          {onDeleteJob ? (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete task ${job.id}?`)) {
                  onDeleteJob(job.id);
                  onClose();
                }
              }}
              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Job</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-lime-500/20 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Job Updates</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
