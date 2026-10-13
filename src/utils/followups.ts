/**
 * Automatic follow-ups (Phase A) — helpers.
 *
 * There is NO SMS/email provider connected, so the app NEVER claims a message
 * was sent. A follow-up rule only drafts the exact text and hands it to the
 * owner in the Agent Inbox with Send now (opens the phone's SMS app with the
 * number + text pre-filled via an `sms:` URI), Edit, and Dismiss.
 *
 * The draft travels inside the server's whitelisted inbox fields (the server
 * drops any extra field): the drafted text lives in `body`, and the Send-now
 * action lives in `actionUrl` as the `sms:` URI. The inbox modal detects a
 * follow-up by that `sms:` actionUrl and renders the Send now / Edit / Dismiss
 * row instead of the generic navigation button.
 */
import type { AgentId, AgentInboxMessage } from '../types';

export const FOLLOWUP_RULE_IDS = ['rule-welcome', 'rule-missed-call', 'rule-review'] as const;
export type FollowupRuleId = (typeof FOLLOWUP_RULE_IDS)[number];

export function isFollowupRuleId(id: string): id is FollowupRuleId {
  return (FOLLOWUP_RULE_IDS as readonly string[]).includes(id);
}

export interface FollowupMeta {
  agent: AgentId;
  defaultTemplate: string;
  titleFor: (toName: string) => string;
}

export const FOLLOWUP_META: Record<FollowupRuleId, FollowupMeta> = {
  'rule-welcome': {
    agent: 'support',
    defaultTemplate:
      "Hi {firstName}! Thanks for choosing {businessName} — we're glad you're here. Reply to this text anytime you need us.",
    titleFor: (toName) => `Welcome text ready for ${toName || 'your new customer'}`,
  },
  'rule-missed-call': {
    agent: 'receptionist',
    defaultTemplate:
      'Sorry we missed your call! This is {businessName} — how can we help? Reply here or call back anytime.',
    titleFor: (toName) => `Missed call${toName ? ` from ${toName}` : ''} — text ready`,
  },
  'rule-review': {
    agent: 'marketing',
    defaultTemplate:
      'Hi {firstName}, thanks for trusting {businessName}! If we did a great job, a quick review here would mean the world: {reviewLink}',
    titleFor: (toName) => `Review request ready for ${toName || 'your customer'}`,
  },
};

/** Digits only — used for phone-keyed dedupe (same person, one welcome). */
export function normalizePhone(phone: string | undefined | null): string {
  return (phone || '').replace(/[^0-9]/g, '');
}

/** First word of a full name, or '' when unknown. */
export function firstNameOf(fullName: string | undefined | null): string {
  return (fullName || '').trim().split(/\s+/)[0] || '';
}

export interface FollowupTemplateVars {
  firstName: string;
  businessName: string;
  reviewLink: string;
}

/**
 * Fill a follow-up template. Blank-safe: placeholders never survive into the
 * sent text — a missing first name becomes "there", a missing business name
 * becomes "us", and a missing review link drops the link clause cleanly
 * ("...would mean the world to us!") instead of leaving "{reviewLink}".
 */
export function renderFollowupTemplate(template: string, vars: FollowupTemplateVars): string {
  let out = template || '';
  if (!vars.reviewLink) {
    out = out.replace('here would mean the world: {reviewLink}', 'here would mean the world to us!');
  }
  out = out.replaceAll('{firstName}', vars.firstName || 'there');
  out = out.replaceAll('{businessName}', vars.businessName || 'us');
  out = out.replaceAll('{reviewLink}', vars.reviewLink || '');
  // Collapse any leftover whitespace from a dropped placeholder.
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** `sms:` URI the inbox uses for Send now — opens the phone's SMS app pre-filled. */
export function buildSmsUrl(phone: string, text: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(text)}`;
}

/** Pull the phone + draft text back out of an `sms:` URI (for the Edit flow). */
export function parseSmsUrl(url: string | undefined | null): { phone: string; text: string } | null {
  if (!url || !url.startsWith('sms:')) return null;
  const phone = url.slice(4).split('?')[0] || '';
  const m = url.match(/[?&]body=([^&]*)/);
  let text = '';
  try {
    text = m ? decodeURIComponent(m[1]) : '';
  } catch {
    text = '';
  }
  return { phone, text };
}

/** True when an inbox message is a follow-up draft (its action is an `sms:` URI). */
export function isFollowupMessage(msg: AgentInboxMessage): boolean {
  return !!msg.actionUrl?.startsWith('sms:');
}

/** A follow-up waiting out quiet hours. Stores trigger data only — the text is
 *  re-rendered from the CURRENT template when it fires, so template edits
 *  made while queued still apply. */
export interface PendingFollowup {
  ruleId: FollowupRuleId;
  dedupeKey: string;
  to: string;
  toName: string;
}

export interface FollowupState {
  /** Keys already handled (fired, queued, or skipped because the rule was off). */
  seen: { welcome: string[]; missed: string[]; review: string[] };
  /** Per-source first-run baselines — seeded from current data, never fired. */
  primed: { welcome: boolean; jobs: boolean; calls: boolean };
  pending: PendingFollowup[];
}

function defaultState(): FollowupState {
  return {
    seen: { welcome: [], missed: [], review: [] },
    primed: { welcome: false, jobs: false, calls: false },
    pending: [],
  };
}

export function loadFollowupState(businessId: string): FollowupState {
  try {
    const raw = localStorage.getItem(`rcos_followups_${businessId}`);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<FollowupState>;
    const base = defaultState();
    return {
      seen: {
        welcome: Array.isArray(parsed.seen?.welcome) ? parsed.seen.welcome : [],
        missed: Array.isArray(parsed.seen?.missed) ? parsed.seen.missed : [],
        review: Array.isArray(parsed.seen?.review) ? parsed.seen.review : [],
      },
      primed: {
        welcome: !!parsed.primed?.welcome,
        jobs: !!parsed.primed?.jobs,
        calls: !!parsed.primed?.calls,
      },
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
    };
  } catch {
    return defaultState();
  }
}

export function saveFollowupState(businessId: string, state: FollowupState): void {
  try {
    localStorage.setItem(`rcos_followups_${businessId}`, JSON.stringify(state));
  } catch {
    /* storage unavailable — triggers will re-check next poll */
  }
}
