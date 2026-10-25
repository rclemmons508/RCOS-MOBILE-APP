import { useEffect, useRef, useState } from 'react';
import { buildApiUrl } from '../config/api';
import { teamHeaders } from '../services/teamService';

/**
 * Live team-chat stream (server-sent events).
 *
 * Uses fetch + a stream reader instead of a plain EventSource on purpose:
 * EventSource cannot send custom headers, and this app identifies the
 * caller with the X-User-Email header while the login gate is OFF (the
 * same identification the team REST routes use). The server guards the
 * stream with the same team-membership check as those routes.
 *
 * Calls onEvent the moment a teammate's message lands. Reconnects on its
 * own (5s backoff) when the stream drops. Returns whether the stream is
 * currently connected — callers keep a slow safety-net poll running
 * while it is down, and must NOT drop polling entirely until this path
 * is proven on a real phone build.
 */
export function useTeamLiveEvents(
  businessId: string | undefined,
  email: string | undefined,
  onEvent: () => void
): boolean {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!businessId || !email) {
      setConnected(false);
      return;
    }
    let stopped = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (stopped) return;
      controller = new AbortController();
      try {
        const res = await fetch(buildApiUrl(`/api/business/${encodeURIComponent(businessId)}/team-events`), {
          headers: teamHeaders(email),
          signal: controller.signal
        });
        if (!res.ok || !res.body) throw new Error(`live stream answered ${res.status}`);
        if (stopped) return;
        setConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done || stopped) break;
          buf += decoder.decode(value, { stream: true });
          let split: number;
          while ((split = buf.indexOf('\n\n')) !== -1) {
            const chunk = buf.slice(0, split);
            buf = buf.slice(split + 2);
            if (chunk.includes('event: team-message')) onEventRef.current();
          }
        }
      } catch {
        /* Stream dropped or refused — the safety-net poll covers the gap. */
      }
      if (!stopped) {
        setConnected(false);
        retryTimer = setTimeout(connect, 5000);
      }
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      try {
        controller?.abort();
      } catch {
        /* already closed */
      }
    };
  }, [businessId, email]);

  return connected;
}
