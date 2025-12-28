// GLOBAL NOTIFICATION HANDLER - Shows floating toast notifications across all screens
// Features: Listens for notification:new events, displays toast on any screen, auto-dismisses, plays sounds
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { socketService } from '@/lib/SocketService';
import { notificationSoundService } from '@/lib/NotificationSoundService';
import { pushNotificationService } from '@/lib/PushNotificationService';
import ToastNotification from './ToastNotification';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'general' | 'service' | 'booking' | 'payment' | 'worker' | 'system' | 'promotion' | 'worker_approved' | 'worker_denied' | 'document_verification' | 'verification_submitted' | 'verification_complete';
  isRead: boolean;
  createdAt: string;
  data?: any;
}

export default function GlobalNotificationHandler() {
  const { user } = useAuth();
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    title?: string;
    type?: 'success' | 'error' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
  });

  useEffect(() => {
    if (!user?.id) return;

    // Register for push notifications
    pushNotificationService.registerForPushNotifications().then((token) => {
      if (token) {
        console.log('✅ Push notifications registered:', token);
        // You can send this token to your backend to send push notifications
      }
    });

    // Connect to socket for real-time notifications
    socketService.connect(user.id, 'user');

    // Listen for new notifications globally
    const handleNewNotification = (notification: Notification) => {
      console.log('🔔 Global notification received:', notification);
      
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
      
      // Determine toast type based on notification type and status
      let toastType: 'success' | 'error' | 'info' | 'warning' = 'info';
      let toastTitle = notification.title || 'New Notification';

      if (notification.type === 'booking') {
        if (notification.data?.status === 'accepted') {
          toastType = 'success';
          toastTitle = 'Booking Accepted';
        } else if (notification.data?.status === 'cancelled') {
          toastType = 'error';
          toastTitle = 'Booking Cancelled';
        } else if (notification.data?.status === 'completed') {
          toastType = 'success';
          toastTitle = 'Service Completed';
        } else if (notification.data?.status === 'in_progress') {
          toastType = 'info';
          toastTitle = 'Work Started';
        } else {
          toastType = 'info';
          toastTitle = 'Booking Update';
        }
      } else if (notification.type === 'document_verification' || notification.type === 'verification_submitted' || notification.type === 'verification_complete') {
        if (notification.data?.status === 'verified' || notification.type === 'verification_complete') {
          toastType = 'success';
          toastTitle = 'Verification Complete';
        } else if (notification.data?.status === 'rejected') {
          toastType = 'error';
          toastTitle = 'Verification Rejected';
        } else {
          toastType = 'info';
          toastTitle = 'Verification Update';
        }
      } else if (notification.type === 'payment') {
        toastType = 'success';
        toastTitle = 'Payment Update';
      } else if (notification.type === 'promotion' || notification.type === 'service' || notification.type === 'offer') {
        toastType = 'info';
        toastTitle = notification.title || 'Special Offer';
      } else if (notification.type === 'system') {
        toastType = 'info';
        toastTitle = 'System Update';
      }

      // Show toast notification
      setToast({
        visible: true,
        message: notification.message,
        title: toastTitle,
        type: toastType,
      });
    };

    // Register socket listener
    socketService.on('notification:new', handleNewNotification);

    return () => {
      socketService.off('notification:new', handleNewNotification);
    };
  }, [user?.id]);

  const handleDismiss = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  return (
    <ToastNotification
      visible={toast.visible}
      message={toast.message}
      title={toast.title}
      type={toast.type}
      onDismiss={handleDismiss}
      duration={4000} // Show for 4 seconds
    />
  );
}
