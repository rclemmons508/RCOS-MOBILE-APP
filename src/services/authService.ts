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
   * Mirror the just-verified local login into Firebase Auth, so the phone
   * app holds a real Firebase session (and apiFetch can attach its ID
   * token). The local login NEVER depends on this: every Firebase
   * failure is swallowed here with a warning and local login proceeds,
   * because the login gate is off and the app must keep working.
   *
   * How each case is handled (password is already verified locally
   * before this runs):
   * - Already signed into Firebase as this user → nothing to do.
   * - Signed into Firebase as someone else (e.g. switch-user) → sign
   *   out first, then sign in as this user.
   * - Sign-in fails with user-not-found / invalid-credential → legacy
   *   account (predates Firebase): create the Firebase user with the
   *   JUST-VERIFIED password, then the session exists. With email
   *   enumeration protection on, Firebase reports a missing account as
   *   invalid-credential, so both codes take this path and the create
   *   call tells them apart.
   * - Create fails with email-already-in-use → the Firebase password
   *   drifted (it was changed without the local record): send ONE
   *   password-reset email for this account (tracked in localStorage so
   *   it never spams) and proceed with local login. Next login, after
   *   the reset, works.
   * - Sign-in fails with wrong-password (older Firebase behavior) →
   *   same drift recovery as above.
   * - Network / rate-limit / any other Firebase error → warn and
   *   proceed with local login. The session heals on the next login.
   */
  private async syncFirebaseSession(email: string, password?: string): Promise<void> {
    if (!isFirebaseConfigured) return;
    if (!password) return; // No password (e.g. PIN/biometric login) — nothing to mirror.
    const cleanEmail = (email || '').trim().toLowerCase();
    try {
      const current = auth.currentUser;
      if (current?.email?.toLowerCase() === cleanEmail) {
        return; // Already signed into Firebase as this user.
      }
      if (current) {
        // Signed in as someone else (switch-user) — sign out first.
        await signOut(auth).catch(() => {});
      }
      try {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        return;
      } catch (signInErr: any) {
        const code = String(signInErr?.code || '');
        if (code === 'auth/wrong-password') {
          // Drift (older Firebase behavior): Firebase password differs.
          await this.sendDriftResetEmail(cleanEmail);
          return;
        }
        if (code !== 'auth/user-not-found' && code !== 'auth/invalid-credential') {
          // Network, rate-limit, or anything else — local login proceeds.
          console.warn('[AuthService] Firebase sign-in skipped (local login continues):', code || signInErr?.message);
          return;
        }
        // user-not-found / invalid-credential: legacy account (or
        // enumeration protection hiding a missing account). Create it
        // with the just-verified password.
        try {
          await createUserWithEmailAndPassword(auth, cleanEmail, password);
          return;
        } catch (createErr: any) {
          const createCode = String(createErr?.code || '');
          if (createCode === 'auth/email-already-in-use') {
            // The Firebase account exists but its password differs —
            // drift. One reset email, then local login proceeds.
            await this.sendDriftResetEmail(cleanEmail);
            return;
          }
          console.warn('[AuthService] Firebase account creation skipped (local login continues):', createCode || createErr?.message);
          return;
        }
      }
    } catch (e: any) {
      console.warn('[AuthService] Firebase session sync skipped (local login continues):', e?.message || e);
    }
  }

  /**
   * Drift recovery: the Firebase password no longer matches the local
   * one. Send ONE password-reset email for this account — tracked in
   * localStorage so it never spams on every login. The user resets via
   * email; the next login works.
   */
  private async sendDriftResetEmail(email: string): Promise<void> {
    if (firebaseResetAlreadySent(email)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      markFirebaseResetSent(email);
      console.warn('[AuthService] Firebase password differs from local password — a password-reset email was sent once for this account.');
    } catch (e: any) {
      console.warn('[AuthService] Could not send Firebase password-reset email:', e?.message || e);
    }
  }

  /**
   * Sign In with Email and Password.
   *
   * The password IS checked (it used to be ignored) and unknown emails do
   * NOT auto-create an account. Both old behaviors meant a deleted account
   * came straight back the next time its email was typed — that is the
   * bug this fixes.
   *
   * A password is required on EVERY login path (audit H3): a blank or
   * missing password never authenticates. Accounts with no stored hash
   * (e.g. created by Google sign-in, audit B4) do NOT fall through to
   * authenticated, and do NOT adopt the typed password (audit B3: a typo
   * would permanently become the password). A hashless account must sign
   * in with Google, or set a password explicitly via setLocalPassword()
   * first — there is no silent migration any more.
   */
  async loginWithEmail(email: string, password?: string): Promise<User> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this.getRegisteredUsers();
    const existing = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!existing) {
      throw new Error('No account found for that email. Please check the email or create a new account.');
    }

    // Blank / missing password never authenticates — on any account.
    if (!password || !password.trim()) {
      throw new Error('Please enter your password.');
    }

    if (existing.passwordHash) {
      if (!(await this.verifyLocalHash(existing, password))) {
        throw new Error('Wrong password. Please try again.');
      }
    } else {
      // Hashless account: refuse, do not adopt, do not authenticate.
      throw new Error(
        'This account has no password yet (it was created with Google sign-in). ' +
        'Please sign in with Google, or set a password for this account first.'
      );
    }

    const loggedIn: User = {
      ...withoutCredentials(existing),
      authenticated: true,
      lastLogin: 'Just now',
      preferences: userPreferencesService.getUserPreferences(existing.email)
    };
    this.upsertUser(loggedIn);
    this.saveActiveSession(loggedIn);
    // Mirror into Firebase with the just-verified password (best effort).
    await this.syncFirebaseSession(cleanEmail, password);
    return loggedIn;
  }

  /**
   * Explicit set-password step for hashless accounts (audit B4 / H3).
   *
   * Only works when the account has NO stored hash (e.g. created by
   * Google sign-in). It sets the salted hash and does NOT log the user
   * in — they sign in with the new password afterwards. It refuses when
   * a hash already exists (changing an existing password needs a real
   * password-change flow) and when the new password is too short. This
   * is the only way a hashless account gains a local password — login
   * itself never adopts one.
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
    if (users[idx].passwordHash) {
      throw new Error('This account already has a password set.');
    }
    const { hash, salt } = await createPasswordHash(newPassword);
    this.writeLocalCredentials(cleanEmail, hash, salt);
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
   * Register a new Operator account
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
    // Never register over an existing login (account takeover): the old
    // code upserted, which replaced that account's password hash and
    // signed the registrant in as its owner, with their cached company.
    if (this.getRegisteredUsers().some(u => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }
    if (!data.password || data.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
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
      id: `usr_${Date.now()}`,
      email: cleanEmail,
      fullName: data.fullName.trim() || cleanEmail.split('@')[0].toUpperCase(),
      role: data.role || 'Operations Lead',
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanEmail)}`,
      organization: data.organization?.trim() || '',
      businessId: data.businessId,
      authenticated: true,
      biometricsEnabled: biometricsOn,
      lastLogin: 'Just now',
      preferences: savedPrefs
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

    // Store only a salted PBKDF2 hash of the password — never the password itself.
    const { hash, salt } = await createPasswordHash(data.password);
    // Re-check right before writing (another tab/flow may have created it).
    if (this.getRegisteredUsers().some(u => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }
    this.upsertUser(newUser);
    this.writeLocalCredentials(cleanEmail, hash, salt);
    this.saveActiveSession(newUser);
    // Mirror the new account into Firebase Auth (best effort): the phone
    // app needs a Firebase session so its API calls can carry a token
    // once the login gate turns on. A Firebase failure must never fail
    // the local registration — the next login heals it.
    if (data.password) {
      await this.syncFirebaseSession(cleanEmail, data.password);
    }
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

      this.upsertUser(user);
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
