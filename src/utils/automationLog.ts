/** Client-side log of automation rules that fired. Newest first, capped at 50. */
export interface AutomationLogEntry {
  id: string;
  ruleId: string;
  ruleName: string;
  detail: string;
  at: string;
}

const KEY = 'rcos_automation_log';

export function logAutomationFired(ruleId: string, ruleName: string, detail: string): void {
  try {
    const raw = localStorage.getItem(KEY);
    const list: AutomationLogEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift({ id: `log_${Date.now()}`, ruleId, ruleName, detail, at: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* storage unavailable — skip */
  }
}

export function getAutomationLog(): AutomationLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
