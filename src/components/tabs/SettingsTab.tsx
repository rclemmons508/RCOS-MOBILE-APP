import React, { useState } from 'react';
import { AutomationTask, NotificationPreferences } from '../../types';
import { 
  Settings2, 
  Plus, 
  Zap, 
  ZapOff, 
  CheckCircle2, 
  Factory, 
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
  Check 
} from 'lucide-react';

interface SettingsTabProps {
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
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
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
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [saveToast, setSaveToast] = useState<string | null>(null);

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
      description: newTaskDescription || 'Custom automated workflow step',
      isAutomated: true,
      isCustom: true,
    });
    setNewTaskName('');
    setNewTaskDescription('');
    setIsAddingTask(false);
    showToast('Custom automation task added!');
  };

  const ringerMode = notifPreferences.ringerMode || (
    !notifPreferences.soundEnabled && !notifPreferences.vibrationEnabled ? 'silent' :
    !notifPreferences.soundEnabled ? 'vibrate' : 'sound'
  );

  return (
    <div className="space-y-4 pb-6 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden">
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
            <h2 className="text-sm sm:text-base font-bold text-white truncate">System Settings & Controls</h2>
            <p className="text-xs text-zinc-400 truncate">Audio profiles, workflows, AI and rules</p>
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

      {/* SECTION 1: ALERT SOUND & RINGER PROFILE */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-lime-400" />
            <span>Device Alert & Ringer Profile</span>
          </h3>
          <span className="text-[10px] text-zinc-500 font-mono">Real-time Sound Logic</span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">Select Sound Mode:</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-lime-400 uppercase font-mono">
              Current: {ringerMode}
            </span>
          </div>

          {/* 3-Way Mode Cards */}
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
                showToast('Ringer Mode: Sound On (Chime + Vibration)');
              }}
              className={`p-2.5 sm:p-3 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
                ringerMode === 'sound' && notifPreferences.soundEnabled
                  ? 'bg-lime-500 text-black border-lime-400 font-extrabold shadow-md shadow-lime-500/20'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span className="text-xs font-bold">Sound On</span>
              <span className="text-[9px] opacity-80 font-normal">Chime & Vibrate</span>
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
                showToast('Ringer Mode: Vibrate Only (Muted Audio)');
              }}
              className={`p-2.5 sm:p-3 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
                ringerMode === 'vibrate' || (!notifPreferences.soundEnabled && notifPreferences.vibrationEnabled)
                  ? 'bg-amber-400 text-black border-amber-300 font-extrabold shadow-md shadow-amber-400/20'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span className="text-xs font-bold">Vibrate Only</span>
              <span className="text-[9px] opacity-80 font-normal">Haptic Feedback</span>
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
                showToast('Ringer Mode: Silent / DND (Muted)');
              }}
              className={`p-2.5 sm:p-3 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
                ringerMode === 'silent' || (!notifPreferences.soundEnabled && !notifPreferences.vibrationEnabled)
                  ? 'bg-red-500 text-white border-red-400 font-extrabold shadow-md shadow-red-500/20'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <VolumeX className="w-4 h-4" />
              <span className="text-xs font-bold">Silent Mode</span>
              <span className="text-[9px] opacity-80 font-normal">Fully Muted</span>
            </button>
          </div>

          {/* Quick Audio & Vibration Toggles */}
          <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                const nextS = !notifPreferences.soundEnabled;
                onUpdateNotifPreferences({
                  ...notifPreferences,
                  soundEnabled: nextS,
                  ringerMode: nextS ? 'sound' : (notifPreferences.vibrationEnabled ? 'vibrate' : 'silent')
                });
                showToast(nextS ? 'Audio Chime Enabled' : 'Audio Chime Disabled');
              }}
              className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                notifPreferences.soundEnabled
                  ? 'bg-lime-500/10 border-lime-500/40 text-lime-400'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                <span className="text-xs font-bold">Audio Chime</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${notifPreferences.soundEnabled ? 'bg-lime-500/20 text-lime-300' : 'bg-zinc-800 text-zinc-500'}`}>
                {notifPreferences.soundEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const nextV = !notifPreferences.vibrationEnabled;
                onUpdateNotifPreferences({
                  ...notifPreferences,
                  vibrationEnabled: nextV,
                  ringerMode: notifPreferences.soundEnabled ? 'sound' : (nextV ? 'vibrate' : 'silent')
                });
                showToast(nextV ? 'Vibration Enabled' : 'Vibration Disabled');
              }}
              className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                notifPreferences.vibrationEnabled
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                <span className="text-xs font-bold">Vibration</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${notifPreferences.vibrationEnabled ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-500'}`}>
                {notifPreferences.vibrationEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Quiet Hours Switch */}
          <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Moon className="w-4 h-4 text-indigo-400" />
              <div>
                <span className="text-xs font-bold text-white block">Quiet Hours Schedule</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {notifPreferences.quietHoursStart} - {notifPreferences.quietHoursEnd} (Auto-Mute)
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifPreferences.quietHoursEnabled}
              onChange={() => {
                const nextQ = !notifPreferences.quietHoursEnabled;
                onUpdateNotifPreferences({
                  ...notifPreferences,
                  quietHoursEnabled: nextQ,
                });
                showToast(nextQ ? 'Quiet Hours Activated' : 'Quiet Hours Deactivated');
              }}
              className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-lime-500 focus:ring-lime-500/20 cursor-pointer"
            />
          </div>

          {/* Test Sound Button */}
          <button
            type="button"
            onClick={() => {
              onTriggerTestPush();
              showToast('Test Notification & Haptic Triggered');
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-lime-400" />
            <span>Test Sound & Haptic Alert</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: AI ASSISTANT & SYSTEM TELEMETRY */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-lime-400" />
          <span>AI & System Performance</span>
        </h3>

        <div className="space-y-2">
          {/* Floating AI Bot Toggle */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3 shadow-md">
            <div className="flex-1 space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-lime-400 shrink-0" />
                <span className="text-sm font-bold text-white truncate">Floating AI Assistant</span>
              </div>
              <p className="text-xs text-zinc-400 leading-snug">
                Draggable multi-agent AI widget for instant operations dispatch.
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => {
                onToggleAiAssistant();
                showToast(aiAssistantEnabled ? 'AI Assistant Disabled' : 'AI Assistant Enabled');
              }}
              className={`shrink-0 flex items-center justify-center px-3 h-8 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                aiAssistantEnabled 
                  ? 'bg-lime-500 text-black shadow-md shadow-lime-500/20' 
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              {aiAssistantEnabled ? (
                <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> ACTIVE</span>
              ) : (
                <span className="flex items-center gap-1.5"><ZapOff className="w-3.5 h-3.5" /> OFF</span>
              )}
            </button>
          </div>

          {/* Telemetry Pulse Speed */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3 shadow-md">
            <div className="flex-1 space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-lime-400 shrink-0" />
                <span className="text-sm font-bold text-white truncate">Live Telemetry Rate</span>
              </div>
              <p className="text-xs text-zinc-400 leading-snug">
                Streaming frequency of CPU and network telemetry.
              </p>
            </div>
            
            <select
              value={telemetryIntervalMs}
              onChange={(e) => {
                const val = Number(e.target.value);
                onUpdateTelemetryInterval(val);
                showToast(`Telemetry rate set to ${val > 0 ? val/1000 + 's' : 'Paused'}`);
              }}
              className="bg-zinc-900 border border-zinc-800 text-white text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-lime-500/50 shrink-0"
            >
              <option value={2000}>2.0s (Ultra)</option>
              <option value={3500}>3.5s (Standard)</option>
              <option value={7000}>7.0s (Eco)</option>
              <option value={0}>0s (Paused)</option>
            </select>
          </div>

          {/* Auto-Dispatch Priority Rule */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3 shadow-md">
            <div className="flex-1 space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-lime-400 shrink-0" />
                <span className="text-sm font-bold text-white truncate">Auto-Dispatch Rule</span>
              </div>
              <p className="text-xs text-zinc-400 leading-snug">
                Threshold for automated dispatching of field technicians.
              </p>
            </div>
            
            <select
              value={autoDispatchThreshold}
              onChange={(e) => {
                const val = e.target.value as any;
                onUpdateAutoDispatchThreshold(val);
                showToast(`Auto-Dispatch rule updated: ${val.toUpperCase()}`);
              }}
              className="bg-zinc-900 border border-zinc-800 text-white text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-lime-500/50 shrink-0"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical (P1)</option>
              <option value="high">High & P1</option>
              <option value="manual">Manual Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 3: APP PROFILE & INDUSTRY PRESET */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
          <Factory className="w-3.5 h-3.5 text-lime-400" />
          <span>Industry & Workspace Profile</span>
        </h3>
        
        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3 shadow-md">
          <div className="flex-1 space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-lime-400 shrink-0" />
              <span className="text-sm font-bold text-white truncate">Active Industry Preset</span>
            </div>
            <p className="text-xs text-zinc-400 leading-snug">Adapt terminology and workflows to your domain.</p>
          </div>
          
          <select 
            value={industryProfile}
            onChange={(e) => {
              onUpdateIndustry(e.target.value);
              showToast(`Industry updated: ${e.target.value}`);
            }}
            className="shrink-0 bg-zinc-900 border border-zinc-800 text-white text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-lime-500/50"
          >
            <option>Default (Generic)</option>
            <option>Field Services</option>
            <option>Commercial HVAC</option>
            <option>Electrical & Power</option>
            <option>Building Automation</option>
            <option>Logistics & Supply</option>
          </select>
        </div>
      </div>

      {/* SECTION 4: AUTOMATED WORKFLOWS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-lime-400" />
            <span>Automated Workflows & Routing Rules</span>
          </h3>
          <span className="text-[10px] text-zinc-500 font-mono">{automationTasks.filter(t => t.isAutomated).length} Active</span>
        </div>
        
        <div className="space-y-2">
          {automationTasks.map((task) => (
            <div key={task.id} className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-start justify-between gap-3 transition-all hover:border-zinc-700 shadow-md">
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white truncate">{task.name}</span>
                  {task.isCustom && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-lime-400 font-mono font-bold">Custom</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 leading-snug">{task.description}</p>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  const nextState = !task.isAutomated;
                  onToggleAutomation(task.id, nextState);
                  showToast(`${task.name}: ${nextState ? 'AUTOMATED' : 'MANUAL'}`);
                }}
                className={`shrink-0 flex items-center justify-center w-11 h-8 rounded-xl transition-all cursor-pointer ${
                  task.isAutomated 
                    ? 'bg-lime-500 text-black shadow-md shadow-lime-500/20' 
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                }`}
                aria-label={`Toggle ${task.name}`}
              >
                {task.isAutomated ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add Custom Task Form / Button */}
      {!isAddingTask ? (
        <button
          type="button"
          onClick={() => setIsAddingTask(true)}
          className="w-full p-3.5 sm:p-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/80 text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 group cursor-pointer"
        >
          <Plus className="w-4 h-4 text-lime-400 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold">Add Custom Automation Task</span>
        </button>
      ) : (
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-lime-400" /> New Custom Automation Task
            </h3>
            <button type="button" onClick={() => setIsAddingTask(false)} className="text-xs text-zinc-500 hover:text-white cursor-pointer">Cancel</button>
          </div>
          
          <form onSubmit={handleAddTask} className="space-y-3">
            <input
              type="text"
              placeholder="Task Name (e.g. Generate weekly CRM digest)"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-lime-500/50 transition-colors"
              autoFocus
            />
            <textarea
              placeholder="Task Description & Execution Rule"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-lime-500/50 transition-colors h-16 resize-none font-sans"
            />
            <button
              type="submit"
              disabled={!newTaskName.trim()}
              className="w-full py-2.5 bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save & Activate Custom Task</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
