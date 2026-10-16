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

  // Ownership check (Oct 16, 2026): deleting ONE account must never wipe
  // the whole business. The old code treated the requester as the owner
  // whenever the roster was empty — but the roster is empty on restored
  // businesses, so deleting a test account wiped the owner's business and
  // every account in it. The rule now: wipe ONLY on positive proof that
  // the signed-in user is the owner; everyone else takes the member path
  // (leave the team + delete only their own login), even when the roster
  // is empty. Proof = the signed-in email matches an owner identity on
  // the business record (owner roster email, contact email). The one
  // exception: a legacy record with no owner identity at all AND no other
  // roster members — there is nobody else to protect, so it wipes.
  let isTeamMember = false;
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
      const matchedOwner = ownerEmails.length > 0 && ownerEmails.includes(me);
      const otherMembers = members.filter(m => (m.email || '').toLowerCase() !== me);
      const isOwner = matchedOwner || (otherMembers.length === 0 && ownerEmails.length === 0);
      isTeamMember = !isOwner;
    } catch {
      // Business fetch failed (offline / already gone). The owner path
      // below treats a missing business as already deleted.
    }
  }

  // 1. Server first. Throws on failure — nothing local is touched.
  let deletedBusinessIds: string[] = [];
  let alreadyDeleted = false;
  let leftTeam = false;
  if (isTeamMember) {
    // Leave the team — the business and its data stay for the company.
    // Best-effort: if the roster does not list this user (empty roster on
    // a restored business, already left), the server answers 403/404 and
    // there is nothing to leave — the login deletion below still runs.
    // Any other leave failure is also non-fatal: the business data is
    // untouched either way, and a stale roster entry can be removed by
    // the owner.
    try {
      await apiFetch(`/api/business/${encodeURIComponent(businessId)}/team/leave`, {
        method: 'POST',
        headers: { 'X-User-Email': email },
        body: JSON.stringify({ requesterEmail: email })
      });
    } catch { /* already not on the team, or roster cleanup failed — continue */ }
    leftTeam = true;
    alreadyDeleted = true; // nothing business-side left to remove for this account
  } else if (businessId) {
    const res = await apiFetch<{ ok: boolean; deletedBusinessIds?: string[]; alreadyDeleted?: boolean }>(
      `/api/business/${encodeURIComponent(businessId)}/delete-account`,
      {
        method: 'POST',
        headers: { 'X-User-Email': email },
        body: JSON.stringify({ confirm: 'DELETE', requesterEmail: email }),
      }
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
