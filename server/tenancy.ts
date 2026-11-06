import type { BusinessAccount, BusinessMember } from '../src/types';
import { db } from './db';

// The operator's own business — where website demo leads (and, when no
// TWILIO_BUSINESS_ID is set, phone quotes) belong (audit #11).
// OPERATOR_BUSINESS_ID when set AND that business exists; otherwise the
// only business on a single-tenant server; otherwise undefined (never
// "whichever business happens to be first").
export function operatorBusinessId(): string | undefined {
  const fromEnv = (process.env.OPERATOR_BUSINESS_ID || '').trim();
  if (fromEnv) return db.getBusiness(fromEnv) ? fromEnv : undefined;
  const all = db.getAllBusinesses();
  return all.length === 1 ? all[0].id : undefined;
}

// True only for an EXPLICITLY configured operator business that exists.
// Queued leads are flushed only into this — never into a business just
// because it is the first/only one (a stranger's new business, audit #11).
export function explicitOperatorBusinessId(): string | undefined {
  const fromEnv = (process.env.OPERATOR_BUSINESS_ID || '').trim();
  return fromEnv && db.getBusiness(fromEnv) ? fromEnv : undefined;
}

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
