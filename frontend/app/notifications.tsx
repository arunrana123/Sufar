// NOTIFICATIONS SCREEN - Displays all user notifications with real-time updates
// Features: Mark as read, delete notifications, clear all, pull-to-refresh, Socket.IO real-time updates
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  SafeAreaView,
  RefreshControl,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { socketService } from '@/lib/SocketService';
import { notificationService } from '@/lib/NotificationService';
import { notificationSoundService } from '@/lib/NotificationSoundService';
import { pushNotificationService } from '@/lib/PushNotificationService';
import ToastNotification from '@/components/ToastNotification';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'general' | 'service' | 'booking' | 'payment' | 'worker' | 'system' | 'promotion' | 'document_verification' | 'verification_submitted' | 'verification_complete' | 'category_verification_submitted' | 'offer';
  isRead: boolean;
  createdAt: string;
  data?: any;
  imageUrl?: string;
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Toast notification state
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    title?: string;
    type?: 'success' | 'error' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
  });

  // Shows toast notification for 3 seconds
  // Triggered by: New notifications received via Socket.IO
  const showToast = (message: string, title?: string, type?: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ visible: true, message, title, type });
  };

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      const data = await notificationService.getNotifications(user.id);
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
    
    // Setup real-time updates
    if (user?.id) {
      socketService.connect(user.id, 'user');
      
      socketService.on('notification:new', (notification: Notification) => {
        console.log('📢 New notification received in notifications screen:', notification);
        
        // Play notification sound
        const status = notification.data?.status;
        notificationSoundService.playNotificationSound(notification.type, status);
        
        // Send push notification (works even when app is in background/closed)
        pushNotificationService.scheduleLocalNotification(
          notification.title || 'New Notification',
          notification.message,
          {
            type: notification.type,
            status: status,
            notificationId: notification._id,
            ...notification.data,
          },
          true // Play sound
        );
        
        // Check if notification already exists (avoid duplicates)
        setNotifications(prev => {
          const exists = prev.some(n => n._id === notification._id);
          if (exists) {
            console.log('⚠️ Notification already exists, skipping:', notification._id);
            return prev;
          }
          console.log('✅ Adding new notification to list:', notification.title);
          return [notification, ...prev];
        });
        setUnreadCount(prev => prev + 1);
        
        // Show toast notification based on type
        if (notification.type === 'booking') {
          if (notification.data?.status === 'cancelled') {
            showToast(notification.message, notification.title || 'Booking Cancelled', 'error');
          } else if (notification.data?.status === 'accepted') {
            showToast(notification.message, notification.title || 'Booking Accepted', 'success');
          } else if (notification.data?.status === 'completed') {
            showToast(notification.message, notification.title || 'Service Completed', 'success');
          } else if (notification.data?.status === 'in_progress') {
            showToast(notification.message, notification.title || 'Work Started', 'info');
          } else {
            showToast(notification.message, notification.title || 'New Booking Update', 'info');
          }
        } else if (notification.type === 'document_verification' || notification.type === 'verification_submitted' || notification.type === 'verification_complete') {
          if (notification.data?.status === 'verified' || notification.type === 'verification_complete') {
            showToast(notification.message, notification.title || 'Verification Complete', 'success');
          } else if (notification.data?.status === 'rejected') {
            showToast(notification.message, notification.title || 'Verification Rejected', 'error');
          } else {
            showToast(notification.message, notification.title || 'Verification Update', 'info');
          }
        } else if (notification.type === 'payment') {
          showToast(notification.message, notification.title || 'Payment Update', 'success');
        } else if (notification.type === 'promotion' || notification.type === 'service' || notification.type === 'offer') {
          showToast(notification.message, notification.title || 'Special Offer', 'info');
        } else {
          showToast(notification.message, notification.title || 'New Notification', 'info');
        }
        
        // Force refresh to ensure latest notifications are shown
        fetchNotifications(true);
      });
      
      socketService.on('notification:read', (notificationId: string) => {
        setNotifications(prev => 
          prev.map(n => 
            n._id === notificationId ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      });
      
      socketService.on('notification:deleted', (data: { notificationId: string }) => {
        console.log('📢 Notification deleted event received:', data);
        setNotifications(prev => prev.filter(n => n._id !== data.notificationId));
      });
      
      socketService.on('notifications:cleared', (data: { userId: string }) => {
        console.log('📢 All notifications cleared event received:', data);
        if (data.userId === user.id) {
          setNotifications([]);
          setUnreadCount(0);
        }
      });
    }
    
    return () => {
      socketService.off('notification:new');
      socketService.off('notification:read');
      socketService.off('notification:deleted');
      socketService.off('notifications:cleared');
    };
  }, [user?.id, fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(true);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => 
          n._id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    
    // Check if there are any unread notifications
    const hasUnread = notifications.some(n => !n.isRead);
    if (!hasUnread) {
      Alert.alert('Info', 'All notifications are already marked as read');
      return;
    }
    
    try {
      console.log('📝 Marking all notifications as read...');
      const success = await notificationService.markAllAsRead(user.id);
      if (success) {
        console.log('✅ All notifications marked as read successfully');
        // Update local state
        setNotifications(prev => 
          prev.map(n => ({ ...n, isRead: true }))
        );
        setUnreadCount(0);
        // Show success feedback (optional - you can remove if too intrusive)
        // Alert.alert('Success', 'All notifications marked as read');
      } else {
        Alert.alert('Error', 'Failed to mark all notifications as read');
      }
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read. Please try again.');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const success = await notificationService.deleteNotification(notificationId);
      if (success) {
        setNotifications(prev => {
          const deleted = prev.find(n => n._id === notificationId);
          const updated = prev.filter(n => n._id !== notificationId);
          // Update unread count if deleted notification was unread
          if (deleted && !deleted.isRead) {
            setUnreadCount(count => Math.max(0, count - 1));
          }
          return updated;
        });
      } else {
        Alert.alert('Error', 'Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const handleDeleteNotification = (notificationId: string, event: any) => {
    // Stop event propagation to prevent navigation
    event?.stopPropagation();
    
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNotification(notificationId),
        },
      ]
    );
  };

  const clearAllNotifications = async () => {
    if (!user?.id) return;
    
    if (notifications.length === 0) {
      return;
    }

    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await notificationService.deleteAllNotifications(user.id);
              if (success) {
                setNotifications([]);
                setUnreadCount(0);
              } else {
                Alert.alert('Error', 'Failed to clear all notifications');
              }
            } catch (error) {
              console.error('Error clearing all notifications:', error);
              Alert.alert('Error', 'Failed to clear all notifications');
            }
          },
        },
      ]
    );
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    // Navigate based on notification type and data
    switch (notification.type) {
      case 'booking':
        if (notification.data?.bookingId) {
          // Navigate to record screen to see cancelled bookings
          if (notification.data?.status === 'cancelled') {
            router.push(`/record`);
          } else if (notification.data?.status === 'accepted') {
            // Navigate to live tracking if booking is accepted
            router.push({
              pathname: '/live-tracking',
              params: { bookingId: notification.data.bookingId }
            });
          } else {
            // Navigate to my-bookings for other booking statuses
            router.push(`/my-bookings`);
          }
        } else {
          router.push(`/my-bookings`);
        }
        break;
      case 'service':
        if (notification.data?.bookingId) {
          router.push(`/my-bookings`);
        }
        break;
      default:
        // For system and promotion notifications, just mark as read
        break;
    }
  };

  const getNotificationIcon = (notification: Notification) => {
    // Check if it's a cancelled booking
    if (notification.type === 'booking' && notification.data?.status === 'cancelled') {
      return 'close-circle';
    }
    // Check if it's an accepted booking
    if (notification.type === 'booking' && notification.data?.status === 'accepted') {
      return 'checkmark-circle';
    }
    
    switch (notification.type) {
      case 'booking':
        return 'calendar';
      case 'payment':
        return 'card';
      case 'worker':
        return 'person';
      case 'system':
        return 'settings';
      case 'promotion':
        return 'gift';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (notification: Notification) => {
    // Check if it's a cancelled booking - use danger color
    if (notification.type === 'booking' && notification.data?.status === 'cancelled') {
      return theme.danger;
    }
    // Check if it's an accepted booking - use success color
    if (notification.type === 'booking' && notification.data?.status === 'accepted') {
      return theme.success;
    }
    
    switch (notification.type) {
      case 'booking':
        return theme.primary;
      case 'payment':
        return theme.success;
      case 'worker':
        return theme.warning;
      case 'system':
        return theme.secondary;
      case 'promotion':
        return theme.info;
      default:
        return theme.primary;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const renderNotification = (notification: Notification) => (
    <TouchableOpacity
      key={notification._id}
      style={[
        styles.notificationCard,
        { backgroundColor: theme.card },
        !notification.isRead && { borderLeftColor: theme.primary }
      ]}
      onPress={() => handleNotificationPress(notification)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        <View style={[
          styles.iconContainer,
          { backgroundColor: getNotificationColor(notification) }
        ]}>
          <Ionicons 
            name={getNotificationIcon(notification) as any} 
            size={20} 
            color="#fff" 
          />
        </View>
        
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[
              styles.notificationTitle,
              { color: theme.text },
              !notification.isRead && { fontWeight: '700' }
            ]}>
              {notification.title}
            </Text>
            {notification.type === 'booking' && notification.data?.status === 'cancelled' && (
              <View style={[styles.statusBadge, { backgroundColor: theme.danger }]}>
                <Text style={styles.statusBadgeText}>Cancelled</Text>
              </View>
            )}
            {notification.type === 'booking' && notification.data?.status === 'accepted' && (
              <View style={[styles.statusBadge, { backgroundColor: theme.success }]}>
                <Text style={styles.statusBadgeText}>Accepted</Text>
              </View>
            )}
          </View>
          <Text style={[styles.notificationMessage, { color: theme.secondary }]} numberOfLines={3}>
            {notification.message}
          </Text>
          {notification.data?.serviceName && (
            <Text style={[styles.serviceName, { color: theme.primary }]}>
              Service: {notification.data.serviceName}
            </Text>
          )}
          <Text style={[styles.notificationTime, { color: theme.icon }]}>
            {formatTime(notification.createdAt)}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => handleDeleteNotification(notification._id, e)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color={theme.icon} />
        </TouchableOpacity>
        
        {!notification.isRead && (
          <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              // Use replace instead of back to avoid GO_BACK error
              // Navigate to home screen as safe fallback
              router.replace('/home');
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>
            Notifications{unreadCount > 0 && ` (${unreadCount})`}
          </ThemedText>
          <TouchableOpacity 
            onPress={clearAllNotifications} 
            style={styles.clearButton}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Mark All as Read Button */}
          {notifications.length > 0 && notifications.some(n => !n.isRead) && (
            <View style={styles.actionBar}>
              <TouchableOpacity 
                style={[styles.markAllButton, { backgroundColor: theme.tint }]}
                onPress={markAllAsRead}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                <Text style={styles.markAllButtonText}>Mark All as Read</Text>
              </TouchableOpacity>
            </View>
          )}

          {loading ? (
            <View style={styles.centerContent}>
              <Ionicons name="notifications-outline" size={64} color={theme.icon} />
              <Text style={[styles.loadingText, { color: theme.secondary }]}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.centerContent}>
              <Ionicons name="notifications-outline" size={64} color={theme.icon} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No notifications yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.secondary }]}>
                You'll see updates about your bookings and services here
              </Text>
            </View>
          ) : (
            <View style={styles.notificationsList}>
              {notifications.map(renderNotification)}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Toast Notification - Shows for 3 seconds on new notifications */}
      <ToastNotification
        visible={toast.visible}
        message={toast.message}
        title={toast.title}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
        duration={3000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  clearButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  markAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationsList: {
    padding: 16,
  },
  notificationCard: {
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
});
