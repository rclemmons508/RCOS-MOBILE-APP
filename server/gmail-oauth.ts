/**
 * Gmail OAuth for the native Android app.
 *
 * Google does not allow logins inside an app's embedded browser, so the phone
 * app opens Google's real login page in a proper system browser tab. Google
 * then sends the user straight back into the RCOS app (custom scheme
 * "rcosmobile://gmail-connected"), so nobody gets stuck in a separate window.
 *
 * Flow (audit #10 — the login is bound to the signed-in user):
 *   0. App calls  POST /api/business/:id/gmail/oauth-start  (verified Firebase
 *      sign-in, member of the business). The server mints a signed, single-use
 *      state bound to { businessId, verified email, uid } with a 10-min expiry
 *      and returns { url } = {APP_URL}/oauth/gmail/start?state=<state>.
 *   1. App opens that url (GET /oauth/gmail/start?state=..).
 *      LEGACY: the pre-fix client opens /oauth/gmail/start?businessId=..&
 *      userEmail=..&state=<client-chosen>. That still works unless
 *      GMAIL_OAUTH_ALLOW_LEGACY_START=false, but in BOTH flows the callback
 *      now refuses to store anything unless the Gmail account that consented
 *      is the same address the login was bound to — so a start link minted by
 *      someone else can never capture a victim's mailbox.
 *   2. Server redirects to Google's consent screen (scopes = GMAIL_SCOPES).
 *   3. Google redirects to GET /oauth/gmail/callback?code=..&state=..
 *   4. Server swaps the code for tokens (client secret never leaves the server),
 *      saves them per business AND per user, and bounces the user back into the app.
 *   5. App calls GET /api/business/:id/gmail-token for a fresh access token.
 *
 * Tokens are stored per user: the store key is "businessId::userEmail", so
 * every person on a team connects and sees ONLY their own Gmail. A pre-fix
 * record stored under the bare businessId is honored ONLY for the user whose
 * email matches the address recorded on it (see getGmailAccessToken).
 *
 * Needs in the environment:
 *   GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET  (Google Cloud, "Web application" client)
 *   APP_URL  (already used elsewhere, e.g. https://rcos-mobile-app-production.up.railway.app)
 * The Google Cloud client's "Authorized redirect URI" must be:
 *   {APP_URL}/oauth/gmail/callback
 */
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
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

// One-time login states: state -> binding. Single-use, 10-min TTL, capped
// (audit #22: swept on a timer and on insert, so anonymous /start calls
// cannot grow memory without bound).
type PendingState = { businessId: string; userEmail: string; uid?: string; createdAt: number; kind: 'server' | 'legacy' };
const pendingStates = new Map<string, PendingState>();
const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING_STATES = 2000;

function sweepPendingStates(): void {
  const now = Date.now();
  for (const [k, v] of pendingStates) {
    if (now - v.createdAt > STATE_TTL_MS) pendingStates.delete(k);
  }
}
setInterval(sweepPendingStates, 60_000).unref();

function rememberState(state: string, binding: PendingState): boolean {
  if (pendingStates.size >= MAX_PENDING_STATES) sweepPendingStates();
  if (pendingStates.size >= MAX_PENDING_STATES) return false;
  pendingStates.set(state, binding);
  return true;
}

// Server-issued states are HMAC-signed so a forged/garbled one is rejected
// before any lookup. The signing key is per-process random (states only
// live 10 minutes in this process's memory anyway).
const STATE_SIGNING_KEY = crypto.randomBytes(32);
function signState(nonce: string): string {
  return crypto.createHmac('sha256', STATE_SIGNING_KEY).update(nonce).digest('base64url');
}
function isServerSignedState(state: string): boolean {
  const dot = state.indexOf('.');
  if (dot <= 0) return false;
  const nonce = state.slice(0, dot);
  const sig = Buffer.from(state.slice(dot + 1));
  const expected = Buffer.from(signState(nonce));
  return sig.length === expected.length && crypto.timingSafeEqual(sig, expected);
}

function legacyStartAllowed(): boolean {
  return (process.env.GMAIL_OAUTH_ALLOW_LEGACY_START || '').trim().toLowerCase() !== 'false';
}

/**
 * Mints a single-use Gmail login state bound to the VERIFIED caller
 * (called from the authenticated POST /api/business/:id/gmail/oauth-start).
 * Returns null when the in-memory state table is full.
 */
export function createGmailOAuthState(businessId: string, userEmail: string, uid?: string): { state: string; url: string; expiresAt: string } | null {
  const email = normalizeEmail(userEmail);
  if (!businessId || !email) return null;
  const nonce = crypto.randomBytes(24).toString('base64url');
  const state = `${nonce}.${signState(nonce)}`;
  const createdAt = Date.now();
  if (!rememberState(state, { businessId, userEmail: email, uid, createdAt, kind: 'server' })) return null;
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  return {
    state,
    url: `${appUrl}/oauth/gmail/start?state=${encodeURIComponent(state)}`,
    expiresAt: new Date(createdAt + STATE_TTL_MS).toISOString(),
  };
}

function htmlEscape(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Normalizes an email for storage keys and comparisons. */
function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

/** Per-user token record key: every person on a team gets their own record. */
function tokenKey(businessId: string, userEmail: string): string {
  return `${businessId}::${normalizeEmail(userEmail)}`;
}

function getOAuthConfig() {
  const clientId = (process.env.GMAIL_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GMAIL_OAUTH_CLIENT_SECRET || '').trim();
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  return { clientId, clientSecret, redirectUri: appUrl ? `${appUrl}/oauth/gmail/callback` : '' };
}

// ---- Token store encryption at rest (audit #21) ----
// With TOKEN_ENCRYPTION_KEY set (32 bytes as 64 hex chars or base64 —
// generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"),
// gmail_tokens.json is written as one AES-256-GCM envelope:
//   { "__enc": "aes-256-gcm", "v": 1, "iv": b64, "tag": b64, "data": b64 }
// A legacy plaintext file is read transparently and re-written encrypted on
// the next save. Without the key the file stays plaintext (warned once).
// An encrypted file that cannot be decrypted (key missing/wrong) or a
// corrupt file is NEVER replaced: reads throw and writes are refused, so
// a config mistake cannot wipe everyone's Gmail connections (audit #23).
type EncryptedEnvelope = { __enc: 'aes-256-gcm'; v: 1; iv: string; tag: string; data: string };

let warnedNoKey = false;
function tokenKeyBytes(): Buffer | null {
  const raw = (process.env.TOKEN_ENCRYPTION_KEY || '').trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  try {
    const b = Buffer.from(raw, 'base64');
    if (b.length === 32) return b;
  } catch { /* fall through */ }
  // Any other non-empty value: derive a 32-byte key (still secret, just
  // not the recommended format).
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

function encryptStore(store: Record<string, GmailTokenRecord>, key: Buffer): EncryptedEnvelope {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(store), 'utf8'), cipher.final()]);
  return { __enc: 'aes-256-gcm', v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

function decryptStore(env: EncryptedEnvelope, key: Buffer): Record<string, GmailTokenRecord> {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(env.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(env.data, 'base64')), decipher.final()]).toString('utf8');
  return JSON.parse(plain) || {};
}

export class GmailTokenStoreError extends Error {}

function loadTokens(): Record<string, GmailTokenRecord> {
  if (!fs.existsSync(TOKEN_FILE)) return {};
  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  } catch (e) {
    throw new GmailTokenStoreError(`gmail_tokens.json is unreadable (${(e as Error)?.message}); refusing to overwrite it.`);
  }
  if (parsed && typeof parsed === 'object' && parsed.__enc === 'aes-256-gcm') {
    const key = tokenKeyBytes();
    if (!key) throw new GmailTokenStoreError('gmail_tokens.json is encrypted but TOKEN_ENCRYPTION_KEY is not set.');
    try {
      return decryptStore(parsed as EncryptedEnvelope, key);
    } catch {
      throw new GmailTokenStoreError('gmail_tokens.json could not be decrypted with TOKEN_ENCRYPTION_KEY (wrong key?).');
    }
  }
  return (parsed && typeof parsed === 'object') ? parsed : {}; // legacy plaintext
}

function saveTokens(store: Record<string, GmailTokenRecord>) {
  const key = tokenKeyBytes();
  if (!key && !warnedNoKey) {
    warnedNoKey = true;
    console.warn('[gmail-oauth] TOKEN_ENCRYPTION_KEY is not set — Gmail tokens are stored UNENCRYPTED. Set it to a 32-byte key (64 hex chars).');
  }
  const body = JSON.stringify(key ? encryptStore(store, key) : store, null, 2);
  // Atomic write (temp file + rename), owner-only permissions. Errors are
  // rethrown so callers report failure instead of a false success.
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${TOKEN_FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, body, { mode: 0o600 });
    fs.renameSync(tmp, TOKEN_FILE);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    console.error('[gmail-oauth] could not save tokens:', (e as Error)?.message);
    throw e;
  }
}

// Load-modify-save on the CURRENT file contents (no stale whole-store writes).
function updateTokens(mutate: (store: Record<string, GmailTokenRecord>) => void): void {
  const store = loadTokens();
  mutate(store);
  saveTokens(store);
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
    const state = String(req.query.state || '').trim().slice(0, 300);
    if (!clientId || !redirectUri) {
      return res.status(500).send(setupMissingPage());
    }
    if (!state) {
      return res.status(400).send('Missing state. Go back to the RCOS app and tap "Connect Gmail" again.');
    }
    if (isServerSignedState(state)) {
      // Server-issued (bound) state: everything comes from the binding;
      // businessId/userEmail query params are ignored.
      const pending = pendingStates.get(state);
      if (!pending || pending.kind !== 'server' || Date.now() - pending.createdAt > STATE_TTL_MS) {
        pendingStates.delete(state);
        return res.status(400).send('This Gmail login link expired. Go back to the RCOS app and tap "Connect Gmail" again.');
      }
    } else {
      // LEGACY client flow (pre-fix app builds). Still allowed unless
      // GMAIL_OAUTH_ALLOW_LEGACY_START=false; the callback's mailbox check
      // is what makes it safe.
      if (!legacyStartAllowed()) {
        return res.status(400).send('Please update the RCOS app, then tap "Connect Gmail" again.');
      }
      const businessId = String(req.query.businessId || '').trim().slice(0, 128);
      const userEmail = normalizeEmail(req.query.userEmail);
      if (!businessId) {
        return res.status(400).send('Missing businessId or state.');
      }
      // The token must be stored for the person connecting it — never for the
      // business as a whole. Without the connecting user's email there is
      // nowhere safe to save the result, so refuse rather than fall back to
      // the old business-only storage (that is what leaked one person's
      // Gmail to every teammate).
      if (!userEmail) {
        return res.status(400).send('Missing userEmail. Sign in to the app first, then tap "Connect Gmail" again.');
      }
      if (pendingStates.has(state)) {
        return res.status(400).send('This Gmail login link was already used. Go back to the RCOS app and tap "Connect Gmail" again.');
      }
      if (!rememberState(state, { businessId, userEmail, createdAt: Date.now(), kind: 'legacy' })) {
        return res.status(503).send('Too many Gmail logins in progress. Please try again in a few minutes.');
      }
    }
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
    let mismatch: { connected: string; expected: string } | null = null;
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        signal: AbortSignal.timeout(15_000),
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
      if (!tokenRes.ok) {
        let detail = '';
        try {
          const errBody = (await tokenRes.json()) as any;
          if (errBody?.error) {
            detail = ` (Google said: ${errBody.error}${errBody.error_description ? ' — ' + errBody.error_description : ''})`;
          }
        } catch { /* keep the generic message */ }
        throw new Error('Token exchange failed (HTTP ' + tokenRes.status + ')' + detail);
      }
      const tokens = (await tokenRes.json()) as any;

      // The Gmail account that consented MUST be the account this login
      // was bound to (audit #10). Without a confirmed match nothing is
      // stored — otherwise a start link minted for someone else's
      // business/email could capture the victim's mailbox.
      let email = '';
      try {
        const prof = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          signal: AbortSignal.timeout(15_000),
        });
        if (prof.ok) email = ((await prof.json()) as any).emailAddress || '';
      } catch { /* handled below: no confirmed email = no save */ }
      if (!email) {
        throw new Error('Could not confirm which Gmail account was connected.');
      }
      if (normalizeEmail(email) !== pending.userEmail) {
        mismatch = { connected: normalizeEmail(email), expected: pending.userEmail };
        // Best effort: revoke the grant we are not going to keep.
        fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(tokens.refresh_token || tokens.access_token), {
          method: 'POST', signal: AbortSignal.timeout(10_000),
        }).catch(() => { /* ignore */ });
        throw new Error('mailbox mismatch');
      }

      updateTokens((store) => {
        const key = tokenKey(pending.businessId, pending.userEmail);
        const prev = store[key];
        // Refresh-token continuity: Google only sends a refresh token on some
        // logins. Reuse the previous per-user record's token; as a last resort,
        // the pre-fix business-only record — but ONLY when that record's email
        // matches the Gmail account that was just connected (never hand one
        // person's refresh token to another).
        const legacy = store[pending.businessId];
        const legacyOk =
          legacy && normalizeEmail(legacy.email) !== '' &&
          normalizeEmail(legacy.email) === normalizeEmail(email);
        store[key] = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || prev?.refreshToken || (legacyOk ? legacy.refreshToken : '') || '',
          expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
          email,
          updatedAt: new Date().toISOString(),
        };
      });
    } catch (e) {
      if (mismatch) {
        return res.status(403).send(
          '<!doctype html><html><body style="font-family:sans-serif;padding:40px">'
          + '<h1>That is a different Gmail account</h1>'
          + '<p>You signed in to Google as <b>' + htmlEscape(mismatch.connected) + '</b>, but this RCOS login is for <b>'
          + htmlEscape(mismatch.expected) + '</b>. Nothing was connected.</p>'
          + '<p>Go back to the RCOS app and tap "Connect Gmail" again, choosing the Gmail account that matches your RCOS sign-in.</p>'
          + '</body></html>');
      }
      console.error('[gmail-oauth] callback failed:', (e as Error)?.message);
      const reason = String((e as Error)?.message || 'Unknown error')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return res.status(500).send(
        '<!doctype html><html><body style="font-family:sans-serif;padding:40px">'
        + '<h1>Gmail login hit a snag</h1><p>Please go back to the RCOS app and try again.</p>'
        + '<p style="color:#666">Reason: ' + reason + '</p>'
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

/** Remove the stored Gmail tokens for one business (used by account deletion).
 * Deletes the pre-fix business-only record AND every per-user record for
 * the business, so nobody's Gmail token is left behind. */
export function deleteGmailTokens(businessId: string): void {
  try {
    const store = loadTokens();
    const prefix = `${businessId}::`;
    const keys = Object.keys(store).filter((k) => k === businessId || k.startsWith(prefix));
    if (keys.length === 0) return;
    for (const k of keys) delete store[k];
    saveTokens(store);
  } catch (e) {
    console.error('[gmail-oauth] could not delete Gmail tokens for a deleted business:', (e as Error)?.message);
  }
}

/** Freshens one record's access token when expired, saving under its own key. */
async function freshAccessToken(
  store: Record<string, GmailTokenRecord>,
  key: string,
  rec: GmailTokenRecord
): Promise<{ accessToken: string; email: string }> {
  if (rec.expiresAt - Date.now() > 60_000) {
    return { accessToken: rec.accessToken, email: rec.email };
  }
  const { clientId, clientSecret } = getOAuthConfig();
  if (!rec.refreshToken || !clientId || !clientSecret) {
    return { accessToken: rec.accessToken, email: rec.email }; // best effort
  }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      signal: AbortSignal.timeout(15_000),
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
    updateTokens((current) => {
      current[key] = { ...(current[key] || rec), accessToken: rec.accessToken, expiresAt: rec.expiresAt };
    });
  } catch (e) {
    console.warn('[gmail-oauth] token refresh failed:', (e as Error)?.message);
  }
  return { accessToken: rec.accessToken, email: rec.email };
}

/**
 * Returns a fresh access token for ONE person's connected Gmail in this
 * business — never another user's. The lookup is the per-user record
 * (businessId::userEmail). A pre-fix record stored under the bare
 * businessId is honored ONLY when its stored email matches the requester,
 * so the existing owner keeps their connection while teammates get
 * nothing of it. Returns null for an unknown/empty requester or when the
 * requester has not connected Gmail.
 */
export async function getGmailAccessToken(
  businessId: string,
  userEmail: string
): Promise<{ accessToken: string; email: string } | null> {
  const requester = normalizeEmail(userEmail);
  if (!requester) return null;
  const store = loadTokens();
  const perUser = store[tokenKey(businessId, requester)];
  if (perUser && perUser.accessToken) {
    return freshAccessToken(store, tokenKey(businessId, requester), perUser);
  }
  // Legacy migration: the old record belongs to exactly one Gmail address.
  // Hand it back only to that same person — never to a different teammate.
  const legacy = store[businessId];
  if (legacy && legacy.accessToken && normalizeEmail(legacy.email) !== '') {
    if (normalizeEmail(legacy.email) !== requester) return null;
    return freshAccessToken(store, businessId, legacy);
  }
  return null;
}
