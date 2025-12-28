// SERVICE RECORDS SCREEN - Displays user's service bookings with stats, live tracking, and cancellation options
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import ToastNotification from '@/components/ToastNotification';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';

// Booking data structure from backend
interface Booking {
  _id: string;
  serviceTitle?: string;
  serviceName?: string;
  serviceCategory?: string;
  description?: string;
  status: string;
  location: {
    address: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  worker?: {
    name: string;
    phone: string;
  };
  startTime?: string;
  estimatedDuration?: number;
  createdAt: string;
  totalAmount?: number;
  price?: number;
  serviceCharge?: number;
  basePrice?: number;
  scheduledDate?: string;
  scheduledTime?: string;
  paymentStatus?: string;
  images?: string[];
}

export default function RecordScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [clearAllModalVisible, setClearAllModalVisible] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  
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
  // Triggered by: Booking events (created, accepted, cancelled, completed)
  const showToast = (message: string, title?: string, type?: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ visible: true, message, title, type });
  };

  // Fetches user's bookings from backend API
  // Triggered by: Component mount, pull-to-refresh, after cancel/clear operations
  const fetchBookings = async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/user/${user.id}`);
      
      if (response.ok) {
        const data = await response.json();
        setBookings(data);
      } else {
        console.error('Failed to fetch bookings:', response.status);
        Alert.alert('Error', 'Failed to load your service records');
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', 'Failed to load your service records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Sets up Socket.IO listeners for real-time booking updates
  // Triggered by: Component mount or when user.id changes
  useEffect(() => {
    if (user?.id) {
      fetchBookings();
      socketService.connect(user.id, 'user');
      
      // Listen for booking deletion from backend
      socketService.on('booking:deleted', (data: any) => {
        console.log('📢 Booking deleted notification received:', data);
        if (data.bookingId) {
          setBookings(prevBookings => 
            prevBookings.filter(booking => booking._id !== data.bookingId)
          );
          // Show toast notification
          showToast(
            data.message || 'Your service booking has been deleted',
            'Booking Deleted',
            'info'
          );
        }
      });

      // Listen for new notifications from backend
      socketService.on('notification:new', (notification: any) => {
        console.log('📢 New notification received in user app:', notification);
        if (notification.type === 'booking') {
          if (notification.data?.status === 'cancelled') {
            showToast(
              notification.message || 'Your service booking has been cancelled',
              notification.title || 'Booking Cancelled',
              'error'
            );
          } else if (notification.data?.status === 'accepted') {
            showToast(
              notification.message || 'A worker has accepted your booking!',
              notification.title || 'Booking Accepted',
              'success'
            );
          } else if (notification.data?.status === 'in_progress') {
            showToast(
              notification.message || 'Worker has started your service',
              notification.title || 'Work Started',
              'info'
            );
          } else if (notification.data?.status === 'completed') {
            showToast(
              notification.message || 'Your service has been completed!',
              notification.title || 'Service Completed',
              'success'
            );
          }
        }
      });
      
      // Listen for booking updates from backend
      socketService.on('booking:updated', (updatedBooking: any) => {
        console.log('📢 Booking updated notification received:', updatedBooking);
        if (updatedBooking._id) {
          setBookings(prevBookings => 
            prevBookings.map(booking => 
              booking._id === updatedBooking._id 
                ? { ...booking, ...updatedBooking }
                : booking
            )
          );
        }
      });
    }
    
    // Cleanup socket listeners on unmount
    return () => {
      socketService.off('booking:deleted');
      socketService.off('booking:updated');
      socketService.off('notification:new');
    };
  }, [user?.id]);

  // Handles pull-to-refresh gesture
  // Triggered by: User pulls down screen
  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  // Cancels a single booking via API DELETE request
  // Triggered by: User confirms cancellation in modal
  const handleDeleteBooking = async (bookingId: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    setCancelling(true);
    
    try {
      const apiUrl = getApiUrl();
      console.log('🚫 Cancelling booking:', bookingId);
      
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ Booking cancelled successfully:', data);
        
        // Remove the booking from UI immediately (no refetch needed)
        setBookings(prevBookings => 
          prevBookings.filter(booking => booking._id !== bookingId)
        );
        
        // Show toast notification
        showToast(
          'Your service booking has been cancelled successfully. You will be notified if any refund is processed.',
          'Booking Cancelled',
          'error'
        );
      } else {
        console.error('❌ Failed to cancel booking:', data);
        showToast(
          data.message || 'Failed to cancel service booking. Please try again.',
          'Cancellation Failed',
          'error'
        );
      }
    } catch (error) {
      console.error('❌ Error cancelling booking:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(
        `Failed to cancel booking: ${errorMessage}. Please check your internet connection and try again.`,
        'Network Error',
        'error'
      );
    } finally {
      setCancelling(false);
      setDeleteModalVisible(false);
      setSelectedBooking(null);
    }
  };

  // Removes cancelled booking from UI only (client-side)
  // Triggered by: User taps trash icon on cancelled booking
  const handleRemoveCancelledBooking = (bookingId: string) => {
    Alert.alert(
      'Delete Booking',
      'Are you sure you want to remove this cancelled booking from your records?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setBookings(prevBookings => 
              prevBookings.filter(booking => booking._id !== bookingId)
            );
            showToast(
              'Booking removed from your records',
              'Deleted',
              'info'
            );
          }
        }
      ]
    );
  };

  // Deletes all bookings in parallel with proper response checking
  // Triggered by: User confirms "Clear All" in modal
  const handleClearAllBookings = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    if (bookings.length === 0) {
      Alert.alert('No Bookings', 'You have no bookings to clear');
      return;
    }

    setClearingAll(true);

    try {
      const apiUrl = getApiUrl();
      console.log('🗑️ Clearing all bookings for user:', user.id);
      console.log('📝 Total bookings to delete:', bookings.length);

      // Delete all bookings and check actual HTTP responses
      const deletePromises = bookings.map(async (booking) => {
        try {
          const response = await fetch(`${apiUrl}/api/bookings/${booking._id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
            }),
          });
          
          if (response.ok) {
            console.log(`✅ Successfully deleted booking: ${booking._id}`);
            return { success: true, bookingId: booking._id };
          } else {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            console.error(`❌ Failed to delete booking ${booking._id}:`, response.status, errorData);
            return { success: false, bookingId: booking._id, error: errorData.message };
          }
        } catch (error) {
          console.error(`❌ Network error deleting booking ${booking._id}:`, error);
          return { success: false, bookingId: booking._id, error: 'Network error' };
        }
      });

      const results = await Promise.allSettled(deletePromises);
      
      // Count successful deletions from actual HTTP responses
      const successfulResults = results.filter((r): r is PromiseFulfilledResult<{ success: boolean; bookingId: string; error?: string }> => 
        r.status === 'fulfilled' && r.value.success
      );
      
      const successfulDeletions = successfulResults.length;
      const failedDeletions = results.length - successfulDeletions;

      console.log(`✅ Successfully deleted: ${successfulDeletions} bookings`);
      console.log(`❌ Failed to delete: ${failedDeletions} bookings`);

      // Clear the UI state immediately for successful deletions
      if (successfulDeletions > 0) {
        const successfulBookingIds = successfulResults.map(r => r.value.bookingId);
        
        // Remove only successfully deleted bookings from UI
        setBookings(prevBookings => 
          prevBookings.filter(booking => !successfulBookingIds.includes(booking._id))
        );
      }

      // Show appropriate feedback
      if (failedDeletions === 0) {
        showToast(
          'All service bookings have been cleared successfully.',
          'All Cleared',
          'success'
        );
      } else if (successfulDeletions > 0) {
        showToast(
          `${successfulDeletions} bookings cleared successfully. ${failedDeletions} could not be deleted.`,
          'Partially Cleared',
          'warning'
        );
      } else {
        showToast(
          'Failed to clear any bookings. Please check your internet connection and try again.',
          'Clear Failed',
          'error'
        );
        // Only refetch if ALL deletions failed due to potential network issues
        setTimeout(() => fetchBookings(), 1000);
      }
    } catch (error) {
      console.error('❌ Error clearing all bookings:', error);
      showToast(
        'Failed to clear all bookings. Please try again.',
        'Error',
        'error'
      );
      // Only refetch on unexpected errors
      setTimeout(() => fetchBookings(), 1000);
    } finally {
      setClearingAll(false);
      setClearAllModalVisible(false);
    }
  };

  // Opens confirmation modal for booking cancellation
  // Triggered by: User taps "Cancel" button on booking card
  const showDeleteConfirmation = (booking: Booking) => {
    setSelectedBooking(booking);
    setDeleteModalVisible(true);
  };

  // Returns color for booking status using theme colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return theme.warning;
      case 'accepted': return theme.primary;
      case 'in_progress': return theme.info;
      case 'completed': return theme.success;
      case 'cancelled': return theme.danger;
      default: return theme.secondary;
    }
  };

  // Converts status code to user-friendly text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Waiting for worker';
      case 'accepted': return 'Worker on the way';
      case 'in_progress': return 'Work in progress';
      case 'completed': return 'Service completed';
      case 'cancelled': return 'Service cancelled';
      default: return status;
    }
  };

  // Returns Ionicon name for booking status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'accepted': return 'checkmark-circle-outline';
      case 'in_progress': return 'construct-outline';
      case 'completed': return 'checkmark-done-outline';
      case 'cancelled': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  // Determines if Live Track button should show (accepted/in_progress only)
  const canTrack = (status: string) => {
    return ['accepted', 'in_progress'].includes(status);
  };

  // Determines if Cancel button should show (pending/accepted only)
  const canDelete = (status: string) => {
    return ['pending', 'accepted'].includes(status);
  };

  // Calculate booking statistics for stats cards
  const serviceCount = bookings.length;
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const activeCount = bookings.filter(b => ['accepted', 'in_progress'].includes(b.status)).length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;

  // Loading state - shows spinner while fetching data
  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe}>
          <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.secondary }]}>Loading your records...</ThemedText>
          </View>
        </SafeAreaView>
        <BottomNav />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.primary }]}>
            <Pressable onPress={() => router.replace('/home')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>Service Records</ThemedText>
            <View style={{ width: 40 }} />
          </View>
          {bookings.length > 0 && (
            <View style={[styles.clearAllContainer, { backgroundColor: theme.danger + '10', borderColor: theme.danger + '20' }]}>
              <TouchableOpacity
                style={[styles.clearAllActionButton, { backgroundColor: theme.danger }]}
                onPress={() => setClearAllModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="trash" size={20} color="#fff" />
                <Text style={styles.clearAllActionTextPlain}>Clear All Bookings</Text>
              </TouchableOpacity>
              <Text style={[styles.clearAllHint, { color: theme.danger }]}>Removes every record from this list</Text>
            </View>
          )}
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Ionicons name="list-outline" size={24} color={theme.primary} />
              <ThemedText style={styles.statNumber}>{serviceCount}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Services</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Ionicons name="time-outline" size={24} color={theme.warning} />
              <ThemedText style={styles.statNumber}>{pendingCount}</ThemedText>
              <ThemedText style={styles.statLabel}>Pending</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Ionicons name="construct-outline" size={24} color={theme.info} />
              <ThemedText style={styles.statNumber}>{activeCount}</ThemedText>
              <ThemedText style={styles.statLabel}>Active</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Ionicons name="checkmark-done-outline" size={24} color={theme.success} />
              <ThemedText style={styles.statNumber}>{completedCount}</ThemedText>
              <ThemedText style={styles.statLabel}>Completed</ThemedText>
            </View>
          </View>

          {/* Bookings List */}
          {bookings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={64} color={theme.icon} />
              <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No Service Records</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: theme.secondary }]}>
                Your booked services will appear here
              </ThemedText>
              <TouchableOpacity 
                style={[styles.exploreButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/home')}
              >
                <ThemedText style={styles.exploreButtonText}>Book a Service</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.bookingsList}>
              {bookings.map((booking) => (
                <View key={booking._id} style={[styles.bookingCard, { backgroundColor: theme.card }]}>
                  {/* Status Header */}
                  <View style={styles.statusHeader}>
                    <View style={styles.statusLeft}>
                      <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(booking.status) }]} />
                      <Ionicons 
                        name={getStatusIcon(booking.status) as any} 
                        size={16} 
                        color={getStatusColor(booking.status)} 
                      />
                      <ThemedText style={styles.statusText}>{getStatusText(booking.status)}</ThemedText>
                    </View>
                    <ThemedText style={styles.bookingDate}>
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </ThemedText>
                  </View>

                  {/* Service Details */}
                  <View style={styles.serviceInfo}>
                    <View style={styles.serviceHeader}>
                      <ThemedText style={styles.serviceTitle}>
                        {booking.serviceName || booking.serviceTitle || 'Service Title Not Available'}
                      </ThemedText>
                      <View style={[styles.serviceIdContainer, { backgroundColor: theme.inputBackground }]}>
                        <ThemedText style={[styles.serviceIdLabel, { color: theme.secondary }]}>ID:</ThemedText>
                        <ThemedText style={[styles.serviceIdValue, { color: theme.text }]}>
                          {booking._id?.substring(0, 8).toUpperCase() || 'N/A'}
                        </ThemedText>
                      </View>
                    </View>
                    
                    {/* Service Category & Type */}
                    <View style={styles.detailRow}>
                      <Ionicons name="construct-outline" size={16} color={theme.icon} />
                      <ThemedText style={styles.detailText}>
                        {booking.serviceCategory === 'plumber' ? 'Plumbing Service' :
                         booking.serviceCategory === 'electrician' ? 'Electrical Service' :
                         booking.serviceCategory === 'mechanic' ? 'Mechanical Service' :
                         booking.serviceCategory === 'ac-repair' ? 'AC Repair Service' :
                         booking.serviceCategory === 'carpenter' ? 'Carpentry Service' :
                         booking.serviceCategory === 'mason' ? 'Masonry Service' :
                         booking.serviceCategory === 'painter' ? 'Painting Service' :
                         booking.serviceCategory === 'cleaner' ? 'Cleaning Service' :
                         booking.serviceCategory === 'gardener' ? 'Gardening Service' :
                         booking.serviceCategory === 'cook' ? 'Cooking Service' :
                         booking.serviceCategory === 'driver' ? 'Driving Service' :
                         booking.serviceCategory === 'security' ? 'Security Service' :
                         booking.serviceCategory === 'technician' ? 'Technical Service' :
                         booking.serviceCategory === 'delivery' ? 'Delivery Service' :
                         booking.serviceCategory === 'beautician' ? 'Beauty Service' :
                         (booking.serviceTitle?.includes('Plumber') ? 'Plumbing Service' :
                          booking.serviceTitle?.includes('Electrician') ? 'Electrical Service' :
                          booking.serviceTitle?.includes('Mechanic') ? 'Mechanical Service' :
                          booking.serviceTitle?.includes('AC') ? 'AC Repair Service' :
                          booking.serviceTitle?.includes('Carpenter') ? 'Carpentry Service' :
                          booking.serviceTitle?.includes('Mason') ? 'Masonry Service' :
                          booking.serviceTitle?.includes('Painter') ? 'Painting Service' :
                          booking.serviceTitle?.includes('Cleaner') ? 'Cleaning Service' :
                          booking.serviceTitle?.includes('Gardener') ? 'Gardening Service' :
                          booking.serviceTitle?.includes('Cook') ? 'Cooking Service' :
                          booking.serviceTitle?.includes('Driver') ? 'Driving Service' :
                          booking.serviceTitle?.includes('Security') ? 'Security Service' :
                          booking.serviceTitle?.includes('Technician') ? 'Technical Service' :
                          booking.serviceTitle?.includes('Delivery') ? 'Delivery Service' :
                          booking.serviceTitle?.includes('Beautician') ? 'Beauty Service' :
                          'Professional Service')}
                      </ThemedText>
                    </View>

                    {/* Service Description */}
                    {booking.description && (
                      <View style={styles.detailRow}>
                        <Ionicons name="document-text-outline" size={16} color={theme.icon} />
                        <ThemedText style={styles.detailText}>{booking.description}</ThemedText>
                      </View>
                    )}

                    {/* Full Address */}
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color={theme.icon} />
                      <View style={styles.locationDetails}>
                        <ThemedText style={styles.detailText}>{booking.location?.address || 'Address not provided'}</ThemedText>
                        <ThemedText style={styles.cityText}>
                          {booking.location?.city || 
                           (booking.location?.address?.includes('Kathmandu') ? 'Kathmandu' :
                            booking.location?.address?.includes('Pokhara') ? 'Pokhara' :
                            booking.location?.address?.includes('Lalitpur') ? 'Lalitpur' :
                            'Location not specified')}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Worker Information */}
                    {booking.worker && (
                      <View style={styles.detailRow}>
                        <Ionicons name="person-outline" size={16} color={theme.icon} />
                        <View style={styles.workerDetails}>
                          <ThemedText style={styles.detailText}>{booking.worker.name || 'Worker name not available'}</ThemedText>
                          <ThemedText style={styles.workerPhone}>{booking.worker.phone || 'Contact not available'}</ThemedText>
                        </View>
                      </View>
                    )}

                    {/* Scheduling Information */}
                    {booking.scheduledDate && (
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={16} color={theme.icon} />
                        <View style={styles.scheduleDetails}>
                          <ThemedText style={styles.detailText}>
                            {new Date(booking.scheduledDate).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </ThemedText>
                          {booking.scheduledTime && (
                            <ThemedText style={styles.timeText}>at {booking.scheduledTime}</ThemedText>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Pricing Information */}
                    <View style={[styles.pricingContainer, { backgroundColor: theme.inputBackground }]}>
                      <View style={styles.detailRow}>
                        <Ionicons name="cash-outline" size={16} color={theme.icon} />
                        <ThemedText style={[styles.detailText, { color: theme.secondary }]}>Service Fee Breakdown:</ThemedText>
                      </View>
                      <View style={styles.priceRow}>
                        <ThemedText style={[styles.priceLabel, { color: theme.secondary }]}>Base Price:</ThemedText>
                        <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                          Rs. {booking.basePrice || (booking.price ? (booking.price * 0.8).toFixed(0) : '0')}
                        </ThemedText>
                      </View>
                      <View style={styles.priceRow}>
                        <ThemedText style={[styles.priceLabel, { color: theme.secondary }]}>Service Charge:</ThemedText>
                        <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                          Rs. {booking.serviceCharge || (booking.price ? (booking.price * 0.2).toFixed(0) : '0')}
                        </ThemedText>
                      </View>
                      <View style={[styles.priceRow, styles.totalPriceRow, { borderTopColor: theme.border }]}>
                        <ThemedText style={[styles.totalPriceLabel, { color: theme.text }]}>Total Amount:</ThemedText>
                        <ThemedText style={[styles.totalPriceValue, { color: theme.success }]}>
                          Rs. {booking.totalAmount || booking.price || '0'}
                        </ThemedText>
                      </View>
                      {booking.paymentStatus && (
                        <View style={styles.priceRow}>
                          <ThemedText style={[styles.priceLabel, { color: theme.secondary }]}>Payment Status:</ThemedText>
                          <ThemedText style={[
                            styles.paymentStatus,
                            { color: booking.paymentStatus === 'paid' ? theme.success : theme.warning }
                          ]}>
                            {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
                          </ThemedText>
                        </View>
                      )}
                    </View>

                    {/* Booking Information */}
                    <View style={[styles.bookingInfo, { borderTopColor: theme.border }]}>
                      <View style={styles.detailRow}>
                        <Ionicons name="time-outline" size={16} color={theme.icon} />
                        <ThemedText style={[styles.detailText, { color: theme.secondary }]}>
                          Booked on {new Date(booking.createdAt).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </ThemedText>
                      </View>
                      {booking.estimatedDuration && (
                        <View style={styles.detailRow}>
                          <Ionicons name="hourglass-outline" size={16} color={theme.icon} />
                          <ThemedText style={[styles.detailText, { color: theme.secondary }]}>
                            Estimated Duration: {booking.estimatedDuration} hours
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    {canTrack(booking.status) && (
                      <TouchableOpacity
                        style={[styles.trackButton, { backgroundColor: theme.primary }]}
                        onPress={() => router.push(`/live-tracking?bookingId=${booking._id}`)}
                      >
                        <Ionicons name="navigate" size={18} color="#fff" />
                        <ThemedText style={styles.trackButtonText}>Live Track</ThemedText>
                      </TouchableOpacity>
                    )}
                    
                    {canDelete(booking.status) && (
                      <TouchableOpacity
                        style={[styles.deleteButton, { borderColor: theme.danger }]}
                        onPress={() => showDeleteConfirmation(booking)}
                      >
                        <Ionicons name="trash-outline" size={18} color={theme.danger} />
                        <ThemedText style={[styles.deleteButtonText, { color: theme.danger }]}>Cancel</ThemedText>
                      </TouchableOpacity>
                    )}

                    {booking.status === 'completed' && (
                      <TouchableOpacity
                        style={[styles.reviewButton, { borderColor: theme.success }]}
                        onPress={() => router.push(`/review?bookingId=${booking._id}&serviceTitle=${booking.serviceTitle}&workerName=${booking.worker?.name || 'Worker'}`)}
                      >
                        <Ionicons name="star-outline" size={18} color={theme.success} />
                        <ThemedText style={[styles.reviewButtonText, { color: theme.success }]}>Review</ThemedText>
                      </TouchableOpacity>
                    )}

                    {booking.status === 'cancelled' && (
                      <TouchableOpacity
                        style={[styles.removeButton, { backgroundColor: theme.danger + '15', borderColor: theme.danger }]}
                        onPress={() => handleRemoveCancelledBooking(booking._id)}
                      >
                        <Ionicons name="trash" size={20} color={theme.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
        </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <BottomNav />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <Ionicons name="warning-outline" size={48} color={theme.danger} />
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Cancel Service?</ThemedText>
            <ThemedText style={[styles.modalMessage, { color: theme.secondary }]}>
              Are you sure you want to cancel this service booking? This action cannot be undone.
            </ThemedText>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  { backgroundColor: theme.card, borderColor: theme.border },
                  cancelling && { opacity: 0.6 }
                ]}
                disabled={cancelling}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setSelectedBooking(null);
                }}
              >
                <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>Keep Booking</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  { backgroundColor: theme.danger },
                  cancelling && { opacity: 0.6 }
                ]}
                disabled={cancelling}
                onPress={() => selectedBooking && handleDeleteBooking(selectedBooking._id)}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.confirmButtonText}>Cancel Service</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Clear All Confirmation Modal */}
      <Modal
        visible={clearAllModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setClearAllModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.warning} />
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Clear All Bookings?</ThemedText>
            <ThemedText style={[styles.modalMessage, { color: theme.secondary }]}>
              Are you sure you want to clear all {bookings.length} service booking{bookings.length > 1 ? 's' : ''}? This will cancel all pending and active bookings. This action cannot be undone.
            </ThemedText>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  { backgroundColor: theme.card, borderColor: theme.border },
                  clearingAll && { opacity: 0.6 }
                ]}
                disabled={clearingAll}
                onPress={() => setClearAllModalVisible(false)}
              >
                <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  { backgroundColor: theme.danger },
                  clearingAll && { opacity: 0.6 }
                ]}
                disabled={clearingAll}
                onPress={handleClearAllBookings}
              >
                {clearingAll ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.confirmButtonText}>Clear All</ThemedText>
                )}
              </TouchableOpacity>
            </View>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  clearAllContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderRadius: 12,
    marginHorizontal: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  clearAllActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  clearAllActionTextPlain: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
  },
  clearAllHint: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    minHeight: 400,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    opacity: 0.7,
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
  bookingsList: {
    padding: 16,
  },
  bookingCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookingDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  serviceInfo: {
    marginBottom: 16,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  serviceIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  serviceIdLabel: {
    fontSize: 10,
    opacity: 0.6,
    marginRight: 4,
  },
  serviceIdValue: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    opacity: 0.8,
  },
  locationDetails: {
    flex: 1,
    marginLeft: 8,
  },
  cityText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  workerDetails: {
    flex: 1,
    marginLeft: 8,
  },
  workerPhone: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  scheduleDetails: {
    flex: 1,
    marginLeft: 8,
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  pricingContainer: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 13,
    opacity: 0.7,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  totalPriceRow: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  totalPriceLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalPriceValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  bookingInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  trackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 300,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    opacity: 0.8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  confirmButton: {
    backgroundColor: '#F44336',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});


