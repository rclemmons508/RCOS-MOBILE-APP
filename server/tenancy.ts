import type { BusinessAccount, BusinessMember } from '../src/types';
import { db } from './db';

// The operator's own business — where website demo leads (and, when no
// OPERATOR_BUSINESS_ID is set, phone quote approvals) belong (audit #11).
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

// Adopt an ownerless business record (POST /api/businesses, gate ON
// only). Company setup used to create the server record with no owner
// linkage at all (no ownerId, no members, no contactEmail), so its owner
// could never prove ownership of it and the client restore kept 409ing
// forever — a stuck record no one could repair. A caller may adopt such
// a record ONLY as themselves: the existing record must have no owner
// identity anywhere (no ownerId, no members, no contactEmail, no
// ownerEmail), and the incoming body must name the caller's own verified
// token uid as owner — body ownerId, or an owner member with that userId.
// A record with ANY owner identity is never adoptable and still 409s.
// Nothing is displaced: the record had no owner to take it from.
export function canAdoptOwnerlessBusiness(
  existing: BusinessAccount,
  callerUid: string | undefined | null,
  bodyOwnerId: unknown,
  bodyMembers: unknown,
): boolean {
  if (!callerUid) return false;
  const ownerId = (existing as any).ownerId;
  if (typeof ownerId === 'string' && ownerId !== '' && ownerId !== 'unassigned_owner') return false;
  if (Array.isArray(existing.members) && existing.members.length > 0) return false;
  if (String((existing as any).contactEmail || '').trim() !== '') return false;
  if (String((existing as any).ownerEmail || '').trim() !== '') return false;
  // The existing record is ownerless. The caller may only adopt it as
  // themselves — their own verified token uid, never someone else's.
  if (typeof bodyOwnerId === 'string' && bodyOwnerId === callerUid) return true;
  if (Array.isArray(bodyMembers)) {
    return bodyMembers.some((m: any) => m && m.role === 'owner' && m.userId === callerUid);
  }
  return false;
}
