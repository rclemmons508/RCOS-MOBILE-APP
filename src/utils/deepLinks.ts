import type { TabType } from '../types';

/**
 * Deep links into the app: rcosmobile://<screen>.
 *
 * Used by the Android back-button handler's sibling, the `appUrlOpen`
 * listener in App.tsx, so a link (from a notification, a text message,
 * or the booking flow) opens the right screen instead of just launching
 * the app on Home. Unknown hosts fall back to Home — a bad link never
 * lands the user on a dead screen.
 *
 * The Gmail OAuth return (rcosmobile://gmail-connected) is handled
 * separately in lib/gmail.ts and is deliberately NOT in this map.
 */
export const DEEP_LINK_ROUTES: Record<string, TabType> = {
  home: 'dashboard',
  dashboard: 'dashboard',
  calls: 'phone',
  phone: 'phone',
  jobs: 'jobs',
  inbox: 'inbox',
  operations: 'inbox',
  more: 'more',
  team: 'team',
  chat: 'chat',
  settings: 'settings',
  approvals: 'approvals',
  review: 'approvals',
  clients: 'clients',
  requests: 'requests',
  reports: 'reports',
  'team-chat': 'team-chat',
  gmail: 'gmail',
  email: 'gmail',
};

/** Parse an rcosmobile:// URL into a tab, or null when it is not one of ours. */
export function tabForDeepLink(url: string): TabType | null {
  if (typeof url !== 'string') return null;
  const match = url.match(/^rcosmobile:\/\/([a-z0-9-]+)/i);
  if (!match) return null;
  return DEEP_LINK_ROUTES[match[1].toLowerCase()] ?? null;
}
