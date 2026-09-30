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
  PhoneCall
} from '../src/types';
import { INDUSTRY_PRESETS } from '../src/data/presets';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'rcos_db.json');

interface DatabaseSchema {
  businesses: BusinessAccount[];
  requests: CustomerRequest[];
  actions: ActionRecord[];
  chatMessages: ChatMessage[];
  jobPacks: JobPack[];
  voicemails?: VoicemailRecord[];
  telephonyConfig?: TelephonyConfig;
  calls?: PhoneCall[];
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
    greetingMessage: 'Thank you for calling RC Solutions smart mechanical, electrical, and automation services. How may I direct your call or assist you today?',
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
      voicemails: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb, null, 2), 'utf-8');
    return emptyDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.voicemails) parsed.voicemails = [];
    return parsed;
  } catch (err) {
    console.error('Failed to read db file, initializing clean DB', err);
    const fallbackDb: DatabaseSchema = {
      businesses: [],
      requests: [],
      actions: [],
      chatMessages: [],
      jobPacks: [],
      voicemails: []
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
    saveDb(data);
    return data.businesses.length < initLen;
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
  }
};
