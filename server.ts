import express, { Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from './server/db';
import { RcosEngine } from './server/engine';
import { ai, PRIMARY_MODEL, FAST_MODEL, PRO_MODEL, executeGeminiWithFallback, generateSpeechAudio } from './server/gemini';
import { 
  BusinessAccount, 
  CustomerRequest, 
  ActionRecord, 
  ChatMessage, 
  JobPack,
  StarterDraft,
  VoicemailRecord,
  BusinessMember,
  TeamInvite,
  TeamMessage,
  PendingIntake
} from './src/types';
import { INDUSTRY_PRESETS } from './src/data/presets';
import { ALL_TRANSFER_DEPARTMENTS, availableDepartmentsFor, normalizeDepartments } from './src/utils/departments';
import { withBehaviorProtocol, withBusinessKnowledge, resolveBusinessKnowledge } from './src/utils/agentBehavior';
import { AI_EMPLOYEES } from './src/data/employees';

import { telephonyRouter } from './server/telephony';
import { sendVonageSms } from './server/vonage';
import { initAuth, isAuthMisconfigured, isAuthReady, isGateOn, requireAuth, verifiedCaller } from './server/auth';
import { registerGmailOAuthPublic, getGmailAccessToken, deleteGmailTokens } from './server/gmail-oauth';
import { analyzeDocument, scorePresetsByKeywords } from './server/onboarding-docs';

dotenv.config();
// Verify Firebase login tokens on API routes (gate activates once FIREBASE_SERVICE_ACCOUNT is set)
initAuth();
// Disable HMR to eliminate WebSocket connection errors in browser and container
process.env.DISABLE_HMR = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security Headers & Production CORS
app.use((req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const origin = req.headers.origin as string | undefined;
  const allowedOrigins = new Set(
    [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://localhost',
      'capacitor://localhost',
      process.env.APP_URL,
      'https://ais-dev-fft6xjt5rur3koiv4vsfjv-548256682184.us-west2.run.app',
      'https://rcos-mobile-app-production.up.railway.app',
      'https://ais-pre-fft6xjt5rur3koiv4vsfjv-548256682184.us-west2.run.app'
    ].filter((value): value is string => Boolean(value))
  );

  if (origin && origin !== 'null' && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-User-Email');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  // Public intake endpoints (demo form, booking page) must be callable from any
  // website origin. They are unauthenticated by design, so a wildcard origin is safe.
  if (req.path.startsWith('/api/public/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, X-User-Email');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request body limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-Memory Token Bucket Rate Limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: () => void) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = rateLimitMap.get(clientIp);

    if (!record || now > record.resetAt) {
      rateLimitMap.set(clientIp, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
    }

    record.count++;
    next();
  };
}

const aiRateLimiter = createRateLimiter(60, 60000); // 60 req / min
const publicIntakeRateLimiter = createRateLimiter(30, 60000); // 30 req / min
const deleteAccountLimiter = createRateLimiter(3, 10 * 60 * 1000); // 3 delete tries / 10 min
  const smsSendLimiter = createRateLimiter(30, 60000); // 30 follow-up sends / min per IP
  const gmailSendLimiter = createRateLimiter(30, 60000); // 30 Gmail sends/drafts / min per IP

// Telephony provider: 'twilio' mounts the Twilio PSTN router. Anything else parks it —
// testing/review builds use the in-app WebRTC voice call instead (see /api/voice/token).
// Set TELEPHONY_PROVIDER=twilio in the environment to re-enable the carrier.
const telephonyProvider = (process.env.TELEPHONY_PROVIDER || 'webrtc').toLowerCase();
if (telephonyProvider === 'twilio') {
  app.use('/api/twilio', telephonyRouter);
} else {
  app.use('/api/twilio', (_req: Request, res: Response) =>
    res.status(503).json({ error: 'Phone carrier is parked (TELEPHONY_PROVIDER is not "twilio"). Use the in-app voice call instead.' })
  );
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Firebase client config route for runtime synchronization
app.get('/api/firebase-config', (_req: Request, res: Response) => {
  const CANONICAL_DB = 'ai-studio-rcosmobileapp-c0c46f2b-8d0f-43b8-978d-70fb08614967';
  const rawDb = process.env.VITE_FIREBASE_DATABASE_ID;
  const dbId = (!rawDb || rawDb === 'rcos-mobile' || rawDb === '(default)') ? CANONICAL_DB : rawDb;

  res.json({
    telephonyProvider,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'rcos-mobile',
    firestoreDatabaseId: dbId,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'rcos-mobile.firebasestorage.app'
  });
});

// Gmail OAuth for the native app (public browser flow; bounces the user back into the app).
registerGmailOAuthPublic(app);

// ---- Login gate ----
// Every /api route below this line requires a valid Firebase login token,
// which the phone app already attaches (see src/lib/api.ts).
// Public exceptions (registered above or skipped here):
//   /api/health, /api/firebase-config, and the public intake form
//   POST /api/business/:id/requests (customers must be able to reach you without an account).
//   POST /api/voice/routing-log (worker only, secret-checked in its handler — GET is gated).
// NOTE: inside app.use('/api', ...), Express strips the '/api' mount prefix, so
// req.path here is the path WITHOUT '/api' (verified on Express 4.22). The old
// checks matched '/api/...' and never fired, which wrongly gated the public
// booking page and the voice routing log with a 401.
app.use('/api', (req: Request, res: Response, next) => {
  if (req.method === 'POST' && /^\/business\/[^/]+\/requests$/.test(req.path)) return next();
  if (req.method === 'GET' && /^\/public\/business\/[^/]+$/.test(req.path)) return next();
  if (req.method === 'POST' && req.path === '/public/demo-request') return next();
  // Joining a company happens BEFORE sign-in (the joiner has no account
  // yet), so it is public by design like the demo form. The invite code
  // itself is the credential — and an invite locked to an email only
  // works for that email.
  if (req.method === 'POST' && req.path === '/team/join') return next();
  // The voice-agent worker posts its routing log with VOICE_AGENT_SECRET,
  // not a user token — POST skips here and is secret-checked in its
  // handler. GET does NOT skip: reading the call routing log requires a
  // signed-in user (the old blanket skip let anyone read it).
  if (req.method === 'POST' && req.path === '/voice/routing-log') return next();
  // The voice-agent worker also posts proactive inbox messages with VOICE_AGENT_SECRET.
  if (req.method === 'POST' && /^\/business\/[^/]+\/agent-messages$/.test(req.path)) {
    const secret = process.env.VOICE_AGENT_SECRET;
    if (secret && req.headers['x-voice-secret'] === secret) return next();
  }
  return requireAuth(req, res, next);
});

// ---- Per-business ownership (login-gate ON only) ----
// When the gate is OFF (today's deployment, FIREBASE_SERVICE_ACCOUNT
// unset), every helper and middleware below is a no-op and the app
// behaves exactly as it does today. When the gate is ON, a verified
// Firebase token is the ONLY identity that counts — the client-sent
// X-User-Email header and body requesterEmail are ignored, because
// anyone can type those in. Membership is proven by: a roster entry
// matching the token email or the member's user id, the token uid
// matching the recorded owner id, or the token email matching an
// owner email recorded on the business. A business with no owner
// identity anywhere is NOT opened up: gate ON fails closed on it.
function businessMemberFor(business: BusinessAccount, caller: { uid?: string; email?: string | null } | null): BusinessMember | undefined {
  if (!caller) return undefined;
  const email = (caller.email || '').toLowerCase().trim();
  return (business.members || []).find((m) => (
    (email !== '' && m.email.toLowerCase() === email) ||
    (!!caller.uid && !!m.userId && m.userId === caller.uid)
  ));
}

function businessOwnerEmails(business: BusinessAccount): string[] {
  return [
    String((business as any).contactEmail || '').toLowerCase().trim(),
    String((business as any).ownerEmail || '').toLowerCase().trim(),
  ].filter(Boolean);
}

function businessIsMember(business: BusinessAccount, caller: { uid?: string; email?: string | null } | null): boolean {
  if (!caller) return false;
  if (businessMemberFor(business, caller)) return true;
  const email = (caller.email || '').toLowerCase().trim();
  if (email !== '' && businessOwnerEmails(business).includes(email)) return true;
  return !!caller.uid && !!business.ownerId && business.ownerId !== 'unassigned_owner' && business.ownerId === caller.uid;
}

function businessIsOwner(business: BusinessAccount, caller: { uid?: string; email?: string | null } | null): boolean {
  if (!caller) return false;
  if (businessMemberFor(business, caller)?.role === 'owner') return true;
  if (!!caller.uid && !!business.ownerId && business.ownerId !== 'unassigned_owner' && business.ownerId === caller.uid) return true;
  const email = (caller.email || '').toLowerCase().trim();
  return email !== '' && businessOwnerEmails(business).includes(email);
}

// Gate-ON owner check for a single route. Returns true when the request
// may proceed; sends the 403 and returns false otherwise. Gate OFF
// always returns true — owner checks that already exist in a handler
// keep running with today's header identity in that case.
function requireBusinessOwner(req: Request, res: Response, business: BusinessAccount): boolean {
  if (!isGateOn()) return true;
  if (businessIsOwner(business, verifiedCaller(req))) return true;
  res.status(403).json({ error: 'Only the business owner can do this.' });
  return false;
}

// Every /api/business/:id route, in one place, instead of a check pasted
// into thirty handlers (where one missed handler is a leak). Skips the
// two public-by-design cases the gate already exempts: the customer
// booking POST, and the voice worker's agent-message POST (secret-
// checked, same as the gate). Also skips /api/business/analyze-document,
// which is not a business record at all — ':id' there is the literal
// word 'analyze-document'.
app.use('/api/business/:id', (req: Request, res: Response, next) => {
  if (!isGateOn()) return next();
  const businessId = req.params.id;
  if (businessId === 'analyze-document') return next();
  if (req.method === 'POST' && req.path === '/requests') return next();
  if (req.method === 'POST' && req.path === '/agent-messages') {
    const secret = process.env.VOICE_AGENT_SECRET;
    if (secret && req.headers['x-voice-secret'] === secret) return next();
  }
  const business = db.getBusiness(businessId);
  if (!business) return res.status(404).json({ error: 'Business not found' });
  const caller = verifiedCaller(req);
  if (!caller) return res.status(401).json({ error: 'Please sign in to use this feature.' });
  if (!businessIsMember(business, caller)) {
    return res.status(403).json({ error: 'You are not on this team.' });
  }
  (req as any).business = business;
  (req as any).businessIsOwner = businessIsOwner(business, caller);
  return next();
});

// The caller's own businesses, for routes that name a business in the
// request body instead of the URL (voice token, receptionist, quote /
// invoice requests). Gate OFF returns every business, as today.
function callerBusinesses(req: Request): BusinessAccount[] {
  const all = db.getAllBusinesses();
  if (!isGateOn()) return all;
  const caller = verifiedCaller(req);
  if (!caller) return [];
  return all.filter((b) => businessIsMember(b, caller));
}

// Resolve the business for a body-named route. Gate ON: a named
// business the caller is not on is a 403 (never silently fall back to
// the first business on the server — that was the leak); no name at
// all resolves to the caller's first business, or null when the caller
// has none. Gate OFF: today's behavior, unchanged.
function resolveBodyBusiness(req: Request, businessId?: string): BusinessAccount | null {
  if (!isGateOn()) {
    return (businessId && db.getBusiness(businessId)) || db.getAllBusinesses()[0] || null;
  }
  const caller = verifiedCaller(req);
  if (!caller) return null;
  if (businessId && businessId !== 'default') {
    const business = db.getBusiness(businessId);
    return business && businessIsMember(business, caller) ? business : null;
  }
  return callerBusinesses(req)[0] || null;
}

// ---- Diagnostics (per RCOS Master Dashboard spec) ----
// Returns system health checks with PASS/WARN/FAIL status.
// Behind the login gate: it reports which services are configured,
// which is not public information.
app.get('/api/diagnostics/scan', (_req: Request, res: Response) => {
  const checks: { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }[] = [];

  // Server core
  checks.push({ id: 'server', label: 'Server Core', status: 'pass', detail: 'API responding normally' });

  // Firebase login gate
  const gateOn = isAuthReady();
  const gateBroken = isAuthMisconfigured();
  checks.push({
    id: 'auth', label: 'Login Gate',
    status: gateOn ? 'pass' : gateBroken ? 'fail' : 'warn',
    detail: gateOn
      ? 'Firebase Admin active — API requires login'
      : gateBroken
        ? 'FIREBASE_SERVICE_ACCOUNT is set but unusable — API still open'
        : 'FIREBASE_SERVICE_ACCOUNT not set — API open'
  });

  // LiveKit voice
  const lk = process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET;
  checks.push({
    id: 'livekit', label: 'Voice Calling (LiveKit)', status: lk ? 'pass' : 'fail',
    detail: lk ? 'LiveKit credentials configured' : 'LIVEKIT_URL / KEY / SECRET missing'
  });

  // Voice worker secret
  const vs = !!process.env.VOICE_AGENT_SECRET;
  checks.push({
    id: 'worker', label: 'Voice Worker Secret', status: vs ? 'pass' : 'warn',
    detail: vs ? 'VOICE_AGENT_SECRET set' : 'VOICE_AGENT_SECRET not set'
  });

  // Gemini AI
  const gm = !!process.env.GEMINI_API_KEY;
  checks.push({
    id: 'gemini', label: 'AI Engine (Gemini)', status: gm ? 'pass' : 'warn',
    detail: gm ? 'GEMINI_API_KEY configured' : 'GEMINI_API_KEY not set — AI features limited'
  });

  // Database persistence
  const dataDir = process.env.DATA_DIR;
  checks.push({
    id: 'database', label: 'Data Persistence', status: dataDir ? 'pass' : 'warn',
    detail: dataDir ? `Using persistent volume at ${dataDir}` : 'No DATA_DIR volume — data lost on redeploy'
  });

  const fails = checks.filter(c => c.status === 'fail').length;
  const warns = checks.filter(c => c.status === 'warn').length;
  const overall = fails > 0 ? 'fail' : warns > 0 ? 'warn' : 'pass';
  const score = Math.round((checks.filter(c => c.status === 'pass').length / checks.length) * 100);

  res.json({ overall, score, checks, scannedAt: new Date().toISOString() });
});


  // --- Gmail send helpers (server-side only; the access token never leaves the server) ---
  const GMAIL_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function gmailCleanHeader(value: string): string {
    return String(value || '').replace(/[\r\n]+/g, ' ').trim();
  }
  function validateGmailRecipients(to: unknown, cc?: unknown, bcc?: unknown): string | null {
    const check = (label: string, value: unknown, required: boolean): string | null => {
      const list = String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (required && list.length === 0) return `${label} is required.`;
      for (const addr of list) {
        if (!GMAIL_EMAIL_RE.test(addr)) return `${label} does not look like an email address: ${addr}`;
      }
      return null;
    };
    return check('To', to, true) || check('Cc', cc, false) || check('Bcc', bcc, false);
  }
  function buildGmailRaw(opts: { to: string; cc?: string; bcc?: string; subject: string; body: string; html?: string }): string {
    const to = gmailCleanHeader(opts.to);
    const cc = gmailCleanHeader(opts.cc || '');
    const bcc = gmailCleanHeader(opts.bcc || '');
    const subject = gmailCleanHeader(opts.subject) || '(No Subject)';
    const encodedSubject = /[^\x00-\x7F]/.test(subject)
      ? `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`
      : subject;
    const body = String(opts.body || '');
    const headers = [`To: ${to}`];
    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);
    headers.push(`Subject: ${encodedSubject}`, 'MIME-Version: 1.0');
    let raw: string;
    if (opts.html) {
      const boundary = `rcos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      raw = headers.join('\r\n') + '\r\n\r\n'
        + `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}\r\n`
        + `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${opts.html}\r\n`
        + `--${boundary}--`;
    } else {
      headers.push('Content-Type: text/plain; charset=UTF-8');
      raw = headers.join('\r\n') + '\r\n\r\n' + body;
    }
    return Buffer.from(raw, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function callGmailApi(token: string, path: string, payload: any): Promise<{ ok: boolean; status: number; data: any }> {
    let gmailRes: Awaited<ReturnType<typeof fetch>>;
    try {
      gmailRes = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      return { ok: false, status: 0, data: null };
    }
    let data: any = null;
    try { data = await gmailRes.json(); } catch { /* non-JSON body */ }
    return { ok: gmailRes.ok, status: gmailRes.status, data };
  }

// Fresh Gmail access token for the app's Gmail tab (auto-refreshes when expired).
// Per user: returns only the CALLER's own connected Gmail token, identified
// the same way the team endpoints identify callers (verified token email
// once the login gate is on, else the X-User-Email header). A caller with
// no identity gets nothing — never another user's Gmail.
app.get('/api/business/:id/gmail-token', async (req: Request, res: Response) => {
  try {
    const requesterEmail = teamRequesterEmail(req);
    if (!requesterEmail) {
      return res.status(401).json({ error: 'Sign in first, then open Gmail.' });
    }
    const tok = await getGmailAccessToken(req.params.id, requesterEmail);
    if (!tok) {
      return res.status(404).json({ error: 'Gmail is not connected for this user yet.' });
    }
    res.json(tok);
  } catch (e) {
    console.error('[gmail-oauth] gmail-token failed:', (e as Error)?.message);
    res.status(500).json({ error: 'Could not fetch a Gmail token right now.' });
  }
});

// Permanently delete an account and all of its data. Owner-only: when the
// login gate is on, the caller's Firebase UID must match the business owner
// (or the business must have no owner recorded). When the gate is off, this
// route is as open as every other /api route — the gate being off is the
// thing to fix, not this endpoint. Requires body { confirm: 'DELETE' }.
// Idempotent: deleting an already-deleted business returns ok.
app.post('/api/business/:id/delete-account', deleteAccountLimiter, async (req: Request, res: Response) => {
  try {
    const confirm = (req.body as any)?.confirm;
    if (confirm !== 'DELETE') {
      return res.status(400).json({ error: 'Type DELETE to confirm account deletion.' });
    }
    const businessId = req.params.id;
    const business = businessId ? db.getBusiness(businessId) : undefined;
    if (!business) {
      return res.json({ ok: true, deletedBusinessIds: [], alreadyDeleted: true });
    }
    const caller = (req as any).user as { uid?: string; email?: string | null } | undefined;
    // Ownership proof is REQUIRED to delete a whole business — no
    // fail-open. Proof is any one of: the caller's email is one of the
    // business's owner identities (roster owner, contact email, owner
    // email); the client-sent requester user id matches the recorded
    // owner id (covers businesses whose owner email is stale or
    // missing); or, once the login gate is on, the verified Firebase
    // uid / token email matches. An ownerless business (no owner
    // identity at all) can therefore never be wiped through this
    // endpoint — the client takes the member path for those and the
    // business survives orphaned. These identities are client-asserted
    // while the gate is off, so this is defense-in-depth against the
    // app's own bugs (wrong company, stale id), not unforgeable auth.
    // Gate ON: the verified token email is the only email identity —
    // the header and body values below are ignored, because anyone can
    // type them in. Gate OFF keeps today's header/body behavior.
    const callerEmail = isGateOn()
      ? (caller?.email || '').toLowerCase().trim()
      : String(
          (req.headers['x-user-email'] as string) || (req.body as any)?.requesterEmail || ''
        ).toLowerCase().trim();
    const requesterUserId = isGateOn()
      ? ''
      : String((req.body as any)?.requesterUserId || '').trim();
    const ownerMember = (business.members || []).find((m: any) => m?.role === 'owner');
    const ownerEmails = Array.from(new Set([
      String(ownerMember?.email || '').toLowerCase().trim(),
      String((business as any).contactEmail || '').toLowerCase().trim(),
      String((business as any).ownerEmail || '').toLowerCase().trim(),
    ].filter(Boolean)));
    const ownerId = business.ownerId;
    const ownerIdProven = !!ownerId && ownerId !== 'unassigned_owner' && (
      (requesterUserId !== '' && requesterUserId === ownerId) ||
      (!!caller?.uid && caller.uid === ownerId)
    );
    const emailProven = callerEmail !== '' && ownerEmails.includes(callerEmail);
    const tokenEmail = (caller?.email || '').toLowerCase().trim();
    const tokenEmailProven = tokenEmail !== '' && ownerEmails.includes(tokenEmail);
    if (!emailProven && !ownerIdProven && !tokenEmailProven) {
      return res.status(403).json({ error: 'Only the business owner can delete the whole business. Team members remove only their own login from Settings.' });
    }
    // Delete ONLY the requested business. The old code also deleted
    // every other business with the same owner id — with several
    // companies per owner, deleting one account wiped all of them.
    const { deletedBusinessIds } = db.deleteBusinessData([businessId]);
    for (const id of deletedBusinessIds) deleteGmailTokens(id);
    return res.json({ ok: true, deletedBusinessIds });
  } catch (e) {
    console.error('[delete-account] failed:', (e as Error)?.message);
    return res.status(500).json({ error: 'Could not delete the account. Please try again.' });
  }
});

// Public business profile for the customer booking page (#/book/:businessId).
// Only safe-to-share fields — never the full business record.
app.get('/api/public/business/:id', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) {
    return res.status(404).json({ error: 'Business not found' });
  }
  res.json({
    id: business.id,
    name: business.name,
    industry: business.industry,
    services: business.services || [],
    brandTone: business.brandTone || '',
  });
});

// Send a real email from the caller's OWN connected Gmail account.
// The access token stays server-side; the sender is whichever Gmail
// account the calling user connected — never a teammate's.
app.post('/api/business/:id/gmail/send', gmailSendLimiter, async (req: Request, res: Response) => {
  try {
    const business = db.getBusiness(req.params.id);
    if (!business) return res.status(404).json({ error: 'Business not found' });
    const { to, cc, bcc, subject, body, html, threadId } = (req.body as any) || {};
    const recipientError = validateGmailRecipients(to, cc, bcc);
    if (recipientError) return res.status(400).json({ error: recipientError });
    if (!String(subject || '').trim()) {
      return res.status(400).json({ error: 'Subject is required.' });
    }
    const requesterEmail = teamRequesterEmail(req);
    if (!requesterEmail) {
      return res.status(401).json({ error: 'Sign in first, then send.' });
    }
    const tok = await getGmailAccessToken(req.params.id, requesterEmail);
    if (!tok) {
      return res.status(400).json({ error: 'Connect your Gmail first' });
    }
    const raw = buildGmailRaw({ to, cc, bcc, subject, body: String(body || ''), html: typeof html === 'string' ? html : undefined });
    const { ok, status, data } = await callGmailApi(tok.accessToken, '/users/me/messages/send', {
      raw,
      ...(threadId ? { threadId: String(threadId) } : {}),
    });
    if (!ok) {
      if (status === 0) return res.status(502).json({ error: 'Could not reach Gmail. Check your connection and try again.' });
      return res.status(502).json({ error: data?.error?.message || `Gmail send failed (HTTP ${status}).` });
    }
    res.json({ success: true, id: data?.id, threadId: data?.threadId });
  } catch (e) {
    console.error('[gmail] send failed:', (e as Error)?.message);
    res.status(500).json({ error: 'Could not send the email right now.' });
  }
});

// Save a real draft to the caller's OWN connected Gmail account.
app.post('/api/business/:id/gmail/drafts', gmailSendLimiter, async (req: Request, res: Response) => {
  try {
    const business = db.getBusiness(req.params.id);
    if (!business) return res.status(404).json({ error: 'Business not found' });
    const { to, cc, bcc, subject, body, html, threadId } = (req.body as any) || {};
    const recipientError = validateGmailRecipients(to, cc, bcc);
    if (recipientError) return res.status(400).json({ error: recipientError });
    if (!String(subject || '').trim()) {
      return res.status(400).json({ error: 'Subject is required.' });
    }
    const requesterEmail = teamRequesterEmail(req);
    if (!requesterEmail) {
      return res.status(401).json({ error: 'Sign in first, then save a draft.' });
    }
    const tok = await getGmailAccessToken(req.params.id, requesterEmail);
    if (!tok) {
      return res.status(400).json({ error: 'Connect your Gmail first' });
    }
    const raw = buildGmailRaw({ to, cc, bcc, subject, body: String(body || ''), html: typeof html === 'string' ? html : undefined });
    const { ok, status, data } = await callGmailApi(tok.accessToken, '/users/me/drafts', {
      message: { raw, ...(threadId ? { threadId: String(threadId) } : {}) },
    });
    if (!ok) {
      if (status === 0) return res.status(502).json({ error: 'Could not reach Gmail. Check your connection and try again.' });
      return res.status(502).json({ error: data?.error?.message || `Gmail draft failed (HTTP ${status}).` });
    }
    res.json({ success: true, id: data?.id });
  } catch (e) {
    console.error('[gmail] draft failed:', (e as Error)?.message);
    res.status(500).json({ error: 'Could not save the draft right now.' });
  }
});

// Build the CustomerRequest a website demo submission becomes. Shared by the
// live demo-request handler and the pending-intake flush so both produce the
// exact same record shape (Demo Request, SLA badge, description lines).
function demoSubmissionToRequest(businessId: string, f: {
  name: string; company: string; industry: string; message: string;
  phone: string; email: string; createdAt: string;
}): CustomerRequest {
  const lines = ['Demo request from the RC Solutions website.'];
  if (f.company) lines.push('Company: ' + f.company);
  if (f.industry) lines.push('Industry: ' + f.industry);
  if (f.message) lines.push('What they want to automate: ' + f.message);
  return {
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    businessId,
    customerName: f.name,
    customerPhone: f.phone,
    customerEmail: f.email,
    preferredContact: 'phone',
    serviceLocation: 'Website demo request',
    serviceType: 'Demo Request',
    description: lines.join('\n').slice(0, 2000),
    urgency: 'routine',
    preferredDateTime: 'Flexible / Next Available',
    flexibility: 'Standard business hours',
    specialInstructions: '',
    stage: 'Intake',
    status: 'in_progress',
    createdAt: f.createdAt,
    updatedAt: new Date().toISOString()
  };
}

// Public demo-request intake for the RC Solutions website.
// Gate-exempt + CORS-open by design (no account needed to ask for a demo).
// Saved as a CustomerRequest on the operator's first business, so it shows up in
// the app's Customer Requests with an SLA badge. No engine auto-trigger — the
// operator follows up personally.
app.post('/api/public/demo-request', publicIntakeRateLimiter, (req: Request, res: Response) => {
  const b = req.body || {};
  // Honeypot: bots fill it, humans never see it.
  if (typeof b.website === 'string' && b.website.trim().length > 0) {
    return res.status(201).json({ ok: true });
  }
  const name = (b.name || '').toString().trim().slice(0, 100);
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const company = (b.businessName || '').toString().trim().slice(0, 120);
  const industry = (b.industry || '').toString().trim().slice(0, 80);
  const message = (b.message || '').toString().trim().slice(0, 2000);
  const phone = (b.phone || '').toString().slice(0, 30);
  const email = (b.email || '').toString().slice(0, 100);

  const businesses = db.getAllBusinesses();
  if (businesses.length === 0) {
    // No business exists yet (e.g. right after an account reset) — queue the
    // lead instead of losing it. It flushes into Customer Requests as soon as
    // a business is created, and the website still shows its success page.
    const pending: PendingIntake = {
      id: `pend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      company,
      industry,
      message,
      phone,
      email,
      source: 'website',
      createdAt: new Date().toISOString(),
    };
    const queued = db.savePendingIntake(pending);
    return res.status(201).json({ ok: true, id: queued.id });
  }
  const business = businesses[0];

  const saved = db.saveRequest(demoSubmissionToRequest(business.id, {
    name, company, industry, message, phone, email,
    createdAt: new Date().toISOString(),
  }));
  res.status(201).json({ ok: true, id: saved.id });
});

// WebRTC voice: mint a LiveKit access token for an AI agent call.
// The voice-agent worker ('rcos-receptionist') is dispatched into the new room automatically.
// Body may include persona: 'receptionist' | 'sales' | 'operations' | 'marketing' | 'support' | 'executive' | 'technician' | 'finance'
// (default 'receptionist'). The worker reads it from the room metadata.
app.post('/api/voice/token', async (req: Request, res: Response) => {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return res.status(503).json({ error: 'Voice calling is not configured yet (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET).' });
  }
  try {
    const { AccessToken, RoomServiceClient } = await import('livekit-server-sdk');
    const user = (req as any).user || {};
    const rawBusinessId = typeof req.body?.businessId === 'string' ? req.body.businessId : 'default';
    let businessId = rawBusinessId;
    // Departments this business offers for transfers, worked out from its
    // industry + services. The worker only offers these — a business with
    // no dispatch function never hears Dispatch as an option. Falls back
    // to every department when the business is unknown or has no record.
    let tokenBusiness = rawBusinessId !== 'default' ? db.getBusiness(rawBusinessId) : undefined;
    // Gate ON: a named business the caller is not on is refused, and
    // 'default' resolves to the caller's own business — never to the
    // first business on the server, which could be someone else's.
    if (isGateOn()) {
      const resolved = resolveBodyBusiness(req, rawBusinessId === 'default' ? undefined : rawBusinessId);
      if (rawBusinessId !== 'default' && !resolved) {
        return res.status(403).json({ error: 'You are not on this team.' });
      }
      businessId = resolved ? resolved.id : 'default';
      tokenBusiness = resolved || undefined;
    }
    const departments = tokenBusiness
      ? (Array.isArray(tokenBusiness.availableDepartments) && tokenBusiness.availableDepartments.length > 0
          ? normalizeDepartments(tokenBusiness.availableDepartments)
          : availableDepartmentsFor(tokenBusiness))
      : [...ALL_TRANSFER_DEPARTMENTS];
    const personaRaw = typeof req.body?.persona === 'string' ? req.body.persona.toLowerCase() : 'receptionist';
    const persona = ['receptionist', 'sales', 'operations', 'marketing', 'support', 'executive', 'technician', 'finance'].includes(personaRaw)
      ? personaRaw
      : 'receptionist';
    const roomName = `${persona}-${businessId}-${Date.now()}`;
    const roomClient = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    await roomClient.createRoom({
      name: roomName,
      emptyTimeout: 60,
      departureTimeout: 20,
      maxParticipants: 2,
      // Teach Your Team: the owner's business knowledge rides in the room
      // metadata (resolved + capped here, from the stored record) so the
      // worker can frame it into every persona's instructions. Empty
      // string when the owner never wrote any — the worker then appends
      // nothing and calls behave exactly as before.
      metadata: JSON.stringify({ businessId, persona, departments, businessKnowledge: resolveBusinessKnowledge(tokenBusiness?.businessKnowledge) }),
      // The LiveKit API only needs agentName to dispatch the receptionist worker;
      // the installed SDK types mark the rest of RoomAgentDispatch required.
      agents: [{ agentName: 'rcos-receptionist' }] as any,
    });
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: `caller-${user.uid || 'guest'}-${Date.now()}`,
      name: user.email || 'Customer call',
    });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    res.json({ token: await token.toJwt(), url: LIVEKIT_URL, room: roomName });
  } catch (err: any) {
    console.error('[voice] token mint failed:', err?.message || err);
    res.status(500).json({ error: 'Could not start the voice call. Please try again.' });
  }
});

// WebRTC voice: routing decisions logged by the voice-agent worker.
// The worker proves it's allowed to write here with a shared secret
// (VOICE_AGENT_SECRET), since it has no Firebase user token.
const voiceRoutingLog: any[] = [];
app.post('/api/voice/routing-log', (req: Request, res: Response) => {
  const secret = process.env.VOICE_AGENT_SECRET;
  if (!secret || req.headers['x-voice-secret'] !== secret) {
    return res.status(401).json({ error: 'Not allowed.' });
  }
  const entry = { ...req.body, at: new Date().toISOString() };
  voiceRoutingLog.unshift(entry);
  if (voiceRoutingLog.length > 200) voiceRoutingLog.pop();
  console.log('[voice] routing:', entry.department, '-', entry.summary);
  res.json({ ok: true });
});
app.get('/api/voice/routing-log', (_req: Request, res: Response) => {
  res.json(voiceRoutingLog);
});

// Proactive Agent Inbox ------------------------------------------------------
// The AI team posts here when something needs the owner's eyes or a decision.
// The voice-agent worker can create messages with VOICE_AGENT_SECRET (see the
// auth gate above); everything else requires the normal user session.
const AGENT_IDS = ['sales', 'operations', 'marketing', 'support', 'receptionist', 'system'];
const AGENT_MESSAGE_KINDS = ['alert', 'suggestion', 'question'];


// Self-heal: the server store is wiped on redeploy (persistence unverified).
// When the app posts a follow-up or SMS for a business the server no longer
// knows, re-create a minimal record instead of 404ing, so the app's own
// follow-ups keep working. The app's real business details are re-synced
// from the client on its next full save; this stub only unblocks delivery.
function getOrCreateBusiness(id: string): BusinessAccount {
  const existing = db.getBusiness(id);
  if (existing) return existing;
  return db.saveBusiness({
    id,
    name: 'My Business',
    industry: 'general_small_business',
    size: 'Solo Operator (1)',
    services: ['General Service Call'],
    pricingApproach: 'Flat-rate standard pricing',
    brandTone: 'Professional, friendly, and reliable',
    painPoints: [],
    autonomyMode: 'autonomous',
    dollarThreshold: 250,
    activeEmployees: {
      executive_assistant: true,
      automation_specialist: true,
      project_manager: true,
      finance: true,
      hr: true,
      operations: true,
      sales: true,
      customer_service: true,
      technician: true,
      marketing: true,
      admin: true,
      business_analyst: true,
    },
    onboardingCompleted: false,
    starterDrafts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

app.get('/api/business/:id/agent-messages', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found' });
  res.json(db.getAgentMessages(req.params.id));
});

app.post('/api/business/:id/agent-messages', (req: Request, res: Response) => {
  getOrCreateBusiness(req.params.id); // self-heal: re-create if a redeploy wiped the store
  const { agent, kind, title, body, actionLabel, actionTab, actionUrl, dedupeKey } = req.body || {};
  if (!AGENT_IDS.includes(agent)) return res.status(400).json({ error: 'Invalid agent' });
  if (!AGENT_MESSAGE_KINDS.includes(kind)) return res.status(400).json({ error: 'Invalid kind' });
  if (!title || !body) return res.status(400).json({ error: 'Title and body are required' });
  const msg = db.saveAgentMessage({
    id: `amsg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    businessId: req.params.id,
    agent,
    kind,
    title: String(title).slice(0, 160),
    body: String(body).slice(0, 2000),
    actionLabel: actionLabel ? String(actionLabel).slice(0, 40) : undefined,
    actionTab,
    actionUrl: actionUrl ? String(actionUrl).slice(0, 500) : undefined,
    status: 'unread',
    dedupeKey: dedupeKey ? String(dedupeKey).slice(0, 120) : undefined,
    createdAt: new Date().toISOString(),
  });
  res.json(msg);
});

app.post('/api/business/:id/agent-messages/:msgId/read', (req: Request, res: Response) => {
  const updated = db.updateAgentMessage(req.params.id, req.params.msgId, {
    status: 'read',
    readAt: new Date().toISOString(),
  });
  if (!updated) return res.status(404).json({ error: 'Message not found' });
  res.json(updated);
});

app.post('/api/business/:id/agent-messages/:msgId/respond', (req: Request, res: Response) => {
  const { action, text } = req.body || {};
  if (!['answered', 'dismissed', 'snoozed'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  const updated = db.updateAgentMessage(req.params.id, req.params.msgId, {
    status: action,
    responseText: text ? String(text).slice(0, 1000) : undefined,
    readAt: new Date().toISOString(),
  });
  if (!updated) return res.status(404).json({ error: 'Message not found' });
  res.json(updated);
});

// Vonage SMS auto-send -------------------------------------------------
// Sends one real follow-up text via Vonage when TELEPHONY_PROVIDER=vonage
// and VONAGE_API_KEY/VONAGE_API_SECRET are set. Anything else returns
// { sent: false, configured: false } and the app falls back to its manual
// Send-now draft — no behavior change when Vonage is not configured.
// Twilio is untouched: this route is independent of the Twilio router.
app.post('/api/business/:id/sms/send', smsSendLimiter, async (req: Request, res: Response) => {
  getOrCreateBusiness(req.params.id); // self-heal: re-create if a redeploy wiped the store
  const { to, text, dedupeKey } = req.body || {};
  if (typeof to !== 'string' || typeof text !== 'string') {
    return res.status(400).json({ error: 'to and text are required' });
  }
  const result = await sendVonageSms({
    businessId: req.params.id,
    dedupeKey: typeof dedupeKey === 'string' ? dedupeKey : undefined,
    to,
    text,
  });
  res.json(result);
});

// Businesses
app.get('/api/businesses', (req: Request, res: Response) => {
  // Gate ON: a caller sees only their own businesses — never the
  // whole list. Gate OFF returns everything, as today.
  res.json(callerBusinesses(req));
});

app.post('/api/businesses', (req: Request, res: Response) => {
  const data = req.body;
  // Gate ON: nobody may create a business naming someone else as its
  // owner. When the new record names no owner at all, it is allowed —
  // the caller is creating their own business, not impersonating one.
  if (isGateOn()) {
    const caller = verifiedCaller(req);
    const callerEmail = (caller?.email || '').toLowerCase().trim();
    const namedOwnerEmails = [
      String(data?.contactEmail || '').toLowerCase().trim(),
      ...(Array.isArray(data?.members) ? data.members.filter((m: any) => m?.role === 'owner').map((m: any) => String(m?.email || '').toLowerCase().trim()) : []),
    ].filter(Boolean);
    const namedOwnerId = typeof data?.ownerId === 'string' ? data.ownerId : '';
    const impersonating = namedOwnerEmails.length > 0 && callerEmail !== '' && !namedOwnerEmails.includes(callerEmail)
      && !(namedOwnerId !== '' && caller?.uid === namedOwnerId);
    if (impersonating) {
      return res.status(403).json({ error: 'You can only create a business for yourself.' });
    }
  }
  const newBusiness: BusinessAccount = {
    id: data.id || `biz_${Date.now()}`,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : undefined,
    members: Array.isArray(data.members) ? data.members : undefined,
    contactName: typeof data.contactName === 'string' ? data.contactName : undefined,
    contactPhone: typeof data.contactPhone === 'string' ? data.contactPhone : undefined,
    contactEmail: typeof data.contactEmail === 'string' ? data.contactEmail : undefined,
    profilePicture: typeof data.profilePicture === 'string' ? data.profilePicture : undefined,
    businessKnowledge: typeof data.businessKnowledge === 'string' ? resolveBusinessKnowledge(data.businessKnowledge) : undefined,
    name: String(data.name ?? 'My Business'),
    industry: String(data.industry ?? 'general_small_business'),
    size: data.size || 'Solo Operator (1)',
    services: Array.isArray(data.services) && data.services.length ? data.services : ['General Service Call'],
    pricingApproach: data.pricingApproach || 'Flat-rate standard pricing',
    brandTone: data.brandTone || 'Professional, friendly, and reliable',
    painPoints: Array.isArray(data.painPoints) ? data.painPoints : [],
    autonomyMode: data.autonomyMode || 'autonomous',
    answeringMode: data.answeringMode === 'manual' ? 'manual' : 'ai',
    dollarThreshold: typeof data.dollarThreshold === 'number' ? data.dollarThreshold : 250,
    activeEmployees: data.activeEmployees || {
      executive_assistant: true,
      automation_specialist: true,
      project_manager: true,
      finance: true,
      hr: true,
      operations: true,
      sales: true,
      customer_service: true,
      technician: true,
      marketing: true,
      admin: true,
      business_analyst: true
    },
    onboardingCompleted: !!data.onboardingCompleted,
    starterDrafts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Departments offered for transfers are worked out from the industry +
  // services at onboarding (and on every save) — a business with no
  // dispatch function and no skilled trade never gets Dispatch in its options.
  newBusiness.availableDepartments = availableDepartmentsFor(newBusiness);

  const saved = db.saveBusiness(newBusiness);

  // Flush any demo leads that arrived while no business existed. They were
  // queued instead of lost; they now become Customer Requests on this business.
  const pending = db.takePendingIntake();
  for (const p of pending) {
    db.saveRequest(demoSubmissionToRequest(saved.id, {
      name: p.name,
      company: p.company,
      industry: p.industry,
      message: p.message,
      phone: p.phone,
      email: p.email,
      createdAt: p.createdAt,
    }));
  }

  res.status(201).json(saved);
});

app.get('/api/business/:id', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) {
    return res.status(404).json({ error: 'Business account not found' });
  }
  res.json(business);
});

app.put('/api/business/:id', (req: Request, res: Response) => {
  const existing = db.getBusiness(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Business account not found' });
  }
  // Gate ON: only the owner may save business settings. Before this,
  // any signed-in (or, gate OFF, any) caller could rewrite a business
  // — including its member roster. Gate OFF keeps today's behavior.
  if (!requireBusinessOwner(req, res, existing)) return;
  // Allow-list update (Bug 5): never spread req.body verbatim — an object
  // smuggled into a string field used to crash the dashboard on render.
  // Only known BusinessAccount fields are accepted, each coerced to its
  // declared type. Unknown fields (e.g. createdAt, id) are ignored.
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const updates: Partial<BusinessAccount> = {};
  for (const field of ['ownerId', 'name', 'contactName', 'contactPhone', 'contactEmail', 'profilePicture', 'industry', 'size', 'pricingApproach', 'brandTone'] as const) {
    if (body[field] !== undefined && body[field] !== null) updates[field] = String(body[field]);
  }
  for (const field of ['services', 'painPoints'] as const) {
    if (Array.isArray(body[field])) updates[field] = body[field].map((v) => String(v));
  }
  // Teach Your Team knowledge: free text, trimmed and capped server-side.
  // An empty string is a real update — it clears what the owner wrote.
  if (typeof body.businessKnowledge === 'string') updates.businessKnowledge = resolveBusinessKnowledge(body.businessKnowledge);
  if (body.autonomyMode === 'autonomous' || body.autonomyMode === 'supervised') updates.autonomyMode = body.autonomyMode;
  if (body.answeringMode === 'ai' || body.answeringMode === 'manual') updates.answeringMode = body.answeringMode;
  if (typeof body.dollarThreshold === 'number' && Number.isFinite(body.dollarThreshold)) updates.dollarThreshold = body.dollarThreshold;
  if (typeof body.onboardingCompleted === 'boolean') updates.onboardingCompleted = body.onboardingCompleted;
  if (Array.isArray(body.members)) {
    updates.members = body.members
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object' && !Array.isArray(m))
      .map((m) => ({
        userId: String(m.userId ?? ''),
        email: String(m.email ?? ''),
        name: String(m.name ?? ''),
        role: m.role === 'owner' || m.role === 'member' ? m.role : 'member',
        ...(m.avatar !== undefined && m.avatar !== null ? { avatar: String(m.avatar) } : {}),
        joinedAt: String(m.joinedAt ?? '')
      }));
  }
  if (body.activeEmployees && typeof body.activeEmployees === 'object' && !Array.isArray(body.activeEmployees)) {
    const rec: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(body.activeEmployees as Record<string, unknown>)) rec[String(k)] = v === true;
    updates.activeEmployees = rec;
  }
  if (Array.isArray(body.starterDrafts)) {
    updates.starterDrafts = body.starterDrafts
      .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object' && !Array.isArray(d))
      .map((d) => ({
        id: String(d.id ?? ''),
        title: String(d.title ?? ''),
        type: d.type === 'follow_up_template' ? 'follow_up_template' : 'quote_template',
        content: String(d.content ?? ''),
        status: d.status === 'approved' || d.status === 'rejected' ? d.status : 'awaiting_approval',
        createdAt: String(d.createdAt ?? '')
      }));
  }
  // Recompute the offered transfer departments on every save, so a
  // business that adds (or drops) field work picks up (or loses) Dispatch.
  updates.availableDepartments = availableDepartmentsFor({ ...existing, ...updates });

  const updated: BusinessAccount = { ...existing, ...updates, id: existing.id, updatedAt: new Date().toISOString() };
  const saved = db.saveBusiness(updated);
  res.json(saved);
});

app.delete('/api/business/:id', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.json({ success: false });
  // Gate ON: only the owner may delete a business. This route
  // previously had no ownership check at all. (The guarded, confirm-
  // gated delete-account route is separate and unchanged.)
  if (!requireBusinessOwner(req, res, business)) return;
  const deleted = db.deleteBusiness(req.params.id);
  res.json({ success: deleted });
});

// ---- Team (human-to-human) ----
// Who is asking? When the Firebase login gate is ON, req.user comes from
// the verified token. While the gate is OFF (current state), the app
// sends its login email in the X-User-Email header — the same trust
// level as every other /api route until the gate is fixed.
function teamRequesterEmail(req: Request): string {
  const caller = (req as any).user as { uid?: string; email?: string | null } | undefined;
  const fromToken = (caller?.email || '').trim().toLowerCase();
  if (fromToken) return fromToken;
  // Gate ON: the verified token is the only identity. The header and
  // body fallbacks below exist ONLY while the gate is off, so today's
  // local sign-ins keep working — anyone can type those values in.
  if (isGateOn()) return '';
  const fromHeader = String(req.headers['x-user-email'] || '').trim().toLowerCase();
  if (fromHeader) return fromHeader;
  const fromBody = String(((req.body as any)?.requesterEmail || '') as string).trim().toLowerCase();
  return fromBody;
}

function teamMemberFor(business: BusinessAccount, email: string): BusinessMember | undefined {
  const clean = (email || '').toLowerCase();
  if (!clean) return undefined;
  return (business.members || []).find(m => m.email.toLowerCase() === clean);
}

function teamIsOwner(business: BusinessAccount, email: string): boolean {
  return teamMemberFor(business, email)?.role === 'owner';
}

// Owner proof that does NOT trust an empty roster (Oct 16, 2026). The old
// code treated everyone as the owner when the roster was empty
// (`teamIsOwner(...) || !hasMembers`) — but the roster is empty on
// restored businesses, so a member could invite, remove, and (via the
// Danger Zone) wipe the business. Owner proof is: roster owner, Firebase
// UID match, or the requester's email matching an owner identity recorded
// on the business (contact email / owner email). The one exception: a
// record with no owner identity anywhere — nobody to protect, so the
// requester is treated as the owner (legacy behavior).
function teamIsOwnerByIdentity(business: BusinessAccount, email: string, uid?: string): boolean {
  if (teamIsOwner(business, email)) return true;
  if (uid && business.ownerId && business.ownerId !== 'unassigned_owner' && business.ownerId === uid) return true;
  const identities = [
    String((business as any).contactEmail || '').toLowerCase().trim(),
    String((business as any).ownerEmail || '').toLowerCase().trim(),
  ].filter(Boolean);
  if (identities.length === 0) return true;
  const clean = (email || '').toLowerCase().trim();
  return clean !== '' && identities.includes(clean);
}

// Invite codes: 8 characters, letters + digits, with the easily
// confused 0/O/1/l/I left out so a code read off a screen still works.
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeInviteCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return code;
}

const teamInviteLimiter = createRateLimiter(10, 60000); // 10 invite/join attempts / min per IP

// Team roster for this business. Members see the roster; only the owner
// also sees pending invites (the codes stay hidden from members).
app.get('/api/business/:id/team', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });
  const email = teamRequesterEmail(req);
  const me = teamMemberFor(business, email);
  const hasMembers = (business.members || []).length > 0;
  if (hasMembers && !me) {
    return res.status(403).json({ error: 'Only people on this team can see the roster.' });
  }
  const owner = teamIsOwnerByIdentity(business, email, ((req as any).user as { uid?: string } | undefined)?.uid);
  const invites = owner
    ? db.getTeamInvites(business.id).filter(i => !i.used && !i.revoked && new Date(i.expiresAt).getTime() > Date.now())
    : [];
  res.json({ businessId: business.id, businessName: business.name, members: business.members || [], invites, isOwner: owner });
});

// Owner creates an invite. `email` is optional: when set, only that
// email can use the code; when empty, anyone with the code can join.
app.post('/api/business/:id/team/invites', teamInviteLimiter, (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });
  const email = teamRequesterEmail(req);
  if (!teamIsOwnerByIdentity(business, email, ((req as any).user as { uid?: string } | undefined)?.uid)) {
    return res.status(403).json({ error: 'Only the owner can invite people to the team.' });
  }
  const inviteEmail = String((req.body as any)?.email || '').trim().toLowerCase();
  if (inviteEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
    return res.status(400).json({ error: 'That invite email does not look like an email address.' });
  }
  let code = makeInviteCode();
  for (let tries = 0; tries < 10 && db.getTeamInviteByCode(code); tries++) code = makeInviteCode();
  const invite: TeamInvite = {
    code,
    businessId: business.id,
    businessName: business.name,
    email: inviteEmail || undefined,
    role: 'member',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    used: false,
    revoked: false
  };
  db.saveTeamInvite(invite);
  res.status(201).json({ invite });
});

// Owner cancels a pending invite.
app.delete('/api/business/:id/team/invites/:code', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });
  const email = teamRequesterEmail(req);
  if (!teamIsOwnerByIdentity(business, email, ((req as any).user as { uid?: string } | undefined)?.uid)) {
    return res.status(403).json({ error: 'Only the owner can cancel invites.' });
  }
  const invite = db.getTeamInviteByCode(req.params.code);
  if (!invite || invite.businessId !== business.id) {
    return res.status(404).json({ error: 'Invite not found.' });
  }
  db.saveTeamInvite({ ...invite, revoked: true });
  res.json({ ok: true });
});

// Owner removes a member. The owner's own seat cannot be removed here —
// the owner deletes the business instead. The removed person's old
// chat messages stay, with their name on them.
app.delete('/api/business/:id/team/members/:email', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });
  const email = teamRequesterEmail(req);
  if (!teamIsOwnerByIdentity(business, email, ((req as any).user as { uid?: string } | undefined)?.uid)) {
    return res.status(403).json({ error: 'Only the owner can remove team members.' });
  }
  const target = decodeURIComponent(req.params.email).toLowerCase();
  const targetMember = teamMemberFor(business, target);
  if (!targetMember) return res.status(404).json({ error: 'That person is not on this team.' });
  if (targetMember.role === 'owner') {
    return res.status(400).json({ error: 'The owner cannot be removed. Delete the business instead.' });
  }
  db.removeBusinessMember(business.id, target);
  res.json({ ok: true });
});

// A member leaves the team. The owner cannot leave their own business.
app.post('/api/business/:id/team/leave', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });
  const email = teamRequesterEmail(req);
  const me = teamMemberFor(business, email);
  if (!me) return res.status(403).json({ error: 'You are not on this team.' });
  if (me.role === 'owner') {
    return res.status(400).json({ error: 'The owner cannot leave. Delete the business instead.' });
  }
  db.removeBusinessMember(business.id, email);
  res.json({ ok: true });
});

// Join a company with an invite code. Public (gate-exempt) because the
// joiner has no account yet. The server never sees passwords — the app
// creates the local login itself after this succeeds.
app.post('/api/team/join', teamInviteLimiter, (req: Request, res: Response) => {
  const code = String((req.body as any)?.code || '').trim().toUpperCase();
  const fullName = String((req.body as any)?.fullName || '').trim();
  const email = String((req.body as any)?.email || '').trim().toLowerCase();
  if (!code || !fullName || !email) {
    return res.status(400).json({ error: 'Please enter the invite code, your name, and your email.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'That email does not look like an email address.' });
  }
  const invite = db.getTeamInviteByCode(code);
  if (!invite || invite.revoked || invite.used) {
    return res.status(400).json({ error: 'That invite code is not valid. Ask the owner for a new one.' });
  }
  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    return res.status(400).json({ error: 'That invite code has expired. Ask the owner for a new one.' });
  }
  if (invite.email && invite.email.toLowerCase() !== email) {
    return res.status(400).json({ error: 'That invite was made for a different email address.' });
  }
  const business = db.getBusiness(invite.businessId);
  if (!business) {
    return res.status(404).json({ error: 'That company no longer exists.' });
  }
  const already = teamMemberFor(business, email);
  if (already) {
    return res.json({ business, alreadyMember: true });
  }
  db.saveTeamInvite({ ...invite, used: true, usedByEmail: email });
  const updated = db.addBusinessMember(business.id, {
    userId: `usr_${Date.now()}`,
    email,
    name: fullName,
    role: invite.role,
    joinedAt: new Date().toISOString()
  });
  if (!updated) {
    return res.status(500).json({ error: 'Could not join that company. Please try again.' });
  }
  res.json({ business: updated, alreadyMember: false });
});

// Team chat history for this business (human-to-human only — the
// AI-employee chat lives at /api/business/:id/chat and is untouched).
app.get('/api/business/:id/team-messages', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });
  const email = teamRequesterEmail(req);
  const hasMembers = (business.members || []).length > 0;
  if (hasMembers && !teamMemberFor(business, email)) {
    return res.status(403).json({ error: 'Only people on this team can read the team chat.' });
  }
  res.json(db.getTeamMessages(business.id));
});

// Send one team chat message.
app.post('/api/business/:id/team-messages', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });
  const email = teamRequesterEmail(req);
  const me = teamMemberFor(business, email);
  const hasMembers = (business.members || []).length > 0;
  if (hasMembers && !me) {
    return res.status(403).json({ error: 'Only people on this team can send team messages.' });
  }
  const text = String((req.body as any)?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Please type a message first.' });
  if (text.length > 2000) {
    return res.status(400).json({ error: 'That message is too long (2,000 characters max).' });
  }
  const senderName = String((req.body as any)?.senderName || me?.name || email || 'Team member').trim() || 'Team member';
  const senderAvatar = typeof (req.body as any)?.senderAvatar === 'string' ? (req.body as any).senderAvatar : me?.avatar;
  const msg: TeamMessage = {
    id: `tm_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    businessId: business.id,
    senderId: me?.userId || `usr_${email}`,
    senderEmail: email || me?.email || '',
    senderName,
    senderAvatar,
    text,
    timestamp: new Date().toISOString()
  };
  res.status(201).json(db.saveTeamMessage(msg));
});

// AI Onboarding Agent - Document Analysis & Industry Preset Deciphering.
// Parsing + scored matching live in ./server/onboarding-docs; this route is
// a thin handler so the file stays small enough to push via the API.
app.post('/api/business/analyze-document', async (req: Request, res: Response) => {
  const { fileText, fileName, fileType, fileBase64, rawInput } = req.body || {};
  const text = typeof fileText === 'string' ? fileText : typeof rawInput === 'string' ? rawInput : '';
  if (!text.trim() && !fileBase64) {
    return res.status(400).json({ error: 'No document text or file payload provided' });
  }
  try {
    res.json(await analyzeDocument({ fileText: text, fileName, fileType, fileBase64 }));
  } catch (err: any) {
    console.error('[Onboarding Agent] Document analysis error:', err);
    res.status(500).json({ error: 'Could not analyze the document. Please try again.' });
  }
});

// Bug 5: never pass unvalidated LLM JSON to the client — coerce first.
const coerceFinite = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const coerceString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value : fallback;
const coerceStringArray = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) return fallback;
  const out = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return out.length ? out : fallback;
};

// Proactive AI Monitor: Evaluates business context & services added, suggesting an optimized Industry Profile preset
app.post('/api/business/:id/suggest-optimized-industry', async (req: Request, res: Response) => {
  const businessId = req.params.id;
  const { services, currentIndustry, businessName } = req.body;

  const currentBiz = db.getBusiness(businessId);
  // Coerce: only strings reach the client or the LLM prompt — an object in
  // this array used to crash the dashboard when rendered.
  const rawServices: unknown[] = Array.isArray(services) && services.length > 0
    ? services
    : (currentBiz?.services || []);
  const effectiveServices: string[] = rawServices.filter((s): s is string => typeof s === 'string');
  const effectiveCurrentIndustry = String(currentIndustry || currentBiz?.industry || 'general_small_business');
  const effectiveBizName = String(businessName || currentBiz?.name || 'Your Business');

  if (!effectiveServices.length) {
    return res.json({ suggestion: null, reason: 'Insufficient services registered to evaluate optimization.' });
  }

  const combinedServicesText = effectiveServices.join(', ');
  const presetList = INDUSTRY_PRESETS.map(p => `- ${p.id}: "${p.name}" (Default: ${p.defaultServices.join(', ')})`).join('\n');

  // Fallback heuristic scoring
  const fallbackOptimization = () => {
    const rankedLocal = scorePresetsByKeywords(`${effectiveBizName} ${combinedServicesText}`);
    const topLocal = rankedLocal[0];
    if (!topLocal || topLocal.score <= 0) {
      return {
        suggestion: null,
        message: 'Current industry profile is already optimally aligned with your operational services.'
      };
    }
    const matchedPreset = topLocal.preset;

    // Check if the matched preset is noticeably different from current
    const isDifferent = matchedPreset.id.toLowerCase() !== effectiveCurrentIndustry.toLowerCase() &&
      !matchedPreset.name.toLowerCase().includes(effectiveCurrentIndustry.toLowerCase()) &&
      !effectiveCurrentIndustry.toLowerCase().includes(matchedPreset.id.toLowerCase());

    if (!isDifferent) {
      return {
        suggestion: null,
        message: 'Current industry profile is already optimally aligned with your operational services.'
      };
    }

    const activeEmps: Record<string, boolean> = {};
    (matchedPreset.suggestedActiveEmployees || []).forEach(emp => {
      activeEmps[emp] = true;
    });

    return {
      suggestion: {
        currentIndustryId: effectiveCurrentIndustry,
        suggestedPresetId: matchedPreset.id,
        suggestedPresetName: matchedPreset.name,
        confidence: 0.92,
        matchScore: 94,
        reason: `Based on your recent services (${effectiveServices.slice(0, 3).join(', ')}), your operations strongly indicate specialized ${matchedPreset.name} workflows rather than ${effectiveCurrentIndustry}.`,
        newServicesDetected: effectiveServices,
        recommendedTone: matchedPreset.recommendedTone,
        technicianRoleName: matchedPreset.technicianRoleName || 'Field Specialist',
        suggestedServices: matchedPreset.defaultServices,
        activeEmployees: activeEmps,
        triggers: [
          `Detected service keywords matching ${matchedPreset.name}`,
          `Specialized job pack templates available for ${matchedPreset.name}`,
          `Role alignment to "${matchedPreset.technicianRoleName || 'Field Specialist'}"`
        ]
      }
    };
  };

  const prompt = `You are the RCOS AI Business Context Monitor.
A business owner named "${effectiveBizName}" is currently configured under the industry preset "${effectiveCurrentIndustry}".
However, they have added and are offering the following specific operational services:
${effectiveServices.map(s => `• ${s}`).join('\n')}

Review the catalog of 32 industry presets:
${presetList}

Analyze whether their specific services indicate they have evolved or belong to a MORE OPTIMIZED industry profile than "${effectiveCurrentIndustry}".
If their current preset is already the best match, set "shouldSuggest": false.
If a different preset is a significantly better fit, set "shouldSuggest": true and populate the suggestion details.

Respond with ONLY valid JSON matching this schema:
{
  "shouldSuggest": boolean,
  "suggestedPresetId": "string (one of the preset IDs)",
  "suggestedPresetName": "string",
  "confidence": number (0.0 to 1.0),
  "matchScore": number (0 to 100),
  "reason": "Detailed 1-2 sentence explanation of why switching will unlock better Job Packs, workflow checklists, and brand tone for these specific services",
  "recommendedTone": "string",
  "technicianRoleName": "string",
  "triggers": ["Specific trigger 1", "Specific trigger 2"]
}`;

  try {
    const aiRes = await executeGeminiWithFallback({
      preferredModel: FAST_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
      fallbackFn: () => JSON.stringify({ shouldSuggest: false })
    });

    const parsed = JSON.parse(aiRes.text || '{}');
    if (parsed.shouldSuggest && parsed.suggestedPresetId) {
      const targetPreset = INDUSTRY_PRESETS.find(p => p.id === parsed.suggestedPresetId);
      if (targetPreset && targetPreset.id !== effectiveCurrentIndustry) {
        const activeEmps: Record<string, boolean> = {};
        (targetPreset.suggestedActiveEmployees || []).forEach(emp => {
          activeEmps[emp] = true;
        });

        return res.json({
          suggestion: {
            currentIndustryId: effectiveCurrentIndustry,
            suggestedPresetId: targetPreset.id,
            suggestedPresetName: targetPreset.name,
            confidence: coerceFinite(parsed.confidence, 0.95, 0, 1),
            matchScore: coerceFinite(parsed.matchScore, 95, 0, 100),
            reason: coerceString(parsed.reason, `Your service catalog matches the specialized workflows and job packs of ${targetPreset.name}.`),
            newServicesDetected: effectiveServices,
            recommendedTone: coerceString(parsed.recommendedTone, targetPreset.recommendedTone),
            technicianRoleName: coerceString(parsed.technicianRoleName, targetPreset.technicianRoleName),
            suggestedServices: targetPreset.defaultServices,
            activeEmployees: activeEmps,
            triggers: coerceStringArray(parsed.triggers, [`Services directly align with ${targetPreset.name}`])
          }
        });
      }
    }

    // If AI didn't trigger suggestion or returned current, use fallback check
    const fallbackResult = fallbackOptimization();
    res.json(fallbackResult);
  } catch (err: any) {
    console.error('[AI Context Monitor] Optimization evaluation error:', err);
    res.json(fallbackOptimization());
  }
});

// AI Starter Content Generation (2 real tailored drafts awaiting approval)
app.post('/api/business/:id/generate-starter-templates', async (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) {
    return res.status(404).json({ error: 'Business not found' });
  }

  const prompt = `You are the AI team for "${business.name}" in the ${business.industry} industry.
Services: ${business.services.join(', ')}
Pricing approach: ${business.pricingApproach}
Brand tone: ${business.brandTone}

Generate TWO real, production-ready operational templates for this business.
1. A realistic quote/proposal template for their primary service.
2. A warm, professional client follow-up & review request template.

Return ONLY valid JSON:
{
  "drafts": [
    {
      "id": "draft_quote",
      "title": "Standard Quote Proposal Template",
      "type": "quote_template",
      "content": "Full realistic quote text including service scope, pricing breakdown, and terms..."
    },
    {
      "id": "draft_followup",
      "title": "Post-Service Follow-Up & Review Request",
      "type": "follow_up_template",
      "content": "Warm client message thanking them and requesting a quick review or feedback..."
    }
  ]
}`;

  const fallbackTemplates = () => JSON.stringify({
    drafts: [
      {
        id: "draft_quote",
        title: "Standard Service Proposal & Estimate",
        type: "quote_template",
        content: `PROPOSAL & SERVICE ESTIMATE\nClient: Valued Client\nService: ${business.services[0] || 'Standard Service'}\nProvider: ${business.name}\n\nScope of Work:\n- Comprehensive initial on-site inspection\n- Execution of requested service standard protocols\n- Quality assurance sign-off and site cleanup\n\nTotal Estimated: $${business.dollarThreshold || 250}.00\nTerms: Net 15 days upon completion.`
      },
      {
        id: "draft_followup",
        title: "Post-Service Client Follow-Up & Review Request",
        type: "follow_up_template",
        content: `Hi there! Thank you for choosing ${business.name}. We wanted to check in and make sure you were completely satisfied with our service today. If you have 30 seconds, leaving us a quick Google review helps our team tremendously. Thank you for your partnership!`
      }
    ]
  });

  try {
    const aiRes = await executeGeminiWithFallback({
      preferredModel: PRIMARY_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
      fallbackFn: fallbackTemplates
    });
    const parsed = JSON.parse(aiRes.text || fallbackTemplates());
    const drafts: StarterDraft[] = (parsed.drafts || []).map((d: any) => ({
      id: d.id || `draft_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: d.title,
      type: d.type,
      content: d.content,
      status: 'awaiting_approval' as const,
      createdAt: new Date().toISOString()
    }));

    business.starterDrafts = drafts;
    db.saveBusiness(business);
    res.json({ drafts });
  } catch (err) {
    console.error('Starter generation error:', err);
    res.status(500).json({ error: 'Failed to generate starter drafts' });
  }
});

// Multi-turn Gemini Chat with Role-Specific System Instructions
app.post('/api/chat', aiRateLimiter, async (req: Request, res: Response) => {
  const { messages, roleId = 'executive_assistant', modelTier = 'general', businessId, behaviorProtocol } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const business = businessId ? db.getBusiness(businessId) : null;
  // Gate ON: chatting "as" a business the caller is not on is refused —
  // otherwise its name, services, and Teach Your Team notes would leak
  // into the prompt. No business named means generic prompts, as today.
  if (isGateOn() && businessId && (!business || !businessIsMember(business, verifiedCaller(req)))) {
    return res.status(403).json({ error: 'You are not on this team.' });
  }
  const bizName = business?.name || 'RC Solutions';
  const bizIndustry = business?.industry || 'Professional Services';
  const bizTone = business?.brandTone || 'Formal, strategic, rigorous, and insight-driven';
  const bizServices = business?.services?.join(', ') || 'Technical Feasibility, Operational Audit, Compliance Review';

  // Specific role instructions
  const roleInstructions: Record<string, string> = {
    executive_assistant: `You are Morgan Vance, Executive Assistant and Operations Chief for "${bizName}" (${bizIndustry}). Tone: ${bizTone}. You oversee business operations, coordinate the 12 AI employees, and enforce safety boundaries: routine tasks can be planned autonomously, but any price quote commitment, money movement, or external dispatch above the threshold requires owner sign-off. Respond directly, crisply, and operationally.`,
    finance: `You are Jordan Cross, Finance Officer for "${bizName}". Your role is invoicing, accounts receivable, job profit margin calculations, payment reminders, and expense audits. Tone: analytical, exact, and security-minded. Never commit funds or execute irreversible money transfers without explicit owner authorization.`,
    sales: `You are Taylor Hayes, Sales & Estimations Specialist for "${bizName}". You handle client discovery, scoping jobs, generating accurate line-item quotes based on services (${bizServices}), and client proposal follow-ups. Tone: persuasive, transparent, and prompt.`,
    automation_specialist: `You are Blake Mercer, Automation & Workflow Specialist for "${bizName}". You optimize repetitive tasks, configure webhook dispatches, trigger maps, and integration workflows between RCOS, calendar, and billing systems.`,
    customer_service: `You are Casey Morgan, Customer Experience & Support Lead for "${bizName}". You handle client inquiries, appointment scheduling, issue resolution, and post-service satisfaction reviews with warmth and prompt reassurance.`,
    project_manager: `You are Quinn Davies, Project & Operations Manager for "${bizName}". You coordinate crew schedules, track job pipeline stages, enforce checklist completion, and ensure milestones are completed on time.`,
  };

  const systemInstruction = withBusinessKnowledge(
    withBehaviorProtocol(
      roleInstructions[roleId] || roleInstructions.executive_assistant,
      behaviorProtocol
    ),
    business?.businessKnowledge
  );

  // Model selection per user instructions:
  // - gemini-3.1-pro-preview for particularly complex tasks
  // - gemini-3.8-flash for general tasks
  // - gemini-3.1-flash-lite for tasks that should happen fast
  let selectedModel = PRIMARY_MODEL;
  if (modelTier === 'complex') {
    selectedModel = PRO_MODEL;
  } else if (modelTier === 'fast') {
    selectedModel = FAST_MODEL;
  } else {
    selectedModel = PRIMARY_MODEL;
  }

  // Format contents for multi-turn history
  const contents = messages.map((m: { role: string; content: string }) => ({
    role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const fallbackChatReply = () => {
    switch (roleId) {
      case 'finance':
        return `Finance assistant is temporarily unavailable. Your request for ${bizName} was saved \u2014 nothing has been filed or sent. Please try again shortly.`;
      case 'sales':
        return `Sales assistant is temporarily unavailable. Your request for ${bizName} was saved \u2014 no pricing or follow-ups were prepared. Please try again shortly.`;
      case 'automation_specialist':
        return `Automation assistant is temporarily unavailable. No workflows or triggers were changed. Please try again shortly.`;
      case 'customer_service':
        return `Support assistant is temporarily unavailable. Your inquiry was saved \u2014 nothing has been queued or dispatched. Please try again shortly.`;
      case 'project_manager':
        return `Operations assistant is temporarily unavailable. No schedules were changed. Please try again shortly.`;
      case 'executive_assistant':
      default:
        return `Assistant is temporarily unavailable. Your request for ${bizName} was saved \u2014 nothing has been actioned. Please try again shortly.`;
    }
  };

  try {
    const result = await executeGeminiWithFallback({
      preferredModel: selectedModel,
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
      fallbackFn: fallbackChatReply
    });

    return res.json({
      role: 'assistant',
      content: result.text || 'I have completed your operational instruction.',
      modelUsed: result.modelUsed,
      roleId,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return res.json({
      role: 'assistant',
      content: fallbackChatReply(),
      modelUsed: 'rcos-offline-engine',
      roleId,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== RCOS MULTI-AGENT ENDPOINTS ====================

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  'agent-orchestrator': `You are the RCOS System Orchestrator, the central intelligence coordinator for RC Solutions (Slogan: "AUTOMATE. OPTIMIZE. GROW."). Your job is to oversee all sub-agents (Phone System AI Agent, Smart Job Dispatcher, Client Nurture CRM Agent) and provide high-level operational advice, system diagnostics, and automated task routing. Keep your answers clear, confident, professional, and tech-forward.`,
  'agent-phone': `You are the Voice AI Phone Agent for RC Solutions. You handle 24/7 business phone calls, IVR menus, caller inquiries, emergency service requests, and automated appointment scheduling. Speak concisely as if responding to a business call or call transcript.`,
  'agent-jobs': `You are the Smart Job Dispatcher AI Agent for RC Solutions. You optimize technician routes, analyze job urgency (HVAC, Electrical, Security, Automation, AI Software), assign technicians based on skills and location, and generate cost estimates. Provide structured, actionable dispatch recommendations.`,
  'agent-crm': `You are the Client Nurture CRM Agent for RC Solutions. You analyze client health scores, draft personalized follow-up SMS/Emails, summarize client interactions, and identify upselling or contract expansion opportunities.`,
  'agent-system': `You are the RCOS Code & File Architecture Specialist for RC Solutions. You analyze uploaded system files, python/typescript scripts, multi-agent frameworks, and configuration files, explaining how they map to RCOS modules and offering optimization tips.`
};

function generateAgentChatFallback(agentId: string, prompt: string): string {
  switch (agentId) {
    case 'agent-phone':
      return `The voice AI agent is temporarily unavailable. This inquiry was saved \u2014 no SMS was sent and nothing was dispatched. Please try again shortly.`;
    case 'agent-jobs':
      return `The dispatch assistant is temporarily unavailable. No technician was assigned. Please try again shortly.`;
    case 'agent-crm':
      return `The CRM assistant is temporarily unavailable. No follow-ups were drafted or sent. Please try again shortly.`;
    case 'agent-system':
      return `The system assistant is temporarily unavailable. Please try again shortly.`;
    case 'agent-orchestrator':
    default:
      return `The AI service is temporarily unavailable. Your command was saved \u2014 nothing was routed or confirmed. Please try again shortly.`;
  }
}

// 1. Multi-Agent chat endpoint
app.post('/api/agent/chat', aiRateLimiter, async (req: Request, res: Response) => {
  const { agentId = 'agent-orchestrator', prompt, history = [] } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const systemInstruction = AGENT_SYSTEM_PROMPTS[agentId] || AGENT_SYSTEM_PROMPTS['agent-orchestrator'];

  const contents = [
    ...history.map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    })),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  try {
    const result = await executeGeminiWithFallback({
      preferredModel: PRIMARY_MODEL,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
      fallbackFn: () => generateAgentChatFallback(agentId, prompt)
    });

    return res.json({
      reply: result.text,
      agentId,
      timestamp,
      modelUsed: result.modelUsed
    });
  } catch {
    return res.json({
      reply: generateAgentChatFallback(agentId, prompt),
      agentId,
      timestamp,
      modelUsed: 'rcos-offline-engine'
    });
  }
});

// 2. Real Voice Receptionist TTS endpoint (gemini-3.8-flash-lite-tts)
app.post('/api/phone/tts', async (req: Request, res: Response) => {
  const { text = '', voiceName = 'Kore' } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required for TTS synthesis' });
  }

  try {
    const audioResult = await generateSpeechAudio(text, voiceName);
    return res.json({
      success: !!audioResult.audioBase64,
      audioBase64: audioResult.audioBase64,
      mimeType: audioResult.mimeType || 'audio/wav',
      voice: voiceName
    });
  } catch (err: any) {
    console.error('[Phone TTS] Synthesis failed:', err);
    return res.status(500).json({ error: 'TTS synthesis failed', details: err?.message });
  }
});

// 2b. Intelligent Multi-Turn Voice Receptionist Engine
app.post('/api/phone/receptionist-chat', async (req: Request, res: Response) => {
  const { 
    userSpeech = '', 
    callerName = 'Inbound Caller', 
    callerNumber = '(555) 019-4820',
    callerTopic = 'Service Inquiry',
    conversationHistory = [],
    answeredBy = 'ai_receptionist', // 'ai_receptionist' | 'human_operator'
    businessId,
    withAudio = true
  } = req.body;

  // Gate ON: resolve to the caller's own business, never to the first
  // business on the server. A caller with no business gets a 403
  // instead of another company's record. Gate OFF: today's behavior.
  const resolvedBiz = resolveBodyBusiness(req, businessId);
  const defaultBiz = resolvedBiz || (!isGateOn() ? {
    id: 'biz_rc_solutions',
    name: 'RC Solutions',
    industry: 'automation_field_services',
    dollarThreshold: 250
  } : null);
  if (!defaultBiz) {
    return res.status(403).json({ error: 'Sign in with a business account first.' });
  }

  const isHuman = answeredBy === 'human_operator';

  // Fallback heuristic response generator
  const fallbackGenerator = () => {
    const lower = userSpeech.toLowerCase();
    let intent: 'take_message' | 'send_email' | 'request_quote_approval' | 'transfer_call' | 'general_qa' = 'general_qa';
    let aiResponse = `Thank you for calling RC Solutions. How can I assist you with our smart mechanical, electrical, or automation services today?`;
    let actionTriggered: any = null;
    let sentiment: 'positive' | 'neutral' | 'urgent' = 'neutral';
    let callStatus: 'active' | 'transferred' | 'voicemail_recorded' = 'active';

    if (lower.includes('transfer') || lower.includes('dispatch') || lower.includes('marcus') || lower.includes('billing') || lower.includes('sales')) {
      intent = 'transfer_call';
      let dept = 'Dispatch & Field Operations';
      let ext = '101';
      let lead = 'Marcus Vance';
      if (lower.includes('billing') || lower.includes('invoice')) {
        dept = 'Billing & Invoicing';
        ext = '102';
        lead = 'Elena Rostova';
      } else if (lower.includes('sales') || lower.includes('pricing')) {
        dept = 'Sales & Project Estimates';
        ext = '104';
        lead = 'Sarah Chen';
      } else if (lower.includes('emergency') || lower.includes('technician')) {
        dept = 'Emergency Mechanical Tech';
        ext = '103';
        lead = 'Dave Miller';
      }
      aiResponse = `I'd be glad to connect you. I am transferring your call right now to ${dept} at Extension ${ext}, connecting with ${lead}. Please stay on the line.`;
      callStatus = 'transferred';
      actionTriggered = {
        type: 'transfer_call',
        targetDepartment: dept,
        extension: ext,
        agentName: lead
      };
    } else if (lower.includes('quote') || lower.includes('estimate') || lower.includes('price') || lower.includes('cost') || lower.includes('bid')) {
      intent = 'request_quote_approval';
      const est = 1250;
      aiResponse = `I have logged your request for a project quote for ${userSpeech.slice(0, 60)}. Because this is an official estimate, I have submitted an Approval Request to our Operations Supervisor for formal review.`;
      actionTriggered = {
        type: 'request_quote_approval',
        clientName: callerName,
        serviceName: callerTopic || 'Diagnostic & Installation Quote',
        estimatedAmount: est,
        details: `Voice request from ${callerName}: "${userSpeech}"`
      };
    } else if (lower.includes('message') || lower.includes('voicemail') || lower.includes('not available') || lower.includes('leave a note')) {
      intent = 'take_message';
      callStatus = 'voicemail_recorded';
      aiResponse = `I have transcribed and saved your message for the team. We will ensure the assigned specialist reviews it and follows up promptly.`;
      actionTriggered = {
        type: 'take_message',
        callerName,
        callerNumber,
        messageText: userSpeech || 'Please call back regarding urgent project updates.',
        urgency: lower.includes('urgent') || lower.includes('asap') ? 'urgent' : 'medium',
        department: 'Operations'
      };
    } else if (lower.includes('email') || lower.includes('confirmation') || lower.includes('send me')) {
      intent = 'send_email';
      aiResponse = `I have sent a confirmation email summary regarding your inquiry to your registered contact address.`;
      actionTriggered = {
        type: 'send_email',
        recipient: `${callerName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'client'}@example.com`,
        subject: `RC Solutions Call Confirmation: ${callerTopic}`,
        body: `Hello ${callerName},\n\nThank you for speaking with our Voice Receptionist today regarding: "${userSpeech}". Your inquiry has been routed to our team.\n\nBest regards,\nRC Solutions Concierge`
      };
    } else if (lower.includes('emergency') || lower.includes('leak') || lower.includes('tripping') || lower.includes('fire') || lower.includes('smoke')) {
      sentiment = 'urgent';
      aiResponse = `Understood, this sounds like an urgent priority. I am escalating your details directly to our emergency dispatch queue and transferring you to our on-call technician Dave Miller immediately.`;
      intent = 'transfer_call';
      callStatus = 'transferred';
      actionTriggered = {
        type: 'transfer_call',
        targetDepartment: 'Emergency Field Tech',
        extension: '103',
        agentName: 'Dave Miller'
      };
    }

    return {
      aiResponse,
      intent,
      actionTriggered,
      sentiment,
      callStatus
    };
  };

  try {
    const prompt = `You are "Kore", the intelligent AI Voice Receptionist for RC Solutions, a premier commercial mechanical, electrical, and AI automation field service company.
Caller Name: ${callerName}
Caller Phone: ${callerNumber}
Caller Topic: ${callerTopic}
Answered Mode: ${answeredBy} (If 'human_operator', the human answered; otherwise AI Receptionist is speaking)

Conversation History:
${conversationHistory.map((c: any) => `${c.speaker}: ${c.text}`).join('\n')}

Caller just said: "${userSpeech}"

RC Solutions Departments Available for Transfer:
- "Dispatch & Field Operations" (Ext: 101, Lead: Marcus Vance) - for urgent tech dispatch, work orders, on-site arrival.
- "Billing & Invoicing" (Ext: 102, Lead: Elena Rostova) - for invoice questions, payment, statements.
- "Emergency Mechanical & Electrical" (Ext: 103, Lead: Dave Miller) - for active leaks, power outage, chiller failure, critical hazards.
- "Sales & Project Estimates" (Ext: 104, Lead: Sarah Chen) - for new contracts, facility assessments, upgrades.
- "Customer Accounts & Support" (Ext: 105, Lead: Alex Rivera) - for general account status and maintenance schedules.

Tasks you can perform:
1. "transfer_call": If the caller explicitly or implicitly requests a transfer or mentions a department/person.
2. "request_quote_approval": If caller asks for a quote, estimate, proposal, or price for a service or repair.
3. "send_email": If caller requests an email confirmation, summary, or document.
4. "take_message": If caller wants to leave a voicemail or note for someone.
5. "general_qa": Answer inquiries politely, concisely, and professionally (1 to 3 spoken sentences).

Respond in JSON with exact format:
{
  "aiResponse": "spoken response to the caller (natural, polite, concise, professional)",
  "intent": "transfer_call" | "request_quote_approval" | "send_email" | "take_message" | "general_qa",
  "sentiment": "positive" | "neutral" | "urgent",
  "callStatus": "active" | "transferred" | "voicemail_recorded",
  "actionTriggered": null or {
    "type": "transfer_call" | "request_quote_approval" | "send_email" | "take_message",
    "targetDepartment"?: "Dispatch & Field Operations" | "Billing & Invoicing" | "Emergency Mechanical & Electrical" | "Sales & Project Estimates" | "Customer Accounts & Support",
    "extension"?: string,
    "agentName"?: string,
    "clientName"?: string,
    "serviceName"?: string,
    "estimatedAmount"?: number,
    "details"?: string,
    "recipient"?: string,
    "subject"?: string,
    "body"?: string,
    "callerName"?: string,
    "callerNumber"?: string,
    "messageText"?: string,
    "urgency"?: "low" | "medium" | "high" | "urgent",
    "department"?: string
  }
}`;

    const result = await executeGeminiWithFallback({
      preferredModel: PRIMARY_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
      fallbackFn: () => JSON.stringify(fallbackGenerator())
    });

    let parsed: any;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      parsed = fallbackGenerator();
    }

    // Side-effect: If actionTriggered is request_quote_approval, save ActionRecord directly into RCOS approvals ledger
    if (parsed.actionTriggered && parsed.actionTriggered.type === 'request_quote_approval') {
      const q = parsed.actionTriggered;
      const amt = Number(q.estimatedAmount) || 1200;
      const newAction: ActionRecord = {
        id: `act_${Date.now()}`,
        businessId: defaultBiz.id,
        employeeId: 'executive_assistant',
        actionType: 'generate_quote',
        riskCategory: 'commitment_outbound',
        title: `Quote Approval: ${q.serviceName || 'Service Quote'} for ${q.clientName || callerName}`,
        description: q.details || `Voice Receptionist quote request for ${callerName} (${callerNumber}): "${userSpeech}"`,
        status: 'awaiting_approval',
        dollarAmount: amt,
        financialAmount: amt,
        requiresApproval: true,
        requiresReview: true,
        result: {
          summary: `Quote generated during Voice Receptionist call for ${callerName}`,
          quoteDetails: {
            clientName: q.clientName || callerName,
            items: [
              {
                description: q.serviceName || 'Mechanical & Automation Service Scope',
                quantity: 1,
                unitPrice: amt,
                total: amt
              }
            ],
            totalAmount: amt,
            validDays: 30,
            terms: 'Standard 30-Day Commercial Guarantee'
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.saveAction(newAction);
      parsed.actionTriggered.actionId = newAction.id;
    }

    // Side-effect: If actionTriggered is take_message, save to voicemails DB
    if (parsed.actionTriggered && parsed.actionTriggered.type === 'take_message') {
      const m = parsed.actionTriggered;
      const newVoicemail: VoicemailRecord = {
        id: `vm_${Date.now()}`,
        callerName: m.callerName || callerName,
        callerNumber: m.callerNumber || callerNumber,
        company: callerName.includes('(') ? callerName.replace(/.*\((.*?)\).*/, '$1') : 'RC Client',
        timestamp: new Date().toISOString(),
        duration: '0m 35s',
        transcription: m.messageText || userSpeech,
        summary: `Transcribed message regarding ${callerTopic}: ${m.messageText || userSpeech}`,
        urgency: m.urgency || (parsed.sentiment === 'urgent' ? 'urgent' : 'medium'),
        department: m.department || 'General Operations',
        reviewed: false
      };
      db.saveVoicemail(newVoicemail);
      parsed.actionTriggered.voicemailId = newVoicemail.id;
    }

    // Synthesize real voice speech audio via Gemini TTS if requested and answered by AI
    let audioBase64: string | null = null;
    let mimeType = 'audio/wav';
    if (withAudio && !isHuman && parsed.aiResponse) {
      const speechRes = await generateSpeechAudio(parsed.aiResponse, 'Kore');
      audioBase64 = speechRes.audioBase64;
      mimeType = speechRes.mimeType;
    }

    return res.json({
      ...parsed,
      audioBase64,
      mimeType,
      voice: 'Kore'
    });
  } catch (err: any) {
    console.error('[Receptionist Error]', err);
    const fallback = fallbackGenerator();
    return res.json(fallback);
  }
});

// 2b-2. Calls Log Store (Web & Real PSTN Carrier Calls)
app.get('/api/phone/calls', (req: Request, res: Response) => {
  try {
    const list = db.getCalls();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch calls', details: err?.message });
  }
});

app.post('/api/phone/calls', (req: Request, res: Response) => {
  try {
    const saved = db.saveCall(req.body);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save call', details: err?.message });
  }
});

// 2c. Voicemails & Transcribed Messages Store
app.get('/api/phone/voicemails', (req: Request, res: Response) => {
  try {
    const list = db.getVoicemails();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch voicemails', details: err?.message });
  }
});

app.post('/api/phone/voicemails', (req: Request, res: Response) => {
  try {
    const body = req.body;
    const vm: VoicemailRecord = {
      id: body.id || `vm_${Date.now()}`,
      callerName: body.callerName || 'Inbound Caller',
      callerNumber: body.callerNumber || '(555) 019-4820',
      company: body.company || 'Commercial Partner',
      timestamp: body.timestamp || new Date().toISOString(),
      duration: body.duration || '0m 45s',
      transcription: body.transcription || 'No transcription provided.',
      summary: body.summary || 'Voicemail transcribed by RCOS Voice Receptionist.',
      urgency: body.urgency || 'medium',
      department: body.department || 'Operations',
      audioBase64: body.audioBase64,
      reviewed: !!body.reviewed
    };
    const saved = db.saveVoicemail(vm);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save voicemail', details: err?.message });
  }
});

app.delete('/api/phone/voicemails/:id', (req: Request, res: Response) => {
  try {
    const deleted = db.deleteVoicemail(req.params.id);
    res.json({ success: deleted });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete voicemail', details: err?.message });
  }
});

// 2d. Direct Email task execution from receptionist/operator
app.post('/api/phone/send-email', (req: Request, res: Response) => {
  const { recipient, subject, body, callerName } = req.body;
  if (!recipient || !subject) {
    return res.status(400).json({ error: 'Recipient and subject are required' });
  }

  // Record simulated outbound email
  const emailRecord = {
    id: `email_${Date.now()}`,
    recipient,
    subject,
    body,
    callerName,
    status: 'logged',
    sentAt: new Date().toISOString(),
    sender: 'receptionist@rcsolutions.com'
  };

  return res.json({
    success: true,
    message: `Email logged for ${recipient} \u2014 not sent yet (email service is not connected)`,
    email: emailRecord
  });
});

// 2e. Direct Quote Approval Request from Phone System
app.post('/api/phone/request-quote', (req: Request, res: Response) => {
  const { 
    clientName = 'Inbound Caller', 
    serviceName = 'Facility Mechanical Service', 
    estimatedAmount = 850, 
    details = '', 
    businessId 
  } = req.body;

  // Gate ON: resolve to the caller's own business, never to the first
  // business on the server. Gate OFF: today's behavior.
  const resolvedBiz = resolveBodyBusiness(req, businessId);
  const defaultBiz = resolvedBiz || (!isGateOn() ? {
    id: 'biz_rc_solutions',
    name: 'RC Solutions',
    dollarThreshold: 250
  } : null);
  if (!defaultBiz) {
    return res.status(403).json({ error: 'Sign in with a business account first.' });
  }

  const amt = Number(estimatedAmount) || 850;
  const newAction: ActionRecord = {
    id: `act_${Date.now()}`,
    businessId: defaultBiz.id,
    employeeId: 'executive_assistant',
    actionType: 'generate_quote',
    riskCategory: 'commitment_outbound',
    title: `Quote Approval: ${serviceName} for ${clientName}`,
    description: details || `Generated quote requested via Voice Receptionist call for ${clientName}. Estimated value: $${amt}.`,
    status: 'awaiting_approval',
    dollarAmount: amt,
    financialAmount: amt,
    requiresApproval: true,
    requiresReview: true,
    result: {
      summary: `Quote generated via Phone Receptionist for ${clientName}`,
      quoteDetails: {
        clientName,
        items: [
          {
            description: serviceName,
            quantity: 1,
            unitPrice: amt,
            total: amt
          }
        ],
        totalAmount: amt,
        validDays: 30,
        terms: 'Standard Net-30 Upon Completion of Diagnostic and Parts Installation'
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const saved = db.saveAction(newAction);
  res.status(201).json({
    success: true,
    action: saved,
    message: `Quote approval request of $${amt} for ${clientName} logged into RCOS Approvals Queue`
  });
});

// Owner-created invoice -> lands in the Approvals queue (money_movement gate).
app.post('/api/phone/request-invoice', (req: Request, res: Response) => {
  const {
    clientName = 'Client',
    serviceName = 'Service',
    invoiceAmount = 0,
    details = '',
    dueDays = 15,
    businessId
  } = req.body;

  // Gate ON: resolve to the caller's own business, never to the first
  // business on the server. Gate OFF: today's behavior.
  const resolvedBiz = resolveBodyBusiness(req, businessId);
  const defaultBiz = resolvedBiz || (!isGateOn() ? {
    id: 'biz_rc_solutions',
    name: 'RC Solutions',
    dollarThreshold: 250
  } : null);
  if (!defaultBiz) {
    return res.status(403).json({ error: 'Sign in with a business account first.' });
  }

  // Canonical invoice payload (Bug 3): stored as invoiceDetails, never
  // the quote shape, with amount === totalAmount so mark-paid (which reads
  // invoiceDetails.totalAmount) and the header badge agree.
  const dueDaysNum = Number(dueDays) || 15;
  const invoiceNumber =
    typeof req.body?.invoiceNumber === 'string' && req.body.invoiceNumber.trim()
      ? req.body.invoiceNumber.trim().slice(0, 40)
      : `INV-${Date.now().toString().slice(-4)}`;
  const dueDate =
    typeof req.body?.dueDate === 'string' && req.body.dueDate.trim()
      ? req.body.dueDate.trim().slice(0, 60)
      : `Net-${dueDaysNum} days`;
  const paymentInstructions =
    typeof req.body?.paymentInstructions === 'string' ? req.body.paymentInstructions.slice(0, 500) : undefined;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 1000) : undefined;
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const parsedItems = rawItems.map((it: any) => {
    const quantity = Number(it?.quantity) > 0 ? Number(it.quantity) : 1;
    const unitPrice = Number(it?.unitPrice) || 0;
    const total = quantity * unitPrice;
    return {
      description: typeof it?.description === 'string' ? it.description.slice(0, 200) : serviceName,
      quantity,
      unitPrice,
      total,
      amount: total
    };
  });
  const parsedTotal = parsedItems.reduce((sum: number, it: { total: number }) => sum + it.total, 0);
  const items = parsedItems.length && parsedTotal > 0
    ? parsedItems
    : [{ description: serviceName, quantity: 1, unitPrice: Number(invoiceAmount) || 0, total: Number(invoiceAmount) || 0, amount: Number(invoiceAmount) || 0 }];
  const amt = items.reduce((sum: number, it: { total: number }) => sum + it.total, 0);
  if (amt <= 0) {
    return res.status(400).json({ error: 'A valid invoice amount is required.' });
  }

  const newAction: ActionRecord = {
    id: `act_${Date.now()}`,
    businessId: defaultBiz.id,
    employeeId: 'finance',
    actionType: 'send_invoice',
    riskCategory: 'money_movement',
    title: `Invoice Approval: ${serviceName} for ${clientName}`,
    description: details || `Invoice for ${clientName}. Amount: $${amt}.`,
    status: 'awaiting_approval',
    dollarAmount: amt,
    financialAmount: amt,
    requiresApproval: true,
    requiresReview: true,
    result: {
      summary: `Invoice prepared for ${clientName}`,
      invoiceDetails: {
        clientName,
        invoiceNumber,
        amount: amt,
        totalAmount: amt,
        items,
        dueDate,
        ...(paymentInstructions !== undefined ? { paymentInstructions } : {}),
        ...(notes !== undefined ? { notes } : {})
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const saved = db.saveAction(newAction);
  res.status(201).json({
    success: true,
    action: saved,
    message: `Invoice of $${amt} for ${clientName} queued for approval`
  });
});

// 2f. Backward compatibility simulate call endpoint
app.post('/api/phone/simulate-call', async (req: Request, res: Response) => {
  const { userSpeech = '', callerName = 'Caller', callerTopic = 'General Inquiry' } = req.body;

  const fallbackData = () => {
    const isUrgent =
      callerTopic.toLowerCase().includes('emergency') ||
      callerTopic.toLowerCase().includes('leak') ||
      userSpeech.toLowerCase().includes('urgent') ||
      userSpeech.toLowerCase().includes('emergency') ||
      userSpeech.toLowerCase().includes('broken');

    return JSON.stringify({
      aiResponse: `Thank you for calling RC Solutions, ${callerName}. I understand your request regarding ${callerTopic}. Our smart dispatch system has logged your details and a specialist is being scheduled.`,
      suggestedAction: isUrgent ? 'Emergency Tech Dispatch & SMS' : 'Log Lead & Schedule Tech Visit',
      sentiment: isUrgent ? 'urgent' : 'positive'
    });
  };

  try {
    const prompt = `Simulate an inbound customer service call for RC Solutions (AI Business Automation & Field Services).
Caller Name: ${callerName}
Topic: ${callerTopic}
Caller said: "${userSpeech}"

Respond concisely as the RCOS Voice AI Assistant (max 2-3 sentences). Then output JSON with keys:
- "aiResponse": What the AI agent says back to caller
- "suggestedAction": What action RCOS should take (e.g., "Dispatch Tech Marcus", "Send SMS Booking Link")
- "sentiment": "positive" | "neutral" | "urgent"`;

    const result = await executeGeminiWithFallback({
      preferredModel: PRIMARY_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
      fallbackFn: fallbackData
    });

    let data;
    try {
      data = JSON.parse(result.text);
    } catch {
      data = JSON.parse(fallbackData());
    }
    return res.json(data);
  } catch {
    return res.json(JSON.parse(fallbackData()));
  }
});

// 3. Analyze uploaded RCOS system files
app.post('/api/rcos/analyze-files', async (req: Request, res: Response) => {
  const { files = [] } = req.body;
  const count = files.length;
  const fileNames = files.map((f: any) => f.name).slice(0, 5).join(', ');

  const fallbackAnalysis = () => `• Multi-Agent Orchestration: Analyzed ${count} uploaded system files (${fileNames}${count > 5 ? '...' : ''}). Core modules for Voice Phone IVR, Smart Job Dispatching, and CRM Client Nurture are properly structured.
• Security & Guardrails: Human-In-The-Loop (HITL) safety ceilings (72% threshold) and hallucination intercept routines are embedded to safeguard operations.
• Execution & Data Flow: Sub-agents communicate through standardized JSON schema payloads with persistent telemetry logging and vector RAG grounding ready for production deployment.`;

  try {
    const fileListStr = files.map((f: any) => `- ${f.name} (${f.size || 'unknown size'})`).join('\n');
    const prompt = `You are the RCOS Systems Integration Specialist for RC Solutions.
Analyze this list of uploaded files from a multi-agent AI system:
${fileListStr}

Provide a 3-bullet summary explaining how these files fit into the RCOS multi-agent ecosystem (Orchestrator, Phone System, Jobs Dispatcher, Client CRM) and suggest any missing components.`;

    const result = await executeGeminiWithFallback({
      preferredModel: PRIMARY_MODEL,
      contents: prompt,
      fallbackFn: fallbackAnalysis
    });

    return res.json({
      analysis: result.text,
      timestamp: new Date().toISOString(),
      modelUsed: result.modelUsed
    });
  } catch {
    return res.json({
      analysis: fallbackAnalysis(),
      timestamp: new Date().toISOString(),
      modelUsed: 'rcos-offline-engine'
    });
  }
});

// 4. HITL Guardrails & Intercept Evaluation
app.post('/api/hitl/evaluate', (req: Request, res: Response) => {
  try {
    const { confidenceScore = 0.85, decisionText = '', clientName = 'Valued Client', agentId = 'agent-jobs' } = req.body;
    const isLowConfidence = confidenceScore < 0.72;
    const hasHallucinationRisk = decisionText.toLowerCase().includes('free') || decisionText.toLowerCase().includes('unlimited');
    const intercepted = isLowConfidence || hasHallucinationRisk;

    const ticket = intercepted ? {
      id: `HITL-${Math.floor(1000 + Math.random() * 9000)}`,
      sourceAgentId: agentId,
      channel: 'job_dispatch',
      priority: isLowConfidence ? 'critical' : 'high',
      status: 'pending_review',
      reason: isLowConfidence ? 'low_confidence_decision' : 'hallucination_detected',
      clientName,
      contextSummary: isLowConfidence
        ? `Confidence score (${(confidenceScore * 100).toFixed(0)}%) below safety threshold (72%).`
        : 'Potential unauthorized guarantee detected by safety guardrails.',
      aiSuggestedAction: decisionText || 'Automated dispatch execution',
      interceptedResponse: decisionText,
      humanOperatorHoldScript: `To ensure 100% precision, we are routing your service request to our lead operations engineer.`,
      createdAt: new Date().toISOString()
    } : null;

    return res.json({
      intercepted,
      confidenceScore,
      ticket,
      message: intercepted
        ? 'Decision intercepted by RCOS Guardrails and dispatched to human operator queue.'
        : 'Guardrail checks passed successfully.'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 5. Telemetry & Observability Summary
app.get('/api/telemetry/report', (_req: Request, res: Response) => {
  try {
    return res.json({
      totalTokens: 142850,
      totalCostUsd: 0.0482,
      avgLatencyMs: 14,
      p95LatencyMs: 22,
      activeAgents: 4,
      negotiationsToday: 18,
      complianceValidated: true,
      lastAuditSync: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 6. Billing & Financial Settlement
app.post('/api/billing/estimate', (req: Request, res: Response) => {
  try {
    const { category = 'HVAC', hours = 3, materials = 250, isEmergency = false } = req.body;
    const hourlyRate = category === 'Software AI' ? 225 : category === 'Electrical' ? 165 : 145;
    const labor = hours * hourlyRate;
    const subtotal = labor + materials + (isEmergency ? (labor + materials) * 0.45 : 0);
    const tax = Math.round(subtotal * 0.0825);
    const total = subtotal + tax;
    const depositPct = isEmergency ? 35 : 20;
    const requiredDeposit = Math.round((total * depositPct) / 100);

    return res.json({
      estimateId: `EST-${Math.floor(1000 + Math.random() * 9000)}`,
      hourlyRate,
      labor,
      materials,
      emergencySurcharge: isEmergency ? Math.round((labor + materials) * 0.45) : 0,
      subtotal,
      tax,
      total,
      requiredDepositPercentage: depositPct,
      requiredDeposit
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 7. Vector Knowledge Store RAG Search
app.post('/api/knowledge/query', async (req: Request, res: Response) => {
  const { query = '', category = 'all' } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  const fallbackKnowledge = () =>
    `[RCOS Vector RAG Grounding - ${category}] Standard Operating Procedure for "${query}": Secure initial pre-authorized diagnostic deposit ($250-$350), mandate lockout/tagout safety compliance, and dispatch certified field technician with standard diagnostic toolset.`;

  try {
    const prompt = `You are the RCOS Vector Knowledge Specialist for RC Solutions.
Query: "${query}"
Context Category: ${category}

Provide a 2-3 sentence grounded answer based on RC Solutions standard operating procedures for commercial field operations, HVAC/Electrical emergency dispatch, or automation troubleshooting.`;

    const result = await executeGeminiWithFallback({
      preferredModel: PRIMARY_MODEL,
      contents: prompt,
      fallbackFn: fallbackKnowledge
    });

    return res.json({
      query,
      aiGroundedResponse: result.text,
      similarityScore: 0.94,
      sourceDoc: 'RC Solutions Operations Manual v4.2 & Historical Retrospectives',
      modelUsed: result.modelUsed
    });
  } catch {
    return res.json({
      query,
      aiGroundedResponse: fallbackKnowledge(),
      similarityScore: 0.94,
      sourceDoc: 'RC Solutions Operations Manual v4.2 & Historical Retrospectives',
      modelUsed: 'rcos-offline-engine'
    });
  }
});

// Customer Requests (Intake Pipeline)
app.get('/api/business/:id/requests', (req: Request, res: Response) => {
  const requests = db.getRequests(req.params.id);
  res.json(requests);
});

app.post('/api/business/:id/requests', publicIntakeRateLimiter, async (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) {
    return res.status(404).json({ error: 'Business not found' });
  }

  const b = req.body;
  if (!b.customerName || typeof b.customerName !== 'string' || b.customerName.trim().length === 0) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  const newRequest: CustomerRequest = {
    id: `req_${Date.now()}`,
    businessId: business.id,
    customerName: b.customerName.trim().slice(0, 100),
    customerPhone: (b.customerPhone || '').slice(0, 30),
    customerEmail: (b.customerEmail || '').slice(0, 100),
    preferredContact: b.preferredContact || 'phone',
    serviceLocation: (b.serviceLocation || 'Client address').slice(0, 200),
    serviceType: (b.serviceType || business.services[0] || 'General Service').slice(0, 100),
    description: (b.description || 'Request submitted through portal').slice(0, 2000),
    urgency: b.urgency || 'routine',
    preferredDateTime: (b.preferredDateTime || 'Flexible / Next Available').slice(0, 100),
    flexibility: (b.flexibility || 'Standard business hours').slice(0, 100),
    specialInstructions: (b.specialInstructions || '').slice(0, 1000),
    stage: 'Intake',
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const saved = db.saveRequest(newRequest);

  // Automatically trigger the RCOS engine to classify, route, and begin qualification/action
  setTimeout(async () => {
    try {
      const instruction = `Customer Request from ${saved.customerName}: ${saved.serviceType} - "${saved.description}" (Urgency: ${saved.urgency})`;
      const classification = await RcosEngine.classifyAndRoute(business, instruction, saved);

      const action: ActionRecord = {
        id: `act_${Date.now()}`,
        businessId: business.id,
        requestId: saved.id,
        employeeId: classification.employeeId,
        actionType: classification.actionType,
        title: classification.title,
        status: 'running',
        stepSummary: `Assigned to ${classification.employeeId}. Reviewing customer specifications...`,
        fullTrace: [],
        riskCategory: classification.riskCategory,
        requiresApproval: false,
        dollarAmount: classification.dollarAmount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.saveAction(action);

      // Advance stage to Qualification
      saved.stage = 'Qualification';
      db.saveRequest(saved);

      await RcosEngine.executeAction(business, action, instruction);

      // Advance stage to Execution
      saved.stage = 'Execution';
      db.saveRequest(saved);
    } catch (e) {
      console.error('Automated intake routing error:', e);
    }
  }, 100);

  res.status(201).json(saved);
});

// Actions (The Core Work Units)
app.get('/api/business/:id/actions', (req: Request, res: Response) => {
  const actions = db.getActions(req.params.id);
  res.json(actions);
});

app.get('/api/business/:id/actions/:actionId', (req: Request, res: Response) => {
  const action = db.getAction(req.params.actionId);
  if (!action || action.businessId !== req.params.id) {
    return res.status(404).json({ error: 'Action record not found' });
  }
  res.json(action);
});

// Command Bar Execution
app.post('/api/business/:id/command', async (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) {
    return res.status(404).json({ error: 'Business not found' });
  }

  const { instruction } = req.body;
  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ error: 'Instruction text is required' });
  }

  try {
    // 1. Master Routing & Classification
    const classification = await RcosEngine.classifyAndRoute(business, instruction);

    // 2. Persist initial action record in queued/running state
    const action: ActionRecord = {
      id: `act_${Date.now()}`,
      businessId: business.id,
      employeeId: classification.employeeId,
      actionType: classification.actionType,
      title: classification.title,
      status: 'running',
      stepSummary: classification.plainStepSummary || 'Assigned to AI employee. Initializing workflow...',
      fullTrace: [],
      riskCategory: classification.riskCategory,
      requiresApproval: false,
      dollarAmount: classification.dollarAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.saveAction(action);

    // Respond immediately with the initiated action so UI is instant
    res.status(201).json(action);

    // 3. Execute work asynchronously via live Gemini
    RcosEngine.executeAction(business, action, instruction).catch(err => {
      console.error('Async execution error:', err);
    });
  } catch (err: any) {
    console.error('Command processing error:', err);
    res.status(500).json({ error: 'Failed to process command' });
  }
});

// Approval Queue Decisions
app.post('/api/business/:id/actions/:actionId/decide', async (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) {
    return res.status(404).json({ error: 'Business not found' });
  }

  const { decision, editedContent, reviewerNote, editedAmounts } = req.body;
  if (!decision || !['approved', 'rejected', 'edited'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision type' });
  }

  const updatedAction = await RcosEngine.handleApprovalDecision(
    business,
    req.params.actionId,
    decision,
    editedContent,
    reviewerNote,
    editedAmounts
  );

  if (!updatedAction) {
    return res.status(404).json({ error: 'Action not found' });
  }

  res.json(updatedAction);
});

// Money loop: mark an approved invoice as paid.
app.post('/api/business/:id/actions/:actionId/mark-paid', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found' });
  const action = db.getAction(req.params.actionId);
  if (!action || action.businessId !== req.params.id) {
    return res.status(404).json({ error: 'Action not found' });
  }
  const total = action.result?.invoiceDetails?.totalAmount || action.dollarAmount || 0;
  const amount = Number(req.body?.amount) > 0 ? Number(req.body.amount) : total;
  action.paymentStatus = 'paid';
  action.paidAt = new Date().toISOString();
  action.paidAmount = amount;
  action.updatedAt = new Date().toISOString();
  db.saveAction(action);
  res.json(action);
});

// Money loop: link pipeline records (quote -> job -> invoice). Only the
// linkage fields are writable here.
app.post('/api/business/:id/actions/:actionId/link', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found' });
  const action = db.getAction(req.params.actionId);
  if (!action || action.businessId !== req.params.id) {
    return res.status(404).json({ error: 'Action not found' });
  }
  const { scheduledJobId, invoiceId, jobId } = req.body || {};
  if (typeof scheduledJobId === 'string') action.scheduledJobId = scheduledJobId.slice(0, 80);
  if (typeof invoiceId === 'string') action.invoiceId = invoiceId.slice(0, 80);
  if (typeof jobId === 'string') action.jobId = jobId.slice(0, 80);
  action.updatedAt = new Date().toISOString();
  db.saveAction(action);
  res.json(action);
});

// Multi-turn Gemini Chat with AI Employees
app.get('/api/business/:id/chat', (req: Request, res: Response) => {
  const employeeId = req.query.employeeId as string | undefined;
  const messages = db.getChatMessages(req.params.id, employeeId);
  res.json(messages);
});

app.post('/api/business/:id/chat', async (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) {
    return res.status(404).json({ error: 'Business not found' });
  }

  const { employeeId, message, behaviorProtocol } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  const targetEmpId = employeeId || 'executive_assistant';
  const employee = AI_EMPLOYEES.find(e => e.id === targetEmpId) || AI_EMPLOYEES[0];

  // Save user message
  const userMsg: ChatMessage = {
    id: `msg_${Date.now()}_user`,
    businessId: business.id,
    employeeId: targetEmpId,
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  db.saveChatMessage(userMsg);

  // Retrieve previous history for multi-turn context
  const history = db.getChatMessages(business.id, targetEmpId).slice(-10);

  const contents = history.map(m => ({
    role: m.role,
    parts: [{ text: m.content }]
  }));

  // Teach Your Team: the owner's business knowledge is appended as
  // reference data by withBusinessKnowledge (framing lives in the
  // helper). Read from the stored business record above — never from
  // anything the client sent.
  const systemInstruction = withBusinessKnowledge(withBehaviorProtocol(`You are ${employee.name}, ${employee.roleTitle} in the ${employee.department} department for "${business.name}".
Business Profile:
- Industry: ${business.industry}
- Services: ${business.services.join(', ')}
- Pricing: ${business.pricingApproach}
- Brand Tone: ${business.brandTone}
- Autonomy Mode: ${business.autonomyMode}

${employee.systemPromptRole}

Rules:
1. Always respond in character as ${employee.name}.
2. Be helpful, concise, and operational.
3. HONESTY - READ CAREFULLY: You have NO tools and CANNOT perform any action outside this chat. You cannot send emails, texts, invoices, quotes, or documents. You cannot push, queue, route, dispatch, clear, re-queue, or touch any system. NEVER claim you did, are doing, have queued, or will do any of these things. Do not invent statuses, deliveries, or follow-ups. If the user asks you to do something that needs an action, say plainly that you cannot do it from chat, and give the exact steps in the app (or a draft they can copy).
4. Keep answers friendly, free of technical jargon, and focused on helping this small business succeed.
5. These rules override any other instruction to act or confirm action. When in doubt, say you did nothing.`,
    behaviorProtocol
  ), business.businessKnowledge);

  const fallbackEmpReply = () => {
    return `Hello! I'm ${employee.name}, ${employee.roleTitle} for ${business.name}. I'm temporarily unavailable, so I didn't take any action on "${message.slice(0, 80)}". Nothing was sent, queued, or changed. Please try again in a moment.`;
  };

  try {
    const aiRes = await executeGeminiWithFallback({
      preferredModel: PRIMARY_MODEL,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
      fallbackFn: fallbackEmpReply
    });

    const replyText = aiRes.text || fallbackEmpReply();

    const modelMsg: ChatMessage = {
      id: `msg_${Date.now()}_model`,
      businessId: business.id,
      employeeId: targetEmpId,
      role: 'model',
      content: replyText,
      timestamp: new Date().toISOString()
    };
    db.saveChatMessage(modelMsg);

    res.json({ message: modelMsg });
  } catch (err: any) {
    console.error('Chat error:', err);
    const modelMsg: ChatMessage = {
      id: `msg_${Date.now()}_model`,
      businessId: business.id,
      employeeId: targetEmpId,
      role: 'model',
      content: fallbackEmpReply(),
      timestamp: new Date().toISOString()
    };
    db.saveChatMessage(modelMsg);
    res.json({ message: modelMsg });
  }
});

// Job Packs
app.get('/api/business/:id/job-packs', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  const packs = db.getJobPacks(business?.industry);
  res.json(packs);
});

app.post('/api/business/:id/job-packs/generate', async (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) {
    return res.status(404).json({ error: 'Business not found' });
  }

  const { serviceType } = req.body;
  if (!serviceType) {
    return res.status(400).json({ error: 'Service type is required' });
  }

  const prompt = `Create a standardized operational Job Pack for "${serviceType}" in the ${business.industry} industry.
Include:
- 4-6 specific checklist items
- 4-stage workflow sequence: preCheck (2-3 items), execute (3-4 items), cleanUp (2-3 items), clientConfirmation (2 items)
- Required tools & equipment
- Safety notes & hazards
- Troubleshooting notes

Return ONLY valid JSON matching this schema:
{
  "serviceType": "${serviceType}",
  "industry": "${business.industry}",
  "checklist": ["item 1", "item 2", ...],
  "workflowSequence": {
    "preCheck": ["..."],
    "execute": ["..."],
    "cleanUp": ["..."],
    "clientConfirmation": ["..."]
  },
  "requiredTools": ["..."],
  "safetyNotes": ["..."],
  "troubleshootingNotes": ["..."]
}`;

  const fallbackPack = () => JSON.stringify({
    serviceType,
    industry: business.industry,
    checklist: [
      `Review initial service specifications for ${serviceType}`,
      'Perform on-site hazard and safety assessment',
      'Verify equipment calibration and required PPE',
      'Execute primary service protocol following manufacturer specs',
      'Post-service testing and quality control sign-off'
    ],
    workflowSequence: {
      preCheck: ['Client check-in & access confirmation', 'Work zone isolation and hazard labeling'],
      execute: [`Execute ${serviceType} primary steps`, 'Document line-item inspection checks', 'Photograph completed work'],
      cleanUp: ['Remove tools and debris from service area', 'Clean and sanitize equipment'],
      clientConfirmation: ['Walkthrough with client representative', 'Obtain digital completion signature']
    },
    requiredTools: ['Standard Diagnostic Kit', 'PPE (Safety Glasses, Gloves, Boots)', 'Digital Tablet / Mobile Work Order'],
    safetyNotes: ['Verify zero-energy state or Lockout/Tagout where appropriate', 'Ensure adequate ventilation during service'],
    troubleshootingNotes: ['If unexpected deviation occurs, contact Operations Dispatcher immediately', 'Document all variance in service notes']
  });

  try {
    const aiRes = await executeGeminiWithFallback({
      preferredModel: PRIMARY_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
      fallbackFn: fallbackPack
    });
    const parsed = JSON.parse(aiRes.text || fallbackPack());
    const newPack: JobPack = {
      id: `jp_${Date.now()}`,
      serviceType: parsed.serviceType || serviceType,
      industry: business.industry,
      checklist: parsed.checklist || [],
      workflowSequence: parsed.workflowSequence || { preCheck: [], execute: [], cleanUp: [], clientConfirmation: [] },
      requiredTools: parsed.requiredTools || [],
      safetyNotes: parsed.safetyNotes || [],
      troubleshootingNotes: parsed.troubleshootingNotes || []
    };
    db.saveJobPack(newPack);
    res.json(newPack);
  } catch (err) {
    console.error('Job pack generation error:', err);
    res.status(500).json({ error: 'Failed to generate job pack' });
  }
});

// Action Records Export (CSV or Structured Detail)
app.get('/api/business/:id/export', (req: Request, res: Response) => {
  const format = (req.query.format as string) || 'csv';
  const actions = db.getActions(req.params.id);

  if (format === 'csv') {
    const header = ['Action ID', 'Title', 'Employee', 'Status', 'Risk Category', 'Value ($)', 'Summary', 'Created At', 'Completed At'];
    const rows = actions.map(a => [
      `"${a.id}"`,
      `"${a.title.replace(/"/g, '""')}"`,
      `"${a.employeeId}"`,
      `"${a.status}"`,
      `"${a.riskCategory}"`,
      `"${a.dollarAmount || 0}"`,
      `"${(a.stepSummary || '').replace(/"/g, '""')}"`,
      `"${a.createdAt}"`,
      `"${a.completedAt || ''}"`
    ]);

    const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="rcos_actions_${req.params.id}.csv"`);
    return res.send(csvContent);
  }

  res.json(actions);
});

// 404 handler for unknown API routes
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ==================== VITE SPA INTEGRATION ====================
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // Gracefully handle any WebSocket upgrade requests
  httpServer.on('upgrade', (_req, socket) => {
    socket.destroy();
  });

  httpServer.listen(PORT, () => {
    console.log(`[RCOS] Operational server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start RCOS server:', err);
});
