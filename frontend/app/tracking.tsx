// TRACKING SCREEN - Active booking job tracking with status updates and worker actions
// Features: View job details, update booking status (accepted/in_progress/completed), QR verification, pull-to-refresh
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import { getApiUrl } from '@/lib/config';

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

export default function TrackingScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        setBookings(data.filter((booking: Booking) => 
          ['pending', 'accepted', 'in_progress', 'completed'].includes(booking.status)
        ));
      } else {
        console.error('Failed to fetch bookings:', response.status);
        Alert.alert('Error', 'Failed to load bookings');
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchBookings();
    }
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9800';
      case 'accepted':
        return '#2196F3';
      case 'in_progress':
        return '#9C27B0';
      case 'completed':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Waiting for worker';
      case 'accepted':
        return 'Worker on the way';
      case 'in_progress':
        return 'Work in progress';
      case 'completed':
        return 'Service completed';
      case 'cancelled':
        return 'Service cancelled';
      default:
        return status;
    }
  };

  const handleTrackBooking = (bookingId: string) => {
    router.push(`/live-tracking?bookingId=${bookingId}`);
  };

  const handleBack = () => {
    // Navigate directly to home page
    router.replace('/home');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading your bookings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header with Back Button */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Track Services</Text>
            <View style={styles.placeholder} />
          </View>
          {bookings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No Active Bookings</Text>
              <Text style={styles.emptySubtitle}>
                You don't have any services to track at the moment
              </Text>
              <TouchableOpacity 
                style={styles.exploreButton}
                onPress={() => router.push('/home')}
              >
                <Text style={styles.exploreButtonText}>Explore Services</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.bookingsList}>
              {bookings.map((booking) => (
                <View key={booking._id} style={styles.bookingCard}>
                  {/* Status Header */}
                  <View style={styles.statusHeader}>
                    <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(booking.status) }]} />
                    <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
                  </View>

                  {/* Service Details */}
                  <View style={styles.serviceInfo}>
                    {/* Service Header */}
                    <View style={styles.serviceHeader}>
                      <Text style={styles.serviceTitle}>
                        {booking.serviceName || booking.serviceTitle || 'Service Title Not Available'}
                      </Text>
                      <View style={styles.serviceIdContainer}>
                        <Text style={styles.serviceIdLabel}>ID:</Text>
                        <Text style={styles.serviceIdValue}>
                          {booking._id?.substring(0, 8).toUpperCase() || 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {/* Service Category */}
                    <View style={styles.detailRow}>
                      <Ionicons name="construct-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>
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
                         'Professional Service'}
                      </Text>
                    </View>

                    {/* Service Description */}
                    {booking.description && (
                      <View style={styles.detailRow}>
                        <Ionicons name="document-text-outline" size={16} color="#666" />
                        <Text style={styles.detailText}>{booking.description}</Text>
                      </View>
                    )}

                    {/* Location Details */}
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#666" />
                      <View style={styles.locationDetails}>
                        <Text style={styles.detailText}>{booking.location?.address || 'Address not provided'}</Text>
                        <Text style={styles.cityText}>
                          {booking.location?.city || 
                           (booking.location?.address?.includes('Kathmandu') ? 'Kathmandu' :
                            booking.location?.address?.includes('Pokhara') ? 'Pokhara' :
                            booking.location?.address?.includes('Lalitpur') ? 'Lalitpur' :
                            'Location not specified')}
                        </Text>
                      </View>
                    </View>

                    {/* Worker Information */}
                    {booking.worker && (
                      <View style={styles.detailRow}>
                        <Ionicons name="person-outline" size={16} color="#666" />
                        <View style={styles.workerDetails}>
                          <Text style={styles.detailText}>{booking.worker.name || 'Worker name not available'}</Text>
                          <Text style={styles.workerPhone}>{booking.worker.phone || 'Contact not available'}</Text>
                        </View>
                      </View>
                    )}

                    {/* Scheduling Information */}
                    {booking.scheduledDate && (
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={16} color="#666" />
                        <View style={styles.scheduleDetails}>
                          <Text style={styles.detailText}>
                            {new Date(booking.scheduledDate).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </Text>
                          {booking.scheduledTime && (
                            <Text style={styles.timeText}>at {booking.scheduledTime}</Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Work Start Time */}
                    {booking.startTime && (
                      <View style={styles.detailRow}>
                        <Ionicons name="play-circle-outline" size={16} color="#4CAF50" />
                        <Text style={styles.detailText}>
                          Work started: {new Date(booking.startTime).toLocaleString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Text>
                      </View>
                    )}

                    {/* Pricing Information */}
                    <View style={styles.pricingContainer}>
                      <View style={styles.detailRow}>
                        <Ionicons name="cash-outline" size={16} color="#666" />
                        <Text style={styles.detailText}>Service Fee Breakdown:</Text>
                      </View>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Base Price:</Text>
                        <Text style={styles.priceValue}>
                          Rs. {booking.basePrice || (booking.price ? (booking.price * 0.8).toFixed(0) : '0')}
                        </Text>
                      </View>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Service Charge:</Text>
                        <Text style={styles.priceValue}>
                          Rs. {booking.serviceCharge || (booking.price ? (booking.price * 0.2).toFixed(0) : '0')}
                        </Text>
                      </View>
                      <View style={[styles.priceRow, styles.totalPriceRow]}>
                        <Text style={styles.totalPriceLabel}>Total Amount:</Text>
                        <Text style={styles.totalPriceValue}>
                          Rs. {booking.totalAmount || booking.price || '0'}
                        </Text>
                      </View>
                      {booking.paymentStatus && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Payment Status:</Text>
                          <Text style={[
                            styles.paymentStatus,
                            { color: booking.paymentStatus === 'paid' ? '#4CAF50' : '#FF9800' }
                          ]}>
                            {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Estimated Duration */}
                    {booking.estimatedDuration && (
                      <View style={styles.detailRow}>
                        <Ionicons name="hourglass-outline" size={16} color="#666" />
                        <Text style={styles.detailText}>
                          Estimated Duration: {booking.estimatedDuration} hours
                        </Text>
                      </View>
                    )}

                    {/* Booking Information */}
                    <View style={styles.bookingInfo}>
                      <View style={styles.detailRow}>
                        <Ionicons name="time-outline" size={16} color="#666" />
                        <Text style={styles.detailText}>
                          Booked on {new Date(booking.createdAt).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Action Button */}
                  <TouchableOpacity
                    style={[
                      styles.trackButton,
                      booking.status === 'completed' && styles.completedButton
                    ]}
                    onPress={() => handleTrackBooking(booking._id)}
                    disabled={booking.status === 'completed'}
                  >
                    <Ionicons 
                      name={booking.status === 'completed' ? 'checkmark-circle' : 'navigate'} 
                      size={20} 
                      color={booking.status === 'completed' ? '#4CAF50' : '#fff'} 
                    />
                    <Text style={[
                      styles.trackButtonText,
                      booking.status === 'completed' && styles.completedButtonText
                    ]}>
                      {booking.status === 'completed' ? 'Completed' : 'Track Service'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <BottomNav />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
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
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: '#4A90E2',
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
    backgroundColor: '#fff',
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
    marginBottom: 12,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
    color: '#333',
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
    color: '#666',
  },
  serviceIdValue: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#333',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  locationDetails: {
    flex: 1,
    marginLeft: 0,
  },
  cityText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
    color: '#666',
  },
  workerDetails: {
    flex: 1,
    marginLeft: 0,
  },
  workerPhone: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
    color: '#666',
  },
  scheduleDetails: {
    flex: 1,
    marginLeft: 0,
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
    color: '#666',
  },
  pricingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
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
    color: '#666',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  totalPriceRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  totalPriceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalPriceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  paymentStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  bookingInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  completedButton: {
    backgroundColor: '#E8F5E9',
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  completedButtonText: {
    color: '#4CAF50',
  },
});


