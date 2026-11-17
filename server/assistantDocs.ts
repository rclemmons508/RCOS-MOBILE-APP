/**
 * Assistant documents — files the owner uploads to the AI Assistant page.
 *
 * The assistant answers questions about an uploaded document AND pulls
 * details from it into jobs/clients. Two things happen at upload:
 *   1. The text is extracted (PDF / DOCX / plain text / CSV, via the same
 *      parser onboarding uses) and stored, so /api/chat can read it.
 *   2. The client details are extracted (company, contact, phone, email,
 *      notes — the same honest extractor the Add Client form uses), so
 *      the page can offer "Create job" / "Add client" from the document.
 *
 * Where documents live: Cloud Firestore, collection `assistantDocuments`
 * (one document per file). Firestore survives Railway redeploys; the
 * server file store does not, so documents must never live there. The
 * Admin SDK bypasses Firestore rules; clients can never reach this
 * collection directly — firestore.rules denies it explicitly, and the
 * app only uploads/lists/deletes through the authenticated
 * /api/assistant/documents endpoints.
 *
 * Honesty rules (same as onboarding): only fields the document actually
 * states come back; anything missing stays empty and is reported as
 * missing, never invented. A file with no readable text AND no
 * extractable details is refused at upload instead of stored as an
 * empty document the assistant would pretend to have read.
 */

import admin from 'firebase-admin';
import crypto from 'node:crypto';
import {
  analyzeClientDocument,
  extractDocumentText,
  type AnalyzeClientResult,
} from './onboarding-docs';

const ASSISTANT_DOCS_COLLECTION = 'assistantDocuments';

/** Stored text per document — enough for real Q&A, capped so one huge file cannot bloat the prompt. */
const MAX_TEXT_CHARS = 30_000;
/** Upload size: ~10 MB file (base64 is ~4/3 of the file). */
const MAX_UPLOAD_BASE64_CHARS = 14_000_000;
/** Documents per business — the list stays usable and Firestore stays small. */
const MAX_DOCS_PER_BUSINESS = 25;

export interface AssistantDocumentExtracted {
  companyName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  /** Which fields the document actually stated. */
  found: string[];
  source: 'llm' | 'fallback';
}

export interface AssistantDocumentRecord {
  id: string;
  businessId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** Characters of extracted text stored (0 when nothing readable was found). */
  textChars: number;
  textTruncated: boolean;
  extracted?: AssistantDocumentExtracted;
  uploadedBy: string;
  uploadedAt: string;
  /** Full extracted text — stored, but never sent to the list endpoint. */
  text?: string;
}

/** The Firestore client when the Admin SDK is initialized, else null. */
function getAssistantDb(): admin.firestore.Firestore | null {
  try {
    return admin.apps.length > 0 ? admin.firestore() : null;
  } catch {
    return null;
  }
}

function toExtracted(result: AnalyzeClientResult | null): AssistantDocumentExtracted | undefined {
  if (!result || !Array.isArray(result.found) || result.found.length === 0) return undefined;
  return {
    ...(result.companyName ? { companyName: result.companyName } : {}),
    ...(result.contactName ? { contactName: result.contactName } : {}),
    ...(result.phone ? { phone: result.phone } : {}),
    ...(result.email ? { email: result.email } : {}),
    ...(result.notes ? { notes: result.notes } : {}),
    found: result.found,
    source: result.source,
  };
}

function stripText(record: AssistantDocumentRecord): AssistantDocumentRecord {
  const { text: _text, ...rest } = record;
  return rest;
}

function recordFromDoc(doc: admin.firestore.DocumentSnapshot): AssistantDocumentRecord | null {
  const data = doc.data();
  if (!data || typeof data !== 'object') return null;
  return {
    id: doc.id,
    businessId: typeof data.businessId === 'string' ? data.businessId : '',
    name: typeof data.name === 'string' ? data.name : 'Document',
    mimeType: typeof data.mimeType === 'string' ? data.mimeType : '',
    sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : 0,
    textChars: typeof data.textChars === 'number' ? data.textChars : 0,
    textTruncated: data.textTruncated === true,
    ...(data.extracted && typeof data.extracted === 'object' ? { extracted: data.extracted as AssistantDocumentExtracted } : {}),
    uploadedBy: typeof data.uploadedBy === 'string' ? data.uploadedBy : '',
    uploadedAt: typeof data.uploadedAt === 'string' ? data.uploadedAt : '',
    ...(typeof data.text === 'string' ? { text: data.text } : {}),
  };
}

/**
 * Extract + analyze + store one uploaded file. Throws with a plain
 * message when the file cannot be read at all, is too big, or the
 * business already has the maximum number of documents.
 */
export async function processAssistantUpload(input: {
  businessId: string;
  uploadedBy: string;
  name: string;
  mimeType: string;
  fileBase64: string;
}): Promise<AssistantDocumentRecord> {
  const store = getAssistantDb();
  if (!store) throw new Error('Document storage is not configured on the server.');
  if (typeof input.fileBase64 !== 'string' || !input.fileBase64) {
    throw new Error('No file was uploaded.');
  }
  if (input.fileBase64.length > MAX_UPLOAD_BASE64_CHARS) {
    throw new Error('That file is too big — 10 MB is the limit.');
  }
  const name = (input.name || 'Document').slice(0, 200);
  const sizeBytes = Math.floor((input.fileBase64.length * 3) / 4);

  const existing = await store
    .collection(ASSISTANT_DOCS_COLLECTION)
    .where('businessId', '==', input.businessId)
    .get();
  if (existing.size >= MAX_DOCS_PER_BUSINESS) {
    throw new Error(`You already have ${MAX_DOCS_PER_BUSINESS} documents saved. Delete one before adding another.`);
  }

  const text = await extractDocumentText({
    fileText: '',
    fileName: name,
    fileType: input.mimeType,
    fileBase64: input.fileBase64,
  });
  // Client details: best-effort. A failed analysis never blocks the
  // upload — the document is still stored with its text, and the page
  // simply shows no extracted details for it.
  let extracted: AssistantDocumentExtracted | undefined;
  try {
    const result = await analyzeClientDocument({
      fileText: text,
      fileName: name,
      fileType: input.mimeType,
      fileBase64: input.fileBase64,
    });
    extracted = toExtracted(result);
  } catch (err) {
    console.warn('[assistant-docs] detail extraction failed, storing text only:', (err as Error)?.message || err);
  }

  if (!text.trim() && !extracted) {
    throw new Error('No readable text or details could be found in that file — it may be a scan or an unsupported format. Try a PDF, Word, text, or CSV file.');
  }

  const storedText = text.slice(0, MAX_TEXT_CHARS);
  const record: AssistantDocumentRecord = {
    id: `adoc_${crypto.randomUUID()}`,
    businessId: input.businessId,
    name,
    mimeType: input.mimeType || '',
    sizeBytes,
    textChars: storedText.length,
    textTruncated: text.length > MAX_TEXT_CHARS,
    ...(extracted ? { extracted } : {}),
    uploadedBy: input.uploadedBy || '',
    uploadedAt: new Date().toISOString(),
    text: storedText,
  };
  await store.collection(ASSISTANT_DOCS_COLLECTION).doc(record.id).set(record);
  return stripText(record);
}

/** This business's documents, newest first. Text is never included. */
export async function listAssistantDocuments(businessId: string): Promise<AssistantDocumentRecord[]> {
  const store = getAssistantDb();
  if (!store) return [];
  try {
    const snap = await store
      .collection(ASSISTANT_DOCS_COLLECTION)
      .where('businessId', '==', businessId)
      .orderBy('uploadedAt', 'desc')
      .get();
    const out: AssistantDocumentRecord[] = [];
    for (const doc of snap.docs) {
      const record = recordFromDoc(doc);
      if (record && record.businessId === businessId) out.push(stripText(record));
    }
    return out;
  } catch (err) {
    console.warn('[assistant-docs] list failed:', (err as Error)?.message || err);
    return [];
  }
}

/** Stored text for the named documents — only documents owned by this business. Used by /api/chat. */
export async function getAssistantDocumentTexts(
  businessId: string,
  ids: string[],
): Promise<{ id: string; name: string; text: string }[]> {
  const store = getAssistantDb();
  if (!store || ids.length === 0) return [];
  const out: { id: string; name: string; text: string }[] = [];
  for (const id of ids.slice(0, 5)) {
    if (typeof id !== 'string' || !id) continue;
    try {
      const doc = await store.collection(ASSISTANT_DOCS_COLLECTION).doc(id).get();
      const record = recordFromDoc(doc);
      if (record && record.businessId === businessId && record.text) {
        out.push({ id: record.id, name: record.name, text: record.text });
      }
    } catch {
      // A missing or unreadable document is skipped — chat still works.
    }
  }
  return out;
}

/** Delete one document. False when it was not there or not this business's. */
export async function deleteAssistantDocument(businessId: string, id: string): Promise<boolean> {
  const store = getAssistantDb();
  if (!store || !id) return false;
  try {
    const ref = store.collection(ASSISTANT_DOCS_COLLECTION).doc(id);
    const doc = await ref.get();
    const record = recordFromDoc(doc);
    if (!record || record.businessId !== businessId) return false;
    await ref.delete();
    return true;
  } catch (err) {
    console.warn('[assistant-docs] delete failed:', (err as Error)?.message || err);
    return false;
  }
}
