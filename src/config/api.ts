import { Capacitor } from '@capacitor/core';

// Production API URL fallback (Railway-hosted RCOS server)
const DEFAULT_PRODUCTION_API_URL = 'https://rcos-mobile-app-production.up.railway.app';

/**
 * Resolves the appropriate API base URL depending on platform:
 * - Native Android APK (Capacitor): Routes to the deployed HTTPS backend (NOT localhost).
 * - Web Browser / Dev Server / Cloud Run Preview: Always uses relative path '' for same-origin proxying.
 *   This avoids CORS and "Failed to fetch" connection errors pointing to dead localhost emulators.
 */
export function getApiBaseUrl(): string {
  // If running on native mobile platform (Android / iOS via Capacitor), use full HTTPS API URL
  if (Capacitor.isNativePlatform()) {
    const envUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_URL : '';
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/$/, '');
    }
    return DEFAULT_PRODUCTION_API_URL;
  }

  // In web browser (dev server, iframe preview, or deployed web SPA), always use same-origin relative paths
  return '';
}

export function buildApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = getApiBaseUrl();
  return `${base}${cleanEndpoint}`;
}

// Public booking page (owner's Netlify site). Customers open this link to
// request service — never build a share link from window.location.origin,
// which is https://localhost inside the native app and goes nowhere.
// Per-business booking addresses are future work when the app is sold to
// other businesses.
export const PUBLIC_BOOKING_PAGE_URL = 'https://rcsolutionsai.netlify.app/book.html';

/** Customer-facing booking link for a business. Empty when no business. */
export function buildPublicBookingLink(businessId: string | undefined | null): string {
  if (!businessId) return '';
  return `${PUBLIC_BOOKING_PAGE_URL}?businessId=${encodeURIComponent(businessId)}`;
}
