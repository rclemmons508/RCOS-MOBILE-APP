import { BusinessAccount } from '../types';

export interface ChatbotScheduleStatus {
  enabled: boolean;
  status: 'online' | 'idle';
  label: 'Online' | 'Idle';
  withinBusinessHours: boolean;
  start: string;
  end: string;
  days: number[];
  scheduleSummary: string;
  statusDetail: string;
}

const DEFAULT_START = '08:00';
const DEFAULT_END = '18:00';
const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseMinutes(hhmm: string, fallbackMinutes: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!match) return fallbackMinutes;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallbackMinutes;
  return h * 60 + m;
}

export function formatTime12h(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!match) return hhmm;
  const h24 = Number(match[1]);
  const m = match[2];
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m} ${suffix}`;
}

/**
 * Evaluates whether the public-facing chatbot is currently 'online' or 'idle'
 * based on configured business hours (defaults to Mon–Fri, 08:00–18:00 local time).
 */
export function getPublicChatbotStatus(
  business?: Pick<
    Partial<BusinessAccount>,
    'publicChatbotEnabled' | 'businessHoursStart' | 'businessHoursEnd' | 'businessHoursDays'
  > | null,
  now: Date = new Date()
): ChatbotScheduleStatus {
  const enabled = business?.publicChatbotEnabled !== false;
  const start = business?.businessHoursStart || DEFAULT_START;
  const end = business?.businessHoursEnd || DEFAULT_END;
  const days =
    Array.isArray(business?.businessHoursDays) && business.businessHoursDays.length > 0
      ? business.businessHoursDays
      : DEFAULT_DAYS;

  const startMin = parseMinutes(start, 8 * 60);
  const endMin = parseMinutes(end, 18 * 60);
  const currentDay = now.getDay();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  let withinBusinessHours = false;
  if (days.includes(currentDay)) {
    if (startMin === endMin) {
      // 24-hour window on active days
      withinBusinessHours = true;
    } else if (startMin < endMin) {
      withinBusinessHours = currentMin >= startMin && currentMin < endMin;
    } else {
      // Overnight shift (e.g. 20:00 -> 06:00)
      withinBusinessHours = currentMin >= startMin || currentMin < endMin;
    }
  }

  const daysLabel =
    days.length === 7
      ? 'Daily'
      : days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))
      ? 'Mon–Fri'
      : days.map((d) => DAY_NAMES[d] || '').filter(Boolean).join(', ');

  const scheduleSummary =
    startMin === endMin
      ? `${daysLabel} · 24 Hours`
      : `${daysLabel} · ${formatTime12h(start)} – ${formatTime12h(end)}`;

  const status: 'online' | 'idle' = withinBusinessHours ? 'online' : 'idle';
  const label: 'Online' | 'Idle' = withinBusinessHours ? 'Online' : 'Idle';

  const statusDetail = !enabled
    ? `Public widget hidden · Hours: ${scheduleSummary}`
    : withinBusinessHours
    ? `Active within business hours (${scheduleSummary})`
    : `Outside business hours (${scheduleSummary}) — Intake & FAQ mode`;

  return {
    enabled,
    status,
    label,
    withinBusinessHours,
    start,
    end,
    days,
    scheduleSummary,
    statusDetail,
  };
}
