import { BiometricAuth, BiometryType, CheckBiometryResult } from '@aparajita/capacitor-biometric-auth';
import { Capacitor } from '@capacitor/core';

export type BiometryKind = 'fingerprint' | 'face' | 'iris' | 'passcode' | 'none';

export interface BiometricStatus {
  isAvailable: boolean;
  strongBiometryIsAvailable: boolean;
  biometryType: BiometryKind;
  rawType: BiometryType;
  deviceIsSecure: boolean;
  reason: string;
  isNative: boolean;
}

export interface BiometricSecuritySettings {
  enabled: boolean;
  autoLockOnBackground: boolean;
  autoLockTimeoutMinutes: number; // 0 = immediate, 1, 5, 15
  requireForCriticalActions: boolean;
  /**
   * LEGACY field, kept only so existing settings readers still compile.
   * Backup PINs were removed (Nov 5, 2026, audit H5): plaintext PINs must
   * never be stored. This is always '' now — getSettings() strips any
   * stored value and saveSettings() never persists one. Do not read this
   * as "a PIN is set" and do not write a PIN into it.
   */
  operatorPin: string;
}

export interface BiometricEnrollmentInfo {
  enrolled: boolean;
  userEmail?: string;
  userName?: string;
  biometryType: 'fingerprint' | 'face';
  enrolledAt?: string;
  credentialId?: string;
}

const STORAGE_KEY_SETTINGS = 'rcos_biometric_settings';
const STORAGE_KEY_LOCKED = 'rcos_biometric_locked';
const STORAGE_KEY_LAST_ACTIVE = 'rcos_last_active_timestamp';
const STORAGE_KEY_ENROLLMENT = 'rcos_biometric_enrollment';

// Biometric login is turned OFF for now (Oct 16, 2026). The fingerprint
// login kept resurrecting deleted profiles and getting in the way of the
// app's core job, so it is disabled until the core is solid. This is one
// switch: set it to true to bring biometrics back. All screens hide
// automatically because they read isBiometricsEnabled() / getEnrolledInfo().
export const BIOMETRICS_ENABLED = false;

export const DEFAULT_BIOMETRIC_SETTINGS: BiometricSecuritySettings = {
  enabled: true,
  autoLockOnBackground: true,
  autoLockTimeoutMinutes: 5,
  requireForCriticalActions: true,
  operatorPin: '' // always empty: backup PINs were removed (audit H5), never stored
};

/**
 * Maps raw BiometryType enum to friendly string
 */
export function getBiometryKind(type: BiometryType): BiometryKind {
  switch (type) {
    case BiometryType.fingerprintAuthentication:
    case BiometryType.touchId:
      return 'fingerprint';
    case BiometryType.faceAuthentication:
    case BiometryType.faceId:
      return 'face';
    case BiometryType.irisAuthentication:
      return 'iris';
    default:
      return 'none';
  }
}

/**
 * Friendly label for biometry kind
 */
export function getBiometryLabel(kind: BiometryKind): string {
  switch (kind) {
    case 'fingerprint':
      return 'Fingerprint Scan';
    case 'face':
      return 'Face Unlock / Face ID';
    case 'iris':
      return 'Iris Recognition';
    case 'passcode':
      return 'Device PIN / Passcode';
    default:
      return 'Biometric Authentication';
  }
}

class BiometricService {
  private cachedStatus: BiometricStatus | null = null;
  private isChecking = false;

  /**
   * Check device hardware biometrics availability
   */
  async checkAvailability(): Promise<BiometricStatus> {
    if (this.cachedStatus && !this.isChecking) {
      return this.cachedStatus;
    }

    this.isChecking = true;
    const isNative = Capacitor.isNativePlatform();

    try {
      const result: CheckBiometryResult = await BiometricAuth.checkBiometry();
      const kind = getBiometryKind(result.biometryType);

      this.cachedStatus = {
        isAvailable: result.isAvailable || (!isNative && typeof window !== 'undefined' && window.PublicKeyCredential !== undefined),
        strongBiometryIsAvailable: result.strongBiometryIsAvailable || !isNative,
        biometryType: kind !== 'none' ? kind : (!isNative ? 'fingerprint' : 'none'),
        rawType: result.biometryType,
        deviceIsSecure: result.deviceIsSecure || !isNative,
        reason: result.reason || '',
        isNative
      };

      return this.cachedStatus;
    } catch (err: any) {
      console.warn('[Biometrics] Plugin checkBiometry notice:', err?.message || err);

      const hasWebAuthn = typeof window !== 'undefined' && window.PublicKeyCredential !== undefined;

      this.cachedStatus = {
        isAvailable: true,
        strongBiometryIsAvailable: true,
        biometryType: hasWebAuthn ? 'fingerprint' : 'face',
        rawType: BiometryType.fingerprintAuthentication,
        deviceIsSecure: true,
        reason: '',
        isNative
      };

      return this.cachedStatus;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Check if a biometric profile has been enrolled on this device
   */
  getEnrolledInfo(): BiometricEnrollmentInfo {
    if (!BIOMETRICS_ENABLED) {
      return { enrolled: false, biometryType: 'fingerprint' };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ENROLLMENT);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[Biometrics] Error reading enrollment info:', e);
    }
    return {
      enrolled: false,
      biometryType: 'fingerprint'
    };
  }

  /**
   * Check if biometrics is enrolled (optionally for a specific user)
   */
  isEnrolled(userEmail?: string): boolean {
    const info = this.getEnrolledInfo();
    if (!info.enrolled) return false;
    if (userEmail) {
      return info.userEmail?.toLowerCase() === userEmail.toLowerCase();
    }
    return true;
  }

  /**
   * Enroll a user with real device hardware biometrics
   */
  async enrollBiometrics(
    userEmail: string,
    userName: string,
    biometryType: 'fingerprint' | 'face' = 'fingerprint',
    pin?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!BIOMETRICS_ENABLED) {
      return { success: false, error: 'Biometric login is turned off for now.' };
    }
    const isNative = Capacitor.isNativePlatform();

    try {
      if (isNative) {
        // Native Android / iOS Device Biometric Hardware Prompt
        await BiometricAuth.authenticate({
          reason: `Touch your phone's sensor to link ${biometryType === 'face' ? 'Face Unlock' : 'Fingerprint'} for ${userEmail}`,
          cancelTitle: 'Cancel',
          allowDeviceCredential: true,
          androidTitle: 'RCOS Device Biometric Registration',
          androidSubtitle: `Link ${biometryType} to ${userEmail}`,
          iosFallbackTitle: 'Enter Passcode'
        });
      } else if (typeof window !== 'undefined' && 'PublicKeyCredential' in window && navigator.credentials?.create) {
        // Real Browser Platform Authenticator (Android Chrome / iOS Safari Passkeys)
        try {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          const userId = new Uint8Array(16);
          window.crypto.getRandomValues(userId);

          await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: {
                name: 'RCOS Mobile Operations'
              },
              user: {
                id: userId,
                name: userEmail,
                displayName: userName || userEmail
              },
              pubKeyCredParams: [
                { type: 'public-key', alg: -7 },  // ES256
                { type: 'public-key', alg: -257 } // RS256
              ],
              authenticatorSelection: {
                authenticatorAttachment: 'platform', // Enforces phone hardware sensor (Fingerprint/Face)
                userVerification: 'required',
                requireResidentKey: false
              },
              timeout: 60000,
              attestation: 'none'
            }
          });
        } catch (webauthnErr: any) {
          console.warn('[Biometrics] WebAuthn platform enrollment notice:', webauthnErr);
          const msg = webauthnErr?.message || '';
          if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('abort')) {
            return {
              success: false,
              error: 'Device biometric registration was cancelled on your phone.'
            };
          }
        }
      }

      // Save enrollment record
      const enrollment: BiometricEnrollmentInfo = {
        enrolled: true,
        userEmail,
        userName,
        biometryType,
        enrolledAt: new Date().toISOString(),
        credentialId: `cred_bio_${Date.now()}`
      };

      localStorage.setItem(STORAGE_KEY_ENROLLMENT, JSON.stringify(enrollment));

      // Also ensure settings enabled. The `pin` argument is ignored on
      // purpose: backup PINs were removed (audit H5) and are never stored.
      void pin;
      this.saveSettings({ enabled: true });

      this.recordActiveTimestamp();
      return { success: true };
    } catch (err: any) {
      console.warn('[Biometrics] Enrollment failed:', err);
      return {
        success: false,
        error: err?.message || 'Biometric enrollment was cancelled or could not be verified by hardware sensor.'
      };
    }
  }

  /**
   * Remove biometric enrollment
   */
  unenrollBiometrics(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_ENROLLMENT);
      this.saveSettings({ enabled: false });
    } catch {}
  }

  /**
   * Prompt user for Biometric authentication via actual phone device sensor
   */
  async authenticate(options?: {
    reason?: string;
    cancelTitle?: string;
    allowDeviceCredential?: boolean;
    requireEnrolled?: boolean;
  }): Promise<{ success: boolean; error?: string; userEmail?: string }> {
    if (!BIOMETRICS_ENABLED) {
      return { success: false, error: 'Biometric login is turned off for now. Please sign in with your email and password.' };
    }
    const isNative = Capacitor.isNativePlatform();
    const reason = options?.reason || 'Touch your phone fingerprint sensor or look at the camera';
    const cancelTitle = options?.cancelTitle || 'Use PIN';
    const allowDeviceCredential = options?.allowDeviceCredential ?? true;

    // Check enrollment if required
    const enrolledInfo = this.getEnrolledInfo();
    if (options?.requireEnrolled && !enrolledInfo.enrolled) {
      return {
        success: false,
        error: 'No biometric credentials enrolled on this device yet. Please set up biometrics first.'
      };
    }

    try {
      if (isNative) {
        // Native Android / iOS Device Hardware Biometric Prompt
        await BiometricAuth.authenticate({
          reason,
          cancelTitle,
          allowDeviceCredential,
          androidTitle: 'Device Biometric Security',
          androidSubtitle: enrolledInfo.userEmail ? `Verify operator: ${enrolledInfo.userEmail}` : 'Touch phone sensor or use Face Unlock',
          iosFallbackTitle: 'Enter Passcode'
        });

        this.recordActiveTimestamp();
        return {
          success: true,
          userEmail: enrolledInfo.userEmail
        };
      } else if (typeof window !== 'undefined' && 'PublicKeyCredential' in window && !!window.navigator?.credentials) {
        // Trigger actual phone platform authenticator (Android WebAuthn / iOS Safari Touch ID / Face ID)
        try {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          await navigator.credentials.get({
            publicKey: {
              challenge,
              timeout: 60000,
              userVerification: 'required',
              rpId: window.location.hostname
            }
          });
        } catch (webauthnErr: any) {
          console.warn('[Biometrics] Browser platform authenticator notice:', webauthnErr?.message || webauthnErr);
          const msg = webauthnErr?.message || '';
          if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('abort')) {
            return {
              success: false,
              error: 'Phone biometric verification was dismissed.'
            };
          }
        }
      }

      // Record successful verification. Only the enrolled account's
      // email is ever reported — no hard-coded fallback identity.
      this.recordActiveTimestamp();
      return {
        success: true,
        userEmail: enrolledInfo.userEmail
      };
    } catch (err: any) {
      console.warn('[Biometrics] Device authentication error:', err);
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('user') || msg.toLowerCase().includes('abort')) {
        return {
          success: false,
          error: 'Biometric scan was dismissed. Please sign in with your email and password.'
        };
      }
      return {
        success: false,
        error: err?.message || 'Biometric sensor error. Please sign in with your email and password.'
      };
    }
  }

  /**
   * Unlock the dashboard
   */
  unlock(): void {
    this.setLocked(false);
  }

  /**
   * Load security settings from storage.
   *
   * Backup PINs were removed (audit H5): any `operatorPin` found in the
   * stored blob is deleted from storage on read and never returned — the
   * field is always ''. Stored PINs are cleared, not carried.
   */
  getSettings(): BiometricSecuritySettings {
    // Purge a stored plaintext PIN even while the master switch is off:
    // PINs from earlier enrollments sit on disk otherwise, and would
    // reactivate if the switch were ever flipped back on.
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BiometricSecuritySettings>;
        if ((parsed.operatorPin || '').trim()) {
          const cleaned: BiometricSecuritySettings = {
            ...DEFAULT_BIOMETRIC_SETTINGS,
            ...parsed,
            operatorPin: '',
          };
          try {
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(cleaned));
          } catch {}
        }
      }
    } catch {}
    if (!BIOMETRICS_ENABLED) {
      return { ...DEFAULT_BIOMETRIC_SETTINGS, enabled: false };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BiometricSecuritySettings>;
        return { ...DEFAULT_BIOMETRIC_SETTINGS, ...parsed, operatorPin: '' };
      }
    } catch {}
    return { ...DEFAULT_BIOMETRIC_SETTINGS, operatorPin: '' };
  }

  /**
   * Save security settings. A PIN is NEVER persisted: any `operatorPin`
   * passed in (e.g. by older settings screens) is dropped before writing.
   */
  saveSettings(settings: Partial<BiometricSecuritySettings>): BiometricSecuritySettings {
    const current = this.getSettings();
    const { operatorPin: _droppedPin, ...rest } = settings;
    void _droppedPin;
    const updated: BiometricSecuritySettings = { ...current, ...rest, operatorPin: '' };
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
    } catch {}
    return updated;
  }

  /**
   * Check if control dashboard is locked
   */
  isDashboardLocked(): boolean {
    const settings = this.getSettings();
    if (!settings.enabled) return false;

    // Check explicit lock flag
    const explicitLock = localStorage.getItem(STORAGE_KEY_LOCKED);
    if (explicitLock === 'true') return true;

    // Check timeout if enabled
    if (settings.autoLockTimeoutMinutes > 0) {
      const lastActive = this.getLastActiveTimestamp();
      if (lastActive > 0) {
        const elapsedMinutes = (Date.now() - lastActive) / (1000 * 60);
        if (elapsedMinutes >= settings.autoLockTimeoutMinutes) {
          this.setLocked(true);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Set lock status
   */
  setLocked(locked: boolean): void {
    try {
      if (locked) {
        localStorage.setItem(STORAGE_KEY_LOCKED, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEY_LOCKED);
        this.recordActiveTimestamp();
      }
    } catch {}
  }

  /**
   * Verify backup operator PIN — REMOVED (audit H5).
   *
   * Plaintext PINs are no longer stored, so there is nothing to verify
   * against. Kept as a safe no-op returning false so existing callers
   * (e.g. the biometric lock screen, owned by another workstream) still
   * compile — PIN unlock can never succeed now.
   */
  verifyOperatorPin(_inputPin: string): boolean {
    return false;
  }

  /**
   * Whether the user has set their own backup PIN — always false now:
   * backup PINs were removed (audit H5). Kept for caller compatibility.
   */
  hasBackupPin(): boolean {
    return false;
  }

  /**
   * Save the user's own backup PIN — REMOVED (audit H5).
   *
   * Kept as a safe no-op returning false so existing callers still
   * compile. No PIN is stored anywhere.
   */
  setOperatorPin(_pin: string): boolean {
    return false;
  }

  /**
   * Record operator activity
   */
  recordActiveTimestamp(): void {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, Date.now().toString());
    } catch {}
  }

  /**
   * File-picker grace window.
   *
   * Opening the native file picker backgrounds the WebView, which would
   * otherwise trip the auto-lock-on-background guard and strand the user on
   * the lock screen mid-upload (losing the selected file). Call
   * notifyFilePickerOpened() right before opening the picker; the guard then
   * skips locking while the picker is expected to be on screen.
   */
  private filePickerOpenedAt = 0;
  private static readonly FILE_PICKER_GRACE_MS = 3 * 60 * 1000;

  notifyFilePickerOpened(): void {
    this.filePickerOpenedAt = Date.now();
  }

  clearFilePickerFlag(): void {
    this.filePickerOpenedAt = 0;
  }

  isFilePickerActive(): boolean {
    return (
      this.filePickerOpenedAt > 0 &&
      Date.now() - this.filePickerOpenedAt < BiometricService.FILE_PICKER_GRACE_MS
    );
  }

  private getLastActiveTimestamp(): number {
    try {
      const val = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
      return val ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  }
}

export const biometricService = new BiometricService();
