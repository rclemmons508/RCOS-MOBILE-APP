import fs from 'fs';
import path from 'path';
import { 
  BusinessAccount, 
  CustomerRequest, 
  ActionRecord, 
  ChatMessage, 
  JobPack 
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
      jobPacks: initialJobPacks
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb, null, 2), 'utf-8');
    return emptyDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read db file, initializing clean DB', err);
    const fallbackDb: DatabaseSchema = {
      businesses: [],
      requests: [],
      actions: [],
      chatMessages: [],
      jobPacks: []
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
  }
};
