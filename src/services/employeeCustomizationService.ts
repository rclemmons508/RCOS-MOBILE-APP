import { AIEmployee } from '../types';
import { AI_EMPLOYEES } from '../data/employees';

const STORAGE_KEY_CUSTOM_EMPLOYEES = 'rcos_custom_ai_employees';

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
  getEmployees(): CustomAIEmployee[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_EMPLOYEES);
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

    // Default initialization
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
  saveEmployees(employees: CustomAIEmployee[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_EMPLOYEES, JSON.stringify(employees));
    } catch (e) {
      console.error('[EmployeeService] Failed to save employees:', e);
    }
  }

  /**
   * Update a specific employee's job scope, rules, autonomy, or details
   */
  updateEmployee(id: string, updates: Partial<CustomAIEmployee>): CustomAIEmployee {
    const list = this.getEmployees();
    const index = list.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error(`AI Employee ${id} not found.`);
    }

    const updated: CustomAIEmployee = {
      ...list[index],
      ...updates
    };

    list[index] = updated;
    this.saveEmployees(list);
    return updated;
  }

  /**
   * Reset a specific employee to system factory defaults
   */
  resetEmployee(id: string): CustomAIEmployee {
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

    const list = this.getEmployees();
    const index = list.findIndex(e => e.id === id);
    if (index !== -1) {
      list[index] = resetEmp;
      this.saveEmployees(list);
    }
    return resetEmp;
  }

  /**
   * Add a brand new custom specialist to the AI employee fleet
   */
  addCustomEmployee(newEmp: Omit<CustomAIEmployee, 'id'>): CustomAIEmployee {
    const id = `custom_agent_${Date.now()}`;
    const employee: CustomAIEmployee = {
      ...newEmp,
      id,
      isCustom: true,
      avatarIcon: newEmp.avatarIcon || 'Bot',
      autonomyLevel: newEmp.autonomyLevel || 'supervised',
      maxApprovalAmount: newEmp.maxApprovalAmount || 1000
    };

    const list = this.getEmployees();
    list.push(employee);
    this.saveEmployees(list);
    return employee;
  }

  /**
   * Delete a custom employee (defaults cannot be deleted, only paused)
   */
  deleteCustomEmployee(id: string): boolean {
    const list = this.getEmployees();
    const target = list.find(e => e.id === id);
    if (!target || !target.isCustom) {
      return false;
    }

    const filtered = list.filter(e => e.id !== id);
    this.saveEmployees(filtered);
    return true;
  }
}

export const employeeCustomizationService = new EmployeeCustomizationService();
