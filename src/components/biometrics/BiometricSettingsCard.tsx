import React, { useState } from 'react';
import { useBiometrics } from '../../context/BiometricContext';
import { BiometricSetupModal } from './BiometricSetupModal';
import { User } from '../../types';
import { 
  Fingerprint, 
  Scan, 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone, 
  RefreshCw,
  Clock,
  Sliders,
  Check,
  UserCheck,
  Trash2,
  Plus
} from 'lucide-react';

interface BiometricSettingsCardProps {
  currentUser?: User | null;
}

export const BiometricSettingsCard: React.FC<BiometricSettingsCardProps> = ({ currentUser }) => {
  const {
    status,
    settings,
    isBiometricEnabled,
    isEnrolled,
    enrolledInfo,
    biometryType,
    biometryLabel,
    enableBiometrics,
    disableBiometrics,
    unenrollBiometrics,
    updateSettings,
    lockDashboard,
    unlockWithBiometrics,
    isAuthenticating
  } = useBiometrics();

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [newPin, setNewPin] = useState(settings.operatorPin || '6073');
  const [pinSavedToast, setPinSavedToast] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<'fingerprint' | 'face'>('fingerprint');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleToggle = async () => {
    setTestResult(null);
    if (isBiometricEnabled) {
      disableBiometrics();
    } else {
      if (!isEnrolled) {
        setModalInitialType('fingerprint');
        setIsSetupModalOpen(true);
        return;
      }
      const ok = await enableBiometrics();
      if (ok) {
        setTestResult({
          success: true,
          message: 'Biometric security armed successfully!'
        });
      } else {
        setTestResult({
          success: false,
          message: 'Biometric authorization was dismissed or failed.'
        });
      }
    }
  };

  const handleTestSensor = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const ok = await unlockWithBiometrics();
      if (ok) {
        setTestResult({
          success: true,
          message: `Phone sensor verified successfully using ${biometryLabel}!`
        });
      } else {
        setTestResult({
          success: false,
          message: 'Phone sensor prompt was dismissed or failed verification.'
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleDeleteBiometrics = () => {
    unenrollBiometrics();
    setDeleteConfirm(false);
    setTestResult({
      success: true,
      message: 'Enrolled biometric key removed from this device.'
    });
  };

  const handleOpenSetup = (type: 'fingerprint' | 'face') => {
    setModalInitialType(type);
    setIsSetupModalOpen(true);
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.trim().length >= 4) {
      updateSettings({ operatorPin: newPin.trim() });
      setEditingPin(false);
      setPinSavedToast(true);
      setTimeout(() => setPinSavedToast(false), 2500);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-lime-500/10 text-lime-400 border border-lime-500/30">
            {biometryType === 'face' ? <Scan className="w-5 h-5" /> : <Fingerprint className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Device Biometric Shield
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase ${
                isBiometricEnabled 
                  ? 'bg-lime-500/20 text-lime-300 border border-lime-500/40' 
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>
                {isBiometricEnabled ? 'ACTIVE' : 'DISABLED'}
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Direct phone hardware fingerprint & Face Unlock integration
            </p>
          </div>
        </div>

        {/* Master Toggle */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isAuthenticating}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isBiometricEnabled ? 'bg-lime-500' : 'bg-zinc-800'
          }`}
          role="switch"
          aria-checked={isBiometricEnabled}
          title={isBiometricEnabled ? 'Disable Biometrics' : 'Enable Biometrics'}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
              isBiometricEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Enrollment Status & Management Card */}
      <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserCheck className={`w-4 h-4 shrink-0 ${isEnrolled ? 'text-lime-400' : 'text-zinc-500'}`} />
            <div className="min-w-0 text-xs">
              <div className="font-bold text-white truncate">
                {isEnrolled 
                  ? `Phone Hardware Linked: ${enrolledInfo.biometryType === 'face' ? 'Face Unlock' : 'Fingerprint'}`
                  : 'No Phone Biometrics Enrolled'}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono truncate">
                {isEnrolled 
                  ? `Linked to ${enrolledInfo.userEmail || currentUser?.email}` 
                  : 'Enroll your fingerprint or face to enable 1-touch login'}
              </div>
            </div>
          </div>

          {/* Action: Re-Enroll / Set Up */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenSetup(enrolledInfo.biometryType || 'fingerprint')}
              className="px-3 py-1.5 rounded-lg bg-lime-500 hover:bg-lime-400 text-black font-bold text-xs transition cursor-pointer"
            >
              {isEnrolled ? 'Re-Enroll' : 'Enroll Now'}
            </button>
          </div>
        </div>

        {/* Re-Enroll or Delete or Switch Modality Controls */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleOpenSetup('fingerprint')}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 transition cursor-pointer ${
                enrolledInfo.biometryType === 'fingerprint' && isEnrolled
                  ? 'bg-lime-500/10 border-lime-500/40 text-lime-400'
                  : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:text-white'
              }`}
            >
              <Fingerprint className="w-3 h-3" />
              <span>{enrolledInfo.biometryType === 'fingerprint' ? 'Re-Enroll Fingerprint' : 'Add Fingerprint'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenSetup('face')}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 transition cursor-pointer ${
                enrolledInfo.biometryType === 'face' && isEnrolled
                  ? 'bg-lime-500/10 border-lime-500/40 text-lime-400'
                  : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:text-white'
              }`}
            >
              <Scan className="w-3 h-3" />
              <span>{enrolledInfo.biometryType === 'face' ? 'Re-Enroll Face' : 'Add Face Unlock'}</span>
            </button>
          </div>

          {/* Delete Option */}
          {isEnrolled && (
            deleteConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-red-400">Confirm delete?</span>
                <button
                  type="button"
                  onClick={handleDeleteBiometrics}
                  className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] cursor-pointer"
                >
                  Yes, Delete
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition cursor-pointer px-2 py-1 rounded-lg hover:bg-red-500/10"
                title="Delete this biometric enrollment"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Biometrics</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Hardware Status Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
        <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="text-[10px] text-zinc-400">Sensor Modality:</div>
          <div className="font-bold text-white flex items-center gap-1 mt-0.5 truncate">
            {biometryType === 'face' ? <Scan className="w-3.5 h-3.5 text-lime-400" /> : <Fingerprint className="w-3.5 h-3.5 text-lime-400" />}
            <span className="truncate">{biometryLabel}</span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="text-[10px] text-zinc-400">Hardware Keystore:</div>
          <div className="font-bold text-white flex items-center gap-1 mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-lime-400" />
            <span>Class 3 Hardware</span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 col-span-2 sm:col-span-1">
          <div className="text-[10px] text-zinc-400">Device Integration:</div>
          <div className="font-bold text-white flex items-center gap-1 mt-0.5">
            <Smartphone className="w-3.5 h-3.5 text-lime-400" />
            <span>Phone Sensor Active</span>
          </div>
        </div>
      </div>

      {/* Test & Action Controls */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button
          type="button"
          onClick={handleTestSensor}
          disabled={isTesting || isAuthenticating}
          className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-lime-400 ${isTesting ? 'animate-spin' : ''}`} />
          <span>Test Phone Sensor Now</span>
        </button>

        <button
          type="button"
          onClick={lockDashboard}
          className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>Test Lock Screen</span>
        </button>
      </div>

      {/* Feedback Toast / Alert */}
      {testResult && (
        <div className={`p-2.5 rounded-xl text-xs font-mono border flex items-center gap-2 ${
          testResult.success
            ? 'bg-lime-500/10 border-lime-500/30 text-lime-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Auto-Lock Policies */}
      <div className="pt-2 border-t border-zinc-900 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-lime-400" />
            <span>Auto-Lock Timeout:</span>
          </span>
          <select
            value={settings.autoLockTimeoutMinutes}
            onChange={(e) => updateSettings({ autoLockTimeoutMinutes: Number(e.target.value) })}
            className="bg-black border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-lime-500 cursor-pointer"
          >
            <option value={0}>Immediate (On Background)</option>
            <option value={1}>1 Minute Idle</option>
            <option value={5}>5 Minutes Idle</option>
            <option value={15}>15 Minutes Idle</option>
          </select>
        </div>

        {/* Emergency Backup Operator PIN */}
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-lime-400" />
              <span>Backup Operator PIN</span>
            </span>
            <button
              type="button"
              onClick={() => setEditingPin(!editingPin)}
              className="text-[11px] text-lime-400 hover:text-lime-300 font-bold cursor-pointer"
            >
              {editingPin ? 'Cancel' : 'Change PIN'}
            </button>
          </div>

          {!editingPin ? (
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span>Configured PIN: <strong className="text-white tracking-widest">••••</strong></span>
              <span className="text-[10px] text-zinc-500">(Default: 6073 / R-C-O-S)</span>
            </div>
          ) : (
            <form onSubmit={handleSavePin} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="4-6 digit PIN"
                className="bg-black border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono w-28 text-center"
              />
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-lime-500 text-black font-bold text-xs cursor-pointer"
              >
                Save PIN
              </button>
            </form>
          )}

          {pinSavedToast && (
            <div className="text-[10px] text-lime-400 font-mono flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>New Operator PIN saved!</span>
            </div>
          )}
        </div>
      </div>

      {/* Setup / Re-Enroll Modal */}
      <BiometricSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        currentUser={currentUser}
        initialType={modalInitialType}
        onEnrollmentComplete={() => {
          setIsSetupModalOpen(false);
          setTestResult({
            success: true,
            message: 'Device biometric hardware enrolled successfully!'
          });
        }}
      />
    </div>
  );
};
