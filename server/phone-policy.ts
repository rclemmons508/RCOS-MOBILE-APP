// Phone-number policy for anything that makes the carrier account dial out
// or forward a call (audit #7, #8): strict E.164, a country-code allow-list,
// and a per-business daily cap. Node built-ins only.

// "+1 (555) 019-4820", "555-019-4820", "15550194820" -> "+15550194820".
// Returns null for anything that is not a plausible E.164 number.
export function normalizeE164(input: unknown): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const raw = String(input).trim();
  if (!raw || raw.length > 32) return null;
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  let e164: string;
  if (hasPlus) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) e164 = `+${digits}`;
  else return null; // no '+' and not a US/CA shape: refuse to guess a country
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

// NANP (+1) area codes that are NOT the US or Canada (Caribbean / Atlantic
// islands — classic toll-fraud destinations), plus premium-rate 900/976.
const NANP_BLOCKED_AREA_CODES = new Set([
  '242', '246', '264', '268', '284', '345', '441', '473', '649', '658', '664',
  '721', '758', '767', '784', '809', '829', '849', '868', '869', '876',
  '900', '976',
]);

// Allowed country calling codes from OUTBOUND_ALLOWED_COUNTRY_CODES
// (comma-separated digits, e.g. "1,44"). Default: "1" (US/Canada only).
export function allowedCountryCodes(): string[] {
  const raw = (process.env.OUTBOUND_ALLOWED_COUNTRY_CODES || '1').trim() || '1';
  return raw.split(',').map((c) => c.trim().replace(/^\+/, '')).filter((c) => /^\d{1,3}$/.test(c));
}

// True when the E.164 number may be dialed/forwarded to.
export function isAllowedDestination(e164: string): boolean {
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return false;
  const digits = e164.slice(1);
  const code = allowedCountryCodes().find((c) => digits.startsWith(c));
  if (!code) return false;
  if (code === '1') {
    if (digits.length !== 11) return false;
    const area = digits.slice(1, 4);
    if (NANP_BLOCKED_AREA_CODES.has(area)) return false;
    if (!/^[2-9]\d\d[2-9]\d{6}$/.test(digits.slice(1))) return false;
  }
  return true;
}

// Normalize + allow-list in one step. Returns the E.164 number or an error.
export function checkDestination(input: unknown): { ok: true; e164: string } | { ok: false; error: string } {
  const e164 = normalizeE164(input);
  if (!e164) return { ok: false, error: 'Enter a valid phone number in international format, e.g. +14155552671.' };
  if (!isAllowedDestination(e164)) {
    return { ok: false, error: `Calls to ${e164} are not allowed. Allowed country codes: +${allowedCountryCodes().join(', +')} (US/Canada by default; Caribbean and premium-rate +1 numbers are blocked).` };
  }
  return { ok: true, e164 };
}

// Per-business daily counters (UTC day). In memory: resets on restart,
// which is acceptable as a fraud brake on a single Railway instance.
const dailyCounters = new Map<string, { day: string; count: number }>();
const MAX_COUNTER_KEYS = 10_000;

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Atomically checks and consumes one unit of a per-business daily quota.
// Returns false (and consumes nothing) when the cap is reached.
export function takeDailyQuota(kind: string, businessId: string, cap: number, units = 1): boolean {
  const key = `${kind}:${businessId}`;
  const day = utcDay();
  let rec = dailyCounters.get(key);
  if (!rec || rec.day !== day) {
    if (!rec && dailyCounters.size >= MAX_COUNTER_KEYS) {
      for (const [k, v] of dailyCounters) if (v.day !== day) dailyCounters.delete(k);
      if (dailyCounters.size >= MAX_COUNTER_KEYS) return false;
    }
    rec = { day, count: 0 };
    dailyCounters.set(key, rec);
  }
  if (rec.count + units > cap) return false;
  rec.count += units;
  return true;
}
