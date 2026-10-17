import { AIEmployee } from '../types';
import { AI_EMPLOYEES } from '../data/employees';

const STORAGE_KEY_CUSTOM_EMPLOYEES = 'rcos_custom_ai_employees';

/**
 * Agent customizations are company data: Company B must never see
 * Company A's customized job scopes, rules, or approval limits. The
 * store is therefore keyed per business. The old global key is never
 * read again (it cannot be attributed to a company without risking a
 * leak), so pre-existing customizations stored there reset to defaults
 * once per company — the owner re-applies them. An empty business id
 * returns defaults instead of the legacy key.
 */
function keyFor(businessId: string | undefined | null): string | null {
  const clean = (businessId || '').trim();
  return clean ? `${STORAGE_KEY_CUSTOM_EMPLOYEES}_${clean}` : null;
}

export interface CustomAIEmployee extends AIEmployee {
  customJobScope?: string;
  customRules?: string[];
  autonomyLevel?: 'autonomous' | 'supervised' | 'manual';
  maxApprovalAmount?: number;
  assignedCategories?: string[];
  customPromptNotes?: string;
  phoneExtension?: string;
  isCustom?: boolean;
}

class EmployeeCustomizationService {
  /**
   * Get all AI employees merged with user custom modifications
   */
  getEmployees(businessId: string): CustomAIEmployee[] {
    const key = keyFor(businessId);
    if (!key) return this.defaultEmployees();
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const stored: CustomAIEmployee[] = JSON.parse(raw);
        if (stored && Array.isArray(stored) && stored.length > 0) {
          // Merge defaults with stored customizations
          const defaultMap = new Map(AI_EMPLOYEES.map(e => [e.id, e]));
          const merged: CustomAIEmployee[] = [];

          // First add customized versions of defaults
          defaultMap.forEach((def, id) => {
            const found = stored.find(s => s.id === id);
            if (found) {
              merged.push({ ...def, ...found });
            } else {
              merged.push({ ...def, autonomyLevel: 'autonomous', maxApprovalAmount: 1500 });
            }
          });

          // Add any newly created custom employees
          stored.filter(s => !defaultMap.has(s.id)).forEach(custom => {
            merged.push(custom);
          });

          return merged;
        }
      }
    } catch (e) {
      console.warn('[EmployeeService] Error reading customized employees:', e);
    }

    return this.defaultEmployees();
  }

  /** Factory defaults — no stored customizations for this company. */
  private defaultEmployees(): CustomAIEmployee[] {
    return AI_EMPLOYEES.map(e => ({
      ...e,
      customJobScope: e.coreJob,
      customRules: [
        'Always maintain professional, authoritative communication.',
        'Escalate unexpected equipment failures or safety hazards immediately.',
        'Keep records synchronized in the operational ledger.'
      ],
      autonomyLevel: 'autonomous',
      maxApprovalAmount: 1500,
      assignedCategories: ['HVAC', 'Automation', 'Electrical']
    }));
  }

  /**
   * Save full employees list
   */
  saveEmployees(employees: CustomAIEmployee[], businessId: string): void {
    const key = keyFor(businessId);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(employees));
    } catch (e) {
      console.error('[EmployeeService] Failed to save employees:', e);
    }
  }

  /**
   * Update a specific employee's job scope, rules, autonomy, or details
   */
  updateEmployee(id: string, updates: Partial<CustomAIEmployee>, businessId: string): CustomAIEmployee {
    const list = this.getEmployees(businessId);
    const index = list.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error(`AI Employee ${id} not found.`);
    }

    const updated: CustomAIEmployee = {
      ...list[index],
      ...updates
    };

    list[index] = updated;
    this.saveEmployees(list, businessId);
    return updated;
  }

  /**
   * Reset a specific employee to system factory defaults
   */
  resetEmployee(id: string, businessId: string): CustomAIEmployee {
    const defaultEmp = AI_EMPLOYEES.find(e => e.id === id);
    if (!defaultEmp) {
      throw new Error(`Default AI Employee ${id} not found.`);
    }

    const resetEmp: CustomAIEmployee = {
      ...defaultEmp,
      customJobScope: defaultEmp.coreJob,
      customRules: [
        'Always maintain professional, authoritative communication.',
        'Escalate unexpected equipment failures or safety hazards immediately.'
      ],
      autonomyLevel: 'autonomous',
      maxApprovalAmount: 1500
    };

    const list = this.getEmployees(businessId);
    const index = list.findIndex(e => e.id === id);
    if (index !== -1) {
      list[index] = resetEmp;
      this.saveEmployees(list, businessId);
    }
    return resetEmp;
  }

  /**
   * Add a brand new custom specialist to the AI employee fleet
   */
  addCustomEmployee(newEmp: Omit<CustomAIEmployee, 'id'>, businessId: string): CustomAIEmployee {
    const id = `custom_agent_${Date.now()}`;
    const employee: CustomAIEmployee = {
      ...newEmp,
      id,
      isCustom: true,
      avatarIcon: newEmp.avatarIcon || 'Bot',
      autonomyLevel: newEmp.autonomyLevel || 'supervised',
      maxApprovalAmount: newEmp.maxApprovalAmount || 1000
    };

    const list = this.getEmployees(businessId);
    list.push(employee);
    this.saveEmployees(list, businessId);
    return employee;
  }

  /**
   * Delete a custom employee (defaults cannot be deleted, only paused)
   */
  deleteCustomEmployee(id: string, businessId: string): boolean {
    const list = this.getEmployees(businessId);
    const target = list.find(e => e.id === id);
    if (!target || !target.isCustom) {
      return false;
    }

    const filtered = list.filter(e => e.id !== id);
    this.saveEmployees(filtered, businessId);
    return true;
  }
}

export const employeeCustomizationService = new EmployeeCustomizationService();
