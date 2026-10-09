import { Capacitor } from '@capacitor/core';

// Production API URL fallback (deployed Cloud Run endpoint)
const DEFAULT_PRODUCTION_API_URL = 'https://ais-pre-fft6xjt5rur3koiv4vsfjv-548256682184.us-west2.run.app';

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
