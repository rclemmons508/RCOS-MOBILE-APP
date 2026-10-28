import type { BusinessAccount, TabType, User } from '../types';

/**
 * Dashboard "Get started" checklist — the replacement for the old
 * overlay App Guide tour.
 *
 * Why this exists: the old tour hid the screen it was describing
 * behind a full-screen 80%-black dim plus a card up to 92% of the
 * screen, so a new user could never see what the instructions meant.
 * This checklist never covers anything: it lives on the Dashboard
 * itself, each item is one plain line saying what the section is and
 * where it lives, and tapping an item goes straight to that real
 * screen (and ticks the item off on return).
 *
 * The 12 items mirror the old tour's 12 sections, in the same order,
 * with wording matched to the labels actually on screen right now
 * (bottom nav: Home, Jobs / $, AI Team, Messages, More — the old
 * tour's stale hint for the old tab name is gone, because that tab is Home now).
 */

export interface GetStartedItem {
  id: string;
  /** Screen this item opens. */
  tab: TabType;
  /** What the section is, in plain words. */
  title: string;
  /** Where to find it on your own, using on-screen labels. */
  where: string;
}

export const GET_STARTED_ITEMS: GetStartedItem[] = [
  {
    id: 'welcome',
    tab: 'dashboard',
    title: 'Welcome — your whole business in one app',
    where: 'You are here: Home',
  },
  {
    id: 'dashboard',
    tab: 'dashboard',
    title: 'Home — what needs attention today',
    where: 'Home at the bottom of the screen',
  },
  {
    id: 'jobs',
    tab: 'jobs',
    title: 'Jobs — every job, booked to done',
    where: 'Jobs / $ at the bottom, then Jobs',
  },
  {
    id: 'money',
    tab: 'approvals',
    title: 'Quotes, jobs, invoices — the money loop',
    where: 'Jobs / $ at the bottom, then Approvals',
  },
  {
    id: 'customers',
    tab: 'clients',
    title: 'Customers — everyone you do business with',
    where: 'Jobs / $ at the bottom, then Clients',
  },
  {
    id: 'requests',
    tab: 'requests',
    title: 'Customer requests — bookings and demo requests',
    where: 'Messages at the bottom, then Requests',
  },
  {
    id: 'inbox',
    tab: 'inbox',
    title: 'Messages — one inbox for everything',
    where: 'Messages at the bottom',
  },
  {
    id: 'ai-team',
    tab: 'team',
    title: 'AI Team — your AI employees',
    where: 'AI Team at the bottom',
  },
  {
    id: 'phone',
    tab: 'phone',
    title: 'Phone — calls, answered your way',
    where: 'Messages at the bottom, then Phone',
  },
  {
    id: 'team-chat',
    tab: 'team-chat',
    title: 'Team Chat — chat with your real team',
    where: 'Messages at the bottom, then Team Chat',
  },
  {
    id: 'gmail',
    tab: 'gmail',
    title: 'Email — Gmail inside the app',
    where: 'Messages at the bottom, then Email',
  },
  {
    id: 'settings',
    tab: 'settings',
    title: 'Settings — mission control',
    where: 'More at the bottom, then Settings',
  },
];

type UserIdentity = Partial<Pick<User, 'email'>> | null | undefined;

/**
 * Checklist state is per signed-in user AND business, the same way the
 * old tour flag was keyed: one operator's progress must never leak to
 * the next operator on the same phone. A NEW key (not the old tour
 * flag) so the two features never share semantics.
 */
function checklistKey(user: UserIdentity, business: Pick<BusinessAccount, 'id'> | null | undefined): string {
  const email = (user?.email || '').trim().toLowerCase();
  const biz = (business?.id || '').trim();
  if (email && biz) return `rcos_get_started_${email}_${biz}`;
  if (email) return `rcos_get_started_${email}`;
  if (biz) return `rcos_get_started_${biz}`;
  return 'rcos_get_started_local';
}

function readState(user: UserIdentity, business: Pick<BusinessAccount, 'id'> | null | undefined): { done: string[]; dismissed: boolean } {
  try {
    const raw = localStorage.getItem(checklistKey(user, business));
    if (!raw) return { done: [], dismissed: false };
    const parsed = JSON.parse(raw) as { done?: unknown; dismissed?: unknown };
    return {
      done: Array.isArray(parsed.done) ? parsed.done.filter((d): d is string => typeof d === 'string') : [],
      dismissed: parsed.dismissed === true,
    };
  } catch {
    return { done: [], dismissed: false };
  }
}

function writeState(user: UserIdentity, business: Pick<BusinessAccount, 'id'> | null | undefined, state: { done: string[]; dismissed: boolean }): void {
  try {
    localStorage.setItem(checklistKey(user, business), JSON.stringify(state));
  } catch {
    /* storage unavailable — progress just won't persist */
  }
}

/** Ids of items already ticked off. */
export function getChecklistDone(user: UserIdentity, business: Pick<BusinessAccount, 'id'> | null | undefined): string[] {
  return readState(user, business).done;
}

/** Has the user hidden the whole checklist? */
export function isChecklistDismissed(user: UserIdentity, business: Pick<BusinessAccount, 'id'> | null | undefined): boolean {
  return readState(user, business).dismissed;
}

/** Tick one item off. Never touches anything else. */
export function markChecklistItemDone(user: UserIdentity, business: Pick<BusinessAccount, 'id'> | null | undefined, id: string): void {
  const state = readState(user, business);
  if (!state.done.includes(id)) state.done.push(id);
  writeState(user, business, state);
}

/** Hide the whole checklist. Bring it back from Settings — never permanent. */
export function dismissChecklist(user: UserIdentity, business: Pick<BusinessAccount, 'id'> | null | undefined): void {
  const state = readState(user, business);
  state.dismissed = true;
  writeState(user, business, state);
}

/** Show the checklist again (Settings → Get started checklist). Progress is kept. */
export function showChecklistAgain(user: UserIdentity, business: Pick<BusinessAccount, 'id'> | null | undefined): void {
  const state = readState(user, business);
  state.dismissed = false;
  writeState(user, business, state);
}
