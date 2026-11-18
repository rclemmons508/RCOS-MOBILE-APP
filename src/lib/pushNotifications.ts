/**
 * Push notifications for live receptionist calls (FCM, native Android).
 *
 * After sign-in the app registers this device's FCM token with the server
 * (POST /api/push/register). When the receptionist answers a call, the
 * server sends a high-priority alert to the business owner's registered
 * devices; tapping it opens the Calls screen, and while the app is open
 * the alert arrives as an in-app toast instead.
 *
 * Native Android only — on the web this module is a no-op (there is no
 * FCM web push wired up, and the in-app toast path already covers the
 * foreground case there).
 *
 * Setup requirement (see SETUP.md): the Android app must be registered
 * in the Firebase console (project rcos-mobile, package
 * com.rcsolutions.rcosmobile) and its google-services.json placed in
 * android/app/. Until then there is no native FirebaseApp, and calling
 * PushNotifications.register() throws on the native side and CRASHES the
 * app — a native crash the JS try/catch below cannot stop. That is why
 * PUSH_CONFIGURED below gates every native call: push stays completely
 * off until the Firebase setup is done. Permission denied, on the other
 * hand, fails soft: setup returns before register() and the app, the
 * Calls screen, and the live-call view keep working.
 */

import { apiFetch } from './api';

/** Android notification channel for live-call alerts (high importance: sound + heads-up). */
export const LIVE_CALL_CHANNEL_ID = 'rcos_calls';

const STORED_TOKEN_KEY = 'rcos_push_token';
const STORED_BUSINESS_KEY = 'rcos_push_token_business';

/**
 * Flip to true ONLY as the last step of the Firebase setup in SETUP.md
 * (google-services.json in android/app/ + the GOOGLE_SERVICES_JSON repo
 * secret + the workflow step). Until then there is no native FirebaseApp
 * and register() crashes the app on the native side — see the header
 * comment. When this is false, setup and teardown never touch the
 * native push plugin at all, so the app opens and runs normally.
 */
const PUSH_CONFIGURED = true;

export interface LiveCallPush {
  title: string;
  body: string;
  roomName: string;
  businessId: string;
}

export interface PushSetupOptions {
  businessId: string;
  /** A live-call alert arrived while the app is open — show the in-app toast. */
  onForegroundLiveCall: (call: LiveCallPush) => void;
  /** The owner tapped a live-call alert — open the live call. */
  onLiveCallTap: (call: LiveCallPush) => void;
}

let listenersAttached = false;
let setupBusinessId: string | null = null;
let latestCallbacks: Pick<PushSetupOptions, 'onForegroundLiveCall' | 'onLiveCallTap'> | null = null;

function storedToken(): { token: string; businessId: string } | null {
  try {
    const token = localStorage.getItem(STORED_TOKEN_KEY) || '';
    const businessId = localStorage.getItem(STORED_BUSINESS_KEY) || '';
    return token ? { token, businessId } : null;
  } catch {
    return null;
  }
}

function storeToken(token: string, businessId: string): void {
  try {
    localStorage.setItem(STORED_TOKEN_KEY, token);
    localStorage.setItem(STORED_BUSINESS_KEY, businessId);
  } catch { /* private mode — registration just repeats next launch */ }
}

function clearStoredToken(): void {
  try {
    localStorage.removeItem(STORED_TOKEN_KEY);
    localStorage.removeItem(STORED_BUSINESS_KEY);
  } catch { /* already gone */ }
}

function isLiveCallData(data: any): data is { type: 'live-call'; roomName?: string; businessId?: string } {
  return !!data && typeof data === 'object' && data.type === 'live-call';
}

function toLiveCallPush(title: string | undefined, body: string | undefined, data: any): LiveCallPush {
  return {
    title: title || 'Receptionist answered a call',
    body: body || 'The receptionist is on a call right now. Tap to listen in.',
    roomName: typeof data?.roomName === 'string' ? data.roomName : '',
    businessId: typeof data?.businessId === 'string' ? data.businessId : '',
  };
}

async function sendTokenToServer(token: string, businessId: string): Promise<void> {
  const stored = storedToken();
  // The FCM token is stable across launches — skip the write when the
  // server already has this exact token for this business.
  if (stored && stored.token === token && stored.businessId === businessId) return;
  try {
    await apiFetch('/api/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform: 'android', businessId }),
    });
    storeToken(token, businessId);
  } catch (err) {
    // A failed registration is retried on the next launch — never loud.
    console.warn('[push] token registration failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Register this device for live-call alerts. Safe to call on every
 * sign-in / business change; listeners attach once, the token is
 * re-sent only when it changed or the business changed.
 */
export async function setupPushNotifications(options: PushSetupOptions): Promise<void> {
  // Push is not configured yet (no google-services.json) — never touch
  // the native plugin: register() would crash the app (see header).
  if (!PUSH_CONFIGURED) return;
  latestCallbacks = {
    onForegroundLiveCall: options.onForegroundLiveCall,
    onLiveCallTap: options.onLiveCallTap,
  };
  const businessId = options.businessId;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { PushNotifications } = await import('@capacitor/push-notifications');

    if (!listenersAttached) {
      // The channel the server's alert names (channelId 'rcos_calls').
      // Created once; re-creating an existing channel is a no-op, and a
      // channel the user edited in system settings keeps their choice.
      await PushNotifications.createChannel({
        id: LIVE_CALL_CHANNEL_ID,
        name: 'Incoming calls',
        description: 'Alerts when the AI receptionist answers a call',
        importance: 5,
        sound: 'default',
        vibration: true,
        lights: true,
      }).catch(() => { /* pre-O Android has no channels */ });

      const perm = await PushNotifications.requestPermissions().catch(() => null);
      if (!perm || perm.receive !== 'granted') {
        console.warn('[push] notification permission not granted; live-call alerts are off.');
        return;
      }

      await PushNotifications.addListener('registration', (token) => {
        if (token?.value && setupBusinessId) {
          void sendTokenToServer(token.value, setupBusinessId);
        }
      });
      await PushNotifications.addListener('registrationError', (error) => {
        // The usual cause is a missing google-services.json (see SETUP.md).
        console.warn('[push] registration failed:', (error as any)?.error || error);
      });
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        if (isLiveCallData(notification?.data)) {
          latestCallbacks?.onForegroundLiveCall(
            toLiveCallPush(notification.title, notification.body, notification.data),
          );
        }
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const notification = action?.notification;
        if (notification && isLiveCallData(notification.data)) {
          latestCallbacks?.onLiveCallTap(
            toLiveCallPush(notification.title, notification.body, notification.data),
          );
        }
      });
      listenersAttached = true;
    }

    setupBusinessId = businessId;
    // Re-register on every setup: FCM hands back the current token
    // (same one unless it rotated) and the 'registration' listener
    // sends it to the server when it changed.
    await PushNotifications.register();
  } catch (err) {
    console.warn('[push] setup failed (push stays off):', err instanceof Error ? err.message : err);
  }
}

/**
 * Forget this device for push (sign-out / leave-team). Best effort:
 * the server forgets the token, the plugin drops its FCM token, and the
 * listeners are removed. Never throws.
 */
export async function teardownPushNotifications(): Promise<void> {
  const stored = storedToken();
  if (stored) {
    try {
      await apiFetch('/api/push/unregister', {
        method: 'POST',
        body: JSON.stringify({ token: stored.token }),
      });
    } catch { /* the token row is pruned when FCM next rejects it */ }
    clearStoredToken();
  }
  // Never touch the native plugin while push is unconfigured:
  // unregister() calls FirebaseMessaging too and would crash the same way.
  if (PUSH_CONFIGURED) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.removeAllListeners().catch(() => {});
      await PushNotifications.unregister().catch(() => {});
    } catch { /* nothing to tear down */ }
  }
  listenersAttached = false;
  setupBusinessId = null;
  latestCallbacks = null;
}
