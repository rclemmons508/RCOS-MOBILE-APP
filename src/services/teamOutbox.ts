import { teamService } from './teamService';
import { TeamMessage } from '../types';

/**
 * Team Chat outbox — the "unsent messages" drawer.
 *
 * Today a team message that fails to send is dropped: the chat only
 * shows an error line and the typed text is lost unless the user
 * retypes it. This outbox fixes that for the one case we can fix
 * safely on the device alone:
 *
 * - When a send fails because the device is OFFLINE (airplane mode,
 *   no signal, or the network request itself fails before any answer
 *   comes back), the message is saved on the device instead of
 *   dropped, shown in the chat as "Still sending…", and sent on its
 *   own when the device comes back online or the app comes back into
 *   view. The typed draft is cleared because the message itself is
 *   now visible in the chat — nothing the user typed is lost.
 *
 * - When a send fails AMBIGUOUSLY (the request timed out, or the
 *   server answered with an error), the message is also saved and
 *   shown — but it is NOT sent again on its own. The server may
 *   already have saved it and only the answer was lost, and the
 *   server has no way to spot a duplicate (it makes up its own
 *   message id for every post and ignores any id the app sends).
 *   Auto-sending again could post the same message twice, so those
 *   items wait for the user to tap Retry. That is a deliberate
 *   trade-off, and it is stated plainly in the chat ("tap to retry").
 *
 * Storage: localStorage, one list per business, capped at 50 queued
 * messages. If the outbox is full, a new message is NOT queued and
 * NOT cleared from the draft box — the user keeps their text and
 * sees why it could not be queued. Nothing is ever dropped quietly.
 *
 * Scope: team chat messages ONLY. Other writes in the app are not
 * queued by this module, and nothing about Firestore is changed here
 * (Firestore writes do not go through this path at all).
 */

export type QueuedMessageStatus = 'offline' | 'failed';

export interface QueuedTeamMessage {
  /** Client-made id, used only to find this item in the outbox. The server never sees it. */
  queueId: string;
  businessId: string;
  senderEmail: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  /** ISO timestamp of when the user first tried to send it. */
  createdAt: string;
  /** 'offline' = safe to send on its own when back online; 'failed' = needs a manual Retry tap. */
  status: QueuedMessageStatus;
  attempts: number;
}

export const MAX_OUTBOX_ITEMS = 50;

function outboxKey(businessId: string): string {
  return `rcos-team-outbox:${encodeURIComponent(businessId)}`;
}

function readStored(businessId: string): QueuedTeamMessage[] {
  try {
    const raw = localStorage.getItem(outboxKey(businessId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QueuedTeamMessage =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as QueuedTeamMessage).queueId === 'string' &&
        typeof (item as QueuedTeamMessage).text === 'string'
    );
  } catch {
    return [];
  }
}

function writeStored(businessId: string, items: QueuedTeamMessage[]): void {
  try {
    localStorage.setItem(outboxKey(businessId), JSON.stringify(items));
  } catch {
    /* Storage full or unavailable: the caller keeps the draft and shows an error. */
    throw new Error('Could not save that message on this device. Your text is still in the box below — please try again.');
  }
}

export function loadOutbox(businessId: string): QueuedTeamMessage[] {
  if (!businessId) return [];
  return readStored(businessId);
}

/**
 * Save a message to the outbox. Returns null when the outbox is full —
 * the caller must then keep the user's draft and say so.
 */
export function enqueueTeamMessage(
  businessId: string,
  args: { senderEmail: string; senderName: string; senderAvatar?: string; text: string },
  status: QueuedMessageStatus
): QueuedTeamMessage | null {
  const items = readStored(businessId);
  if (items.length >= MAX_OUTBOX_ITEMS) return null;
  const item: QueuedTeamMessage = {
    queueId: `q_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    businessId,
    senderEmail: args.senderEmail,
    senderName: args.senderName,
    senderAvatar: args.senderAvatar,
    text: args.text,
    createdAt: new Date().toISOString(),
    status,
    attempts: 0
  };
  writeStored(businessId, [...items, item]);
  return item;
}

export function removeQueuedMessage(businessId: string, queueId: string): void {
  writeStored(
    businessId,
    readStored(businessId).filter(item => item.queueId !== queueId)
  );
}

export function updateQueuedMessage(
  businessId: string,
  queueId: string,
  patch: Partial<QueuedTeamMessage>
): QueuedTeamMessage[] {
  const items = readStored(businessId).map(item =>
    item.queueId === queueId ? { ...item, ...patch } : item
  );
  writeStored(businessId, items);
  return items;
}

/**
 * True when the failure means "the request never got an answer" —
 * the device is offline, or the network call itself failed. These
 * are the only failures safe to retry on their own: in airplane
 * mode the request never reached the server, so sending again
 * cannot post a duplicate.
 *
 * Server answers (4xx/5xx) and timeouts are NOT offline failures:
 * the server may already have the message, so those wait for a
 * manual Retry tap instead of sending on their own.
 */
export function isOfflineFailure(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const anyErr = err as { status?: unknown; statusText?: unknown; name?: unknown; message?: unknown } | null;
  if (anyErr && anyErr.status === 0) return true;
  if (anyErr && anyErr.statusText === 'NetworkError') return true;
  const message = String(anyErr?.message || '');
  return /network request failed|failed to fetch|networkerror|load failed/i.test(message);
}

/**
 * Try to send one queued message. On success the queued item is
 * removed and the server-saved message is returned, so the chat
 * shows the real message instead of the queued one — never both.
 * On failure the item stays queued (marked 'failed' unless it is
 * still an offline failure) and null is returned.
 */
export async function sendQueuedMessage(
  businessId: string,
  email: string,
  item: QueuedTeamMessage
): Promise<TeamMessage | null> {
  try {
    const sent = await teamService.sendTeamMessage(businessId, email, {
      text: item.text,
      senderName: item.senderName,
      senderAvatar: item.senderAvatar
    });
    removeQueuedMessage(businessId, item.queueId);
    return sent;
  } catch (err) {
    updateQueuedMessage(businessId, item.queueId, {
      status: isOfflineFailure(err) ? 'offline' : 'failed',
      attempts: item.attempts + 1
    });
    return null;
  }
}
