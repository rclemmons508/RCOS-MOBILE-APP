import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  ShieldAlert, 
  Cpu, 
  Kanban, 
  CircleDollarSign, 
  CalendarClock, 
  TrendingUp, 
  HeartHandshake, 
  Wrench, 
  Megaphone, 
  FileText, 
  BarChart3, 
  Phone, 
  Mic, 
  Mail, 
  FileCheck, 
  Share2, 
  Sparkles,
  Bot,
  User,
  ToggleLeft,
  ToggleRight,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  ChevronRight,
  Zap,
  ShieldCheck,
  Hand,
  Settings2,
  DollarSign
} from 'lucide-react';
import { BusinessAccount } from '../types';
import { CustomAIEmployee, employeeCustomizationService } from '../services/employeeCustomizationService';
import { INDUSTRY_PRESETS } from '../data/presets';
import { haptic } from '../utils/haptics';
import { DEFAULT_BEHAVIOR_PROTOCOL, MAX_BEHAVIOR_PROTOCOL_LENGTH, resolveBehaviorProtocol } from '../utils/agentBehavior';
import { apiFetch } from '../lib/api';
import { AgentTalkConsole, TalkPersona } from './phone/AgentTalkConsole';

// Which AI Team members can be talked to by voice, and which voice persona
// they use. Customer Service talks as Support; the receptionist already has
// its own call button elsewhere, so it is not listed here.
const TALK_PERSONAS: Partial<Record<string, TalkPersona>> = {
  customer_service: 'support',
  operations: 'operations',
  sales: 'sales',
  marketing: 'marketing',
  executive_assistant: 'executive',
  technician: 'technician',
  finance: 'finance',
};

interface AiTeamViewProps {
  business: BusinessAccount;
  onUpdateBusiness: (updated: BusinessAccount) => void;
  /** Approvals waiting for the owner — shown as a banner (Design 1). */
  pendingApprovals?: number;
  onReviewApprovals?: () => void;
}

export const AiTeamView: React.FC<AiTeamViewProps> = ({
  business,
  onUpdateBusiness,
  pendingApprovals = 0,
  onReviewApprovals
}) => {
  // activeEmployees may be missing on a stripped/restored business record
  // (e.g. the localStorage copy drops it) - default to all-active
  // instead of crashing on the first employee read.
  const activeEmployees = business?.activeEmployees ?? {};
  const [employees, setEmployees] = useState<CustomAIEmployee[]>(() => 
    employeeCustomizationService.getEmployees(business.id)
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('executive_assistant');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [talkPersona, setTalkPersona] = useState<TalkPersona | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // Identify the business's detected industry preset. No preset matches
  // a business that has no industry set — in that case there is no
  // industry to derive from, so activePreset stays undefined instead of
  // falling back to some other trade's preset.
  const activePreset = INDUSTRY_PRESETS.find(p =>
    p.id === business.industry ||
    p.name.toLowerCase() === business.industry.toLowerCase() ||
    business.industry.toLowerCase().includes(p.id)
  );

  // Strictly filter only trade-relevant operational AI employees for this industry
  const relevantEmployeeIds = [
    'customer_service', // 24/7 Voice AI Receptionist
    'operations',       // Job Dispatch & Field Routing
    'sales',            // Trade Estimator & Proposal Drafter
    'technician',       // Field Lead Specialist
    'finance',          // Invoicing & Ledger Auditor
    'executive_assistant', // Operations & Safety Chief
    'marketing'         // Customer Reviews & Local Reach
  ];

  const industryEmployees = employees
    .filter(emp => relevantEmployeeIds.includes(emp.id) || emp.isCustom)
    .map(emp => {
      if (emp.id === 'technician' && activePreset?.technicianRoleName) {
        return {
          ...emp,
          roleTitle: activePreset.technicianRoleName,
          coreJob: `Executes ${activePreset.name} jobs using standardized Job Pack checklists, tools, and safety protocols.`
        };
      }
      return emp;
    });

  // Design 1 status header counts — live from the roster, not a fixed label.
  const activeCount = industryEmployees.filter((e) => activeEmployees[e.id] !== false).length;
  const pausedCount = industryEmployees.length - activeCount;

  // Customization Form Local State
  const selectedEmployee = industryEmployees.find(e => e.id === selectedEmployeeId) || industryEmployees[0] || employees[0];
  const isActive = activeEmployees[selectedEmployee.id] !== false;

  const [editName, setEditName] = useState(selectedEmployee.name);
  const [editRoleTitle, setEditRoleTitle] = useState(selectedEmployee.roleTitle);
  const [editDepartment, setEditDepartment] = useState(selectedEmployee.department);
  const [editCoreJob, setEditCoreJob] = useState(selectedEmployee.customJobScope || selectedEmployee.coreJob);
  const [editBehaviorProtocol, setEditBehaviorProtocol] = useState(
    resolveBehaviorProtocol(selectedEmployee.behaviorProtocol)
  );
  const [editAutonomy, setEditAutonomy] = useState<'autonomous' | 'supervised' | 'manual'>(
    selectedEmployee.autonomyLevel || 'autonomous'
  );
  const [editApprovalAmount, setEditApprovalAmount] = useState<number>(
    selectedEmployee.maxApprovalAmount || 1500
  );
  const [editTone, setEditTone] = useState<'professional' | 'friendly' | 'direct' | 'technical'>(
    selectedEmployee.tone || 'professional'
  );
  const [editEscalatesTo, setEditEscalatesTo] = useState(selectedEmployee.escalatesTo || 'Business Owner');
  const [editRules, setEditRules] = useState<string[]>(
    selectedEmployee.customRules || ['Always verify client identity and safety protocol.']
  );
  const [newRuleText, setNewRuleText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync edit form whenever selected employee changes
  useEffect(() => {
    if (selectedEmployee) {
      setEditName(selectedEmployee.name);
      setEditRoleTitle(selectedEmployee.roleTitle);
      setEditDepartment(selectedEmployee.department);
      setEditCoreJob(selectedEmployee.customJobScope || selectedEmployee.coreJob);
      setEditBehaviorProtocol(resolveBehaviorProtocol(selectedEmployee.behaviorProtocol));
      setEditAutonomy(selectedEmployee.autonomyLevel || 'autonomous');
      setEditApprovalAmount(selectedEmployee.maxApprovalAmount || 1500);
      setEditTone(selectedEmployee.tone || 'professional');
      setEditEscalatesTo(selectedEmployee.escalatesTo || 'Business Owner');
      setEditRules(selectedEmployee.customRules || ['Always verify client identity and safety protocol.']);
    }
  }, [selectedEmployeeId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Toggle active employee
  const handleToggleEmployee = async (empId: string) => {
    await haptic.selection();
    const currentStatus = activeEmployees[empId] !== false;
    const updatedEmployees = { ...activeEmployees, [empId]: !currentStatus };
    const updatedBiz = { ...business, activeEmployees: updatedEmployees };

    try {
      const saved = await apiFetch<BusinessAccount>(`/api/business/${business.id}`, {
        method: 'PUT',
        body: JSON.stringify({ activeEmployees: updatedEmployees })
      });
      if (saved) {
        onUpdateBusiness(saved);
        showToast(`${industryEmployees.find(e => e.id === empId)?.name || 'Employee'} status updated.`);
      }
    } catch (err) {
      console.error('Failed to update employee toggle', err);
    }
  };

  // Unsaved-changes check: the form is dirty when any field differs from
  // the selected employee's saved values (protocol resolves to the
  // default when nothing custom is stored).
  const isDirty =
    editName !== selectedEmployee.name ||
    editRoleTitle !== selectedEmployee.roleTitle ||
    editDepartment !== selectedEmployee.department ||
    editCoreJob !== (selectedEmployee.customJobScope || selectedEmployee.coreJob) ||
    editBehaviorProtocol !== resolveBehaviorProtocol(selectedEmployee.behaviorProtocol) ||
    editAutonomy !== (selectedEmployee.autonomyLevel || 'autonomous') ||
    editApprovalAmount !== (selectedEmployee.maxApprovalAmount || 1500) ||
    editTone !== (selectedEmployee.tone || 'professional') ||
    editEscalatesTo !== (selectedEmployee.escalatesTo || 'Business Owner') ||
    JSON.stringify(editRules) !== JSON.stringify(selectedEmployee.customRules || ['Always verify client identity and safety protocol.']);

  // Switching employees with unsaved edits asks first (same confirm()
  // pattern the reset actions already use) instead of silently dropping them.
  const handleSelectEmployee = (empId: string) => {
    if (empId === selectedEmployeeId) return;
    if (isDirty && !confirm(`You have unsaved changes for ${selectedEmployee.name}. Switch without saving?`)) return;
    haptic.light();
    setSelectedEmployeeId(empId);
  };

  // Save employee customization
  const handleSaveCustomization = async () => {
    if (isSaving) return;
    if (editBehaviorProtocol.length > MAX_BEHAVIOR_PROTOCOL_LENGTH) {
      setFormError(`Behavior protocol is too long — keep it under ${MAX_BEHAVIOR_PROTOCOL_LENGTH.toLocaleString()} characters.`);
      return;
    }
    // Blank, or untouched default text, stores as "no custom protocol" so
    // the standard protocol keeps applying without persisting a copy of it.
    const trimmedProtocol = editBehaviorProtocol.trim();
    const protocolToSave = !trimmedProtocol || trimmedProtocol === DEFAULT_BEHAVIOR_PROTOCOL
      ? undefined
      : trimmedProtocol;
    setFormError(null);
    setIsSaving(true);
    // NOTE: the save body below intentionally keeps its original
    // indentation inside the try block, so this change applies cleanly on
    // top of the per-business update without re-indenting shared lines.
    try {
    await haptic.success();
    const updated = employeeCustomizationService.updateEmployee(selectedEmployee.id, {
      name: editName,
      roleTitle: editRoleTitle,
      department: editDepartment,
      customJobScope: editCoreJob,
      coreJob: editCoreJob,
      behaviorProtocol: protocolToSave,
      autonomyLevel: editAutonomy,
      maxApprovalAmount: Number(editApprovalAmount),
      tone: editTone,
      escalatesTo: editEscalatesTo,
      customRules: editRules
    }, business.id);

    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
    showToast(`Saved customizations for ${updated.name}!`);
    } catch (err) {
      console.error('Failed to save employee customization', err);
      setFormError('Could not save — please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Add rule
  const handleAddRule = () => {
    if (!newRuleText.trim()) return;
    setEditRules(prev => [...prev, newRuleText.trim()]);
    setNewRuleText('');
  };

  // Delete rule
  const handleDeleteRule = (idx: number) => {
    setEditRules(prev => prev.filter((_, i) => i !== idx));
  };

  // Reset employee
  const handleResetEmployee = () => {
    if (confirm(`Reset ${selectedEmployee.name} back to default system instructions?`)) {
      const reset = employeeCustomizationService.resetEmployee(selectedEmployee.id, business.id);
      setEmployees(prev => prev.map(e => e.id === reset.id ? reset : e));
      setEditName(reset.name);
      setEditRoleTitle(reset.roleTitle);
      setEditDepartment(reset.department);
      setEditCoreJob(reset.coreJob);
      setEditBehaviorProtocol(resolveBehaviorProtocol(reset.behaviorProtocol));
      setEditAutonomy('autonomous');
      setEditApprovalAmount(1500);
      setEditEscalatesTo(reset.escalatesTo);
      setEditRules([...(reset.customRules || [])]);
      showToast(`${reset.name} restored to factory default.`);
    }
  };

  // Add custom specialist
  const handleCreateCustomSpecialist = () => {
    const newSpec = employeeCustomizationService.addCustomEmployee({
      name: 'Custom Operations Specialist',
      roleTitle: 'Specialized Consultant',
      department: 'Operations',
      avatarIcon: 'Sparkles',
      coreJob: 'Executes specialized client workflows, customized audit checklists, and dedicated routing.',
      escalatesTo: 'Executive Assistant',
      tagline: 'Custom specialist agent',
      systemPromptRole: 'You are a specialized RCOS AI Operations Consultant. You follow dedicated user guidelines and execute jobs accurately.'
    }, business.id);

    setEmployees(prev => [...prev, newSpec]);
    setSelectedEmployeeId(newSpec.id);
    showToast('New Custom AI Specialist created! Tune their job scope below.');
  };

  const getEmployeeIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldAlert': return <ShieldAlert className="w-4 h-4 text-[#22ec72]" />;
      case 'Cpu': return <Cpu className="w-4 h-4 text-cyan-400" />;
      case 'Kanban': return <Kanban className="w-4 h-4 text-purple-400" />;
      case 'CircleDollarSign': return <CircleDollarSign className="w-4 h-4 text-amber-400" />;
      case 'Users': return <Users className="w-4 h-4 text-blue-400" />;
      case 'CalendarClock': return <CalendarClock className="w-4 h-4 text-[#22ec72]" />;
      case 'TrendingUp': return <TrendingUp className="w-4 h-4 text-[#22ec72]" />;
      case 'HeartHandshake': return <HeartHandshake className="w-4 h-4 text-pink-400" />;
      case 'Wrench': return <Wrench className="w-4 h-4 text-orange-400" />;
      case 'Megaphone': return <Megaphone className="w-4 h-4 text-yellow-400" />;
      case 'FileText': return <FileText className="w-4 h-4 text-slate-300" />;
      case 'BarChart3': return <BarChart3 className="w-4 h-4 text-indigo-400" />;
      case 'Phone': return <Phone className="w-4 h-4 text-blue-400" />;
      case 'Mail': return <Mail className="w-4 h-4 text-indigo-400" />;
      case 'FileCheck': return <FileCheck className="w-4 h-4 text-[#22ec72]" />;
      case 'Share2': return <Share2 className="w-4 h-4 text-purple-400" />;
      case 'Sparkles': return <Sparkles className="w-4 h-4 text-[#22ec72]" />;
      default: return <Bot className="w-4 h-4 text-[#22ec72]" />;
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#22ec72] text-black px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Design 1 status header: how many assistants are working, how many
          are paused, and a View Details button that jumps to the selected
          assistant's settings below. */}
      <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#22ec72]" />
            <span>AI Team</span>
          </h2>
          <p className="text-sm font-bold text-[#22ec72] mt-1">
            {activeCount} Active · {pausedCount} Paused
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            AI assistants for {activePreset?.name ?? 'your industry'} — tap one to see its settings.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              haptic.light();
              detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="min-h-[48px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer border border-zinc-700"
          >
            <span>View Details</span>
            <ChevronRight className="w-4 h-4 text-[#22ec72]" />
          </button>
          <button
            type="button"
            onClick={() => {
              haptic.light();
              handleCreateCustomSpecialist();
            }}
            className="min-h-[48px] px-3.5 py-2 rounded-xl bg-[#22ec72] hover:bg-[#22ec72] text-black font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-[#22ec72]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Specialist</span>
          </button>
        </div>
      </div>

      {/* Approval banner — only when something is actually waiting. */}
      {pendingApprovals > 0 && onReviewApprovals && (
        <button
          type="button"
          onClick={() => {
            haptic.light();
            onReviewApprovals();
          }}
          className="min-h-[48px] w-full p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center gap-3 text-left hover:border-amber-500/60 transition cursor-pointer"
        >
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-amber-200">
              {pendingApprovals} Action{pendingApprovals === 1 ? '' : 's'} Require Approval
            </span>
            <span className="block text-xs text-amber-300/80">Review Now</span>
          </span>
          <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
        </button>
      )}

      {/* Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Employees Roster */}
        <div className="lg:col-span-5 space-y-2 max-h-[660px] overflow-y-auto pr-1">
          {industryEmployees.map((emp) => {
            const isSelected = emp.id === selectedEmployeeId;
            const empActive = activeEmployees[emp.id] !== false;

            return (
              <div
                key={emp.id}
                onClick={() => {
                  handleSelectEmployee(emp.id);
                }}
                className={`p-3 rounded-2xl border transition cursor-pointer text-left flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-zinc-900 border-[#22ec72]/60 shadow-lg shadow-[#22ec72]/10'
                    : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    {getEmployeeIcon(emp.avatarIcon)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">{emp.name}</h4>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                        empActive
                          ? 'bg-[#22ec72]/10 text-[#22ec72] border-[#22ec72]/30'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>
                        {empActive ? 'Active' : 'Paused'}
                      </span>
                      {emp.isCustom && (
                        <span className="text-xs px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono shrink-0">
                          CUSTOM
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate">{emp.tagline}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {(() => {
                    const talkTarget = TALK_PERSONAS[emp.id];
                    return talkTarget ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          haptic.light();
                          setTalkPersona(talkTarget);
                        }}
                        title={`Talk to ${emp.name} by voice`}
                        className="min-h-[48px] p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-[#22ec72] hover:bg-zinc-700 cursor-pointer"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    ) : null;
                  })()}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleEmployee(emp.id);
                    }}
                    title={empActive ? 'Pause employee' : 'Activate employee'}
                    className="min-h-[48px] cursor-pointer"
                  >
                    {empActive ? (
                      <ToggleRight className="w-6 h-6 text-[#22ec72]" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-zinc-600" />
                    )}
                  </button>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#22ec72]' : 'text-zinc-600'}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Chat vs Customization View */}
        <div ref={detailRef} className="lg:col-span-7 flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl h-[660px]">
          
          {/* Header Bar with View Switcher */}
          <div className="p-3.5 sm:p-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                {getEmployeeIcon(selectedEmployee.avatarIcon)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate">
                  <h3 className="text-sm font-bold text-white truncate">{selectedEmployee.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono shrink-0 ${
                    isActive 
                      ? 'bg-[#22ec72]/10 text-[#22ec72] border border-[#22ec72]/30' 
                      : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 truncate">{selectedEmployee.roleTitle} • {selectedEmployee.department}</p>
              </div>
            </div>

          </div>

          {/* MODE 2: CUSTOMIZE JOB & RULES */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
                  <span className="font-bold">{formError}</span>
                </div>
              )}
              {/* Identity & Role Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Employee Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#22ec72]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Role Title
                  </label>
                  <input
                    type="text"
                    value={editRoleTitle}
                    onChange={(e) => setEditRoleTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#22ec72]"
                  />
                </div>
              </div>

              {/* Core Job Scope */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Core Job Scope & Responsibilities
                </label>
                <textarea
                  rows={3}
                  value={editCoreJob}
                  onChange={(e) => setEditCoreJob(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#22ec72] leading-relaxed font-sans"
                  placeholder="Define the primary jobs and responsibilities this AI specialist owns..."
                />
              </div>

              {/* Agent Behavior & Decision Protocol */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Agent Behavior & Decision Protocol
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditBehaviorProtocol(DEFAULT_BEHAVIOR_PROTOCOL)}
                    className="min-h-[48px] text-xs text-[#22ec72] hover:text-[#22ec72] font-semibold cursor-pointer"
                  >
                    Restore standard protocol
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={editBehaviorProtocol}
                  onChange={(e) => setEditBehaviorProtocol(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#22ec72] leading-relaxed font-sans"
                  placeholder="How this agent reasons through jobs, makes decisions, handles uncertainty, works with other agents, and verifies its work..."
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-zinc-500">
                    Used when this agent works. Leave the standard text in place unless you want this agent to behave differently.
                  </p>
                  <span className={`text-xs font-mono shrink-0 ml-2 ${editBehaviorProtocol.length > MAX_BEHAVIOR_PROTOCOL_LENGTH ? 'text-red-400' : 'text-zinc-500'}`}>
                    {editBehaviorProtocol.length.toLocaleString()} / {MAX_BEHAVIOR_PROTOCOL_LENGTH.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Autonomy Level */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Autonomy Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditAutonomy('autonomous')}
                    className={`min-h-[48px] p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      editAutonomy === 'autonomous'
                        ? 'bg-[#22ec72]/10 border-[#22ec72] text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between mb-0.5">
                      <span>Auto</span>
                      <Zap className="w-3 h-3 text-[#22ec72]" />
                    </div>
                    <div className="text-xs text-zinc-500">Autonomous</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditAutonomy('supervised')}
                    className={`min-h-[48px] p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      editAutonomy === 'supervised'
                        ? 'bg-amber-500/10 border-amber-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between mb-0.5">
                      <span>Supervised</span>
                      <ShieldCheck className="w-3 h-3 text-amber-400" />
                    </div>
                    <div className="text-xs text-zinc-500">Requires 1-Tap</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditAutonomy('manual')}
                    className={`min-h-[48px] p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      editAutonomy === 'manual'
                        ? 'bg-cyan-500/10 border-cyan-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between mb-0.5">
                      <span>Manual</span>
                      <Hand className="w-3 h-3 text-cyan-400" />
                    </div>
                    <div className="text-xs text-zinc-500">Operator Only</div>
                  </button>
                </div>
              </div>

              {/* Tone of Voice — RCOS brand configuration per assistant */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Tone of Voice
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    { id: 'professional', label: 'Professional', hint: 'Polished & precise' },
                    { id: 'friendly', label: 'Friendly', hint: 'Warm & reassuring' },
                    { id: 'direct', label: 'Direct', hint: 'Short & persuasive' },
                    { id: 'technical', label: 'Technical', hint: 'Step-by-step' },
                  ] as const).map((toneOpt) => (
                    <button
                      key={toneOpt.id}
                      type="button"
                      onClick={() => {
                        haptic.light();
                        setEditTone(toneOpt.id);
                      }}
                      className={`min-h-[48px] p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        editTone === toneOpt.id
                          ? 'bg-[#22ec72]/10 border-[#22ec72] text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-xs">{toneOpt.label}</div>
                      <div className="text-xs text-zinc-500">{toneOpt.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Approval Threshold Slider */}
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300">Max Auto-Approval Limit</span>
                  <span className="font-mono text-[#22ec72] font-bold">${editApprovalAmount.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min={200}
                  max={5000}
                  step={100}
                  value={editApprovalAmount}
                  onChange={(e) => setEditApprovalAmount(Number(e.target.value))}
                  className="w-full accent-[#22ec72] cursor-pointer"
                />
              </div>

              {/* Custom Operational Rules */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Custom Operational Rules & Instructions
                  </label>
                  <span className="text-xs text-zinc-500">{editRules.length} rules</span>
                </div>

                <div className="space-y-1.5">
                  {editRules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-2"
                    >
                      <span className="text-zinc-300 flex-1 leading-tight">{rule}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(idx)}
                        className="min-h-[48px] text-zinc-500 hover:text-red-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newRuleText}
                    onChange={(e) => setNewRuleText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRule())}
                    placeholder="Add operational rule..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#22ec72]"
                  />
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="min-h-[48px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={handleResetEmployee}
                  className="min-h-[48px] text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Factory Defaults</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveCustomization}
                  disabled={isSaving}
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-[#22ec72] hover:bg-[#22ec72] text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-[#22ec72]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving…' : 'Save Job Configuration'}</span>
                </button>
              </div>
            </div>
        </div>
      </div>

      {/* Push-to-talk voice conversation with the selected agent */}
      {talkPersona && (() => {
        const talkEmployee = industryEmployees.find((e) => TALK_PERSONAS[e.id] === talkPersona);
        return (
          <AgentTalkConsole
            persona={talkPersona}
            agentName={talkEmployee?.name || 'AI Agent'}
            agentRole={talkEmployee?.roleTitle || ''}
            businessId={business.id}
            onClose={() => setTalkPersona(null)}
          />
        );
      })()}
    </div>
  );
};
