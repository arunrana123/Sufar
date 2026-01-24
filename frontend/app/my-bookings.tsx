// MY BOOKINGS SCREEN - Displays user's service bookings with status, map preview, and tracking
// Features: Real-time updates via Socket.IO, pull-to-refresh, mini-map preview, live tracking navigation
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
  Image,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { socketService } from '@/lib/SocketService';
import { getApiUrl } from '@/lib/config';
import { MapView, Marker, Polyline, PROVIDER_GOOGLE } from '@/components/react-native-maps';

const { width, height } = Dimensions.get('window');

interface Booking {
  _id: string;
  userId?: string;
  serviceName: string;
  serviceCategory: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';
  location: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  price: number;
  scheduledDate?: string;
  workerId?: string | {
    firstName: string;
    lastName: string;
    phone?: string;
    profileImage?: string;
    image?: string;
    rating: number;
  };
  createdAt: string;
  completedAt?: string;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  userConfirmedPayment?: boolean;
  workerConfirmedPayment?: boolean;
  paymentConfirmedAt?: string | Date;
  rating?: number;
  review?: string;
}

// Helper function to safely get worker name from workerId
const getWorkerName = (workerId: Booking['workerId']): string => {
  if (!workerId) return 'Worker';
  if (typeof workerId === 'string') return 'Worker';
  return `${workerId.firstName} ${workerId.lastName || ''}`.trim() || 'Worker';
};

// Helper function to safely get worker property
const getWorkerProperty = <T,>(
  workerId: Booking['workerId'],
  property: keyof NonNullable<Exclude<Booking['workerId'], string>>,
  defaultValue: T
): T => {
  if (!workerId || typeof workerId === 'string') return defaultValue;
  const value = workerId[property];
  return (value !== undefined && value !== null ? value : defaultValue) as T;
};

// Helper function to safely get worker phone
const getWorkerPhone = (workerId: Booking['workerId']): string => {
  if (!workerId || typeof workerId === 'string') return '';
  return workerId.phone || '';
};

export default function MyBookingsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [clearAllModalVisible, setClearAllModalVisible] = useState(false);
  const mapRef = useRef<any>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'completed' | 'payment_pending' | 'payment_confirmed' | 'payment_paid'>('all');

  const fetchBookings = async (isRefresh = false) => {
    try {
      console.log('Fetching bookings for user:', user?.id);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/user/${user?.id}`);
      
      console.log('Bookings response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Bookings data received:', data);
        console.log('Number of bookings:', data.length);
        setBookings(data);
      } else {
        console.error('Failed to fetch bookings:', response.status, response.statusText);
        const errorData = await response.text();
        console.error('Error response:', errorData);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    console.log('My bookings - User data:', user);
    console.log('My bookings - User ID:', user?.id);
    if (user?.id) {
      fetchBookings();
      
      // Connect to socket for real-time updates
      socketService.connect(user.id, 'user');
      
      // Listen for booking acceptance - auto-navigate to live tracking
      socketService.on('booking:accepted', (data: any) => {
        console.log('✅ Booking accepted event received in my-bookings:', data);
        const bookingId = data.bookingId || data.booking?._id;
        if (bookingId) {
          // Refresh bookings to show updated status
          fetchBookings();
          
          // Auto-navigate to live tracking when booking is accepted
          const workerName = data.booking?.workerId?.firstName 
            ? `${data.booking.workerId.firstName} ${data.booking.workerId.lastName || ''}`.trim()
            : data.booking?.worker?.name || 'Worker';
          
          // Show alert and navigate
          setTimeout(() => {
            Alert.alert(
              'Worker Assigned!',
              `${workerName} has accepted your service request. Opening live tracking...`,
              [
                {
                  text: 'Track Now',
                  onPress: () => {
                    router.push({
                      pathname: '/live-tracking',
                      params: { bookingId: String(bookingId) },
                    });
                  },
                },
                {
                  text: 'View Later',
                  style: 'cancel',
                },
              ]
            );
          }, 500);
        }
      });
      
      // Listen for booking updates (includes payment status updates)
      socketService.on('booking:updated', (updatedBooking: any) => {
        console.log('📝 Booking updated event received in my-bookings:', {
          bookingId: updatedBooking._id,
          status: updatedBooking.status,
          paymentStatus: updatedBooking.paymentStatus,
          userConfirmedPayment: updatedBooking.userConfirmedPayment,
          workerConfirmedPayment: updatedBooking.workerConfirmedPayment,
        });
        
        // Check if this booking belongs to the current user
        if (updatedBooking.userId === user.id || String(updatedBooking.userId) === String(user.id)) {
          // Update the specific booking in state immediately with all fields
          setBookings(prev => 
            prev.map(b => 
              b._id === updatedBooking._id 
                ? { 
                    ...b, 
                    status: updatedBooking.status || b.status,
                    paymentStatus: updatedBooking.paymentStatus || b.paymentStatus,
                    userConfirmedPayment: updatedBooking.userConfirmedPayment !== undefined ? updatedBooking.userConfirmedPayment : b.userConfirmedPayment,
                    workerConfirmedPayment: updatedBooking.workerConfirmedPayment !== undefined ? updatedBooking.workerConfirmedPayment : b.workerConfirmedPayment,
                    paymentConfirmedAt: updatedBooking.paymentConfirmedAt || b.paymentConfirmedAt,
                    // Update all other fields from the updated booking
                    ...updatedBooking,
                    // Preserve existing fields
                    _id: b._id,
                    userId: b.userId,
                    workerId: b.workerId,
                  }
                : b
            )
          );
          
          // Also refresh from server to ensure consistency
          setTimeout(() => {
            fetchBookings();
          }, 500);
        } else {
          // Refresh all bookings if it's not clear which booking was updated
          fetchBookings();
        }
      });

      // Listen for work started event
      socketService.on('work:started', (data: any) => {
        console.log('🔨 Work started event received in my-bookings:', data);
        if (data.bookingId) {
          // Update the booking status to in_progress
          setBookings(prev => 
            prev.map(b => 
              b._id === data.bookingId 
                ? { ...b, status: 'in_progress' }
                : b
            )
          );
          // Refresh to get latest data
          setTimeout(() => {
            fetchBookings();
          }, 500);
        }
      });

      // Listen for work completed event
      socketService.on('work:completed', (data: any) => {
        console.log('✅ Work completed event received in my-bookings:', data);
        if (data.bookingId) {
          // Update the booking status to completed
          setBookings(prev => 
            prev.map(b => 
              b._id === data.bookingId 
                ? { ...b, status: 'completed', paymentStatus: data.paymentStatus || b.paymentStatus }
                : b
            )
          );
          // Refresh to get latest data
          setTimeout(() => {
            fetchBookings();
          }, 500);
        }
      });

      // Listen for navigation events
      socketService.on('navigation:started', (data: any) => {
        console.log('🚗 Navigation started event received in my-bookings:', data);
        if (data.bookingId) {
          // Update booking to show worker is navigating
          setBookings(prev => 
            prev.map(b => 
              b._id === data.bookingId 
                ? { ...b, status: 'accepted' }
                : b
            )
          );
        }
      });

      socketService.on('navigation:arrived', (data: any) => {
        console.log('📍 Navigation arrived event received in my-bookings:', data);
        if (data.bookingId) {
          // Worker has arrived
          setBookings(prev => 
            prev.map(b => 
              b._id === data.bookingId 
                ? { ...b, status: 'accepted' }
                : b
            )
          );
        }
      });
      
      // Listen for booking cancellations/deletions
      socketService.on('booking:cancelled', (data: any) => {
        console.log('🚫 Booking cancelled event received in my-bookings:', data);
        // Refresh bookings to remove cancelled booking
        fetchBookings();
      });
      
      socketService.on('booking:deleted', (data: any) => {
        console.log('🗑️ Booking deleted event received in my-bookings:', data);
        // Refresh bookings to remove deleted booking
        fetchBookings();
      });

      // Listen for payment status updates (real-time updates from socket)
      socketService.on('payment:status_updated', (data: any) => {
        console.log('💳 Payment status updated event received in my-bookings:', {
          bookingId: data.bookingId,
          paymentStatus: data.paymentStatus,
          userConfirmed: data.userConfirmed,
          workerConfirmed: data.workerConfirmed,
        });
        
        const bookingId = data.bookingId || data.booking?._id;
        if (bookingId) {
          // Update booking state with latest payment information
          setBookings(prev => 
            prev.map(b => 
              b._id === bookingId 
                ? { 
                    ...b, 
                    paymentStatus: data.paymentStatus || data.booking?.paymentStatus || b.paymentStatus,
                    userConfirmedPayment: data.userConfirmed !== undefined ? data.userConfirmed : (data.booking?.userConfirmedPayment ?? b.userConfirmedPayment),
                    workerConfirmedPayment: data.workerConfirmed !== undefined ? data.workerConfirmed : (data.booking?.workerConfirmedPayment ?? b.workerConfirmedPayment),
                    paymentConfirmedAt: data.booking?.paymentConfirmedAt || b.paymentConfirmedAt,
                    // Update all booking fields if full booking object is provided
                    ...(data.booking ? {
                      ...data.booking,
                      // Preserve existing fields
                      _id: b._id,
                      userId: b.userId,
                      workerId: b.workerId,
                    } : {}),
                  }
                : b
            )
          );
          
          // Show notification if payment status changed to paid
          if (data.paymentStatus === 'paid' || data.booking?.paymentStatus === 'paid') {
            console.log('✅ Payment status updated to paid in my-bookings!');
          }
          
          // Refresh to get latest data from backend to ensure consistency
          setTimeout(() => {
            fetchBookings();
          }, 500);
        }
      });
    }
    
    return () => {
      socketService.off('booking:accepted');
      socketService.off('booking:updated');
      socketService.off('booking:cancelled');
      socketService.off('booking:deleted');
      socketService.off('work:started');
      socketService.off('work:completed');
      socketService.off('payment:status_updated');
      socketService.off('navigation:started');
      socketService.off('navigation:arrived');
    };
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return theme.warning;
      case 'accepted':
        return theme.info;
      case 'in_progress':
        return theme.primary;
      case 'completed':
        return theme.success;
      case 'cancelled':
      case 'rejected':
        return theme.danger;
      default:
        return theme.secondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Finding Worker...';
      case 'accepted':
        return 'Worker Assigned';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'rejected':
        return 'No Worker Available';
      default:
        return status;
    }
  };

  const getDetailedStatusText = (booking: Booking) => {
    if (booking.status === 'completed') {
      if (booking.paymentStatus === 'paid') {
        return 'Completed & Paid';
      } else if (booking.userConfirmedPayment && booking.workerConfirmedPayment) {
        return 'Payment Confirmed';
      } else if (booking.userConfirmedPayment || booking.workerConfirmedPayment) {
        return 'Awaiting Payment Confirmation';
      } else {
        return 'Completed - Payment Pending';
      }
    } else if (booking.status === 'in_progress') {
      return 'Work in Progress';
    } else if (booking.status === 'accepted') {
      return 'Worker on the Way';
    } else if (booking.status === 'pending') {
      return 'Finding Worker...';
    }
    return getStatusText(booking.status);
  };

  // Group bookings by date for daily reminders
  const groupBookingsByDate = (bookings: Booking[]) => {
    const grouped: { [key: string]: Booking[] } = {};
    
    bookings.forEach(booking => {
      let dateKey: string;
      
      if (booking.scheduledDate) {
        // Use scheduled date for scheduled bookings
        const scheduledDate = new Date(booking.scheduledDate);
        dateKey = scheduledDate.toDateString();
      } else {
        // Use creation date for instant bookings
        const createdDate = new Date(booking.createdAt);
        dateKey = createdDate.toDateString();
      }
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(booking);
    });
    
    return grouped;
  };

  // Get today's date string for comparison
  const getTodayString = () => {
    return new Date().toDateString();
  };

  // Get tomorrow's date string
  const getTomorrowString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toDateString();
  };

  // Format date for display
  const formatDateForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (dateString === today.toDateString()) {
      return 'Today';
    } else if (dateString === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const handleViewTracking = (booking: Booking) => {
    // Navigate directly to live-tracking page instead of showing modal
    console.log('🚀 Navigating to live tracking for booking:', booking._id);
    router.push({
      pathname: '/live-tracking',
      params: { bookingId: booking._id },
    });
  };

  const fetchTrackingData = async (bookingId: string) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}`);
      
      if (response.ok) {
        const data = await response.json();
        setTrackingData(data);
        
        // Fit map to show both markers
        if (data.workerLocation && data.location.coordinates && mapRef.current) {
          mapRef.current.fitToCoordinates(
            [
              {
                latitude: data.workerLocation.latitude,
                longitude: data.workerLocation.longitude,
              },
              {
                latitude: data.location.coordinates.latitude,
                longitude: data.location.coordinates.longitude,
              },
            ],
            {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true,
            }
          );
        }
      }
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const closeTracking = () => {
    setShowTracking(false);
    setSelectedBooking(null);
    setTrackingData(null);
  };

  const handleClearAllBookings = async () => {
    if (!user?.id || bookings.length === 0) return;

    try {
      const apiUrl = getApiUrl();
      const deletePromises = bookings.map(booking => 
        fetch(`${apiUrl}/api/bookings/${booking._id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })
      );
      
      await Promise.allSettled(deletePromises);
      fetchBookings(true);
      Alert.alert('Success', 'All bookings have been cleared.');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear bookings.');
    } finally {
      setClearAllModalVisible(false);
    }
  };

  const handleConfirmPayment = async (booking: Booking) => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }
    
    try {
      const apiUrl = getApiUrl();
      console.log('💳 Confirming payment for booking:', booking._id);
      
      const response = await fetch(`${apiUrl}/api/bookings/${booking._id}/confirm-payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmedBy: 'user',
          userId: user.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Payment confirmation response:', {
          paymentStatus: data.booking.paymentStatus,
          userConfirmed: data.booking.userConfirmedPayment,
          workerConfirmed: data.booking.workerConfirmedPayment,
        });
        
        // Update local state immediately with all payment information
        setBookings(prev => 
          prev.map(b => 
            b._id === booking._id 
              ? { 
                  ...b, 
                  userConfirmedPayment: data.booking.userConfirmedPayment || true,
                  workerConfirmedPayment: data.booking.workerConfirmedPayment || false,
                  paymentStatus: data.booking.paymentStatus || 'pending',
                  paymentConfirmedAt: data.booking.paymentConfirmedAt,
                  // Update all booking fields from response to ensure consistency
                  ...data.booking,
                  // Preserve existing fields
                  _id: b._id,
                  userId: b.userId,
                  workerId: b.workerId,
                }
              : b
          )
        );
        
        // Show success message based on payment status
        if (data.booking.paymentStatus === 'paid') {
          Alert.alert(
            '✅ Payment Completed!',
            'Payment has been confirmed by both parties. Status updated to paid.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            '✅ Payment Confirmed',
            data.message || 'Your payment confirmation has been recorded. Waiting for worker confirmation.',
            [{ text: 'OK' }]
          );
        }
        
        // Refresh to get latest data from backend
        setTimeout(() => {
          fetchBookings();
        }, 300);
      } else {
        const errorData = await response.json();
        console.error('❌ Payment confirmation failed:', errorData);
        Alert.alert('Error', errorData.message || 'Failed to confirm payment');
      }
    } catch (error) {
      console.error('❌ Error confirming payment:', error);
      Alert.alert('Error', 'Failed to confirm payment. Please check your internet connection and try again.');
    }
  };

  const handlePayment = (booking: Booking) => {
    // Navigate to payment screen or show payment modal
    Alert.alert(
      'Payment',
      `Pay Rs. ${booking.price} for ${booking.serviceName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: () => {
            // TODO: Implement payment flow
            console.log('Payment for booking:', booking._id);
            Alert.alert('Payment', 'Payment functionality will be implemented soon.');
          },
        },
      ]
    );
  };

  const handleReview = (booking: Booking) => {
    router.push({
      pathname: '/review',
      params: {
        bookingId: booking._id,
        serviceName: booking.serviceName,
        workerName: getWorkerName(booking.workerId),
      },
    });
  };

  // Filter bookings based on active filter
  const filteredBookings = bookings.filter((booking) => {
    switch (activeFilter) {
      case 'completed':
        return booking.status === 'completed';
      case 'payment_pending':
        return booking.status === 'completed' && booking.paymentStatus !== 'paid';
      case 'payment_confirmed':
        return booking.status === 'completed' && 
               (booking.userConfirmedPayment || booking.workerConfirmedPayment) && 
               booking.paymentStatus !== 'paid';
      case 'payment_paid':
        return booking.paymentStatus === 'paid';
      case 'all':
      default:
        return true;
    }
  });

  // Get counts for each filter
  const filterCounts = {
    all: bookings.length,
    completed: bookings.filter(b => b.status === 'completed').length,
    payment_pending: bookings.filter(b => b.status === 'completed' && b.paymentStatus !== 'paid').length,
    payment_confirmed: bookings.filter(b => 
      b.status === 'completed' && 
      (b.userConfirmedPayment || b.workerConfirmedPayment) && 
      b.paymentStatus !== 'paid'
    ).length,
    payment_paid: bookings.filter(b => b.paymentStatus === 'paid').length,
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
        <Text style={[styles.loadingText, { color: theme.secondary }]}>Loading bookings...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <Pressable onPress={() => router.push('/menu')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </Pressable>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>My Bookings</ThemedText>
          <TouchableOpacity onPress={() => setClearAllModalVisible(true)} style={styles.refreshButton}>
            <Ionicons name="trash-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Filter Buttons - Always Visible */}
        <View style={[styles.filterContainer, { backgroundColor: theme.card || '#FFFFFF', borderBottomColor: theme.border || '#E5E7EB' }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  activeFilter === 'all' && styles.filterButtonActive,
                  activeFilter === 'all' && { backgroundColor: theme.primary }
                ]}
                onPress={() => setActiveFilter('all')}
              >
                <Text style={[
                  styles.filterButtonText,
                  activeFilter === 'all' && styles.filterButtonTextActive,
                  activeFilter === 'all' && { color: '#fff' }
                ]}>
                  All ({filterCounts.all})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  activeFilter === 'completed' && styles.filterButtonActive,
                  activeFilter === 'completed' && { backgroundColor: theme.success }
                ]}
                onPress={() => setActiveFilter('completed')}
              >
                <Ionicons 
                  name="checkmark-circle" 
                  size={16} 
                  color={activeFilter === 'completed' ? '#fff' : theme.success} 
                  style={{ marginRight: 4 }}
                />
                <Text style={[
                  styles.filterButtonText,
                  activeFilter === 'completed' && styles.filterButtonTextActive,
                  activeFilter === 'completed' && { color: '#fff' }
                ]}>
                  Completed ({filterCounts.completed})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  activeFilter === 'payment_pending' && styles.filterButtonActive,
                  activeFilter === 'payment_pending' && { backgroundColor: theme.warning }
                ]}
                onPress={() => setActiveFilter('payment_pending')}
              >
                <Ionicons 
                  name="time-outline" 
                  size={16} 
                  color={activeFilter === 'payment_pending' ? '#fff' : theme.warning} 
                  style={{ marginRight: 4 }}
                />
                <Text style={[
                  styles.filterButtonText,
                  activeFilter === 'payment_pending' && styles.filterButtonTextActive,
                  activeFilter === 'payment_pending' && { color: '#fff' }
                ]}>
                  Payment Pending ({filterCounts.payment_pending})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  activeFilter === 'payment_confirmed' && styles.filterButtonActive,
                  activeFilter === 'payment_confirmed' && { backgroundColor: theme.info }
                ]}
                onPress={() => setActiveFilter('payment_confirmed')}
              >
                <Ionicons 
                  name="checkmark-done" 
                  size={16} 
                  color={activeFilter === 'payment_confirmed' ? '#fff' : theme.info} 
                  style={{ marginRight: 4 }}
                />
                <Text style={[
                  styles.filterButtonText,
                  activeFilter === 'payment_confirmed' && styles.filterButtonTextActive,
                  activeFilter === 'payment_confirmed' && { color: '#fff' }
                ]}>
                  Confirmed ({filterCounts.payment_confirmed})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  activeFilter === 'payment_paid' && styles.filterButtonActive,
                  activeFilter === 'payment_paid' && { backgroundColor: theme.success }
                ]}
                onPress={() => setActiveFilter('payment_paid')}
              >
                <Ionicons 
                  name="card" 
                  size={16} 
                  color={activeFilter === 'payment_paid' ? '#fff' : theme.success} 
                  style={{ marginRight: 4 }}
                />
                <Text style={[
                  styles.filterButtonText,
                  activeFilter === 'payment_paid' && styles.filterButtonTextActive,
                  activeFilter === 'payment_paid' && { color: '#fff' }
                ]}>
                  Paid ({filterCounts.payment_paid})
                </Text>
              </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Confirmation Modal */}
        <Modal
          transparent={true}
          visible={clearAllModalVisible}
          onRequestClose={() => setClearAllModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Clear All Bookings?</Text>
              <Text style={[styles.modalMessage, { color: theme.secondary }]}>
                Are you sure you want to delete all bookings? This action cannot be undone.
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.inputBackground }]}
                  onPress={() => setClearAllModalVisible(false)}
                >
                  <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.danger }]}
                  onPress={handleClearAllBookings}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Clear All</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredBookings.length === 0 && bookings.length > 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="filter-outline" size={64} color={theme.icon} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No {activeFilter === 'all' ? '' : activeFilter === 'completed' ? 'Completed' : activeFilter === 'payment_pending' ? 'Payment Pending' : activeFilter === 'payment_confirmed' ? 'Payment Confirmed' : 'Paid'} Bookings
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.secondary }]}>
                {activeFilter === 'all' 
                  ? 'You don\'t have any bookings at the moment'
                  : `You don't have any ${activeFilter === 'completed' ? 'completed' : activeFilter === 'payment_pending' ? 'bookings with pending payment' : activeFilter === 'payment_confirmed' ? 'bookings with confirmed payment' : 'paid bookings'}`
                }
              </Text>
              <TouchableOpacity 
                style={[styles.exploreButton, { backgroundColor: theme.tint }]}
                onPress={() => setActiveFilter('all')}
              >
                <Text style={styles.exploreButtonText}>Show All</Text>
              </TouchableOpacity>
            </View>
          ) : bookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={64} color={theme.icon} />
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptySubtitle}>Book a service to get started</Text>
              <TouchableOpacity style={[styles.browseButton, { backgroundColor: theme.tint }]} onPress={() => router.replace('/home')}>
                <Text style={styles.browseButtonText}>Browse Services</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Daily Bookings Grouped by Date */}
              {(() => {
                const groupedBookings = groupBookingsByDate(filteredBookings);
                const sortedDates = Object.keys(groupedBookings).sort((a, b) => {
                  return new Date(a).getTime() - new Date(b).getTime();
                });

                return sortedDates.map((dateString) => {
                  const dayBookings = groupedBookings[dateString];
                  const pendingCount = dayBookings.filter(b => b.status === 'pending').length;
                  const totalCount = dayBookings.length;
                  
                  return (
                    <View key={dateString} style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <View style={styles.dateHeader}>
                          <Text style={styles.sectionTitle}>{formatDateForDisplay(dateString)}</Text>
                          <View style={styles.dateCount}>
                            <Text style={styles.dateCountText}>
                              {totalCount} service{totalCount !== 1 ? 's' : ''}
                            </Text>
                            {pendingCount > 0 && (
                              <View style={styles.pendingCount}>
                                <Text style={styles.pendingCountText}>
                                  {pendingCount} pending
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      
                      {dayBookings
                        .sort((a, b) => {
                          // Sort by scheduled time if available, then by creation time
                          if (a.scheduledDate && b.scheduledDate) {
                            return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
                          }
                          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                        })
                        .map((booking) => (
                          <View key={booking._id} style={styles.bookingCard}>
                            <View style={styles.bookingHeader}>
                              <View>
                                <Text style={styles.bookingTitle}>{booking.serviceName}</Text>
                                <Text style={styles.bookingLocation}>
                                  <Ionicons name="location-outline" size={12} color="#666" /> {booking.location.address}
                                </Text>
                              </View>
                              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                                <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                                  {getDetailedStatusText(booking)}
                                </Text>
                              </View>
                            </View>

                            {booking.workerId && (
                              <View style={styles.workerInfo}>
                                <Ionicons name="person-circle-outline" size={20} color="#4A90E2" />
                                <Text style={styles.workerName}>{getWorkerName(booking.workerId)}</Text>
                                <View style={styles.ratingContainer}>
                                  <Ionicons name="star" size={12} color="#FFD700" />
                                  <Text style={styles.ratingText}>{getWorkerProperty(booking.workerId, 'rating', 0)}</Text>
                                </View>
                              </View>
                            )}

                            <View style={styles.bookingDetails}>
                              <Text style={styles.detailText}>
                                <Ionicons name="cash-outline" size={14} color="#666" /> Rs. {booking.price}
                              </Text>
                              {booking.scheduledDate && (
                                <Text style={styles.detailText}>
                                  <Ionicons name="calendar-outline" size={14} color="#666" /> 
                                  Scheduled: {new Date(booking.scheduledDate).toLocaleDateString()} at {new Date(booking.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                              )}
                            </View>

                            <View style={styles.actionButtons}>
                              {booking.status === 'completed' ? (
                                <>
                                  {booking.paymentStatus !== 'paid' && !booking.userConfirmedPayment && (
                                    <TouchableOpacity
                                      style={[styles.payButton, { backgroundColor: theme.success }]}
                                      onPress={() => handleConfirmPayment(booking)}
                                    >
                                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                      <Text style={styles.payButtonText}>Confirm Payment</Text>
                                    </TouchableOpacity>
                                  )}
                                  {booking.paymentStatus !== 'paid' && booking.userConfirmedPayment && !booking.workerConfirmedPayment && (
                                    <View style={styles.waitingBadge}>
                                      <Ionicons name="hourglass" size={14} color={theme.warning} />
                                      <Text style={styles.waitingText}>Waiting for worker confirmation</Text>
                                    </View>
                                  )}
                                  {booking.paymentStatus === 'paid' && !booking.review && (
                                    <TouchableOpacity
                                      style={styles.reviewButton}
                                      onPress={() => handleReview(booking)}
                                    >
                                      <Ionicons name="star" size={16} color="#fff" />
                                      <Text style={styles.reviewButtonText}>Leave Review</Text>
                                    </TouchableOpacity>
                                  )}
                                  {booking.review && (
                                    <View style={styles.reviewedBadge}>
                                      <Ionicons name="star" size={14} color="#FFD700" />
                                      <Text style={styles.reviewedText}>Reviewed ({booking.rating}★)</Text>
                                    </View>
                                  )}
                                </>
                              ) : (
                                <TouchableOpacity
                                  style={styles.trackButton}
                                  onPress={() => {
                                    console.log('📍 Track button clicked for booking:', booking._id);
                                    handleViewTracking(booking);
                                  }}
                                >
                                  <Ionicons name="navigate" size={16} color="#fff" />
                                  <Text style={styles.trackButtonText}>
                                    {booking.status === 'pending' ? 'View Request' : 'Track Worker'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ))}
                    </View>
                  );
                });
              })()}
            </>
          )}
        </ScrollView>

        {/* Tracking Modal */}
        {showTracking && selectedBooking && (
          <View style={styles.trackingModal}>
            <TouchableOpacity 
              style={styles.modalOverlay} 
              activeOpacity={1} 
              onPress={closeTracking}
            >
              <View style={styles.trackingContainer}>
                {/* Header with Back Button */}
                <View style={styles.trackingHeader}>
                  <TouchableOpacity style={styles.backButton} onPress={closeTracking}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.trackingTitle}>Live Tracking</Text>
                  <TouchableOpacity style={styles.closeButton} onPress={closeTracking}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Map View */}
                <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  initialRegion={{
                    latitude: selectedBooking.location.coordinates.latitude,
                    longitude: selectedBooking.location.coordinates.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                >
                  {/* User Location Marker */}
                  <Marker
                    coordinate={selectedBooking.location.coordinates}
                    title="Your Location"
                    description={selectedBooking.location.address}
                  >
                    <View style={styles.markerContainer}>
                      <Ionicons name="home" size={30} color="#4A90E2" />
                    </View>
                  </Marker>

                  {/* Worker Location Marker */}
                  {trackingData?.workerLocation && (
                    <>
                      <Marker
                        coordinate={{
                          latitude: trackingData.workerLocation.latitude,
                          longitude: trackingData.workerLocation.longitude,
                        }}
                        title={getWorkerName(selectedBooking.workerId)}
                        description="Worker Location"
                      >
                        <View style={styles.workerMarker}>
                          <Ionicons name="person" size={24} color="#fff" />
                        </View>
                      </Marker>

                      {/* Route Line */}
                      <Polyline
                        coordinates={[
                          trackingData.workerLocation,
                          selectedBooking.location.coordinates,
                        ]}
                        strokeColor="#4A90E2"
                        strokeWidth={3}
                        lineDashPattern={[5, 5]}
                      />
                    </>
                  )}
                </MapView>
              </View>

              {/* Booking Info Card */}
              <View style={styles.infoCard}>
                {/* Status Header */}
                <View style={styles.statusHeader}>
                  <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(selectedBooking.status) }]} />
                  <Text style={styles.statusTitle}>
                    {selectedBooking.status === 'accepted' ? 'Worker on the way' : 
                     selectedBooking.status === 'in_progress' ? 'Work in progress' : 
                     'Service ' + selectedBooking.status}
                  </Text>
                </View>

                {/* Worker Info */}
                {selectedBooking.workerId && typeof selectedBooking.workerId === 'object' && (
                  <View style={styles.workerCard}>
                    <View style={styles.workerAvatar}>
                      {selectedBooking.workerId.profileImage || selectedBooking.workerId.image ? (
                        <Image 
                          source={{ uri: selectedBooking.workerId.profileImage || selectedBooking.workerId.image }} 
                          style={styles.workerAvatarImage}
                        />
                      ) : (
                        <Ionicons name="person" size={32} color="#4A90E2" />
                      )}
                    </View>
                    <View style={styles.workerDetails}>
                      <Text style={styles.workerName}>
                        {getWorkerName(selectedBooking.workerId)}
                      </Text>
                      <Text style={styles.workerPhone}>
                        {getWorkerProperty(selectedBooking.workerId, 'phone', 'Worker')}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.callButton}
                      onPress={() => {
                        const phone = getWorkerPhone(selectedBooking.workerId);
                        if (!phone) {
                          Alert.alert('No Phone Number', 'Worker phone number is not available.');
                          return;
                        }
                        const phoneNumber = phone.startsWith('+') ? phone : `+${phone}`;
                        const url = `tel:${phoneNumber}`;
                        Linking.canOpenURL(url)
                          .then((supported) => {
                            if (supported) {
                              return Linking.openURL(url);
                            } else {
                              Alert.alert('Error', 'Phone calls are not supported on this device.');
                            }
                          })
                          .catch((err) => {
                            console.error('Error opening phone dialer:', err);
                            Alert.alert('Error', 'Unable to open phone dialer.');
                          });
                      }}
                      disabled={!getWorkerPhone(selectedBooking.workerId)}
                    >
                      <Ionicons name="call" size={20} color="#4CAF50" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Service Details */}
                <View style={styles.serviceDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="construct-outline" size={16} color="#666" />
                    <Text style={styles.detailLabel}>Service:</Text>
                    <Text style={styles.detailValue}>{selectedBooking.serviceName}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.detailLabel}>Location:</Text>
                    <Text style={styles.detailValue}>{selectedBooking.location.address}</Text>
                  </View>
                  {trackingData?.workerLocation && (
                    <View style={styles.detailRow}>
                      <Ionicons name="navigate-outline" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Distance:</Text>
                      <Text style={styles.detailValue}>
                        {calculateDistance(
                          trackingData.workerLocation.latitude,
                          trackingData.workerLocation.longitude,
                          selectedBooking.location.coordinates.latitude,
                          selectedBooking.location.coordinates.longitude
                        ).toFixed(2)} km
                      </Text>
                    </View>
                  )}
                </View>

                {/* Live Updates */}
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live tracking active</Text>
                </View>
              </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  content: {
    flex: 1,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    minHeight: 60,
    width: '100%',
    zIndex: 10,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    marginRight: 8,
    minHeight: 40,
  },
  filterButtonActive: {
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  section: {
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  dateHeader: {
    flex: 1,
  },
  dateCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateCountText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  pendingCount: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  bookingCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bookingLocation: {
    fontSize: 12,
    color: '#666',
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
  workerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  workerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  bookingDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  trackButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  payButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFC107',
    gap: 6,
  },
  waitingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#856404',
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  reviewedText: {
    color: '#FF9800',
    fontSize: 14,
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  exploreButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  browseButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Tracking Modal Styles
  trackingModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  trackingContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4A90E2',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    zIndex: 1001,
  },
  trackingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#4A90E2',
  },
  workerMarker: {
    backgroundColor: '#4A90E2',
    padding: 8,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  workerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  workerAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  workerDetails: {
    flex: 1,
  },
  workerPhone: {
    fontSize: 14,
    color: '#666',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceDetails: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  liveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

