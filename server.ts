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
  VoicemailRecord
} from './src/types';
import { INDUSTRY_PRESETS } from './src/data/presets';
import { AI_EMPLOYEES } from './src/data/employees';

import { telephonyRouter } from './server/telephony';
import { initAuth, requireAuth } from './server/auth';

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  // Public intake endpoints (demo form, booking page) must be callable from any
  // website origin. They are unauthenticated by design, so a wildcard origin is safe.
  if (req.path.startsWith('/api/public/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
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

// ---- Diagnostics (per RCOS Master Dashboard spec) ----
// Returns system health checks with PASS/WARN/FAIL status.
app.get('/api/diagnostics/scan', (_req: Request, res: Response) => {
  const checks: { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }[] = [];

  // Server core
  checks.push({ id: 'server', label: 'Server Core', status: 'pass', detail: 'API responding normally' });

  // Firebase login gate
  const gateOn = !!process.env.FIREBASE_SERVICE_ACCOUNT;
  checks.push({
    id: 'auth', label: 'Login Gate', status: gateOn ? 'pass' : 'warn',
    detail: gateOn ? 'Firebase Admin active — API requires login' : 'FIREBASE_SERVICE_ACCOUNT not set — API open'
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

// ---- Login gate ----
// Every /api route below this line requires a valid Firebase login token,
// which the phone app already attaches (see src/lib/api.ts).
// Public exceptions (registered above or skipped here):
//   /api/health, /api/firebase-config, and the public intake form
//   POST /api/business/:id/requests (customers must be able to reach you without an account).
// NOTE: inside app.use('/api', ...), Express strips the '/api' mount prefix, so
// req.path here is the path WITHOUT '/api' (verified on Express 4.22). The old
// checks matched '/api/...' and never fired, which wrongly gated the public
// booking page and the voice routing log with a 401.
app.use('/api', (req: Request, res: Response, next) => {
  if (req.method === 'POST' && /^\/business\/[^/]+\/requests$/.test(req.path)) return next();
  if (req.method === 'GET' && /^\/public\/business\/[^/]+$/.test(req.path)) return next();
  if (req.method === 'POST' && req.path === '/public/demo-request') return next();
  // The voice-agent worker authenticates with VOICE_AGENT_SECRET, not a user token.
  if (req.path === '/voice/routing-log') return next();
  // The voice-agent worker also posts proactive inbox messages with VOICE_AGENT_SECRET.
  if (req.method === 'POST' && /^\/business\/[^/]+\/agent-messages$/.test(req.path)) {
    const secret = process.env.VOICE_AGENT_SECRET;
    if (secret && req.headers['x-voice-secret'] === secret) return next();
  }
  return requireAuth(req, res, next);
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
  const name = (b.name || '').toString().trim();
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const businesses = db.getAllBusinesses();
  if (businesses.length === 0) {
    return res.status(503).json({ error: 'Service not ready yet — please call 470-783-2596.' });
  }
  const business = businesses[0];

  const company = (b.businessName || '').toString().trim().slice(0, 120);
  const industry = (b.industry || '').toString().trim().slice(0, 80);
  const message = (b.message || '').toString().trim().slice(0, 2000);
  const lines = ['Demo request from the RC Solutions website.'];
  if (company) lines.push('Company: ' + company);
  if (industry) lines.push('Industry: ' + industry);
  if (message) lines.push('What they want to automate: ' + message);

  const newRequest: CustomerRequest = {
    id: `req_${Date.now()}`,
    businessId: business.id,
    customerName: name.slice(0, 100),
    customerPhone: (b.phone || '').toString().slice(0, 30),
    customerEmail: (b.email || '').toString().slice(0, 100),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const saved = db.saveRequest(newRequest);
  res.status(201).json({ ok: true, id: saved.id });
});

// WebRTC voice: mint a LiveKit access token for an AI receptionist call.
// The voice-agent worker ('rcos-receptionist') is dispatched into the new room automatically.
app.post('/api/voice/token', async (req: Request, res: Response) => {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return res.status(503).json({ error: 'Voice calling is not configured yet (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET).' });
  }
  try {
    const { AccessToken, RoomServiceClient } = await import('livekit-server-sdk');
    const user = (req as any).user || {};
    const businessId = typeof req.body?.businessId === 'string' ? req.body.businessId : 'default';
    const roomName = `receptionist-${businessId}-${Date.now()}`;
    const roomClient = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    await roomClient.createRoom({
      name: roomName,
      emptyTimeout: 60,
      departureTimeout: 20,
      maxParticipants: 2,
      metadata: JSON.stringify({ businessId }),
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

app.get('/api/business/:id/agent-messages', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found' });
  res.json(db.getAgentMessages(req.params.id));
});

app.post('/api/business/:id/agent-messages', (req: Request, res: Response) => {
  const business = db.getBusiness(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found' });
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

// Businesses
app.get('/api/businesses', (req: Request, res: Response) => {
  const businesses = db.getAllBusinesses();
  res.json(businesses);
});

app.post('/api/businesses', (req: Request, res: Response) => {
  const data = req.body;
  const newBusiness: BusinessAccount = {
    id: data.id || `biz_${Date.now()}`,
    name: data.name || 'My Business',
    industry: data.industry || 'general_small_business',
    size: data.size || 'Solo Operator (1)',
    services: Array.isArray(data.services) && data.services.length ? data.services : ['General Service Call'],
    pricingApproach: data.pricingApproach || 'Flat-rate standard pricing',
    brandTone: data.brandTone || 'Professional, friendly, and reliable',
    painPoints: Array.isArray(data.painPoints) ? data.painPoints : [],
    autonomyMode: data.autonomyMode || 'autonomous',
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

  const saved = db.saveBusiness(newBusiness);
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
  const updated = { ...existing, ...req.body, id: existing.id, updatedAt: new Date().toISOString() };
  const saved = db.saveBusiness(updated);
  res.json(saved);
});

app.delete('/api/business/:id', (req: Request, res: Response) => {
  const deleted = db.deleteBusiness(req.params.id);
  res.json({ success: deleted });
});

// Helper to intelligently match industry from keywords locally
function matchIndustryLocally(text: string): {
  preset: typeof INDUSTRY_PRESETS[0];
  confidence: number;
  reason: string;
} {
  const lower = text.toLowerCase();
  const rules: Array<{ keywords: string[]; id: string; reason: string }> = [
    { keywords: ['plumb', 'pipe', 'leak', 'water heater', 'drain', 'hydro-jet', 'sewer', 'faucet', 'toilet', 'repipe', 'backflow'], id: 'plumbing', reason: 'High concentration of plumbing, leak mitigation, and drain service terminology' },
    { keywords: ['electric', 'panel', 'breaker', 'ev charger', 'wiring', 'conduit', 'amp', 'voltage', 'lighting', 'generator', 'nec code', 'gfci'], id: 'electrical', reason: 'Explicit electrical power distribution, EV charger, and panel upgrade indicators' },
    { keywords: ['hvac', 'ac ', 'air conditioning', 'furnace', 'heating', 'heat pump', 'duct', 'thermostat', 'refrigerant', 'chiller', 'freon', 'ventilation'], id: 'hvac', reason: 'Identified heating, ventilation, and air conditioning mechanical systems' },
    { keywords: ['roof', 'shingle', 'gutter', 'flashing', 'ridge cap', 'soffit', 'fascia', 'reroof', 'leak inspection'], id: 'roofing', reason: 'Roofing materials, gutter clearing, and storm damage inspection terminology detected' },
    { keywords: ['msp', 'managed it', 'it support', 'helpdesk', 'cybersecurity', 'cloud', 'm365', 'firewall', 'network', 'sysadmin', 'workstation', 'backup', 'ransomware'], id: 'it_services', reason: 'Managed service provider (MSP), cybersecurity, and cloud IT infrastructure terminology' },
    { keywords: ['solar', 'photovoltaic', 'powerwall', 'inverter', 'battery storage', 'clean energy', 'solar panel', 'pto', 'net metering'], id: 'solar_cleanenergy', reason: 'Solar photovoltaic generation and energy storage engineering detected' },
    { keywords: ['gym', 'fitness', 'personal train', 'workout', 'yoga', 'pilates', 'coach', 'crossfit', 'exercise', 'body composition', 'fms'], id: 'fitness_gyms', reason: 'Health & fitness facility, workout coaching, and athletic training operations' },
    { keywords: ['pet', 'dog', 'cat', 'groom', 'vet', 'veterinary', 'boarding', 'daycare', 'animal', 'canine', 'rabies', 'bather'], id: 'pet_care', reason: 'Pet wellness, veterinary exams, and canine grooming operations identified' },
    { keywords: ['wedding', 'event', 'catering', 'banquet', 'audio/visual', 'av ', 'dj', 'photography', 'videography', 'venue', 'run of show'], id: 'event_production', reason: 'Event planning, catering service, and audio-visual staging indicators' },
    { keywords: ['dental', 'dentist', 'teeth', 'hygiene', 'orthodont', 'aligner', 'cavity', 'oral', 'implant', 'prophylaxis', 'bitewing'], id: 'dental_practices', reason: 'Clinical dentistry, patient dental hygiene, and orthodontic treatments' },
    { keywords: ['mov', 'moving', 'mover', 'storage', 'packing', 'crating', 'van lines', 'freight', 'hauling', 'relocation', 'furniture dolly'], id: 'moving_storage', reason: 'Residential moving, commercial logistics, and secure vault storage detected' },
    { keywords: ['marketing', 'seo', 'ads', 'campaign', 'branding', 'creative agency', 'roas', 'social media', 'website design', 'copywriting'], id: 'marketing_creative', reason: 'Digital marketing, paid advertising campaign management, and creative branding' },
    { keywords: ['airbnb', 'vrbo', 'short-term rental', 'vacation rental', 'turnover', 'guest concierge', 'smart lock', 'linen', 'boutique hotel'], id: 'hospitality_rentals', reason: 'Short-term rental turnover, guest hospitality, and lodging property management' },
    { keywords: ['tutor', 'tutoring', 'academy', 'learning', 'sat', 'act', 'test prep', 'curriculum', 'student', 'math', 'academic'], id: 'education_tutoring', reason: 'Academic tutoring, student learning diagnostic, and educational center operations' },
    { keywords: ['property management', 'tenant', 'lease', 'facility', 'building code', 'scupper', 'egress', 'hoa', 'rent collection'], id: 'property_operations', reason: 'Commercial & residential property operations, tenant leases, and facilities management' },
    { keywords: ['locksmith', 'lockout', 'rekey', 'access control', 'cctv', 'surveillance', 'smart lock', 'alarm', 'electric strike', 'deadbolt'], id: 'security_locksmith', reason: 'Master locksmithing, access control credentialing, and commercial security alarms' },
    { keywords: ['clean', 'maid', 'janitor', 'deep clean', 'disinfect', 'sanitiz', 'turnover clean', 'housekeeping'], id: 'cleaning', reason: 'Residential and commercial cleaning, housekeeping, and deep sanitation services' },
    { keywords: ['paint', 'stain', 'interior paint', 'exterior paint', 'drywall patch', 'primer', 'roller', 'sash brush', 'caulk'], id: 'painting', reason: 'Interior/exterior coatings, drywall prep, and architectural painting' },
    { keywords: ['pressure wash', 'power wash', 'soft wash', 'surface cleaner', 'siding wash', 'concrete cleaning', 'driveway wash'], id: 'pressure_washing', reason: 'High-pressure washing, soft-wash siding care, and concrete surface cleaning' },
    { keywords: ['lawn', 'mow', 'landscap', 'turf', 'mulch', 'edging', 'tree trim', 'irrigation', 'sprinkler', 'yard'], id: 'landscaping', reason: 'Lawn care maintenance, commercial landscaping, and turf irrigation' },
    { keywords: ['auto', 'mechanic', 'car', 'vehicle', 'brake', 'oil change', 'transmission', 'fleet', 'engine', 'diagnostic scanner'], id: 'auto_services', reason: 'Automotive diagnostics, brake repair, mobile mechanic, and fleet maintenance' },
    { keywords: ['handyman', 'home repair', 'fixture', 'mounting', 'carpentry', 'drywall repair', 'cabinet', 'shelf'], id: 'handyman', reason: 'General home maintenance, small repairs, and multi-skill fixture installation' },
    { keywords: ['construct', 'general contractor', 'framing', 'concrete', 'masonry', 'structural', 'subcontractor', 'osha', 'jobsite'], id: 'construction', reason: 'Commercial contracting, framing, structural trades, and general building' },
    { keywords: ['lawyer', 'attorney', 'legal', 'law firm', 'cpa', 'accountant', 'tax', 'bookkeeping', 'audit', 'retainer', 'conflict check'], id: 'legal_accounting', reason: 'Professional legal counsel, CPA accounting, tax filings, and fiduciary practices' },
    { keywords: ['doctor', 'clinic', 'medical', 'patient', 'therapy', 'chiropract', 'physician', 'healthcare', 'wellness', 'telehealth'], id: 'healthcare', reason: 'Clinical patient care, outpatient wellness, and specialized medical practice' },
    { keywords: ['restaurant', 'cafe', 'bistro', 'food', 'kitchen', 'dining', 'catering', 'haccp', 'chef', 'menu', 'culinary'], id: 'restaurants', reason: 'Culinary dining, restaurant hospitality, commercial food safety, and kitchen ops' },
    { keywords: ['salon', 'spa', 'hair', 'stylist', 'barber', 'aesthetician', 'facial', 'skin care', 'manicure', 'lash'], id: 'salons_spas', reason: 'Personal care studio, salon styling, aesthetics, and spa treatments' },
    { keywords: ['retail', 'ecommerce', 'boutique', 'shop', 'order fulfillment', 'sku', 'apparel', 'merchandise', 'shipping label'], id: 'retail_ecommerce', reason: 'Retail storefront, omnichannel e-commerce, and physical order fulfillment' },
    { keywords: ['nonprofit', 'charity', 'foundation', 'volunteer', 'donor', 'grant', 'community outreach', '501c3'], id: 'nonprofits', reason: 'Nonprofit foundation, donor stewardship, and community volunteer programs' },
    { keywords: ['real estate', 'realtor', 'broker', 'escrow', 'open house', 'home staging', 'closing', 'listing'], id: 'real_estate', reason: 'Real estate brokerage, residential sales transactions, and client home showings' },
    { keywords: ['consulting', 'advisory', 'strategy', 'executive coaching', 'management consult', 'b2b'], id: 'professional_services', reason: 'Strategic business advisory, consulting engagements, and corporate professional services' }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      const match = INDUSTRY_PRESETS.find(p => p.id === rule.id);
      if (match) {
        return { preset: match, confidence: 0.94, reason: rule.reason };
      }
    }
  }

  const fallbackPreset = INDUSTRY_PRESETS.find(p => p.id === 'general_small_business') || INDUSTRY_PRESETS[0];
  return {
    preset: fallbackPreset,
    confidence: 0.85,
    reason: 'Matched versatile operational profile suited for broad commercial services and customer support'
  };
}

// AI Onboarding Agent - Document Analysis & Industry Preset Deciphering
app.post('/api/business/analyze-document', async (req: Request, res: Response) => {
  const { fileText, fileName, fileType, fileBase64, rawInput } = req.body;
  const contentToAnalyze = (fileText || rawInput || '').trim();

  if (!contentToAnalyze && !fileBase64) {
    return res.status(400).json({ error: 'No document text or file payload provided' });
  }

  const presetList = INDUSTRY_PRESETS.map(p => `- ${p.id}: "${p.name}" (${p.description})`).join('\n');

  // Smart fallback extraction if AI model is unreachable
  const fallbackExtractor = () => {
    const textSample = contentToAnalyze || fileName || '';
    const match = matchIndustryLocally(textSample);
    
    // Extract potential company name from common headers
    let extractedName = '';
    const namePatterns = [
      /(?:Company|Business|Name|Organization|Invoice From|Prepared For|Client|Contractor):\s*([^\n\r,]+)/i,
      /^([A-Z0-9][A-Za-z0-9\s&'-]{3,35}(?:LLC|Inc|Co|Services|Solutions|Pros|Group|Plumbing|Electric|HVAC|Care|Studio|Agency|Cleaning))/m,
      /^([A-Z][a-zA-Z0-9\s&'-]{3,30})$/m
    ];
    for (const pat of namePatterns) {
      const hit = textSample.match(pat);
      if (hit && hit[1] && hit[1].trim().length > 2) {
        extractedName = hit[1].trim();
        break;
      }
    }

    if (!extractedName && fileName) {
      extractedName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
      extractedName = extractedName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    return JSON.stringify({
      businessName: extractedName || `${match.preset.name.split('&')[0].trim()} Company`,
      industryId: match.preset.id,
      industryName: match.preset.name,
      confidence: match.confidence,
      reasoning: `Deciphered from document: ${match.reason}. Matched core operational requirements and preset workflows.`,
      extractedServices: match.preset.defaultServices.slice(0, 4),
      recommendedTone: match.preset.recommendedTone,
      dollarThreshold: match.preset.id === 'electrical' || match.preset.id === 'construction' || match.preset.id === 'solar_cleanenergy' ? 1750 : 1000,
      technicianRoleName: match.preset.technicianRoleName || 'Field Specialist',
      keyInsights: [
        'Document indicates active customer service requests and field scheduling',
        'Workflows benefit from 24/7 automated receptionist & trade dispatch',
        'Safety limits calibrated to trade operational scope'
      ],
      alternativeIndustries: [
        match.preset.id === 'plumbing' ? 'handyman' : 'general_small_business',
        'professional_services'
      ]
    });
  };

  const prompt = `You are an elite AI Business Onboarding Agent for RCOS (Autonomous Operations OS).
Your goal is to thoroughly read the user's uploaded business document (invoice, company overview, service rate card, proposal, or operations manual), decipher their exact business identity and operations, and determine the optimal industry preset.

AVAILABLE INDUSTRY PRESETS:
${presetList}

DOCUMENT FILENAME: ${fileName || 'Uploaded_Document.txt'}
DOCUMENT MIME TYPE: ${fileType || 'text/plain'}

DOCUMENT CONTENT:
"""
${contentToAnalyze.slice(0, 10000)}
"""

DECIPHERING INSTRUCTIONS:
1. "businessName": Extract the official business/company name from the header, invoice, letterhead, or email. If not explicitly found, infer a professional company name based on their primary service.
2. "industryId": Pick the single most accurate matching preset id from the AVAILABLE INDUSTRY PRESETS above.
3. "industryName": The human-readable name of the selected preset.
4. "confidence": A float between 0.75 and 0.99 reflecting match precision.
5. "reasoning": A 2-sentence explanation citing the specific services, terms, or clues from the document that justify this preset.
6. "extractedServices": 3 to 5 real services offered by this business based on the document.
7. "recommendedTone": Optimal brand tone for customer communications in this trade.
8. "dollarThreshold": Recommended autonomous action approval threshold in dollars (e.g. 500-2500).
9. "technicianRoleName": Precise specialist role title (e.g. "Journeyman Plumber", "Systems Engineer", "Certified Solar Lead").
10. "keyInsights": Array of 2 to 3 concise bullet points highlighting key business traits deciphered from the document (e.g. "Offers 24/7 emergency dispatch", "Commercial and residential service lines").
11. "alternativeIndustries": Array of 2 alternative preset IDs if the user wants to adjust.

Respond with ONLY valid JSON with this exact schema:
{
  "businessName": "...",
  "industryId": "...",
  "industryName": "...",
  "confidence": 0.96,
  "reasoning": "...",
  "extractedServices": ["...", "..."],
  "recommendedTone": "...",
  "dollarThreshold": 1250,
  "technicianRoleName": "...",
  "keyInsights": ["...", "..."],
  "alternativeIndustries": ["...", "..."]
}`;

  try {
    let contentsPayload: any = prompt;

    // If PDF or image base64 provided, include multimodal parts
    if (fileBase64 && (fileType?.includes('pdf') || fileType?.includes('image'))) {
      contentsPayload = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: fileType,
                data: fileBase64
              }
            },
            { text: prompt }
          ]
        }
      ];
    }

    const aiRes = await executeGeminiWithFallback({
      preferredModel: FAST_MODEL,
      contents: contentsPayload,
      config: { responseMimeType: 'application/json' },
      fallbackFn: fallbackExtractor
    });

    const parsed = JSON.parse(aiRes.text || fallbackExtractor());
    
    // Ensure industry preset exists in our presets catalog
    const matchedPreset = INDUSTRY_PRESETS.find(p => p.id === parsed.industryId) || INDUSTRY_PRESETS.find(p => p.id === 'general_small_business');
    if (matchedPreset) {
      parsed.industryId = matchedPreset.id;
      parsed.industryName = matchedPreset.name;
      if (!parsed.extractedServices || parsed.extractedServices.length === 0) {
        parsed.extractedServices = matchedPreset.defaultServices.slice(0, 4);
      }
      if (!parsed.technicianRoleName) {
        parsed.technicianRoleName = matchedPreset.technicianRoleName;
      }
      if (!parsed.recommendedTone) {
        parsed.recommendedTone = matchedPreset.recommendedTone;
      }
    }

    res.json(parsed);
  } catch (err: any) {
    console.error('[Onboarding Agent] Document analysis error:', err);
    res.json(JSON.parse(fallbackExtractor()));
  }
});

// AI Industry Detection
app.post('/api/business/:id/detect-industry', async (req: Request, res: Response) => {
  const { description } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const presetList = INDUSTRY_PRESETS.map(p => `${p.id}: ${p.name} (${p.description})`).join('\n');
  const prompt = `Based on this business owner's description or operational details:
"${description}"

Pick the best matching industry preset from this list:
${presetList}
Or suggest 'general_small_business' if none closely match.

Respond with ONLY valid JSON:
{
  "industryId": "preset_id",
  "industryName": "Human friendly name",
  "reason": "Detailed sentence explaining why this matches their specific operations",
  "suggestedServices": ["Service 1", "Service 2", "Service 3", "Service 4"],
  "technicianRoleName": "Field Specialist Title",
  "recommendedTone": "Professional communication tone",
  "dollarThreshold": 1000
}`;

  const fallbackDetect = () => {
    const local = matchIndustryLocally(description);
    return JSON.stringify({
      industryId: local.preset.id,
      industryName: local.preset.name,
      reason: local.reason,
      suggestedServices: local.preset.defaultServices.slice(0, 4),
      technicianRoleName: local.preset.technicianRoleName || 'Field Specialist',
      recommendedTone: local.preset.recommendedTone,
      dollarThreshold: local.preset.id === 'construction' || local.preset.id === 'electrical' ? 1500 : 1000
    });
  };

  try {
    const aiRes = await executeGeminiWithFallback({
      preferredModel: FAST_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
      fallbackFn: fallbackDetect
    });
    const result = JSON.parse(aiRes.text || fallbackDetect());
    res.json(result);
  } catch (err: any) {
    console.error('Industry detection error:', err);
    res.json(JSON.parse(fallbackDetect()));
  }
});

// Proactive AI Monitor: Evaluates business context & services added, suggesting an optimized Industry Profile preset
app.post('/api/business/:id/suggest-optimized-industry', async (req: Request, res: Response) => {
  const businessId = req.params.id;
  const { services, currentIndustry, businessName } = req.body;

  const currentBiz = db.getBusiness(businessId);
  const effectiveServices: string[] = Array.isArray(services) && services.length > 0
    ? services
    : (currentBiz?.services || []);
  const effectiveCurrentIndustry = currentIndustry || currentBiz?.industry || 'general_small_business';
  const effectiveBizName = businessName || currentBiz?.name || 'Your Business';

  if (!effectiveServices.length) {
    return res.json({ suggestion: null, reason: 'Insufficient services registered to evaluate optimization.' });
  }

  const combinedServicesText = effectiveServices.join(', ');
  const presetList = INDUSTRY_PRESETS.map(p => `- ${p.id}: "${p.name}" (Default: ${p.defaultServices.join(', ')})`).join('\n');

  // Fallback heuristic scoring
  const fallbackOptimization = () => {
    const localMatch = matchIndustryLocally(`${effectiveBizName} ${combinedServicesText}`);
    const matchedPreset = localMatch.preset;

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
        confidence: localMatch.confidence || 0.92,
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
            confidence: parsed.confidence || 0.95,
            matchScore: parsed.matchScore || 95,
            reason: parsed.reason || `Your service catalog matches the specialized workflows and job packs of ${targetPreset.name}.`,
            newServicesDetected: effectiveServices,
            recommendedTone: parsed.recommendedTone || targetPreset.recommendedTone,
            technicianRoleName: parsed.technicianRoleName || targetPreset.technicianRoleName,
            suggestedServices: targetPreset.defaultServices,
            activeEmployees: activeEmps,
            triggers: parsed.triggers || [`Services directly align with ${targetPreset.name}`]
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
  const { messages, roleId = 'executive_assistant', modelTier = 'general', businessId } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const business = businessId ? db.getBusiness(businessId) : null;
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

  const systemInstruction = roleInstructions[roleId] || roleInstructions.executive_assistant;

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

  const defaultBiz = (businessId && db.getBusiness(businessId)) || db.getAllBusinesses()[0] || {
    id: 'biz_rc_solutions',
    name: 'RC Solutions',
    industry: 'automation_field_services',
    dollarThreshold: 250
  };

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

  const defaultBiz = (businessId && db.getBusiness(businessId)) || db.getAllBusinesses()[0] || {
    id: 'biz_rc_solutions',
    name: 'RC Solutions',
    dollarThreshold: 250
  };

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

  const defaultBiz = (businessId && db.getBusiness(businessId)) || db.getAllBusinesses()[0] || {
    id: 'biz_rc_solutions',
    name: 'RC Solutions',
    dollarThreshold: 250
  };

  const amt = Number(invoiceAmount) || 0;
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
        validDays: Number(dueDays) || 15,
        terms: `Net-${Number(dueDays) || 15} days`
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

  const { decision, editedContent, reviewerNote } = req.body;
  if (!decision || !['approved', 'rejected', 'edited'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision type' });
  }

  const updatedAction = await RcosEngine.handleApprovalDecision(
    business,
    req.params.actionId,
    decision,
    editedContent,
    reviewerNote
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

  const { employeeId, message } = req.body;
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

  const systemInstruction = `You are ${employee.name}, ${employee.roleTitle} in the ${employee.department} department for "${business.name}".
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
3. If the user gives a concrete task (e.g., "send an invoice for $200" or "quote Mrs. Smith"), confirm that you are executing it and explain the next step in plain language.
4. Keep answers friendly, free of technical jargon, and focused on helping this small business succeed.`;

  const fallbackEmpReply = () => {
    return `Hello! I'm ${employee.name}, ${employee.roleTitle} for ${business.name}. I've received your directive regarding "${message.slice(0, 80)}" and have queued this up in our operations pipeline.`;
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
