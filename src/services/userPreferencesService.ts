import { UserPreferences, NotificationPreferences, TabType } from '../types';
import { INITIAL_NOTIFICATION_PREFERENCES } from '../data/mockData';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  industryProfile: 'Commercial HVAC',
  telemetryIntervalMs: 3500,
  autoDispatchThreshold: 'all',
  ringerMode: 'sound',
  soundEnabled: true,
  vibrationEnabled: true,
  biometricsEnabled: true,
  autoLockOnBackground: true,
  autoLockTimeoutMinutes: 5,
  defaultTab: 'dashboard',
  theme: 'dark',
  notificationPreferences: INITIAL_NOTIFICATION_PREFERENCES
};

class UserPreferencesService {
  private getStorageKey(userIdentifier: string): string {
    const cleanKey = (userIdentifier || 'default').toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `rcos_user_prefs_${cleanKey}`;
  }

  /**
   * Get user preferences by email or user ID
   */
  getUserPreferences(userIdentifier?: string): UserPreferences {
    if (!userIdentifier) return { ...DEFAULT_USER_PREFERENCES };

    try {
      const key = this.getStorageKey(userIdentifier);
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_USER_PREFERENCES,
          ...parsed,
          notificationPreferences: parsed.notificationPreferences
            ? { ...INITIAL_NOTIFICATION_PREFERENCES, ...parsed.notificationPreferences }
            : INITIAL_NOTIFICATION_PREFERENCES
        };
      }
    } catch (e) {
      console.warn('[Preferences] Error reading preferences from localStorage:', e);
    }

    return { ...DEFAULT_USER_PREFERENCES };
  }

  /**
   * Save user preferences by email or user ID
   */
  saveUserPreferences(userIdentifier: string, updates: Partial<UserPreferences>): UserPreferences {
    if (!userIdentifier) return { ...DEFAULT_USER_PREFERENCES, ...updates };

    const current = this.getUserPreferences(userIdentifier);
    const updated: UserPreferences = {
      ...current,
      ...updates,
      notificationPreferences: updates.notificationPreferences
        ? { ...current.notificationPreferences, ...updates.notificationPreferences }
        : current.notificationPreferences
    };

    try {
      const key = this.getStorageKey(userIdentifier);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('[Preferences] Error saving preferences to localStorage:', e);
    }

    return updated;
  }
}

export const userPreferencesService = new UserPreferencesService();
