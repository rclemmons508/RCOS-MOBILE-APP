import type { BusinessAccount, User } from '../types';

/**
 * Company data on this device is scoped per signed-in user.
 *
 * BUG (Oct 2026): the configured business and the onboarding flag used to
 * live under two GLOBAL localStorage keys (`rcos_configured_business`,
 * `rcos_onboarding_completed`). Logging out never cleared them, and the
 * login handler never evicted them when the next user had no company.
 * So registering a second company on the same phone inherited the first
 * company's cached business — the dashboard, industry presets, and
 * services all came from the previous company — and onboarding could
 * even re-use the previous company's business id, overwriting its
 * server record with mixed data.
 *
 * FIX: the cache and the flag are keyed per user (by login email, the
 * same identity the preferences service uses). A different user can
 * never read the previous user's cached company. Logging out clears
 * the ACTIVE business state; the per-user cache stays on disk for that
 * user's own return (a business with no server identity — empty roster,
 * unassigned owner — is only recoverable from its owner's cache).
 *
 * The legacy global keys are never read as authoritative again. On
 * first read, a legacy cached business is adopted into the caller's
 * per-user key ONLY when it belongs to them (same ownership test the
 * server resolution uses); otherwise it is ignored and left inert.
 */

const LEGACY_BUSINESS_KEY = 'rcos_configured_business';
const LEGACY_ONBOARDING_KEY = 'rcos_onboarding_completed';

type UserIdentity = Partial<Pick<User, 'email' | 'id' | 'businessId'>> | null | undefined;

function userKey(prefix: string, user: UserIdentity): string | null {
  const clean = (user?.email || '').trim().toLowerCase();
  if (!clean) return null;
  return `${prefix}_${clean}`;
}

/** Does this business belong to this user? (Same tests as resolveBusinessForUser.) */
export function businessBelongsToUser(
  biz: BusinessAccount | null | undefined,
  user: UserIdentity
): boolean {
  if (!biz || !user) return false;
  const email = (user.email || '').trim().toLowerCase();
  if (user.businessId && biz.id === user.businessId) return true;
  if (email && (biz.members || []).some((m) => (m.email || '').toLowerCase() === email)) return true;
  if (biz.ownerId && biz.ownerId !== 'unassigned_owner' && user.id && biz.ownerId === user.id) return true;
  if (email && biz.contactEmail && biz.contactEmail.toLowerCase() === email) return true;
  return false;
}

/** The cached copy drops activeEmployees, exactly like the old global cache did. */
function toCachedBusiness(business: BusinessAccount): Omit<BusinessAccount, 'activeEmployees'> {
  const { activeEmployees: _activeEmployees, ...safeBusiness } = business;
  return safeBusiness;
}

function readLegacyBusiness(): BusinessAccount | null {
  try {
    const raw = localStorage.getItem(LEGACY_BUSINESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BusinessAccount | null;
    return parsed && typeof parsed === 'object' && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

/** Adopt the legacy global cache into this user's per-user key when it is theirs. */
function migrateLegacyCache(user: UserIdentity): BusinessAccount | null {
  const key = userKey(LEGACY_BUSINESS_KEY, user);
  if (!key) return null;
  const legacy = readLegacyBusiness();
  if (!legacy) return null;
  if (!businessBelongsToUser(legacy, user)) return null; // somebody else's company — ignore it
  try {
    localStorage.setItem(key, JSON.stringify(toCachedBusiness(legacy)));
    // Migrate the onboarding flag with the business it belongs to.
    if (localStorage.getItem(LEGACY_ONBOARDING_KEY) === 'true') {
      localStorage.setItem(userKey(LEGACY_ONBOARDING_KEY, user)!, 'true');
    }
    localStorage.removeItem(LEGACY_BUSINESS_KEY);
    localStorage.removeItem(LEGACY_ONBOARDING_KEY);
  } catch {
    /* storage unavailable — the legacy copy stays, still inert */
  }
  return legacy;
}

/** This user's cached company, or null. Never returns another user's company. */
export function getCachedBusiness(user: UserIdentity): BusinessAccount | null {
  const key = userKey(LEGACY_BUSINESS_KEY, user);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as BusinessAccount | null;
      if (parsed && typeof parsed === 'object' && parsed.id) return parsed;
    }
  } catch {
    /* corrupted cache — fall through to migration, then null */
  }
  return migrateLegacyCache(user);
}

export function setCachedBusiness(user: UserIdentity, business: BusinessAccount): void {
  const key = userKey(LEGACY_BUSINESS_KEY, user);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(toCachedBusiness(business)));
  } catch {
    /* storage unavailable */
  }
}

export function clearCachedBusiness(user: UserIdentity): void {
  const key = userKey(LEGACY_BUSINESS_KEY, user);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/** Whether THIS user finished company setup. Never another user's flag. */
export function getOnboardingCompleted(user: UserIdentity): boolean {
  const key = userKey(LEGACY_ONBOARDING_KEY, user);
  if (!key) return false;
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingCompleted(user: UserIdentity): void {
  const key = userKey(LEGACY_ONBOARDING_KEY, user);
  if (!key) return;
  try {
    localStorage.setItem(key, 'true');
  } catch {
    /* storage unavailable */
  }
}

export function clearOnboardingCompleted(user: UserIdentity): void {
  const key = userKey(LEGACY_ONBOARDING_KEY, user);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/** Clear this user's own cached company + setup flag (their traces only). */
export function clearBusinessStateForUser(user: UserIdentity): void {
  clearCachedBusiness(user);
  clearOnboardingCompleted(user);
}
