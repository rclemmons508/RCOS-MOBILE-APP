import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * System settings for this app (Android).
 * - Opens the phone's notification settings for the app, so the owner
 *   can turn live-call alerts back on after the notification permission
 *   was denied. Used by the in-app "call alerts are off" banner.
 * Every call is guarded: on web/desktop, or on a build without the
 * native plugin, these are silent no-ops.
 */

interface AppSettingsPlugin {
  openNotificationSettings(): Promise<void>;
}

const AppSettings = Capacitor.isNativePlatform()
  ? registerPlugin<AppSettingsPlugin>('AppSettings')
  : null;

/** Open this app's notification settings on the phone. */
export function openNotificationSettings(): Promise<void> {
  if (!AppSettings) return Promise.resolve();
  return AppSettings.openNotificationSettings().catch(() => {
    // No settings screen on this build — stay quiet.
  });
}
