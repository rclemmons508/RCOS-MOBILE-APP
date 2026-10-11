import { Request, Response } from 'express';
import admin from 'firebase-admin';

// Verifies the Firebase login token the phone app attaches to every API call
// (see src/lib/api.ts). The gate activates once FIREBASE_SERVICE_ACCOUNT is set
// in the environment (paste the service-account JSON from the Firebase console
// into your hosting provider's environment variables — never into the code).

let authReady = false;

export function initAuth(): void {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) {
    console.warn(
      '[auth] FIREBASE_SERVICE_ACCOUNT is not set — the API login gate is OFF. ' +
      'Set it to require login on all /api routes.'
    );
    return;
  }
  try {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(svc)) });
    authReady = true;
    console.log('[auth] Firebase Admin ready — API login gate is ON.');
  } catch (e) {
    console.error('[auth] Could not start Firebase Admin. Login gate is OFF.', e);
  }
}

export function isAuthReady(): boolean {
  return authReady;
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
