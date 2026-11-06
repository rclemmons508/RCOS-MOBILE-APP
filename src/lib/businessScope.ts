/**
 * Tenant scoping helpers for the shared voice / phone endpoints.
 *
 * `/api/voice/routing-log`, `/api/phone/calls` and `/api/phone/voicemails`
 * are shared paths on the server. The server filters them by the
 * `?businessId=` query param; the client always sends it AND defensively
 * drops any record that names a different business, so an older server
 * (or a bug there) can never make this company's automations act on
 * another company's calls.
 */

/** Append `businessId=<id>` to an API path (no-op when there is no id). */
export function withBusinessId(path: string, businessId?: string | null): string {
  if (!businessId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}businessId=${encodeURIComponent(businessId)}`;
}

/**
 * True when a server record may belong to this business: it either names
 * this business or carries no business id at all (older records). A record
 * that names a DIFFERENT business is always rejected.
 */
export function belongsToBusiness(record: unknown, businessId: string | null | undefined): boolean {
  if (!record || typeof record !== 'object') return false;
  const rid = (record as { businessId?: unknown }).businessId;
  if (rid === undefined || rid === null || rid === '') return true;
  if (!businessId) return false;
  return String(rid) === String(businessId);
}

/** Keep only records that may belong to this business (see belongsToBusiness). */
export function filterToBusiness<T>(records: T[], businessId: string | null | undefined): T[] {
  return records.filter((r) => belongsToBusiness(r, businessId));
}

let idCounter = 0;

/**
 * Collision-safe unique id. Uses crypto.randomUUID when available, then
 * crypto.getRandomValues, and only as a last resort a time + counter +
 * Math.random mix (still unique within one loop thanks to the counter).
 */
export function uniqueId(prefix = ''): string {
  let core = '';
  try {
    const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') {
      core = c.randomUUID();
    } else if (c && typeof c.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      core = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    core = '';
  }
  if (!core) {
    idCounter = (idCounter + 1) % 1_000_000;
    core = `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return `${prefix}${core}`;
}
