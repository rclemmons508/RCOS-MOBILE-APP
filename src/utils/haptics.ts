import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Mobile Haptic Feedback utility for tactile responsiveness across RCOS.
 * Gracefully falls back to browser navigator.vibrate or silent no-op on non-mobile platforms.
 */
class HapticsService {
  private isAvailable: boolean = true;

  constructor() {
    // Check if running in browser or mobile
    if (typeof window === 'undefined') {
      this.isAvailable = false;
    }
  }

  /**
   * Light tactile tap - ideal for buttons, tab selection, card clicks
   */
  async light(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      this.fallbackVibrate(15);
    }
  }

  /**
   * Medium tactile click - for status toggles, job assignments, form submits
   */
  async medium(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      this.fallbackVibrate(30);
    }
  }

  /**
   * Heavy tactile thump - for critical actions, emergency calls, dispatch triggers
   */
  async heavy(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      this.fallbackVibrate(60);
    }
  }

  /**
   * Success notification vibration pattern - for login success, job completion
   */
  async success(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      this.fallbackVibrate([20, 50, 40]);
    }
  }

  /**
   * Warning notification vibration pattern - for emergency jobs, high priority alerts
   */
  async warning(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {
      this.fallbackVibrate([40, 60, 40]);
    }
  }

  /**
   * Error notification vibration pattern
   */
  async error(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      this.fallbackVibrate([50, 100, 50, 100, 50]);
    }
  }

  /**
   * Selection tick for rotary or list scrolling
   */
  async selection(): Promise<void> {
    try {
      await Haptics.selectionChanged();
    } catch {
      this.fallbackVibrate(10);
    }
  }

  private fallbackVibrate(pattern: number | number[]): void {
    try {
      if (typeof window !== 'undefined' && 'navigator' in window && window.navigator.vibrate) {
        window.navigator.vibrate(pattern);
      }
    } catch {
      // Ignore if vibration is blocked or unsupported
    }
  }
}

export const haptic = new HapticsService();
export default haptic;
