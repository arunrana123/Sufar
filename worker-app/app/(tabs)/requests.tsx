// REQUESTS SCREEN - Displays incoming and assigned booking requests for worker
// Features: Accept/reject bookings, real-time updates via Socket.IO, pull-to-refresh, navigate to job details
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNav from '@/components/BottomNav';
import IncomingRequestBanner from '@/components/IncomingRequestBanner';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';
import { bookingRequestListener } from '@/lib/BookingRequestListener';
import { router } from 'expo-router';
import ToastNotification from '@/components/ToastNotification';

interface Booking {
  _id: string;
  userId: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  serviceTitle: string;
  location: {
    address: string;
    city: string;
  };
  price: number;
  status: string;
  createdAt: string;
}

export default function RequestsScreen() {
  const { worker } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [incomingBooking, setIncomingBooking] = useState<any | null>(null);
  
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
  // Triggered by: Booking accept/reject, cancellations, updates
  const showToast = (message: string, title?: string, type?: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ visible: true, message, title, type });
  };

  const fetchBookings = async (isRefresh = false) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/worker/${worker?.id}`);
      
      if (response.ok) {
        const data = await response.json();
        setBookings(data);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (worker?.id) {
      fetchBookings();
      
      // Connect to socket for real-time updates
      socketService.connect(worker.id, 'worker');
      
      // Start booking request listener for instant popup on new requests
      bookingRequestListener.startListening(worker.id, (booking: any) => {
        console.log('📨 INCOMING REQUEST received in requests page:', booking);
        setIncomingBooking(booking);
        // Auto-refresh to show new request in list
        fetchBookings();
      });
      
      // Listen for booking cancellations - only for bookings assigned to this worker
      socketService.on('booking:cancelled', (data: any) => {
        console.log('📢 Booking cancelled event received in worker app:', data);
        // Only handle if this cancellation is for the current worker
        if (data.workerId === worker.id) {
          showToast(
            data.message || 'A booking you were assigned to has been cancelled by the customer.',
            'Booking Cancelled',
            'error'
          );
          fetchBookings();
        }
      });
      
      // Listen for booking updates
      socketService.on('booking:updated', (updatedBooking: any) => {
        console.log('📢 Booking updated event received in worker app:', updatedBooking);
        if (updatedBooking.workerId === worker.id || updatedBooking._id) {
          // Refresh bookings to show updated status
          fetchBookings();
        }
      });
    }
    
    return () => {
      socketService.off('booking:cancelled');
      socketService.off('booking:updated');
    };
  }, [worker?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings(true);
  };

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const acceptedBookings = bookings.filter(b => b.status === 'accepted');

  const handleAccept = async (bookingId: string) => {
    try {
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
        const booking = await response.json();
        
        // Show toast notification
        showToast(
          'Opening navigation to customer location...',
          'Request Accepted!',
          'success'
        );
        
        // Navigate to job navigation map after a short delay
        setTimeout(() => {
          router.push({
            pathname: '/job-navigation',
            params: { bookingId: bookingId }
          });
        }, 500);
        
        fetchBookings();
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
                showToast(
                  'Request rejected. It will be sent to another worker.',
                  'Request Rejected',
                  'info'
                );
                fetchBookings();
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

        <ScrollView 
          style={styles.content} 
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
                      <Text style={styles.detailText}>{booking.serviceTitle}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>{booking.location.city} - {booking.location.address}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>Rs. {booking.price}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="call-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>{booking.userId.phone}</Text>
                    </View>
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
                      <Text style={styles.detailText}>{booking.serviceTitle}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>{booking.location.city}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>Rs. {booking.price}</Text>
                    </View>
                  </View>

                  <TouchableOpacity 
                    style={styles.viewDetailsButton}
                    onPress={() => {
                      router.push({
                        pathname: '/job-navigation',
                        params: { bookingId: booking._id }
                      });
                    }}
                  >
                    <Text style={styles.viewDetailsText}>Start Job</Text>
                    <Ionicons name="chevron-forward" size={16} color="#FF7A2C" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {bookings.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No requests yet</Text>
              <Text style={styles.emptySubtitle}>New job requests will appear here</Text>
            </View>
          )}
        </ScrollView>
        
        {/* Incoming Request Banner - Instant Popup */}
        <IncomingRequestBanner
          visible={!!incomingBooking}
          booking={incomingBooking}
          onReview={() => {
            setIncomingBooking(null);
            // Already on requests page, just refresh
            fetchBookings();
          }}
          onAccept={async () => {
            try {
              if (!incomingBooking?._id) {
                Alert.alert('Error', 'Invalid booking request');
                setIncomingBooking(null);
                return;
              }

              if (!worker?.id) {
                Alert.alert('Error', 'Worker ID not found. Please login again.');
                return;
              }

              console.log('✅ Accepting booking from requests page:', {
                bookingId: incomingBooking._id,
                workerId: worker.id,
              });

              const apiUrl = getApiUrl();
              const res = await fetch(`${apiUrl}/api/bookings/${incomingBooking._id}/accept`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workerId: worker.id }),
              });

              if (res.ok) {
                const booking = await res.json();
                console.log('✅ Booking accepted successfully:', booking._id);
                
                // Clear incoming booking
                setIncomingBooking(null);
                
                // Refresh to show accepted request
                fetchBookings();
              } else {
                const errorText = await res.text();
                console.error('❌ Failed to accept booking:', res.status, errorText);
                Alert.alert('Error', 'Failed to accept booking. Please try again.');
              }
            } catch (e) {
              console.error('❌ Accept from banner failed:', e);
              Alert.alert('Error', 'Network error. Please check your connection and try again.');
            }
          }}
          onDismiss={() => setIncomingBooking(null)}
        />
        
        {/* Bottom Navigation */}
        <BottomNav />
      </SafeAreaView>

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
  viewDetailsButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  viewDetailsText: {
    color: '#FF7A2C',
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
  },
});

