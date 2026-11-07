import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  limit,
  limitToLast,
  runTransaction
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  BusinessAccount, 
  Job, 
  Client, 
  CustomerRequest, 
  ActionRecord, 
  ChatMessage 
} from '../types';

// Bug 5 (React #310) defense: Firestore docs are raw-cast with `as X` and a
// doc may hold an unexpected shape (e.g. a Firestore Timestamp object where
// the UI expects a string, or an object-typed scalar). Rendering such a
// value directly crashes React ("Objects are not valid as a React child").
// Normalize on read: Firestore Timestamps / Dates become ISO strings,
// arrays and plain objects are normalized recursively, and primitives pass
// through unchanged so numbers, booleans, sorting, and math keep working.
// Legit nested objects (e.g. activeEmployees, approvalDecision) keep their
// structure; render sites must still never render an object as a child.
const isTimestampLike = (v: unknown): v is { toDate: () => Date } =>
  typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function';

const normalizeDocValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (isTimestampLike(value)) {
    try {
      return value.toDate().toISOString();
    } catch {
      return String(value);
    }
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeDocValue);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeDocValue(v);
    }
    return out;
  }
  return value;
};

const normalizeDoc = <T,>(data: Record<string, unknown>): T => normalizeDocValue(data) as T;

/**
 * Denormalized `memberEmails` map the Firestore rules check membership
 * against ({ "<lowercase email>": "owner" | "member" }): rules cannot
 * search the `members` list of maps. Always derived from the roster.
 */
export function deriveMemberEmails(
  members: BusinessAccount['members'] | undefined
): Record<string, 'owner' | 'member'> {
  const memberEmails: Record<string, 'owner' | 'member'> = {};
  for (const m of members || []) {
    const email = String(m?.email || '').toLowerCase().trim();
    if (!email) continue;
    // An email listed twice keeps its strongest role.
    if (memberEmails[email] === 'owner') continue;
    memberEmails[email] = m?.role === 'owner' ? 'owner' : 'member';
  }
  return memberEmails;
}

/** Deep-copy plain objects/arrays without `undefined` values (Firestore rejects them). */
function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined).map(stripUndefined);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out;
  }
  return value;
}

/** Fields a field-level business update may never touch from the client. */
const PROTECTED_BUSINESS_FIELDS = new Set(['id', 'ownerId', 'createdAt', 'memberEmails']);

export const firestoreService = {
  // ==================== BUSINESS ====================
  async getBusiness(businessId: string): Promise<BusinessAccount | null> {
    const docRef = doc(db, 'businesses', businessId);
    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return normalizeDoc<BusinessAccount>(snap.data());
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `businesses/${businessId}`);
    }
  },

  async saveBusiness(business: BusinessAccount): Promise<void> {
    const docRef = doc(db, 'businesses', business.id);
    const ownerId = auth.currentUser?.uid || business.ownerId || 'unassigned_owner';
    // Stage 2 audit (C2): the Firestore rules (firestore.rules → isMemberData /
    // isOwnerData) check member access against the denormalized
    // `memberEmails` map { "<lowercase email>": "owner" | "member" } — rules
    // cannot search the `members` list of maps. Derive it from the roster on
    // every save so the mirror never goes stale while the roster changes.
    const memberEmails = deriveMemberEmails(business.members);
    // The signed-in Firebase user writing as the doc's owner (ownerId is
    // their UID) is always listed as 'owner', so a business restored with
    // an empty roster still lets its owner in by email on other devices.
    const myEmail = (auth.currentUser?.email || '').toLowerCase().trim();
    if (myEmail && auth.currentUser?.uid === ownerId && !memberEmails[myEmail]) {
      memberEmails[myEmail] = 'owner';
    }
    // Strip any stale/foreign memberEmails the record carried; the map is
    // only ever the roster-derived one above.
    const { memberEmails: _staleMemberEmails, ...rest } = business as BusinessAccount & {
      memberEmails?: unknown;
    };
    const payload = {
      ...rest,
      memberEmails,
      ownerId,
      updatedAt: new Date().toISOString()
    };
    // Firestore rejects `undefined` anywhere in a write; drop those keys.
    const clean = stripUndefined(payload) as Record<string, unknown>;
    try {
      // mergeFields (not merge:true): each top-level field written here
      // REPLACES the stored one. merge:true deep-merges maps, which would
      // keep a removed member's email in memberEmails (and their access).
      // Fields this record doesn't carry are left untouched.
      await setDoc(docRef, clean, { mergeFields: Object.keys(clean) });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${business.id}`);
    }
  },

  /**
   * Field-level update of an existing business doc (updateDoc): only the
   * given fields change, so concurrent edits by teammates to OTHER fields
   * are never overwritten by a stale full-record save. When the roster
   * changes, its memberEmails mirror is updated in the same write.
   */
  async updateBusinessFields(businessId: string, patch: Partial<BusinessAccount>): Promise<void> {
    if (!businessId) return;
    const docRef = doc(db, 'businesses', businessId);
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || PROTECTED_BUSINESS_FIELDS.has(k)) continue;
      payload[k] = v;
    }
    if (Array.isArray(patch.members)) {
      payload.memberEmails = deriveMemberEmails(patch.members);
    }
    payload.updatedAt = new Date().toISOString();
    try {
      await updateDoc(docRef, stripUndefined(payload) as Record<string, unknown>);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`);
    }
  },

  listenToBusiness(businessId: string, callback: (biz: BusinessAccount | null) => void): () => void {
    const docRef = doc(db, 'businesses', businessId);
    return onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          callback(null);
        } else {
          callback(normalizeDoc<BusinessAccount>(snap.data()));
        }
      },
      (err) => {
        console.warn(`[Firestore] Business listener error on ${businessId}:`, err);
      }
    );
  },

  // ==================== JOBS ====================
  // P2 (Stage 2 audit): the jobs listener previously loaded the whole
  // collection with no cap. limit(500) bounds it — far above pilot scale,
  // so it does not change behavior today, but it stops unbounded growth
  // from loading the entire job history. No orderBy is added on purpose:
  // Job has no timestamp field (only scheduledTime, a display string),
  // so ordering by a missing/unreliable field would silently drop jobs.
  listenToJobs(businessId: string, callback: (jobs: Job[]) => void): () => void {
    const colRef = collection(db, 'businesses', businessId, 'jobs');
    return onSnapshot(
      query(colRef, limit(500)),
      (snap) => {
        const list: Job[] = [];
        snap.forEach((d) => list.push(normalizeDoc<Job>(d.data())));
        callback(list);
      },
      (err) => {
        console.warn(`[Firestore] Jobs listener error on ${businessId}:`, err);
      }
    );
  },

  async saveJob(businessId: string, job: Job): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'jobs', job.id);
    try {
      await setDoc(docRef, { ...job, businessId }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${businessId}/jobs/${job.id}`);
    }
  },

  async deleteJob(businessId: string, jobId: string): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'jobs', jobId);
    try {
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `businesses/${businessId}/jobs/${jobId}`);
    }
  },

  // ==================== CLIENTS / CUSTOMERS ====================
  listenToClients(businessId: string, callback: (clients: Client[]) => void): () => void {
    const colRef = collection(db, 'businesses', businessId, 'customers');
    return onSnapshot(
      colRef,
      (snap) => {
        const list: Client[] = [];
        snap.forEach((d) => list.push(normalizeDoc<Client>(d.data())));
        callback(list);
      },
      (err) => {
        console.warn(`[Firestore] Clients listener error on ${businessId}:`, err);
      }
    );
  },

  async saveClient(businessId: string, client: Client): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'customers', client.id);
    try {
      await setDoc(docRef, { ...client, businessId }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${businessId}/customers/${client.id}`);
    }
  },

  async deleteClient(businessId: string, clientId: string): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'customers', clientId);
    try {
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `businesses/${businessId}/customers/${clientId}`);
    }
  },

  // ==================== CUSTOMER REQUESTS (INTAKE) ====================
  listenToRequests(businessId: string, callback: (requests: CustomerRequest[]) => void): () => void {
    const colRef = collection(db, 'businesses', businessId, 'requests');
    return onSnapshot(
      colRef,
      (snap) => {
        const list: CustomerRequest[] = [];
        snap.forEach((d) => list.push(normalizeDoc<CustomerRequest>(d.data())));
        callback(list);
      },
      (err) => {
        console.warn(`[Firestore] Requests listener error on ${businessId}:`, err);
      }
    );
  },

  async saveRequest(businessId: string, req: CustomerRequest): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'requests', req.id);
    try {
      await setDoc(docRef, { ...req, businessId }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${businessId}/requests/${req.id}`);
    }
  },

  // ==================== ACTIONS & HITL APPROVALS ====================
  listenToActions(businessId: string, callback: (actions: ActionRecord[]) => void): () => void {
    const colRef = collection(db, 'businesses', businessId, 'actions');
    return onSnapshot(
      colRef,
      (snap) => {
        const list: ActionRecord[] = [];
        snap.forEach((d) => list.push(normalizeDoc<ActionRecord>(d.data())));
        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(list);
      },
      (err) => {
        console.warn(`[Firestore] Actions listener error on ${businessId}:`, err);
      }
    );
  },

  async saveAction(businessId: string, action: ActionRecord): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'actions', action.id);
    try {
      await setDoc(docRef, { ...action, businessId }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${businessId}/actions/${action.id}`);
    }
  },

  /**
   * Idempotent atomic approval / rejection of an action record
   */
  async decideActionApproval(
    businessId: string,
    actionId: string,
    decision: 'approved' | 'rejected',
    reviewerNote: string = '',
    userId?: string
  ): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'actions', actionId);
    const auditDocRef = doc(db, 'businesses', businessId, 'auditLogs', `audit_${Date.now()}_${actionId}`);

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists()) {
          throw new Error('Action record not found');
        }

        const data = snap.data() as ActionRecord;
        if (data.status !== 'awaiting_approval' && data.status !== 'queued') {
          // Already decided - idempotent return
          return;
        }

        const now = new Date().toISOString();
        const updatedStatus = decision === 'approved' ? 'approved' : 'rejected';

        tx.update(docRef, {
          status: updatedStatus,
          reviewedBy: userId || auth.currentUser?.email || 'Lead Operator',
          reviewedAt: now,
          reviewerNote,
          approvalDecision: {
            decision,
            decidedAt: now,
            decidedBy: userId || auth.currentUser?.email || 'Lead Operator',
            reviewerNote
          },
          updatedAt: now
        });

        // Write immutable audit log
        tx.set(auditDocRef, {
          id: auditDocRef.id,
          businessId,
          actionId,
          userId: userId || auth.currentUser?.email || 'Lead Operator',
          actionType: data.actionType || 'operational_action',
          decision,
          details: {
            title: data.title,
            dollarAmount: data.dollarAmount || 0,
            reviewerNote
          },
          timestamp: now
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}/actions/${actionId}`);
    }
  },

  // ==================== DELETE ALL BUSINESS DATA ====================
  /**
   * Permanently delete a business document and every document in its
   * subcollections (jobs, customers, requests, actions, chat messages,
   * audit logs). Failures throw (via handleFirestoreError) so the caller
   * can report what could not be removed — nothing is silently faked.
   */
  async deleteBusinessData(businessId: string): Promise<void> {
    const subcollections = ['jobs', 'customers', 'requests', 'actions', 'chatMessages', 'auditLogs'];
    for (const sub of subcollections) {
      try {
        const colRef = collection(db, 'businesses', businessId, sub);
        const snap = await getDocs(colRef);
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `businesses/${businessId}/${sub}`);
      }
    }
    try {
      await deleteDoc(doc(db, 'businesses', businessId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `businesses/${businessId}`);
    }
  },

  // ==================== CHAT MESSAGES ====================
  // P2 (Stage 2 audit): the chat listener previously loaded the whole
  // history with no cap. limitToLast(100) keeps the most recent 100
  // messages live (the UI only ever shows the recent thread); older
  // history is out of scope for the live listener.
  listenToChatMessages(businessId: string, callback: (msgs: ChatMessage[]) => void): () => void {
    const colRef = collection(db, 'businesses', businessId, 'chatMessages');
    const q = query(colRef, orderBy('timestamp', 'asc'), limitToLast(100));
    return onSnapshot(
      q,
      (snap) => {
        const list: ChatMessage[] = [];
        snap.forEach((d) => list.push(normalizeDoc<ChatMessage>(d.data())));
        callback(list);
      },
      (err) => {
        console.warn(`[Firestore] Chat listener error on ${businessId}:`, err);
      }
    );
  },

  async sendChatMessage(businessId: string, message: ChatMessage): Promise<void> {
    const docRef = doc(db, 'businesses', businessId, 'chatMessages', message.id);
    try {
      await setDoc(docRef, { ...message, businessId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${businessId}/chatMessages/${message.id}`);
    }
  }
};
