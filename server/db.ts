import fs from 'fs';
import path from 'path';
import { 
  BusinessAccount, 
  CustomerRequest, 
  ActionRecord, 
  ChatMessage, 
  JobPack,
  VoicemailRecord,
  TelephonyConfig,
  PhoneCall,
  AgentInboxMessage,
  TeamMessage,
  TeamInvite,
  BusinessMember,
  PendingIntake
} from '../src/types';
import { INDUSTRY_PRESETS } from '../src/data/presets';

// DATA_DIR can point to a Railway persistent volume (e.g. /data) so the
// database survives redeploys. Railway's default filesystem is ephemeral.
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'rcos_db.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* exists */ }

interface DatabaseSchema {
  businesses: BusinessAccount[];
  requests: CustomerRequest[];
  actions: ActionRecord[];
  chatMessages: ChatMessage[];
  jobPacks: JobPack[];
  voicemails?: VoicemailRecord[];
  telephonyConfig?: TelephonyConfig;
  calls?: PhoneCall[];
  agentMessages?: AgentInboxMessage[];
  teamMessages?: TeamMessage[];
  teamInvites?: TeamInvite[];
  pendingIntake?: PendingIntake[];
}

export function getDefaultTelephonyConfig(): TelephonyConfig {
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  return {
    provider: 'twilio',
    accountSidConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC')),
    authTokenConfigured: !!(process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_AUTH_TOKEN.length > 5),
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '+1 (800) 555-7267',
    webhookUrl: appUrl ? `${appUrl}/api/twilio/voice/incoming` : '/api/twilio/voice/incoming',
    answeringStrategy: 'ai_first',
    ringDurationSeconds: 15,
    operatorForwardingPhone: process.env.OPERATOR_FORWARDING_PHONE || '+1 (555) 019-4820',
    departmentForwardingNumbers: {
      dispatch: process.env.DISPATCH_FORWARDING_PHONE || '+1 (555) 392-8811',
      billing: process.env.BILLING_FORWARDING_PHONE || '+1 (555) 741-2290',
      emergency: process.env.EMERGENCY_FORWARDING_PHONE || '+1 (555) 883-1120',
      sales: process.env.SALES_FORWARDING_PHONE || '+1 (555) 612-4490',
      support: process.env.SUPPORT_FORWARDING_PHONE || '+1 (555) 902-3310'
    },
    greetingMessage: 'Thank you for calling RC Solutions, how may I direct your call or assist you today?',
    ttsVoice: 'Polly.Joanna',
    recordingEnabled: true,
    transcriptionEnabled: true,
    liveCallsActive: 0
  };
}

function ensureDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    // Initial seeded job packs from presets, but strictly ZERO mock businesses/requests/actions
    const initialJobPacks: JobPack[] = [];
    for (const p of INDUSTRY_PRESETS) {
      if (p.sampleJobPacks) {
        initialJobPacks.push(...p.sampleJobPacks);
      }
    }

    const emptyDb: DatabaseSchema = {
      businesses: [],
      requests: [],
      actions: [],
      chatMessages: [],
      jobPacks: initialJobPacks,
      voicemails: [],
      teamMessages: [],
      teamInvites: [],
      pendingIntake: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb, null, 2), 'utf-8');
    return emptyDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.voicemails) parsed.voicemails = [];
    if (!parsed.teamMessages) parsed.teamMessages = [];
    if (!parsed.teamInvites) parsed.teamInvites = [];
    return parsed;
  } catch (err) {
    console.error('Failed to read db file, initializing clean DB', err);
    const fallbackDb: DatabaseSchema = {
      businesses: [],
      requests: [],
      actions: [],
      chatMessages: [],
      jobPacks: [],
      voicemails: [],
      teamMessages: [],
      teamInvites: [],
      pendingIntake: []
    };
    return fallbackDb;
  }
}

function saveDb(data: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving DB to', DB_FILE, err);
  }
}

export const db = {
  // Businesses
  getAllBusinesses(): BusinessAccount[] {
    const data = ensureDb();
    return data.businesses;
  },

  getBusiness(id: string): BusinessAccount | undefined {
    const data = ensureDb();
    return data.businesses.find(b => b.id === id);
  },

  saveBusiness(business: BusinessAccount): BusinessAccount {
    const data = ensureDb();
    const idx = data.businesses.findIndex(b => b.id === business.id);
    if (idx >= 0) {
      data.businesses[idx] = { ...business, updatedAt: new Date().toISOString() };
    } else {
      data.businesses.push(business);
    }
    saveDb(data);
    return idx >= 0 ? data.businesses[idx] : business;
  },

  deleteBusiness(id: string): boolean {
    const data = ensureDb();
    const initLen = data.businesses.length;
    data.businesses = data.businesses.filter(b => b.id !== id);
    data.requests = data.requests.filter(r => r.businessId !== id);
    data.actions = data.actions.filter(a => a.businessId !== id);
    data.chatMessages = data.chatMessages.filter(m => m.businessId !== id);
    if (data.teamMessages) data.teamMessages = data.teamMessages.filter(m => m.businessId !== id);
    if (data.teamInvites) data.teamInvites = data.teamInvites.filter(i => i.businessId !== id);
    saveDb(data);
    return data.businesses.length < initLen;
  },

  /**
   * Delete one or more businesses and ALL of their scoped records:
   * customer requests, actions (quotes/invoices/approvals), chat messages,
   * and agent inbox messages.
   * Voicemails and calls carry no business id, so they are only removed
   * when no businesses remain at all (then they could only have belonged
   * to the deleted businesses). Shared seed job packs are never touched —
   * they are starter templates, not user data.
   */
  deleteBusinessData(businessIds: string[]): { deletedBusinessIds: string[] } {
    const data = ensureDb();
    const targets = new Set(businessIds);
    const deletedBusinessIds = data.businesses.filter(b => targets.has(b.id)).map(b => b.id);
    data.businesses = data.businesses.filter(b => !targets.has(b.id));
    data.requests = data.requests.filter(r => !targets.has(r.businessId));
    data.actions = data.actions.filter(a => !targets.has(a.businessId));
    data.chatMessages = data.chatMessages.filter(m => !targets.has(m.businessId ?? ''));
    if (data.agentMessages) {
      data.agentMessages = data.agentMessages.filter(m => !targets.has(m.businessId));
    }
    if (data.teamMessages) {
      data.teamMessages = data.teamMessages.filter(m => !targets.has(m.businessId));
    }
    if (data.teamInvites) {
      data.teamInvites = data.teamInvites.filter(i => !targets.has(i.businessId));
    }
    // Unattributed records: only safe to clear when nothing remains.
    if (data.businesses.length === 0) {
      data.voicemails = [];
      data.calls = [];
    }
    saveDb(data);
    return { deletedBusinessIds };
  },

  // Customer Requests
  getRequests(businessId: string): CustomerRequest[] {
    const data = ensureDb();
    return data.requests
      .filter(r => r.businessId === businessId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getRequest(id: string): CustomerRequest | undefined {
    const data = ensureDb();
    return data.requests.find(r => r.id === id);
  },

  saveRequest(req: CustomerRequest): CustomerRequest {
    const data = ensureDb();
    const idx = data.requests.findIndex(r => r.id === req.id);
    if (idx >= 0) {
      data.requests[idx] = { ...req, updatedAt: new Date().toISOString() };
    } else {
      data.requests.push(req);
    }
    saveDb(data);
    return idx >= 0 ? data.requests[idx] : req;
  },

  // Pending demo-lead intake — website submissions that arrived while no
  // business existed yet. Queued instead of lost; flushed into Customer
  // Requests when a business is created.
  savePendingIntake(entry: PendingIntake): PendingIntake {
    const data = ensureDb();
    if (!data.pendingIntake) data.pendingIntake = [];
    data.pendingIntake.push(entry);
    saveDb(data);
    return entry;
  },

  // Read + clear all queued intake records (flush). Returns what was queued.
  takePendingIntake(): PendingIntake[] {
    const data = ensureDb();
    const pending = data.pendingIntake || [];
    if (pending.length > 0) {
      data.pendingIntake = [];
      saveDb(data);
    }
    return pending;
  },

  // Actions
  getActions(businessId: string): ActionRecord[] {
    const data = ensureDb();
    return data.actions
      .filter(a => a.businessId === businessId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getAction(id: string): ActionRecord | undefined {
    const data = ensureDb();
    return data.actions.find(a => a.id === id);
  },

  saveAction(act: ActionRecord): ActionRecord {
    const data = ensureDb();
    const idx = data.actions.findIndex(a => a.id === act.id);
    if (idx >= 0) {
      data.actions[idx] = { ...act, updatedAt: new Date().toISOString() };
    } else {
      data.actions.push(act);
    }
    saveDb(data);
    return idx >= 0 ? data.actions[idx] : act;
  },

  // Chat Messages
  getChatMessages(businessId: string, employeeId?: string): ChatMessage[] {
    const data = ensureDb();
    return data.chatMessages
      .filter(m => m.businessId === businessId && (!employeeId || m.employeeId === employeeId))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  saveChatMessage(msg: ChatMessage): ChatMessage {
    const data = ensureDb();
    data.chatMessages.push(msg);
    saveDb(data);
    return msg;
  },

  // Job Packs
  getJobPacks(industry?: string): JobPack[] {
    const data = ensureDb();
    if (industry) {
      return data.jobPacks.filter(j => j.industry === industry || j.industry === 'general_small_business');
    }
    return data.jobPacks;
  },

  saveJobPack(jobPack: JobPack): JobPack {
    const data = ensureDb();
    const idx = data.jobPacks.findIndex(j => j.id === jobPack.id);
    if (idx >= 0) {
      data.jobPacks[idx] = jobPack;
    } else {
      data.jobPacks.push(jobPack);
    }
    saveDb(data);
    return jobPack;
  },

  // Voicemails & Transcribed Messages
  getVoicemails(): VoicemailRecord[] {
    const data = ensureDb();
    return (data.voicemails || []).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  saveVoicemail(vm: VoicemailRecord): VoicemailRecord {
    const data = ensureDb();
    if (!data.voicemails) data.voicemails = [];
    const idx = data.voicemails.findIndex(v => v.id === vm.id);
    if (idx >= 0) {
      data.voicemails[idx] = vm;
    } else {
      data.voicemails.unshift(vm);
    }
    saveDb(data);
    return vm;
  },

  deleteVoicemail(id: string): boolean {
    const data = ensureDb();
    if (!data.voicemails) return false;
    const initialLen = data.voicemails.length;
    data.voicemails = data.voicemails.filter(v => v.id !== id);
    saveDb(data);
    return data.voicemails.length < initialLen;
  },

  // Telephony Carrier Config
  getTelephonyConfig(): TelephonyConfig {
    const data = ensureDb();
    const defaultConfig = getDefaultTelephonyConfig();
    if (!data.telephonyConfig) {
      data.telephonyConfig = defaultConfig;
      saveDb(data);
    }
    // Always sync current runtime environment presence
    data.telephonyConfig.accountSidConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC'));
    data.telephonyConfig.authTokenConfigured = !!(process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_AUTH_TOKEN.length > 5);
    if (process.env.TWILIO_PHONE_NUMBER) {
      data.telephonyConfig.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    }
    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    if (appUrl) {
      data.telephonyConfig.webhookUrl = `${appUrl}/api/twilio/voice/incoming`;
    }
    return data.telephonyConfig;
  },

  saveTelephonyConfig(cfg: Partial<TelephonyConfig>): TelephonyConfig {
    const data = ensureDb();
    const current = this.getTelephonyConfig();
    data.telephonyConfig = {
      ...current,
      ...cfg,
      departmentForwardingNumbers: {
        ...current.departmentForwardingNumbers,
        ...(cfg.departmentForwardingNumbers || {})
      }
    };
    saveDb(data);
    return data.telephonyConfig;
  },

  // Phone Calls
  getCalls(): PhoneCall[] {
    const data = ensureDb();
    return data.calls || [];
  },

  saveCall(call: PhoneCall): PhoneCall {
    const data = ensureDb();
    if (!data.calls) data.calls = [];
    const idx = data.calls.findIndex(c => c.id === call.id || (call.twilioCallSid && c.twilioCallSid === call.twilioCallSid));
    if (idx >= 0) {
      data.calls[idx] = { ...data.calls[idx], ...call };
    } else {
      data.calls.unshift(call);
    }
    saveDb(data);
    return call;
  },

  // Proactive agent messages (the Agent Inbox)
  getAgentMessages(businessId: string): AgentInboxMessage[] {
    const data = ensureDb();
    return (data.agentMessages || [])
      .filter(m => m.businessId === businessId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  saveAgentMessage(msg: AgentInboxMessage): AgentInboxMessage {
    const data = ensureDb();
    if (!data.agentMessages) data.agentMessages = [];
    // Dedupe: never store two unread messages with the same dedupe key.
    if (msg.dedupeKey) {
      const dup = data.agentMessages.find(
        m => m.businessId === msg.businessId && m.dedupeKey === msg.dedupeKey && m.status === 'unread'
      );
      if (dup) return dup;
    }
    data.agentMessages.unshift(msg);
    // Keep the inbox bounded.
    if (data.agentMessages.length > 300) data.agentMessages.length = 300;
    saveDb(data);
    return msg;
  },

  updateAgentMessage(businessId: string, id: string, patch: Partial<AgentInboxMessage>): AgentInboxMessage | undefined {
    const data = ensureDb();
    if (!data.agentMessages) return undefined;
    const msg = data.agentMessages.find(m => m.businessId === businessId && m.id === id);
    if (!msg) return undefined;
    Object.assign(msg, patch);
    saveDb(data);
    return msg;
  },

  // ---- Team (human-to-human) ----

  // Team chat messages. Capped per business so the chat can never grow
  // the database without bound — oldest messages drop off first.
  getTeamMessages(businessId: string): TeamMessage[] {
    const data = ensureDb();
    return (data.teamMessages || [])
      .filter(m => m.businessId === businessId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  saveTeamMessage(msg: TeamMessage): TeamMessage {
    const data = ensureDb();
    if (!data.teamMessages) data.teamMessages = [];
    data.teamMessages.push(msg);
    const MAX_PER_BUSINESS = 500;
    const forBiz = data.teamMessages.filter(m => m.businessId === msg.businessId);
    if (forBiz.length > MAX_PER_BUSINESS) {
      const keep = new Set(forBiz.slice(forBiz.length - MAX_PER_BUSINESS).map(m => m.id));
      data.teamMessages = data.teamMessages.filter(m => m.businessId !== msg.businessId || keep.has(m.id));
    }
    saveDb(data);
    return msg;
  },

  // Team invites. Kept in their own store (NOT on the business record) so
  // the codes are never exposed by the plain business fetch.
  getTeamInvites(businessId: string): TeamInvite[] {
    const data = ensureDb();
    return (data.teamInvites || [])
      .filter(i => i.businessId === businessId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getTeamInviteByCode(code: string): TeamInvite | undefined {
    const data = ensureDb();
    return (data.teamInvites || []).find(i => i.code === code);
  },

  saveTeamInvite(invite: TeamInvite): TeamInvite {
    const data = ensureDb();
    if (!data.teamInvites) data.teamInvites = [];
    const idx = data.teamInvites.findIndex(i => i.code === invite.code);
    if (idx >= 0) data.teamInvites[idx] = invite;
    else data.teamInvites.push(invite);
    saveDb(data);
    return invite;
  },

  // Add or refresh one team member (matched by email — the stable identity
  // across devices). Returns the business, or undefined when not found.
  addBusinessMember(businessId: string, member: BusinessMember): BusinessAccount | undefined {
    const data = ensureDb();
    const biz = data.businesses.find(b => b.id === businessId);
    if (!biz) return undefined;
    if (!biz.members) biz.members = [];
    const email = member.email.toLowerCase();
    const idx = biz.members.findIndex(m => m.email.toLowerCase() === email);
    if (idx >= 0) {
      biz.members[idx] = { ...biz.members[idx], ...member, email: biz.members[idx].email };
    } else {
      biz.members.push(member);
    }
    biz.updatedAt = new Date().toISOString();
    saveDb(data);
    return biz;
  },

  // Remove one team member by email. Historical chat messages stay, with
  // the removed person's name on them. Returns true when someone was removed.
  removeBusinessMember(businessId: string, email: string): boolean {
    const data = ensureDb();
    const biz = data.businesses.find(b => b.id === businessId);
    if (!biz || !biz.members) return false;
    const before = biz.members.length;
    biz.members = biz.members.filter(m => m.email.toLowerCase() !== email.toLowerCase());
    if (biz.members.length === before) return false;
    biz.updatedAt = new Date().toISOString();
    saveDb(data);
    return true;
  }
};
