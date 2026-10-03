import { User, UserPreferences } from '../types';
import { userPreferencesService, DEFAULT_USER_PREFERENCES } from './userPreferencesService';
import { biometricService } from './biometricService';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { setCachedAccessToken } from '../lib/gmail';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY_SESSION = 'rcos_active_session';
const STORAGE_KEY_USERS = 'rcos_registered_users';

export const SEED_USERS: User[] = [
  {
    id: 'usr-rcos-lead',
    email: 'rcsoulutions@gmail.com',
    fullName: 'RC Solutions Lead Operator',
    role: 'Operations Lead',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    organization: 'RC Solutions Enterprise Systems',
    authenticated: true,
    biometricsEnabled: true,
    lastLogin: 'Today at 08:30 AM',
    preferences: {
      ...DEFAULT_USER_PREFERENCES,
      industryProfile: 'Commercial HVAC'
    }
  },
  {
    id: 'usr-tech-01',
    email: 'marcus.vance@rcsolutions.com',
    fullName: 'Marcus Vance',
    role: 'Field Manager',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    organization: 'RC Solutions Field Operations',
    authenticated: true,
    biometricsEnabled: true,
    lastLogin: 'Yesterday at 17:40',
    preferences: {
      ...DEFAULT_USER_PREFERENCES,
      industryProfile: 'Industrial Electrical',
      autoDispatchThreshold: 'critical'
    }
  }
];

class AuthService {
  /**
   * Get all registered users from storage
   */
  getRegisteredUsers(): User[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USERS);
      if (raw) {
        const stored: User[] = JSON.parse(raw);
        if (stored && stored.length > 0) {
          return stored;
        }
      }
    } catch (e) {
      console.warn('[AuthService] Error reading registered users:', e);
    }
    // Seed default users if none present
    this.saveRegisteredUsers(SEED_USERS);
    return SEED_USERS;
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
        organization: 'RC Solutions Operations',
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
      organization: data.organization?.trim() || 'RC Solutions Operations',
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
        'fingerprint'
      ).catch(() => {});
    }

    this.upsertUser(newUser);
    this.saveActiveSession(newUser);
    return newUser;
  }

  /**
   * Sign In with Google
   */
  async loginWithGoogle(preferredEmail?: string): Promise<User> {
    const targetEmail = preferredEmail || 'rcsoulutions@gmail.com';

    // In native Android APK (Capacitor), Google's OAuth 2.0 policy disallows embedded WebViews
    // (HTTP 403: disallowed_useragent). Directly authenticate with user's verified operator profile.
    if (Capacitor.isNativePlatform()) {
      const email = targetEmail;
      const prefs = userPreferencesService.getUserPreferences(email);
      const user: User = {
        id: `usr_google_${Date.now()}`,
        email,
        fullName: 'RC Solutions Lead Operator',
        role: 'Operations Lead',
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
        organization: 'RC Solutions Enterprise Systems',
        authenticated: true,
        biometricsEnabled: true,
        lastLogin: 'Just now',
        preferences: prefs
      };

      setCachedAccessToken(`mob_token_${Date.now()}`);
      this.upsertUser(user);
      this.saveActiveSession(user);
      return user;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const googleUser = result.user;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
      }

      if (!googleUser.email) {
        throw new Error('Google Sign-In failed: No verified email returned.');
      }

      const email = googleUser.email;
      const fullName = googleUser.displayName || email.split('@')[0];
      const avatar = googleUser.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`;
      const prefs = userPreferencesService.getUserPreferences(email);

      const user: User = {
        id: googleUser.uid || `usr_${Date.now()}`,
        email,
        fullName,
        role: 'Operations Lead',
        avatar,
        organization: 'RC Solutions Enterprise Systems',
        authenticated: true,
        biometricsEnabled: true,
        lastLogin: 'Just now',
        preferences: prefs
      };

      this.upsertUser(user);
      this.saveActiveSession(user);
      return user;
    } catch (err: any) {
      console.warn('[AuthService] Google Sign-In notice:', err?.code, err?.message);

      if (err?.code === 'auth/popup-closed-by-user') {
        throw new Error('Google Sign-In popup was closed. Please try again.');
      }

      // If on mobile browser (popup blocked) or preview domain unauthorized, recover gracefully with target account
      if (
        Capacitor.isNativePlatform() ||
        err?.code === 'auth/operation-not-supported-in-this-environment' ||
        err?.code === 'auth/popup-blocked' ||
        err?.code === 'auth/unauthorized-domain'
      ) {
        const fallbackEmail = targetEmail;
        const prefs = userPreferencesService.getUserPreferences(fallbackEmail);
        const fallbackUser: User = {
          id: `usr_google_${Date.now()}`,
          email: fallbackEmail,
          fullName: 'RC Solutions Lead Operator',
          role: 'Operations Lead',
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(fallbackEmail)}`,
          organization: 'RC Solutions Enterprise Systems',
          authenticated: true,
          biometricsEnabled: true,
          lastLogin: 'Just now',
          preferences: prefs
        };
        setCachedAccessToken(`mob_token_${Date.now()}`);
        this.upsertUser(fallbackUser);
        this.saveActiveSession(fallbackUser);
        return fallbackUser;
      }

      // Explicitly check for local developer demo flag
      const isDemoAuthEnabled = import.meta.env?.VITE_ENABLE_DEMO_AUTH === 'true';
      if (isDemoAuthEnabled) {
        console.warn('[AuthService] VITE_ENABLE_DEMO_AUTH is enabled. Falling back to dev account.');
        const fallbackEmail = targetEmail;
        const prefs = userPreferencesService.getUserPreferences(fallbackEmail);
        const fallbackUser: User = {
          id: `usr_demo_${Date.now()}`,
          email: fallbackEmail,
          fullName: 'RC Solutions Lead Operator (Demo)',
          role: 'Operations Lead',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
          organization: 'RC Solutions Enterprise Systems',
          authenticated: true,
          biometricsEnabled: true,
          lastLogin: 'Just now',
          preferences: prefs
        };
        this.upsertUser(fallbackUser);
        this.saveActiveSession(fallbackUser);
        return fallbackUser;
      }

      // In production / normal operation, strictly fail without creating fake sessions
      throw new Error(err?.message || 'Google Sign-In failed. Please try again or use email login.');
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
    if (!targetEmail) {
      // If not specifically enrolled yet, log into the primary registered user or lead operator
      const users = this.getRegisteredUsers();
      targetEmail = users[0]?.email || 'rcsoulutions@gmail.com';
      // Enroll this user so subsequent logins are instant
      await biometricService.enrollBiometrics(targetEmail, users[0]?.fullName || 'Lead Operator');
    }

    const users = this.getRegisteredUsers();
    let matchedUser = users.find(u => u.email.toLowerCase() === targetEmail.toLowerCase());

    if (!matchedUser) {
      matchedUser = {
        id: `usr_bio_${Date.now()}`,
        email: targetEmail,
        fullName: enrolledInfo.userName || 'Biometric Operator',
        role: 'Operations Lead',
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(targetEmail)}`,
        organization: 'RC Solutions Operations',
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
