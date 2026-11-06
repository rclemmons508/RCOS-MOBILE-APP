/**
 * Local password hashing (offline fallback store only).
 *
 * New hashes use PBKDF2-HMAC-SHA512 via WebCrypto with a random 16-byte
 * salt and 210,000 iterations (OWASP minimum for PBKDF2-SHA512), stored as
 *   pbkdf2$sha512$<iterations>$<hex digest>
 * with the salt kept in the user's `passwordSalt` field.
 *
 * Legacy formats are still VERIFIED (so nobody is locked out) and are
 * reported as needing an upgrade, so the caller rehashes on a successful
 * login:
 *   - 64 hex chars: single SHA-256 of `salt:password`
 *   - 16 hex chars: the old 64-bit non-crypto fallback (insecure contexts)
 * No new legacy hash is ever produced.
 */

export const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_HASH = 'SHA-512';
const PBKDF2_PREFIX = 'pbkdf2$sha512$';

export type PasswordCheck = 'ok' | 'ok-needs-upgrade' | 'mismatch';

function subtle(): SubtleCrypto | null {
  try {
    return typeof crypto !== 'undefined' && crypto?.subtle ? crypto.subtle : null;
  } catch {
    return null;
  }
}

/** True when this context can create/verify PBKDF2 hashes (secure context). */
export function canHashPasswords(): boolean {
  return subtle() !== null;
}

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare (equal length hex digests). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function makeSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function pbkdf2Hex(password: string, salt: string, iterations: number): Promise<string> {
  const s = subtle();
  if (!s) {
    throw new Error('Passwords can only be checked over a secure (https) connection on this device.');
  }
  const enc = new TextEncoder();
  const key = await s.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await s.deriveBits(
    { name: 'PBKDF2', hash: PBKDF2_HASH, salt: enc.encode(salt), iterations },
    key,
    512
  );
  return toHex(bits);
}

/** Create a new PBKDF2 hash for `password` (fresh salt). */
export async function createPasswordHash(password: string): Promise<{ hash: string; salt: string }> {
  const salt = makeSalt();
  const digest = await pbkdf2Hex(password, salt, PBKDF2_ITERATIONS);
  return { hash: `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${digest}`, salt };
}

async function legacySha256(password: string, salt: string): Promise<string | null> {
  const s = subtle();
  if (!s) return null;
  const digest = await s.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return toHex(digest);
}

function legacyFallback(password: string, salt: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const input = `${salt}:${password}`;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Check `password` against a stored hash in any supported format.
 * Throws only when a PBKDF2 hash cannot be checked (no WebCrypto).
 */
export async function checkPassword(password: string, storedHash: string, salt: string): Promise<PasswordCheck> {
  if (!storedHash) return 'mismatch';
  if (storedHash.startsWith(PBKDF2_PREFIX)) {
    const rest = storedHash.slice(PBKDF2_PREFIX.length);
    const sep = rest.indexOf('$');
    const iterations = Number(rest.slice(0, sep));
    const expected = rest.slice(sep + 1);
    if (sep < 0 || !Number.isFinite(iterations) || iterations < 1 || !expected) return 'mismatch';
    const actual = await pbkdf2Hex(password, salt, iterations);
    if (!safeEqual(actual, expected)) return 'mismatch';
    return iterations < PBKDF2_ITERATIONS ? 'ok-needs-upgrade' : 'ok';
  }
  // Legacy formats: verify, then ask the caller to rehash.
  if (storedHash.length === 64) {
    const sha = await legacySha256(password, salt);
    if (sha === null) {
      throw new Error('Passwords can only be checked over a secure (https) connection on this device.');
    }
    return safeEqual(sha, storedHash) ? 'ok-needs-upgrade' : 'mismatch';
  }
  if (storedHash.length === 16) {
    return safeEqual(legacyFallback(password, salt), storedHash) ? 'ok-needs-upgrade' : 'mismatch';
  }
  return 'mismatch';
}
