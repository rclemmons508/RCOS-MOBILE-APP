import { apiFetch } from '../lib/api';
import { firestoreService } from './firestoreService';
import { biometricService } from './biometricService';
import { auth } from '../lib/firebase';
import { deleteUser } from 'firebase/auth';
import { setCachedAccessToken } from '../lib/gmail';

export interface DeleteAccountResult {
  deletedBusinessIds: string[];
  alreadyDeleted: boolean;
  /** Business ids whose Firestore records could not be fully removed. */
  firestoreFailures: string[];
}

/** True when Firebase refused because the sign-in is too old. */
export function isReauthRequired(err: unknown): boolean {
  return (err as any)?.code === 'auth/requires-recent-login';
}

/**
 * Delete the owner's account and all data, in this order:
 *   1. Server — business + all server records + Gmail tokens.
 *      If this step fails, NOTHING local is touched.
 *   2. Firestore — business docs + subcollections. Best effort: failures
 *      are collected and reported, never faked as deleted.
 *   3. Firebase Auth user. If Firebase demands a fresh sign-in, this
 *      throws (isReauthRequired) and local data is left alone so the
 *      owner can log in again and retry — the server step is idempotent.
 *   4. Local data — biometrics, cached tokens, ALL local/session storage.
 * The caller signs the user out (reload to the login screen) after this
 * returns. Never call this without the owner typing DELETE first.
 */
export async function deleteAccount(businessId: string): Promise<DeleteAccountResult> {
  // 1. Server first. Throws on failure — nothing local is touched.
  let deletedBusinessIds: string[] = [];
  let alreadyDeleted = false;
  if (businessId) {
    const res = await apiFetch<{ ok: boolean; deletedBusinessIds?: string[]; alreadyDeleted?: boolean }>(
      `/api/business/${encodeURIComponent(businessId)}/delete-account`,
      { method: 'POST', body: JSON.stringify({ confirm: 'DELETE' }) }
    );
    deletedBusinessIds = res.deletedBusinessIds || [];
    alreadyDeleted = !!res.alreadyDeleted;
  } else {
    alreadyDeleted = true; // no business configured — nothing server-side to remove
  }

  // 2. Firestore (best effort, failures reported).
  const firestoreFailures: string[] = [];
  for (const id of deletedBusinessIds) {
    try {
      await firestoreService.deleteBusinessData(id);
    } catch (e) {
      console.warn(`[delete-account] Firestore delete failed for business ${id}:`, e);
      firestoreFailures.push(id);
    }
  }

  // 3. Firebase Auth user.
  const fbUser = auth.currentUser;
  if (fbUser) {
    await deleteUser(fbUser);
  }

  // 4. Local data.
  wipeLocalData();

  return { deletedBusinessIds, alreadyDeleted, firestoreFailures };
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
