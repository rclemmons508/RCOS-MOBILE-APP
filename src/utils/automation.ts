import { AutomationTask, NotificationPreferences } from '../types';

/** A rule fires only when the engine is on, the rule is on, and it isn't paused. */
export function isTaskFiring(task: AutomationTask | undefined, masterOn: boolean): boolean {
  return !!task && masterOn && task.isAutomated && !task.paused;
}

/**
 * Follow-up window before a request counts as "waiting too long".
 * With the industry modifier on, the window matches the trade's pace.
 */
export function getFollowupWindowMs(industry: string | undefined, industryModifierOn: boolean): number {
  if (!industryModifierOn) return 24 * 3600 * 1000;
  const ind = (industry || '').toLowerCase();
  if (ind.includes('emergency')) return 8 * 3600 * 1000;
  if (ind.includes('plumb') || ind.includes('hvac') || ind.includes('electric') || ind.includes('appliance')) {
    return 12 * 3600 * 1000;
  }
  if (ind.includes('landscap') || ind.includes('lawn') || ind.includes('clean')) {
    return 48 * 3600 * 1000;
  }
  return 24 * 3600 * 1000;
}

export function describeFollowupWindow(industry: string | undefined, industryModifierOn: boolean): string {
  const ms = getFollowupWindowMs(industry, industryModifierOn);
  const h = Math.round(ms / 3600000);
  if (!industryModifierOn) return `24h (industry pacing off)`;
  return `${h}h for ${industry || 'your industry'}`;
}

/** True when the user's quiet hours are currently active. */
export function inQuietHours(prefs: NotificationPreferences): boolean {
  if (!prefs.quietHoursEnabled) return false;
  try {
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    const [sH, sM] = (prefs.quietHoursStart || '22:00').split(':').map(Number);
    const [eH, eM] = (prefs.quietHoursEnd || '07:00').split(':').map(Number);
    const startMins = sH * 60 + sM;
    const endMins = eH * 60 + eM;
    if (startMins > endMins) return curMins >= startMins || curMins < endMins;
    return curMins >= startMins && curMins < endMins;
  } catch {
    return false;
  }
}

export function timeAgoShort(iso: string | undefined): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
