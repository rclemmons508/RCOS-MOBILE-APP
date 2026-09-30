import React, { useState, useEffect } from 'react';
import { useBiometrics } from '../../context/BiometricContext';
import { User } from '../../types';
import { RCLogo } from '../RCLogo';
import { authService } from '../../services/authService';
import { 
  Fingerprint, 
  Scan, 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  AlertCircle, 
  Smartphone,
  LogOut,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { BiometricSetupModal } from './BiometricSetupModal';

interface BiometricLockScreenProps {
  currentUser?: User | null;
  onLogout?: () => void;
}

export const BiometricLockScreen: React.FC<BiometricLockScreenProps> = ({ 
  currentUser,
  onLogout 
}) => {
  const {
    biometryType,
    biometryLabel,
    isAuthenticating,
    authError,
    unlockWithBiometrics,
    unlockWithPin,
    unlockDashboard,
    clearAuthError,
    isEnrolled
  } = useBiometrics();

  const [usePinMode, setUsePinMode] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isPromptingDevice, setIsPromptingDevice] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  // Trigger real device hardware sensor prompt
  const handleDeviceBiometricPrompt = async () => {
    setIsPromptingDevice(true);
    clearAuthError();
    setPinError(null);

    try {
      const success = await unlockWithBiometrics();
      if (!success) {
        // Kept on lock screen so user can retry or use PIN/Switch User
      }
    } finally {
      setIsPromptingDevice(false);
    }
  };

  // Switch User / Log Out handler - clears session so a new operator can log in
  const handleSwitchUser = () => {
    authService.clearActiveSession();
    unlockDashboard();
    if (onLogout) {
      onLogout();
    }
  };

  const handleKeypadPress = (digit: string) => {
    setPinError(null);
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPinError(null);
    setPin(prev => prev.slice(0, -1));
  };

  const verifyPin = (pinToTest: string) => {
    const ok = unlockWithPin(pinToTest);
    if (!ok) {
      setPinError('Invalid Operator PIN. Try 7267 (R-C-O-S).');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-4 sm:p-6 bg-black/95 backdrop-blur-2xl text-white select-none animate-in fade-in duration-200">
      {/* Top Header: Security Status & Switch Operator Shortcut */}
      <div className="w-full max-w-sm flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <RCLogo variant="compact" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
            Device Shield
          </span>
        </div>
        
        {/* Prominent Switch User / Log Out button at the very top */}
        <button
          type="button"
          onClick={handleSwitchUser}
          className="px-2.5 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
          title="Log out current user and switch to a different account"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Switch User</span>
        </button>
      </div>

      {/* Main Locked Card Area */}
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-5 my-auto">
        {/* Logged In Operator Card */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 w-full shadow-lg">
          <img
            src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
            alt="Operator Avatar"
            className="w-11 h-11 rounded-xl object-cover border border-lime-500/50 shrink-0"
          />
          <div className="text-left min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">
              {currentUser?.fullName || 'Lead Operations Specialist'}
            </div>
            <div className="text-[10px] text-lime-400 font-mono font-semibold truncate">
              {currentUser?.role || 'Operations Lead'}
            </div>
            <div className="text-[10px] text-zinc-400 font-mono truncate">
              {currentUser?.email || 'rcsolutions@gmail.com'}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-zinc-800 text-lime-400 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        {/* Dynamic Display: Device Hardware Biometrics vs PIN Mode */}
        {!usePinMode ? (
          <div className="flex flex-col items-center space-y-4 w-full">
            {/* Device Hardware Indicator Card */}
            <div className="w-full p-5 rounded-3xl bg-zinc-950 border border-zinc-800/90 flex flex-col items-center text-center space-y-3 shadow-xl">
              <div className="relative p-4 rounded-2xl bg-zinc-900 border border-lime-500/40 text-lime-400 shadow-lg shadow-lime-500/10">
                {biometryType === 'face' ? (
                  <Scan className="w-12 h-12 text-lime-400" />
                ) : (
                  <Fingerprint className="w-12 h-12 text-lime-400" />
                )}
                {isPromptingDevice && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-lime-400 animate-ping" />
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">
                  Phone Biometric Sensor
                </h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-[260px]">
                  Touch your phone's physical fingerprint sensor or use Face Unlock.
                </p>
              </div>

              {/* Primary Native Sensor Trigger Button */}
              <button
                type="button"
                onClick={handleDeviceBiometricPrompt}
                disabled={isAuthenticating || isPromptingDevice}
                className="w-full py-3 px-4 rounded-xl bg-lime-500 hover:bg-lime-400 active:scale-98 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20 transition cursor-pointer disabled:opacity-50"
              >
                {isPromptingDevice || isAuthenticating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Hardware Sensor...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>Unlock with Phone Biometrics</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-zinc-500 font-mono">
                Integrated with device hardware keystore
              </p>
            </div>

            {/* Error Feedback */}
            {authError && (
              <div className="w-full p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-[11px] leading-tight">{authError}</span>
              </div>
            )}
          </div>
        ) : (
          /* PIN Keypad Mode */
          <div className="flex flex-col items-center space-y-4 w-full">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <KeyRound className="w-3.5 h-3.5 text-lime-400" />
              <span>Enter 4-Digit Operator PIN</span>
            </div>

            {/* PIN Dots Display */}
            <div className="flex gap-4 my-1">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border transition-all ${
                    idx < pin.length
                      ? 'bg-lime-400 border-lime-400 scale-110 shadow-md shadow-lime-500/50'
                      : 'border-zinc-700 bg-zinc-900'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <div className="text-[11px] text-red-400 font-mono animate-shake">
                {pinError}
              </div>
            )}

            {/* Numeric Keypad (3x4) */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[240px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-12 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 active:scale-95 border border-zinc-800 text-base font-bold text-white transition cursor-pointer flex items-center justify-center font-mono"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleBackspace}
                className="h-12 rounded-xl bg-zinc-900/40 hover:bg-zinc-800 text-zinc-400 text-xs font-mono transition cursor-pointer flex items-center justify-center"
              >
                DEL
              </button>

              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-12 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 active:scale-95 border border-zinc-800 text-base font-bold text-white transition cursor-pointer flex items-center justify-center font-mono"
              >
                0
              </button>

              <button
                type="button"
                onClick={() => verifyPin('7267')}
                className="h-12 rounded-xl bg-lime-500/10 hover:bg-lime-500/20 border border-lime-500/30 text-lime-400 text-[10px] font-bold font-mono transition cursor-pointer flex items-center justify-center"
                title="RCOS Emergency Master PIN"
              >
                7267
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions: Switch Mode & Logout */}
      <div className="w-full max-w-sm pt-4 border-t border-zinc-900 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleSwitchUser}
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white px-3 py-2 rounded-xl hover:bg-zinc-900 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-red-400" />
          <span>Switch User</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setUsePinMode(!usePinMode);
            clearAuthError();
            setPinError(null);
          }}
          className="flex items-center gap-1.5 text-xs text-lime-400 hover:text-lime-300 font-mono font-bold px-3 py-2 rounded-xl hover:bg-lime-500/10 transition cursor-pointer"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>{usePinMode ? 'Use Biometrics' : 'Use PIN (7267)'}</span>
        </button>
      </div>

      {/* Setup / Re-Enroll Modal */}
      <BiometricSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        currentUser={currentUser}
        onEnrollmentComplete={() => {
          setIsSetupModalOpen(false);
          handleDeviceBiometricPrompt();
        }}
      />
    </div>
  );
};
