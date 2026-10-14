import { apiFetch } from '../lib/api';
import { BusinessAccount, BusinessMember, TeamInvite, TeamMessage } from '../types';

/**
 * Team (human-to-human) API calls.
 * Every team call sends the signed-in login email in the X-User-Email
 * header so the server can check team membership while the Firebase
 * login gate is OFF. Once the gate is ON, the verified token takes over.
 */
function teamHeaders(email: string): Record<string, string> {
  return { 'X-User-Email': (email || '').trim().toLowerCase() };
}

export interface TeamRoster {
  businessId: string;
  businessName: string;
  members: BusinessMember[];
  invites: TeamInvite[];
  isOwner: boolean;
}

export const teamService = {
  /** Roster + (owners only) pending invites for a business. */
  async getTeam(businessId: string, email: string): Promise<TeamRoster> {
    return apiFetch<TeamRoster>(`/api/business/${encodeURIComponent(businessId)}/team`, {
      headers: teamHeaders(email)
    });
  },

  /** Owner creates an invite. `inviteEmail` optional — when set, only that email can use the code. */
  async createInvite(businessId: string, email: string, inviteEmail: string): Promise<TeamInvite> {
    const res = await apiFetch<{ invite: TeamInvite }>(
      `/api/business/${encodeURIComponent(businessId)}/team/invites`,
      {
        method: 'POST',
        headers: teamHeaders(email),
        body: JSON.stringify({ email: inviteEmail, requesterEmail: email })
      }
    );
    return res.invite;
  },

  /** Owner cancels a pending invite. */
  async revokeInvite(businessId: string, email: string, code: string): Promise<void> {
    await apiFetch(`/api/business/${encodeURIComponent(businessId)}/team/invites/${encodeURIComponent(code)}`, {
      method: 'DELETE',
      headers: teamHeaders(email)
    });
  },

  /** Owner removes a member from the team. */
  async removeMember(businessId: string, email: string, memberEmail: string): Promise<void> {
    await apiFetch(
      `/api/business/${encodeURIComponent(businessId)}/team/members/${encodeURIComponent(memberEmail)}`,
      { method: 'DELETE', headers: teamHeaders(email) }
    );
  },

  /** A member leaves the team (the owner cannot leave). */
  async leaveTeam(businessId: string, email: string): Promise<void> {
    await apiFetch(`/api/business/${encodeURIComponent(businessId)}/team/leave`, {
      method: 'POST',
      headers: teamHeaders(email),
      body: JSON.stringify({ requesterEmail: email })
    });
  },

  /**
   * Join a company with an invite code. Public — the joiner has no
   * account yet. The server never sees the password; the app creates
   * the local login itself after this succeeds.
   */
  async joinCompany(args: { code: string; fullName: string; email: string }): Promise<{ business: BusinessAccount; alreadyMember: boolean }> {
    return apiFetch<{ business: BusinessAccount; alreadyMember: boolean }>('/api/team/join', {
      method: 'POST',
      body: JSON.stringify(args)
    });
  },

  /** Team chat history, oldest first. */
  async getTeamMessages(businessId: string, email: string): Promise<TeamMessage[]> {
    return apiFetch<TeamMessage[]>(`/api/business/${encodeURIComponent(businessId)}/team-messages`, {
      headers: teamHeaders(email)
    });
  },

  /** Send one team chat message. */
  async sendTeamMessage(
    businessId: string,
    email: string,
    args: { text: string; senderName: string; senderAvatar?: string }
  ): Promise<TeamMessage> {
    return apiFetch<TeamMessage>(`/api/business/${encodeURIComponent(businessId)}/team-messages`, {
      method: 'POST',
      headers: teamHeaders(email),
      body: JSON.stringify({ ...args, requesterEmail: email })
    });
  }
};
