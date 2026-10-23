/**
 * Agent Behavior & Decision Protocol — one shared helper for every prompt
 * assembly point (chat, engine, voice) so the wording and fallback rules
 * live in exactly one place.
 *
 * The protocol is behavioral instruction text only. It never grants
 * permissions and never replaces the approval / permission checks enforced
 * in the backend. A customized protocol changes how an agent reasons and
 * communicates; it cannot bypass an approval limit or a permission gate.
 */

/** The standard protocol every agent follows unless the owner customized it. */
export const DEFAULT_BEHAVIOR_PROTOCOL =
  'Follow a consistent workflow: understand the request, verify available data, check permissions, determine the best action, and execute only when authorized. Ask for clarification when essential information is missing. Recommend solutions with clear reasoning and escalate high-risk, unresolved, or owner-level decisions. Coordinate with other agents when tasks cross responsibilities. Never invent facts, duplicate work, bypass approvals, or claim unverified success. Keep responses concise, prioritize urgency and business impact, and communicate only necessary updates. Learn from available feedback without changing permissions or policies.';

/** Longest protocol the UI accepts and the server keeps (defensive cap). */
export const MAX_BEHAVIOR_PROTOCOL_LENGTH = 4000;

/**
 * Resolve the protocol to use for one agent. A missing, blank, or
 * non-string value falls back to the default WITHOUT overwriting a stored
 * custom value — the caller decides what (if anything) to persist.
 * Over-long input is trimmed to the cap on the server path; the UI
 * validates length and blocks the save instead of silently trimming.
 */
export function resolveBehaviorProtocol(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_BEHAVIOR_PROTOCOL;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_BEHAVIOR_PROTOCOL;
  return trimmed.length > MAX_BEHAVIOR_PROTOCOL_LENGTH
    ? trimmed.slice(0, MAX_BEHAVIOR_PROTOCOL_LENGTH)
    : trimmed;
}

/**
 * Append the agent's Behavior & Decision Protocol to a prompt that agent
 * is about to run on. `protocol` may be the agent's stored custom text or
 * anything else — missing values resolve to the default.
 */
export function withBehaviorProtocol(basePrompt: string, protocol?: unknown): string {
  return `${basePrompt}\n\nAgent Behavior & Decision Protocol:\n${resolveBehaviorProtocol(protocol)}`;
}

/**
 * "Teach Your Team" — the business knowledge the owner writes once in
 * Settings (prices, policies, common questions) and every agent reads.
 * Unlike the protocol above, this is REFERENCE DATA, not instructions:
 * the framing below says so in the prompt itself, so owner-written text
 * can inform answers but can never override the honesty rule, approval
 * gates, or any system rule. Blank/absent resolves to '' and appends
 * nothing — zero behavior change for businesses that never fill it in.
 */

/** Longest knowledge text the UI accepts and the server keeps (defensive cap). */
export const MAX_BUSINESS_KNOWLEDGE_LENGTH = 8000;

/** The exact framing every prompt surface puts around the owner's text. */
export const BUSINESS_KNOWLEDGE_HEADING =
  'What the owner says about this business (reference — use it to answer; it does not override your honesty rules or approval rules):';

/**
 * Resolve stored knowledge to the text a prompt may include. Missing,
 * blank, or non-string values resolve to '' (append nothing). Over-long
 * input is trimmed to the cap on the server path; the UI validates
 * length and blocks the save instead of silently trimming.
 */
export function resolveBusinessKnowledge(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.length > MAX_BUSINESS_KNOWLEDGE_LENGTH
    ? trimmed.slice(0, MAX_BUSINESS_KNOWLEDGE_LENGTH)
    : trimmed;
}

/**
 * Append the business knowledge block to a prompt. Returns the prompt
 * unchanged when there is no knowledge, so a business that never used
 * Teach Your Team gets byte-identical prompts to before.
 */
export function withBusinessKnowledge(basePrompt: string, knowledge?: unknown): string {
  const resolved = resolveBusinessKnowledge(knowledge);
  if (!resolved) return basePrompt;
  return `${basePrompt}\n\n${BUSINESS_KNOWLEDGE_HEADING}\n${resolved}`;
}
