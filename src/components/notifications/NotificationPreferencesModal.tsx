import React, { useState } from 'react';
import { NotificationPreferences } from '../../types';
import { 
  Bell, 
  ShieldAlert, 
  Cpu, 
  Phone, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Moon, 
  X, 
  Sparkles, 
  Check,
  CheckCircle2
} from 'lucide-react';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: NotificationPreferences;
  onSavePreferences: (updated: NotificationPreferences) => void;
  onTriggerTestPush: () => void;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onSavePreferences,
  onTriggerTestPush,
}) => {
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>({ ...preferences });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleToggle = (key: keyof NotificationPreferences) => {
    setLocalPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleTextChange = (key: keyof NotificationPreferences, value: string) => {
    setLocalPrefs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    onSavePreferences(localPrefs);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
        
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-800/80 flex items-center justify-between bg-black/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Push Alert Preferences</h3>
              <p className="text-[11px] text-zinc-400">Customize RCOS System Alerts & Ringer Profiles</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Master Push Toggle */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-zinc-900 to-black border border-zinc-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-lime-400" />
                Master Push Notifications
              </span>
              <p className="text-[10px] text-zinc-400">Receive real-time notifications for critical events</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localPrefs.pushEnabled}
                onChange={() => handleToggle('pushEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lime-500"></div>
            </label>
          </div>

          {/* Event Category Preferences */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
              Event Subscriptions
            </h4>
            <div className="space-y-2">
              {/* Emergency Dispatches */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">Emergency Dispatches</div>
                    <div className="text-[10px] text-zinc-400">P1 urgent field job dispatches</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.emergencyDispatches}
                  onChange={() => handleToggle('emergencyDispatches')}
                  className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-lime-500 focus:ring-lime-500/20"
                />
              </div>

              {/* Performance Anomalies */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">Performance Anomalies</div>
                    <div className="text-[10px] text-zinc-400">Latency spikes, memory surges, fallback triggers</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.performanceAnomalies}
                  onChange={() => handleToggle('performanceAnomalies')}
                  className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-lime-500 focus:ring-lime-500/20"
                />
              </div>

              {/* Task Completions */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">Task Completions</div>
                    <div className="text-[10px] text-zinc-400">Completed jobs, invoices & cloud deployments</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.taskCompletions}
                  onChange={() => handleToggle('taskCompletions')}
                  className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-lime-500 focus:ring-lime-500/20"
                />
              </div>

              {/* Voice AI Calls */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">Voice AI Call Summaries</div>
                    <div className="text-[10px] text-zinc-400">Inbound call transcripts & voicemails</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.callTranscripts}
                  onChange={() => handleToggle('callTranscripts')}
                  className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-lime-500 focus:ring-lime-500/20"
                />
              </div>

              {/* System Alerts */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">System & Model Updates</div>
                    <div className="text-[10px] text-zinc-400">RCOS model weight updates & maintenance</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.systemAlerts}
                  onChange={() => handleToggle('systemAlerts')}
                  className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-lime-500 focus:ring-lime-500/20"
                />
              </div>
            </div>
          </div>

          {/* Sound Profile Settings */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
              Ringer & Alert Profile
            </h4>
            <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setLocalPrefs(prev => ({
                    ...prev,
                    ringerMode: 'sound',
                    soundEnabled: true,
                    vibrationEnabled: true
                  }));
                }}
                className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  (localPrefs.ringerMode === 'sound' || (localPrefs.soundEnabled && localPrefs.vibrationEnabled))
                    ? 'bg-lime-500 text-black font-extrabold shadow-md shadow-lime-500/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span className="text-[10px]">Sound On</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLocalPrefs(prev => ({
                    ...prev,
                    ringerMode: 'vibrate',
                    soundEnabled: false,
                    vibrationEnabled: true
                  }));
                }}
                className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  (localPrefs.ringerMode === 'vibrate' || (!localPrefs.soundEnabled && localPrefs.vibrationEnabled))
                    ? 'bg-amber-400 text-black font-extrabold shadow-md shadow-amber-400/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span className="text-[10px]">Vibrate Only</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLocalPrefs(prev => ({
                    ...prev,
                    ringerMode: 'silent',
                    soundEnabled: false,
                    vibrationEnabled: false
                  }));
                }}
                className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  (localPrefs.ringerMode === 'silent' || (!localPrefs.soundEnabled && !localPrefs.vibrationEnabled))
                    ? 'bg-red-500 text-white font-extrabold shadow-md shadow-red-500/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <VolumeX className="w-4 h-4" />
                <span className="text-[10px]">Silent Mode</span>
              </button>
            </div>

            {/* Quiet Hours */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-white">Quiet Hours Schedule</span>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.quietHoursEnabled}
                  onChange={() => handleToggle('quietHoursEnabled')}
                  className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-lime-500 focus:ring-lime-500/20"
                />
              </div>
              {localPrefs.quietHoursEnabled && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/60">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Start Time</label>
                    <input
                      type="time"
                      value={localPrefs.quietHoursStart}
                      onChange={(e) => handleTextChange('quietHoursStart', e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">End Time</label>
                    <input
                      type="time"
                      value={localPrefs.quietHoursEnd}
                      onChange={(e) => handleTextChange('quietHoursEnd', e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Test Push Button */}
          <button
            type="button"
            onClick={onTriggerTestPush}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-lime-400" />
            <span>Send Test Push Alert</span>
          </button>
        </div>

        {/* Footer Action */}
        <div className="p-3.5 border-t border-zinc-800/80 bg-black/60 flex gap-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-bold hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-lime-500/20 cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" /> 
                <span>Saved!</span>
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
