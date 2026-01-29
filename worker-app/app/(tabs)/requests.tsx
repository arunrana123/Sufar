// REQUESTS SCREEN - Displays incoming and assigned booking requests for worker
// Features: Accept/reject bookings, real-time updates via Socket.IO, pull-to-refresh, navigate to job details
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Modal,
  Platform,
  Vibration,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Dynamic import for expo-av to handle cases where it's not available
let Audio: any = null;
try {
  Audio = require('expo-av').Audio;
} catch (e) {
  console.warn('expo-av not available, sound will be disabled');
}
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';
import { router } from 'expo-router';
import ToastNotification from '@/components/ToastNotification';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationSoundService } from '@/lib/NotificationSoundService';

interface Booking {
  _id: string;
  userId: {
    firstName: string;
    lastName: string;
    phone?: string;
    profilePhoto?: string;
  };
  serviceName: string;
  serviceCategory?: string;
  location: {
    address: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  price: number;
  status: string;
  createdAt: string;
  workerId?: string;
}

interface MarketOrder {
  _id: string;
  orderId: string;
  userId: string;
  userInfo?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  items: Array<{
    productId: string;
    name: string;
    label?: string;
    quantity: number;
    price: number;
  }>;
  status: 'pending' | 'confirmed' | 'preparing' | 'assigned' | 'picked' | 'on_way' | 'delivered' | 'cancelled';
  deliveryBoy?: {
    id: string;
    name: string;
    phone: string;
  };
  total: number;
  paymentMethod: 'online' | 'cod';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  deliveryAddress: string;
  createdAt: string;
  type?: 'delivery'; // To distinguish from bookings
}

export default function RequestsScreen() {
  const { worker } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<MarketOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [incomingBooking, setIncomingBooking] = useState<any | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<MarketOrder | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  
  // Track accepted and rejected requests
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  
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

  // Sound and vibration refs
  const soundRef = useRef<any>(null);
  const soundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSoundPlayingRef = useRef<boolean>(false);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Shows toast notification for 3 seconds
  // Triggered by: Booking accept/reject, cancellations, updates
  const showToast = (message: string, title?: string, type?: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ visible: true, message, title, type });
  };

  // Play beep sound and vibrate when booking request arrives
  const playRequestAlert = async () => {
    try {
      // Stop any existing sound first
      stopRequestAlert();

      // Vibrate immediately
      if (Platform.OS !== 'web') {
        // Use expo-haptics for better vibration control
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Also use Vibration API for longer vibration pattern
        Vibration.vibrate([200, 100, 200, 100, 200], true); // Pattern: vibrate, pause, vibrate, pause, vibrate (repeat)
      }

      // Play beep sound
      console.log('🔊 Playing beep sound for new booking request');
      
      // Set audio mode for better sound playback (if Audio is available)
      if (Audio) {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        } catch (audioModeError) {
          console.warn('⚠️ Could not set audio mode:', audioModeError);
        }
      }

      // Create and play beep sound (looping)
      isSoundPlayingRef.current = true;
      
      try {

        // Create a simple beep sound using Web Audio API (works on all platforms)
        const playBeep = () => {
          try {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              // Web: Use Web Audio API for beep
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              oscillator.frequency.value = 800; // Beep frequency (800Hz)
              oscillator.type = 'sine';
              
              gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
              
              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.15);
            } else if (Platform.OS !== 'web') {
              // Native: For now, rely on vibration as primary alert
              // You can add a beep.mp3 file to assets/ and use expo-av for native beep
              // For now, vibration pattern is the main alert
            }
          } catch (beepError) {
            console.warn('⚠️ Beep error:', beepError);
          }
        };

        // Play beep immediately
        playBeep();

        // Set up interval to play beep every 500ms (looping)
        beepIntervalRef.current = setInterval(() => {
          if (isSoundPlayingRef.current) {
            playBeep();
          } else {
            if (beepIntervalRef.current) {
              clearInterval(beepIntervalRef.current);
              beepIntervalRef.current = null;
            }
          }
        }, 500);

        console.log('✅ Beep sound started and looping');

        // Auto-stop sound after 20 seconds if not viewed
        soundTimeoutRef.current = setTimeout(() => {
          console.log('⏰ Auto-stopping sound after 20 seconds');
          stopRequestAlert();
        }, 20000);

      } catch (soundError) {
        console.warn('⚠️ Could not create beep sound, using vibration only:', soundError);
        // If sound fails, vibration is already set above
      }

    } catch (error) {
      console.error('❌ Error playing request alert:', error);
      // Fallback: Just vibrate if everything fails
      if (Platform.OS !== 'web') {
        Vibration.vibrate([300, 200, 300, 200, 300]);
      }
    }
  };

  // Stop beep sound and vibration
  const stopRequestAlert = async () => {
    try {
      // Stop sound playing flag
      isSoundPlayingRef.current = false;

      // Clear timeout
      if (soundTimeoutRef.current) {
        clearTimeout(soundTimeoutRef.current);
        soundTimeoutRef.current = null;
      }

      // Clear beep interval
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }

      // Stop expo-av sound if it was used
      if (soundRef.current && Audio) {
        try {
          console.log('🔇 Stopping beep sound');
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        } catch (soundError) {
          console.warn('⚠️ Error stopping expo-av sound:', soundError);
        }
      }

      // Stop vibration
      if (Platform.OS !== 'web') {
        Vibration.cancel();
      }

      console.log('✅ Request alert stopped');
    } catch (error) {
      console.error('❌ Error stopping request alert:', error);
    }
  };

  // Load and update request statistics
  const loadRequestStats = async () => {
    if (!worker?.id) return;
    
    try {
      const storageKey = `worker_request_stats_${worker.id}`;
      const stored = await AsyncStorage.getItem(storageKey);
      let stats = { accepted: 0, rejected: 0 };
      
      if (stored) {
        stats = JSON.parse(stored);
      }
      
      // Count accepted bookings from backend
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/worker/${worker.id}?status=accepted`);
      if (response.ok) {
        const acceptedBookings = await response.json();
        const actualAccepted = Array.isArray(acceptedBookings) ? acceptedBookings.length : 0;
        
        // Use the higher value (backend count or stored count)
        stats.accepted = Math.max(stats.accepted, actualAccepted);
      }
      
      setAcceptedCount(stats.accepted);
      setRejectedCount(stats.rejected);
      
      console.log('📊 Request stats loaded:', { accepted: stats.accepted, rejected: stats.rejected });
      
      // Save updated stats
      await AsyncStorage.setItem(storageKey, JSON.stringify(stats));
    } catch (error) {
      console.error('Error loading request stats:', error);
    }
  };

  // Save request statistics
  const saveRequestStats = async (incrementAccepted = false, incrementRejected = false) => {
    if (!worker?.id) return;
    
    try {
      const storageKey = `worker_request_stats_${worker.id}`;
      const stored = await AsyncStorage.getItem(storageKey);
      let stats = { accepted: 0, rejected: 0 };
      
      if (stored) {
        stats = JSON.parse(stored);
      }
      
      if (incrementAccepted) {
        stats.accepted += 1;
        setAcceptedCount(prev => prev + 1);
      }
      if (incrementRejected) {
        stats.rejected += 1;
        setRejectedCount(prev => prev + 1);
      }
      
      await AsyncStorage.setItem(storageKey, JSON.stringify(stats));
    } catch (error) {
      console.error('Error saving request stats:', error);
    }
  };

  const fetchBookings = async (isRefresh = false) => {
    try {
      if (!worker?.id) {
        console.warn('⚠️ Cannot fetch bookings: No worker ID');
        return;
      }
      
      const apiUrl = getApiUrl();
      console.log('📥 Fetching bookings for worker:', worker.id);
      console.log('🔗 API URL:', `${apiUrl}/api/bookings/worker/${worker.id}`);
      
      const response = await fetch(`${apiUrl}/api/bookings/worker/${worker.id}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Bookings fetched successfully:', data.length, 'bookings');
        console.log('📋 Booking IDs:', data.map((b: any) => b._id));
        console.log('📋 Booking statuses:', data.map((b: any) => ({ id: b._id, status: b.status, workerId: b.workerId })));
        
        // Filter bookings based on status and verification
        const filteredBookings = data.filter((booking: any) => {
          // For accepted bookings, check if this worker is assigned
          if (booking.status === 'accepted' || booking.status === 'in_progress') {
            const bookingWorkerId = booking.workerId ? String(booking.workerId) : null;
            const currentWorkerId = String(worker.id);
            
            // Only show accepted bookings assigned to this worker
            if (bookingWorkerId !== currentWorkerId) {
              console.log(`⚠️ Filtering out accepted booking not assigned to this worker: ${booking._id} (WorkerId: ${bookingWorkerId}, Current: ${currentWorkerId})`);
              return false;
            }
            
            // For accepted bookings, still check verification if service category exists
            if (booking.serviceCategory && worker?.serviceCategories) {
              const categoryStatus = worker.categoryVerificationStatus?.[booking.serviceCategory];
              const isServiceVerified = categoryStatus === 'verified';
              
              if (!isServiceVerified) {
                console.log(`⚠️ Filtering out accepted booking for unverified service: ${booking.serviceCategory}`);
                // Still show it but log a warning - accepted bookings should be shown even if verification is pending
              }
            }
            
            return true;
          }
          
          // For pending bookings, check verification
          if (booking.status === 'pending') {
            if (!booking.serviceCategory || !worker?.serviceCategories) {
              return false;
            }
            
            // Check if worker has this service category
            const bookingCategory = booking.serviceCategory.toLowerCase().trim();
            const hasCategory = worker.serviceCategories.some(
              (cat: string) => cat.toLowerCase().trim() === bookingCategory
            );
            
            if (!hasCategory) {
              return false;
            }
            
            // CRITICAL: Only show pending bookings for VERIFIED service categories
            const categoryStatus = worker.categoryVerificationStatus?.[booking.serviceCategory];
            const isServiceVerified = categoryStatus === 'verified';
            
            if (!isServiceVerified) {
              console.log(`⚠️ Filtering out pending booking for unverified service: ${booking.serviceCategory} (Status: ${categoryStatus})`);
              return false;
            }
            
            return true;
          }
          
          // For other statuses (completed, cancelled), show if assigned to this worker
          if (booking.workerId) {
            const bookingWorkerId = String(booking.workerId);
            const currentWorkerId = String(worker.id);
            return bookingWorkerId === currentWorkerId;
          }
          
          return false;
        });
        
        console.log('✅ Filtered bookings:', filteredBookings.length, 'out of', data.length);
        console.log('📋 Filtered booking statuses:', filteredBookings.map((b: any) => ({ id: b._id, status: b.status })));
        
        // Store filtered bookings in state
        setBookings(filteredBookings);
        
        // Update stats after fetching bookings
        await loadRequestStats();
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ Failed to fetch bookings:', response.status, errorText);
        // Set empty array on error to prevent crashes
        setBookings([]);
      }
    } catch (error) {
      console.error('❌ Error fetching bookings:', error);
      // Set empty array on error to prevent crashes
      setBookings([]);
    } finally {
      setRefreshing(false);
    }
  };

  // Check if worker has delivery service category
  const hasDeliveryService = (): boolean => {
    if (!worker?.serviceCategories || !Array.isArray(worker.serviceCategories)) {
      return false;
    }
    
    // Check if worker has delivery-related service categories (case-insensitive)
    const deliveryCategories = ['delivery', 'delivery boy', 'delivery service', 'courier', 'food delivery'];
    const workerCategories = worker.serviceCategories.map((cat: string) => cat.toLowerCase().trim());
    
    return deliveryCategories.some(deliveryCat => 
      workerCategories.some(workerCat => workerCat.includes(deliveryCat) || deliveryCat.includes(workerCat))
    );
  };

  // Fetch delivery orders assigned to this worker
  const fetchDeliveryOrders = async () => {
    try {
      if (!worker?.id) {
        console.log('⚠️ Cannot fetch delivery orders: No worker ID');
        setDeliveryOrders([]);
        return;
      }

      // Only fetch delivery orders if worker has delivery service category
      if (!hasDeliveryService()) {
        console.log('ℹ️ Worker does not have delivery service category - skipping delivery orders fetch');
        setDeliveryOrders([]);
        return;
      }

      const apiUrl = getApiUrl();
      console.log('📦 Fetching delivery orders for worker:', worker.id);
      console.log('📋 Worker service categories:', worker.serviceCategories);
      
      const response = await fetch(`${apiUrl}/api/orders/delivery/${worker.id}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Handle both response formats: { success: true, orders: [...] } or direct array
        const orders = data.orders || (Array.isArray(data) ? data : []);
        
        console.log('✅ Delivery orders fetched:', orders.length);
        
        // Filter only assigned/pending/on_way delivery orders (not delivered/cancelled)
        const activeOrders = orders.filter((order: any) => 
          order.status && 
          order.status !== 'delivered' && 
          order.status !== 'cancelled'
        );
        
        setDeliveryOrders(activeOrders);
      } else if (response.status === 404) {
        // 404 means no orders found - this is OK, not an error
        console.log('ℹ️ No delivery orders found for this worker (404)');
        setDeliveryOrders([]);
      } else {
        // Only log error for actual failures (not 404)
        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn('⚠️ Failed to fetch delivery orders:', response.status, errorText);
        // Set empty array on error to prevent crashes - worker is still ready to receive requests
        setDeliveryOrders([]);
      }
    } catch (error: any) {
      // Network errors or other exceptions - don't show error, just log and set empty array
      console.warn('⚠️ Error fetching delivery orders (non-critical):', error?.message || error);
      // Set empty array on error to prevent crashes - worker is still ready to receive requests
      setDeliveryOrders([]);
    }
  };

  useEffect(() => {
    if (worker?.id) {
      console.log('🚀 Setting up requests page for worker:', worker.id);
      console.log('📋 Worker service categories:', worker.serviceCategories);
      console.log('✅ Worker verification status:', worker.categoryVerificationStatus);
      
      // Load request stats
      loadRequestStats();
      
      // Initial fetch
      fetchBookings();
      
      // Only fetch delivery orders if worker has delivery service
      if (hasDeliveryService()) {
        fetchDeliveryOrders();
      } else {
        console.log('ℹ️ Worker does not have delivery service - skipping delivery orders');
        setDeliveryOrders([]);
      }
      
      // Connect to socket for real-time updates
      console.log('🔌 Connecting to socket as worker:', worker.id);
      socketService.connect(worker.id, 'worker');
      
      // Wait a bit for socket to connect, then set up listeners
      const setupSocketListeners = () => {
        console.log('📡 Setting up socket listeners for booking requests...');
        console.log('👤 Worker ID:', worker.id);
        console.log('📋 Worker categories:', worker.serviceCategories);
        console.log('✅ Worker verification status:', worker.categoryVerificationStatus);
        
        // DIRECT socket listener for booking:request - CRITICAL for instant updates
        const handleBookingRequest = (booking: any) => {
          console.log('🔔🔔🔔 DIRECT BOOKING REQUEST RECEIVED in requests.tsx:', booking);
          console.log('📋 Booking details:', {
            id: booking._id,
            serviceName: booking.serviceName,
            serviceCategory: booking.serviceCategory,
            status: booking.status,
            workerId: booking.workerId,
          });
          
          // Check if booking is assigned to this specific worker
          if (booking.workerId && booking.workerId !== worker.id) {
            console.log('⚠️ Booking is assigned to another worker - ignoring');
            return;
          }
          
          // Check if worker has this service category (case-insensitive, handle variations)
          const hasServiceCategory = (() => {
            if (!booking.serviceCategory || !worker) {
              console.log('⚠️ Missing serviceCategory or worker data');
              return false;
            }
            
            const workerCategories = worker.serviceCategories || [];
            const bookingCategory = booking.serviceCategory.toLowerCase().trim();
            
            // Normalize category names for matching (handle variations like "Carpenter" vs "Carpentry")
            const normalizeCategory = (cat: string): string => {
              const normalized = cat.toLowerCase().trim();
              // Handle common variations
              if (normalized.includes('carpenter') || normalized.includes('carpentry')) {
                return 'carpenter';
              }
              return normalized;
            };
            
            const normalizedBookingCategory = normalizeCategory(booking.serviceCategory);
            
            // Check if worker has this service category (flexible matching)
            const hasCategory = workerCategories.some((cat: string) => {
              const normalizedWorkerCat = normalizeCategory(cat);
              return normalizedWorkerCat === normalizedBookingCategory || 
                     normalizedWorkerCat.includes(normalizedBookingCategory) || 
                     normalizedBookingCategory.includes(normalizedWorkerCat);
            });
            
            if (!hasCategory) {
              console.log(`⚠️ Worker does not have service category: ${booking.serviceCategory}`);
              console.log(`📋 Worker categories:`, workerCategories);
              console.log(`📋 Normalized booking category: ${normalizedBookingCategory}`);
              return false;
            }
            
            console.log(`✅ Worker has matching service category: ${booking.serviceCategory}`);
            return true;
          })();
          
          // Check if worker is verified for this service category (handle variations)
          const isServiceVerified = (() => {
            if (!booking.serviceCategory || !worker) {
              return false;
            }
            
            // Check verification status for the exact category first
            let categoryStatus = worker.categoryVerificationStatus?.[booking.serviceCategory];
            
            // If not found, try to find a matching category in verification status
            if (!categoryStatus && worker.categoryVerificationStatus) {
              const normalizedBookingCategory = booking.serviceCategory.toLowerCase().trim();
              const matchingCategory = Object.keys(worker.categoryVerificationStatus).find(cat => {
                const normalizedCat = cat.toLowerCase().trim();
                // Handle variations like "Carpenter" vs "Carpentry"
                if (normalizedBookingCategory.includes('carpenter') || normalizedBookingCategory.includes('carpentry')) {
                  return normalizedCat.includes('carpenter') || normalizedCat.includes('carpentry');
                }
                return normalizedCat === normalizedBookingCategory;
              });
              
              if (matchingCategory) {
                categoryStatus = worker.categoryVerificationStatus[matchingCategory];
                console.log(`✅ Found matching verification status for category variation: ${matchingCategory}`);
              }
            }
            
            const isVerified = categoryStatus === 'verified';
            
            if (!isVerified) {
              console.log(`⚠️ Worker service category "${booking.serviceCategory}" is not verified. Status: ${categoryStatus}`);
              console.log(`📋 Available verification statuses:`, Object.keys(worker.categoryVerificationStatus || {}));
            }
            
            return isVerified;
          })();
          
          // Only show request if worker has the category AND it's verified
          // Unverified workers should NOT receive job requests
          if (hasServiceCategory && isServiceVerified) {
            // IMMEDIATELY play notification sound and vibrate (checking settings)
            if (worker?.id) {
              notificationSoundService.playNotificationSound('booking', 'new', worker.id);
            }
            
            // IMMEDIATELY add to state (optimistic update)
            setBookings(prevBookings => {
              // Check if booking already exists
              const exists = prevBookings.some(b => b._id === booking._id);
              if (exists) {
                console.log('⚠️ Booking already in list, updating...');
                return prevBookings.map(b => 
                  b._id === booking._id ? { ...b, ...booking } : b
                );
              } else {
                console.log('✅ Adding new booking to list immediately');
                // Transform booking to match interface
                const newBooking: Booking = {
                  _id: booking._id,
                  userId: {
                    firstName: booking.userId?.firstName || 'Customer',
                    lastName: booking.userId?.lastName || '',
                    phone: booking.userId?.phone || '',
                    profilePhoto: booking.userId?.profilePhoto,
                  },
                  serviceName: booking.serviceName || booking.serviceCategory || 'Service',
                  serviceCategory: booking.serviceCategory,
                  location: {
                    address: booking.location?.address || 'Location not specified',
                    city: booking.location?.city,
                    coordinates: booking.location?.coordinates,
                  },
                  price: booking.price || 0,
                  status: booking.status || 'pending',
                  createdAt: booking.createdAt || new Date().toISOString(),
                  workerId: booking.workerId,
                };
                return [newBooking, ...prevBookings];
              }
            });
            
            // Show incoming booking banner (GlobalBookingAlert handles the popup)
            console.log('🎉 New booking saved to list:', booking._id);
            
            // Also refresh from backend after a short delay to ensure consistency
            setTimeout(() => {
              console.log('🔄 Refreshing bookings from backend...');
              fetchBookings();
            }, 1000);
          } else {
            console.log('⚠️ Booking does not match this worker - ignoring');
            console.log('📋 Reasons:', {
              hasServiceCategory,
              isServiceVerified,
              bookingCategory: booking.serviceCategory,
              workerCategories: worker.serviceCategories,
              categoryStatus: worker.categoryVerificationStatus?.[booking.serviceCategory],
            });
          }
        };
      
        // Listen directly to booking:request event (single listener only)
        socketService.on('booking:request', handleBookingRequest);
        console.log('✅ Direct booking:request listener registered');
        
        // Listen for booking cancellations - only for bookings assigned to this worker
        socketService.on('booking:cancelled', (data: any) => {
          console.log('📢 Booking cancelled event received in worker app:', data);
          // Remove from state immediately
          setBookings(prevBookings => 
            prevBookings.filter(b => b._id !== data.bookingId)
          );
          // Only handle if this cancellation is for the current worker
          if (data.workerId === worker.id) {
            showToast(
              data.message || 'A booking you were assigned to has been cancelled by the customer.',
              'Booking Cancelled',
              'error'
            );
          }
          fetchBookings();
        });
        
        // Listen for booking updates - save ALL booking data
        socketService.on('booking:updated', (updatedBooking: any) => {
          console.log('📢 Booking updated event received in worker app:', updatedBooking);
          // Use full booking data from event (includes all fields: location, price, serviceName, etc.)
          const fullBookingData = updatedBooking.booking || updatedBooking;
          
          // Update in state immediately for real-time UI updates with FULL data
          setBookings(prevBookings => {
            const exists = prevBookings.some(b => b._id === fullBookingData._id || b._id === updatedBooking._id);
            if (exists) {
              // Merge ALL fields from full booking data
              return prevBookings.map(b => {
                const bookingId = fullBookingData._id || updatedBooking._id;
                if (b._id === bookingId) {
                  return {
                    ...b,
                    ...fullBookingData, // Include ALL fields from backend
                    status: fullBookingData.status || updatedBooking.status || b.status,
                    workerId: fullBookingData.workerId || updatedBooking.workerId || b.workerId,
                    location: fullBookingData.location || b.location,
                    price: fullBookingData.price ?? b.price,
                    serviceName: fullBookingData.serviceName || b.serviceName,
                    serviceCategory: fullBookingData.serviceCategory || b.serviceCategory,
                  };
                }
                return b;
              });
            } else {
              // If booking doesn't exist and is assigned to this worker, add it with FULL data
              const workerId = fullBookingData.workerId || updatedBooking.workerId;
              if (workerId === worker.id || String(workerId) === String(worker.id)) {
                const newBooking: Booking = {
                  _id: fullBookingData._id || updatedBooking._id,
                  userId: {
                    firstName: fullBookingData.userId?.firstName || updatedBooking.userId?.firstName || 'Customer',
                    lastName: fullBookingData.userId?.lastName || updatedBooking.userId?.lastName || '',
                    phone: fullBookingData.userId?.phone || updatedBooking.userId?.phone || '',
                    profilePhoto: fullBookingData.userId?.profilePhoto || updatedBooking.userId?.profilePhoto,
                  },
                  serviceName: fullBookingData.serviceName || updatedBooking.serviceName || fullBookingData.serviceCategory || 'Service',
                  serviceCategory: fullBookingData.serviceCategory || updatedBooking.serviceCategory,
                  location: fullBookingData.location || updatedBooking.location || { address: 'Location not specified' },
                  price: fullBookingData.price ?? updatedBooking.price ?? 0,
                  status: fullBookingData.status || updatedBooking.status || 'pending',
                  createdAt: fullBookingData.createdAt || updatedBooking.createdAt || new Date().toISOString(),
                  workerId: workerId,
                };
                return [newBooking, ...prevBookings];
              }
              return prevBookings;
            }
          });
          
          // Refresh from backend to ensure consistency
          const workerId = fullBookingData.workerId || updatedBooking.workerId;
          if (workerId === worker.id || String(workerId) === String(worker.id)) {
            setTimeout(() => {
              fetchBookings();
            }, 500);
          }
        });
        
        // Listen for booking:accepted event - save ALL booking data
        socketService.on('booking:accepted', (data: any) => {
          console.log('✅ Booking accepted event received:', data);
          // Use full booking data from event
          const fullBookingData = data.booking || data;
          const bookingId = fullBookingData._id || data.bookingId;
          const workerId = fullBookingData.workerId || data.workerId;
          
          if (workerId === worker.id || String(workerId) === String(worker.id)) {
            // Update bookings immediately with FULL booking data
            setBookings(prevBookings => {
              const exists = prevBookings.some(b => b._id === bookingId);
              if (exists) {
                // Merge ALL fields from full booking data
                return prevBookings.map(b =>
                  b._id === bookingId
                    ? {
                        ...b,
                        ...fullBookingData, // Include ALL fields: location, price, serviceName, etc.
                        status: 'accepted',
                        workerId: workerId,
                      }
                    : b
                );
              } else {
                // Add new accepted booking with full data
                const newBooking: Booking = {
                  _id: bookingId,
                  userId: {
                    firstName: fullBookingData.userId?.firstName || 'Customer',
                    lastName: fullBookingData.userId?.lastName || '',
                    phone: fullBookingData.userId?.phone || '',
                    profilePhoto: fullBookingData.userId?.profilePhoto,
                  },
                  serviceName: fullBookingData.serviceName || fullBookingData.serviceCategory || 'Service',
                  serviceCategory: fullBookingData.serviceCategory,
                  location: fullBookingData.location || { address: 'Location not specified' },
                  price: fullBookingData.price ?? 0,
                  status: 'accepted',
                  createdAt: fullBookingData.createdAt || new Date().toISOString(),
                  workerId: workerId,
                };
                return [newBooking, ...prevBookings];
              }
            });
            
            // Refresh later to reconcile; do not refetch immediately so accepted job stays visible
            setTimeout(() => {
              fetchBookings();
            }, 2500);
          }
        });

        // Listen for delivery order assignments (only if worker has delivery service)
        const handleDeliveryAssignment = (data: any) => {
          if (!hasDeliveryService()) {
            console.log('ℹ️ Delivery assignment received but worker does not have delivery service - ignoring');
            return;
          }
          
          console.log('🚚 Delivery assignment received in requests:', data);
          if (data.deliveryBoy?.id === worker.id || data.deliveryBoyId === worker.id || 
              (data.order && data.order.deliveryBoy?.id === worker.id)) {
            console.log('✅ New delivery order assigned to this worker');
            // Play alert for new delivery assignment
            playRequestAlert();
            // Refresh delivery orders
            setTimeout(() => {
              fetchDeliveryOrders();
            }, 500);
            showToast(
              `New delivery order assigned: ${data.order?.orderId || 'Order'}`,
              'Delivery Assignment',
              'info'
            );
          }
        };

        // Listen for order status updates (only if worker has delivery service)
        const handleOrderStatusUpdate = (data: any) => {
          if (!hasDeliveryService()) {
            return;
          }
          
          console.log('📦 Order status updated in requests:', data);
          if (data.orderId) {
            setTimeout(() => {
              fetchDeliveryOrders();
            }, 500);
          }
        };

        // Set up delivery order listeners (using any to bypass type checking)
        const socketAny = socketService as any;
        socketAny.on('delivery:new_assignment', handleDeliveryAssignment);
        socketAny.on('order:status_updated', handleOrderStatusUpdate);
        socketAny.on('order:delivery_assigned', handleDeliveryAssignment);
        
        console.log('✅ All socket listeners set up successfully');
      };
      
      // Set up listeners after a short delay to ensure socket is connected
      setTimeout(setupSocketListeners, 500);
    }
    
    return () => {
      console.log('🧹 Cleaning up socket listeners');
      socketService.off('booking:request');
      socketService.off('booking:cancelled');
      socketService.off('booking:updated');
      socketService.off('booking:accepted');
      const socketAny = socketService as any;
      socketAny.off('delivery:new_assignment');
      socketAny.off('order:status_updated');
      socketAny.off('order:delivery_assigned');
      // Stop any playing sounds when component unmounts
      stopRequestAlert();
    };
  }, [worker?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings(true);
    
    // Only fetch delivery orders if worker has delivery service
    if (hasDeliveryService()) {
      fetchDeliveryOrders();
    } else {
      setDeliveryOrders([]);
    }
  };

  // Handle accepting delivery order (navigate to tracking)
  const handleAcceptDeliveryOrder = async (orderId: string) => {
    // INSTANTLY stop vibration and sound when accepting
    stopRequestAlert();
    
    // Also cancel any ongoing vibration
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }
    
    // Play success sound
    if (worker?.id) {
      notificationSoundService.playNotificationSound('booking', 'accepted', worker.id);
    }
    
    console.log('🚚 Accepting delivery order:', orderId);
    // Navigate directly to order tracking screen
    router.push({
      pathname: '/order-delivery-tracking',
      params: { orderId: String(orderId) },
    });
  };

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const acceptedBookings = bookings.filter(b => 
    (b.status === 'accepted' || b.status === 'in_progress') && 
    (b.workerId === worker?.id || String(b.workerId) === String(worker?.id))
  );

  // Update accepted count in real-time when bookings change
  useEffect(() => {
    if (worker?.id) {
      // Calculate actual accepted count from current bookings
      const actualAccepted = bookings.filter(b => 
        b.status === 'accepted' && (b.workerId === worker.id || String(b.workerId) === String(worker.id))
      ).length;
      
      // Calculate actual rejected count from current bookings
      const actualRejected = bookings.filter(b => 
        b.status === 'rejected' && (b.workerId === worker.id || String(b.workerId) === String(worker.id))
      ).length;
      
      // Update counts immediately if they changed
      if (actualAccepted !== acceptedCount) {
        setAcceptedCount(actualAccepted);
        // Save to storage for persistence
        const updateStats = async () => {
          const storageKey = `worker_request_stats_${worker.id}`;
          const stored = await AsyncStorage.getItem(storageKey);
          let stats = { accepted: 0, rejected: 0 };
          if (stored) {
            stats = JSON.parse(stored);
          }
          stats.accepted = actualAccepted;
          stats.rejected = actualRejected;
          await AsyncStorage.setItem(storageKey, JSON.stringify(stats));
        };
        updateStats();
      }
      
      if (actualRejected !== rejectedCount) {
        setRejectedCount(actualRejected);
      }
      
      console.log('📊 Real-time counts updated:', { 
        accepted: actualAccepted, 
        rejected: actualRejected,
        totalBookings: bookings.length 
      });
    }
  }, [bookings, worker?.id]);

  const handleAccept = async (bookingId: string) => {
    try {
      // INSTANTLY stop vibration and sound when accepting
      stopRequestAlert();
      
      // Also cancel any ongoing vibration
      if (Platform.OS !== 'web') {
        Vibration.cancel();
      }
      
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/accept`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId: worker?.id,
        }),
      });

      if (response.ok) {
        const bookingData = await response.json();
        console.log('✅ Booking accepted successfully:', bookingData._id);
        console.log('📦 Full booking data received:', {
          id: bookingData._id,
          status: bookingData.status,
          workerId: bookingData.workerId,
          serviceName: bookingData.serviceName,
          location: bookingData.location,
          price: bookingData.price,
        });
        
        // Play success sound
        if (worker?.id) {
          notificationSoundService.playNotificationSound('booking', 'accepted', worker.id);
        }
        
        // Helper to normalize API booking to Booking interface for display
        const toBooking = (data: any): Booking => ({
          _id: data._id,
          userId: {
            firstName: data.userId?.firstName ?? 'Customer',
            lastName: data.userId?.lastName ?? '',
            phone: data.userId?.phone,
            profilePhoto: data.userId?.profilePhoto,
          },
          serviceName: data.serviceName || data.serviceCategory || 'Service',
          serviceCategory: data.serviceCategory,
          location: data.location || { address: 'Location not specified', city: data.location?.city, coordinates: data.location?.coordinates },
          price: data.price ?? 0,
          status: 'accepted',
          createdAt: data.createdAt || new Date().toISOString(),
          workerId: data.workerId || worker?.id,
        });
        
        // INSTANT UI update: move accepted booking from Pending to Accepted in state (no refetch)
        const bid = String(bookingData._id ?? bookingId);
        setBookings(prevBookings => {
          const updated = prevBookings.map(b => {
            if (String(b._id) === bid) {
              return toBooking({ ...bookingData, status: 'accepted', workerId: bookingData.workerId || worker?.id });
            }
            return b;
          });
          const exists = updated.some(b => String(b._id) === bid);
          if (!exists && bookingData._id) {
            return [toBooking({ ...bookingData, status: 'accepted' }), ...prevBookings];
          }
          return updated;
        });
        
        // Save stats (count will be updated automatically by useEffect when bookings change)
        await saveRequestStats(true, false);
        
        // Show toast notification
        showToast(
          'Request accepted. Tap Start when you are ready to navigate.',
          'Request Accepted!',
          'success'
        );
        
        // Do NOT refetch here – optimistic update is enough. Refetch only in background after delay to reconcile.
        setTimeout(() => {
          fetchBookings();
        }, 2500);
      } else {
        const data = await response.json();
        showToast(
          data.message || 'Failed to accept request',
          'Error',
          'error'
        );
      }
    } catch (error) {
      console.error('Accept error:', error);
      showToast(
        'Network error. Please try again.',
        'Error',
        'error'
      );
    }
  };

  const handleStartNavigation = (bookingId: string) => {
    console.log('🚀 Starting navigation for booking:', bookingId);
    // Navigate to job-navigation which opens the maps journey
    router.push({
      pathname: '/job-navigation',
      params: { bookingId: String(bookingId) },
    });
  };

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setDetailsVisible(true);
  };

  const closeDetails = () => {
    setDetailsVisible(false);
    setSelectedBooking(null);
  };

  const handleReject = async (bookingId: string) => {
    Alert.alert(
      'Reject Request',
      'Are you sure you want to reject this request? It will be sent to another worker.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const apiUrl = getApiUrl();
              const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/reject`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  workerId: worker?.id,
                }),
              });

              if (response.ok) {
                const data = await response.json();
                console.log('✅ Booking rejected successfully:', data.booking?._id || bookingId);
                
                // Update booking in state with full data from backend response
                if (data.booking) {
                  setBookings(prevBookings =>
                    prevBookings.map(b =>
                      b._id === bookingId || b._id === data.booking._id
                        ? { ...b, ...data.booking, status: data.booking.status || 'pending' }
                        : b
                    )
                  );
                } else {
                  // If no booking data returned, just remove from list or mark as rejected
                  setBookings(prevBookings =>
                    prevBookings.filter(b => b._id !== bookingId)
                  );
                }
                
                // Increment rejected count
                await saveRequestStats(false, true);
                
                showToast(
                  'Request rejected. It will be sent to another worker.',
                  'Request Rejected',
                  'info'
                );
                
                // Refresh bookings to get updated data from backend
                setTimeout(() => {
                  fetchBookings();
                }, 500);
              } else {
                showToast(
                  'Failed to reject request. Please try again.',
                  'Error',
                  'error'
                );
              }
            } catch (error) {
              console.error('Reject error:', error);
              showToast(
                'Network error. Please try again.',
                'Error',
                'error'
              );
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'accepted':
        return '#4CAF50';
      case 'completed':
        return '#2196F3';
      default:
        return '#666';
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Service Requests</Text>
          {pendingBookings.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingBookings.length}</Text>
            </View>
          )}
        </View>

        {/* Status Bar - Accepted vs Rejected - Always Visible */}
        <View style={styles.statusBarContainer}>
          <View style={styles.statusBar}>
            {/* Accepted Section (Green) */}
            {acceptedCount > 0 ? (
              <View 
                style={[
                  styles.statusBarSection,
                  styles.acceptedSection,
                  { 
                    flex: acceptedCount || 1,
                  }
                ]}
              >
                <Text style={styles.statusBarText} numberOfLines={1}>Accepted</Text>
                <Text style={styles.statusBarCount}>{acceptedCount}</Text>
              </View>
            ) : (
              <View style={[styles.statusBarSection, styles.emptySection, { flex: 1 }]}>
                <Text style={styles.statusBarTextEmpty}>Accepted</Text>
                <Text style={styles.statusBarCountEmpty}>0</Text>
              </View>
            )}
            
            {/* Rejected Section (Red) */}
            {rejectedCount > 0 ? (
              <View 
                style={[
                  styles.statusBarSection,
                  styles.rejectedSection,
                  { 
                    flex: rejectedCount || 1,
                  }
                ]}
              >
                <Text style={styles.statusBarText} numberOfLines={1}>Rejected</Text>
                <Text style={styles.statusBarCount}>{rejectedCount}</Text>
              </View>
            ) : (
              <View style={[styles.statusBarSection, styles.emptySection, { flex: 1 }]}>
                <Text style={styles.statusBarTextEmpty}>Rejected</Text>
                <Text style={styles.statusBarCountEmpty}>0</Text>
              </View>
            )}
          </View>
          
          {/* Total Count */}
          <Text style={styles.statusBarTotal}>
            Total: {acceptedCount + rejectedCount} requests
          </Text>
        </View>

        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Pending Requests */}
          {pendingBookings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>New Requests</Text>
              {pendingBookings.map((booking) => (
                <View key={booking._id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.clientInfo}>
                      <View style={styles.clientAvatar}>
                        <Ionicons name="person" size={24} color="#FF7A2C" />
                      </View>
                      <View>
                        <Text style={styles.clientName}>
                          {booking.userId.firstName} {booking.userId.lastName}
                        </Text>
                        <Text style={styles.requestTime}>
                          {new Date(booking.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.requestDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="construct-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>{booking.serviceName || booking.serviceCategory || 'Service'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>{booking.location.address}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>Rs. {booking.price}</Text>
                    </View>
                    {booking.userId.phone && (
                      <View style={styles.detailRow}>
                        <Ionicons name="call-outline" size={16} color="#666" />
                        <Text style={styles.detailText}>{booking.userId.phone}</Text>
                        <TouchableOpacity
                          style={styles.callUserButton}
                          onPress={() => Linking.openURL(`tel:${booking.userId.phone}`)}
                        >
                          <Ionicons name="call" size={16} color="#fff" />
                          <Text style={styles.callUserButtonText}>Call</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {booking.status === 'pending' && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleReject(booking._id)}
                      >
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAccept(booking._id)}
                      >
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Accepted Requests */}
          {acceptedBookings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Accepted Jobs</Text>
              {acceptedBookings.map((booking) => (
                <View key={booking._id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.clientInfo}>
                      <View style={styles.clientAvatar}>
                        <Ionicons name="person" size={24} color="#FF7A2C" />
                      </View>
                      <View>
                        <Text style={styles.clientName}>
                          {booking.userId.firstName} {booking.userId.lastName}
                        </Text>
                        <Text style={styles.requestTime}>
                          {new Date(booking.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.requestDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="construct-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>{booking.serviceName || booking.serviceCategory || 'Service'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>{booking.location.address}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>Rs. {booking.price}</Text>
                    </View>
                    {booking.userId.phone && (
                      <View style={styles.detailRow}>
                        <Ionicons name="call-outline" size={16} color="#666" />
                        <Text style={styles.detailText}>{booking.userId.phone}</Text>
                        <TouchableOpacity
                          style={styles.callUserButton}
                          onPress={() => Linking.openURL(`tel:${booking.userId.phone}`)}
                        >
                          <Ionicons name="call" size={16} color="#fff" />
                          <Text style={styles.callUserButtonText}>Call</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={styles.viewButton}
                      onPress={() => handleViewDetails(booking)}
                    >
                      <Text style={styles.viewButtonText}>View</Text>
                    </TouchableOpacity>
                    {booking.userId.phone && (
                      <TouchableOpacity
                        style={[styles.viewButton, { backgroundColor: '#10B981', borderColor: '#10B981' }]}
                        onPress={() => Linking.openURL(`tel:${booking.userId.phone}`)}
                      >
                        <Ionicons name="call" size={16} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={[styles.viewButtonText, { color: '#fff' }]}>Call</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={styles.acceptButton}
                      onPress={() => {
                        console.log('🚀 Start button clicked for booking:', booking._id);
                        handleStartNavigation(booking._id);
                      }}
                    >
                      <Ionicons name="navigate" size={16} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={styles.acceptButtonText}>Start</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Delivery Orders */}
          {deliveryOrders.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Orders ({deliveryOrders.length})</Text>
              {deliveryOrders.map((order) => (
                <View key={order._id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.clientInfo}>
                      <View style={[styles.clientAvatar, { backgroundColor: '#4CAF5020' }]}>
                        <Ionicons name="cube-outline" size={24} color="#4CAF50" />
                      </View>
                      <View>
                        <Text style={styles.clientName}>
                          {order.userInfo ? `${order.userInfo.firstName} ${order.userInfo.lastName || ''}`.trim() : 'Customer'}
                        </Text>
                        <Text style={styles.requestTime}>
                          Order #{order.orderId} • {new Date(order.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#4CAF5020' }]}>
                      <Text style={[styles.statusText, { color: '#4CAF50' }]}>
                        {order.status === 'assigned' ? 'Assigned' : 
                         order.status === 'picked' ? 'Picked' :
                         order.status === 'on_way' ? 'On Way' : order.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.requestDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="cube-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        {order.items.length} item{order.items.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#666" />
                      <Text style={styles.detailText} numberOfLines={2}>
                        {order.deliveryAddress}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>Rs. {order.total.toLocaleString()}</Text>
                      <Text style={[styles.detailText, { marginLeft: 8, color: order.paymentMethod === 'cod' ? '#FF9800' : '#4CAF50' }]}>
                        ({order.paymentMethod === 'cod' ? 'COD' : 'Paid'})
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.acceptButton, { backgroundColor: '#4CAF50' }]}
                      onPress={() => handleAcceptDeliveryOrder(order.orderId || order._id)}
                    >
                      <Ionicons name="navigate" size={16} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={styles.acceptButtonText}>
                        {order.status === 'assigned' ? 'Start Delivery' : 'Track Order'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {bookings.length === 0 && deliveryOrders.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No requests yet</Text>
              <Text style={styles.emptySubtitle}>New job requests will appear here</Text>
            </View>
          )}
        </ScrollView>
        
        {/* Bottom Navigation */}
        <BottomNav />
      </SafeAreaView>

      {/* Booking details modal */}
      <Modal
        visible={detailsVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDetails}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Details</Text>
              <TouchableOpacity onPress={closeDetails}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Customer</Text>
                  <Text style={styles.modalValue}>
                    {selectedBooking.userId.firstName} {selectedBooking.userId.lastName}
                  </Text>
                  {selectedBooking.userId.phone ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                      <Text style={styles.modalSubValue}>{selectedBooking.userId.phone}</Text>
                      <TouchableOpacity
                        style={[styles.modalPrimaryButton, { backgroundColor: '#10B981', marginTop: 0, flex: 0, paddingVertical: 8, paddingHorizontal: 16 }]}
                        onPress={() => Linking.openURL(`tel:${selectedBooking.userId.phone}`)}
                      >
                        <Ionicons name="call" size={18} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.modalPrimaryButtonText}>Call Customer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.modalSubValue}>No phone</Text>
                  )}
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Service</Text>
                  <Text style={styles.modalValue}>{selectedBooking.serviceName || selectedBooking.serviceCategory || 'Service'}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Location</Text>
                  <Text style={styles.modalValue}>{selectedBooking.location.address}</Text>
                  {selectedBooking.location.city && (
                    <Text style={styles.modalSubValue}>{selectedBooking.location.city}</Text>
                  )}
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Price</Text>
                  <Text style={styles.modalValue}>Rs. {selectedBooking.price}</Text>
                </View>

                {/* Show Accept button for pending bookings */}
                {selectedBooking.status === 'pending' && (
                  <TouchableOpacity
                    style={[styles.modalPrimaryButton, { backgroundColor: '#10B981' }]}
                    onPress={async () => {
                      try {
                        console.log('✅ Accepting booking from modal:', selectedBooking._id);
                        const apiUrl = getApiUrl();
                        const res = await fetch(`${apiUrl}/api/bookings/${selectedBooking._id}/accept`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ workerId: worker?.id }),
                        });

                        if (res.ok) {
                          const bookingData = await res.json();
                          console.log('✅ Booking accepted:', bookingData._id);
                          
                          // INSTANT UI update: update booking in list so it appears under Accepted Jobs
                          const toBooking = (data: any): Booking => ({
                            _id: data._id,
                            userId: {
                              firstName: data.userId?.firstName ?? 'Customer',
                              lastName: data.userId?.lastName ?? '',
                              phone: data.userId?.phone,
                              profilePhoto: data.userId?.profilePhoto,
                            },
                            serviceName: data.serviceName || data.serviceCategory || 'Service',
                            serviceCategory: data.serviceCategory,
                            location: data.location || { address: 'Location not specified', city: data.location?.city, coordinates: data.location?.coordinates },
                            price: data.price ?? 0,
                            status: 'accepted',
                            createdAt: data.createdAt || new Date().toISOString(),
                            workerId: data.workerId || worker?.id,
                          });
                          const bid = String(bookingData._id ?? selectedBooking._id);
                          setBookings(prev => {
                            const updated = prev.map(b =>
                              String(b._id) === bid ? toBooking({ ...bookingData, status: 'accepted' }) : b
                            );
                            if (!updated.some(b => String(b._id) === bid)) {
                              return [toBooking({ ...bookingData, status: 'accepted' }), ...prev];
                            }
                            return updated;
                          });
                          
                          await saveRequestStats(true, false);
                          showToast('Booking accepted! You can now start navigation.', 'Success', 'success');
                          closeDetails();
                          setTimeout(() => fetchBookings(), 2500);
                        } else {
                          const errorText = await res.text();
                          console.error('❌ Failed to accept:', errorText);
                          Alert.alert('Error', 'Failed to accept booking');
                        }
                      } catch (e) {
                        console.error('❌ Accept error:', e);
                        Alert.alert('Error', 'Network error');
                      }
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.modalPrimaryButtonText}>Accept Request</Text>
                  </TouchableOpacity>
                )}

                {/* Show Start Navigation for accepted bookings */}
                {selectedBooking.status === 'accepted' && (
                  <TouchableOpacity
                    style={styles.modalPrimaryButton}
                    onPress={() => {
                      console.log('🚀 Start Navigation clicked from modal for booking:', selectedBooking._id);
                      closeDetails();
                      handleStartNavigation(selectedBooking._id);
                    }}
                  >
                    <Ionicons name="navigate" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.modalPrimaryButtonText}>Start Navigation</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.modalSecondaryButton} onPress={closeDetails}>
                  <Text style={styles.modalSecondaryButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Toast Notification - Shows for 3 seconds on booking events */}
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
    backgroundColor: '#F8F9FA',
  },
  safe: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FF7A2C',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding to ensure content is visible above BottomNav
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
    marginBottom: 16,
  },
  requestCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE5CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  requestTime: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestDetails: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  rejectButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#FF7A2C',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#FFF4EC',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD8BF',
  },
  viewButtonText: {
    color: '#FF7A2C',
    fontSize: 14,
    fontWeight: '600',
  },
  callUserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  callUserButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalSection: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#9CA3AF',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  modalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  modalSubValue: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  modalPrimaryButton: {
    backgroundColor: '#FF7A2C',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#F3F4F6',
  },
  modalSecondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBarContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statusBar: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
    width: '100%',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  statusBarSection: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    position: 'relative',
    height: '100%',
    minWidth: 80,
  },
  acceptedSection: {
    backgroundColor: '#10B981',
  },
  rejectedSection: {
    backgroundColor: '#EF4444',
  },
  emptySection: {
    backgroundColor: '#E5E7EB',
    flex: 1,
  },
  statusBarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBarTextEmpty: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBarCount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  statusBarCountEmpty: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  statusBarTotal: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 4,
  },
});

