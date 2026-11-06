import { useEffect, useRef } from 'react';

/**
 * One battery-friendly sync loop for the whole app.
 * Replaces one-interval-per-data-source polling.
 * - Single timer for every background refresh.
 * - Pauses while the tab is hidden (phone in pocket / screen off).
 * - Skips ticks while the device is offline.
 * - Syncs immediately when the app comes back into view.
 * - Never runs two syncs at once: a tick or visibility change that
 *   arrives while a sync is still awaiting shares that run (and, for a
 *   visibility change, queues exactly one follow-up run after it), so
 *   pollers like follow-ups / proactive alerts can't double-send.
 */
export function useSyncEngine(sync: () => Promise<void>, intervalMs = 30000) {
  const syncRef = useRef(sync);
  syncRef.current = sync;
  // The sync currently running, shared by every trigger.
  const inFlightRef = useRef<Promise<void> | null>(null);
  // A visibility-triggered sync that arrived mid-run; runs once after it.
  const rerunQueuedRef = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const runSync = (): Promise<void> => {
      if (inFlightRef.current) return inFlightRef.current;
      const run = (async () => {
        try {
          await syncRef.current();
        } catch {
          /* one failing source must not stop the others */
        } finally {
          inFlightRef.current = null;
        }
        if (rerunQueuedRef.current && !stopped && !document.hidden && navigator.onLine) {
          rerunQueuedRef.current = false;
          await runSync();
        }
        rerunQueuedRef.current = false;
      })();
      inFlightRef.current = run;
      return run;
    };

    const tick = async () => {
      if (stopped) return;
      if (!document.hidden && navigator.onLine) {
        await runSync();
      }
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };

    const onVisibility = () => {
      if (document.hidden || !navigator.onLine || stopped) return;
      if (inFlightRef.current) {
        // A sync is already running: fold this request into one re-run.
        rerunQueuedRef.current = true;
        return;
      }
      void runSync();
      if (timer) {
        clearTimeout(timer);
        timer = setTimeout(tick, intervalMs);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    void tick();
    return () => {
      stopped = true;
      rerunQueuedRef.current = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);
}
