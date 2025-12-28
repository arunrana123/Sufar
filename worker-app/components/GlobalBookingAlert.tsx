// GLOBAL BOOKING ALERT - Shows booking request popup on any screen
// Features: Floating banner, sound/vibration, navigates to requests page on action
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { socketService } from '@/lib/SocketService';
import { useAuth } from '@/contexts/AuthContext';

// Dynamic import for expo-av
let Audio: any = null;
try {
  Audio = require('expo-av').Audio;
} catch (e) {
  console.warn('expo-av not available for GlobalBookingAlert');
}

interface BookingRequest {
  _id: string;
  serviceName?: string;
  serviceCategory?: string;
  price?: number;
  location?: {
    address?: string;
  };
  userId?: {
    firstName?: string;
    lastName?: string;
  };
}

export default function GlobalBookingAlert() {
  const { worker } = useAuth();
  const [booking, setBooking] = useState<BookingRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const soundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSoundPlayingRef = useRef(false);

  // Play alert sound and vibration
  const playAlert = () => {
    isSoundPlayingRef.current = true;
    
    // Vibrate
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Vibration.vibrate([200, 100, 200, 100, 200], true);
    }

    // Play beep sound (web)
    const playBeep = () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.15);
        } catch (e) {}
      }
    };

    playBeep();
    beepIntervalRef.current = setInterval(() => {
      if (isSoundPlayingRef.current) playBeep();
    }, 500);

    // Auto-stop after 20 seconds
    soundTimeoutRef.current = setTimeout(() => {
      stopAlert();
    }, 20000);
  };

  // Stop alert
  const stopAlert = () => {
    isSoundPlayingRef.current = false;
    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = null;
    }
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }
  };

  // Show banner with animation
  const showBanner = (bookingData: BookingRequest) => {
    setBooking(bookingData);
    setVisible(true);
    playAlert();
    
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  // Hide banner
  const hideBanner = () => {
    stopAlert();
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setBooking(null);
    });
  };

  // Handle View button
  const handleView = () => {
    hideBanner();
    router.push('/(tabs)/requests');
  };

  // Handle Accept button - navigate to requests page
  const handleAccept = () => {
    hideBanner();
    router.push('/(tabs)/requests');
  };

  useEffect(() => {
    if (!worker?.id) return;

    console.log('🌐 GlobalBookingAlert: Setting up for worker:', worker.id);
    console.log('📋 Worker categories:', worker.serviceCategories);

    // Connect socket and wait for connection
    const setupSocket = async () => {
      await socketService.connect(worker.id, 'worker');
      console.log('✅ GlobalBookingAlert: Socket connected');
    };
    setupSocket();

    // Listen for booking requests globally
    const handleBookingRequest = (data: any) => {
      console.log('🔔🔔🔔 GLOBAL ALERT: New booking request received:', data._id);
      console.log('📋 Booking category:', data.serviceCategory);
      
      // Check if worker has this service category
      const bookingCategory = data.serviceCategory?.toLowerCase().trim();
      const hasCategory = worker.serviceCategories?.some(
        (cat: string) => cat.toLowerCase().trim() === bookingCategory
      );

      console.log('🔍 Category match:', hasCategory, '| Worker categories:', worker.serviceCategories);

      if (hasCategory) {
        console.log('✅ GLOBAL: Showing booking alert popup for:', data.serviceName || data.serviceCategory);
        showBanner(data);
      } else {
        console.log('⚠️ GLOBAL: Worker does not have this category, skipping alert');
      }
    };

    // Add listener with slight delay to ensure socket is ready
    const timer = setTimeout(() => {
      socketService.on('booking:request', handleBookingRequest);
      console.log('✅ GlobalBookingAlert: Listener registered');
    }, 500);

    return () => {
      clearTimeout(timer);
      socketService.off('booking:request', handleBookingRequest);
      stopAlert();
    };
  }, [worker?.id, worker?.serviceCategories]);

  if (!visible || !booking) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="briefcase" size={24} color="#fff" />
        </View>
        
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            🔔 New Job Request!
          </Text>
          <Text style={styles.serviceName} numberOfLines={1}>
            {booking.serviceName || booking.serviceCategory || 'Service'}
          </Text>
          <Text style={styles.details} numberOfLines={1}>
            {booking.location?.address || 'Nearby'} • Rs. {booking.price || 0}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.viewBtn} onPress={handleView}>
            <Text style={styles.viewText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={hideBanner}>
          <Ionicons name="close" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 12,
    right: 12,
    zIndex: 99999,
    elevation: 9999,
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 25,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FF7A2C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 2,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  details: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  viewText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  acceptBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#10B981',
  },
  acceptText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
  closeBtn: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
});
