import type { BusinessAccount, BusinessMember } from '../src/types';

// Shared owner/member matchers (moved out of server.ts so the telephony
// router can use the same proof). `caller` is the VERIFIED caller from
// server/auth.ts verifiedCaller(): its `email` is set only when Firebase
// reports email_verified === true (audit #9), so every email match below
// requires a verified email; uid matches do not.
export type Caller = { uid?: string; email?: string | null } | null;

export function businessMemberFor(business: BusinessAccount, caller: Caller): BusinessMember | undefined {
  if (!caller) return undefined;
  const email = (caller.email || '').toLowerCase().trim();
  return (business.members || []).find((m) => (
    (email !== '' && String(m?.email || '').toLowerCase().trim() === email) ||
    (!!caller.uid && !!m?.userId && m.userId === caller.uid)
  ));
}

export function businessOwnerEmails(business: BusinessAccount): string[] {
  return [
    String((business as any).contactEmail || '').toLowerCase().trim(),
    String((business as any).ownerEmail || '').toLowerCase().trim(),
  ].filter(Boolean);
}

export function businessIsMember(business: BusinessAccount, caller: Caller): boolean {
  if (!caller) return false;
  if (businessMemberFor(business, caller)) return true;
  const email = (caller.email || '').toLowerCase().trim();
  if (email !== '' && businessOwnerEmails(business).includes(email)) return true;
  return !!caller.uid && !!business.ownerId && business.ownerId !== 'unassigned_owner' && business.ownerId === caller.uid;
}

export function businessIsOwner(business: BusinessAccount, caller: Caller): boolean {
  if (!caller) return false;
  if (businessMemberFor(business, caller)?.role === 'owner') return true;
  if (!!caller.uid && !!business.ownerId && business.ownerId !== 'unassigned_owner' && business.ownerId === caller.uid) return true;
  const email = (caller.email || '').toLowerCase().trim();
  return email !== '' && businessOwnerEmails(business).includes(email);
}
