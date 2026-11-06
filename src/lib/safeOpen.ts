import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/**
 * The ONE place the app opens a URL that came from data (server records,
 * AI output, email content). Never call window.open / Browser.open /
 * location.href with such a string directly: a `javascript:`, `intent:`,
 * `file:` or `data:` URL would run inside the WebView.
 *
 * Allowed:
 * - http: / https: → system browser (Capacitor Browser on native, new tab on web)
 * - same-app routes ("/settings", "#jobs", same-origin absolute URLs) → in-app navigation
 * - sms: / tel: / mailto: ONLY when the caller opts in with `allowContact`
 *   (e.g. the follow-up "Send now" button that opens the SMS app)
 * Everything else is refused (returns false).
 */
export type SafeUrlKind = 'external' | 'same-app' | 'contact';

export interface SafeOpenOptions {
  /** Permit sms:, tel: and mailto: (opens the phone's app). */
  allowContact?: boolean;
}

const CONTACT_SCHEMES = new Set(['sms:', 'tel:', 'mailto:']);

/** Classify a URL, or null when it must not be opened. */
export function classifySafeUrl(raw: unknown, opts: SafeOpenOptions = {}): { url: string; kind: SafeUrlKind } | null {
  if (typeof raw !== 'string') return null;
  // Strip control chars / whitespace that browsers ignore inside schemes ("java\nscript:").
  const trimmed = raw.trim().replace(/[\u0000-\u001F\u007F]/g, '');
  if (!trimmed || trimmed.length > 4096) return null;

  // Same-app relative route: "/path" or "#hash" (but never protocol-relative "//host").
  if ((trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) || trimmed.startsWith('#')) {
    return { url: trimmed, kind: 'same-app' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol === 'http:' || protocol === 'https:') {
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return { url: parsed.href, kind: 'same-app' };
    }
    return { url: parsed.href, kind: 'external' };
  }
  if (opts.allowContact && CONTACT_SCHEMES.has(protocol)) {
    return { url: trimmed, kind: 'contact' };
  }
  return null;
}

/** `href` value for an <a> rendering data-sourced links; undefined when unsafe. */
export function safeHref(raw: unknown, opts: SafeOpenOptions = {}): string | undefined {
  return classifySafeUrl(raw, opts)?.url;
}

/**
 * Open a data-sourced URL safely. Resolves true when something was opened,
 * false when the URL was refused or could not be opened.
 */
export async function safeOpenUrl(raw: unknown, opts: SafeOpenOptions = {}): Promise<boolean> {
  const safe = classifySafeUrl(raw, opts);
  if (!safe) {
    console.warn('[safeOpenUrl] Refused to open a URL with a disallowed scheme.');
    return false;
  }
  try {
    if (safe.kind === 'same-app') {
      window.location.assign(safe.url);
      return true;
    }
    if (safe.kind === 'contact') {
      // Hands off to the phone's SMS / dialer / mail app.
      window.location.href = safe.url;
      return true;
    }
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: safe.url });
      return true;
    }
    // With noopener, window.open returns null even on success.
    window.open(safe.url, '_blank', 'noopener,noreferrer');
    return true;
  } catch (e) {
    console.warn('[safeOpenUrl] Could not open URL:', (e as Error)?.message || e);
    return false;
  }
}
