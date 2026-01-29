import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { socketService } from '@/lib/SocketService';
import { notificationSoundService } from '@/lib/NotificationSoundService';
import { pushNotificationService } from '@/lib/PushNotificationService';
import { getApiUrl } from '@/lib/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Notification {
  _id?: string;
  id: string;
  title: string;
  message: string;
  time?: string;
  timestamp?: number;
  createdAt?: string;
  type: 'job' | 'message' | 'payment' | 'system' | 'booking' | 'general';
  read?: boolean;
  isRead?: boolean;
  bookingId?: string;
  data?: any;
}

const NOTIFICATIONS_STORAGE_KEY = '@worker_notifications';

export default function NotificationsScreen() {
  const { worker } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Load notifications from backend API and local storage
  const loadNotifications = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      
      // First, try to load from backend API
      if (worker?.id) {
        try {
          const apiUrl = getApiUrl();
          const response = await fetch(`${apiUrl}/api/notifications/user/${worker.id}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const backendNotifications = await response.json();
            console.log('✅ Fetched notifications from backend:', backendNotifications.length);
            
            // Convert backend notifications to local format
            const convertedNotifications: Notification[] = backendNotifications.map((n: any) => ({
              _id: n._id,
              id: n._id || `backend_${n._id}`,
              title: n.title || 'Notification',
              message: n.message || '',
              timestamp: n.createdAt ? new Date(n.createdAt).getTime() : Date.now(),
              createdAt: n.createdAt,
              type: n.type || 'general',
              read: n.isRead || false,
              isRead: n.isRead || false,
              bookingId: n.data?.bookingId,
              data: n.data,
            }));

            // Merge with local notifications (from socket events)
            const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
            let localNotifications: Notification[] = [];
            if (stored) {
              const parsed = JSON.parse(stored);
              localNotifications = parsed.filter((n: Notification) => {
                // Only keep local notifications that don't exist in backend
                return !convertedNotifications.some((bn: Notification) => bn.id === n.id || bn._id === n.id);
              });
            }

            // Combine and sort by timestamp
            const allNotifications = [...convertedNotifications, ...localNotifications]
              .sort((a, b) => {
                const timeA = a.timestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const timeB = b.timestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return timeB - timeA;
              });

            setNotifications(allNotifications);
            // Save to storage immediately
            await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(allNotifications));
            console.log('✅ Notifications loaded and saved to storage:', allNotifications.length);
            return;
          }
        } catch (apiError) {
          console.error('Error fetching from API, falling back to local storage:', apiError);
        }
      }

      // Fallback to local storage if API fails
      const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Filter out notifications older than 30 days
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const valid = parsed.filter((n: Notification) => {
          const timestamp = n.timestamp || (n.createdAt ? new Date(n.createdAt).getTime() : 0);
          return timestamp > thirtyDaysAgo;
        });
        setNotifications(valid);
        // Save filtered list back
        if (valid.length !== parsed.length) {
          await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(valid));
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save notifications to storage
  const saveNotifications = async (newNotifications: Notification[]) => {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(newNotifications));
      console.log('💾 Notifications saved to storage:', newNotifications.length);
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  };

  // Add a new notification (from socket events)
  const addNotification = async (notification: Notification) => {
    setNotifications((prev) => {
      // Check if notification already exists (by id or _id)
      const exists = prev.some((n) => 
        n.id === notification.id || 
        n._id === notification._id || 
        (notification._id && n._id === notification._id) ||
        (notification.id && n.id === notification.id)
      );
      if (exists) {
        console.log('⚠️ Notification already exists, skipping:', notification.id || notification._id);
        return prev;
      }
      const updated = [notification, ...prev];
      // Save to storage asynchronously
      saveNotifications(updated);
      const newUnreadCount = updated.filter((n) => !(n.read || n.isRead)).length;
      console.log('📊 New notification added, unread count:', newUnreadCount);
      return updated;
    });
  };

  useEffect(() => {
    loadNotifications();

    if (worker?.id) {
      // Connect to socket
      socketService.connect(worker.id, 'worker');

      // Listen for work completed event
      const handleWorkCompleted = (data: any) => {
        console.log('✅ Work completed notification received:', data);
        if (data.bookingId && data.workerId === worker.id) {
          const notification: Notification = {
            id: `work_completed_${data.bookingId}_${Date.now()}`,
            title: 'Job Completed',
            message: `You have successfully completed the job. Great work!`,
            time: 'Just now',
            timestamp: Date.now(),
            type: 'job',
            read: false,
            bookingId: data.bookingId,
          };
          addNotification(notification);
          
          // Play sound and send push notification
          notificationSoundService.playNotificationSound('job', 'completed');
          pushNotificationService.scheduleLocalNotification(
            notification.title,
            notification.message,
            { type: 'job', status: 'completed', bookingId: data.bookingId },
            true
          );
        }
      };

      // Listen for work started event
      const handleWorkStarted = (data: any) => {
        console.log('🔨 Work started notification received:', data);
        if (data.bookingId && data.workerId === worker.id) {
          const notification: Notification = {
            id: `work_started_${data.bookingId}_${Date.now()}`,
            title: 'Work Started',
            message: `You have started working on the job. Timer is running.`,
            time: 'Just now',
            timestamp: Date.now(),
            type: 'job',
            read: false,
            bookingId: data.bookingId,
          };
          addNotification(notification);
          
          // Play sound and send push notification
          notificationSoundService.playNotificationSound('job', 'started');
          pushNotificationService.scheduleLocalNotification(
            notification.title,
            notification.message,
            { type: 'job', status: 'started', bookingId: data.bookingId },
            true
          );
        }
      };

      // Listen for booking accepted event
      const handleBookingAccepted = (data: any) => {
        console.log('✅ Booking accepted notification received:', data);
        if (data.booking?.workerId === worker.id || data.workerId === worker.id) {
          const serviceName = data.booking?.serviceName || data.serviceName || 'Service';
          const notification: Notification = {
            id: `booking_accepted_${data.bookingId || data.booking?._id}_${Date.now()}`,
            title: 'Booking Accepted',
            message: `You have accepted a ${serviceName} booking. Navigate to the location to start.`,
            time: 'Just now',
            timestamp: Date.now(),
            type: 'job',
            read: false,
            bookingId: data.bookingId || data.booking?._id,
          };
          addNotification(notification);
          
          // Play sound and send push notification
          notificationSoundService.playNotificationSound('job', 'accepted');
          pushNotificationService.scheduleLocalNotification(
            notification.title,
            notification.message,
            { type: 'job', status: 'accepted', bookingId: data.bookingId || data.booking?._id },
            true
          );
        }
      };

      // Listen for booking updates
      const handleBookingUpdated = (booking: any) => {
        console.log('📋 Booking updated notification received:', booking);
        if (booking.workerId === worker.id && booking.status === 'completed') {
          const notification: Notification = {
            id: `booking_completed_${booking._id}_${Date.now()}`,
            title: 'Job Completed',
            message: `Your ${booking.serviceName || 'job'} has been marked as completed.`,
            time: 'Just now',
            timestamp: Date.now(),
            type: 'job',
            read: false,
            bookingId: booking._id,
          };
          addNotification(notification);
          
          // Play sound and send push notification
          notificationSoundService.playNotificationSound('job', 'completed');
          pushNotificationService.scheduleLocalNotification(
            notification.title,
            notification.message,
            { type: 'job', status: 'completed', bookingId: booking._id },
            true
          );
        }
      };

      // Listen for document verification updates
      const handleVerificationUpdate = (data: any) => {
        console.log('📢 Document verification update received in notifications:', data);
        if (data.workerId === worker.id) {
          let notificationTitle = 'Verification Update';
          let notificationMessage = '';
          
          if (data.status === 'rejected') {
            notificationTitle = 'Verification Rejected';
            notificationMessage = `Your ${data.documentType || 'document'} verification was rejected. Please resubmit.`;
          } else if (data.status === 'verified') {
            if (data.overallStatus === 'verified') {
              notificationTitle = 'Verification Complete';
              notificationMessage = 'All your documents are verified. You are ready to work!';
            } else {
              notificationTitle = 'Document Verified';
              notificationMessage = `Your ${data.documentType || 'document'} has been verified.`;
            }
          }
          
          if (notificationMessage) {
            const notification: Notification = {
              id: `verification_${data.documentType}_${Date.now()}`,
              title: notificationTitle,
              message: notificationMessage,
              time: 'Just now',
              timestamp: Date.now(),
              type: 'system',
              read: false,
            };
            addNotification(notification);
            
            // Play sound and send push notification
            notificationSoundService.playNotificationSound('document_verification', data.status);
            pushNotificationService.scheduleLocalNotification(
              notificationTitle,
              notificationMessage,
              { type: 'document_verification', status: data.status, documentType: data.documentType },
              true
            );
          }
        }
      };

      // Listen for category verification updates
      const handleCategoryVerificationUpdate = (data: any) => {
        console.log('📢 Category verification update received:', data);
        if (data.workerId === worker.id) {
          let notificationTitle = 'Service Verification Update';
          let notificationMessage = '';
          
          if (data.status === 'verified') {
            notificationTitle = 'Service Verified';
            notificationMessage = `Your ${data.category || 'service'} has been verified. You can now receive requests for this service.`;
          } else if (data.status === 'rejected') {
            notificationTitle = 'Service Verification Rejected';
            notificationMessage = `Your ${data.category || 'service'} verification was rejected. Please resubmit documents.`;
          }
          
          if (notificationMessage) {
            const notification: Notification = {
              id: `category_verification_${data.category}_${Date.now()}`,
              title: notificationTitle,
              message: notificationMessage,
              time: 'Just now',
              timestamp: Date.now(),
              type: 'system',
              read: false,
            };
            addNotification(notification);
            
            // Play sound and send push notification
            notificationSoundService.playNotificationSound('category_verification_submitted', data.status);
            pushNotificationService.scheduleLocalNotification(
              notificationTitle,
              notificationMessage,
              { type: 'category_verification_submitted', status: data.status, category: data.category },
              true
            );
          }
        }
      };

      // Listen for backend notifications
      const handleBackendNotification = (data: any) => {
        console.log('📬 Backend notification received:', data);
        if (data.userId === worker.id || data.userId === String(worker.id)) {
          const notification: Notification = {
            _id: data._id,
            id: data._id || `backend_${data._id}`,
            title: data.title || 'Notification',
            message: data.message || '',
            timestamp: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
            createdAt: data.createdAt,
            type: data.type || 'general',
            read: data.isRead || false,
            isRead: data.isRead || false,
            bookingId: data.data?.bookingId,
            data: data.data,
          };
          addNotification(notification);
          
          // Play sound and send push notification
          notificationSoundService.playNotificationSound(notification.type, 'new', worker.id);
          pushNotificationService.scheduleLocalNotification(
            notification.title,
            notification.message,
            { type: notification.type, ...notification.data },
            true,
            worker.id
          );
          
          // Reload notifications from backend to ensure sync
          setTimeout(() => {
            loadNotifications(true);
          }, 500);
        }
      };

      // Listen for notification deletion (from backend or other devices)
      const handleNotificationDeleted = (data: any) => {
        console.log('🗑️ Notification deleted event received:', data);
        if (data.notificationId) {
          setNotifications((prev) => {
            const updated = prev.filter((n) => n._id !== data.notificationId && n.id !== data.notificationId);
            // Save to storage immediately
            saveNotifications(updated);
            console.log('📊 Notification deleted, remaining count:', updated.length);
            console.log('📊 Unread count after deletion:', updated.filter((n) => !(n.read || n.isRead)).length);
            return updated;
          });
          
          // Reload from backend to ensure sync
          setTimeout(() => {
            loadNotifications(true);
          }, 300);
        }
      };
      
      // Listen for notification read events (from other screens or devices)
      const handleNotificationRead = (data: any) => {
        console.log('✅ Notification read event received:', data);
        if (data.notificationId) {
          // Only update if it's for this worker
          if (data.userId === worker.id || data.userId === String(worker.id) || !data.userId) {
            setNotifications((prev) => {
              const updated = prev.map((n) => 
                (n._id === data.notificationId || n.id === data.notificationId) 
                  ? { ...n, read: true, isRead: true } 
                  : n
              );
              // Save to storage immediately
              saveNotifications(updated);
              console.log('📊 Notification marked as read, unread count:', updated.filter((n) => !(n.read || n.isRead)).length);
              return updated;
            });
            
            // Reload from backend to ensure sync
            setTimeout(() => {
              loadNotifications(true);
            }, 300);
          }
        }
      };

      // Listen for all notifications cleared (from backend or other devices)
      const handleNotificationsCleared = (data: any) => {
        console.log('🗑️ All notifications cleared event received:', data);
        if (data.userId === worker.id || data.userId === String(worker.id)) {
          setNotifications([]);
          // Clear storage immediately
          AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY).catch(err => 
            console.error('Error clearing storage:', err)
          );
          console.log('📊 All notifications cleared, unread count: 0');
          
          // Reload from backend to ensure sync
          setTimeout(() => {
            loadNotifications(true);
          }, 300);
        }
      };
      
      // Listen for all notifications marked as read (from backend or other devices)
      const handleAllNotificationsRead = (data: any) => {
        console.log('✅ All notifications read event received:', data);
        if (data.userId === worker.id || String(data.userId) === String(worker.id)) {
          // Mark all as read in local state
          setNotifications((prev) => {
            const updated = prev.map((n) => ({ ...n, read: true, isRead: true }));
            // Save to storage immediately
            saveNotifications(updated);
            console.log('📊 All notifications marked as read, unread count: 0');
            return updated;
          });
          
          // Reload from backend to ensure sync
          setTimeout(() => {
            loadNotifications(true);
          }, 300);
        }
      };

      // Set up socket listeners
      socketService.on('work:completed', handleWorkCompleted);
      socketService.on('work:started', handleWorkStarted);
      socketService.on('booking:accepted', handleBookingAccepted);
      socketService.on('booking:updated', handleBookingUpdated);
      socketService.on('document:verification:updated', handleVerificationUpdate);
      socketService.on('category:verification:submitted', handleCategoryVerificationUpdate);
      socketService.on('notification:new', handleBackendNotification);
      socketService.on('notification:deleted', handleNotificationDeleted);
      socketService.on('notification:read', handleNotificationRead);
      socketService.on('notifications:cleared', handleNotificationsCleared);
      socketService.on('notifications:all-read', handleAllNotificationsRead);

      // Register for push notifications
      pushNotificationService.registerForPushNotifications().then((token) => {
        if (token) {
          console.log('✅ Push notifications registered for worker app:', token);
        }
      });

      return () => {
        socketService.off('work:completed', handleWorkCompleted);
        socketService.off('work:started', handleWorkStarted);
        socketService.off('booking:accepted', handleBookingAccepted);
        socketService.off('booking:updated', handleBookingUpdated);
        socketService.off('document:verification:updated', handleVerificationUpdate);
        socketService.off('category:verification:submitted', handleCategoryVerificationUpdate);
        socketService.off('notification:new', handleBackendNotification);
        socketService.off('notification:deleted', handleNotificationDeleted);
        socketService.off('notification:read', handleNotificationRead);
        socketService.off('notifications:cleared', handleNotificationsCleared);
        socketService.off('notifications:all-read', handleAllNotificationsRead);
      };
    }
  }, [worker?.id]);

  const formatTimeAgo = (notification: Notification): string => {
    const timestamp = notification.timestamp || (notification.createdAt ? new Date(notification.createdAt).getTime() : Date.now());
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Calculate unread count in real-time from notifications array
  const unreadCount = notifications.filter((n) => !(n.read || n.isRead)).length;

  // Fetch unread count from backend
  const fetchUnreadCount = async (): Promise<number> => {
    if (!worker?.id) return 0;
    const apiUrl = getApiUrl();
    if (!apiUrl || typeof apiUrl !== 'string' || apiUrl.trim() === '') return 0;
    try {
      const response = await fetch(`${apiUrl}/api/notifications/user/${worker.id}/unread-count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.count || 0;
      }
    } catch {
      // Network/backend unreachable: return 0 without surfacing error
    }
    return 0;
  };

  // Update unread count when notifications change and sync with backend
  useEffect(() => {
    if (worker?.id) {
      // Sync with backend count periodically
      const syncCount = async () => {
        const backendCount = await fetchUnreadCount();
        const localCount = notifications.filter((n) => !(n.read || n.isRead)).length;
        
        // Use the higher count (backend might have more recent data)
        if (backendCount !== localCount) {
          console.log('📊 Unread count sync mismatch:', { backendCount, localCount });
          // If backend has different count, reload notifications to sync
          if (Math.abs(backendCount - localCount) > 0) {
            console.log('🔄 Reloading notifications to sync with backend...');
            loadNotifications(true);
          }
        }
      };
      
      // Sync every 15 seconds to ensure data consistency
      const interval = setInterval(syncCount, 15000);
      return () => clearInterval(interval);
    }
  }, [notifications, worker?.id]);

  const markAsRead = async (id: string) => {
    try {
      // If notification has _id, it's from backend - mark as read in backend
      const notification = notifications.find((n) => n.id === id || n._id === id);
      if (notification?._id && worker?.id) {
        try {
          const apiUrl = getApiUrl();
          const response = await fetch(`${apiUrl}/api/notifications/${notification._id}/read`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            console.log('✅ Notification marked as read in backend:', notification._id);
            // Emit socket event to notify other screens/devices
            socketService.emit('notification:read', { notificationId: notification._id, userId: worker.id });
          }
        } catch (apiError) {
          console.error('Error marking as read in backend:', apiError);
          // Continue with local update even if API fails
        }
      }

      // Update local state immediately for instant UI feedback
      const updated = notifications.map((n) => 
        (n.id === id || n._id === id) ? { ...n, read: true, isRead: true } : n
      );
      setNotifications(updated);
      await saveNotifications(updated);
      
      console.log('📊 Unread count updated:', updated.filter((n) => !(n.read || n.isRead)).length);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // Mark all as read in backend if worker is logged in
      if (worker?.id) {
        try {
          const apiUrl = getApiUrl();
          const response = await fetch(`${apiUrl}/api/notifications/user/${worker.id}/mark-all-read`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            console.log('✅ All notifications marked as read in backend');
            // Emit socket event to notify other screens/devices
            socketService.emit('notifications:all-read', { userId: worker.id });
          }
        } catch (apiError) {
          console.error('Error marking all as read in backend:', apiError);
          // Continue with local update even if API fails
        }
      }

      // Update local state immediately for instant UI feedback
      const updated = notifications.map((n) => ({ ...n, read: true, isRead: true }));
      setNotifications(updated);
      await saveNotifications(updated);
      
      console.log('📊 All notifications marked as read, unread count: 0');
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      // If notification has _id, it's from backend - delete from backend
      const notification = notifications.find((n) => n.id === id || n._id === id);
      if (notification?._id && worker?.id) {
        try {
          const apiUrl = getApiUrl();
          const response = await fetch(`${apiUrl}/api/notifications/${notification._id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            console.log('✅ Notification deleted from backend:', notification._id);
            // Emit socket event to notify other screens/devices
            socketService.emit('notification:deleted', { notificationId: notification._id });
          } else {
            console.warn('⚠️ Failed to delete from backend, deleting locally only');
          }
        } catch (apiError) {
          console.error('Error deleting from backend:', apiError);
          // Continue with local deletion even if API fails
        }
      }

      // Remove from local state and storage immediately for instant UI feedback
      const updated = notifications.filter((n) => n.id !== id && n._id !== id);
      setNotifications(updated);
      await saveNotifications(updated);
      
      console.log('📊 Notification deleted, remaining count:', updated.length);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const clearAllNotifications = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all from backend if worker is logged in
              if (worker?.id) {
                try {
                  const apiUrl = getApiUrl();
                  const response = await fetch(`${apiUrl}/api/notifications/user/${worker.id}/all`, {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  });

                  if (response.ok) {
                    console.log('✅ All notifications deleted from backend');
                    // Emit socket event to notify other screens/devices
                    socketService.emit('notifications:cleared', { userId: worker.id });
                  } else {
                    console.warn('⚠️ Failed to delete from backend, clearing locally only');
                  }
                } catch (apiError) {
                  console.error('Error clearing from backend:', apiError);
                  // Continue with local clearing even if API fails
                }
              }

              // Clear local state and storage immediately for instant UI feedback
              setNotifications([]);
              await AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
              console.log('✅ All notifications cleared');
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Error', 'Failed to clear notifications. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'job':
        return 'briefcase';
      case 'message':
        return 'chatbubble';
      case 'payment':
        return 'cash';
      case 'system':
        return 'information-circle';
      default:
        return 'notifications';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'job':
        return '#4A90E2';
      case 'message':
        return '#7ED321';
      case 'payment':
        return '#50E3C2';
      case 'system':
        return '#FF7A2C';
      default:
        return '#666';
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id || notification._id || '');
    if (notification.bookingId || notification.data?.bookingId) {
      router.push({
        pathname: '/job-navigation',
        params: { bookingId: notification.bookingId || notification.data?.bookingId },
      });
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            // Use replace instead of back to avoid GO_BACK error
            // This ensures we always have a valid navigation target
            router.replace('/(tabs)');
          }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerActions}>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={clearAllNotifications} style={styles.clearAllButton}>
                <Ionicons name="trash-outline" size={22} color="#fff" />
              </TouchableOpacity>
            )}
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
                <Text style={styles.markAllText}>Mark all</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => loadNotifications(true)} />
          }
        >
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySubtitle}>You're all caught up!</Text>
            </View>
          ) : (
            <>
              {/* Unread Notifications */}
              {notifications.filter((n) => !(n.read || n.isRead)).length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>New</Text>
                  {notifications
                    .filter((n) => !(n.read || n.isRead))
                    .map((notification) => (
                      <TouchableOpacity
                        key={notification.id || notification._id}
                        style={[styles.notificationItem, styles.unreadItem]}
                        onPress={() => handleNotificationPress(notification)}
                      >
                        <View
                          style={[
                            styles.iconContainer,
                            { backgroundColor: getIconColor(notification.type) + '20' },
                          ]}
                        >
                          <Ionicons
                            name={getIcon(notification.type) as any}
                            size={24}
                            color={getIconColor(notification.type)}
                          />
                        </View>
                        <View style={styles.notificationContent}>
                          <View style={styles.notificationHeader}>
                            <Text style={styles.notificationTitle}>{notification.title}</Text>
                            <View style={styles.unreadDot} />
                          </View>
                          <Text style={styles.notificationMessage} numberOfLines={2}>
                            {notification.message}
                          </Text>
                          <Text style={styles.notificationTime}>
                            {formatTimeAgo(notification)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => deleteNotification(notification.id || notification._id || '')}
                          style={styles.deleteButton}
                        >
                          <Ionicons name="close" size={20} color="#999" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                </View>
              )}

              {/* Read Notifications */}
              {notifications.filter((n) => n.read || n.isRead).length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Earlier</Text>
                  {notifications
                    .filter((n) => n.read || n.isRead)
                    .map((notification) => (
                      <TouchableOpacity
                        key={notification.id || notification._id}
                        style={styles.notificationItem}
                        onPress={() => handleNotificationPress(notification)}
                      >
                        <View
                          style={[
                            styles.iconContainer,
                            { backgroundColor: getIconColor(notification.type) + '20' },
                          ]}
                        >
                          <Ionicons
                            name={getIcon(notification.type) as any}
                            size={24}
                            color={getIconColor(notification.type)}
                          />
                        </View>
                        <View style={styles.notificationContent}>
                          <Text style={[styles.notificationTitle, styles.readTitle]}>
                            {notification.title}
                          </Text>
                          <Text style={[styles.notificationMessage, styles.readMessage]} numberOfLines={2}>
                            {notification.message}
                          </Text>
                          <Text style={styles.notificationTime}>
                            {formatTimeAgo(notification)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => deleteNotification(notification.id || notification._id || '')}
                          style={styles.deleteButton}
                        >
                          <Ionicons name="close" size={20} color="#999" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safe: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FF7A2C',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearAllButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  markAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  section: {
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  unreadItem: {
    backgroundColor: '#FFF9F5',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  readTitle: {
    color: '#666',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF7A2C',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  readMessage: {
    color: '#999',
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
