/**
 * Push Notification Service
 * Handles push notifications for foreground, background, and when app is closed
 */

import { Platform } from 'react-native';
import { notificationSoundService } from './NotificationSoundService';

// expo-notifications was removed from Expo Go in SDK 53
// We'll skip push notifications and use NotificationSoundService for local sounds instead
let Notifications: any = null;

// Log once that we're using sounds only
if (!(global as any).__notificationsInfoShown) {
  console.log('ℹ️ Push notifications disabled in Expo Go (SDK 53+). Using local notification sounds only.');
  (global as any).__notificationsInfoShown = true;
}

function loadNotificationsModule() {
  // Return null - expo-notifications doesn't work in Expo Go SDK 53+
  return null;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private notificationListener: any = null;
  private responseListener: any = null;
  private expoPushToken: string | null = null;

  private constructor() {
    // Try to load notifications module if not already loaded
    if (!Notifications) {
      Notifications = loadNotificationsModule();
    }

    // Configure how notifications are handled when app is in foreground
    // Double-check that Notifications is available and has the method before calling
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
      } catch (error) {
        // Silently fail - local notifications will still work
      }
    }
    this.setupNotificationHandlers();
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Setup notification handlers
   */
  private setupNotificationHandlers() {
    // Try to load notifications module if not already loaded
    if (!Notifications) {
      Notifications = loadNotificationsModule();
    }

    // Double-check that Notifications is available and has required methods
    if (!Notifications || typeof Notifications.addNotificationReceivedListener !== 'function') {
      // Silently return - local notifications will still work via scheduleLocalNotification
      return;
    }

    try {
      // Handle notifications received while app is in foreground
      this.notificationListener = Notifications.addNotificationReceivedListener((notification: any) => {
        console.log('📬 Notification received (foreground):', notification);
        
        // Play sound based on notification type
        const notificationType = notification.request.content.data?.type || 'general';
        const status = notification.request.content.data?.status;
        
        notificationSoundService.playNotificationSound(notificationType, status);
      });

      // Handle notification taps
      this.responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
        console.log('👆 Notification tapped:', response);
        // Handle navigation based on notification data
        const data = response.notification.request.content.data;
        // You can add navigation logic here
      });
    } catch (error) {
      console.error('Error setting up notification handlers:', error);
    }
  }

  /**
   * Register for push notifications
   */
  public async registerForPushNotifications(): Promise<string | null> {
    // Try to load notifications module if not already loaded
    if (!Notifications) {
      Notifications = loadNotificationsModule();
    }

    // Double-check that Notifications is available and has required methods
    if (!Notifications || typeof Notifications.getPermissionsAsync !== 'function') {
      // Silently return - local notifications will still work
      return null;
    }

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ Push notification permission not granted');
        return null;
      }

      // Get Expo push token
      // Note: For push notifications to work, we need a projectId
      // In development, we'll skip push token registration but still enable local notifications
      let tokenData;
      try {
        // Try to get projectId from Constants or environment
        const Constants = require('expo-constants').default;
        const projectId = 
          process.env.EXPO_PUBLIC_PROJECT_ID || 
          Constants?.expoConfig?.extra?.eas?.projectId ||
          Constants?.expoConfig?.extra?.projectId;

        if (projectId) {
          tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          });
        } else {
          // Try without projectId (might work in managed workflow)
          try {
            tokenData = await Notifications.getExpoPushTokenAsync();
          } catch (noProjectIdError: any) {
            // If projectId is required, skip push token registration
            // Local notifications will still work
            // Only log once to avoid spam
            if (!(global as any).__pushNotificationWarningShown) {
              console.log('ℹ️ Push notifications disabled (projectId not found). Local notifications with sounds are enabled.');
              (global as any).__pushNotificationWarningShown = true;
            }
            return null;
          }
        }
      } catch (tokenError: any) {
        // If projectId is invalid, skip push token registration
        if (tokenError?.message?.includes('projectId') || tokenError?.message?.includes('uuid') || tokenError?.message?.includes('No "projectId"')) {
          // Only log once to avoid spam
          if (!(global as any).__pushNotificationWarningShown) {
            console.log('ℹ️ Push notifications disabled (projectId not found). Local notifications with sounds are enabled.');
            (global as any).__pushNotificationWarningShown = true;
          }
          return null;
        } else {
          throw tokenError;
        }
      }

      this.expoPushToken = tokenData.data;
      console.log('✅ Expo push token:', this.expoPushToken);

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('❌ Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Schedule a local notification
   */
  public async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    sound: boolean = true
  ) {
    // Try to load notifications module if not already loaded
    if (!Notifications) {
      Notifications = loadNotificationsModule();
    }

    // Double-check that Notifications is available and has required methods
    if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
      // Silently return - sound notifications will still work via NotificationSoundService
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: sound,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  public async cancelAllNotifications() {
    if (!Notifications || typeof Notifications.cancelAllScheduledNotificationsAsync !== 'function') {
      return;
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get Expo push token
   */
  public getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Cleanup listeners
   */
  public cleanup() {
    if (!Notifications || typeof Notifications.removeNotificationSubscription !== 'function') {
      return;
    }
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
}

// Export singleton instance - lazy initialization happens on first access
let _instance: PushNotificationService | null = null;

export const pushNotificationService = {
  registerForPushNotifications: async () => {
    if (!_instance) _instance = PushNotificationService.getInstance();
    return _instance.registerForPushNotifications();
  },
  scheduleLocalNotification: async (title: string, body: string, data?: any, sound: boolean = true) => {
    if (!_instance) _instance = PushNotificationService.getInstance();
    return _instance.scheduleLocalNotification(title, body, data, sound);
  },
  cancelAllNotifications: async () => {
    if (!_instance) _instance = PushNotificationService.getInstance();
    return _instance.cancelAllNotifications();
  },
  getExpoPushToken: () => {
    if (!_instance) _instance = PushNotificationService.getInstance();
    return _instance.getExpoPushToken();
  },
  cleanup: () => {
    if (!_instance) _instance = PushNotificationService.getInstance();
    return _instance.cleanup();
  },
};
