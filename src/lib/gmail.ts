import { auth, googleProvider, GMAIL_SCOPES } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  timestamp: number;
  snippet: string;
  labelIds: string[];
  isUnread: boolean;
  isStarred: boolean;
}

export interface GmailMessageDetail extends GmailMessageSummary {
  cc?: string;
  bcc?: string;
  bodyHtml: string;
  bodyText: string;
}

export interface SendEmailParams {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  threadId?: string;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messagesUnread?: number;
  messagesTotal?: number;
}

// In-Memory Token Cache (MANDATORY: Never stored in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let tokenListeners: ((token: string | null) => void)[] = [];

export const getCachedAccessToken = (): string | null => cachedAccessToken;

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  tokenListeners.forEach((listener) => listener(token));
};

export const onTokenChange = (listener: (token: string | null) => void) => {
  tokenListeners.push(listener);
  return () => {
    tokenListeners = tokenListeners.filter((l) => l !== listener);
  };
};

// Clear token on sign out
onAuthStateChanged(auth, (user) => {
  if (!user) {
    setCachedAccessToken(null);
  }
});

/**
 * Trigger Google Sign-in specifically for Gmail OAuth token
 */
export async function authenticateGmail(): Promise<{ user: User; accessToken: string }> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;

  if (!token) {
    throw new Error('No access token returned from Google authentication.');
  }

  setCachedAccessToken(token);
  return { user: result.user, accessToken: token };
}

// RFC 4648 Base64URL encoding/decoding helpers
function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    try {
      return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  }
}

function parseHeaders(headers: Array<{ name: string; value: string }> = []) {
  const map: Record<string, string> = {};
  headers.forEach((h) => {
    map[h.name.toLowerCase()] = h.value;
  });
  return map;
}

function extractBody(payload: any): { html: string; text: string } {
  let html = '';
  let text = '';

  if (!payload) return { html, text };

  if (payload.body && payload.body.data) {
    const decoded = base64UrlDecode(payload.body.data);
    if (payload.mimeType === 'text/html') {
      html = decoded;
    } else {
      text = decoded;
    }
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text = text || base64UrlDecode(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = html || base64UrlDecode(part.body.data);
      } else if (part.parts) {
        const nested = extractBody(part);
        if (!text) text = nested.text;
        if (!html) html = nested.html;
      }
    }
  }

  if (!html && text) {
    html = `<div style="font-family: sans-serif; white-space: pre-wrap;">${escapeHtml(text)}</div>`;
  }

  return { html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =============================================================
 * GMAIL REST API CLIENT CALLS
 * ============================================================= */

const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = getCachedAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Gmail. Please sign in with Google to connect your account.');
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(`${GMAIL_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMessage = `Gmail API Error (${res.status} ${res.statusText})`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errMessage = errJson.error.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errMessage);
  }

  // 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

/**
 * Fetch Current User's Gmail Profile
 */
export async function getGmailProfile(): Promise<GmailProfile> {
  return await fetchWithAuth('/profile');
}

/**
 * List labels in mailbox
 */
export async function listGmailLabels(): Promise<GmailLabel[]> {
  const data = await fetchWithAuth('/labels');
  return data.labels || [];
}

/**
 * List Messages
 */
export async function listGmailMessages(options?: {
  query?: string;
  labelIds?: string[];
  maxResults?: number;
  pageToken?: string;
}): Promise<{ messages: GmailMessageSummary[]; nextPageToken?: string }> {
  const queryParams = new URLSearchParams();
  if (options?.query) queryParams.set('q', options.query);
  if (options?.labelIds && options.labelIds.length > 0) {
    options.labelIds.forEach((id) => queryParams.append('labelIds', id));
  }
  queryParams.set('maxResults', String(options?.maxResults || 20));
  if (options?.pageToken) queryParams.set('pageToken', options.pageToken);

  const res = await fetchWithAuth(`/messages?${queryParams.toString()}`);
  const messageItems: Array<{ id: string; threadId: string }> = res.messages || [];

  if (messageItems.length === 0) {
    return { messages: [], nextPageToken: res.nextPageToken };
  }

  // Fetch summaries in parallel (up to 15 at a time)
  const summaries = await Promise.all(
    messageItems.slice(0, 15).map(async (item) => {
      try {
        const fullMsg = await fetchWithAuth(`/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`);
        const headerMap = parseHeaders(fullMsg.payload?.headers);
        const labelIds = fullMsg.labelIds || [];
        const isUnread = labelIds.includes('UNREAD');
        const isStarred = labelIds.includes('STARRED');

        return {
          id: fullMsg.id,
          threadId: fullMsg.threadId,
          from: headerMap['from'] || 'Unknown Sender',
          to: headerMap['to'] || '',
          subject: headerMap['subject'] || '(No Subject)',
          date: headerMap['date'] || '',
          timestamp: Number(fullMsg.internalDate) || Date.now(),
          snippet: fullMsg.snippet || '',
          labelIds,
          isUnread,
          isStarred,
        } as GmailMessageSummary;
      } catch (e) {
        return {
          id: item.id,
          threadId: item.threadId,
          from: 'Email Item',
          to: '',
          subject: `Message #${item.id}`,
          date: '',
          timestamp: Date.now(),
          snippet: '',
          labelIds: [],
          isUnread: false,
          isStarred: false,
        } as GmailMessageSummary;
      }
    })
  );

  return {
    messages: summaries,
    nextPageToken: res.nextPageToken,
  };
}

/**
 * Get Single Message Full Detail
 */
export async function getGmailMessage(id: string): Promise<GmailMessageDetail> {
  const fullMsg = await fetchWithAuth(`/messages/${id}?format=full`);
  const headerMap = parseHeaders(fullMsg.payload?.headers);
  const labelIds = fullMsg.labelIds || [];
  const { html, text } = extractBody(fullMsg.payload);

  return {
    id: fullMsg.id,
    threadId: fullMsg.threadId,
    from: headerMap['from'] || 'Unknown Sender',
    to: headerMap['to'] || '',
    cc: headerMap['cc'],
    bcc: headerMap['bcc'],
    subject: headerMap['subject'] || '(No Subject)',
    date: headerMap['date'] || '',
    timestamp: Number(fullMsg.internalDate) || Date.now(),
    snippet: fullMsg.snippet || '',
    bodyHtml: html || (text ? `<pre>${text}</pre>` : '<p className="text-zinc-500 italic">No content</p>'),
    bodyText: text,
    labelIds,
    isUnread: labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
  };
}

/**
 * Send an Email (RFC 2822 format encoded in base64url)
 */
export async function sendGmailMessage(params: SendEmailParams): Promise<{ id: string; threadId: string }> {
  const headers = [
    `To: ${params.to}`,
    params.cc ? `Cc: ${params.cc}` : null,
    params.bcc ? `Bcc: ${params.bcc}` : null,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    params.body.replace(/\n/g, '<br/>'),
  ].filter(Boolean).join('\r\n');

  const raw = base64UrlEncode(headers);

  const payload: any = { raw };
  if (params.threadId) {
    payload.threadId = params.threadId;
  }

  return await fetchWithAuth('/messages/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Create a Draft
 */
export async function createGmailDraft(params: SendEmailParams): Promise<{ id: string }> {
  const headers = [
    `To: ${params.to}`,
    params.cc ? `Cc: ${params.cc}` : null,
    params.bcc ? `Bcc: ${params.bcc}` : null,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    params.body.replace(/\n/g, '<br/>'),
  ].filter(Boolean).join('\r\n');

  const raw = base64UrlEncode(headers);

  return await fetchWithAuth('/drafts', {
    method: 'POST',
    body: JSON.stringify({
      message: { raw, threadId: params.threadId },
    }),
  });
}

/**
 * Move message to Trash
 */
export async function trashGmailMessage(id: string): Promise<any> {
  return await fetchWithAuth(`/messages/${id}/trash`, {
    method: 'POST',
  });
}

/**
 * Untrash / restore message
 */
export async function untrashGmailMessage(id: string): Promise<any> {
  return await fetchWithAuth(`/messages/${id}/untrash`, {
    method: 'POST',
  });
}

/**
 * Permanently Delete Message
 */
export async function deleteGmailMessage(id: string): Promise<any> {
  return await fetchWithAuth(`/messages/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Modify Labels (mark read/unread, star/unstar)
 */
export async function modifyGmailMessageLabels(
  id: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = []
): Promise<any> {
  return await fetchWithAuth(`/messages/${id}/modify`, {
    method: 'POST',
    body: JSON.stringify({
      addLabelIds,
      removeLabelIds,
    }),
  });
}

export async function markMessageRead(id: string): Promise<void> {
  await modifyGmailMessageLabels(id, [], ['UNREAD']);
}

export async function markMessageUnread(id: string): Promise<void> {
  await modifyGmailMessageLabels(id, ['UNREAD'], []);
}

export async function toggleMessageStar(id: string, currentStarred: boolean): Promise<void> {
  if (currentStarred) {
    await modifyGmailMessageLabels(id, [], ['STARRED']);
  } else {
    await modifyGmailMessageLabels(id, ['STARRED'], []);
  }
}

/* =============================================================
 * REALISTIC FALLBACK / PREVIEW DATA
 * Displays when user has not yet signed in to Google in preview
 * ============================================================= */

export const INITIAL_PREVIEW_MESSAGES: GmailMessageDetail[] = [
  {
    id: 'msg_rc_001',
    threadId: 'th_001',
    from: 'Marcus Vance <m.vance@apexlogistics.com>',
    to: 'rcsoulutions@gmail.com',
    subject: 'URGENT: Warehouse Unit 4 HVAC Compressor Failure',
    date: 'Today at 10:14 AM',
    timestamp: Date.now() - 3600000 * 2,
    snippet: 'Hi RC Solutions team, our secondary refrigeration compressor tripped on high pressure alarm. We have temperature-sensitive cargo arriving at 2:00 PM.',
    bodyHtml: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #e4e4e7;">
        <p>Hi RC Solutions team,</p>
        <p>Our secondary refrigeration compressor at Apex Logistics Bay 4 just tripped on high pressure alarm. We have temperature-sensitive pharmaceutical inventory arriving at 2:00 PM today.</p>
        <p>Could you dispatch an emergency technician with high-side manifold gauges and spare 40A contactors immediately? Please confirm ETA.</p>
        <p style="margin-top: 16px;">Best regards,<br/><strong>Marcus Vance</strong><br/>Facilities Director, Apex Cold Storage</p>
      </div>
    `,
    bodyText: 'Hi RC Solutions team, Our secondary refrigeration compressor at Apex Logistics Bay 4 just tripped on high pressure alarm. We have temperature-sensitive pharmaceutical inventory arriving at 2:00 PM today.',
    labelIds: ['INBOX', 'IMPORTANT', 'UNREAD'],
    isUnread: true,
    isStarred: true,
  },
  {
    id: 'msg_rc_002',
    threadId: 'th_002',
    from: 'Sarah Chen <schen@starlightbiotech.com>',
    to: 'rcsoulutions@gmail.com',
    subject: 'Approved: Cleanroom Airflow Calibration Quote #RC-2026-88',
    date: 'Yesterday at 4:32 PM',
    timestamp: Date.now() - 3600000 * 20,
    snippet: 'Thank you for the detailed proposal. We have approved the $4,250 calibration and HEPA certification. Purchase Order PO-9912 is attached.',
    bodyHtml: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #e4e4e7;">
        <p>Hello RC Solutions Operations,</p>
        <p>Thank you for sending over the calibrated velocity mapping estimate. We have signed off on the $4,250 quote for Cleanroom Delta-7.</p>
        <p>PO #<strong>PO-9912</strong> has been generated by our finance department. Please coordinate with technician Dave Vance for Tuesday 07:00 access.</p>
        <p style="margin-top: 16px;">Warm regards,<br/><strong>Sarah Chen</strong><br/>Lab Operations Lead, Starlight Bio</p>
      </div>
    `,
    bodyText: 'Thank you for sending over the calibrated velocity mapping estimate. We have signed off on the $4,250 quote.',
    labelIds: ['INBOX'],
    isUnread: false,
    isStarred: false,
  },
  {
    id: 'msg_rc_003',
    threadId: 'th_003',
    from: 'Trane Industrial Parts <orders@trane-supply.com>',
    to: 'rcsoulutions@gmail.com',
    subject: 'Order Shipped: 2x 15-Ton Scroll Compressors (Tracking #TRN-488219)',
    date: 'Sep 26, 2026',
    timestamp: Date.now() - 3600000 * 48,
    snippet: 'Your order of 2x Trane R-410A Scroll Compressors has been dispatched via FedEx Freight Priority. Estimated arrival: Tomorrow 09:30 AM.',
    bodyHtml: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #e4e4e7;">
        <p>Your commercial order has been processed and dispatched from the Portland Regional Distribution Center.</p>
        <ul style="background: #18181b; padding: 12px 24px; border-radius: 8px;">
          <li>Item: 2x Trane 15-Ton R410A Commercial Scroll Compressors</li>
          <li>Carrier: FedEx Freight Priority #TRN-488219</li>
          <li>Delivery Address: RC Solutions Central Depot</li>
        </ul>
      </div>
    `,
    bodyText: 'Your commercial order has been processed and dispatched from Portland Regional Distribution Center.',
    labelIds: ['INBOX'],
    isUnread: false,
    isStarred: false,
  },
  {
    id: 'msg_rc_004',
    threadId: 'th_004',
    from: 'City Building Inspection <permits@metrobuilding.gov>',
    to: 'rcsoulutions@gmail.com',
    subject: 'Inspection Certificate Issued: Metro Tech Center Rooftop Units',
    date: 'Sep 24, 2026',
    timestamp: Date.now() - 3600000 * 96,
    snippet: 'Final mechanical inspection passed for permit M-2026-0391. Your certificate of compliance is ready for download.',
    bodyHtml: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #e4e4e7;">
        <p>This notification confirms that the final mechanical inspection conducted on September 24, 2026 for Permit <strong>M-2026-0391</strong> has passed all seismic strapping and pressure safety checks.</p>
        <p>Inspector: J. Reynolds (Badge #482)</p>
      </div>
    `,
    bodyText: 'Final mechanical inspection passed for permit M-2026-0391.',
    labelIds: ['INBOX'],
    isUnread: false,
    isStarred: true,
  },
];
