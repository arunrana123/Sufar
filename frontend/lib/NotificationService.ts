import AsyncStorage from '@react-native-async-storage/async-storage';
import { socketService } from './SocketService';
import { getApiUrl } from './config';

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'general' | 'service' | 'booking';
  isRead: boolean;
  createdAt: string;
  userId: string;
}

class NotificationService {
  private static instance: NotificationService;
  private cache: Notification[] = [];
  private lastFetchTime: number = 0;
  private cacheExpiry: number = 30000; // 30 seconds
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private unreadCount: number = 0;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Get API base URL
  private getBaseUrl(): string {
    return getApiUrl();
  }

  // Load notifications from cache first, then fetch from API
  async getNotifications(userId: string, forceRefresh: boolean = false): Promise<Notification[]> {
    const now = Date.now();
    
    // Return cached data if still valid and not forcing refresh
    if (!forceRefresh && this.cache.length > 0 && (now - this.lastFetchTime) < this.cacheExpiry) {
      this.notifyListeners();
      return this.cache;
    }

    try {
      // Try to load from local storage first for instant display
      const cachedData = await this.loadFromCache(userId);
      if (cachedData.length > 0 && !forceRefresh) {
        this.cache = cachedData;
        this.notifyListeners();
      }

      // Fetch fresh data from API
      const response = await fetch(`${this.getBaseUrl()}/api/notifications/user/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const notifications = await response.json();
      
      // Update cache
      this.cache = notifications;
      this.lastFetchTime = now;
      
      // Save to local storage
      await this.saveToCache(userId, notifications);
      
      // Update unread count
      this.unreadCount = notifications.filter((n: Notification) => !n.isRead).length;
      
      this.notifyListeners();
      return notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      
      // Return cached data if API fails
      if (this.cache.length > 0) {
        return this.cache;
      }
      
      // Return empty array if no cache
      return [];
    }
  }

  // Get unread count quickly
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/notifications/user/${userId}/unread-count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.unreadCount = data.count;
        return data.count;
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
    
    return this.unreadCount;
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Update local cache
        this.cache = this.cache.map(n => 
          n._id === notificationId ? { ...n, isRead: true } : n
        );
        
        // Update unread count
        this.unreadCount = Math.max(0, this.unreadCount - 1);
        
        this.notifyListeners();
        return true;
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
    
    return false;
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      console.log('📝 Calling API to mark all notifications as read for user:', userId);
      const response = await fetch(`${this.getBaseUrl()}/api/notifications/user/${userId}/mark-all-read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📝 Mark all as read response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Mark all as read response:', data);
        
        // Update local cache
        this.cache = this.cache.map(n => ({ ...n, isRead: true }));
        this.unreadCount = 0;
        
        // Also update AsyncStorage cache
        await this.saveToCache(userId, this.cache);
        
        this.notifyListeners();
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to mark all as read:', response.status, errorData);
      }
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
    }
    
    return false;
  }

  // Cache management
  private async saveToCache(userId: string, notifications: Notification[]): Promise<void> {
    try {
      const cacheKey = `notifications_${userId}`;
      const cacheData = {
        notifications,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving notifications to cache:', error);
    }
  }

  private async loadFromCache(userId: string): Promise<Notification[]> {
    try {
      const cacheKey = `notifications_${userId}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const cacheAge = Date.now() - parsed.timestamp;
        
        // Return cached data if less than 5 minutes old
        if (cacheAge < 300000) {
          return parsed.notifications;
        }
      }
    } catch (error) {
      console.error('Error loading notifications from cache:', error);
    }
    
    return [];
  }

  // Real-time updates
  setupRealtimeUpdates(userId: string): void {
    socketService.connect(userId, 'user');
    
    socketService.on('notification:new', (notification: Notification) => {
      if (notification.userId === userId) {
        this.cache.unshift(notification);
        this.unreadCount++;
        this.notifyListeners();
      }
    });

    socketService.on('notification:read', (notificationId: string) => {
      this.cache = this.cache.map(n => 
        n._id === notificationId ? { ...n, isRead: true } : n
      );
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.notifyListeners();
    });
  }

  // Event listeners
  addListener(callback: (notifications: Notification[]) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (notifications: Notification[]) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.cache));
  }

  // Get current cache
  getCachedNotifications(): Notification[] {
    return this.cache;
  }

  getCachedUnreadCount(): number {
    return this.unreadCount;
  }

  // Delete a notification
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Check if deleted notification was unread before filtering
        const deletedNotification = this.cache.find(n => n._id === notificationId);
        const wasUnread = deletedNotification && !deletedNotification.isRead;
        
        // Update local cache
        this.cache = this.cache.filter(n => n._id !== notificationId);
        
        // Update unread count if it was unread
        if (wasUnread) {
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        }
        
        this.notifyListeners();
        return true;
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
    
    return false;
  }

  // Delete all notifications for a user
  async deleteAllNotifications(userId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/notifications/user/${userId}/all`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Clear local cache
        this.cache = [];
        this.unreadCount = 0;
        this.lastFetchTime = 0;
        
        this.notifyListeners();
        return true;
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
    
    return false;
  }

  // Clear cache
  clearCache(): void {
    this.cache = [];
    this.unreadCount = 0;
    this.lastFetchTime = 0;
  }
}

export const notificationService = NotificationService.getInstance();
