import { TeamMessage } from '../types';

/**
 * Team Chat unread count — kept on this phone only, in localStorage.
 * The "last seen" marker is the id of the newest message this phone had
 * on screen when the chat was open. Opening the chat marks everything
 * up to the newest message seen, which clears the badge.
 * Nothing here touches the server: another phone's badge is unaffected.
 */

function keyFor(businessId: string): string {
  return `rcos:team-last-seen:${businessId}`;
}

export function getTeamLastSeenId(businessId: string): string | null {
  try {
    return window.localStorage.getItem(keyFor(businessId));
  } catch {
    return null;
  }
}

export function markTeamSeen(businessId: string, messageId: string): void {
  if (!businessId || !messageId) return;
  try {
    window.localStorage.setItem(keyFor(businessId), messageId);
  } catch {
    /* private mode / storage blocked — the badge just stays until the next open */
  }
}

/**
 * Messages from OTHER people that arrived after the last-seen message.
 * - No last-seen id stored yet (chat never opened on this phone): every
 *   message from someone else counts. The badge clears on first open.
 * - Last-seen id stored but no longer in the kept history (the server
 *   keeps 500 messages per business and drops older ones): count nothing
 *   new — that history was already on this phone when it was seen.
 */
export function countTeamUnread(messages: TeamMessage[], myEmail: string, lastSeenId: string | null): number {
  const mine = (myEmail || '').toLowerCase();
  if (!lastSeenId) {
    return messages.filter(m => (m.senderEmail || '').toLowerCase() !== mine).length;
  }
  const idx = messages.findIndex(m => m.id === lastSeenId);
  if (idx === -1) return 0;
  let count = 0;
  for (let i = idx + 1; i < messages.length; i++) {
    if ((messages[i].senderEmail || '').toLowerCase() !== mine) count++;
  }
  return count;
}
