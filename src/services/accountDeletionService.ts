import { apiFetch } from '../lib/api';
import { BusinessAccount } from '../types';
import { firestoreService } from './firestoreService';
import { biometricService } from './biometricService';
import { authService } from './authService';
import { auth } from '../lib/firebase';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { setCachedAccessToken } from '../lib/gmail';

export interface DeleteAccountResult {
  deletedBusinessIds: string[];
  alreadyDeleted: boolean;
  /** True when the deleter was a team member: they left the team instead of wiping the company. */
  leftTeam?: boolean;
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
 *   3. Firebase Auth user, only when one is signed in.
 *   4. Saved login record — removed from this device and verified gone.
 *   5. Local data — biometrics, cached tokens, ALL local/session storage.
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

  const fbUser = auth.currentUser;
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

  // Membership check: a team member deletes THEIR account, not the whole
  // company. Decided here from the server's roster (not from local state,
  // which could be stale) so a member can never wipe the business by
  // reaching the owner path below.
  let isTeamMember = false;
  if (businessId) {
    try {
      const biz = await apiFetch<BusinessAccount>(`/api/business/${encodeURIComponent(businessId)}`);
      const members = biz?.members || [];
      if (members.length > 0) {
        const me = members.find(m => m.email.toLowerCase() === email.toLowerCase());
        isTeamMember = !!me && me.role === 'member';
      }
    } catch {
      // Business fetch failed (offline / already gone). Fall through to
      // the owner path, which treats a missing business as already deleted.
    }
  }

  // 1. Server first. Throws on failure — nothing local is touched.
  let deletedBusinessIds: string[] = [];
  let alreadyDeleted = false;
  let leftTeam = false;
  if (isTeamMember) {
    // Leave the team — the business and its data stay for the company.
    await apiFetch(`/api/business/${encodeURIComponent(businessId)}/team/leave`, {
      method: 'POST',
      headers: { 'X-User-Email': email },
      body: JSON.stringify({ requesterEmail: email })
    });
    leftTeam = true;
    alreadyDeleted = true; // nothing business-side left to remove for this account
  } else if (businessId) {
    const res = await apiFetch<{ ok: boolean; deletedBusinessIds?: string[]; alreadyDeleted?: boolean }>(
      `/api/business/${encodeURIComponent(businessId)}/delete-account`,
      { method: 'POST', body: JSON.stringify({ confirm: 'DELETE' }) }
    );
    deletedBusinessIds = res.deletedBusinessIds || [];
    alreadyDeleted = !!res.alreadyDeleted;
    if (!alreadyDeleted && !deletedBusinessIds.includes(businessId)) {
      throw new Error('The server could not find this business to delete it. Nothing was deleted.');
    }
  } else {
    alreadyDeleted = true; // no business configured — nothing server-side to remove
  }

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

  // 3. Firebase Auth user, if one is signed in.
  if (fbUser) {
    try {
      await deleteUser(fbUser);
    } catch (e: any) {
      if (isReauthRequired(e)) {
        throw new Error('Your business data was deleted, but your login could not be removed because your sign-in is too old. Please log out, log back in, then delete again to remove the login.');
      }
      throw new Error('Your business data was deleted, but your login could not be removed. Please log out, log back in, then delete again to remove the login.');
    }
    if (auth.currentUser) {
      throw new Error('Your business data was deleted, but your login could not be removed. Please log out, log back in, then delete again to remove the login.');
    }
  }

  // 4. Saved login record — remove and verify it is gone. This is what
  // stops the deleted account from coming back at the next sign-in.
  const removed = authService.removeRegisteredUser(email);
  if (!removed) {
    throw new Error('Your business data and login were deleted, but the saved login on this phone could not be removed. Please try deleting again.');
  }

  // 5. Local data — only now that every step is verified.
  wipeLocalData();

  return { deletedBusinessIds, alreadyDeleted, leftTeam };
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
