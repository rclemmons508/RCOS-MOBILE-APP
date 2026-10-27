import { apiFetch } from '../lib/api';
import { teamHeaders } from './teamService';
import { firestoreService } from './firestoreService';
import type { Job } from '../types';

/**
 * Chat actions: the agent DOES things instead of only advising.
 *
 * Pattern (honesty rule): the user's message is matched against a small set
 * of supported intents. When one matches, the chat shows a confirmation
 * card with the EXACT values that will be sent — editable before confirming.
 * NOTHING is executed until the user taps Confirm. The result shown comes
 * from the real server/Firestore response (record id / status); a failure
 * is reported plainly and never presented as success.
 *
 * Gmail sending from chat stays OFF (standing rule): no email action here.
 */

export type ChatActionKind =
  | 'customer_request'
  | 'team_message'
  | 'job'
  | 'command'
  | 'mark_paid';

export interface ChatActionField {
  key: string;
  label: string;
  value: string;
  multiline?: boolean;
}

export interface ChatActionDraft {
  kind: ChatActionKind;
  title: string;
  description: string;
  fields: ChatActionField[];
}

export interface ChatActionResult {
  ok: boolean;
  summary: string;
  recordId?: string;
}

const clean = (s: string) => (s || '').trim();

/** Best-effort extraction: "for <Name>", "about <service>", quoted text. */
function extractFor(text: string): string {
  const m = text.match(/\bfor\s+([A-Z][\w .'-]{1,60}?)(?:,|\s+about\s|\s+needing\s|\s+who\s|\s+to\s|$)/i);
  return m ? clean(m[1]) : '';
}

function extractAbout(text: string): string {
  const m = text.match(/\babout\s+([^,;]+?)(?:\s+for\s|$)/i);
  return m ? clean(m[1]) : '';
}

function extractQuoted(text: string): string {
  const m = text.match(/["“]([^"”]+)["”]/);
  return m ? clean(m[1]) : '';
}

function extractActionId(text: string): string {
  const m = text.match(/act_[A-Za-z0-9_-]+/);
  return m ? m[0] : '';
}

/**
 * Deterministic intent matching. Deliberately narrow: advice questions
 * ("how do I create a quote?") must NOT trigger a card — only direct
 * requests ("create a customer request for ...") do.
 */
export function detectChatAction(rawText: string): ChatActionDraft | null {
  const text = rawText || '';
  const lower = text.toLowerCase();

  if (/\b(mark|set)\b.*\b(invoice|action)\b.*\bpaid\b/.test(lower)) {
    const actionId = extractActionId(text);
    if (!actionId) return null; // Without an id there is nothing real to act on.
    return {
      kind: 'mark_paid',
      title: 'Mark invoice as paid',
      description: 'This marks the invoice record below as paid on the server. Check the id before confirming.',
      fields: [
        { key: 'actionId', label: 'Invoice / action id', value: actionId },
        { key: 'amount', label: 'Amount paid (leave blank for the full amount)', value: '' },
      ],
    };
  }

  if (/\b(send|post)\b.*\b(team message|message to the team)\b/.test(lower)) {
    const message = extractQuoted(text) || text.replace(/\b(send|post)\b.*?\b(team message|message to the team)\b[:\s]*/i, '');
    return {
      kind: 'team_message',
      title: 'Send a team message',
      description: 'This posts the message below to Team Chat, where the whole team can see it.',
      fields: [{ key: 'text', label: 'Message', value: clean(message), multiline: true }],
    };
  }

  if (/\b(create|log|add|open|file)\b.*\b(customer request|request|lead)\b/.test(lower)) {
    return {
      kind: 'customer_request',
      title: 'Create a customer request',
      description: 'This creates a real customer request in the app. Check the details before confirming.',
      fields: [
        { key: 'customerName', label: 'Customer name', value: extractFor(text) },
        { key: 'serviceType', label: 'Service needed', value: extractAbout(text) },
        { key: 'description', label: 'Details', value: clean(text), multiline: true },
        { key: 'customerPhone', label: 'Phone (optional)', value: '' },
      ],
    };
  }

  if (/\b(create|schedule|book)\b.*\bjob\b/.test(lower)) {
    return {
      kind: 'job',
      title: 'Create a job',
      description: 'This creates a real job on the Jobs list, unassigned. Check the details before confirming.',
      fields: [
        { key: 'title', label: 'Job title', value: extractAbout(text) || 'New job' },
        { key: 'clientName', label: 'Customer name', value: extractFor(text) },
        { key: 'description', label: 'Details', value: clean(text), multiline: true },
      ],
    };
  }

  if (/^\s*run\b/i.test(text) || /\brun (a |the )?command\b/i.test(lower)) {
    const instruction = clean(text.replace(/^\s*run\b[:\s]*/i, ''));
    return {
      kind: 'command',
      title: 'Run a business command',
      description: 'This hands the instruction below to the app engine, which creates and runs a work action for it.',
      fields: [{ key: 'instruction', label: 'Instruction', value: instruction, multiline: true }],
    };
  }

  return null;
}

function valuesOf(draft: ChatActionDraft, values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of draft.fields) out[f.key] = clean(values[f.key] ?? f.value);
  return out;
}

function errText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return 'The server did not confirm the action.';
}

/** Execute a confirmed card. Every branch reports only what its call returned. */
export async function executeChatAction(
  businessId: string,
  draft: ChatActionDraft,
  values: Record<string, string>,
  sender: { email: string; name: string }
): Promise<ChatActionResult> {
  const v = valuesOf(draft, values);
  try {
    switch (draft.kind) {
      case 'customer_request': {
        if (!v.customerName) return { ok: false, summary: 'No customer name was given, so nothing was created.' };
        const saved = await apiFetch<any>(`/api/business/${businessId}/requests`, {
          method: 'POST',
          body: JSON.stringify({
            customerName: v.customerName,
            customerPhone: v.customerPhone || '',
            serviceType: v.serviceType || 'General request',
            description: v.description || v.serviceType || 'Created from AI chat',
            urgency: 'normal',
          }),
        });
        if (saved?.id) {
          return { ok: true, summary: `Done — customer request created for ${v.customerName}.`, recordId: String(saved.id) };
        }
        return { ok: false, summary: 'The server did not return a request record, so this is not confirmed as created.' };
      }
      case 'team_message': {
        if (!v.text) return { ok: false, summary: 'No message text was given, so nothing was sent.' };
        const saved = await apiFetch<any>(`/api/business/${businessId}/team-messages`, {
          method: 'POST',
          headers: teamHeaders(sender.email),
          body: JSON.stringify({ text: v.text, senderName: sender.name || 'Team member' }),
        });
        if (saved?.id) {
          return { ok: true, summary: 'Done — team message posted to Team Chat.', recordId: String(saved.id) };
        }
        return { ok: false, summary: 'The server did not return a message record, so this is not confirmed as sent.' };
      }
      case 'job': {
        const job: Job = {
          id: `job_${Date.now()}`,
          title: v.title || 'New job',
          clientName: v.clientName || 'Unnamed customer',
          clientPhone: '',
          address: '',
          status: 'unassigned',
          priority: 'medium',
          estimatedValue: 0,
          scheduledTime: new Date().toISOString(),
          description: v.description || v.title || 'Created from AI chat',
          category: 'Maintenance',
        };
        // saveJob throws on failure (handleFirestoreError returns never),
        // so resolving here means the job really was written.
        await firestoreService.saveJob(businessId, job);
        return { ok: true, summary: `Done — job "${job.title}" created on the Jobs list.`, recordId: job.id };
      }
      case 'command': {
        if (!v.instruction) return { ok: false, summary: 'No instruction was given, so nothing was run.' };
        const action = await apiFetch<any>(`/api/business/${businessId}/command`, {
          method: 'POST',
          body: JSON.stringify({ instruction: v.instruction }),
        });
        if (action?.id) {
          return { ok: true, summary: `Done — work action started: ${action.title || action.actionType || 'command'}.`, recordId: String(action.id) };
        }
        return { ok: false, summary: 'The server did not return an action record, so this is not confirmed as started.' };
      }
      case 'mark_paid': {
        if (!v.actionId) return { ok: false, summary: 'No invoice id was given, so nothing was changed.' };
        const amount = Number(v.amount);
        const updated = await apiFetch<any>(`/api/business/${businessId}/actions/${v.actionId}/mark-paid`, {
          method: 'POST',
          body: JSON.stringify(Number.isFinite(amount) && amount > 0 ? { amount } : {}),
        });
        if (updated?.paymentStatus === 'paid') {
          return { ok: true, summary: 'Done — invoice marked as paid.', recordId: String(updated.id || v.actionId) };
        }
        return { ok: false, summary: 'The server did not confirm the invoice as paid, so it was not changed.' };
      }
      default:
        return { ok: false, summary: 'That action is not supported from chat.' };
    }
  } catch (e) {
    return { ok: false, summary: `It did not go through: ${errText(e)}` };
  }
}
