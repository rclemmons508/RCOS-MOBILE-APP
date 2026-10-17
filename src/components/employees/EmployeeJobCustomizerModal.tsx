import React, { useState } from 'react';
import { 
  Bot, 
  X, 
  Save, 
  RotateCcw, 
  ShieldAlert, 
  Cpu, 
  Kanban, 
  CircleDollarSign, 
  Users, 
  CalendarClock, 
  TrendingUp, 
  HeartHandshake, 
  Wrench, 
  Megaphone, 
  FileText, 
  BarChart3, 
  Phone, 
  Mail, 
  FileCheck, 
  Share2, 
  Sparkles,
  Zap,
  ShieldCheck,
  Hand,
  CheckCircle2,
  Plus,
  Trash2,
  Sliders,
  DollarSign
} from 'lucide-react';
import { CustomAIEmployee, employeeCustomizationService } from '../../services/employeeCustomizationService';
import { DEFAULT_BEHAVIOR_PROTOCOL, MAX_BEHAVIOR_PROTOCOL_LENGTH, resolveBehaviorProtocol } from '../../utils/agentBehavior';

interface EmployeeJobCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: CustomAIEmployee | null;
  onSaved: (updated: CustomAIEmployee) => void;
}

export const EmployeeJobCustomizerModal: React.FC<EmployeeJobCustomizerModalProps> = ({
  isOpen,
  onClose,
  employee,
  onSaved
}) => {
  if (!isOpen || !employee) return null;

  const [name, setName] = useState(employee.name);
  const [roleTitle, setRoleTitle] = useState(employee.roleTitle);
  const [department, setDepartment] = useState(employee.department);
  const [coreJob, setCoreJob] = useState(employee.customJobScope || employee.coreJob);
  const [behaviorProtocol, setBehaviorProtocol] = useState(
    resolveBehaviorProtocol(employee.behaviorProtocol)
  );
  const [tagline, setTagline] = useState(employee.tagline);
  const [autonomyLevel, setAutonomyLevel] = useState<'autonomous' | 'supervised' | 'manual'>(
    employee.autonomyLevel || 'autonomous'
  );
  const [maxApprovalAmount, setMaxApprovalAmount] = useState<number>(
    employee.maxApprovalAmount || 1500
  );
  const [escalatesTo, setEscalatesTo] = useState(employee.escalatesTo || 'Business Owner');
  const [rules, setRules] = useState<string[]>(
    employee.customRules && employee.customRules.length > 0 
      ? [...employee.customRules] 
      : ['Always uphold company safety protocols', 'Prompt operator for approval on scope variations']
  );
  const [newRuleInput, setNewRuleInput] = useState('');
  const [customPromptNotes, setCustomPromptNotes] = useState(employee.customPromptNotes || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Last saved values — the baseline the unsaved-changes check compares
  // against. Updated on save and on reset so a fresh save never warns.
  const [savedBaseline, setSavedBaseline] = useState({
    name: employee.name,
    roleTitle: employee.roleTitle,
    department: employee.department,
    coreJob: employee.customJobScope || employee.coreJob,
    behaviorProtocol: resolveBehaviorProtocol(employee.behaviorProtocol),
    tagline: employee.tagline,
    autonomyLevel: employee.autonomyLevel || 'autonomous',
    maxApprovalAmount: employee.maxApprovalAmount || 1500,
    escalatesTo: employee.escalatesTo || 'Business Owner',
    rules: employee.customRules && employee.customRules.length > 0
      ? [...employee.customRules]
      : ['Always uphold company safety protocols', 'Prompt operator for approval on scope variations'],
    customPromptNotes: employee.customPromptNotes || '',
  });

  const isDirty =
    name !== savedBaseline.name ||
    roleTitle !== savedBaseline.roleTitle ||
    department !== savedBaseline.department ||
    coreJob !== savedBaseline.coreJob ||
    behaviorProtocol !== savedBaseline.behaviorProtocol ||
    tagline !== savedBaseline.tagline ||
    autonomyLevel !== savedBaseline.autonomyLevel ||
    maxApprovalAmount !== savedBaseline.maxApprovalAmount ||
    escalatesTo !== savedBaseline.escalatesTo ||
    JSON.stringify(rules) !== JSON.stringify(savedBaseline.rules) ||
    customPromptNotes !== savedBaseline.customPromptNotes;

  // Closing with unsaved edits asks first (same confirm() pattern the
  // reset action already uses) instead of silently dropping them.
  const handleClose = () => {
    if (isDirty && !confirm(`You have unsaved changes for ${employee.name}. Close without saving?`)) return;
    onClose();
  };

  const handleAddRule = () => {
    if (!newRuleInput.trim()) return;
    setRules([...rules, newRuleInput.trim()]);
    setNewRuleInput('');
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (isSaving) return;
    if (behaviorProtocol.length > MAX_BEHAVIOR_PROTOCOL_LENGTH) {
      setSaveError(`Behavior protocol is too long — keep it under ${MAX_BEHAVIOR_PROTOCOL_LENGTH.toLocaleString()} characters.`);
      return;
    }
    // Blank, or untouched default text, stores as "no custom protocol" so
    // the standard protocol keeps applying without persisting a copy of it.
    const trimmedProtocol = behaviorProtocol.trim();
    const protocolToSave = !trimmedProtocol || trimmedProtocol === DEFAULT_BEHAVIOR_PROTOCOL
      ? undefined
      : trimmedProtocol;
    setSaveError(null);
    setIsSaving(true);
    let updated: CustomAIEmployee;
    try {
      updated = employeeCustomizationService.updateEmployee(employee.id, {
        name,
        roleTitle,
        department,
        customJobScope: coreJob,
        coreJob,
        behaviorProtocol: protocolToSave,
        tagline,
        autonomyLevel,
        maxApprovalAmount: Number(maxApprovalAmount),
        escalatesTo,
        customRules: rules,
        customPromptNotes
      });
    } catch (err) {
      console.error('Failed to save employee customization', err);
      setSaveError('Could not save — please try again.');
      setIsSaving(false);
      return;
    }

    setSavedBaseline({
      name,
      roleTitle,
      department,
      coreJob,
      behaviorProtocol: resolveBehaviorProtocol(updated.behaviorProtocol),
      tagline,
      autonomyLevel,
      maxApprovalAmount: Number(maxApprovalAmount),
      escalatesTo,
      rules: [...rules],
      customPromptNotes,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsSaving(false);
      onSaved(updated);
      onClose();
    }, 600);
  };

  const handleResetToDefault = () => {
    if (confirm(`Reset ${employee.name} back to default operational specifications?`)) {
      const reset = employeeCustomizationService.resetEmployee(employee.id);
      setName(reset.name);
      setRoleTitle(reset.roleTitle);
      setDepartment(reset.department);
      setCoreJob(reset.coreJob);
      setBehaviorProtocol(resolveBehaviorProtocol(reset.behaviorProtocol));
      setTagline(reset.tagline);
      setAutonomyLevel('autonomous');
      setMaxApprovalAmount(1500);
      setEscalatesTo(reset.escalatesTo);
      setRules([...(reset.customRules || [])]);
      setCustomPromptNotes('');
      setSavedBaseline({
        name: reset.name,
        roleTitle: reset.roleTitle,
        department: reset.department,
        coreJob: reset.coreJob,
        behaviorProtocol: resolveBehaviorProtocol(reset.behaviorProtocol),
        tagline: reset.tagline,
        autonomyLevel: 'autonomous',
        maxApprovalAmount: 1500,
        escalatesTo: reset.escalatesTo,
        rules: [...(reset.customRules || [])],
        customPromptNotes: '',
      });
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldAlert': return <ShieldAlert className="w-5 h-5 text-emerald-400" />;
      case 'Cpu': return <Cpu className="w-5 h-5 text-cyan-400" />;
      case 'Kanban': return <Kanban className="w-5 h-5 text-purple-400" />;
      case 'CircleDollarSign': return <CircleDollarSign className="w-5 h-5 text-amber-400" />;
      case 'Users': return <Users className="w-5 h-5 text-blue-400" />;
      case 'CalendarClock': return <CalendarClock className="w-5 h-5 text-emerald-400" />;
      case 'TrendingUp': return <TrendingUp className="w-5 h-5 text-lime-400" />;
      case 'HeartHandshake': return <HeartHandshake className="w-5 h-5 text-pink-400" />;
      case 'Wrench': return <Wrench className="w-5 h-5 text-orange-400" />;
      default: return <Bot className="w-5 h-5 text-lime-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[92vh] bg-zinc-950 border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-900 bg-zinc-900/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-lime-500/30 flex items-center justify-center shadow-lg">
              {getIcon(employee.avatarIcon)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Customize AI Employee: {employee.name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 font-mono">
                  {department}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Tune job responsibilities, operational boundaries, and escalation triggers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {saveError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <span className="font-bold">{saveError}</span>
            </div>
          )}
          {saveSuccess && (
            <div className="p-3 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-bold">AI Employee job profile updated successfully!</span>
            </div>
          )}

          {/* Identity & Role Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                Employee Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                placeholder="e.g. Morgan Vance"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                Role Title
              </label>
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                placeholder="e.g. Lead Operations Dispatcher"
              />
            </div>
          </div>

          {/* Department & Tagline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
              >
                <option value="Executive">Executive</option>
                <option value="Operations">Operations & Dispatch</option>
                <option value="Field Ops">Field Operations</option>
                <option value="Sales">Sales & Estimating</option>
                <option value="Finance">Finance & Billing</option>
                <option value="Customer Service">Customer Care</option>
                <option value="Management">Project Management</option>
                <option value="Technology">Technology & Automation</option>
                <option value="Human Resources">Human Resources</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                Escalates Unresolved Issues To
              </label>
              <input
                type="text"
                value={escalatesTo}
                onChange={(e) => setEscalatesTo(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                placeholder="e.g. Business Owner or Executive Assistant"
              />
            </div>
          </div>

          {/* Core Job Scope & Responsibilities */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                Core Job Scope & Responsibilities
              </label>
              <span className="text-[10px] text-zinc-500 font-mono">Defines primary execution tasks</span>
            </div>
            <textarea
              rows={3}
              value={coreJob}
              onChange={(e) => setCoreJob(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-lime-500 leading-relaxed font-sans"
              placeholder="Describe the primary responsibilities and tasks this AI employee handles..."
            />
          </div>

          {/* Agent Behavior & Decision Protocol */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                Agent Behavior & Decision Protocol
              </label>
              <button
                type="button"
                onClick={() => setBehaviorProtocol(DEFAULT_BEHAVIOR_PROTOCOL)}
                className="text-[10px] text-lime-400 hover:text-lime-300 font-semibold cursor-pointer"
              >
                Restore standard protocol
              </button>
            </div>
            <textarea
              rows={6}
              value={behaviorProtocol}
              onChange={(e) => setBehaviorProtocol(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-lime-500 leading-relaxed font-sans"
              placeholder="How this agent reasons through tasks, makes decisions, handles uncertainty, works with other agents, and verifies its work..."
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-zinc-500">
                Used when this agent works. Leave the standard text in place unless you want this agent to behave differently.
              </p>
              <span className={`text-[10px] font-mono shrink-0 ml-2 ${behaviorProtocol.length > MAX_BEHAVIOR_PROTOCOL_LENGTH ? 'text-red-400' : 'text-zinc-500'}`}>
                {behaviorProtocol.length.toLocaleString()} / {MAX_BEHAVIOR_PROTOCOL_LENGTH.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Autonomy Level Selection */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              Autonomy Level & Approval Boundary
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setAutonomyLevel('autonomous')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  autonomyLevel === 'autonomous'
                    ? 'bg-lime-500/10 border-lime-500 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">Autonomous</span>
                  <Zap className="w-3.5 h-3.5 text-lime-400" />
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Dispatches, quotes, and resolves tasks without waiting for confirmation.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAutonomyLevel('supervised')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  autonomyLevel === 'supervised'
                    ? 'bg-amber-500/10 border-amber-500 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">Supervised</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Drafts recommendations and alerts operator for 1-tap confirmation.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAutonomyLevel('manual')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  autonomyLevel === 'manual'
                    ? 'bg-cyan-500/10 border-cyan-500 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">Manual Only</span>
                  <Hand className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Only responds when directly summoned or assigned by an operator.
                </p>
              </button>
            </div>
          </div>

          {/* Dollar Approval Limit */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-lime-400" />
                <span>Max Autonomous Approval Threshold</span>
              </span>
              <span className="font-mono text-lime-400 font-bold text-sm">
                ${maxApprovalAmount.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={250}
              max={10000}
              step={250}
              value={maxApprovalAmount}
              onChange={(e) => setMaxApprovalAmount(Number(e.target.value))}
              className="w-full accent-lime-500 cursor-pointer"
            />
            <p className="text-[10px] text-zinc-500">
              Quotes, material orders, or invoice adjustments above this threshold will automatically pause and await your review.
            </p>
          </div>

          {/* Custom Operational Guidelines & Behavioral Rules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                Custom Operational Rules & Instructions
              </label>
              <span className="text-[10px] text-zinc-500">{rules.length} active rules</span>
            </div>

            <div className="space-y-1.5">
              {rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between gap-2"
                >
                  <span className="text-zinc-300 flex-1 leading-snug">{rule}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(idx)}
                    className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Rule Input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newRuleInput}
                onChange={(e) => setNewRuleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRule())}
                placeholder="Add rule (e.g. Always request photo of equipment nameplate)..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
              />
              <button
                type="button"
                onClick={handleAddRule}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-900/40 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-lime-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving…' : 'Save Job Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
