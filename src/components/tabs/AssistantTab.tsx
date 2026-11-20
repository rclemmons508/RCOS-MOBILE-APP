import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Mic,
  Upload,
  FileText,
  Paperclip,
  Trash2,
  Loader2,
  ChevronRight,
  CheckCircle2,
  Briefcase,
  UserPlus,
} from 'lucide-react';
import { GeminiChatView } from '../GeminiChatView';
import { AgentTalkConsole } from '../phone/AgentTalkConsole';
import { apiFetch, ApiError } from '../../lib/api';
import {
  detectMainAiAlerts,
  loadMainAiAlertState,
  saveMainAiAlertState,
  type MainAiAlert,
} from '../../utils/mainAiAlerts';
import {
  loadMorganAlertState,
  markMorganAlertAnswered,
  planMorganAlerts,
  saveMorganAlertState,
  type MorganAlertAction,
} from '../../utils/morganAlerts';
import {
  ACCEPTED_TYPES,
  deleteAssistantDocument,
  formatFileSize,
  listAssistantDocuments,
  uploadAssistantDocument,
  type AssistantDocument,
} from '../../lib/assistantDocuments';
import type { ActionRecord, BusinessAccount, Client, CustomerRequest, Job, PhoneCall, TabType, User } from '../../types';
import { haptic } from '../../utils/haptics';

interface AssistantTabProps {
  business: BusinessAccount;
  currentUser?: User | null;
  jobs: Job[];
  actions: ActionRecord[];
  customerRequests: CustomerRequest[];
  calls: PhoneCall[];
  onNavigateTab: (tab: TabType) => void;
  onBusinessRefresh?: () => Promise<void>;
  /** App's client-add handler (updates the Clients list + Firestore). */
  onClientAdded?: (client: Client) => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * The AI Assistant page — Morgan Vance, the owner's Executive Assistant,
 * in one prominent place instead of buried in the AI Team tab.
 *
 * Three ways to talk to her, on one screen:
 *   1. Text chat (the same chat as AI Team, with Morgan as the default).
 *   2. Live voice — the executive persona over LiveKit/Gemini realtime,
 *      the same engine as the phone calls. Earpiece by default, with an
 *      on-screen speakerphone switch (same console as the agent talk UI).
 *   3. Documents — upload a file and Morgan answers questions about it
 *      (attach it to the chat) and pulls its details into real jobs and
 *      clients. Nothing is ever invented: only details the document
 *      actually states are offered, and every record is confirmed first.
 *
 * The briefing at the top is one honest touch of proactivity: counts and
 * money computed from the same jobs, actions, requests, and calls the
 * Dashboard already loads. Rows with nothing to say are hidden; when
 * nothing needs the owner, the card says so instead of inventing work.
 */
export const AssistantTab: React.FC<AssistantTabProps> = ({
  business,
  currentUser,
  jobs,
  actions,
  customerRequests,
  calls,
  onNavigateTab,
  onBusinessRefresh,
  onClientAdded,
}) => {
  const [documents, setDocuments] = useState<AssistantDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [attachedIds, setAttachedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClientId, setConfirmClientId] = useState<string | null>(null);
  const [clientAddedId, setClientAddedId] = useState<string | null>(null);
  const [sendSignal, setSendSignal] = useState<{ text: string; nonce: number } | undefined>(undefined);
  const [incomingAlerts, setIncomingAlerts] = useState<{ alerts: MainAiAlert[]; nonce: number } | undefined>(undefined);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const businessId = business.id;

  // ---- Morgan asks in the conversation ----
  // The same five approved triggers as the Operations feed, but raised
  // here as Morgan's own question with the choice attached — so the
  // owner can answer (approve a quote, mark an invoice paid, open the
  // record) without opening the feed. Detection is reused, not
  // duplicated; Morgan's own raised/answered record decides what speaks
  // up, and a record that is still waiting and unanswered speaks up
  // exactly once more, a day later, then never again. The feed stays
  // the backup: it already carries every one of these items.
  useEffect(() => {
    const mainState = loadMainAiAlertState(businessId);
    const { alerts, jobFirstSeen } = detectMainAiAlerts({
      requests: customerRequests,
      actions,
      calls,
      jobs,
      // Deliberately NOT the inbox's fired set: a record the feed
      // already carries still needs its question here.
      alerted: new Set<string>(),
      jobFirstSeen: mainState.jobFirstSeen,
    });
    // Share first-seen stalled-job tracking with the feed; never touch
    // its fired list.
    if (JSON.stringify(jobFirstSeen) !== JSON.stringify(mainState.jobFirstSeen)) {
      saveMainAiAlertState(businessId, { ...mainState, jobFirstSeen });
    }
    if (alerts.length === 0) return;
    const morganState = loadMorganAlertState(businessId);
    const { toRaise, nextState } = planMorganAlerts(alerts, morganState);
    if (JSON.stringify(nextState) !== JSON.stringify(morganState)) {
      saveMorganAlertState(businessId, nextState);
    }
    if (toRaise.length > 0) {
      setIncomingAlerts({ alerts: toRaise, nonce: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, jobs, actions, customerRequests, calls]);

  /**
   * A tap on a Morgan alert card. Only the tap itself does anything —
   * Morgan never approves, marks paid, or navigates on her own. The
   * result reported is only what the server call actually returned.
   */
  const handleAlertAction = async (
    alert: MainAiAlert,
    action: MorganAlertAction
  ): Promise<{ ok: boolean; summary: string }> => {
    if (action === 'dismiss') {
      markMorganAlertAnswered(businessId, alert.dedupeKey);
      return { ok: true, summary: "Noted — I won't bring this up again." };
    }
    if (action === 'view') {
      markMorganAlertAnswered(businessId, alert.dedupeKey);
      onNavigateTab(alert.actionTab);
      return { ok: true, summary: 'Opening it now.' };
    }
    // Approve / mark paid only exist for server-owned action records.
    // A device-only record has no server decision to make.
    if (alert.recordId.startsWith('local-emg-')) {
      markMorganAlertAnswered(businessId, alert.dedupeKey);
      return {
        ok: false,
        summary: 'This one lives only on this device, so I can’t act on it from here — open Approvals to handle it.',
      };
    }
    if (action === 'approve') {
      try {
        const updated = await apiFetch<ActionRecord>(
          `/api/business/${businessId}/actions/${alert.recordId}/decide`,
          { method: 'POST', body: JSON.stringify({ decision: 'approved' }) }
        );
        if (updated?.status === 'approved') {
          markMorganAlertAnswered(businessId, alert.dedupeKey);
          return { ok: true, summary: 'Done — quote approved. Find it in Approvals.' };
        }
        return { ok: false, summary: 'The server did not confirm the approval, so nothing was approved.' };
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          // Already decided on another device or by a teammate: the
          // record is settled, so Morgan stops raising it.
          markMorganAlertAnswered(businessId, alert.dedupeKey);
          return { ok: false, summary: 'This was already decided on another device — the latest status is in Approvals.' };
        }
        return {
          ok: false,
          summary: `It did not go through${e instanceof Error && e.message ? `: ${e.message}` : ''}. Nothing was approved.`,
        };
      }
    }
    if (action === 'mark_paid') {
      try {
        const updated = await apiFetch<any>(
          `/api/business/${businessId}/actions/${alert.recordId}/mark-paid`,
          { method: 'POST', body: JSON.stringify({}) }
        );
        if (updated?.paymentStatus === 'paid') {
          markMorganAlertAnswered(businessId, alert.dedupeKey);
          return { ok: true, summary: 'Done — invoice marked as paid.' };
        }
        return { ok: false, summary: 'The server did not confirm the invoice as paid, so it was not changed.' };
      } catch (e) {
        return {
          ok: false,
          summary: `It did not go through${e instanceof Error && e.message ? `: ${e.message}` : ''}. The invoice was not changed.`,
        };
      }
    }
    return { ok: false, summary: 'That action is not supported here.' };
  };

  const loadDocuments = async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const docs = await listAssistantDocuments(businessId);
      setDocuments(docs);
      setAttachedIds((prev) => {
        const kept = new Set([...prev].filter((id) => docs.some((d) => d.id === id)));
        return kept;
      });
    } catch (e: any) {
      setDocsError(e?.message || 'Could not load your documents.');
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // ---- Briefing: same definitions as the Dashboard / Morning Briefing ----
  const quotesWaiting = actions.filter((a) => a.status === 'awaiting_approval').length;
  const unpaidInvoices = actions.filter(
    (a) => a.status === 'approved' && a.result?.invoiceDetails && a.paymentStatus !== 'paid'
  );
  const moneyOwed = unpaidInvoices.reduce(
    (sum, a) => sum + (a.result?.invoiceDetails?.totalAmount ?? a.dollarAmount ?? 0),
    0
  );
  const todaysJobs = jobs.filter(
    (j) =>
      j.scheduledTime.includes('Today') ||
      j.status === 'dispatched' ||
      j.status === 'in_progress' ||
      j.status === 'urgent'
  );
  const pendingRequests = customerRequests.filter((r) => r.status === 'pending').length;
  const missedCalls = calls.filter((c) => c.status === 'missed').length;

  const briefingRows: { label: string; detail: string; tab: TabType }[] = [];
  if (quotesWaiting > 0) {
    briefingRows.push({
      label: `${quotesWaiting} quote${quotesWaiting === 1 ? '' : 's'} waiting for your sign-off`,
      detail: 'Review them in Approvals',
      tab: 'approvals',
    });
  }
  if (moneyOwed > 0) {
    briefingRows.push({
      label: `${money(moneyOwed)} owed on ${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length === 1 ? '' : 's'}`,
      detail: 'See them in Approvals',
      tab: 'approvals',
    });
  }
  if (todaysJobs.length > 0) {
    briefingRows.push({
      label: `${todaysJobs.length} job${todaysJobs.length === 1 ? '' : 's'} on today`,
      detail: todaysJobs.slice(0, 2).map((j) => j.title).join(' · ') || 'See the schedule',
      tab: 'jobs',
    });
  }
  if (pendingRequests > 0) {
    briefingRows.push({
      label: `${pendingRequests} new request${pendingRequests === 1 ? '' : 's'} waiting`,
      detail: 'See them in Operations',
      tab: 'requests',
    });
  }
  if (missedCalls > 0) {
    briefingRows.push({
      label: `${missedCalls} missed call${missedCalls === 1 ? '' : 's'}`,
      detail: 'See them on the Calls screen',
      tab: 'phone',
    });
  }

  // ---- Documents ----
  const handleFilePicked = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_FILE_BYTES) {
      setUploadError('That file is too big — 10 MB is the limit.');
      return;
    }
    setUploading(true);
    try {
      const saved = await uploadAssistantDocument(businessId, file);
      setDocuments((prev) => [saved, ...prev]);
    } catch (e: any) {
      setUploadError(e?.message || 'Could not save that document. Try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleAttach = (id: string) => {
    setAttachedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deleteAssistantDocument(businessId, id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setAttachedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e: any) {
      setDocsError(e?.message || 'Could not delete that document.');
    } finally {
      setDeletingId(null);
    }
  };

  /** "Create a job from this document": the details go through the chat's
   * confirmation card — editable, and nothing is created until Confirm. */
  const handleCreateJobFromDoc = (doc: AssistantDocument) => {
    const ex = doc.extracted;
    const client = ex?.companyName || ex?.contactName || '';
    const scope = ex?.notes || doc.name.replace(/\.[^.]+$/, '');
    const text = client
      ? `Create a job for ${client} about ${scope}`
      : `Create a job about ${scope}`;
    // Morgan should be able to read the document the job comes from.
    setAttachedIds((prev) => new Set(prev).add(doc.id));
    setSendSignal({ text, nonce: Date.now() });
  };

  /** "Add client from this document": inline confirm, then the real client
   * record via the app's own handler (Firestore + Clients list). */
  const handleAddClientFromDoc = (doc: AssistantDocument) => {
    if (confirmClientId !== doc.id) {
      setConfirmClientId(doc.id);
      return;
    }
    setConfirmClientId(null);
    const ex = doc.extracted;
    if (!ex || !onClientAdded) return;
    const company = ex.companyName || ex.contactName || doc.name.replace(/\.[^.]+$/, '');
    const client: Client = {
      id: `client_${Date.now()}`,
      name: ex.contactName || company,
      company,
      phone: ex.phone || '',
      email: ex.email || '',
      status: 'lead',
      healthScore: 50,
      totalSpent: 0,
      activeJobsCount: 0,
      lastContactDate: new Date().toISOString(),
      aiSummary: ex.notes || `Added from ${doc.name}.`,
      tags: [],
    };
    onClientAdded(client);
    setClientAddedId(doc.id);
  };

  const attachedDocuments = documents
    .filter((d) => attachedIds.has(d.id))
    .map((d) => ({ id: d.id, name: d.name }));

  return (
    <div className="space-y-3.5 pb-6 px-3 sm:px-4 pt-2 max-w-full overflow-x-hidden text-left">
      {/* Header — who she is, and the Talk button */}
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl border border-[#22ec72]/40 bg-[#22ec72]/10 flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6 text-[#22ec72]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-white text-base truncate">Morgan Vance</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-900 text-zinc-200 border border-zinc-700 shrink-0">
                Executive Assistant
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate">
              Your assistant for {business.name || 'your business'} — chat, documents, or voice.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.medium();
            setVoiceOpen(true);
          }}
          className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#22ec72] hover:bg-[#22ec72] text-black font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-[#22ec72]/20"
        >
          <Mic className="w-4 h-4" />
          Talk to Morgan
        </button>
        <p className="text-xs text-zinc-500 text-center">
          Tap to talk — she speaks back and hears you in real time. Audio starts on the earpiece.
        </p>
      </div>

      {/* Briefing — what needs you, from real records only */}
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-2">
        <h2 className="text-sm font-bold text-white">What needs you</h2>
        {briefingRows.length === 0 ? (
          <p className="text-xs text-zinc-400">Nothing needs your attention right now.</p>
        ) : (
          briefingRows.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() => {
                haptic.light();
                onNavigateTab(row.tab);
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-[#22ec72]/40 active:scale-[0.99] transition text-left cursor-pointer min-h-[48px]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">{row.label}</span>
                <span className="block text-xs text-zinc-400 truncate">{row.detail}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
            </button>
          ))
        )}
      </div>

      {/* Documents */}
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white">Documents</h2>
          <span className="text-xs text-zinc-500">PDF, Word, text, or CSV</span>
        </div>
        <p className="text-xs text-zinc-400">
          Upload a file and Morgan can answer questions about it — and pull its details into jobs and clients.
          Only details the document actually states are used; anything missing stays blank.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => void handleFilePicked(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            haptic.light();
            fileInputRef.current?.click();
          }}
          className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-bold text-white flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin text-[#22ec72]" /> : <Upload className="w-4 h-4 text-[#22ec72]" />}
          {uploading ? 'Reading the document…' : 'Upload a document'}
        </button>
        {uploadError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{uploadError}</p>
        )}
        {docsLoading ? (
          <p className="text-xs text-zinc-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading documents…
          </p>
        ) : docsError ? (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{docsError}</p>
        ) : documents.length === 0 ? (
          <p className="text-xs text-zinc-400">
            No documents yet — upload a quote, an invoice, a price list, or a client file and ask Morgan about it.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => {
              const ex = doc.extracted;
              const attached = attachedIds.has(doc.id);
              return (
                <div key={doc.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 space-y-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="p-2 rounded-xl bg-black border border-zinc-800 shrink-0">
                      <FileText className="w-4 h-4 text-[#22ec72]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate">{doc.name}</div>
                      <div className="text-xs text-zinc-500">
                        {formatFileSize(doc.sizeBytes)}
                        {doc.textChars > 0 ? ` · ${doc.textChars.toLocaleString('en-US')} characters read` : ' · no readable text'}
                        {doc.textTruncated ? ' (trimmed)' : ''}
                      </div>
                      {ex && (
                        <div className="text-xs text-zinc-300 mt-1 space-y-0.5">
                          {ex.companyName && <div>Company: <span className="text-white font-bold">{ex.companyName}</span></div>}
                          {ex.contactName && <div>Contact: <span className="text-white font-bold">{ex.contactName}</span></div>}
                          {ex.phone && <div>Phone: {ex.phone}</div>}
                          {ex.email && <div>Email: {ex.email}</div>}
                          {ex.notes && <div className="text-zinc-400">Notes: {ex.notes}</div>}
                        </div>
                      )}
                      {doc.textChars === 0 && !ex && (
                        <div className="text-xs text-zinc-500 mt-1">
                          Nothing readable was found in this file — Morgan cannot answer questions about it.
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      title={confirmDeleteId === doc.id ? 'Tap again to delete' : 'Delete document'}
                      className={`min-h-[48px] p-2 rounded-xl border transition cursor-pointer shrink-0 disabled:opacity-40 ${
                        confirmDeleteId === doc.id
                          ? 'bg-red-500 text-white border-red-500'
                          : 'bg-black text-zinc-400 border-zinc-800 hover:text-white'
                      }`}
                    >
                      {deletingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleAttach(doc.id)}
                      disabled={doc.textChars === 0}
                      title={doc.textChars === 0 ? 'No readable text to attach' : attached ? 'Remove from the chat' : 'Let Morgan read this in the chat'}
                      className={`min-h-[48px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 ${
                        attached
                          ? 'bg-[#22ec72] text-black border-[#22ec72]'
                          : 'bg-black text-zinc-200 border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      {attached ? 'Attached to chat' : 'Attach to chat'}
                    </button>
                    {ex && (ex.companyName || ex.contactName) && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCreateJobFromDoc(doc)}
                          className="min-h-[48px] px-3 py-1.5 rounded-xl bg-black text-zinc-200 border border-zinc-800 hover:border-[#22ec72]/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Briefcase className="w-3.5 h-3.5 text-[#22ec72]" />
                          Create job
                        </button>
                        {onClientAdded && (
                          <button
                            type="button"
                            onClick={() => handleAddClientFromDoc(doc)}
                            className={`min-h-[48px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                              confirmClientId === doc.id
                                ? 'bg-[#22ec72] text-black border-[#22ec72]'
                                : 'bg-black text-zinc-200 border-zinc-800 hover:border-[#22ec72]/40'
                            }`}
                          >
                            <UserPlus className="w-3.5 h-3.5 text-[#22ec72]" />
                            {confirmClientId === doc.id ? 'Tap again to add client' : 'Add client'}
                          </button>
                        )}
                      </>
                    )}
                    {clientAddedId === doc.id && (
                      <span className="text-xs font-bold text-[#22ec72] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Client added — find them under Customers.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat */}
      <GeminiChatView
        business={business}
        senderEmail={currentUser?.email || ''}
        senderName={currentUser?.fullName || ''}
        onBusinessRefresh={onBusinessRefresh}
        attachedDocuments={attachedDocuments}
        sendSignal={sendSignal}
        incomingAlerts={incomingAlerts}
        onAlertAction={handleAlertAction}
      />

      {/* Live voice — executive persona, same engine as the phone calls */}
      {voiceOpen && (
        <AgentTalkConsole
          persona="executive"
          agentName="Morgan Vance"
          agentRole="Executive Assistant"
          businessId={business.id}
          onClose={() => setVoiceOpen(false)}
        />
      )}
    </div>
  );
};
