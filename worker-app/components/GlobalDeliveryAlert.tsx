// GLOBAL DELIVERY ALERT - Shows delivery assignment popup on any screen
// When a delivery is assigned to this worker, banner appears on every screen
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

interface DeliveryAssignment {
  orderId: string;
  order?: {
    orderId?: string;
    total?: number;
    deliveryAddress?: string;
    items?: Array<{ name?: string; label?: string; quantity?: number }>;
  };
  deliveryBoy?: { id: string };
  deliveryBoyId?: string;
}

export default function GlobalDeliveryAlert() {
  const { worker } = useAuth();
  const [assignment, setAssignment] = useState<DeliveryAssignment | null>(null);
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const soundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSoundPlayingRef = useRef(false);

  const playAlert = () => {
    isSoundPlayingRef.current = true;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Vibration.vibrate([200, 100, 200, 100, 200], true);
    }
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
    soundTimeoutRef.current = setTimeout(() => {
      stopAlert();
    }, 20000);
  };

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
    if (Platform.OS !== 'web') Vibration.cancel();
  };

  const showBanner = (data: DeliveryAssignment) => {
    setAssignment(data);
    setVisible(true);
    playAlert();
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const hideBanner = () => {
    stopAlert();
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setAssignment(null);
    });
  };

  const handleView = () => {
    hideBanner();
    router.push('/(tabs)/tracking');
  };

  const handleAccept = () => {
    const orderId = assignment?.orderId || assignment?.order?.orderId;
    hideBanner();
    if (orderId) {
      router.push({
        pathname: '/order-delivery-tracking',
        params: { orderId: String(orderId) },
      });
    } else {
      router.push('/(tabs)/tracking');
    }
  };

  useEffect(() => {
    if (!worker?.id) return;

    const setupSocket = async () => {
      await socketService.connect(worker.id, 'worker');
    };
    setupSocket();

    const isForThisWorker = (data: any) => {
      const id = data.deliveryBoy?.id || data.deliveryBoyId || data.order?.deliveryBoy?.id;
      return id === worker.id || String(id) === String(worker.id);
    };

    const handleDeliveryAssignment = (data: any) => {
      if (!isForThisWorker(data)) return;
      const payload: DeliveryAssignment = {
        orderId: data.orderId || data.order?.orderId,
        order: data.order,
        deliveryBoy: data.deliveryBoy,
        deliveryBoyId: data.deliveryBoyId,
      };
      showBanner(payload);
    };

    const socketAny = socketService as any;
    const t = setTimeout(() => {
      socketAny.on('delivery:new_assignment', handleDeliveryAssignment);
      socketAny.on('order:delivery_assigned', handleDeliveryAssignment);
    }, 500);

    return () => {
      clearTimeout(t);
      socketAny.off('delivery:new_assignment', handleDeliveryAssignment);
      socketAny.off('order:delivery_assigned', handleDeliveryAssignment);
      stopAlert();
    };
  }, [worker?.id]);

  if (!visible || !assignment) return null;

  const orderId = assignment.orderId || assignment.order?.orderId || 'Order';
  const total = assignment.order?.total ?? 0;
  const address = assignment.order?.deliveryAddress || 'Address not specified';

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="cube" size={24} color="#fff" />
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>New Delivery Assigned</Text>
          <Text style={styles.serviceName}>Order #{orderId}</Text>
          <Text style={styles.details} numberOfLines={1}>
            {address} • Rs. {total.toLocaleString()}
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
    borderColor: '#2196F3',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 2,
  },
  serviceName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  details: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  viewText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  acceptBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2196F3',
  },
  acceptText: { fontSize: 13, color: '#ffffff', fontWeight: '700' },
  closeBtn: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
});
