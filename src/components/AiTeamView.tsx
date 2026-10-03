import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  MessageSquare, 
  Send, 
  Loader2, 
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
  Mail, 
  FileCheck, 
  Share2, 
  Sparkles,
  Bot,
  User,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Hand,
  Settings2,
  DollarSign
} from 'lucide-react';
import { BusinessAccount, ChatMessage } from '../types';
import { CustomAIEmployee, employeeCustomizationService } from '../services/employeeCustomizationService';
import { INDUSTRY_PRESETS } from '../data/presets';
import { haptic } from '../utils/haptics';

interface AiTeamViewProps {
  business: BusinessAccount;
  onUpdateBusiness: (updated: BusinessAccount) => void;
}

export const AiTeamView: React.FC<AiTeamViewProps> = ({
  business,
  onUpdateBusiness
}) => {
  const [employees, setEmployees] = useState<CustomAIEmployee[]>(() => 
    employeeCustomizationService.getEmployees()
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('executive_assistant');
  const [rightViewMode, setRightViewMode] = useState<'chat' | 'customize'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Identify the business's detected industry preset
  const activePreset = INDUSTRY_PRESETS.find(p => 
    p.id === business.industry || 
    p.name.toLowerCase() === business.industry.toLowerCase() ||
    business.industry.toLowerCase().includes(p.id)
  ) || INDUSTRY_PRESETS[5]; // Default HVAC fallback

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

  // Customization Form Local State
  const selectedEmployee = industryEmployees.find(e => e.id === selectedEmployeeId) || industryEmployees[0] || employees[0];
  const isActive = business.activeEmployees[selectedEmployee.id] !== false;

  const [editName, setEditName] = useState(selectedEmployee.name);
  const [editRoleTitle, setEditRoleTitle] = useState(selectedEmployee.roleTitle);
  const [editDepartment, setEditDepartment] = useState(selectedEmployee.department);
  const [editCoreJob, setEditCoreJob] = useState(selectedEmployee.customJobScope || selectedEmployee.coreJob);
  const [editAutonomy, setEditAutonomy] = useState<'autonomous' | 'supervised' | 'manual'>(
    selectedEmployee.autonomyLevel || 'autonomous'
  );
  const [editApprovalAmount, setEditApprovalAmount] = useState<number>(
    selectedEmployee.maxApprovalAmount || 1500
  );
  const [editEscalatesTo, setEditEscalatesTo] = useState(selectedEmployee.escalatesTo || 'Business Owner');
  const [editRules, setEditRules] = useState<string[]>(
    selectedEmployee.customRules || ['Always verify client identity and safety protocol.']
  );
  const [newRuleText, setNewRuleText] = useState('');

  // Sync edit form whenever selected employee changes
  useEffect(() => {
    if (selectedEmployee) {
      setEditName(selectedEmployee.name);
      setEditRoleTitle(selectedEmployee.roleTitle);
      setEditDepartment(selectedEmployee.department);
      setEditCoreJob(selectedEmployee.customJobScope || selectedEmployee.coreJob);
      setEditAutonomy(selectedEmployee.autonomyLevel || 'autonomous');
      setEditApprovalAmount(selectedEmployee.maxApprovalAmount || 1500);
      setEditEscalatesTo(selectedEmployee.escalatesTo || 'Business Owner');
      setEditRules(selectedEmployee.customRules || ['Always verify client identity and safety protocol.']);
    }
  }, [selectedEmployeeId]);

  // Fetch chat history for selected employee
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/business/${business.id}/chat?employeeId=${selectedEmployeeId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Failed to load chat:', err);
      }
    };
    fetchChat();
  }, [business.id, selectedEmployeeId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Send chat message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      businessId: business.id,
      employeeId: selectedEmployeeId,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/business/${business.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          message: userText
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, data.message]);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle active employee
  const handleToggleEmployee = async (empId: string) => {
    await haptic.selection();
    const currentStatus = business.activeEmployees[empId] !== false;
    const updatedEmployees = { ...business.activeEmployees, [empId]: !currentStatus };
    const updatedBiz = { ...business, activeEmployees: updatedEmployees };

    try {
      const res = await fetch(`/api/business/${business.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeEmployees: updatedEmployees })
      });
      if (res.ok) {
        const saved = await res.json();
        onUpdateBusiness(saved);
        showToast(`${industryEmployees.find(e => e.id === empId)?.name || 'Employee'} status updated.`);
      }
    } catch (err) {
      console.error('Failed to update employee toggle', err);
    }
  };

  // Save employee customization
  const handleSaveCustomization = async () => {
    await haptic.success();
    const updated = employeeCustomizationService.updateEmployee(selectedEmployee.id, {
      name: editName,
      roleTitle: editRoleTitle,
      department: editDepartment,
      customJobScope: editCoreJob,
      coreJob: editCoreJob,
      autonomyLevel: editAutonomy,
      maxApprovalAmount: Number(editApprovalAmount),
      escalatesTo: editEscalatesTo,
      customRules: editRules
    });

    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
    showToast(`Saved customizations for ${updated.name}!`);
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
      const reset = employeeCustomizationService.resetEmployee(selectedEmployee.id);
      setEmployees(prev => prev.map(e => e.id === reset.id ? reset : e));
      setEditName(reset.name);
      setEditRoleTitle(reset.roleTitle);
      setEditDepartment(reset.department);
      setEditCoreJob(reset.coreJob);
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
      systemPromptRole: 'You are a specialized RCOS AI Operations Consultant. You follow dedicated user guidelines and execute tasks accurately.'
    });

    setEmployees(prev => [...prev, newSpec]);
    setSelectedEmployeeId(newSpec.id);
    setRightViewMode('customize');
    showToast('New Custom AI Specialist created! Tune their job scope below.');
  };

  const getEmployeeIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldAlert': return <ShieldAlert className="w-4 h-4 text-emerald-400" />;
      case 'Cpu': return <Cpu className="w-4 h-4 text-cyan-400" />;
      case 'Kanban': return <Kanban className="w-4 h-4 text-purple-400" />;
      case 'CircleDollarSign': return <CircleDollarSign className="w-4 h-4 text-amber-400" />;
      case 'Users': return <Users className="w-4 h-4 text-blue-400" />;
      case 'CalendarClock': return <CalendarClock className="w-4 h-4 text-emerald-400" />;
      case 'TrendingUp': return <TrendingUp className="w-4 h-4 text-lime-400" />;
      case 'HeartHandshake': return <HeartHandshake className="w-4 h-4 text-pink-400" />;
      case 'Wrench': return <Wrench className="w-4 h-4 text-orange-400" />;
      case 'Megaphone': return <Megaphone className="w-4 h-4 text-yellow-400" />;
      case 'FileText': return <FileText className="w-4 h-4 text-slate-300" />;
      case 'BarChart3': return <BarChart3 className="w-4 h-4 text-indigo-400" />;
      case 'Phone': return <Phone className="w-4 h-4 text-blue-400" />;
      case 'Mail': return <Mail className="w-4 h-4 text-indigo-400" />;
      case 'FileCheck': return <FileCheck className="w-4 h-4 text-emerald-400" />;
      case 'Share2': return <Share2 className="w-4 h-4 text-purple-400" />;
      case 'Sparkles': return <Sparkles className="w-4 h-4 text-lime-400" />;
      default: return <Bot className="w-4 h-4 text-lime-400" />;
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-lime-500 text-black px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-lime-400" />
              <span>AI Assistants for {activePreset.name}</span>
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 font-bold">
              {industryEmployees.filter(e => business.activeEmployees[e.id] !== false).length} Active
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Enable or adjust the AI assistants specifically preset for your {activePreset.name} operations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            haptic.light();
            handleCreateCustomSpecialist();
          }}
          className="px-3.5 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-lime-500/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Specialist</span>
        </button>
      </div>

      {/* Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Employees Roster */}
        <div className="lg:col-span-5 space-y-2 max-h-[660px] overflow-y-auto pr-1">
          {industryEmployees.map((emp) => {
            const isSelected = emp.id === selectedEmployeeId;
            const empActive = business.activeEmployees[emp.id] !== false;

            return (
              <div
                key={emp.id}
                onClick={() => {
                  haptic.light();
                  setSelectedEmployeeId(emp.id);
                }}
                className={`p-3 rounded-2xl border transition cursor-pointer text-left flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-zinc-900 border-lime-500/60 shadow-lg shadow-lime-500/10'
                    : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    {getEmployeeIcon(emp.avatarIcon)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">{emp.name}</h4>
                      {emp.isCustom && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                          CUSTOM
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">{emp.roleTitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleEmployee(emp.id);
                    }}
                    title={empActive ? 'Pause employee' : 'Activate employee'}
                    className="cursor-pointer"
                  >
                    {empActive ? (
                      <ToggleRight className="w-6 h-6 text-lime-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-zinc-600" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Chat vs Customization View */}
        <div className="lg:col-span-7 flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl h-[660px]">
          
          {/* Header Bar with View Switcher */}
          <div className="p-3.5 sm:p-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                {getEmployeeIcon(selectedEmployee.avatarIcon)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate">
                  <h3 className="text-sm font-bold text-white truncate">{selectedEmployee.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                    isActive 
                      ? 'bg-lime-500/10 text-lime-400 border border-lime-500/30' 
                      : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 truncate">{selectedEmployee.roleTitle} • {selectedEmployee.department}</p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-black/60 p-0.5 rounded-xl border border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  haptic.light();
                  setRightViewMode('chat');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  rightViewMode === 'chat'
                    ? 'bg-zinc-800 text-lime-400 border border-lime-500/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Direct Chat</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic.light();
                  setRightViewMode('customize');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  rightViewMode === 'customize'
                    ? 'bg-zinc-800 text-lime-400 border border-lime-500/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Customize Job</span>
              </button>
            </div>
          </div>

          {/* MODE 1: CHAT */}
          {rightViewMode === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Mission Ribbon */}
              <div className="px-4 py-2 bg-zinc-900/30 border-b border-zinc-900 text-xs text-zinc-300 flex items-center justify-between shrink-0">
                <span className="truncate">Core Job: <em>{selectedEmployee.customJobScope || selectedEmployee.coreJob}</em></span>
                <span className="text-[10px] text-lime-400 font-mono shrink-0 ml-2">Autonomy: {selectedEmployee.autonomyLevel || 'autonomous'}</span>
              </div>

              {/* Scrollable Conversation */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
                    <MessageSquare className="w-8 h-8 text-zinc-600" />
                    <div className="text-xs font-medium text-zinc-300">
                      Direct line to {selectedEmployee.name}
                    </div>
                    <p className="text-[11px] max-w-xs text-zinc-500">
                      Ask for strategic insights, draft quotes, or assign custom operational tasks.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'model' && (
                        <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                          {getEmployeeIcon(selectedEmployee.avatarIcon)}
                        </div>
                      )}

                      <div className={`max-w-[80%] rounded-2xl p-3 text-xs md:text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-lime-500 text-black font-semibold'
                          : 'bg-zinc-900 text-zinc-200 border border-zinc-800'
                      }`}>
                        {msg.content}
                        <div className={`text-[9px] mt-1 text-right font-mono ${
                          msg.role === 'user' ? 'text-black/60' : 'text-zinc-500'
                        }`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5 text-white text-[10px] font-bold">
                          YOU
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-zinc-800 bg-zinc-900/50 shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSendMessage())}
                    placeholder={`Instruct ${selectedEmployee.name}...`}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="p-2 sm:px-4 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: CUSTOMIZE JOB & RULES */}
          {rightViewMode === 'customize' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* Identity & Role Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Employee Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Role Title
                  </label>
                  <input
                    type="text"
                    value={editRoleTitle}
                    onChange={(e) => setEditRoleTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  />
                </div>
              </div>

              {/* Core Job Scope */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Core Job Scope & Responsibilities
                </label>
                <textarea
                  rows={3}
                  value={editCoreJob}
                  onChange={(e) => setEditCoreJob(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-lime-500 leading-relaxed font-sans"
                  placeholder="Define the primary tasks and responsibilities this AI specialist owns..."
                />
              </div>

              {/* Autonomy Level */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                  Autonomy Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditAutonomy('autonomous')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      editAutonomy === 'autonomous'
                        ? 'bg-lime-500/10 border-lime-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between mb-0.5">
                      <span>Auto</span>
                      <Zap className="w-3 h-3 text-lime-400" />
                    </div>
                    <div className="text-[10px] text-zinc-500">Autonomous</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditAutonomy('supervised')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      editAutonomy === 'supervised'
                        ? 'bg-amber-500/10 border-amber-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between mb-0.5">
                      <span>Supervised</span>
                      <ShieldCheck className="w-3 h-3 text-amber-400" />
                    </div>
                    <div className="text-[10px] text-zinc-500">Requires 1-Tap</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditAutonomy('manual')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      editAutonomy === 'manual'
                        ? 'bg-cyan-500/10 border-cyan-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between mb-0.5">
                      <span>Manual</span>
                      <Hand className="w-3 h-3 text-cyan-400" />
                    </div>
                    <div className="text-[10px] text-zinc-500">Operator Only</div>
                  </button>
                </div>
              </div>

              {/* Approval Threshold Slider */}
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-300">Max Auto-Approval Limit</span>
                  <span className="font-mono text-lime-400 font-bold">${editApprovalAmount.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min={200}
                  max={5000}
                  step={100}
                  value={editApprovalAmount}
                  onChange={(e) => setEditApprovalAmount(Number(e.target.value))}
                  className="w-full accent-lime-500 cursor-pointer"
                />
              </div>

              {/* Custom Operational Rules */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                    Custom Operational Rules & Instructions
                  </label>
                  <span className="text-[10px] text-zinc-500">{editRules.length} rules</span>
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
                        className="text-zinc-500 hover:text-red-400 p-1 cursor-pointer"
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
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs"
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
                  className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Factory Defaults</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveCustomization}
                  className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-lime-500/20 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Job Configuration</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
