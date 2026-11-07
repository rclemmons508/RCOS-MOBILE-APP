import { NextFunction, Request, Response } from 'express';
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

// Fail-closed switch (audit #1). In production (NODE_ENV=production) a
// missing or unusable FIREBASE_SERVICE_ACCOUNT no longer opens the API:
// every non-public /api route answers 503 until the gate is configured.
// The only way to run production with the gate off is the explicit
// opt-in ALLOW_OPEN_API=true (e.g. a short setup window). Outside
// production the old open-for-setup behavior is unchanged. The process
// still boots either way (no Railway restart loop) — public routes
// (health, intake/booking, demo form, team join, Twilio webhooks,
// voice-worker posts) keep working.
function isProduction(): boolean {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

export function isOpenApiAllowed(): boolean {
  return (process.env.ALLOW_OPEN_API || '').trim().toLowerCase() === 'true';
}

// True when the gate is not usable AND we must fail closed.
export function isApiLockedClosed(): boolean {
  return !authReady && isProduction() && !isOpenApiAllowed();
}

function gateBanner(lines: string[]): void {
  const edge = '='.repeat(72);
  console.warn(`\n${edge}`);
  for (const line of lines) console.warn(`[auth] ${line}`);
  console.warn(`${edge}\n`);
}

function lockedBanner(reason: string): void {
  const edge = '!'.repeat(72);
  console.error(`\n${edge}`);
  console.error(`[auth] LOGIN GATE UNAVAILABLE — API IS LOCKED (503) IN PRODUCTION.`);
  console.error(`[auth] ${reason}`);
  console.error('[auth] Every signed-in /api route now answers 503 until FIREBASE_SERVICE_ACCOUNT');
  console.error('[auth] is set to a valid service-account key and the server is redeployed.');
  console.error('[auth] Public routes (health, booking/intake, demo form, team join, Twilio');
  console.error('[auth] webhooks) keep working. To deliberately run OPEN (not recommended),');
  console.error('[auth] set ALLOW_OPEN_API=true.');
  console.error(`${edge}\n`);
}

export function initAuth(): void {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc && isProduction() && !isOpenApiAllowed()) {
    lockedBanner('FIREBASE_SERVICE_ACCOUNT is not set.');
    return;
  }
  if (!svc) {
    gateBanner([
      'LOGIN GATE IS OFF — MOST OF THE API IS OPEN.',
      'FIREBASE_SERVICE_ACCOUNT is not set, so most /api routes accept',
      'calls with no login. Anyone who finds this server address can read',
      'and change business data. EXCEPTION: the Gmail-token, Gmail',
      'send/draft, voice-token, team-message, delete-account, and',
      'quote/invoice routes stay closed — they need a verified Firebase',
      'sign-in, which is impossible until the gate is configured.',
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
    if (isProduction() && !isOpenApiAllowed()) {
      lockedBanner('FIREBASE_SERVICE_ACCOUNT is set but unusable (not valid service-account JSON).');
      console.error('[auth] Could not start Firebase Admin.', e);
      return;
    }
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

// Audit #9: the caller's email only counts as an identity when Firebase
// says it is verified (decoded.email_verified === true). Email/password
// self-signup does not prove ownership of the address, so an unverified
// email is kept aside as `unverifiedEmail` (for display only) and `email`
// is null — every owner/member EMAIL match in server.ts therefore requires
// verification. UID matches (business.ownerId / member userId) are
// unaffected, so an owner whose business records their uid is never
// locked out. Google sign-in tokens are always email_verified.
export function callerFromToken(decoded: { uid: string; email?: string; email_verified?: boolean }): {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  unverifiedEmail?: string;
} {
  const verified = decoded.email_verified === true;
  const email = decoded.email || null;
  return {
    uid: decoded.uid,
    email: verified ? email : null,
    emailVerified: verified,
    ...(email && !verified ? { unverifiedEmail: email } : {}),
  };
}

export function isAuthMisconfigured(): boolean {
  return authMisconfigured;
}

export async function requireAuth(req: Request, res: Response, next: () => void) {
  // Gate not configured: in production fail CLOSED (503) unless the
  // explicit ALLOW_OPEN_API=true opt-in is set; outside production fail
  // open (with the loud warning above) so local setup keeps working.
  // Once configured, bad/missing tokens are rejected.
  if (!authReady) {
    if (isApiLockedClosed()) {
      return res.status(503).json({
        error: 'The server login gate is not configured yet, so signed-in features are temporarily unavailable.',
        code: 'auth_gate_unavailable',
      });
    }
    return next();
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Please sign in to use this feature.' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = callerFromToken(decoded);
    return next();
  } catch {
    return res.status(401).json({ error: 'Your sign-in expired. Please sign in again.' });
  }
}

// Strict verified-identity gate for the routes that must NEVER accept a
// client-asserted identity — Gmail tokens, Gmail send/drafts, voice
// token minting, team-message posting, business deletion, and
// quote/invoice creation (C3, H9–H12, M9). Unlike requireAuth above,
// this does NOT fail open while the login gate is off: with no service
// account configured there is nothing that can verify a token, so the
// request is denied. That is the intended posture — these routes stay
// closed to local-session (gate-off) callers until the app signs into
// Firebase and the gate turns on. When the gate is on and requireAuth
// already verified the token, req.user is reused (only requireAuth ever
// sets req.user, and only after verifyIdToken), so the token is not
// verified twice.
export async function requireVerifiedAuth(req: Request, res: Response, next: NextFunction) {
  if (!authReady) {
    return res.status(401).json({ error: 'Please sign in to use this feature. Sign-in is not available until the login gate is configured.' });
  }
  const existing = (req as any).user as { uid?: string; email?: string | null } | undefined;
  if (existing && (existing.uid || existing.email)) return next();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Please sign in to use this feature.' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = callerFromToken(decoded);
    return next();
  } catch {
    return res.status(401).json({ error: 'Your sign-in expired. Please sign in again.' });
  }
}
