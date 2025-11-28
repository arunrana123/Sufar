// NOTIFICATIONS SCREEN - Displays all user notifications with real-time updates
// Features: Mark as read, delete notifications, clear all, pull-to-refresh, Socket.IO real-time updates
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { socketService } from '@/lib/SocketService';
import { notificationService } from '@/lib/NotificationService';
import ToastNotification from '@/components/ToastNotification';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'general' | 'service' | 'booking' | 'payment' | 'worker' | 'system' | 'promotion';
  isRead: boolean;
  createdAt: string;
  data?: any;
  imageUrl?: string;
}

export default function NotificationsScreen() {
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
        } else if (notification.type === 'payment') {
          showToast(notification.message, notification.title || 'Payment Update', 'success');
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
    // Check if it's a cancelled booking - use red color
    if (notification.type === 'booking' && notification.data?.status === 'cancelled') {
      return '#EF4444';
    }
    // Check if it's an accepted booking - use green color
    if (notification.type === 'booking' && notification.data?.status === 'accepted') {
      return '#10B981';
    }
    
    switch (notification.type) {
      case 'booking':
        return '#3B82F6';
      case 'payment':
        return '#10B981';
      case 'worker':
        return '#F59E0B';
      case 'system':
        return '#6B7280';
      case 'promotion':
        return '#8B5CF6';
      default:
        return '#3B82F6';
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
        !notification.isRead && styles.unreadCard
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
              !notification.isRead && styles.unreadText
            ]}>
              {notification.title}
            </Text>
            {notification.type === 'booking' && notification.data?.status === 'cancelled' && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>Cancelled</Text>
              </View>
            )}
            {notification.type === 'booking' && notification.data?.status === 'accepted' && (
              <View style={[styles.statusBadge, { backgroundColor: '#10B981' }]}>
                <Text style={styles.statusBadgeText}>Accepted</Text>
              </View>
            )}
          </View>
          <Text style={styles.notificationMessage} numberOfLines={3}>
            {notification.message}
          </Text>
          {notification.data?.serviceName && (
            <Text style={styles.serviceName}>
              Service: {notification.data.serviceName}
            </Text>
          )}
          <Text style={styles.notificationTime}>
            {formatTime(notification.createdAt)}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => handleDeleteNotification(notification._id, e)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
        </TouchableOpacity>
        
        {!notification.isRead && (
          <View style={styles.unreadDot} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/home')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={markAllAsRead} 
              style={[
                styles.headerButton,
                !notifications.some(n => !n.isRead) && styles.headerButtonDisabled
              ]}
              disabled={!notifications.some(n => !n.isRead)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.markAllText,
                !notifications.some(n => !n.isRead) && styles.markAllTextDisabled
              ]}>
                Mark All
              </Text>
            </TouchableOpacity>
            {notifications.length > 0 && (
              <TouchableOpacity 
                onPress={clearAllNotifications} 
                style={styles.headerButton}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.centerContent}>
              <Ionicons name="notifications-outline" size={64} color="#D1D5DB" />
              <Text style={styles.loadingText}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.centerContent}>
              <Ionicons name="notifications-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>
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
    backgroundColor: '#F9FAFB',
  },
  safe: {
    flex: 1,
  },
  header: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  markAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  markAllTextDisabled: {
    opacity: 0.6,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
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
    color: '#6B7280',
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationsList: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
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
    backgroundColor: '#EF4444',
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
    color: '#3B82F6',
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginTop: 8,
  },
});
