// TRACKING SCREEN - Active booking job tracking with status updates and worker actions
// Features: View job details, update booking status (accepted/in_progress/completed), QR verification, pull-to-refresh
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
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

type FilterType = 'all' | 'completed' | 'in_progress' | 'pending';

export default function TrackingScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

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
        return theme.warning;
      case 'accepted':
        return theme.primary;
      case 'in_progress':
        return theme.info;
      case 'completed':
        return theme.success;
      case 'cancelled':
        return theme.danger;
      default:
        return theme.secondary;
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

  // Filter bookings based on active filter
  const filteredBookings = bookings.filter((booking) => {
    switch (activeFilter) {
      case 'completed':
        return booking.status === 'completed';
      case 'in_progress':
        return ['accepted', 'in_progress'].includes(booking.status);
      case 'pending':
        return booking.status === 'pending';
      case 'all':
      default:
        return true;
    }
  });

  // Get counts for each filter
  const filterCounts = {
    all: bookings.length,
    completed: bookings.filter(b => b.status === 'completed').length,
    in_progress: bookings.filter(b => ['accepted', 'in_progress'].includes(b.status)).length,
    pending: bookings.filter(b => b.status === 'pending').length,
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.secondary }]}>Loading your bookings...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe}>
        {/* Header with Back Button */}
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <Pressable 
            style={styles.backButton} 
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </Pressable>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>Track Services</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Filter Buttons */}
        {bookings.length > 0 && (
          <View style={styles.filterContainer}>
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
                    activeFilter === 'in_progress' && styles.filterButtonActive,
                    activeFilter === 'in_progress' && { backgroundColor: theme.info }
                  ]}
                  onPress={() => setActiveFilter('in_progress')}
                >
                  <Ionicons 
                    name="hourglass" 
                    size={16} 
                    color={activeFilter === 'in_progress' ? '#fff' : theme.info} 
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[
                    styles.filterButtonText,
                    activeFilter === 'in_progress' && styles.filterButtonTextActive,
                    activeFilter === 'in_progress' && { color: '#fff' }
                  ]}>
                    In Progress ({filterCounts.in_progress})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    activeFilter === 'pending' && styles.filterButtonActive,
                    activeFilter === 'pending' && { backgroundColor: theme.warning }
                  ]}
                  onPress={() => setActiveFilter('pending')}
                >
                  <Ionicons 
                    name="time-outline" 
                    size={16} 
                    color={activeFilter === 'pending' ? '#fff' : theme.warning} 
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[
                    styles.filterButtonText,
                    activeFilter === 'pending' && styles.filterButtonTextActive,
                    activeFilter === 'pending' && { color: '#fff' }
                  ]}>
                    Pending ({filterCounts.pending})
                  </Text>
                </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredBookings.length === 0 && bookings.length > 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="filter-outline" size={64} color={theme.icon} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No {activeFilter === 'all' ? '' : activeFilter === 'completed' ? 'Completed' : activeFilter === 'in_progress' ? 'In Progress' : 'Pending'} Bookings
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.secondary }]}>
                {activeFilter === 'all' 
                  ? 'You don\'t have any bookings at the moment'
                  : `You don't have any ${activeFilter === 'completed' ? 'completed' : activeFilter === 'in_progress' ? 'in progress' : 'pending'} services to track`
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
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={64} color={theme.icon} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Active Bookings</Text>
              <Text style={[styles.emptySubtitle, { color: theme.secondary }]}>
                You don't have any services to track at the moment
              </Text>
              <TouchableOpacity 
                style={[styles.exploreButton, { backgroundColor: theme.tint }]}
                onPress={() => router.push('/home')}
              >
                <Text style={styles.exploreButtonText}>Explore Services</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.bookingsList}>
              {filteredBookings.map((booking) => (
                <View key={booking._id} style={[styles.bookingCard, { backgroundColor: theme.card }]}>
                  {/* Status Header */}
                  <View style={styles.statusHeader}>
                    <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(booking.status) }]} />
                    <Text style={[styles.statusText, { color: theme.text }]}>{getStatusText(booking.status)}</Text>
                  </View>

                  {/* Service Details */}
                  <View style={styles.serviceInfo}>
                    {/* Service Header */}
                    <View style={styles.serviceHeader}>
                      <Text style={[styles.serviceTitle, { color: theme.text }]}>
                        {booking.serviceName || booking.serviceTitle || 'Service Title Not Available'}
                      </Text>
                      <View style={[styles.serviceIdContainer, { backgroundColor: theme.card }]}>
                        <Text style={[styles.serviceIdLabel, { color: theme.secondary }]}>ID:</Text>
                        <Text style={[styles.serviceIdValue, { color: theme.text }]}>
                          {booking._id?.substring(0, 8).toUpperCase() || 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {/* Service Category */}
                    <View style={styles.detailRow}>
                      <Ionicons name="construct-outline" size={16} color={theme.icon} />
                      <Text style={[styles.detailText, { color: theme.secondary }]}>
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
                        <Ionicons name="document-text-outline" size={16} color={theme.icon} />
                        <Text style={[styles.detailText, { color: theme.secondary }]}>{booking.description}</Text>
                      </View>
                    )}

                    {/* Location Details */}
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color={theme.icon} />
                      <View style={styles.locationDetails}>
                        <Text style={[styles.detailText, { color: theme.secondary }]}>{booking.location?.address || 'Address not provided'}</Text>
                        <Text style={[styles.cityText, { color: theme.icon }]}>
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
                        <Ionicons name="person-outline" size={16} color={theme.icon} />
                        <View style={styles.workerDetails}>
                          <Text style={[styles.detailText, { color: theme.secondary }]}>{booking.worker.name || 'Worker name not available'}</Text>
                          <Text style={[styles.workerPhone, { color: theme.icon }]}>{booking.worker.phone || 'Contact not available'}</Text>
                        </View>
                      </View>
                    )}

                    {/* Scheduling Information */}
                    {booking.scheduledDate && (
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={16} color={theme.icon} />
                        <View style={styles.scheduleDetails}>
                          <Text style={[styles.detailText, { color: theme.secondary }]}>
                            {new Date(booking.scheduledDate).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </Text>
                          {booking.scheduledTime && (
                            <Text style={[styles.timeText, { color: theme.icon }]}>at {booking.scheduledTime}</Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Work Start Time */}
                    {booking.startTime && (
                      <View style={styles.detailRow}>
                        <Ionicons name="play-circle-outline" size={16} color={theme.success} />
                        <Text style={[styles.detailText, { color: theme.secondary }]}>
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
                    <View style={[styles.pricingContainer, { backgroundColor: theme.inputBackground }]}>
                      <View style={styles.detailRow}>
                        <Ionicons name="cash-outline" size={16} color={theme.icon} />
                        <Text style={[styles.detailText, { color: theme.secondary }]}>Service Fee Breakdown:</Text>
                      </View>
                      <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: theme.secondary }]}>Base Price:</Text>
                        <Text style={[styles.priceValue, { color: theme.text }]}>
                          Rs. {booking.basePrice || (booking.price ? (booking.price * 0.8).toFixed(0) : '0')}
                        </Text>
                      </View>
                      <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: theme.secondary }]}>Service Charge:</Text>
                        <Text style={[styles.priceValue, { color: theme.text }]}>
                          Rs. {booking.serviceCharge || (booking.price ? (booking.price * 0.2).toFixed(0) : '0')}
                        </Text>
                      </View>
                      <View style={[styles.priceRow, styles.totalPriceRow, { borderTopColor: theme.border }]}>
                        <Text style={[styles.totalPriceLabel, { color: theme.text }]}>Total Amount:</Text>
                        <Text style={[styles.totalPriceValue, { color: theme.success }]}>
                          Rs. {booking.totalAmount || booking.price || '0'}
                        </Text>
                      </View>
                      {booking.paymentStatus && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Payment Status:</Text>
                          <Text style={[
                            styles.paymentStatus,
                            { color: booking.paymentStatus === 'paid' ? theme.success : theme.warning }
                          ]}>
                            {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Estimated Duration */}
                    {booking.estimatedDuration && (
                      <View style={styles.detailRow}>
                        <Ionicons name="hourglass-outline" size={16} color={theme.icon} />
                        <Text style={[styles.detailText, { color: theme.secondary }]}>
                          Estimated Duration: {booking.estimatedDuration} hours
                        </Text>
                      </View>
                    )}

                    {/* Booking Information */}
                    <View style={[styles.bookingInfo, { borderTopColor: theme.border }]}>
                      <View style={styles.detailRow}>
                        <Ionicons name="time-outline" size={16} color={theme.icon} />
                        <Text style={[styles.detailText, { color: theme.secondary }]}>
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
                      { backgroundColor: booking.status === 'completed' ? theme.success + '20' : theme.primary },
                    ]}
                    onPress={() => handleTrackBooking(booking._id)}
                    disabled={booking.status === 'completed'}
                  >
                    <Ionicons 
                      name={booking.status === 'completed' ? 'checkmark-circle' : 'navigate'} 
                      size={20} 
                      color={booking.status === 'completed' ? theme.success : '#fff'} 
                    />
                    <Text style={[
                      styles.trackButtonText,
                      { color: booking.status === 'completed' ? theme.success : '#fff' }
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
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
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
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
  },
  workerDetails: {
    flex: 1,
    marginLeft: 0,
  },
  workerPhone: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  scheduleDetails: {
    flex: 1,
    marginLeft: 0,
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
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  trackButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    fontWeight: '700',
  },
});


