/**
 * Push notifications for live receptionist calls (FCM).
 *
 * When the LiveKit webhook marks a call ANSWERED (the receptionist agent
 * joined the room), the server alerts the business owner's phone with a
 * high-priority FCM notification — tapping it opens the live call in the
 * app. Until this existed, the owner had to stare at the Calls screen to
 * know a call happened.
 *
 * Where device tokens live: Cloud Firestore, collection `pushTokens`
 * (one document per token, id = sha256 of the token). Firestore survives
 * Railway redeploys; the server file store does not, so tokens must never
 * live there. The Admin SDK bypasses Firestore rules; clients can never
 * reach this collection directly — firestore.rules denies it explicitly,
 * and the app only registers its token through the authenticated
 * POST /api/push/register endpoint.
 *
 * Owner-only: a token is alerted only when its user is the business
 * owner (same owner definition the tenancy module uses). Any team member
 * may register a token; only the owner's tokens ever get a call alert.
 *
 * The webhook must never fail because of push: every function here
 * catches its own errors and returns a status string. The webhook
 * handler calls notifyCallAnswered fire-and-forget and answers 200
 * regardless.
 *
 * What this deliberately does NOT do:
 * - No business is attributed at webhook time: the event carries no
 *   business id (same limit as the live-call registry). With exactly one
 *   business on the server, that business is the target. With several,
 *   the called number is matched against the businesses' phone numbers;
 *   no match means no alert (logged) rather than alerting the wrong
 *   owner.
 * - One alert per call: a room is marked notified only after a
 *   successful send, so a retried webhook event never buzzes the owner
 *   twice — and a failed attempt (no business, no tokens, send error)
 *   leaves the room unmarked, so a retry can still alert once the
 *   problem clears.
 * - Business lookup reads the server's local file store first and falls
 *   back to the durable business records in the named Firestore
 *   database (the file store is wiped on every redeploy, so a call
 *   that arrives before the app re-syncs would otherwise match no
 *   business at all). Device tokens stay in the (default) database —
 *   only businesses live in the named one.
 * - No Admin SDK (local dev, no service account) means no push at all:
 *   registration answers 503 and the webhook logs and moves on.
 */

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'node:crypto';
import { db } from './db';
import { businessIsOwner } from './tenancy';
import type { LiveCall } from './liveCalls';
import type { BusinessAccount } from '../src/types';

/** Android notification channel for live-call alerts (created by the app at registration). */
export const CALLS_CHANNEL_ID = 'rcos_calls';

/** The named Firestore database that holds the durable business records.
 *  The server's bare admin.firestore() hits the (default) database,
 *  which has NO businesses collection — businesses live ONLY here. */
const NAMED_FIRESTORE_DB = 'ai-studio-rcosmobileapp-c0c46f2b-8d0f-43b8-978d-70fb08614967';

const PUSH_TOKEN_COLLECTION = 'pushTokens';

/** A notified room is forgotten after this long, so the dedupe set cannot grow forever. */
const NOTIFIED_TTL_MS = 3 * 60 * 60 * 1000;

export interface PushTokenRecord {
  token: string;
  businessId: string;
  userId: string;
  email: string;
  platform: string;
  updatedAt: string;
}

/** Rooms already alerted for, with the time they were sent. */
const notifiedRooms = new Map<string, number>();

function pruneNotified(now = Date.now()): void {
  for (const [roomName, at] of notifiedRooms) {
    if (now - at > NOTIFIED_TTL_MS) notifiedRooms.delete(roomName);
  }
}

/** The Firestore client when the Admin SDK is initialized, else null. */
function getPushDb(): admin.firestore.Firestore | null {
  try {
    return admin.apps.length > 0 ? admin.firestore() : null;
  } catch {
    return null;
  }
}

/** True when Firebase Admin is initialized and push can be sent at all. */
export function isPushAvailable(): boolean {
  try {
    return admin.apps.length > 0;
  } catch {
    return false;
  }
}

/** The named Firestore database client (business records live ONLY there), else null. */
function getNamedDb(): admin.firestore.Firestore | null {
  try {
    return admin.apps.length > 0 ? getFirestore(admin.app(), NAMED_FIRESTORE_DB) : null;
  } catch {
    return null;
  }
}

/** Every business record from the durable named Firestore database.
 *  Empty when Admin is unavailable or the read fails — never throws. */
export async function getFirestoreBusinesses(): Promise<BusinessAccount[]> {
  const store = getNamedDb();
  if (!store) return [];
  try {
    const snap = await store.collection('businesses').get();
    return snap.docs.map((doc) => ({ ...(doc.data() as Partial<BusinessAccount>), id: doc.id }) as BusinessAccount);
  } catch (err: any) {
    console.error('[push] Firestore business lookup failed:', err?.message || err);
    return [];
  }
}

function tokenDocId(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Register (or refresh) one device token for a business. False when push is unavailable. */
export async function registerPushToken(input: {
  businessId: string;
  userId: string;
  email: string;
  token: string;
  platform: string;
}): Promise<boolean> {
  const store = getPushDb();
  if (!store) {
    console.warn('[push] register skipped: Firebase Admin is not initialized on this server.');
    return false;
  }
  const token = (input.token || '').trim();
  const businessId = (input.businessId || '').trim();
  if (!token || !businessId) return false;
  try {
    const record: PushTokenRecord = {
      token,
      businessId,
      userId: input.userId || '',
      email: (input.email || '').toLowerCase().trim(),
      platform: input.platform || 'android',
      updatedAt: new Date().toISOString(),
    };
    await store.collection(PUSH_TOKEN_COLLECTION).doc(tokenDocId(token)).set(record, { merge: true });
    return true;
  } catch (err: any) {
    console.error('[push] register failed:', err?.message || err);
    return false;
  }
}

/** Forget one device token (sign-out). Never throws. */
export async function unregisterPushToken(token: string): Promise<void> {
  const store = getPushDb();
  if (!store) return;
  const trimmed = (token || '').trim();
  if (!trimmed) return;
  try {
    await store.collection(PUSH_TOKEN_COLLECTION).doc(tokenDocId(trimmed)).delete();
  } catch (err: any) {
    console.error('[push] unregister failed:', err?.message || err);
  }
}

/** The tokens that belong to this business's owner (never members'). Empty when push is unavailable. */
export async function getOwnerPushTokens(business: BusinessAccount): Promise<PushTokenRecord[]> {
  const store = getPushDb();
  if (!store) return [];
  try {
    const snap = await store
      .collection(PUSH_TOKEN_COLLECTION)
      .where('businessId', '==', business.id)
      .get();
    const tokens: PushTokenRecord[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as Partial<PushTokenRecord>;
      if (typeof data.token !== 'string' || !data.token) return;
      // Owner-only: the same owner definition the rest of the server uses.
      if (!businessIsOwner(business, { uid: data.userId || '', email: data.email || '' } as any)) return;
      tokens.push({
        token: data.token,
        businessId: business.id,
        userId: data.userId || '',
        email: data.email || '',
        platform: data.platform || 'android',
        updatedAt: data.updatedAt || '',
      });
    });
    return tokens;
  } catch (err: any) {
    console.error('[push] token lookup failed:', err?.message || err);
    return [];
  }
}

function digits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

/** The business a call belongs to: the only business, or the one whose phone number was called. */
function matchBusinessForCall(businesses: BusinessAccount[], call: LiveCall): BusinessAccount | null {
  if (businesses.length === 0) return null;
  if (businesses.length === 1) return businesses[0];
  const called = digits(call.calledNumber);
  if (called.length >= 7) {
    const tail = called.slice(-10);
    const match = businesses.find((b) => {
      const phones = [String((b as any).contactPhone || ''), String((b as any).phone || '')];
      return phones.some((p) => {
        const d = digits(p);
        return d.length >= 7 && d.slice(-10) === tail;
      });
    });
    if (match) return match;
  }
  return null;
}

/**
 * The business a call belongs to. The local file store is read first;
 * when it is empty (wiped on redeploy, before the app re-syncs) the
 * durable business records in the named Firestore database are the
 * fallback — a bare admin.firestore() read of the (default) database
 * would find no businesses at all. Never throws.
 */
async function businessForCall(call: LiveCall): Promise<BusinessAccount | null> {
  let businesses: BusinessAccount[] = [];
  try {
    businesses = db.getAllBusinesses();
  } catch {
    businesses = [];
  }
  if (businesses.length === 0) {
    businesses = await getFirestoreBusinesses();
  }
  const matched = matchBusinessForCall(businesses, call);
  if (matched) return matched;
  // The named Firestore database holds several business records (old and
  // orphaned onboarding attempts), and none of them stores the
  // receptionist number as its contact phone — so the called-number match
  // above can miss even when the live business is in the list. The
  // business that can actually be alerted is the one with a registered
  // owner device, so use that as the tiebreak: exactly one business with
  // owner tokens wins; several or none means ambiguous, alert nobody.
  if (businesses.length > 1) {
    const withTokens: BusinessAccount[] = [];
    for (const b of businesses) {
      const tokens = await getOwnerPushTokens(b);
      if (tokens.length > 0) withTokens.push(b);
    }
    if (withTokens.length === 1) return withTokens[0];
  }
  return null;
}

/** Remove tokens FCM says are dead, so a stale install never blocks later sends. */
async function pruneInvalidTokens(store: admin.firestore.Firestore, responses: admin.messaging.SendResponse[], tokens: string[]): Promise<void> {
  const dead: string[] = [];
  responses.forEach((r, i) => {
    const code = (r as any)?.error?.code as string | undefined;
    if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token')) {
      dead.push(tokens[i]);
    }
  });
  for (const token of dead) {
    try {
      await store.collection(PUSH_TOKEN_COLLECTION).doc(tokenDocId(token)).delete();
    } catch { /* a stale token row is harmless */ }
  }
  if (dead.length > 0) console.warn(`[push] removed ${dead.length} invalid device token(s).`);
}

export type NotifyResult =
  | 'sent'
  | 'duplicate'
  | 'no-business'
  | 'no-tokens'
  | 'unavailable'
  | 'failed';

/**
 * Alert the business owner that the receptionist just answered a call.
 * One alert per room, marked only after a successful send; never throws;
 * returns what happened for logging. A failed attempt (no business, no
 * tokens, Admin unavailable, send error) leaves the room unmarked, so a
 * retried webhook event can still alert once the problem clears.
 */
export async function notifyCallAnswered(call: LiveCall): Promise<NotifyResult> {
  const now = Date.now();
  pruneNotified(now);
  if (notifiedRooms.has(call.roomName)) return 'duplicate';

  const business = await businessForCall(call);
  if (!business) {
    console.warn(`[push] no business matched for answered call in room ${call.roomName}; no alert sent.`);
    return 'no-business';
  }
  const tokens = await getOwnerPushTokens(business);
  if (tokens.length === 0) {
    console.warn(`[push] no registered owner device for business ${business.id}; no alert sent for room ${call.roomName}.`);
    return 'no-tokens';
  }
  let messaging: admin.messaging.Messaging;
  try {
    messaging = admin.messaging();
  } catch {
    console.warn('[push] Firebase Admin messaging is not available on this server.');
    return 'unavailable';
  }
  const caller = call.callerNumber && call.callerNumber !== 'Unknown caller'
    ? call.callerNumber
    : '';
  const title = 'Receptionist answered a call';
  const body = caller
    ? `The receptionist is talking to ${caller}. Tap to listen in.`
    : 'The receptionist is on a call right now. Tap to listen in.';
  const messages: admin.messaging.Message[] = tokens.map((t) => ({
    token: t.token,
    notification: { title, body },
    data: {
      type: 'live-call',
      roomName: call.roomName,
      businessId: business.id,
      deepLink: 'rcosmobile://calls',
    },
    android: {
      priority: 'high',
      // A live-call alert is worthless minutes after the call — expire it.
      // (firebase-admin takes the TTL in milliseconds.)
      ttl: 120000,
      notification: { channelId: CALLS_CHANNEL_ID, sound: 'default', visibility: 'public' },
    },
  }));
  try {
    const result = await messaging.sendEach(messages);
    const store = getPushDb();
    if (store && result.failureCount > 0) {
      await pruneInvalidTokens(store, result.responses, tokens.map((t) => t.token));
    }
    if (result.successCount === 0) {
      console.error(`[push] FCM send failed for room ${call.roomName}: all ${tokens.length} token(s) rejected.`);
      return 'failed';
    }
    // Mark only after a successful send: a retried webhook event must
    // not buzz twice, but a failed attempt must not burn the room.
    notifiedRooms.set(call.roomName, now);
    console.warn(`[push] live-call alert sent for room ${call.roomName} (${result.successCount}/${tokens.length} device(s)).`);
    return 'sent';
  } catch (err: any) {
    console.error('[push] FCM send failed:', err?.message || err);
    return 'failed';
  }
}
