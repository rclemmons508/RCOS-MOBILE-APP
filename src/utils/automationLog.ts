/** Client-side log of automation rules that fired. Newest first, capped at 50. */

/**
 * The log is company history — its details name customers and phone
 * numbers ("Sent via Vonage to …"). It is therefore keyed per business,
 * like every other company-scoped store. The old global key is never
 * read again (it cannot be attributed to a company without risking a
 * leak); its entries are superseded by the per-company logs.
 */
export interface AutomationLogEntry {
  id: string;
  ruleId: string;
  ruleName: string;
  detail: string;
  at: string;
  businessId?: string;
}

const LEGACY_KEY = 'rcos_automation_log';

function keyFor(businessId: string | undefined | null): string | null {
  const clean = (businessId || '').trim();
  return clean ? `${LEGACY_KEY}_${clean}` : null;
}

export function logAutomationFired(ruleId: string, ruleName: string, detail: string, businessId?: string | null): void {
  const key = keyFor(businessId);
  if (!key) return; // no company in scope — nothing to attribute this entry to
  try {
    const raw = localStorage.getItem(key);
    const list: AutomationLogEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift({ id: `log_${Date.now()}`, ruleId, ruleName, detail, at: new Date().toISOString(), businessId: businessId || undefined });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* storage unavailable — skip */
  }
}

export function getAutomationLog(businessId?: string | null): AutomationLogEntry[] {
  const key = keyFor(businessId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
