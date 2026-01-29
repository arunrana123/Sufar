// GLOBAL REVIEW THANK YOU - Shows thank you message when user submits rating and review
// Listens for review:submitted from backend and displays thank you toast/alert
import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { socketService } from '@/lib/SocketService';
import { useAuth } from '@/contexts/AuthContext';

export default function GlobalReviewThankYou() {
  const { worker } = useAuth();

  useEffect(() => {
    if (!worker?.id) return;

    const handleReviewSubmitted = (data: { workerId: string; thankYouMessage: string; rating?: number; comment?: string }) => {
      if (String(data.workerId) !== String(worker.id)) return;
      const message = data.thankYouMessage || 'Thank you for your rating and comment!';
      Alert.alert('Thank You!', message, [{ text: 'OK' }]);
    };

    socketService.on('review:submitted', handleReviewSubmitted);
    return () => {
      socketService.off('review:submitted', handleReviewSubmitted);
    };
  }, [worker?.id]);

  return null;
}
