import { apiFetch } from '../lib/api';
import { AgentInboxMessage, AgentId, AgentMessageKind, TabType } from '../types';

export interface CreateAgentMessageInput {
  agent: AgentId;
  kind: AgentMessageKind;
  title: string;
  body: string;
  actionLabel?: string;
  actionTab?: TabType;
  actionUrl?: string;
  dedupeKey?: string;
}

/**
 * Client for the Proactive Agent Inbox — the channel the AI team uses to
 * reach the owner with alerts, suggestions, and questions.
 */
export const agentInboxService = {
  async list(businessId: string): Promise<AgentInboxMessage[]> {
    const msgs = await apiFetch<AgentInboxMessage[]>(`/api/business/${businessId}/agent-messages`);
    return Array.isArray(msgs) ? msgs : [];
  },

  async create(businessId: string, input: CreateAgentMessageInput): Promise<AgentInboxMessage> {
    return apiFetch<AgentInboxMessage>(`/api/business/${businessId}/agent-messages`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async markRead(businessId: string, messageId: string): Promise<AgentInboxMessage> {
    return apiFetch<AgentInboxMessage>(`/api/business/${businessId}/agent-messages/${messageId}/read`, {
      method: 'POST',
    });
  },

  async respond(
    businessId: string,
    messageId: string,
    action: 'answered' | 'dismissed' | 'snoozed',
    text?: string
  ): Promise<AgentInboxMessage> {
    return apiFetch<AgentInboxMessage>(`/api/business/${businessId}/agent-messages/${messageId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action, text }),
    });
  },
};

export const AGENT_META: Record<AgentId, { name: string; color: string; bg: string }> = {
  sales: { name: 'Sales', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  operations: { name: 'Operations', color: 'text-sky-400', bg: 'bg-sky-500/15 border-sky-500/30' },
  marketing: { name: 'Marketing', color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/15 border-fuchsia-500/30' },
  support: { name: 'Support', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  receptionist: { name: 'Receptionist', color: 'text-lime-400', bg: 'bg-lime-500/15 border-lime-500/30' },
  system: { name: 'System', color: 'text-zinc-400', bg: 'bg-zinc-500/15 border-zinc-500/30' },
  // The main AI itself, used only for its own attention alerts.
  main: { name: 'Main AI', color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/30' },
};
