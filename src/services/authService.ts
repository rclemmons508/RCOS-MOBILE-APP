import { User, UserPreferences } from '../types';
import { userPreferencesService, DEFAULT_USER_PREFERENCES } from './userPreferencesService';
import { biometricService, BIOMETRICS_ENABLED } from './biometricService';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { setCachedAccessToken } from '../lib/gmail';
import { Capacitor } from '@capacitor/core';
import { createPasswordHash, checkPassword } from './passwordHash';

const STORAGE_KEY_SESSION = 'rcos_active_session';
const STORAGE_KEY_USERS = 'rcos_registered_users';

/**
 * Local session expiry (audit M4). The local session is only a cache of a
 * login — it is NOT proof of identity (see H1) — but it must still not
 * live forever on a lost or shared device.
 * - Absolute expiry: 30 days from first sign-in, even if the app is used daily.
 * - Idle timeout: 24 hours without the app reading the session.
 * Both are enforced in getActiveSession(); an expired session is cleared
 * and the user is sent to login.
 */
export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/** A stored session is the user record plus its expiry timestamps. */
interface StoredSession extends User {
  sessionCreatedAt?: number;
  sessionLastActiveAt?: number;
}
/**
 * One entry per email: a password-reset email was already sent for the
 * Firebase drift case. The drift recovery must never spam the user's
 * inbox on every login — one reset email per account, ever.
 */
const FIREBASE_RESET_SENT_PREFIX = 'rcos_firebase_reset_sent:';

/** Firebase codes meaning "these credentials are not valid" (enumeration-safe). */
const INVALID_CREDENTIAL_CODES = new Set([
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
]);

function firebaseResetAlreadySent(email: string): boolean {
  try {
    return localStorage.getItem(`${FIREBASE_RESET_SENT_PREFIX}${email.toLowerCase()}`) === '1';
  } catch {
    return false;
  }
}

function markFirebaseResetSent(email: string): void {
  try {
    localStorage.setItem(`${FIREBASE_RESET_SENT_PREFIX}${email.toLowerCase()}`, '1');
  } catch { /* storage unavailable — the email may be sent again next login */ }
}

/** Remove credential fields from a user object (sessions and returned users never carry them). */
function withoutCredentials<T extends Partial<User>>(user: T): T {
  const { passwordHash: _h, passwordSalt: _s, ...rest } = user;
  void _h;
  void _s;
  return rest as T;
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
   * Get currently active session if logged in.
   *
   * Enforces session expiry (M4): an absolute 30-day limit from first
   * sign-in and a 24-hour idle timeout. An expired session is cleared
   * here and null is returned, so every caller (App startup, account
   * screens) sends the user to login. Reading the session counts as
   * activity and refreshes the idle clock; it never extends the
   * absolute 30-day limit. Sessions saved before expiry existed carry
   * no timestamps — they are stamped on first read under the new code,
   * so they get a bounded life from here instead of being killed on upgrade.
   */
  getActiveSession(): User | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSION);
      if (raw) {
        const stored: StoredSession = JSON.parse(raw);
        // If legacy preloaded mock user, purge it so app starts completely from scratch
        if (stored?.id === 'usr-rcos-lead' || stored?.id === 'usr-tech-01' || stored?.id === 'usr-rcos-admin') {
          localStorage.removeItem(STORAGE_KEY_SESSION);
          localStorage.removeItem('rcos_auth_user');
          return null;
        }
        if (stored && stored.authenticated) {
          const now = Date.now();
          const createdAt = typeof stored.sessionCreatedAt === 'number' ? stored.sessionCreatedAt : now;
          const lastActiveAt = typeof stored.sessionLastActiveAt === 'number' ? stored.sessionLastActiveAt : now;
          if (now - createdAt > SESSION_ABSOLUTE_TTL_MS || now - lastActiveAt > SESSION_IDLE_TIMEOUT_MS) {
            // Expired session: clear it so the app treats the user as signed out.
            this.clearActiveSession();
            return null;
          }
          // Refresh the idle clock (activity) and persist the timestamps.
          const refreshed: StoredSession = { ...stored, sessionCreatedAt: createdAt, sessionLastActiveAt: now };
          try {
            localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(refreshed));
          } catch {}
          // Load fresh preferences
          const prefs = userPreferencesService.getUserPreferences(stored.email || stored.id);
          const { sessionCreatedAt: _createdAt, sessionLastActiveAt: _lastActiveAt, ...user } = refreshed;
          void _createdAt;
          void _lastActiveAt;
          return {
            ...withoutCredentials(user),
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
   * Save active session. Stamps the expiry timestamps (M4): the first
   * save sets the 30-day absolute clock, and every save refreshes the
   * 24-hour idle clock. Re-saving an existing session (e.g. a profile
   * update) preserves the original creation time — it must not silently
   * extend the absolute expiry.
   */
  saveActiveSession(user: User): void {
    try {
      const now = Date.now();
      let createdAt = now;
      try {
        const prev = JSON.parse(localStorage.getItem(STORAGE_KEY_SESSION) || 'null') as StoredSession | null;
        if (prev && prev.email?.toLowerCase() === user.email.toLowerCase() && typeof prev.sessionCreatedAt === 'number') {
          createdAt = prev.sessionCreatedAt;
        }
      } catch {}
      const stored: StoredSession = { ...withoutCredentials(user), sessionCreatedAt: createdAt, sessionLastActiveAt: now };
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(stored));
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
   * Drift recovery: the Firebase password no longer matches the local
   * one. Send ONE password-reset email for this account — tracked in
   * localStorage so it never spams on every login.
   */
  private async sendDriftResetEmail(email: string, force = false): Promise<void> {
    if (!force && firebaseResetAlreadySent(email)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      markFirebaseResetSent(email);
      console.warn('[AuthService] Firebase password differs from the old local password — a password-reset email was sent once for this account.');
    } catch (e: any) {
      console.warn('[AuthService] Could not send Firebase password-reset email:', e?.message || e);
    }
  }

  /** Sign Firebase out when it holds a different user than `email`. */
  private async signOutOtherFirebaseUser(email: string): Promise<void> {
    const current = auth.currentUser;
    if (current && (current.email || '').toLowerCase() !== email) {
      await signOut(auth).catch(() => {});
    }
  }

  /**
   * Sign In with Email and Password.
   *
   * When Firebase is configured, FIREBASE AUTH IS THE AUTHORITY:
   * signInWithEmailAndPassword decides who you are. The device's local
   * user list is only a profile cache (company id, preferences) and can
   * never sign anyone in on its own, except:
   * - Legacy migration: a local-only account that predates Firebase
   *   (never linked) whose password verifies against its local hash is
   *   created in Firebase with that password, then signed in. If Firebase
   *   already has that email (auth/email-already-in-use), Firebase wins:
   *   the local hash is discarded, one reset email is sent, and the login
   *   is refused until the Firebase password is used.
   * - Offline fallback: when Firebase cannot be reached, a never-linked
   *   local-only account may sign in with its local hash. Accounts linked
   *   to Firebase never fall back to the local store.
   *
   * When Firebase is NOT configured the local store is the only login,
   * as before (password required, hashless accounts refused).
   */
  async loginWithEmail(email: string, password?: string): Promise<User> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Please enter an email address.');
    // Blank / missing password never authenticates — on any account.
    if (!password || !password.trim()) {
      throw new Error('Please enter your password.');
    }
    const existing = this.getRegisteredUsers().find(u => u.email.toLowerCase() === cleanEmail);

    if (!isFirebaseConfigured) {
      return this.loginWithLocalStore(existing, password);
    }

    await this.signOutOtherFirebaseUser(cleanEmail);
    let firebaseUser: FirebaseUser | null = null;
    try {
      firebaseUser = (await signInWithEmailAndPassword(auth, cleanEmail, password)).user;
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/network-request-failed') {
        // Offline: only a never-linked, local-only account may use its local hash.
        if (existing && !existing.firebaseLinked && existing.passwordHash) {
          return this.loginWithLocalStore(existing, password);
        }
        throw new Error("Can't reach the sign-in service. Check your internet connection and try again.");
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Too many sign-in attempts. Please wait a few minutes and try again.');
      }
      if (code === 'auth/user-disabled') {
        throw new Error('This account has been disabled. Contact your company owner.');
      }
      if (code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
      if (!INVALID_CREDENTIAL_CODES.has(code)) {
        console.warn('[AuthService] Firebase sign-in failed:', code || err?.message);
        throw new Error('Sign-in failed. Please try again.');
      }
      // Firebase rejected the credentials. The only other way in is the
      // one-time migration of a legacy local-only account.
      const migrated = await this.migrateLegacyLocalAccount(existing, cleanEmail, password);
      if (migrated === 'local-only') {
        return this.finishLocalLogin(existing as User);
      }
      firebaseUser = migrated;
    }
    return this.finishFirebaseLogin(firebaseUser, existing);
  }

  /**
   * One-time migration of an account that only ever lived in this
   * device's local store. Returns the new Firebase user, or 'local-only'
   * when the local password verified but Firebase could not take the
   * account right now (offline / provider error) — the local login then
   * proceeds and migration retries on the next login. Throws for a wrong
   * password or when Firebase already owns the email.
   */
  private async migrateLegacyLocalAccount(
    existing: User | undefined,
    email: string,
    password: string
  ): Promise<FirebaseUser | 'local-only'> {
    const wrong = new Error('Wrong email or password. Please try again.');
    if (!existing) throw wrong;
    if (existing.firebaseLinked) throw wrong;
    if (!existing.passwordHash) {
      throw new Error('Wrong email or password. If you created this account with Google, please sign in with Google.');
    }
    if (!(await this.verifyLocalHash(existing, password))) throw wrong;
    try {
      return (await createUserWithEmailAndPassword(auth, email, password)).user;
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/email-already-in-use') {
        // Firebase already has this email with a different password.
        // Firebase is the authority: the local hash is no longer trusted.
        this.clearLocalCredentials(email);
        this.upsertUser({ ...withoutCredentials(existing), firebaseLinked: true });
        // Forced: this path runs once per account (the record is now linked).
        await this.sendDriftResetEmail(email, true);
        throw new Error(
          'This account\'s password was changed on another device. Sign in with your current password, ' +
          `or use the password-reset email sent to ${email}.`
        );
      }
      console.warn('[AuthService] Legacy account not migrated to Firebase yet (local login continues):', code || err?.message);
      return 'local-only';
    }
  }

  /** Local-store login (Firebase not configured, or offline fallback). */
  private async loginWithLocalStore(existing: User | undefined, password: string): Promise<User> {
    if (!existing) {
      throw new Error('No account found for that email. Please check the email or create a new account.');
    }
    if (!existing.passwordHash) {
      // Hashless account: refuse, do not adopt, do not authenticate.
      throw new Error(
        'This account has no password yet (it was created with Google sign-in). ' +
        'Please sign in with Google, or set a password for this account first.'
      );
    }
    if (!(await this.verifyLocalHash(existing, password))) {
      throw new Error('Wrong password. Please try again.');
    }
    return this.finishLocalLogin(existing);
  }

  private finishLocalLogin(existing: User): User {
    const loggedIn: User = {
      ...withoutCredentials(existing),
      authenticated: true,
      lastLogin: 'Just now',
      preferences: userPreferencesService.getUserPreferences(existing.email)
    };
    this.upsertUser(loggedIn);
    this.saveActiveSession(loggedIn);
    return loggedIn;
  }

  /**
   * Firebase verified this user. The local record becomes a profile cache
   * only: it is marked linked and its local hash is dropped, so it can
   * never be used to sign in without Firebase again. A Firebase user with
   * no local record (e.g. a new phone) gets a fresh profile record.
   */
  private finishFirebaseLogin(firebaseUser: FirebaseUser, existing: User | undefined): User {
    const email = (firebaseUser.email || '').toLowerCase();
    const base: User = existing
      ? withoutCredentials(existing)
      : {
          id: firebaseUser.uid,
          email,
          fullName: firebaseUser.displayName || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          role: 'Operations Lead',
          avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
          organization: '',
          authenticated: true,
        };
    const loggedIn: User = {
      ...base,
      email: base.email || email,
      firebaseLinked: true,
      authenticated: true,
      lastLogin: 'Just now',
      preferences: userPreferencesService.getUserPreferences(base.email || email)
    };
    this.upsertUser(loggedIn);
    this.clearLocalCredentials(loggedIn.email);
    this.saveActiveSession(loggedIn);
    return loggedIn;
  }

  /**
   * Explicit set-password step for hashless accounts (audit B4 / H3).
   *
   * Local-store only: when Firebase is configured, passwords belong to
   * Firebase and this refuses (it would otherwise let anyone holding the
   * phone give a Google-created account a password and sign in as it).
   * Without Firebase it only works when the account has NO stored hash,
   * sets the salted hash, and does NOT log the user in.
   */
  async setLocalPassword(email: string, newPassword: string): Promise<void> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    const users = this.getRegisteredUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (idx < 0) {
      throw new Error('No account found for that email.');
    }
    if (isFirebaseConfigured || users[idx].firebaseLinked) {
      throw new Error('This account\'s password is managed by your sign-in account. Please sign in with Google or with your existing password.');
    }
    if (users[idx].passwordHash) {
      throw new Error('This account already has a password set.');
    }
    const { hash, salt } = await createPasswordHash(newPassword);
    this.writeLocalCredentials(cleanEmail, hash, salt);
  }

  /**
   * Strict password check for sensitive actions (e.g. Delete Account).
   * Firebase-backed accounts are re-authenticated with Firebase; local-only
   * accounts are checked against their local hash (legacy hashes upgrade).
   */
  async verifyPassword(email: string, password: string): Promise<boolean> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!password) return false;
    const user = this.getRegisteredUsers().find(u => u.email.toLowerCase() === cleanEmail);
    if (isFirebaseConfigured && (user?.firebaseLinked || !user?.passwordHash)) {
      try {
        const current = auth.currentUser;
        if (current && (current.email || '').toLowerCase() === cleanEmail) {
          await reauthenticateWithCredential(current, EmailAuthProvider.credential(cleanEmail, password));
        } else {
          await signInWithEmailAndPassword(auth, cleanEmail, password);
        }
        return true;
      } catch {
        return false;
      }
    }
    if (!user?.passwordHash) return false;
    try {
      return await this.verifyLocalHash(user, password);
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
    const updated = { ...users[idx], ...withoutCredentials(patch) };
    users[idx] = updated;
    this.saveRegisteredUsers(users);
    try {
      const session = this.getActiveSession();
      if (session && session.email.toLowerCase() === cleanEmail) {
        this.saveActiveSession(updated);
      }
    } catch { /* session already updated via the users list */ }
    return withoutCredentials(updated);
  }

  /**
   * Register a new Operator account.
   *
   * Never creates or overwrites a login for an email that already exists
   * locally or (when configured) in Firebase. With Firebase configured the
   * account is created in Firebase Auth (createUserWithEmailAndPassword
   * decides; auth/email-already-in-use is refused) and NO local password
   * hash is stored. Without Firebase, a PBKDF2 local hash is stored.
   */
  async registerUser(data: {
    fullName: string;
    email: string;
    password?: string;
    role?: User['role'];
    organization?: string;
    /** Accepted for caller compatibility only — IGNORED. Backup PINs were removed (audit H5); no PIN is ever stored. */
    backupPin?: string;
    preferences?: Partial<UserPreferences>;
    enableBiometrics?: boolean;
    businessId?: string;
  }): Promise<User> {
    const cleanEmail = (data.email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Email is required.');
    const exists = () => this.getRegisteredUsers().some(u => u.email.toLowerCase() === cleanEmail);
    // Never register over an existing login (account takeover): the old
    // code upserted, which replaced that account's password hash and
    // signed the registrant in as its owner, with their cached company.
    if (exists()) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }
    const password = data.password || '';
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    // Firebase decides first, before anything is written on this device.
    let firebaseUser: FirebaseUser | null = null;
    let localCredentials: { hash: string; salt: string } | null = null;
    if (isFirebaseConfigured) {
      if (auth.currentUser) await signOut(auth).catch(() => {});
      try {
        firebaseUser = (await createUserWithEmailAndPassword(auth, cleanEmail, password)).user;
      } catch (err: any) {
        const code = String(err?.code || '');
        if (code === 'auth/email-already-in-use') {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        if (code === 'auth/weak-password') throw new Error('That password is too weak. Use at least 6 characters.');
        if (code === 'auth/invalid-email') throw new Error('Please enter a valid email address.');
        if (code === 'auth/network-request-failed') {
          throw new Error('You need an internet connection to create an account.');
        }
        console.warn('[AuthService] Firebase registration failed:', code || err?.message);
        throw new Error('Could not create the account. Please try again.');
      }
      const displayName = data.fullName.trim();
      if (displayName) await updateProfile(firebaseUser, { displayName }).catch(() => {});
    } else {
      // Store only a salted PBKDF2 hash of the password — never the password itself.
      localCredentials = await createPasswordHash(password);
    }
    // Re-check right before writing (another flow may have created it meanwhile).
    if (exists()) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    // The biometrics flag must never claim biometrics are on while the
    // master switch is off (audit M7): the switch wins over any caller
    // preference, so a future reader of this flag cannot re-enable a
    // removed feature by accident. Biometrics are off, so this is false.
    const biometricsOn = BIOMETRICS_ENABLED && (data.enableBiometrics ?? true);

    // Save preferences
    const savedPrefs = userPreferencesService.saveUserPreferences(cleanEmail, {
      ...DEFAULT_USER_PREFERENCES,
      ...(data.preferences || {}),
      biometricsEnabled: biometricsOn
    });

    const newUser: User = {
      id: firebaseUser?.uid || `usr_${Date.now()}`,
      email: cleanEmail,
      fullName: data.fullName.trim() || cleanEmail.split('@')[0].toUpperCase(),
      role: data.role || 'Operations Lead',
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanEmail)}`,
      organization: data.organization?.trim() || '',
      businessId: data.businessId,
      authenticated: true,
      biometricsEnabled: biometricsOn,
      lastLogin: 'Just now',
      preferences: savedPrefs,
      ...(firebaseUser ? { firebaseLinked: true } : {}),
    };

    // If user chose to enable biometrics during registration, enroll them.
    // enrollBiometrics itself refuses while the master switch is off.
    // data.backupPin is deliberately NOT passed on or stored anywhere:
    // backup PINs were removed (audit H5).
    if (data.enableBiometrics) {
      await biometricService.enrollBiometrics(
        newUser.email,
        newUser.fullName,
        'fingerprint'
      ).catch(() => {});
    }

    this.upsertUser(newUser);
    if (localCredentials) {
      this.writeLocalCredentials(cleanEmail, localCredentials.hash, localCredentials.salt);
    }
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
        'Google sign-in is not available in this app build yet. Please sign in with email and password.'
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
        setCachedAccessToken(credential.accessToken, { userEmail: googleUser.email || '' });
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
        biometricsEnabled: BIOMETRICS_ENABLED,
        lastLogin: 'Just now',
        preferences: prefs
      };

      // Google (via Firebase) verified this email: the local record becomes a
      // profile cache only, and any old local password hash is dropped.
      user.firebaseLinked = true;
      this.upsertUser(user);
      this.clearLocalCredentials(email);
      this.saveActiveSession(user);
      return user;
    }
  }

  /**
   * Sign In with Biometrics (Fingerprint / Face ID)
   */
  async loginWithBiometrics(): Promise<User> {
    if (!BIOMETRICS_ENABLED) {
      throw new Error('Biometric login is turned off for now. Please sign in with your email and password.');
    }
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

    // Identify user to log into. The fingerprint only unlocks the
    // account named in the enrollment — it never creates one. A
    // fingerprint for a deleted (or never-registered) account must fail
    // cleanly, never silently re-create that account and sign into it.
    // (That auto-create is how a deleted profile kept coming back every
    // time the fingerprint was used.) No silent enrollment either: with
    // no fingerprint linked, sign in with email + password first.
    const targetEmail = enrolledInfo.userEmail;
    if (!targetEmail) {
      throw new Error('No fingerprint is linked on this phone yet. Please sign in with your email and password, then link your fingerprint in Settings.');
    }
    const users = this.getRegisteredUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === targetEmail.toLowerCase());
    if (!foundUser) {
      throw new Error('No account found for that fingerprint. The account may have been deleted. Please sign in with your email and password.');
    }
    const matchedUser = {
      ...foundUser,
      authenticated: true,
      lastLogin: 'Just now',
      preferences: userPreferencesService.getUserPreferences(foundUser.email)
    };

    this.upsertUser(matchedUser);
    this.saveActiveSession(matchedUser);
    return matchedUser;
  }

  /**
   * Insert or update a user's PROFILE fields in the local users list.
   * Credentials are never written here: any passwordHash/passwordSalt on
   * `user` is ignored and an existing record keeps its own. Only
   * writeLocalCredentials() / clearLocalCredentials() change them, so a
   * profile save, session save, or sign-in can never overwrite another
   * login's password.
   */
  private upsertUser(user: User): void {
    try {
      const users = this.getRegisteredUsers();
      const profile = withoutCredentials(user);
      const idx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
      if (idx >= 0) {
        const { passwordHash, passwordSalt } = users[idx];
        users[idx] = { ...users[idx], ...profile, passwordHash, passwordSalt };
        if (!passwordHash) delete users[idx].passwordHash;
        if (!passwordSalt) delete users[idx].passwordSalt;
      } else {
        users.push(profile);
      }
      this.saveRegisteredUsers(users);
    } catch {}
  }

  /** Store a (PBKDF2) local hash for an existing record. */
  private writeLocalCredentials(email: string, hash: string, salt: string): void {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this.getRegisteredUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (idx < 0) return;
    users[idx] = { ...users[idx], passwordHash: hash, passwordSalt: salt };
    this.saveRegisteredUsers(users);
  }

  /** Drop the local hash for a record (e.g. once Firebase owns the account). */
  private clearLocalCredentials(email: string): void {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this.getRegisteredUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (idx < 0 || (!users[idx].passwordHash && !users[idx].passwordSalt)) return;
    const next = { ...users[idx] };
    delete next.passwordHash;
    delete next.passwordSalt;
    users[idx] = next;
    this.saveRegisteredUsers(users);
  }

  /**
   * Check a password against a record's local hash. Legacy hashes
   * (single SHA-256 / 64-bit fallback) still verify, and on success are
   * transparently re-hashed with PBKDF2 so existing users are never
   * locked out and never stay on the weak format.
   */
  private async verifyLocalHash(record: User, password: string): Promise<boolean> {
    if (!record.passwordHash) return false;
    const result = await checkPassword(password, record.passwordHash, record.passwordSalt || '');
    if (result === 'mismatch') return false;
    if (result === 'ok-needs-upgrade') {
      try {
        const { hash, salt } = await createPasswordHash(password);
        this.writeLocalCredentials(record.email, hash, salt);
      } catch {
        /* no WebCrypto here — keep the legacy hash; upgrade on a later login */
      }
    }
    return true;
  }
}

export const authService = new AuthService();
