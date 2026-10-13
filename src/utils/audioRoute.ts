import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Native audio routing for voice calls (Android).
 * - Calls start on the earpiece (voice-call audio mode), so the volume
 *   buttons control the call volume and the loudspeaker stays off.
 * - The call UI can flip the loudspeaker on/off on request.
 * Every call is guarded: on web/desktop, or on a build without the native
 * plugin, these are silent no-ops.
 */

interface AudioRoutePlugin {
  setCommunicationMode(): Promise<void>;
  setSpeakerphone(options: { enabled: boolean }): Promise<{ speakerphone: boolean }>;
  restoreAudioMode(): Promise<void>;
}

const AudioRoute = Capacitor.isNativePlatform()
  ? registerPlugin<AudioRoutePlugin>('AudioRoute')
  : null;

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!AudioRoute) return null;
  try {
    return await fn();
  } catch {
    return null; // plugin missing on this build — stay quiet
  }
}

/** Route call audio to the earpiece and use the call-volume stream. */
export function enableEarpieceForCall(): Promise<void> {
  return safe(() => AudioRoute!.setCommunicationMode()).then(() => undefined);
}

/** Turn the loudspeaker on/off during a call. */
export function setCallSpeakerphone(enabled: boolean): Promise<void> {
  return safe(() => AudioRoute!.setSpeakerphone({ enabled })).then(() => undefined);
}

/** Restore the phone's normal audio mode after a call ends. */
export function restoreAudioAfterCall(): Promise<void> {
  return safe(() => AudioRoute!.restoreAudioMode()).then(() => undefined);
}
