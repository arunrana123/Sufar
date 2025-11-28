// MY BOOKINGS SCREEN - Displays user's service bookings with status, map preview, and tracking
// Features: Real-time updates via Socket.IO, pull-to-refresh, mini-map preview, live tracking navigation
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { socketService } from '@/lib/SocketService';
import { getApiUrl } from '@/lib/config';
import { MapView, Marker, Polyline, PROVIDER_GOOGLE } from '@/components/react-native-maps';

const { width, height } = Dimensions.get('window');

interface Booking {
  _id: string;
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
  workerId?: {
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
  rating?: number;
  review?: string;
}

export default function MyBookingsScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [trackingData, setTrackingData] = useState<any>(null);
  const mapRef = useRef<any>(null);

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
    }
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'accepted':
        return '#2196F3';
      case 'in_progress':
        return '#9C27B0';
      case 'completed':
        return '#4CAF50';
      case 'cancelled':
      case 'rejected':
        return '#EF4444';
      default:
        return '#666';
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
    setSelectedBooking(booking);
    setShowTracking(true);
    fetchTrackingData(booking._id);
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

  const handlePayment = (booking: Booking) => {
    router.push({
      pathname: '/payment',
      params: {
        bookingId: booking._id,
        amount: booking.price.toString(),
        serviceName: booking.serviceName,
      },
    });
  };

  const handleReview = (booking: Booking) => {
    router.push({
      pathname: '/review',
      params: {
        bookingId: booking._id,
        serviceName: booking.serviceName,
        workerName: booking.workerId ? `${booking.workerId.firstName} ${booking.workerId.lastName}` : 'Worker',
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/menu')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Bookings</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {bookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptySubtitle}>Book a service to get started</Text>
              <TouchableOpacity style={styles.browseButton} onPress={() => router.replace('/home')}>
                <Text style={styles.browseButtonText}>Browse Services</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Daily Bookings Grouped by Date */}
              {(() => {
                const groupedBookings = groupBookingsByDate(bookings);
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
                                  {getStatusText(booking.status)}
                                </Text>
                              </View>
                            </View>

                            {booking.workerId && (
                              <View style={styles.workerInfo}>
                                <Ionicons name="person-circle-outline" size={20} color="#4A90E2" />
                                <Text style={styles.workerName}>{booking.workerId ? `${booking.workerId.firstName} ${booking.workerId.lastName}` : 'No worker assigned'}</Text>
                                <View style={styles.ratingContainer}>
                                  <Ionicons name="star" size={12} color="#FFD700" />
                                  <Text style={styles.ratingText}>{booking.workerId?.rating || 0}</Text>
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
                                  {booking.paymentStatus !== 'paid' && (
                                    <TouchableOpacity
                                      style={styles.payButton}
                                      onPress={() => handlePayment(booking)}
                                    >
                                      <Ionicons name="card" size={16} color="#fff" />
                                      <Text style={styles.payButtonText}>Make Payment</Text>
                                    </TouchableOpacity>
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
                                  onPress={() => handleViewTracking(booking)}
                                >
                                  <Ionicons name="location" size={16} color="#fff" />
                                  <Text style={styles.trackButtonText}>Live Tracking</Text>
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
                        title={selectedBooking.workerId ? `${selectedBooking.workerId.firstName} ${selectedBooking.workerId.lastName}` : 'Worker'}
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
                {selectedBooking.workerId && (
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
                        {selectedBooking.workerId.firstName} {selectedBooking.workerId.lastName}
                      </Text>
                      <Text style={styles.workerPhone}>
                        {selectedBooking.workerId.phone || 'Worker'}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.callButton}
                      onPress={() => {
                        const phone = selectedBooking.workerId?.phone;
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
                      disabled={!selectedBooking.workerId?.phone}
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
    backgroundColor: '#F8F9FA',
  },
  safe: {
    flex: 1,
  },
  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
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
    backgroundColor: '#FFA500',
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
    backgroundColor: '#4A90E2',
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
    backgroundColor: '#4CAF50',
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
    backgroundColor: '#FF9800',
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
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#4A90E2',
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
});

