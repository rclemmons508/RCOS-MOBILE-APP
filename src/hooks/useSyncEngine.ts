import { useEffect, useRef } from 'react';

/**
 * One battery-friendly sync loop for the whole app.
 * Replaces one-interval-per-data-source polling.
 * - Single timer for every background refresh.
 * - Pauses while the tab is hidden (phone in pocket / screen off).
 * - Skips ticks while the device is offline.
 * - Syncs immediately when the app comes back into view.
 */
export function useSyncEngine(sync: () => Promise<void>, intervalMs = 30000) {
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (!document.hidden && navigator.onLine) {
        try {
          await syncRef.current();
        } catch {
          /* one failing source must not stop the others */
        }
      }
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };

    const onVisibility = () => {
      if (!document.hidden && navigator.onLine) {
        syncRef.current().catch(() => {});
        if (timer) {
          clearTimeout(timer);
          timer = setTimeout(tick, intervalMs);
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);
}
