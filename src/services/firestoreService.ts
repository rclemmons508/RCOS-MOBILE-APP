import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
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

export const firestoreService = {
  // ==================== BUSINESS ====================
  async getBusiness(businessId: string): Promise<BusinessAccount | null> {
    const docRef = doc(db, 'businesses', businessId);
    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return snap.data() as BusinessAccount;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `businesses/${businessId}`);
    }
  },

  async saveBusiness(business: BusinessAccount): Promise<void> {
    const docRef = doc(db, 'businesses', business.id);
    const ownerId = auth.currentUser?.uid || business.ownerId || 'unassigned_owner';
    const payload = {
      ...business,
      ownerId,
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(docRef, payload, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${business.id}`);
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
          callback(snap.data() as BusinessAccount);
        }
      },
      (err) => {
        console.warn(`[Firestore] Business listener error on ${businessId}:`, err);
      }
    );
  },

  // ==================== JOBS ====================
  listenToJobs(businessId: string, callback: (jobs: Job[]) => void): () => void {
    const colRef = collection(db, 'businesses', businessId, 'jobs');
    return onSnapshot(
      colRef,
      (snap) => {
        const list: Job[] = [];
        snap.forEach((d) => list.push(d.data() as Job));
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
        snap.forEach((d) => list.push(d.data() as Client));
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
        snap.forEach((d) => list.push(d.data() as CustomerRequest));
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
        snap.forEach((d) => list.push(d.data() as ActionRecord));
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

  // ==================== CHAT MESSAGES ====================
  listenToChatMessages(businessId: string, callback: (msgs: ChatMessage[]) => void): () => void {
    const colRef = collection(db, 'businesses', businessId, 'chatMessages');
    const q = query(colRef, orderBy('timestamp', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const list: ChatMessage[] = [];
        snap.forEach((d) => list.push(d.data() as ChatMessage));
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
