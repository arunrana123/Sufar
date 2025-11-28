import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'job' | 'message' | 'payment' | 'system';
  read: boolean;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'New Job Request',
      message: 'You have a new plumbing job request from John Doe in Kathmandu',
      time: '5 min ago',
      type: 'job',
      read: false,
    },
    {
      id: '2',
      title: 'Payment Received',
      message: 'Payment of Rs. 5001 has been credited to your account',
      time: '1 hour ago',
      type: 'payment',
      read: false,
    },
    {
      id: '3',
      title: 'New Message',
      message: 'You have a new message from Sarah Smith',
      time: '2 hours ago',
      type: 'message',
      read: false,
    },
    {
      id: '4',
      title: 'Job Completed',
      message: 'Your carpentry job has been marked as completed',
      time: '1 day ago',
      type: 'job',
      read: true,
    },
    {
      id: '5',
      title: 'System Update',
      message: 'New features are available in the app. Update now!',
      time: '2 days ago',
      type: 'system',
      read: true,
    },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
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

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text style={styles.markAllText}>Mark all</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySubtitle}>You're all caught up!</Text>
            </View>
          ) : (
            <>
              {/* Unread Notifications */}
              {notifications.filter(n => !n.read).length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>New</Text>
                  {notifications
                    .filter(n => !n.read)
                    .map((notification) => (
                      <TouchableOpacity
                        key={notification.id}
                        style={[styles.notificationItem, !notification.read && styles.unreadItem]}
                        onPress={() => markAsRead(notification.id)}
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
                            {!notification.read && <View style={styles.unreadDot} />}
                          </View>
                          <Text style={styles.notificationMessage} numberOfLines={2}>
                            {notification.message}
                          </Text>
                          <Text style={styles.notificationTime}>{notification.time}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => deleteNotification(notification.id)}
                          style={styles.deleteButton}
                        >
                          <Ionicons name="close" size={20} color="#999" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                </View>
              )}

              {/* Read Notifications */}
              {notifications.filter(n => n.read).length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Earlier</Text>
                  {notifications
                    .filter(n => n.read)
                    .map((notification) => (
                      <TouchableOpacity
                        key={notification.id}
                        style={styles.notificationItem}
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
                          <Text style={styles.notificationTime}>{notification.time}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => deleteNotification(notification.id)}
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
  markAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
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

