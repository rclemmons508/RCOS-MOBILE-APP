import React, { useState } from 'react';
import { AutomationTask, NotificationPreferences, User } from '../../types';
import { BiometricSettingsCard } from '../biometrics/BiometricSettingsCard';
import { userPreferencesService } from '../../services/userPreferencesService';
import { employeeCustomizationService, CustomAIEmployee } from '../../services/employeeCustomizationService';
import { EmployeeJobCustomizerModal } from '../employees/EmployeeJobCustomizerModal';
import { haptic } from '../../utils/haptics';
import { 
  Settings2, 
  Plus, 
  Zap, 
  ZapOff, 
  CheckCircle2, 
  Bot, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Bell, 
  Moon, 
  Sparkles, 
  Activity, 
  Sliders, 
  ShieldAlert,
  Check,
  User as UserIcon,
  LogOut,
  Building2,
  Phone,
  Clock,
  Briefcase,
  Users,
  HardDrive,
  RefreshCw,
  Trash2,
  Edit3,
  Layers,
  ShieldCheck,
  SmartphoneNfc
} from 'lucide-react';

interface SettingsTabProps {
  currentUser?: User | null;
  onLogout?: () => void;
  automationTasks: AutomationTask[];
  onToggleAutomation: (taskId: string, isAutomated: boolean) => void;
  onAddCustomTask: (task: AutomationTask) => void;
  aiAssistantEnabled: boolean;
  onToggleAiAssistant: () => void;
  industryProfile: string;
  onUpdateIndustry: (industry: string) => void;
  telemetryIntervalMs: number;
  onUpdateTelemetryInterval: (interval: number) => void;
  autoDispatchThreshold: 'all' | 'critical' | 'high' | 'manual';
  onUpdateAutoDispatchThreshold: (threshold: 'all' | 'critical' | 'high' | 'manual') => void;
  notifPreferences: NotificationPreferences;
  onUpdateNotifPreferences: (prefs: NotificationPreferences) => void;
  onTriggerTestPush: () => void;
  onOpenNotifPrefsModal: () => void;
  onReopenOnboarding?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  onLogout,
  automationTasks,
  onToggleAutomation,
  onAddCustomTask,
  aiAssistantEnabled,
  onToggleAiAssistant,
  industryProfile,
  onUpdateIndustry,
  telemetryIntervalMs,
  onUpdateTelemetryInterval,
  autoDispatchThreshold,
  onUpdateAutoDispatchThreshold,
  notifPreferences,
  onUpdateNotifPreferences,
  onTriggerTestPush,
  onOpenNotifPrefsModal,
  onReopenOnboarding,
}) => {
  // Navigation: 3 clean client-facing sections
  const [activeSection, setActiveSection] = useState<'user' | 'agents' | 'device'>('user');

  // User & Company Profile State (multi-company support)
  const [companyName, setCompanyName] = useState(currentUser?.organization || 'Apex Commercial Systems');
  const [companyPhone, setCompanyPhone] = useState('(555) 302-8491');
  const [dispatchEmail, setDispatchEmail] = useState(currentUser?.email || 'dispatch@company.com');
  const [is24x7Emergency, setIs24x7Emergency] = useState(true);

  // App Agents State
  const [autonomyMode, setAutonomyMode] = useState<'autonomous' | 'supervised'>('autonomous');
  const [agentTone, setAgentTone] = useState<'strategic' | 'customer' | 'technical'>('strategic');
  const [customEmployees, setCustomEmployees] = useState<CustomAIEmployee[]>(() =>
    employeeCustomizationService.getEmployees()
  );
  const [selectedEmployeeForCustomizer, setSelectedEmployeeForCustomizer] = useState<CustomAIEmployee | null>(null);

  // Custom Task Modal State
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Device & Display State
  const [themeMode, setThemeMode] = useState<'oled' | 'dark' | 'slate'>('oled');
  const [compactDensity, setCompactDensity] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    onAddCustomTask({
      id: `task-custom-${Date.now()}`,
      name: newTaskName,
      description: newTaskDescription || 'Automated client operations workflow step',
      isAutomated: true,
      isCustom: true,
    });
    setNewTaskName('');
    setNewTaskDescription('');
    setIsAddingTask(false);
    showToast('Custom automation rule activated!');
  };

  const ringerMode = notifPreferences.ringerMode || (
    !notifPreferences.soundEnabled && !notifPreferences.vibrationEnabled ? 'silent' :
    !notifPreferences.soundEnabled ? 'vibrate' : 'sound'
  );

  const handleClearCache = () => {
    // Clean temporary operational cache
    try {
      sessionStorage.clear();
      setCacheCleared(true);
      showToast('Temporary query cache cleared safely!');
      setTimeout(() => setCacheCleared(false), 3000);
    } catch {
      showToast('Cache cleared.');
    }
  };

  return (
    <div className="space-y-4 pb-8 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-lime-500 text-black px-4 py-2 rounded-full font-extrabold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400 shrink-0">
            <Settings2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate">App Settings & Controls</h2>
            <p className="text-xs text-zinc-400 truncate">Multi-Company, AI Agents & Device Configuration</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenNotifPrefsModal}
          className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Bell className="w-3.5 h-3.5 text-lime-400" />
          <span>Alerts</span>
        </button>
      </div>

      {/* 3-Section Segmented Navigation Bar */}
      <div className="grid grid-cols-3 p-1 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-xs font-bold shadow-md">
        <button
          type="button"
          onClick={() => setActiveSection('user')}
          className={`py-2 px-1 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 truncate ${
            activeSection === 'user'
              ? 'bg-zinc-800 text-lime-400 border border-lime-500/30 shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <UserIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">User & Org</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('agents')}
          className={`py-2 px-1 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 truncate ${
            activeSection === 'agents'
              ? 'bg-zinc-800 text-lime-400 border border-lime-500/30 shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Bot className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">AI Agents</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('device')}
          className={`py-2 px-1 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 truncate ${
            activeSection === 'device'
              ? 'bg-zinc-800 text-lime-400 border border-lime-500/30 shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Device</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: USER & COMPANY SETTINGS */}
      {/* ============================================================== */}
      {activeSection === 'user' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Current Operator Profile Card */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Logged In Operator
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 font-mono font-bold uppercase">
                Active Session
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                  alt="Operator"
                  className="w-12 h-12 rounded-2xl object-cover border border-lime-500/50 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {currentUser?.fullName || 'Lead Operator'}
                  </div>
                  <div className="text-xs text-lime-400 font-mono">
                    {currentUser?.role || 'Operations Lead'}
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono truncate">
                    {currentUser?.email || 'rcsolutions@gmail.com'}
                  </div>
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  title="Log Out of this account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              )}
            </div>
          </div>

          {/* Company Profile (Multi-Company Configuration) */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-lime-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Company / Organization Profile
                </h3>
              </div>
              {onReopenOnboarding && (
                <button
                  type="button"
                  onClick={() => {
                    haptic.light();
                    onReopenOnboarding();
                  }}
                  className="px-2.5 py-1 rounded-xl bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 border border-lime-500/30 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Re-detect Industry</span>
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-zinc-400 font-mono block mb-1">Company Business Name:</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Apex Mechanical Systems"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 font-mono block mb-1">Primary Industry Sector:</label>
                  <select
                    value={industryProfile}
                    onChange={(e) => {
                      onUpdateIndustry(e.target.value);
                      showToast(`Industry updated to ${e.target.value}`);
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Commercial HVAC">Commercial HVAC</option>
                    <option value="Industrial Electrical">Industrial Electrical</option>
                    <option value="Smart Automation">Smart Automation</option>
                    <option value="Facilities & Energy">Facilities & Energy</option>
                    <option value="Plumbing & Mechanical">Plumbing & Mechanical</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 font-mono block mb-1">Dispatch Hotline Phone:</label>
                  <input
                    type="text"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="(555) 302-8491"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-mono block mb-1">Work Order Routing Email:</label>
                <input
                  type="email"
                  value={dispatchEmail}
                  onChange={(e) => setDispatchEmail(e.target.value)}
                  placeholder="dispatch@company.com"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-white block">24/7 Emergency Dispatch Readiness</span>
                  <span className="text-[10px] text-zinc-400">Routes off-hours voice AI calls directly to emergency on-call technicians</span>
                </div>
                <input
                  type="checkbox"
                  checked={is24x7Emergency}
                  onChange={(e) => setIs24x7Emergency(e.target.checked)}
                  className="rounded bg-black border-zinc-700 text-lime-500 focus:ring-0 shrink-0"
                />
              </label>
            </div>
          </div>

          {/* Biometric Access & Device Keystore */}
          <BiometricSettingsCard currentUser={currentUser} />
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 2: APP AGENTS SETTINGS */}
      {/* ============================================================== */}
      {activeSection === 'agents' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Autonomy Mode Selector */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-lime-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Multi-Agent Autonomy Mode
                </h3>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Operations Policy</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAutonomyMode('autonomous');
                  showToast('Autonomy Mode: Full Autonomous active');
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  autonomyMode === 'autonomous'
                    ? 'bg-lime-500/10 border-lime-500 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">Autonomous</span>
                  <Zap className="w-3.5 h-3.5 text-lime-400" />
                </div>
                <p className="text-[10px] text-zinc-400">
                  Agents route calls, draft quotes, and assign technicians automatically within business thresholds.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAutonomyMode('supervised');
                  showToast('Autonomy Mode: Supervised Approval active');
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  autonomyMode === 'supervised'
                    ? 'bg-lime-500/10 border-lime-500 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">Supervised</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-[10px] text-zinc-400">
                  All job assignments, client invoices, and emergency dispatches require operator 1-tap approval.
                </p>
              </button>
            </div>
          </div>

          {/* Auto-Dispatch Threshold */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-lime-400" />
                <span>Job Auto-Dispatch Threshold</span>
              </span>
              <span className="text-[10px] text-lime-400 font-mono font-bold uppercase">
                Active: {autoDispatchThreshold}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => onUpdateAutoDispatchThreshold('all')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  autoDispatchThreshold === 'all'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div>All Work Orders</div>
                <div className="text-[10px] text-zinc-500">Auto-routes all incoming requests</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateAutoDispatchThreshold('critical')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  autoDispatchThreshold === 'critical'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div>Critical Emergency Only</div>
                <div className="text-[10px] text-zinc-500">Only dispatches priority outages</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateAutoDispatchThreshold('high')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  autoDispatchThreshold === 'high'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div>High Priority + Urgent</div>
                <div className="text-[10px] text-zinc-500">Priority and critical tiers</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateAutoDispatchThreshold('manual')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  autoDispatchThreshold === 'manual'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div>Manual Approval Only</div>
                <div className="text-[10px] text-zinc-500">Operators manually assign all</div>
              </button>
            </div>
          </div>

          {/* Agent Communication Persona */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-lime-400" />
              <span>Voice AI & Chat Agent Tone</span>
            </span>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setAgentTone('strategic')}
                className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                  agentTone === 'strategic'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="text-[11px]">Crisp & Strategic</div>
                <div className="text-[9px] text-zinc-500">Direct executive style</div>
              </button>

              <button
                type="button"
                onClick={() => setAgentTone('customer')}
                className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                  agentTone === 'customer'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="text-[11px]">Customer-Centric</div>
                <div className="text-[9px] text-zinc-500">Warm & reassuring</div>
              </button>

              <button
                type="button"
                onClick={() => setAgentTone('technical')}
                className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                  agentTone === 'technical'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="text-[11px]">Technical Diagnostic</div>
                <div className="text-[9px] text-zinc-500">Engineering codes</div>
              </button>
            </div>
          </div>

          {/* AI Employee Fleet & Job Customization */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-lime-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  AI Employee Fleet & Job Roles ({customEmployees.length})
                </h3>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">1-Tap Customizer</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Customize job responsibilities, operational boundaries, and escalation triggers for each AI specialist:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {customEmployees.slice(0, 8).map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmployeeForCustomizer(emp)}
                  className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-lime-500/40 transition cursor-pointer text-left flex items-center justify-between gap-2.5 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white group-hover:text-lime-300 transition-colors truncate">
                      {emp.name}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {emp.roleTitle}
                    </div>
                    <div className="text-[9px] text-zinc-500 font-mono mt-0.5">
                      Autonomy: <span className="text-lime-400">{emp.autonomyLevel || 'autonomous'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEmployeeForCustomizer(emp);
                    }}
                    className="px-2 py-1 rounded-lg bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 text-[10px] font-bold border border-lime-500/30 shrink-0 cursor-pointer"
                  >
                    Edit Job
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Automated Workflow Tasks & Rules */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-lime-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Automated Workflow Rules
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingTask(true)}
                className="px-2 py-1 rounded-lg bg-lime-500 hover:bg-lime-400 text-black text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Rule</span>
              </button>
            </div>

            {/* Automation Task List */}
            <div className="space-y-2">
              {automationTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                      <span>{task.name}</span>
                      {task.isCustom && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                          CUSTOM
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {task.description}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleAutomation(task.id, !task.isAutomated)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      task.isAutomated ? 'bg-lime-500' : 'bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow transition duration-200 ease-in-out ${
                        task.isAutomated ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Custom Rule Creation Form */}
            {isAddingTask && (
              <form onSubmit={handleAddTask} className="p-3 rounded-xl bg-black border border-lime-500/50 space-y-2 mt-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-lime-400" />
                  <span>New Company Automation Rule</span>
                </div>
                <input
                  type="text"
                  required
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="e.g., Auto-send client invoice upon tech check-out"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                />
                <input
                  type="text"
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  placeholder="Description of automated action"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                />
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="px-3 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg bg-lime-500 text-black font-bold text-xs cursor-pointer"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 3: TYPICAL DEVICE SETTINGS */}
      {/* ============================================================== */}
      {activeSection === 'device' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Device Alert & Ringer Profile */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-lime-400" />
                <span>Device Alert & Audio Profile</span>
              </span>
              <span className="text-[10px] text-lime-400 font-mono font-bold uppercase">
                Mode: {ringerMode}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateNotifPreferences({
                    ...notifPreferences,
                    ringerMode: 'sound',
                    soundEnabled: true,
                    vibrationEnabled: true
                  });
                  showToast('Ringer Mode: Full Audio enabled');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                  ringerMode === 'sound'
                    ? 'bg-lime-500/10 border-lime-500 text-lime-400 font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Volume2 className="w-5 h-5" />
                <span className="text-[11px]">Sound</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUpdateNotifPreferences({
                    ...notifPreferences,
                    ringerMode: 'vibrate',
                    soundEnabled: false,
                    vibrationEnabled: true
                  });
                  showToast('Ringer Mode: Vibrate Only');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                  ringerMode === 'vibrate'
                    ? 'bg-lime-500/10 border-lime-500 text-lime-400 font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <span className="text-[11px]">Vibrate</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUpdateNotifPreferences({
                    ...notifPreferences,
                    ringerMode: 'silent',
                    soundEnabled: false,
                    vibrationEnabled: false
                  });
                  showToast('Ringer Mode: Silent');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                  ringerMode === 'silent'
                    ? 'bg-lime-500/10 border-lime-500 text-lime-400 font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <VolumeX className="w-5 h-5" />
                <span className="text-[11px]">Silent</span>
              </button>
            </div>

            <div className="pt-2 border-t border-zinc-900 flex items-center justify-between">
              <span className="text-xs text-zinc-400">Test Native Audio Tone:</span>
              <button
                type="button"
                onClick={onTriggerTestPush}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-lime-400" />
                <span>Test Alert</span>
              </button>
            </div>
          </div>

          {/* Display & Density Settings */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-lime-400" />
              <span>Display & Visual Theme</span>
            </span>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setThemeMode('oled')}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  themeMode === 'oled'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="font-mono text-[11px]">OLED Black</div>
                <div className="text-[9px] text-zinc-500">Max contrast & battery</div>
              </button>

              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="font-mono text-[11px]">Slate Modern</div>
                <div className="text-[9px] text-zinc-500">Balanced industrial</div>
              </button>

              <button
                type="button"
                onClick={() => setThemeMode('slate')}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  themeMode === 'slate'
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="font-mono text-[11px]">High Contrast</div>
                <div className="text-[9px] text-zinc-500">Outdoor sunlight visibility</div>
              </button>
            </div>

            <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-semibold">Compact Operations Grid</span>
              <button
                type="button"
                onClick={() => setCompactDensity(!compactDensity)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  compactDensity ? 'bg-lime-500' : 'bg-zinc-800'
                }`}
              >
                <span className={`block w-4 h-4 rounded-full bg-black transform transition-transform ${
                  compactDensity ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* Telemetry Stream Frequency */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-lime-400" />
                <span>Telemetry Refresh & Data Saver</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {telemetryIntervalMs / 1000}s Polling
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => onUpdateTelemetryInterval(1500)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  telemetryIntervalMs === 1500
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="font-mono text-[11px]">Real-Time (1.5s)</div>
                <div className="text-[9px] text-zinc-500">Live SCADA stream</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateTelemetryInterval(3500)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  telemetryIntervalMs === 3500
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="font-mono text-[11px]">Normal (3.5s)</div>
                <div className="text-[9px] text-zinc-500">Recommended</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateTelemetryInterval(10000)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  telemetryIntervalMs === 10000
                    ? 'bg-lime-500/10 border-lime-500 text-white font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="font-mono text-[11px]">Data Saver (10s)</div>
                <div className="text-[9px] text-zinc-500">Conserves battery</div>
              </button>
            </div>
          </div>

          {/* Local Storage & Cache Maintenance */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-lime-400" />
              <span>Storage & Diagnostics</span>
            </span>

            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between text-xs font-mono">
              <div>
                <div className="text-white font-bold">App Edition:</div>
                <div className="text-[10px] text-zinc-400">RCOS Enterprise v8.5.2 (Multi-Tenant)</div>
              </div>
              <div className="text-right">
                <div className="text-lime-400 font-bold">ONLINE</div>
                <div className="text-[10px] text-zinc-400">Capacitor Native 8+</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-zinc-400">Local Operational Cache:</span>
              <button
                type="button"
                onClick={handleClearCache}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-lime-400 ${cacheCleared ? 'animate-spin' : ''}`} />
                <span>Clear Cache</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Employee Job Customizer Modal */}
      <EmployeeJobCustomizerModal
        isOpen={!!selectedEmployeeForCustomizer}
        onClose={() => setSelectedEmployeeForCustomizer(null)}
        employee={selectedEmployeeForCustomizer}
        onSaved={(updated) => {
          setCustomEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
          setSelectedEmployeeForCustomizer(null);
          showToast(`Saved customized job profile for ${updated.name}!`);
        }}
      />
    </div>
  );
};
