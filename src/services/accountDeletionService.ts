import { apiFetch } from '../lib/api';
import { BusinessAccount } from '../types';
import { firestoreService } from './firestoreService';
import { biometricService } from './biometricService';
import { authService } from './authService';
import { auth } from '../lib/firebase';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, signInWithEmailAndPassword } from 'firebase/auth';
import { setCachedAccessToken } from '../lib/gmail';
import { clearBusinessStateForUser } from '../utils/businessStorage';

export interface DeleteAccountResult {
  deletedBusinessIds: string[];
  alreadyDeleted: boolean;
  /** True when the deleter was a team member: they left the team instead of wiping the company. */
  leftTeam?: boolean;
  /**
   * Set when the Firebase sign-in could not be removed (e.g. no Firebase
   * session to delete from, or the Firebase password drifted). The
   * business data and local login are still deleted — but the Firebase
   * account for this email may still exist, and the UI must show this
   * note. Never silently claim the Firebase login is gone when it
   * might not be.
   */
  firebaseDeleteNote?: string;
}

/** True when Firebase refused because the sign-in is too old. */
export function isReauthRequired(err: unknown): boolean {
  return (err as any)?.code === 'auth/requires-recent-login';
}

/**
 * Delete the owner's account and all data, in this order.
 * Team members get a different path: deleting THEIR account removes them
 * from the team + deletes their login, but the company's business and
 * its data stay — they belong to the company, not the member.
 *   0. Password confirmation — the typed password must match the saved
 *      login password (local email/password accounts), or Firebase is
 *      re-authenticated with it (Firebase email/password accounts).
 *      Google-only accounts need no password; their Firebase user is
 *      deleted directly in step 3.
 *   1. Server — business + all server records + Gmail tokens. The server
 *      must confirm it actually deleted the business (or that it was
 *      already gone); a zero-row "success" is treated as failure.
 *   2. Firestore — business docs + subcollections, including the
 *      requested business id even when the server says it was already
 *      gone, so a retry after a Firestore failure still finishes the job.
 *      Any failure throws: no success screen, no local wipe.
 *   3. Firebase Auth user. Best effort, never silent: when no Firebase
 *      session is signed in, sign in with the just-verified password and
 *      delete the Firebase account too; a failure is recorded in the
 *      result (shown to the user) and the delete still completes.
 *      Google-only accounts need no password; their Firebase user is
 *      deleted directly in step 3.
 *   4. Saved login record — removed from this device and verified gone.
 *   5. Local data — owner path: biometrics, cached tokens, ALL local/session
 *      storage (the business is gone). Member path: only the deleted user's
 *      own traces (their login, their fingerprint link when it is theirs,
 *      their session) — the company's business cache and other users'
 *      data stay.
 * The caller signs the user out (reload to the login screen) after this
 * returns. Never call this without the owner typing DELETE first.
 *
 * Why this is strict: the old flow showed "deleted" even when the login
 * account survived — email/password login never checked a password and
 * silently re-created the account on the next sign-in. Every step here
 * is verified; any failure throws and local data is left untouched so
 * the owner can retry. Partial states are reported honestly (e.g. the
 * server data is gone but the login remains) instead of claiming success.
 */
export async function deleteAccount(
  businessId: string,
  opts?: { password?: string }
): Promise<DeleteAccountResult> {
  const sessionUser = authService.getActiveSession();
  if (!sessionUser?.email) {
    throw new Error('No signed-in account found. Please log in again, then try deleting.');
  }
  const email = sessionUser.email;
  const password = opts?.password || '';

  let fbUser = auth.currentUser;
  let firebaseDeleteNote: string | undefined;
  const hasPasswordProvider = !!fbUser?.providerData.some((p) => p.providerId === 'password');

  // 0. Password confirmation. Nothing is deleted until this passes.
  if (fbUser && hasPasswordProvider) {
    // Firebase email/password account: re-authenticate with the typed password.
    if (!password) {
      throw new Error('Please type your account password to confirm deletion.');
    }
    if (!fbUser.email) {
      throw new Error('Your sign-in has no email attached. Please log out, log back in, then try deleting.');
    }
    try {
      await reauthenticateWithCredential(fbUser, EmailAuthProvider.credential(fbUser.email, password));
    } catch (e: any) {
      const code = String(e?.code || '');
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        throw new Error("That password didn't match. Nothing was deleted.");
      }
      throw new Error('Could not confirm your password. Nothing was deleted.');
    }
  } else if (!fbUser) {
    // Local email/password account: the typed password must match the saved one.
    if (!password) {
      throw new Error('Please type your account password to confirm deletion.');
    }
    const ok = await authService.verifyPassword(email, password);
    if (!ok) {
      throw new Error("That password didn't match. Nothing was deleted. If this is an older account, please log out, log back in with your password once, then try deleting again.");
    }
  }
  // Google-only Firebase accounts need no password; step 3 deletes the Firebase user directly.

  // Ownership check: deleting ONE account must never wipe the whole
  // business. Wipe ONLY on positive proof that the signed-in user is the
  // owner; everyone else takes the member path (leave the team + delete
  // only their own login), even when the roster is empty. The old code
  // treated the requester as the owner whenever the roster was empty
  // and no owner identity existed — but the roster is empty on restored
  // businesses too, so deleting a test account wiped the owner's
  // business and every account in it. There is NO "no identity, assume
  // owner" fallback: an unprovable owner takes the member path, and the
  // business survives (left orphaned, not wiped).
  // Proof = the signed-in email matches an owner identity on the
  // business record (owner roster email, contact email, owner email),
  // OR the business's recorded owner id matches the signed-in user.
  // Ownership: a FULL wipe happens ONLY on positive proof that the
  // signed-in user owns an existing business. The default is the member
  // path (targeted wipe). A missing businessId means there is no
  // business to wipe — the account is just a login — so the member path
  // runs. The old code defaulted to the owner path, so deleting a test
  // account with no business linked did a FULL device wipe. That is the
  // hole that kept wiping the whole phone.
  let isOwner = false;
  if (businessId) {
    try {
      const biz = await apiFetch<BusinessAccount>(`/api/business/${encodeURIComponent(businessId)}`);
      const members = biz?.members || [];
      const me = email.toLowerCase();
      const ownerEmails = Array.from(new Set([
        (members.find(m => m.role === 'owner')?.email || '').toLowerCase(),
        (biz?.contactEmail || '').toLowerCase(),
        ((biz as unknown as { ownerEmail?: string })?.ownerEmail || '').toLowerCase(),
      ].filter(Boolean)));
      isOwner = ownerEmails.includes(me)
        || (!!biz?.ownerId && biz.ownerId !== 'unassigned_owner' && !!sessionUser?.id && biz.ownerId === sessionUser.id);
    } catch (e: any) {
      // Fail SAFE: a fetch failure must never default to the owner path
      // (which wipes). Only a 404 — the business is genuinely gone, and
      // ownership is unproven — proceeds to the member path (targeted
      // wipe only); anything else (offline, timeout, server error)
      // refuses to delete rather than risk wiping a business we could
      // not verify.
      if (e?.status === 404) {
        // Business already gone, ownership unproven: member path.
      } else {
        throw new Error('Could not verify who owns this business (connection problem). Nothing was deleted. Please try again when you are back online.');
      }
    }
  }
  // Member path = not the proven owner (includes: no business linked,
  // business already gone, or proven non-owner). Only the member path's
  // targeted wipe runs for these.
  const leftTeam = !isOwner;

  // 1. Server first. Throws on failure — nothing local is touched.
  let deletedBusinessIds: string[] = [];
  let alreadyDeleted = false;
  let businessGone = false; // true only when the owner path confirmed the business is gone
  if (leftTeam) {
    // Member path — the business and its data stay for the company.
    // Leave the team when a business is linked. Best-effort: if the
    // roster does not list this user (empty roster on a restored
    // business, already left, or no business at all), the server
    // answers 403/404 and there is nothing to leave — the login
    // deletion below still runs. Any other leave failure is also
    // non-fatal: the business data is untouched either way, and a
    // stale roster entry can be removed by the owner.
    if (businessId) {
      try {
        await apiFetch(`/api/business/${encodeURIComponent(businessId)}/team/leave`, {
          method: 'POST',
          headers: { 'X-User-Email': email },
          body: JSON.stringify({ requesterEmail: email })
        });
      } catch { /* already not on the team, or roster cleanup failed — continue */ }
    }
    alreadyDeleted = true; // nothing business-side left to remove for this account
  } else {
    // Owner path — only reachable with proven ownership of a business.
    const res = await apiFetch<{ ok: boolean; deletedBusinessIds?: string[]; alreadyDeleted?: boolean }>(
      `/api/business/${encodeURIComponent(businessId)}/delete-account`,
      {
        method: 'POST',
        headers: { 'X-User-Email': email },
        body: JSON.stringify({ confirm: 'DELETE', requesterEmail: email, requesterUserId: sessionUser.id }),
      }
    );
    deletedBusinessIds = res.deletedBusinessIds || [];
    alreadyDeleted = !!res.alreadyDeleted;
    if (!alreadyDeleted && !deletedBusinessIds.includes(businessId)) {
      throw new Error('The server could not find this business to delete it. Nothing was deleted.');
    }
    businessGone = true;
  }

  // The fingerprint link for the deleted account is stale the moment the
  // server deletion (or team leave) succeeds — clear it now, not only at
  // the end, so a failure in a later step can never leave a fingerprint
  // that signs back into a deleted account. Only touches the enrollment
  // when it belongs to the deleted email; another user's link stays.
  unenrollBiometricsIfMine(email);

  // 2. Firestore — strict: any failure throws, no success screen, no local wipe.
  // Always include the requested business id (not just the ids the server
  // reported) so a retry after a Firestore failure still removes the rest.
  const firestoreTargets = Array.from(new Set([businessId, ...deletedBusinessIds].filter(Boolean)));
  // Members never touch the company's Firestore records.
  for (const id of leftTeam ? [] : firestoreTargets) {
    try {
      await firestoreService.deleteBusinessData(id);
    } catch (e) {
      throw new Error('Some cloud records could not be removed. Your business data on the server was already deleted — please try deleting again to finish removing the rest.');
    }
  }

  // 3. Firebase Auth user. Best effort, but never silent: a failure is
  // recorded in the result so the UI reports it ("no fake deletions").
  // The delete itself still completes — the business data and local
  // login are gone either way.
  // - A Firebase session exists: delete it. A requires-recent-login
  //   failure still throws (nothing local is wiped yet, so the owner can
  //   re-log-in and retry cleanly) — the one retryable case.
  // - No Firebase session: a Firebase account may still exist for this
  //   email (created on another device, or before this device ever
  //   signed into Firebase). Sign in with the just-verified password
  //   and delete it. If sign-in fails because no Firebase account
  //   exists, there is nothing to delete. Any other sign-in failure
  //   (drifted password, offline) is recorded, not hidden.
  if (!fbUser && password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      fbUser = cred.user;
    } catch (e: any) {
      const code = String(e?.code || '');
      if (code === 'auth/user-not-found') {
        fbUser = null; // No Firebase account — nothing to delete.
      } else {
        // invalid-credential (ambiguous: no account, or drifted
        // password), network, rate-limit, anything else: cannot reach
        // the Firebase account to delete it. Record it; the delete
        // continues. The note says "may still exist" because with
        // enumeration protection we cannot tell the two apart.
        firebaseDeleteNote = 'Your business data and local login were deleted, but your Firebase sign-in could not be removed (could not sign into Firebase to delete it). The Firebase account for this email may still exist.';
        fbUser = null;
      }
    }
  }
  if (fbUser) {
    try {
      await deleteUser(fbUser);
    } catch (e: any) {
      if (isReauthRequired(e)) {
        throw new Error('Your business data was deleted, but your login could not be removed because your sign-in is too old. Please log out, log back in, then delete again to remove the login.');
      }
      firebaseDeleteNote = 'Your business data and local login were deleted, but your Firebase sign-in could not be removed. The Firebase account for this email may still exist.';
    }
    if (auth.currentUser && !firebaseDeleteNote) {
      firebaseDeleteNote = 'Your business data and local login were deleted, but your Firebase sign-in could not be removed. The Firebase account for this email may still exist.';
    }
  }

  // 4. Saved login record — remove and verify it is gone. This is what
  // stops the deleted account from coming back at the next sign-in.
  const removed = authService.removeRegisteredUser(email);
  if (!removed) {
    throw new Error('Your business data and login were deleted, but the saved login on this phone could not be removed. Please try deleting again.');
  }

  // 5. Local data — only now that every step is verified. Full wipe
  // ONLY when the owner path confirmed the business is gone; every
  // other case (member, no business linked, business already gone
  // without proof) removes only the deleted user's own traces.
  if (!leftTeam && businessGone) {
    wipeLocalData();
  } else {
    wipeLocalDataForUser(email);
  }

  return { deletedBusinessIds, alreadyDeleted, leftTeam, firebaseDeleteNote };
}

/** Remove the fingerprint enrollment, but only when it belongs to the
 * given email. The enrollment on a shared device may belong to someone
 * else — never clear another user's fingerprint link. */
export function unenrollBiometricsIfMine(email: string): void {
  try {
    const enrolled = biometricService.getEnrolledInfo();
    if (enrolled.enrolled && (enrolled.userEmail || '').toLowerCase() === email.toLowerCase()) {
      biometricService.unenrollBiometrics();
    }
  } catch { /* already clear */ }
}

/**
 * Remove only one user's own traces from this device: their fingerprint
 * link (when it is theirs), their session + their own per-user company
 * cache + setup flag, their cached Gmail token, and session storage.
 * The company's business record and other users' data stay — a member
 * leaving must never wipe the device the way a business deletion does.
 */
export function wipeLocalDataForUser(email: string): void {
  unenrollBiometricsIfMine(email);
  try {
    setCachedAccessToken(null);
  } catch { /* noop */ }
  // Only THIS user's own traces go: their session, plus their own
  // per-user company cache + setup flag. The company's record and every
  // other user's cache stay — the old code removed the SHARED company
  // cache, which left the device with no company and the next load fell
  // back to the first company on the server.
  for (const key of ['rcos_active_session', 'rcos_auth_user']) {
    try {
      localStorage.removeItem(key);
    } catch { /* storage unavailable */ }
  }
  clearBusinessStateForUser({ email });
  try {
    sessionStorage.clear();
  } catch { /* storage unavailable */ }
}

/** Remove biometrics, cached tokens, and ALL local/session storage. */
export function wipeLocalData(): void {
  try {
    biometricService.unenrollBiometrics();
  } catch { /* already clear */ }
  try {
    setCachedAccessToken(null);
  } catch { /* noop */ }
  try {
    localStorage.clear();
  } catch { /* storage unavailable */ }
  try {
    sessionStorage.clear();
  } catch { /* storage unavailable */ }
}
