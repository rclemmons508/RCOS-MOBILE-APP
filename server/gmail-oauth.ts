/**
 * Gmail OAuth for the native Android app.
 *
 * Google does not allow logins inside an app's embedded browser, so the phone
 * app opens Google's real login page in a proper system browser tab. Google
 * then sends the user straight back into the RCOS app (custom scheme
 * "rcosmobile://gmail-connected"), so nobody gets stuck in a separate window.
 *
 * Flow:
 *   1. App opens  GET /oauth/gmail/start?businessId=..&state=..
 *   2. Server redirects to Google's consent screen (scopes = GMAIL_SCOPES).
 *   3. Google redirects to GET /oauth/gmail/callback?code=..&state=..
 *   4. Server swaps the code for tokens (client secret never leaves the server),
 *      saves them per business, and bounces the user back into the app.
 *   5. App calls GET /api/business/:id/gmail-token for a fresh access token.
 *
 * Needs in the environment:
 *   GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET  (Google Cloud, "Web application" client)
 *   APP_URL  (already used elsewhere, e.g. https://rcos-mobile-app-production.up.railway.app)
 * The Google Cloud client's "Authorized redirect URI" must be:
 *   {APP_URL}/oauth/gmail/callback
 */
import fs from 'fs';
import path from 'path';
import type { Express, Request, Response } from 'express';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const TOKEN_FILE = path.join(DATA_DIR, 'gmail_tokens.json');

// Same mailbox scopes the app already uses (src/lib/firebase.ts GMAIL_SCOPES).
const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
];

const APP_SCHEME_RETURN = 'rcosmobile://gmail-connected?ok=1';

interface GmailTokenRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  updatedAt: string;
}

// One-time login states: state -> { businessId, createdAt }. Single-use, 10-min TTL.
const pendingStates = new Map<string, { businessId: string; createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

function getOAuthConfig() {
  const clientId = (process.env.GMAIL_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GMAIL_OAUTH_CLIENT_SECRET || '').trim();
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  return { clientId, clientSecret, redirectUri: appUrl ? `${appUrl}/oauth/gmail/callback` : '' };
}

function loadTokens(): Record<string, GmailTokenRecord> {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8')) || {};
    }
  } catch { /* corrupted file -> start fresh */ }
  return {};
}

function saveTokens(store: Record<string, GmailTokenRecord>) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('[gmail-oauth] could not save tokens:', (e as Error)?.message);
  }
}

function setupMissingPage(): string {
  return `<!doctype html><html><body style="font-family:sans-serif;padding:40px;max-width:560px;margin:auto">`
    + `<h1>Gmail login is not set up yet</h1>`
    + `<p>The server is missing its Google login settings. In Railway, open the RCOS-MOBILE-APP service, `
    + `go to Variables, and add <b>GMAIL_OAUTH_CLIENT_ID</b> and <b>GMAIL_OAUTH_CLIENT_SECRET</b>, then try again.</p>`
    + `</body></html>`;
}

/** Public routes (NOT under /api, so the login gate never applies). */
export function registerGmailOAuthPublic(app: Express) {
  // Step 1+2: verify setup, remember the login attempt, send the user to Google.
  app.get('/oauth/gmail/start', (req: Request, res: Response) => {
    const { clientId, redirectUri } = getOAuthConfig();
    const businessId = String(req.query.businessId || '').trim();
    const state = String(req.query.state || '').trim();
    if (!clientId || !redirectUri) {
      return res.status(500).send(setupMissingPage());
    }
    if (!businessId || !state) {
      return res.status(400).send('Missing businessId or state.');
    }
    pendingStates.set(state, { businessId, createdAt: Date.now() });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
  });

  // Step 3+4: Google returns here. Swap the code for tokens, save them, bounce back to the app.
  app.get('/oauth/gmail/callback', async (req: Request, res: Response) => {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const pending = pendingStates.get(state);
    pendingStates.delete(state);
    if (!pending || Date.now() - pending.createdAt > STATE_TTL_MS) {
      return res.status(400).send(
        '<!doctype html><html><body style="font-family:sans-serif;padding:40px">'
        + '<h1>This login link expired</h1><p>Please go back to the RCOS app and tap "Connect Gmail" again.</p>'
        + '</body></html>');
    }
    if (!code) {
      return res.status(400).send(
        '<!doctype html><html><body style="font-family:sans-serif;padding:40px">'
        + '<h1>Login was cancelled</h1><p>No problem — go back to the RCOS app and try again whenever you like.</p>'
        + '</body></html>');
    }
    const { clientId, clientSecret, redirectUri } = getOAuthConfig();
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) throw new Error('Token exchange failed (HTTP ' + tokenRes.status + ')');
      const tokens = (await tokenRes.json()) as any;

      let email = '';
      try {
        const prof = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (prof.ok) email = ((await prof.json()) as any).emailAddress || '';
      } catch { /* email is nice-to-have */ }

      const store = loadTokens();
      const prev = store[pending.businessId];
      store[pending.businessId] = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || prev?.refreshToken || '',
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
        email,
        updatedAt: new Date().toISOString(),
      };
      saveTokens(store);
    } catch (e) {
      console.error('[gmail-oauth] callback failed:', (e as Error)?.message);
      return res.status(500).send(
        '<!doctype html><html><body style="font-family:sans-serif;padding:40px">'
        + '<h1>Gmail login hit a snag</h1><p>Please go back to the RCOS app and try again.</p>'
        + '</body></html>');
    }
    // Bounce straight back into the app. The link below is a fallback in case
    // the automatic handoff does not fire on some devices.
    res.send(
      '<!doctype html><html><head><meta http-equiv="refresh" content="1;url=' + APP_SCHEME_RETURN + '"></head>'
      + '<body style="font-family:sans-serif;padding:40px;text-align:center">'
      + '<h1>You are connected!</h1><p>Taking you back to the RCOS app…</p>'
      + '<p><a href="' + APP_SCHEME_RETURN + '">Tap here if the app does not open</a></p>'
      + '</body></html>');
  });
}

/**
 * Returns a fresh access token for the business, refreshing it with Google
 * when it is expired (or about to expire). Used by the gated API route below.
 */
export async function getGmailAccessToken(businessId: string): Promise<{ accessToken: string; email: string } | null> {
  const store = loadTokens();
  const rec = store[businessId];
  if (!rec || !rec.accessToken) return null;
  if (rec.expiresAt - Date.now() > 60_000) {
    return { accessToken: rec.accessToken, email: rec.email };
  }
  const { clientId, clientSecret } = getOAuthConfig();
  if (!rec.refreshToken || !clientId || !clientSecret) {
    return { accessToken: rec.accessToken, email: rec.email }; // best effort
  }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: rec.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!r.ok) throw new Error('refresh failed (HTTP ' + r.status + ')');
    const t = (await r.json()) as any;
    rec.accessToken = t.access_token;
    rec.expiresAt = Date.now() + (t.expires_in || 3600) * 1000;
    saveTokens({ ...store, [businessId]: rec });
  } catch (e) {
    console.warn('[gmail-oauth] token refresh failed:', (e as Error)?.message);
  }
  return { accessToken: rec.accessToken, email: rec.email };
}
