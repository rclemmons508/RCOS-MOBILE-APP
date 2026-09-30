import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  biometricService, 
  BiometricStatus, 
  BiometricSecuritySettings, 
  BiometricEnrollmentInfo,
  BiometryKind,
  getBiometryLabel 
} from '../services/biometricService';

interface BiometricContextType {
  status: BiometricStatus | null;
  settings: BiometricSecuritySettings;
  enrolledInfo: BiometricEnrollmentInfo;
  isAvailable: boolean;
  isEnrolled: boolean;
  biometryType: BiometryKind;
  biometryLabel: string;
  isBiometricEnabled: boolean;
  isDashboardLocked: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  unlockWithBiometrics: () => Promise<boolean>;
  unlockWithPin: (pin: string) => boolean;
  lockDashboard: () => void;
  unlockDashboard: () => void;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => void;
  enrollBiometrics: (userEmail: string, userName: string, biometryType: 'fingerprint' | 'face', pin?: string) => Promise<{ success: boolean; error?: string }>;
  unenrollBiometrics: () => void;
  updateSettings: (newSettings: Partial<BiometricSecuritySettings>) => void;
  clearAuthError: () => void;
}

const BiometricContext = createContext<BiometricContextType | null>(null);

export const BiometricProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<BiometricStatus | null>(null);
  const [settings, setSettings] = useState<BiometricSecuritySettings>(() => biometricService.getSettings());
  const [enrolledInfo, setEnrolledInfo] = useState<BiometricEnrollmentInfo>(() => biometricService.getEnrolledInfo());
  const [isDashboardLocked, setIsDashboardLocked] = useState<boolean>(() => biometricService.isDashboardLocked());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initialize and check device biometric availability
  useEffect(() => {
    let mounted = true;
    biometricService.checkAvailability().then((s) => {
      if (mounted) {
        setStatus(s);
      }
    });

    setIsDashboardLocked(biometricService.isDashboardLocked());
    setEnrolledInfo(biometricService.getEnrolledInfo());

    return () => {
      mounted = false;
    };
  }, []);

  // Handle visibility changes (app backgrounding / screen off) for auto-lock
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const currentSettings = biometricService.getSettings();
        if (currentSettings.enabled && currentSettings.autoLockOnBackground) {
          biometricService.setLocked(true);
          setIsDashboardLocked(true);
        }
      } else if (document.visibilityState === 'visible') {
        if (biometricService.isDashboardLocked()) {
          setIsDashboardLocked(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Unlock with biometric authentication
  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const result = await biometricService.authenticate({
        reason: 'Scan fingerprint or face to unlock RCOS Control Dashboard',
        cancelTitle: 'Use PIN',
        allowDeviceCredential: true
      });

      if (result.success) {
        biometricService.setLocked(false);
        setIsDashboardLocked(false);
        setIsAuthenticating(false);
        return true;
      } else {
        setAuthError(result.error || 'Biometric verification failed.');
        setIsAuthenticating(false);
        return false;
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Biometric sensor error');
      setIsAuthenticating(false);
      return false;
    }
  }, []);

  // Unlock with fallback operator PIN
  const unlockWithPin = useCallback((pin: string): boolean => {
    const valid = biometricService.verifyOperatorPin(pin);
    if (valid) {
      biometricService.setLocked(false);
      setIsDashboardLocked(false);
      setAuthError(null);
      return true;
    } else {
      setAuthError('Incorrect operator PIN. Try again or use biometric scan.');
      return false;
    }
  }, []);

  // Explicitly lock the dashboard
  const lockDashboard = useCallback(() => {
    biometricService.setLocked(true);
    setIsDashboardLocked(true);
    setAuthError(null);
  }, []);

  // Explicitly unlock / reset the dashboard lock
  const unlockDashboard = useCallback(() => {
    biometricService.setLocked(false);
    setIsDashboardLocked(false);
    setAuthError(null);
  }, []);

  // Enable biometrics (requires immediate verification)
  const enableBiometrics = useCallback(async (): Promise<boolean> => {
    setIsAuthenticating(true);
    setAuthError(null);

    const testAuth = await biometricService.authenticate({
      reason: 'Confirm biometrics to enable RCOS Control Dashboard Shield',
      allowDeviceCredential: true
    });

    setIsAuthenticating(false);

    if (testAuth.success) {
      const updated = biometricService.saveSettings({ enabled: true });
      setSettings(updated);
      return true;
    } else {
      setAuthError(testAuth.error || 'Could not verify biometrics to enable shield.');
      return false;
    }
  }, []);

  // Disable biometrics
  const disableBiometrics = useCallback(() => {
    const updated = biometricService.saveSettings({ enabled: false });
    setSettings(updated);
    biometricService.setLocked(false);
    setIsDashboardLocked(false);
  }, []);

  // Enroll biometrics
  const enrollBiometrics = useCallback(async (
    userEmail: string,
    userName: string,
    biometryType: 'fingerprint' | 'face',
    pin?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsAuthenticating(true);
    setAuthError(null);

    const result = await biometricService.enrollBiometrics(userEmail, userName, biometryType, pin);
    setIsAuthenticating(false);

    if (result.success) {
      const info = biometricService.getEnrolledInfo();
      setEnrolledInfo(info);
      setSettings(biometricService.getSettings());
      return { success: true };
    } else {
      setAuthError(result.error || 'Enrollment failed.');
      return result;
    }
  }, []);

  // Unenroll biometrics
  const unenrollBiometrics = useCallback(() => {
    biometricService.unenrollBiometrics();
    setEnrolledInfo(biometricService.getEnrolledInfo());
    setSettings(biometricService.getSettings());
  }, []);

  // Update security preferences
  const updateSettings = useCallback((newSettings: Partial<BiometricSecuritySettings>) => {
    const updated = biometricService.saveSettings(newSettings);
    setSettings(updated);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const isAvailable = status?.isAvailable ?? true;
  const isEnrolled = enrolledInfo.enrolled;
  const biometryType = enrolledInfo.enrolled ? enrolledInfo.biometryType : (status?.biometryType ?? 'fingerprint');
  const biometryLabel = getBiometryLabel(biometryType);

  return (
    <BiometricContext.Provider
      value={{
        status,
        settings,
        enrolledInfo,
        isAvailable,
        isEnrolled,
        biometryType,
        biometryLabel,
        isBiometricEnabled: settings.enabled,
        isDashboardLocked,
        isAuthenticating,
        authError,
        unlockWithBiometrics,
        unlockWithPin,
        lockDashboard,
        unlockDashboard,
        enableBiometrics,
        disableBiometrics,
        enrollBiometrics,
        unenrollBiometrics,
        updateSettings,
        clearAuthError
      }}
    >
      {children}
    </BiometricContext.Provider>
  );
};

export const useBiometrics = (): BiometricContextType => {
  const ctx = useContext(BiometricContext);
  if (!ctx) {
    throw new Error('useBiometrics must be used within a BiometricProvider');
  }
  return ctx;
};
