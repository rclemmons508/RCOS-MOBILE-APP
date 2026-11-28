/**
 * Durable server store — Firestore-backed (audit Phase 2, backend).
 *
 * The old store kept everything in a local JSON file
 * (DATA_DIR/rcos_db.json). Railway's default filesystem is ephemeral,
 * so every redeploy — which happens on every merge to main — wiped
 * the business store, the call logs, and everything else, and the app
 * had to re-save the business on every foreground just to keep the
 * server usable. This file replaces that store. Clean cutover (Nov
 * 27, 2026): no data migration — the live business was test data and
 * was wiped at the same time, so the store starts empty in Firestore
 * and fills up as the app syncs.
 *
 * How it works (single-process server, so this is safe):
 * - At boot, the whole store is loaded once from Firestore into an
 *   in-memory snapshot. The `db` API below stays SYNCHRONOUS — all
 *   116 call sites keep working unchanged, reading the snapshot.
 * - Every mutation updates the snapshot first (exactly the old
 *   behavior), then persists the changed document(s) to Firestore in
 *   the background. A failed persist stays dirty and is retried on a
 *   timer — a failed write must never silently drop data (the old
 *   file store threw for the same reason, audit #23).
 * - If Firebase Admin is not configured (local dev without
 *   FIREBASE_SERVICE_ACCOUNT), the store runs in-memory only and says
 *   so loudly. Nothing written there survives a restart.
 * - If the boot load fails while Admin IS configured, startup throws
 *   and the process exits — serving an empty store over real data
 *   would be worse than not serving at all (the old file store
 *   refused the same way when its file was unreadable).
 *
 * Database: the NAMED Firestore database
 * ai-studio-rcosmobileapp-c0c46f2b-8d0f-43b8-978d-70fb08614967,
 * used EXPLICITLY — never bare admin.firestore(), which hits the
 * (default) database that holds no businesses. Same pattern as the
 * push-token store (server/pushNotifications.ts).
 *
 * Collections in the named database:
 * - `businesses` — SHARED with the app (same collection, same doc
 *   ids). Server writes here MUST use set(..., { merge: true }) so
 *   app-only fields (agentSettings, serviceCatalog, customFields,
 *   ...) are never clobbered.
 * - `serverCalls`, `serverVoicemails`, `serverRequests`,
 *   `serverActions`, `serverChatMessages`, `serverJobPacks`,
 *   `serverAgentMessages`, `serverTeamMessages`, `serverTeamInvites`,
 *   `serverPendingIntake` — server-only. The app never reads these
 *   directly (it reads calls through GET /api/phone/calls).
 *
 * One consistency note: the snapshot reloads from Firestore on every
 * server start. A record edited directly in the Firebase console
 * (for example the owner wiping a business) takes effect on the next
 * deploy/restart, not instantly — the running server keeps serving
 * its snapshot until then.
 */

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import {
  BusinessAccount,
  CustomerRequest,
  ActionRecord,
  ChatMessage,
  JobPack,
  VoicemailRecord,
  PhoneCall,
  AgentInboxMessage,
  TeamMessage,
  TeamInvite,
  BusinessMember,
  PendingIntake
} from '../src/types';
import { INDUSTRY_PRESETS } from '../src/data/presets';

/** Named Firestore database — the live data lives here, never in
 *  the (default) database. */
const NAMED_FIRESTORE_DB = 'ai-studio-rcosmobileapp-c0c46f2b-8d0f-43b8-978d-70fb08614967';

/** Server-owned collections in the named database. `businesses` is
 *  shared with the app; the rest are server-only (see the header). */
const COLLECTIONS = {
  businesses: 'businesses',
  requests: 'serverRequests',
  actions: 'serverActions',
  chatMessages: 'serverChatMessages',
  jobPacks: 'serverJobPacks',
  voicemails: 'serverVoicemails',
  calls: 'serverCalls',
  agentMessages: 'serverAgentMessages',
  teamMessages: 'serverTeamMessages',
  teamInvites: 'serverTeamInvites',
  pendingIntake: 'serverPendingIntake',
} as const;

type CollectionKey = keyof typeof COLLECTIONS;

// Calls and voicemails are owned by one business (audit #6). The shared
// PhoneCall / VoicemailRecord types live in src/ (client-owned), so the
// server-side owner field is added here. Legacy records may lack it.
export type ScopedPhoneCall = PhoneCall & { businessId?: string };
export type ScopedVoicemail = VoicemailRecord & {
  businessId?: string;
};

// The business that owns records arriving with no business of their own:
// the only business on a single-tenant server, else undefined
// (unattributed — hidden from every tenant once the login gate is on).
export function defaultPhoneBusinessId(): string | undefined {
  const all = getSnapshot().businesses;
  return all.length === 1 ? all[0].id : undefined;
}

interface DatabaseSchema {
  businesses: BusinessAccount[];
  requests: CustomerRequest[];
  actions: ActionRecord[];
  chatMessages: ChatMessage[];
  jobPacks: JobPack[];
  voicemails?: ScopedVoicemail[];
  calls?: ScopedPhoneCall[];
  agentMessages?: AgentInboxMessage[];
  teamMessages?: TeamMessage[];
  teamInvites?: TeamInvite[];
  pendingIntake?: PendingIntake[];
}

// ---- In-memory snapshot (the synchronous API reads this) ----

let snapshot: DatabaseSchema | null = null;
let firestoreReady = false;
let loadWarningLogged = false;

function seedJobPacks(): JobPack[] {
  // Initial seeded job packs from presets, but strictly ZERO mock businesses/requests/actions
  const initialJobPacks: JobPack[] = [];
  for (const p of INDUSTRY_PRESETS) {
    if (p.sampleJobPacks) {
      initialJobPacks.push(...p.sampleJobPacks);
    }
  }
  return initialJobPacks;
}

function freshSnapshot(): DatabaseSchema {
  return {
    businesses: [],
    requests: [],
    actions: [],
    chatMessages: [],
    jobPacks: [],
    voicemails: [],
    calls: [],
    agentMessages: [],
    teamMessages: [],
    teamInvites: [],
    pendingIntake: []
  };
}

function getSnapshot(): DatabaseSchema {
  if (!snapshot) {
    if (!loadWarningLogged) {
      loadWarningLogged = true;
      console.error('[db] Durable store was not loaded at boot — running in-memory only. Restart the server to load from Firestore.');
    }
    snapshot = freshSnapshot();
  }
  return snapshot;
}

function getNamedDb(): admin.firestore.Firestore | null {
  try {
    return admin.apps.length > 0 ? getFirestore(admin.app(), NAMED_FIRESTORE_DB) : null;
  } catch {
    return null;
  }
}

// ---- Firestore persistence (write-through, with retry) ----

// Pending writes: collection -> doc id -> record (null = delete).
const dirty = new Map<CollectionKey, Map<string, unknown | null>>();
let flushTimer: NodeJS.Timeout | null = null;
let flushInFlight = false;

/** Firestore rejects `undefined` field values. The server's record
 *  builders leave optional fields undefined (e.g. a business with no
 *  contactPhone), so strip them before every write. */
function firestoreSafe<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => firestoreSafe(v)) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = firestoreSafe(v);
    }
    return out as T;
  }
  return value;
}

function markDirty(collection: CollectionKey, docId: string, record: unknown | null): void {
  let per = dirty.get(collection);
  if (!per) {
    per = new Map();
    dirty.set(collection, per);
  }
  per.set(docId, record);
  scheduleFlush();
}

function scheduleFlush(delayMs = 0): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushDirty();
  }, delayMs);
  // The timer must never keep the process alive on its own.
  flushTimer.unref?.();
}

async function flushDirty(): Promise<void> {
  if (flushInFlight) {
    scheduleFlush();
    return;
  }
  const store = getNamedDb();
  if (!store) return; // Admin not configured — in-memory only (local dev).
  flushInFlight = true;
  try {
    for (const [collection, docs] of dirty) {
      if (docs.size === 0) continue;
      const colName = COLLECTIONS[collection];
      const entries = [...docs.entries()];
      // Firestore batches cap at 500 writes; stay under it.
      for (let i = 0; i < entries.length; i += 400) {
        const batch = store.batch();
        for (const [docId, record] of entries.slice(i, i + 400)) {
          const ref = store.collection(colName).doc(docId);
          if (record === null) {
            batch.delete(ref);
          } else if (collection === 'businesses') {
            // Merge, never overwrite: the app writes fields the server
            // never sees (agentSettings, serviceCatalog, customFields).
            // A full set here would wipe them.
            batch.set(ref, firestoreSafe(record), { merge: true });
          } else {
            batch.set(ref, firestoreSafe(record));
          }
        }
        await batch.commit();
      }
      // Only drop entries once every chunk committed — a failure above
      // leaves them dirty for the retry below.
      for (const [docId] of entries) docs.delete(docId);
    }
  } catch (err) {
    // Writes stay dirty and the retry timer brings them back. A failed
    // persist must never silently drop data (audit #23).
    console.error('[db] Firestore persist failed — will retry:', (err as Error)?.message || err);
    scheduleFlush(30_000);
  } finally {
    flushInFlight = false;
  }
}

/**
 * Load the whole store from Firestore into the in-memory snapshot.
 * Called once at server startup, before listening. Throws when Admin
 * is configured but the load fails — the caller exits rather than
 * serving an empty store over real data. When Admin is not configured
 * (local dev), starts empty in-memory and says so loudly.
 */
export async function initDurableStore(): Promise<void> {
  const store = getNamedDb();
  if (!store) {
    console.error('[db] Firebase Admin is not configured — the server store is IN-MEMORY ONLY and will be lost on restart. Set FIREBASE_SERVICE_ACCOUNT for durable storage.');
    snapshot = freshSnapshot();
    return;
  }
  const fresh = freshSnapshot();
  // One array per collection, by reference, so the load loop below can
  // push straight into the snapshot.
  const arrays: Record<CollectionKey, unknown[]> = {
    businesses: fresh.businesses,
    requests: fresh.requests,
    actions: fresh.actions,
    chatMessages: fresh.chatMessages,
    jobPacks: fresh.jobPacks,
    voicemails: fresh.voicemails ?? [],
    calls: fresh.calls ?? [],
    agentMessages: fresh.agentMessages ?? [],
    teamMessages: fresh.teamMessages ?? [],
    teamInvites: fresh.teamInvites ?? [],
    pendingIntake: fresh.pendingIntake ?? [],
  };
  for (const key of Object.keys(COLLECTIONS) as CollectionKey[]) {
    const snap = await store.collection(COLLECTIONS[key]).get();
    for (const doc of snap.docs) {
      // The document id IS the record id (businesses, calls, actions…).
      arrays[key].push({ ...doc.data(), id: doc.id });
    }
  }
  fresh.voicemails = arrays.voicemails as ScopedVoicemail[];
  fresh.calls = arrays.calls as ScopedPhoneCall[];
  fresh.agentMessages = arrays.agentMessages as AgentInboxMessage[];
  fresh.teamMessages = arrays.teamMessages as TeamMessage[];
  fresh.teamInvites = arrays.teamInvites as TeamInvite[];
  fresh.pendingIntake = arrays.pendingIntake as PendingIntake[];
  // Calls and voicemails are kept newest-first in memory (they are
  // unshifted on save); Firestore returns no order, so restore it.
  const byTimeDesc = (a: { timestamp?: string }, b: { timestamp?: string }) =>
    new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
  fresh.calls.sort(byTimeDesc);
  fresh.voicemails.sort(byTimeDesc);
  // Seed job packs on a first boot (same starter templates as before).
  if (fresh.jobPacks.length === 0) {
    const seeds = seedJobPacks();
    fresh.jobPacks.push(...seeds);
    for (const pack of seeds) markDirty('jobPacks', pack.id, pack);
  }
  snapshot = fresh;
  firestoreReady = true;
  console.log(`[db] Durable store loaded from Firestore (${NAMED_FIRESTORE_DB}): ${fresh.businesses.length} businesses, ${fresh.calls.length} calls, ${fresh.voicemails.length} voicemails.`);
}

/** True once the boot load from Firestore succeeded. The Diagnostics
 *  scan reports this as the Data Persistence check. */
export function isDurableStoreReady(): boolean {
  return firestoreReady;
}

/** Flush all pending Firestore writes now. Used on graceful shutdown
 *  (SIGTERM) so a redeploy does not leave dirty writes behind. */
export async function flushDurableStore(): Promise<void> {
  await flushDirty();
}

export const db = {
  // Businesses
  getAllBusinesses(): BusinessAccount[] {
    const data = getSnapshot();
    return data.businesses;
  },

  getBusiness(id: string): BusinessAccount | undefined {
    const data = getSnapshot();
    return data.businesses.find(b => b.id === id);
  },

  saveBusiness(business: BusinessAccount): BusinessAccount {
    const data = getSnapshot();
    const idx = data.businesses.findIndex(b => b.id === business.id);
    if (idx >= 0) {
      data.businesses[idx] = { ...business, updatedAt: new Date().toISOString() };
    } else {
      data.businesses.push(business);
    }
    const saved = idx >= 0 ? data.businesses[idx] : business;
    // Merge (see flushDirty): never clobber the app's fields on the
    // shared business document.
    markDirty('businesses', business.id, saved);
    return saved;
  },

  // Patch only the given fields on the CURRENT stored record (audit #13).
  // Use after an await (e.g. a Gemini call) instead of saving a business
  // object read before the await, which would silently revert any change
  // (roster, settings) made in the meantime. Returns undefined when the
  // business no longer exists (deleted meanwhile) — nothing is recreated.
  updateBusiness(id: string, patch: Partial<BusinessAccount>): BusinessAccount | undefined {
    const data = getSnapshot();
    const idx = data.businesses.findIndex(b => b.id === id);
    if (idx < 0) return undefined;
    data.businesses[idx] = { ...data.businesses[idx], ...patch, id, updatedAt: new Date().toISOString() };
    markDirty('businesses', id, data.businesses[idx]);
    return data.businesses[idx];
  },

  // Same cleanup as deleteBusinessData (audit #25): the old copy here left
  // agent inbox messages, calls and voicemails behind. Gmail tokens live in
  // a separate store — callers also run deleteGmailTokens(id).
  deleteBusiness(id: string): boolean {
    return this.deleteBusinessData([id]).deletedBusinessIds.length > 0;
  },

  /**
   * Delete one or more businesses and ALL of their scoped records:
   * customer requests, actions (quotes/invoices/approvals), chat messages,
   * and agent inbox messages.
   * Voicemails and calls owned by a deleted business are removed; legacy
   * ones with no business id are only removed when no businesses remain
   * at all (then they could only have belonged to the deleted businesses). Shared seed job packs are never touched —
   * they are starter templates, not user data.
   *
   * Only the server's own collections are deleted here. The app's
   * subcollections under the business document (jobs, customers, calls,
   * chatMessages) belong to the app — deleting those is a separate
   * console operation, not this route.
   */
  deleteBusinessData(businessIds: string[]): { deletedBusinessIds: string[] } {
    const data = getSnapshot();
    const targets = new Set(businessIds);
    const deletedBusinessIds = data.businesses.filter(b => targets.has(b.id)).map(b => b.id);
    const deleteDoc = (collection: CollectionKey, docId: string) => markDirty(collection, docId, null);
    for (const id of deletedBusinessIds) deleteDoc('businesses', id);
    const scoped = <T extends { businessId?: string }>(arr: T[] | undefined, collection: CollectionKey): T[] => {
      if (!arr) return [];
      const kept: T[] = [];
      for (const r of arr) {
        if (r.businessId && targets.has(r.businessId)) {
          const docId = (r as unknown as { id?: string }).id;
          if (docId) deleteDoc(collection, docId);
        } else {
          kept.push(r);
        }
      }
      return kept;
    };
    data.requests = scoped(data.requests, 'requests');
    data.actions = scoped(data.actions, 'actions');
    data.chatMessages = scoped(data.chatMessages, 'chatMessages');
    if (data.agentMessages) {
      data.agentMessages = scoped(data.agentMessages, 'agentMessages');
    }
    if (data.teamMessages) {
      data.teamMessages = scoped(data.teamMessages, 'teamMessages');
    }
    if (data.teamInvites) {
      // Team invites key their document by code, not id.
      const kept: TeamInvite[] = [];
      for (const i of data.teamInvites) {
        if (targets.has(i.businessId)) deleteDoc('teamInvites', i.code);
        else kept.push(i);
      }
      data.teamInvites = kept;
    }
    // Collect the ids BEFORE filtering — the filtered-out records
    // still need their Firestore documents removed.
    const removedVmIds = (data.voicemails || []).filter(v => v.businessId && targets.has(v.businessId)).map(v => v.id);
    const removedCallIds = (data.calls || []).filter(c => c.businessId && targets.has(c.businessId)).map(c => c.id);
    if (data.voicemails) data.voicemails = data.voicemails.filter(v => !(v.businessId && targets.has(v.businessId)));
    if (data.calls) data.calls = data.calls.filter(c => !(c.businessId && targets.has(c.businessId)));
    for (const id of removedVmIds) deleteDoc('voicemails', id);
    for (const id of removedCallIds) deleteDoc('calls', id);
    // Unattributed records: only safe to clear when nothing remains.
    if (data.businesses.length === 0) {
      for (const v of data.voicemails || []) deleteDoc('voicemails', v.id);
      for (const c of data.calls || []) deleteDoc('calls', c.id);
      data.voicemails = [];
      data.calls = [];
    }
    return { deletedBusinessIds };
  },

  // Customer Requests
  getRequests(businessId: string): CustomerRequest[] {
    const data = getSnapshot();
    return data.requests
      .filter(r => r.businessId === businessId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getRequest(id: string): CustomerRequest | undefined {
    const data = getSnapshot();
    return data.requests.find(r => r.id === id);
  },

  saveRequest(req: CustomerRequest): CustomerRequest {
    const data = getSnapshot();
    const idx = data.requests.findIndex(r => r.id === req.id);
    if (idx >= 0) {
      data.requests[idx] = { ...req, updatedAt: new Date().toISOString() };
    } else {
      data.requests.push(req);
    }
    const saved = idx >= 0 ? data.requests[idx] : req;
    markDirty('requests', req.id, saved);
    return saved;
  },

  // Field-level patch on the CURRENT stored request (audit #13). Returns
  // undefined when the request no longer exists — never resurrects it.
  updateRequest(id: string, patch: Partial<CustomerRequest>): CustomerRequest | undefined {
    const data = getSnapshot();
    const idx = data.requests.findIndex(r => r.id === id);
    if (idx < 0) return undefined;
    data.requests[idx] = { ...data.requests[idx], ...patch, id, updatedAt: new Date().toISOString() };
    markDirty('requests', id, data.requests[idx]);
    return data.requests[idx];
  },

  // Pending demo-lead intake — website submissions that arrived while no
  // business existed yet. Queued instead of lost; flushed into Customer
  // Requests when a business is created.
  savePendingIntake(entry: PendingIntake): PendingIntake {
    const data = getSnapshot();
    if (!data.pendingIntake) data.pendingIntake = [];
    data.pendingIntake.push(entry);
    // Bounded queue (audit #22): keep the newest 500 leads.
    if (data.pendingIntake.length > 500) {
      const dropped = data.pendingIntake.slice(0, data.pendingIntake.length - 500);
      data.pendingIntake = data.pendingIntake.slice(-500);
      for (const d of dropped) markDirty('pendingIntake', d.id, null);
    }
    markDirty('pendingIntake', entry.id, entry);
    return entry;
  },

  // Read + clear all queued intake records (flush). Returns what was queued.
  takePendingIntake(): PendingIntake[] {
    const data = getSnapshot();
    const pending = data.pendingIntake || [];
    if (pending.length > 0) {
      for (const entry of pending) markDirty('pendingIntake', entry.id, null);
      data.pendingIntake = [];
    }
    return pending;
  },

  // Actions
  getActions(businessId: string): ActionRecord[] {
    const data = getSnapshot();
    return data.actions
      .filter(a => a.businessId === businessId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getAction(id: string): ActionRecord | undefined {
    const data = getSnapshot();
    return data.actions.find(a => a.id === id);
  },

  saveAction(act: ActionRecord): ActionRecord {
    const data = getSnapshot();
    const idx = data.actions.findIndex(a => a.id === act.id);
    if (idx >= 0) {
      data.actions[idx] = { ...act, updatedAt: new Date().toISOString() };
    } else {
      data.actions.push(act);
    }
    const saved = idx >= 0 ? data.actions[idx] : act;
    markDirty('actions', act.id, saved);
    return saved;
  },

  // Chat Messages
  getChatMessages(businessId: string, employeeId?: string): ChatMessage[] {
    const data = getSnapshot();
    return data.chatMessages
      .filter(m => m.businessId === businessId && (!employeeId || m.employeeId === employeeId))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  saveChatMessage(msg: ChatMessage): ChatMessage {
    const data = getSnapshot();
    data.chatMessages.push(msg);
    markDirty('chatMessages', msg.id, msg);
    return msg;
  },

  // Job Packs
  // Seed packs (no businessId) are shared starter templates; generated
  // packs carry the businessId that created them and are returned only to
  // that business (audit #17). With no businessId given, only seed packs.
  getJobPacks(industry?: string, businessId?: string): JobPack[] {
    const data = getSnapshot();
    const visible = data.jobPacks.filter(j => {
      const owner = (j as JobPack & { businessId?: string }).businessId;
      return !owner || (!!businessId && owner === businessId);
    });
    if (industry) {
      return visible.filter(j => j.industry === industry || j.industry === 'general_small_business');
    }
    return visible;
  },

  saveJobPack(jobPack: JobPack): JobPack {
    const data = getSnapshot();
    const idx = data.jobPacks.findIndex(j => j.id === jobPack.id);
    if (idx >= 0) {
      data.jobPacks[idx] = jobPack;
    } else {
      data.jobPacks.push(jobPack);
      // Bounded (audit #17): keep at most 200 generated packs per business.
      const owner = (jobPack as JobPack & { businessId?: string }).businessId;
      if (owner) {
        const mine = data.jobPacks.filter(j => (j as JobPack & { businessId?: string }).businessId === owner);
        if (mine.length > 200) {
          const drop = new Set(mine.slice(0, mine.length - 200).map(j => j.id));
          data.jobPacks = data.jobPacks.filter(j => !drop.has(j.id));
          for (const id of drop) markDirty('jobPacks', id, null);
        }
      }
    }
    markDirty('jobPacks', jobPack.id, jobPack);
    return jobPack;
  },

  // Voicemails & Transcribed Messages
  getVoicemails(): ScopedVoicemail[] {
    const data = getSnapshot();
    return (data.voicemails || []).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  saveVoicemail(vm: ScopedVoicemail): ScopedVoicemail {
    const data = getSnapshot();
    if (!data.voicemails) data.voicemails = [];
    const idx = data.voicemails.findIndex(v => v.id === vm.id);
    // Keep the owner: an update never changes or drops a record's business, and a new
    // record with none is attributed to the phone line's business.
    const businessId = (idx >= 0 ? data.voicemails[idx].businessId : undefined) || vm.businessId || defaultPhoneBusinessId();
    const record: ScopedVoicemail = businessId ? { ...vm, businessId } : vm;
    if (idx >= 0) {
      data.voicemails[idx] = record;
    } else {
      data.voicemails.unshift(record);
    }
    markDirty('voicemails', vm.id, record);
    return record;
  },

  getVoicemail(id: string): ScopedVoicemail | undefined {
    const data = getSnapshot();
    return (data.voicemails || []).find(v => v.id === id);
  },

  deleteVoicemail(id: string): boolean {
    const data = getSnapshot();
    if (!data.voicemails) return false;
    const initialLen = data.voicemails.length;
    data.voicemails = data.voicemails.filter(v => v.id !== id);
    if (data.voicemails.length < initialLen) markDirty('voicemails', id, null);
    return data.voicemails.length < initialLen;
  },

  // Phone Calls
  getCalls(): ScopedPhoneCall[] {
    const data = getSnapshot();
    return data.calls || [];
  },

  findCall(call: { id?: string }): ScopedPhoneCall | undefined {
    const data = getSnapshot();
    return (data.calls || []).find(c => (!!call.id && c.id === call.id));
  },

  saveCall(call: ScopedPhoneCall): ScopedPhoneCall {
    const data = getSnapshot();
    if (!data.calls) data.calls = [];
    const idx = data.calls.findIndex(c => c.id === call.id);
    const businessId = (idx >= 0 ? data.calls[idx].businessId : undefined) || call.businessId || defaultPhoneBusinessId();
    const record: ScopedPhoneCall = businessId ? { ...call, businessId } : call;
    if (idx >= 0) {
      // Merge: the stored record may carry fields the new write lacks.
      data.calls[idx] = { ...data.calls[idx], ...record };
    } else {
      data.calls.unshift(record);
    }
    // Persist the stored (merged) record, not just the incoming one.
    markDirty('calls', call.id, idx >= 0 ? data.calls[idx] : data.calls[0]);
    return record;
  },

  // Proactive agent messages (the Agent Inbox)
  getAgentMessages(businessId: string): AgentInboxMessage[] {
    const data = getSnapshot();
    return (data.agentMessages || [])
      .filter(m => m.businessId === businessId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  saveAgentMessage(msg: AgentInboxMessage): AgentInboxMessage {
    const data = getSnapshot();
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
    if (data.agentMessages.length > 300) {
      const dropped = data.agentMessages.slice(300);
      data.agentMessages.length = 300;
      for (const d of dropped) markDirty('agentMessages', d.id, null);
    }
    markDirty('agentMessages', msg.id, msg);
    return msg;
  },

  updateAgentMessage(businessId: string, id: string, patch: Partial<AgentInboxMessage>): AgentInboxMessage | undefined {
    const data = getSnapshot();
    if (!data.agentMessages) return undefined;
    const msg = data.agentMessages.find(m => m.businessId === businessId && m.id === id);
    if (!msg) return undefined;
    Object.assign(msg, patch);
    markDirty('agentMessages', id, msg);
    return msg;
  },

  // ---- Team (human-to-human) ----

  // Team chat messages. Capped per business so the chat can never grow
  // the database without bound — oldest messages drop off first.
  getTeamMessages(businessId: string): TeamMessage[] {
    const data = getSnapshot();
    return (data.teamMessages || [])
      .filter(m => m.businessId === businessId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  saveTeamMessage(msg: TeamMessage): TeamMessage {
    const data = getSnapshot();
    if (!data.teamMessages) data.teamMessages = [];
    data.teamMessages.push(msg);
    const MAX_PER_BUSINESS = 500;
    const forBiz = data.teamMessages.filter(m => m.businessId === msg.businessId);
    if (forBiz.length > MAX_PER_BUSINESS) {
      const keep = new Set(forBiz.slice(forBiz.length - MAX_PER_BUSINESS).map(m => m.id));
      const dropped = data.teamMessages.filter(m => m.businessId === msg.businessId && !keep.has(m.id));
      data.teamMessages = data.teamMessages.filter(m => m.businessId !== msg.businessId || keep.has(m.id));
      for (const d of dropped) markDirty('teamMessages', d.id, null);
    }
    markDirty('teamMessages', msg.id, msg);
    return msg;
  },

  // Team invites. Kept in their own store (NOT on the business record) so
  // the codes are never exposed by the plain business fetch.
  getTeamInvites(businessId: string): TeamInvite[] {
    const data = getSnapshot();
    return (data.teamInvites || [])
      .filter(i => i.businessId === businessId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getTeamInviteByCode(code: string): TeamInvite | undefined {
    const data = getSnapshot();
    return (data.teamInvites || []).find(i => i.code === code);
  },

  saveTeamInvite(invite: TeamInvite): TeamInvite {
    const data = getSnapshot();
    if (!data.teamInvites) data.teamInvites = [];
    const idx = data.teamInvites.findIndex(i => i.code === invite.code);
    if (idx >= 0) data.teamInvites[idx] = invite;
    else data.teamInvites.push(invite);
    markDirty('teamInvites', invite.code, invite);
    return invite;
  },

  // Add or refresh one team member (matched by email — the stable identity
  // across devices). Returns the business, or undefined when not found.
  addBusinessMember(businessId: string, member: BusinessMember): BusinessAccount | undefined {
    const data = getSnapshot();
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
    markDirty('businesses', businessId, biz);
    return biz;
  },

  // Remove one team member by email. Historical chat messages stay, with
  // the removed person's name on them. Returns true when someone was removed.
  removeBusinessMember(businessId: string, email: string): boolean {
    const data = getSnapshot();
    const biz = data.businesses.find(b => b.id === businessId);
    if (!biz || !biz.members) return false;
    const before = biz.members.length;
    biz.members = biz.members.filter(m => m.email.toLowerCase() !== email.toLowerCase());
    if (biz.members.length === before) return false;
    biz.updatedAt = new Date().toISOString();
    markDirty('businesses', businessId, biz);
    return true;
  }
};
