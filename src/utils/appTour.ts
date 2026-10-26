import type { BusinessAccount, User } from '../types';

/**
 * App walkthrough ("App Guide") completion flag.
 *
 * Keyed per signed-in user AND business, the same way the onboarding
 * flag is keyed per user (see businessStorage.ts): one operator's tour
 * state must never leak to the next operator on the same phone. The
 * flag only ever stops the tour AUTO-opening — opening the guide from
 * Settings always works, flag or no flag.
 */

type UserIdentity = Partial<Pick<User, 'email'>> | null | undefined;

function tourKey(user: UserIdentity, business: BusinessAccount | null | undefined): string | null {
  const email = (user?.email || '').trim().toLowerCase();
  if (!email) return null;
  const biz = (business?.id || '').trim();
  return biz ? `rcos_app_tour_completed_${email}_${biz}` : `rcos_app_tour_completed_${email}`;
}

/** Has this user, for this business, finished or skipped the tour? */
export function isTourCompleted(user: UserIdentity, business: BusinessAccount | null | undefined): boolean {
  const key = tourKey(user, business);
  if (!key) return false;
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/** Record that this user, for this business, finished or skipped the tour. */
export function markTourCompleted(user: UserIdentity, business: BusinessAccount | null | undefined): void {
  const key = tourKey(user, business);
  if (!key) return;
  try {
    localStorage.setItem(key, 'true');
  } catch {
    /* storage unavailable — the tour may auto-open again next launch */
  }
}
