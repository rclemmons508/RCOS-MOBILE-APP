import { apiFetch } from './api';
import { withBusinessId } from './businessScope';

/** One file the owner uploaded to the Assistant page (text is never sent to the list). */
export interface AssistantDocument {
  id: string;
  businessId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  textChars: number;
  textTruncated: boolean;
  extracted?: {
    companyName?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    notes?: string;
    found: string[];
    source: 'llm' | 'fallback';
  };
  uploadedBy: string;
  uploadedAt: string;
}

const ACCEPTED_TYPES = '.pdf,.docx,.txt,.csv';

/** This business's assistant documents, newest first. */
export async function listAssistantDocuments(businessId: string): Promise<AssistantDocument[]> {
  const data = await apiFetch<AssistantDocument[]>(withBusinessId('/api/assistant/documents', businessId));
  return Array.isArray(data) ? data : [];
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload one document. The server extracts its text and the client
 * details in it — that can take up to ~40s, so the call gets the same
 * 60s the chat call gets instead of the 15s default.
 */
export async function uploadAssistantDocument(businessId: string, file: File): Promise<AssistantDocument> {
  const fileBase64 = await readFileAsBase64(file);
  return apiFetch<AssistantDocument>(withBusinessId('/api/assistant/documents', businessId), {
    method: 'POST',
    timeoutMs: 60000,
    body: JSON.stringify({
      businessId,
      name: file.name,
      mimeType: file.type || '',
      fileBase64,
    }),
  });
}

export async function deleteAssistantDocument(businessId: string, id: string): Promise<void> {
  await apiFetch(withBusinessId(`/api/assistant/documents/${encodeURIComponent(id)}`, businessId), {
    method: 'DELETE',
  });
}

/** File size as "12 KB" / "1.2 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { ACCEPTED_TYPES };
