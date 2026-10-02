import React, { useState } from 'react';
import { useBiometrics } from '../../context/BiometricContext';
import { User } from '../../types';
import { 
  Fingerprint, 
  Scan, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  KeyRound, 
  Smartphone,
  RefreshCw,
  ArrowRight
} from 'lucide-react';

interface BiometricSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  onEnrollmentComplete?: () => void;
  initialType?: 'fingerprint' | 'face';
}

export const BiometricSetupModal: React.FC<BiometricSetupModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onEnrollmentComplete,
  initialType = 'fingerprint'
}) => {
  const { enrollBiometrics, status } = useBiometrics();
  const [selectedType, setSelectedType] = useState<'fingerprint' | 'face'>(initialType);
  const [step, setStep] = useState<'choose' | 'scanning' | 'success'>('choose');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backupPin, setBackupPin] = useState('6073');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const targetEmail = currentUser?.email || 'rcsoulutions@gmail.com';
  const targetName = currentUser?.fullName || 'RC Solutions;

  const startEnrollment = async () => {
    setErrorMsg(null);
    setStep('scanning');
    setIsProcessing(true);

    try {
      // Direct call to phone hardware sensor prompt (WebAuthn / Android BiometricPrompt)
      const result = await enrollBiometrics(targetEmail, targetName, selectedType, backupPin);

      if (result.success) {
        setStep('success');
      } else {
        setErrorMsg(result.error || 'Biometric hardware sensor rejected the enrollment or was dismissed. Try again.');
        setStep('choose');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Biometric setup failed on this device.');
      setStep('choose');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    onClose();
    if (onEnrollmentComplete) {
      onEnrollmentComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-lime-500/10 text-lime-400 border border-lime-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Device Biometric Enrollment
              </h2>
              <p className="text-[11px] text-zinc-400">
                Link your phone's physical sensor to your account
              </p>
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

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'choose' && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-300">
                Choose the hardware modality on your phone for account{' '}
                <strong className="text-white font-mono">{targetEmail}</strong>:
              </div>

              {/* Modality Options */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedType('fingerprint')}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                    selectedType === 'fingerprint'
                      ? 'bg-lime-500/10 border-lime-500 text-white shadow-md shadow-lime-500/10'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  <Fingerprint className={`w-8 h-8 mb-3 ${selectedType === 'fingerprint' ? 'text-lime-400' : 'text-zinc-500'}`} />
                  <div>
                    <div className="font-bold text-xs">Fingerprint</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Phone sensor / scanner</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedType('face')}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                    selectedType === 'face'
                      ? 'bg-lime-500/10 border-lime-500 text-white shadow-md shadow-lime-500/10'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  <Scan className={`w-8 h-8 mb-3 ${selectedType === 'face' ? 'text-lime-400' : 'text-zinc-500'}`} />
                  <div>
                    <div className="font-bold text-xs">Face Unlock</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Front camera / Face ID</div>
                  </div>
                </button>
              </div>

              {/* Backup PIN Input */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-lime-400" />
                    <span>Backup Operator PIN</span>
                  </span>
                  <input
                    type="text"
                    maxLength={6}
                    value={backupPin}
                    onChange={(e) => setBackupPin(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-20 bg-black border border-zinc-700 focus:border-lime-500 rounded-lg px-2.5 py-1 text-center font-mono text-xs text-white"
                  />
                </div>
                <p className="text-[10px] text-zinc-500">
                  Used if hands are dirty or sensor is wet.
                </p>
              </div>

              {/* Start Button */}
              <button
                type="button"
                onClick={startEnrollment}
                disabled={isProcessing}
                className="w-full py-3 rounded-2xl bg-lime-500 hover:bg-lime-400 active:scale-98 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20 transition cursor-pointer"
              >
                <span>Trigger Phone {selectedType === 'face' ? 'Face Unlock' : 'Fingerprint'} Sensor</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'scanning' && (
            <div className="py-6 flex flex-col items-center text-center space-y-5">
              <div className="relative p-6 rounded-3xl bg-zinc-900 border-2 border-lime-500/60 shadow-xl shadow-lime-500/20">
                {selectedType === 'face' ? (
                  <Scan className="w-16 h-16 text-lime-400 animate-pulse" />
                ) : (
                  <Fingerprint className="w-16 h-16 text-lime-400 animate-pulse" />
                )}
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-lime-400 animate-ping" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">
                  {selectedType === 'face' ? 'Look at Your Front Camera' : 'Touch Your Phone Sensor'}
                </h3>
                <p className="text-xs text-zinc-400 max-w-[280px]">
                  Your phone is prompting you to verify your {selectedType === 'face' ? 'Face ID' : 'fingerprint'}.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 pt-2">
                <RefreshCw className="w-3.5 h-3.5 text-lime-400 animate-spin" />
                <span>Waiting for device confirmation...</span>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-6 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-lime-500/20 border-2 border-lime-500 flex items-center justify-center text-lime-400 shadow-xl shadow-lime-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">
                  Biometrics Enrolled Successfully!
                </h3>
                <p className="text-xs text-zinc-400 max-w-[280px]">
                  Your phone's hardware sensor is now registered for instant 1-touch login.
                </p>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="w-full py-2.5 rounded-2xl bg-lime-500 hover:bg-lime-400 text-black font-extrabold text-xs transition cursor-pointer mt-2"
              >
                Complete Setup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
