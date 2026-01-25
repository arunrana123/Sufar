/**
 * Settings Service
 * Manages worker app settings and provides access to settings from anywhere in the app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WorkerSettings {
  notificationsEnabled: boolean;
  bookingNotifications: boolean;
  messageNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  locationTracking: boolean;
  promotionalEmails: boolean;
  autoAccept: boolean;
  showOnlineStatus: boolean;
  language: string;
  theme: string;
}

class SettingsService {
  private static instance: SettingsService;
  private settingsCache: { [workerId: string]: WorkerSettings } = {};

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Load settings for a worker
   */
  async loadSettings(workerId: string): Promise<WorkerSettings | null> {
    try {
      // Check cache first
      if (this.settingsCache[workerId]) {
        return this.settingsCache[workerId];
      }

      const settingsJson = await AsyncStorage.getItem(`worker_settings_${workerId}`);
      if (settingsJson) {
        const settings = JSON.parse(settingsJson) as WorkerSettings;
        this.settingsCache[workerId] = settings;
        return settings;
      }

      // Return default settings
      const defaultSettings: WorkerSettings = {
        notificationsEnabled: true,
        bookingNotifications: true,
        messageNotifications: true,
        soundEnabled: true,
        vibrationEnabled: true,
        locationTracking: true,
        promotionalEmails: false,
        autoAccept: false,
        showOnlineStatus: true,
        language: 'English',
        theme: 'Light',
      };
      
      this.settingsCache[workerId] = defaultSettings;
      return defaultSettings;
    } catch (error) {
      console.error('Error loading settings:', error);
      return null;
    }
  }

  /**
   * Get a specific setting value
   */
  async getSetting<T extends keyof WorkerSettings>(
    workerId: string,
    key: T
  ): Promise<WorkerSettings[T] | null> {
    const settings = await this.loadSettings(workerId);
    return settings ? settings[key] : null;
  }

  /**
   * Check if notifications are enabled
   */
  async shouldShowNotification(workerId: string, type: 'booking' | 'message' | 'general'): Promise<boolean> {
    const settings = await this.loadSettings(workerId);
    if (!settings) return true; // Default to enabled

    if (!settings.notificationsEnabled) {
      return false;
    }

    if (type === 'booking' && !settings.bookingNotifications) {
      return false;
    }

    if (type === 'message' && !settings.messageNotifications) {
      return false;
    }

    return true;
  }

  /**
   * Check if sound should play
   */
  async shouldPlaySound(workerId: string): Promise<boolean> {
    const settings = await this.loadSettings(workerId);
    return settings ? settings.soundEnabled : true;
  }

  /**
   * Check if vibration should occur
   */
  async shouldVibrate(workerId: string): Promise<boolean> {
    const settings = await this.loadSettings(workerId);
    return settings ? settings.vibrationEnabled : true;
  }

  /**
   * Check if auto-accept is enabled
   */
  async isAutoAcceptEnabled(workerId: string): Promise<boolean> {
    const settings = await this.loadSettings(workerId);
    return settings ? settings.autoAccept : false;
  }

  /**
   * Clear settings cache (call when settings are updated)
   */
  clearCache(workerId?: string): void {
    if (workerId) {
      delete this.settingsCache[workerId];
    } else {
      this.settingsCache = {};
    }
  }
}

export const settingsService = SettingsService.getInstance();
