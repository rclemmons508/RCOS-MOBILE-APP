/**
 * Vonage SMS provider (SMS only — voice stays on the free LiveKit path).
 *
 * Sends one real text via the Vonage SMS API:
 *   POST https://rest.nexmo.com/sms/json
 *   { api_key, api_secret, from, to, text, type }
 *
 * Gating: only active when TELEPHONY_PROVIDER=vonage AND VONAGE_API_KEY +
 * VONAGE_API_SECRET are set. Anything else returns { configured: false }
 * and the app keeps its manual Send-now draft behavior, unchanged.
 *
 * `from` — Vonage's own docs require `from` on every send, and for US
 * destinations a Vonage long virtual number (or short code) is required;
 * alphanumeric sender IDs are rejected for North America (Vonage error 15).
 * Trial accounts cannot buy a virtual number with trial credit, so there is
 * NO working `from` fallback for a US trial account without a Vonage number:
 * when VONAGE_FROM_NUMBER is unset the send refuses with a clear error
 * instead of sending with a sender ID Vonage would reject. Never log
 * credentials — only Vonage's safe status/error text is logged.
 */

const VONAGE_SMS_URL = 'https://rest.nexmo.com/sms/json';

export interface VonageSendResult {
  configured: boolean;
  sent: boolean;
  messageId?: string;
  duplicate?: boolean;
  error?: string;
}

export function isVonageConfigured(): boolean {
  return (
    (process.env.TELEPHONY_PROVIDER || '').toLowerCase() === 'vonage' &&
    !!process.env.VONAGE_API_KEY &&
    !!process.env.VONAGE_API_SECRET
  );
}

/** Digits only, no leading + — Vonage wants numbers without + or 00. */
function digitsOnly(phone: string): string {
  return (phone || '').replace(/[^0-9]/g, '');
}

/**
 * Resolve the sender. Returns null when VONAGE_FROM_NUMBER is unset —
 * see the header comment for why there is no fallback.
 */
function resolveFrom(): string | null {
  const from = digitsOnly(process.env.VONAGE_FROM_NUMBER || '');
  return from.length >= 7 && from.length <= 15 ? from : null;
}

/** GSM 03.38 default alphabet — anything outside it goes out as unicode. */
const GSM_7_RE = /^[A-Za-z0-9 @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà\n\r]*$/;

function friendlyError(status: string, errorText: string): string {
  switch (status) {
    case '2':
      return 'Vonage is missing a required field.';
    case '4':
      return 'Vonage rejected the API key/secret — check VONAGE_API_KEY and VONAGE_API_SECRET.';
    case '9':
      return 'Vonage account is out of credit.';
    case '15':
      return 'Vonage rejected the sender — set VONAGE_FROM_NUMBER to a Vonage virtual number.';
    case '29':
      return 'That number is not on the trial allowlist — add it as a test number in the Vonage dashboard.';
    default:
      return errorText ? `Vonage error ${status}: ${errorText}` : `Vonage error ${status}.`;
  }
}

/** Completed send keys (businessId:dedupeKey) — stops a retried fire from texting twice. */
const completedSends = new Set<string>();

export async function sendVonageSms(opts: {
  businessId: string;
  dedupeKey?: string;
  to: string;
  text: string;
}): Promise<VonageSendResult> {
  if (!isVonageConfigured()) return { configured: false, sent: false };

  const to = digitsOnly(opts.to);
  if (to.length < 7 || to.length > 15) {
    return { configured: true, sent: false, error: 'That phone number is not valid.' };
  }
  const text = (opts.text || '').slice(0, 1000);
  if (!text) return { configured: true, sent: false, error: 'Message text is empty.' };

  const from = resolveFrom();
  if (!from) {
    return {
      configured: true,
      sent: false,
      error:
        'Set VONAGE_FROM_NUMBER to a Vonage virtual number — Vonage requires one as the sender for US texts, and trial accounts cannot buy one with trial credit.',
    };
  }

  const dedupe = opts.dedupeKey ? `${opts.businessId}:${opts.dedupeKey}` : '';
  if (dedupe && completedSends.has(dedupe)) {
    return { configured: true, sent: true, duplicate: true };
  }

  let res: Response;
  try {
    res = await fetch(VONAGE_SMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        api_key: process.env.VONAGE_API_KEY,
        api_secret: process.env.VONAGE_API_SECRET,
        from,
        to,
        text,
        type: GSM_7_RE.test(text) ? 'text' : 'unicode',
      }),
    });
  } catch {
    return { configured: true, sent: false, error: 'Could not reach Vonage. Check your connection and try again.' };
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  const msg = data?.messages?.[0];
  if (res.ok && msg && String(msg.status) === '0') {
    if (dedupe) {
      completedSends.add(dedupe);
      if (completedSends.size > 5000) {
        const oldest = completedSends.values().next().value;
        if (oldest) completedSends.delete(oldest);
      }
    }
    console.log(`[Vonage] SMS sent to ${to} (message-id ${msg['message-id'] || 'unknown'})`);
    return { configured: true, sent: true, messageId: msg['message-id'] };
  }
  const status = msg ? String(msg.status) : String(res.status);
  const errorText = msg?.['error-text'] || '';
  const error = friendlyError(status, errorText);
  console.warn(`[Vonage] SMS to ${to} failed: ${error}`);
  return { configured: true, sent: false, error };
}
