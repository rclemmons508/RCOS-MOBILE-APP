import { Request, Response } from 'express';
import admin from 'firebase-admin';

// Verifies the Firebase login token the phone app attaches to every API call
// (see src/lib/api.ts). The gate activates once FIREBASE_SERVICE_ACCOUNT is set
// in the environment (paste the service-account JSON from the Firebase console
// into your hosting provider's environment variables — never into the code).

let authReady = false;
// True when FIREBASE_SERVICE_ACCOUNT is set but unusable (not valid JSON
// or not a service-account key). The gate stays OFF in that case too —
// failing closed on a paste mistake would lock the owner out of their
// own app — but the diagnostics check reports it as FAIL, and the
// startup banner below makes it unmistakable.
let authMisconfigured = false;

function gateBanner(lines: string[]): void {
  const edge = '='.repeat(72);
  console.warn(`\n${edge}`);
  for (const line of lines) console.warn(`[auth] ${line}`);
  console.warn(`${edge}\n`);
}

export function initAuth(): void {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) {
    gateBanner([
      'LOGIN GATE IS OFF — THE API IS OPEN.',
      'FIREBASE_SERVICE_ACCOUNT is not set, so every /api route accepts',
      'calls with no login. Anyone who finds this server address can read',
      'and change business data.',
      'Set FIREBASE_SERVICE_ACCOUNT to turn the gate ON (see the login-gate',
      'steps). Until then, do NOT treat this server as private.',
    ]);
    return;
  }
  try {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(svc)) });
    authReady = true;
    console.log('[auth] Firebase Admin ready — API login gate is ON.');
  } catch (e) {
    authMisconfigured = true;
    gateBanner([
      'LOGIN GATE IS OFF — FIREBASE_SERVICE_ACCOUNT IS SET BUT UNUSABLE.',
      'The value could not be read as a service-account key (not valid JSON',
      'or not a key). The API is still accepting calls with no login.',
      'Re-paste the key into the hosting variables exactly as downloaded',
      '(one JSON object), then redeploy. Until the gate reports ON,',
      'do NOT treat this server as private.',
    ]);
    console.error('[auth] Could not start Firebase Admin.', e);
  }
}

export function isAuthReady(): boolean {
  return authReady;
}

// True only once FIREBASE_SERVICE_ACCOUNT is set and usable. This is
// the switch the per-business ownership checks in server.ts key off:
// gate OFF = today's behavior (everything below keeps working as-is);
// gate ON = a verified Firebase token is the only identity that counts.
export function isGateOn(): boolean {
  return authReady;
}

// The verified caller from a Firebase token, or null. Client-sent
// headers and body fields are NEVER a caller identity once the gate
// is on — they can be typed in by anyone.
export function verifiedCaller(req: Request): { uid?: string; email?: string | null } | null {
  const caller = (req as any).user as { uid?: string; email?: string | null } | undefined;
  if (!caller || (!caller.uid && !caller.email)) return null;
  return caller;
}

export function isAuthMisconfigured(): boolean {
  return authMisconfigured;
}

export async function requireAuth(req: Request, res: Response, next: () => void) {
  // Fail open (with the loud warning above) until the service account is configured,
  // so the app keeps working during setup. Once configured, bad/missing tokens are rejected.
  if (!authReady) return next();

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Please sign in to use this feature.' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = { uid: decoded.uid, email: decoded.email || null };
    return next();
  } catch {
    return res.status(401).json({ error: 'Your sign-in expired. Please sign in again.' });
  }
}
