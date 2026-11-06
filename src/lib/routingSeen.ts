/**
 * Persisted "already handled" keys for the emergency voice-routing
 * automation, one record per business.
 *
 * Without this, every app launch started with an empty set and re-fired
 * escalations, toasts and chimes for every emergency entry still in the
 * server's routing log. The first poll for a business now only SEEDS the
 * baseline (nothing fires); later polls act only on entries not seen before.
 */

const PREFIX = 'rcos_routing_seen:';
/** Cap per business. The server log holds ~200 entries; keep headroom. */
export const ROUTING_SEEN_CAP = 500;

export interface RoutingSeenState {
  primed: boolean;
  keys: string[];
}

export function loadRoutingSeen(businessId: string): RoutingSeenState {
  try {
    const raw = localStorage.getItem(`${PREFIX}${businessId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.keys)) {
        return {
          primed: parsed.primed === true,
          keys: parsed.keys.filter((k: unknown) => typeof k === 'string').slice(-ROUTING_SEEN_CAP),
        };
      }
    }
  } catch {
    /* storage unavailable or corrupt — start unprimed */
  }
  return { primed: false, keys: [] };
}

export function saveRoutingSeen(businessId: string, state: RoutingSeenState): void {
  try {
    localStorage.setItem(
      `${PREFIX}${businessId}`,
      JSON.stringify({ primed: state.primed, keys: state.keys.slice(-ROUTING_SEEN_CAP) })
    );
  } catch {
    /* storage full/unavailable — the in-memory copy still dedupes this session */
  }
}
