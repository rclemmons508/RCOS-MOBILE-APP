/**
 * Guided first-run app check — read-only probes for each core flow.
 *
 * Rules this file follows:
 * - READ-ONLY. Every probe is a local read or a safe GET request.
 *   Nothing here signs anyone in, saves anything, sends anything, or
 *   deletes anything.
 * - A failure is NEVER called a wrong step without evidence it was the
 *   step. When in doubt, the verdict is "system-error", never a user
 *   error. Ambiguous failures default to "system-error".
 * - The voice probe checks that the phone service ANSWERS. It never
 *   calls the voice-token endpoint (that would create a call room) and
 *   it never claims an agent speaks.
 * - The Gmail probe uses only the HTTP status of the token endpoint
 *   (connected = 200, not connected = 404). The token itself is
 *   discarded and never stored or shown.
 * - Every verdict and fix uses plain, jargon-free words.
 */
import { apiFetch } from '../lib/api';
import { employeeCustomizationService } from '../services/employeeCustomizationService';
import type { AutomationTask, BusinessAccount, User } from '../types';

export type AppCheckVerdict = 'working' | 'wrong-step' | 'system-error' | 'not-yet';

export interface AppCheckResult {
  id: string;
  title: string;
  verdict: AppCheckVerdict;
  detail: string;
  /** Fix steps, plain words, no numbers (the panel numbers them). Empty when working. */
  fix: string[];
}

export interface AppCheckInput {
  currentUser?: User | null;
  businessId?: string;
  business?: BusinessAccount | null;
  automationTasks: AutomationTask[];
  automationMasterOn: boolean;
}

type Probe = { ok: boolean; status: number | null; count: number | null };

async function probeGet(endpoint: string): Promise<Probe> {
  try {
    const data = await apiFetch<unknown>(endpoint, { timeoutMs: 8000 });
    return { ok: true, status: 200, count: Array.isArray(data) ? data.length : null };
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : null;
    return { ok: false, status, count: null };
  }
}

/** Plain words for a failed probe. */
function failureWords(status: number | null): string {
  if (status === null || status === 0) return 'The phone could not reach the server. Check your internet.';
  if (status === 408) return 'The server took too long to answer.';
  return `The server said ${status}.`;
}

/** Report code, always derived from the real failure (endpoint + status). */
function reportCode(endpoint: string, status: number | null): string {
  return `${endpoint} → ${status === null || status === 0 ? 'no answer' : status}`;
}

function systemFix(endpoint: string, status: number | null): string[] {
  return [
    'Check your internet.',
    'Run the check again.',
    `If it still fails, tell support this: ${reportCode(endpoint, status)}`,
  ];
}

function notYetFix(): string[] {
  return ['Finish setting up your company.', 'Run the check again.'];
}

/**
 * Runs every flow check in order. Returns one result per flow.
 * Safe to run with no company, no sign-in, or no internet — those are
 * verdicts, never crashes.
 */
export async function runAppCheck(input: AppCheckInput): Promise<AppCheckResult[]> {
  const { currentUser, businessId, business } = input;
  const hasBusiness = !!(businessId && business);
  const enc = businessId ? encodeURIComponent(businessId) : '';
  const results: AppCheckResult[] = [];

  // ---- 1. Sign-in (local read only) ----
  if (currentUser) {
    results.push({
      id: 'signin',
      title: 'Sign-in',
      verdict: 'working',
      detail: `Signed in as ${currentUser.fullName || currentUser.email}.`,
      fix: [],
    });
  } else {
    results.push({
      id: 'signin',
      title: 'Sign-in',
      verdict: 'wrong-step',
      detail: 'Nobody is signed in.',
      fix: ['Sign in with your account.', 'Run the check again.'],
    });
  }

  // ---- Server probes (all GET, all read-only) ----
  const [routingLog] = await Promise.all([probeGet('/api/voice/routing-log')]);

  // Best-effort phone config. If it fails, the voice verdict still rests
  // on the routing log alone; the detail just leaves the provider out.
  let phoneProvider = '';
  try {
    const cfg = await apiFetch<{ telephonyProvider?: string }>('/api/firebase-config', { timeoutMs: 8000 });
    phoneProvider = cfg?.telephonyProvider || '';
  } catch {
    phoneProvider = '';
  }

  const skipped: Probe = { ok: false, status: null, count: null };
  const [businessRecord, requests, actions, teamMessages, team, gmail] = hasBusiness
    ? await Promise.all([
        probeGet(`/api/business/${enc}`),
        probeGet(`/api/business/${enc}/requests`),
        probeGet(`/api/business/${enc}/actions`),
        probeGet(`/api/business/${enc}/team-messages`),
        probeGet(`/api/business/${enc}/team`),
        probeGet(`/api/business/${enc}/gmail-token`),
      ])
    : [skipped, skipped, skipped, skipped, skipped, skipped];

  // ---- 2. Company setup ----
  if (!business) {
    results.push({
      id: 'company',
      title: 'Company setup',
      verdict: 'wrong-step',
      detail: 'No company is set up yet.',
      fix: ['Finish setting up your company (onboarding).', 'Run the check again.'],
    });
  } else if (businessRecord.ok) {
    results.push({
      id: 'company',
      title: 'Company setup',
      verdict: 'working',
      detail: `Company "${business.name}" is loaded.`,
      fix: [],
    });
  } else if (businessRecord.status === 404) {
    results.push({
      id: 'company',
      title: 'Company setup',
      verdict: 'system-error',
      detail: 'This phone has a company saved, but the server cannot find it.',
      fix: systemFix(`/api/business/${enc}`, 404),
    });
  } else {
    results.push({
      id: 'company',
      title: 'Company setup',
      verdict: 'system-error',
      detail: failureWords(businessRecord.status),
      fix: systemFix(`/api/business/${enc}`, businessRecord.status),
    });
  }

  // ---- 3. Dashboard ----
  if (!hasBusiness) {
    results.push({
      id: 'dashboard',
      title: 'Dashboard',
      verdict: 'not-yet',
      detail: 'Needs a company first.',
      fix: notYetFix(),
    });
  } else if (requests.ok && actions.ok) {
    results.push({
      id: 'dashboard',
      title: 'Dashboard',
      verdict: 'working',
      detail: 'The Dashboard numbers can load.',
      fix: [],
    });
  } else {
    const failed = !requests.ok ? { name: 'Customer requests', endpoint: `/api/business/${enc}/requests`, probe: requests } : { name: 'Money records', endpoint: `/api/business/${enc}/actions`, probe: actions };
    results.push({
      id: 'dashboard',
      title: 'Dashboard',
      verdict: 'system-error',
      detail: `${failed.name} did not load. ${failureWords(failed.probe.status)}`,
      fix: systemFix(failed.endpoint, failed.probe.status),
    });
  }

  // ---- 4. Jobs & money ----
  if (!hasBusiness) {
    results.push({
      id: 'jobs-money',
      title: 'Jobs & money',
      verdict: 'not-yet',
      detail: 'Needs a company first.',
      fix: notYetFix(),
    });
  } else if (actions.ok) {
    results.push({
      id: 'jobs-money',
      title: 'Jobs & money',
      verdict: 'working',
      detail: 'Your quotes, jobs, and invoices can load.',
      fix: [],
    });
  } else {
    results.push({
      id: 'jobs-money',
      title: 'Jobs & money',
      verdict: 'system-error',
      detail: `Money records did not load. ${failureWords(actions.status)}`,
      fix: systemFix(`/api/business/${enc}/actions`, actions.status),
    });
  }

  // ---- 5. AI Team & chat (local agent list; chat is never test-sent) ----
  if (!hasBusiness) {
    results.push({
      id: 'ai-team',
      title: 'AI Team & chat',
      verdict: 'not-yet',
      detail: 'Needs a company first.',
      fix: notYetFix(),
    });
  } else {
    try {
      const list = employeeCustomizationService.getEmployees(businessId as string);
      if (list.length > 0) {
        results.push({
          id: 'ai-team',
          title: 'AI Team & chat',
          verdict: 'working',
          detail: `Your AI team list loads (${list.length} agents). This check does not send a test chat message, because sending one would change your data.`,
          fix: [],
        });
      } else {
        results.push({
          id: 'ai-team',
          title: 'AI Team & chat',
          verdict: 'system-error',
          detail: 'Your AI team list came back empty.',
          fix: [
            'Close the app and open it again.',
            'Run the check again.',
            'If it still fails, tell support: AI team list came back empty.',
          ],
        });
      }
    } catch {
      results.push({
        id: 'ai-team',
        title: 'AI Team & chat',
        verdict: 'system-error',
        detail: 'Your AI team list did not load.',
        fix: [
          'Close the app and open it again.',
          'Run the check again.',
          'If it still fails, tell support: AI team list did not load.',
        ],
      });
    }
  }

  // ---- 6. Phone / voice (reachability only — never claims an agent speaks) ----
  if (routingLog.ok) {
    results.push({
      id: 'phone-voice',
      title: 'Phone / voice',
      verdict: 'working',
      detail: `The phone service answers.${phoneProvider ? ` Phone service: ${phoneProvider}.` : ''} This check does NOT test whether an agent speaks — that needs a real call.`,
      fix: [],
    });
  } else {
    results.push({
      id: 'phone-voice',
      title: 'Phone / voice',
      verdict: 'system-error',
      detail: `The phone service did not answer. ${failureWords(routingLog.status)}`,
      fix: systemFix('/api/voice/routing-log', routingLog.status),
    });
  }

  // ---- 7. Messages / Team Chat ----
  if (!hasBusiness) {
    results.push({
      id: 'messages',
      title: 'Messages / Team Chat',
      verdict: 'not-yet',
      detail: 'Needs a company first.',
      fix: notYetFix(),
    });
  } else if (teamMessages.ok && team.ok) {
    results.push({
      id: 'messages',
      title: 'Messages / Team Chat',
      verdict: 'working',
      detail: `Team messages and the team list can load (${teamMessages.count ?? 0} messages).`,
      fix: [],
    });
  } else {
    const failed = !teamMessages.ok
      ? { endpoint: `/api/business/${enc}/team-messages`, probe: teamMessages }
      : { endpoint: `/api/business/${enc}/team`, probe: team };
    if (failed.probe.status === 403) {
      // A 403 here means the server says this account is not on the team
      // list. That is a system-side membership problem, not a wrong step.
      results.push({
        id: 'messages',
        title: 'Messages / Team Chat',
        verdict: 'system-error',
        detail: 'The server says this account is not on the team list.',
        fix: ['Run the check again.', `If it still fails, tell support this: ${reportCode(failed.endpoint, 403)}`],
      });
    } else {
      results.push({
        id: 'messages',
        title: 'Messages / Team Chat',
        verdict: 'system-error',
        detail: `Team messages did not load. ${failureWords(failed.probe.status)}`,
        fix: systemFix(failed.endpoint, failed.probe.status),
      });
    }
  }

  // ---- 8. Gmail (status only; the token itself is discarded) ----
  if (!hasBusiness) {
    results.push({
      id: 'gmail',
      title: 'Gmail',
      verdict: 'not-yet',
      detail: 'Needs a company first.',
      fix: notYetFix(),
    });
  } else if (gmail.ok) {
    results.push({
      id: 'gmail',
      title: 'Gmail',
      verdict: 'working',
      detail: 'Gmail is connected.',
      fix: [],
    });
  } else if (gmail.status === 404) {
    results.push({
      id: 'gmail',
      title: 'Gmail',
      verdict: 'wrong-step',
      detail: 'Gmail is not connected yet.',
      fix: ['Open the Gmail tab.', 'Connect Gmail.', 'Run the check again.'],
    });
  } else {
    results.push({
      id: 'gmail',
      title: 'Gmail',
      verdict: 'system-error',
      detail: `Gmail status could not be checked. ${failureWords(gmail.status)}`,
      fix: systemFix(`/api/business/${enc}/gmail-token`, gmail.status),
    });
  }

  // ---- 9. Customers & requests ----
  if (!hasBusiness) {
    results.push({
      id: 'customers',
      title: 'Customers & requests',
      verdict: 'not-yet',
      detail: 'Needs a company first.',
      fix: notYetFix(),
    });
  } else if (requests.ok) {
    results.push({
      id: 'customers',
      title: 'Customers & requests',
      verdict: 'working',
      detail: `${requests.count ?? 0} customer requests can load.`,
      fix: [],
    });
  } else {
    results.push({
      id: 'customers',
      title: 'Customers & requests',
      verdict: 'system-error',
      detail: `Customer requests did not load. ${failureWords(requests.status)}`,
      fix: systemFix(`/api/business/${enc}/requests`, requests.status),
    });
  }

  // ---- 10. Automations (local rule list + master switch) ----
  if (!hasBusiness) {
    results.push({
      id: 'automations',
      title: 'Automations',
      verdict: 'not-yet',
      detail: 'Needs a company first.',
      fix: notYetFix(),
    });
  } else {
    const tasks = input.automationTasks ?? [];
    const switchWord = input.automationMasterOn ? 'on' : 'off';
    results.push({
      id: 'automations',
      title: 'Automations',
      verdict: 'working',
      detail:
        tasks.length === 0
          ? `No automation rules set up yet. The master switch is ${switchWord}.`
          : `${tasks.length} automation rules found. The master switch is ${switchWord}.`,
      fix: [],
    });
  }

  return results;
}
