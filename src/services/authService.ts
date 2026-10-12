import { User, UserPreferences } from '../types';
import { userPreferencesService, DEFAULT_USER_PREFERENCES } from './userPreferencesService';
import { biometricService } from './biometricService';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { setCachedAccessToken } from '../lib/gmail';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY_SESSION = 'rcos_active_session';
const STORAGE_KEY_USERS = 'rcos_registered_users';

export const SEED_USERS: User[] = [];

class AuthService {
  /**
   * Get all registered users from storage (no preloaded dummy users)
   */
  getRegisteredUsers(): User[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USERS);
      if (raw) {
        const stored: User[] = JSON.parse(raw);
        if (Array.isArray(stored)) {
          // Filter out any legacy preloaded mock seed users so user starts from scratch
          const clean = stored.filter(u => u.id !== 'usr-rcos-lead' && u.id !== 'usr-tech-01' && u.id !== 'usr-rcos-admin');
          return clean;
        }
      }
    } catch (e) {
      console.warn('[AuthService] Error reading registered users:', e);
    }
    return [];
  }

  private saveRegisteredUsers(users: User[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch {}
  }

  /**
   * Get currently active session if logged in
   */
  getActiveSession(): User | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSION);
      if (raw) {
        const user: User = JSON.parse(raw);
        // If legacy preloaded mock user, purge it so app starts completely from scratch
        if (user?.id === 'usr-rcos-lead' || user?.id === 'usr-tech-01' || user?.id === 'usr-rcos-admin') {
          localStorage.removeItem(STORAGE_KEY_SESSION);
          localStorage.removeItem('rcos_auth_user');
          return null;
        }
        if (user && user.authenticated) {
          // Load fresh preferences
          const prefs = userPreferencesService.getUserPreferences(user.email || user.id);
          return {
            ...user,
            preferences: prefs
          };
        }
      }
    } catch (e) {
      console.warn('[AuthService] Error reading active session:', e);
    }
    return null;
  }

  /**
   * Save active session
   */
  saveActiveSession(user: User): void {
    try {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(user));
      localStorage.setItem('rcos_auth_user', JSON.stringify({ email: user.email, displayName: user.fullName, uid: user.id }));
      // Also register or update in users list
      this.upsertUser(user);
    } catch {}
  }

  /**
   * Clear active session (Log out)
   */
  async logout(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION);
      localStorage.removeItem('rcos_auth_user');
      setCachedAccessToken(null);
      await signOut(auth).catch(() => {});
    } catch (e) {
      console.warn('[AuthService] Logout notice:', e);
    }
  }

  /**
   * Synchronously clear active session
   */
  clearActiveSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION);
      localStorage.removeItem('rcos_auth_user');
      setCachedAccessToken(null);
    } catch {}
  }

  /**
   * Sign In with Email and Password
   */
  async loginWithEmail(email: string, _password?: string): Promise<User> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this.getRegisteredUsers();
    let existing = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!existing) {
      // Create user record if logging in with email for the first time
      existing = {
        id: `usr_${Date.now()}`,
        email: cleanEmail,
        fullName: cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        role: 'Operations Lead',
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanEmail)}`,
        organization: '',
        authenticated: true,
        biometricsEnabled: true,
        lastLogin: 'Just now',
        preferences: userPreferencesService.getUserPreferences(cleanEmail)
      };
      this.upsertUser(existing);
    } else {
      existing = {
        ...existing,
        authenticated: true,
        lastLogin: 'Just now',
        preferences: userPreferencesService.getUserPreferences(existing.email)
      };
      this.upsertUser(existing);
    }

    this.saveActiveSession(existing);
    return existing;
  }

  /**
   * Register a new Operator account
   */
  async registerUser(data: {
    fullName: string;
    email: string;
    password?: string;
    role?: User['role'];
    organization?: string;
    backupPin?: string;
    preferences?: Partial<UserPreferences>;
    enableBiometrics?: boolean;
  }): Promise<User> {
    const cleanEmail = (data.email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Email is required.');

    // Save preferences
    const savedPrefs = userPreferencesService.saveUserPreferences(cleanEmail, {
      ...DEFAULT_USER_PREFERENCES,
      ...(data.preferences || {}),
      biometricsEnabled: data.enableBiometrics ?? true
    });

    const newUser: User = {
      id: `usr_${Date.now()}`,
      email: cleanEmail,
      fullName: data.fullName.trim() || cleanEmail.split('@')[0].toUpperCase(),
      role: data.role || 'Operations Lead',
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanEmail)}`,
      organization: data.organization?.trim() || '',
      authenticated: true,
      biometricsEnabled: data.enableBiometrics ?? true,
      lastLogin: 'Just now',
      preferences: savedPrefs
    };

    // If user chose to enable biometrics during registration, enroll them
    if (data.enableBiometrics) {
      await biometricService.enrollBiometrics(
        newUser.email,
        newUser.fullName,
        'fingerprint',
        data.backupPin
      ).catch(() => {});
    } else if (data.backupPin && /^\d{4}$/.test(data.backupPin)) {
      // PIN-only fallback even when biometrics are skipped
      biometricService.setOperatorPin(data.backupPin);
    }

    this.upsertUser(newUser);
    this.saveActiveSession(newUser);
    return newUser;
  }

  /**
   * Sign In with Google.
   *
   * Real Google authentication only — there is deliberately no fallback login.
   * Google's OAuth policy blocks sign-in inside embedded WebViews, so the
   * native app build cannot offer Google sign-in until the native Google
   * SDK is wired up (needs google-services.json from the Firebase console).
   */
  async loginWithGoogle(): Promise<User> {
    if (Capacitor.isNativePlatform()) {
      throw new Error(
        'Google sign-in is not available in this app build yet. Please sign in with email, fingerprint, or your backup PIN.'
      );
    }

    let result;
    try {
      result = await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw new Error('Google sign-in was cancelled.');
      }
      throw new Error('Google sign-in failed. Please try again or sign in with email.');
    }
    {
      const googleUser = result.user;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
      }

      if (!googleUser.email) {
        throw new Error('Google Sign-In failed: No verified email returned.');
      }

      const email = googleUser.email;
      const fullName = googleUser.displayName || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const avatar = googleUser.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`;
      const prefs = userPreferencesService.getUserPreferences(email);

      const user: User = {
        id: googleUser.uid || `usr_${Date.now()}`,
        email,
        fullName,
        role: 'Operations Lead',
        avatar,
        organization: '',
        authenticated: true,
        biometricsEnabled: true,
        lastLogin: 'Just now',
        preferences: prefs
      };

      this.upsertUser(user);
      this.saveActiveSession(user);
      return user;
    }
  }

  /**
   * Sign In with Biometrics (Fingerprint / Face ID)
   */
  async loginWithBiometrics(): Promise<User> {
    const enrolledInfo = biometricService.getEnrolledInfo();

    // Verify biometric hardware scan
    const authResult = await biometricService.authenticate({
      reason: 'Scan fingerprint or face to sign into RCOS',
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      requireEnrolled: false
    });

    if (!authResult.success) {
      throw new Error(authResult.error || 'Biometric authentication was cancelled or failed.');
    }

    // Identify user to log into
    let targetEmail = enrolledInfo.userEmail;
    const users = this.getRegisteredUsers();
    if (!targetEmail) {
      if (users.length === 0) {
        throw new Error('No user registered yet. Please create an account or sign in with Google first.');
      }
      targetEmail = users[0].email;
      // Enroll this user so subsequent logins are instant
      await biometricService.enrollBiometrics(targetEmail, users[0]?.fullName || 'Lead Operator');
    }

    let matchedUser = users.find(u => u.email.toLowerCase() === targetEmail.toLowerCase());

    if (!matchedUser) {
      matchedUser = {
        id: `usr_bio_${Date.now()}`,
        email: targetEmail,
        fullName: enrolledInfo.userName || targetEmail.split('@')[0].toUpperCase(),
        role: 'Operations Lead',
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(targetEmail)}`,
        organization: '',
        authenticated: true,
        biometricsEnabled: true,
        lastLogin: 'Just now',
        preferences: userPreferencesService.getUserPreferences(targetEmail)
      };
    } else {
      matchedUser = {
        ...matchedUser,
        authenticated: true,
        lastLogin: 'Just now',
        preferences: userPreferencesService.getUserPreferences(matchedUser.email)
      };
    }

    this.upsertUser(matchedUser);
    this.saveActiveSession(matchedUser);
    return matchedUser;
  }

  private upsertUser(user: User): void {
    try {
      const users = this.getRegisteredUsers();
      const idx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...user };
      } else {
        users.push(user);
      }
      this.saveRegisteredUsers(users);
    } catch {}
  }
}

export const authService = new AuthService();
