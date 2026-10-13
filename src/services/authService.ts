import { User, UserPreferences } from '../types';
import { userPreferencesService, DEFAULT_USER_PREFERENCES } from './userPreferencesService';
import { biometricService } from './biometricService';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { setCachedAccessToken } from '../lib/gmail';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY_SESSION = 'rcos_active_session';
const STORAGE_KEY_USERS = 'rcos_registered_users';

/**
 * SHA-256 hex digest of `salt:password`. Only the hash is ever stored —
 * the password itself is never written to disk. Used to check the typed
 * password at login and before sensitive actions (e.g. Delete Account).
 */
async function hashPassword(password: string, salt: string): Promise<string> {
  // WebCrypto is unavailable on plain-HTTP pages (not a secure context).
  // Fall back to a simple deterministic hash so password checks still work
  // there instead of crashing login — weaker, but far better than no check.
  if (!crypto?.subtle) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    const input = `${salt}:${password}`;
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0'));
  }
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function makeSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
   * Sign In with Email and Password.
   *
   * The password IS checked (it used to be ignored) and unknown emails do
   * NOT auto-create an account. Both old behaviors meant a deleted account
   * came straight back the next time its email was typed — that is the
   * bug this fixes. Accounts created before passwords were enforced have
   * no stored hash: the first login WITH a password adopts it (one-time
   * migration); after that, the password is enforced.
   */
  async loginWithEmail(email: string, password?: string): Promise<User> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this.getRegisteredUsers();
    const existing = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!existing) {
      throw new Error('No account found for that email. Please check the email or create a new account.');
    }

    if (existing.passwordHash) {
      if (!password || (await hashPassword(password, existing.passwordSalt || '')) !== existing.passwordHash) {
        throw new Error('Wrong password. Please try again.');
      }
    } else if (password) {
      // Legacy account: adopt the typed password from now on.
      const salt = makeSalt();
      const passwordHash = await hashPassword(password, salt);
      const migrated: User = {
        ...existing,
        passwordHash,
        passwordSalt: salt,
        authenticated: true,
        lastLogin: 'Just now',
        preferences: userPreferencesService.getUserPreferences(existing.email)
      };
      this.upsertUser(migrated);
      this.saveActiveSession(migrated);
      return migrated;
    }

    const loggedIn: User = {
      ...existing,
      authenticated: true,
      lastLogin: 'Just now',
      preferences: userPreferencesService.getUserPreferences(existing.email)
    };
    this.upsertUser(loggedIn);
    this.saveActiveSession(loggedIn);
    return loggedIn;
  }

  /**
   * Strict password check for sensitive actions (e.g. Delete Account).
   * True only when the account has a stored password hash and it matches.
   * Legacy accounts with no hash return false — they must log in with
   * their password once first (which migrates them), then retry.
   */
  async verifyPassword(email: string, password: string): Promise<boolean> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = this.getRegisteredUsers().find(u => u.email.toLowerCase() === cleanEmail);
    if (!user?.passwordHash) return false;
    try {
      return (await hashPassword(password, user.passwordSalt || '')) === user.passwordHash;
    } catch {
      return false;
    }
  }

  /**
   * Remove one account's stored login record. Returns true only if the
   * record is verified gone afterwards.
   */
  removeRegisteredUser(email: string): boolean {
    const cleanEmail = (email || '').trim().toLowerCase();
    try {
      const remaining = this.getRegisteredUsers().filter(u => u.email.toLowerCase() !== cleanEmail);
      this.saveRegisteredUsers(remaining);
      return !this.getRegisteredUsers().some(u => u.email.toLowerCase() === cleanEmail);
    } catch {
      return false;
    }
  }

  /**
   * Update a stored user's profile fields (name / picture) in both the
   * registered-users list and the active session. Returns the updated
   * user, or null when no record exists for the email.
   */
  updateStoredUser(email: string, patch: Partial<User>): User | null {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this.getRegisteredUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (idx < 0) return null;
    const updated = { ...users[idx], ...patch };
    users[idx] = updated;
    this.saveRegisteredUsers(users);
    try {
      const session = this.getActiveSession();
      if (session && session.email.toLowerCase() === cleanEmail) {
        this.saveActiveSession(updated);
      }
    } catch { /* session already updated via the users list */ }
    return updated;
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

    // Store only a salted hash of the password — never the password itself.
    // Without this, login could never tell a right password from a wrong one.
    if (data.password) {
      const salt = makeSalt();
      newUser.passwordHash = await hashPassword(data.password, salt);
      newUser.passwordSalt = salt;
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
