// LIVE TRACKING SCREEN - Real-time worker location tracking with map, route visualization, and ETA
// Features: Socket.IO real-time updates, Google Maps integration, worker info, status updates, call/message worker
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';
import { useAuth } from '@/contexts/AuthContext';

let MapComponent: any;
let MarkerComponent: any;
let PolylineComponent: any;
let GOOGLE_PROVIDER: any;

if (Platform.OS === 'web') {
  const webMaps = require('@/components/react-native-maps');
  MapComponent = webMaps.MapView;
  MarkerComponent = webMaps.Marker;
  PolylineComponent = webMaps.Marker; // simple fallback
  GOOGLE_PROVIDER = webMaps.PROVIDER_GOOGLE;
} else {
  const nativeMaps = require('react-native-maps');
  MapComponent = nativeMaps.default;
  MarkerComponent = nativeMaps.Marker;
  PolylineComponent = nativeMaps.Polyline;
  GOOGLE_PROVIDER = nativeMaps.PROVIDER_GOOGLE;
}

const { width, height } = Dimensions.get('window');

interface BookingDetails {
  _id: string;
  serviceTitle?: string;
  serviceName?: string;
  serviceCategory?: string;
  status: string;
  location: {
    address?: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  workerLocation?: {
    latitude: number;
    longitude: number;
    lastUpdated?: string;
  } | null;
  worker?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    profileImage?: string;
    image?: string;
  } | null;
  workerId?: string | {
    firstName?: string;
    lastName?: string;
    name?: string;
    phone?: string;
    profileImage?: string;
    image?: string;
  };
  startTime?: string;
  estimatedDuration?: number;
  remainingTime?: number;
}

export default function LiveTrackingScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const bookingId = Array.isArray(params.bookingId)
    ? params.bookingId[0]
    : params.bookingId as string;

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workerLocation, setWorkerLocation] = useState<any>(null);
  const [navStatus, setNavStatus] = useState<string>('pending');
  const [workStatus, setWorkStatus] = useState<string>('not_started');
  const [workStartTime, setWorkStartTime] = useState<Date | null>(null);
  const [workDuration, setWorkDuration] = useState<number>(0);
  const [eta, setEta] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);
  const [workerData, setWorkerData] = useState<any>(null);
  const [locationTrackingStarted, setLocationTrackingStarted] = useState<boolean>(false);
  const mapRef = useRef<any>(null);

  const fetchBookingDetails = async () => {
    try {
      setError(null);
      if (!bookingId) {
        setError('No booking ID provided');
        setLoading(false);
        return;
      }

      const apiUrl = getApiUrl();
      console.log('🔗 Fetching booking details from:', `${apiUrl}/api/bookings/${bookingId}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Fetched booking details:', {
          id: data._id,
          status: data.status,
          hasWorker: !!data.worker,
          hasWorkerId: !!data.workerId,
          hasWorkerLocation: !!data.workerLocation,
          workerName: data.worker?.name,
        });
        setBooking(data);
        
        // Set work status and start time if booking is in progress
        if (data.status === 'in_progress') {
          setWorkStatus('in_progress');
          if (data.workStartTime) {
            const startTime = new Date(data.workStartTime);
            setWorkStartTime(startTime);
            console.log('⏰ Work start time loaded from booking:', startTime.toISOString());
          }
        } else if (data.status === 'completed') {
          setWorkStatus('completed');
        }
        
        // Fetch worker details if workerId exists but worker data is incomplete or missing
        if (data.workerId && (!data.worker || !data.worker.name || !data.worker.phone || !data.worker.profileImage)) {
          try {
            const workerId = typeof data.workerId === 'string' ? data.workerId : data.workerId._id || data.workerId;
            console.log('🔍 Fetching worker details for ID:', workerId);
            const workerResponse = await fetch(`${apiUrl}/api/workers/${workerId}`);
            if (workerResponse.ok) {
              const workerDetails = await workerResponse.json();
              console.log('✅ Fetched worker details:', {
                name: workerDetails.name,
                phone: workerDetails.phone,
                profileImage: workerDetails.profileImage,
              });
              setWorkerData(workerDetails);
              
              // Extract name into firstName/lastName if needed
              const nameParts = workerDetails.name ? workerDetails.name.trim().split(' ') : [];
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';
              
              // Update booking with complete worker data
              setBooking({
                ...data,
                worker: {
                  name: workerDetails.name,
                  firstName: firstName || workerDetails.name,
                  lastName: lastName,
                  phone: workerDetails.phone,
                  profileImage: workerDetails.profileImage || workerDetails.documents?.profilePhoto,
                  image: workerDetails.profileImage || workerDetails.documents?.profilePhoto,
                }
              });
            } else {
              console.warn('⚠️ Failed to fetch worker details:', workerResponse.status);
            }
          } catch (err) {
            console.error('❌ Error fetching worker details:', err);
          }
        } else if (data.worker) {
          // Worker data already exists in response, use it
          console.log('✅ Worker data already in booking response:', data.worker);
        }

        // Fit map to show both markers
        if (
          Platform.OS !== 'web' &&
          data.workerLocation &&
          data.location?.coordinates &&
          mapRef.current?.fitToCoordinates
        ) {
          setTimeout(() => {
            try {
              mapRef.current?.fitToCoordinates(
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
            } catch (e) {
              console.warn('Map fit error:', e);
            }
          }, 500);
        }
      } else {
        const errorText = await response.text();
        const errorMessage = `Failed to fetch booking details: ${response.status} - ${errorText}`;
        console.error('❌', errorMessage);
        setError(errorMessage);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        const errorMessage = 'Request timeout. Please check your network connection.';
        console.error('⏱️', errorMessage);
        setError(errorMessage);
      } else if (error.message === 'Network request failed' || error.message?.includes('NetworkError')) {
        const errorMessage = 'Network error. Please check your internet connection and ensure the backend server is running.';
        console.error('🌐 Network error:', error);
        setError(errorMessage);
      } else {
        const errorMessage = `Error fetching booking details: ${error.message || error}`;
        console.error('❌', errorMessage);
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingId) {
      Alert.alert(
        'Missing booking',
        'No booking ID provided for live tracking.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }

    fetchBookingDetails();

    // Connect to socket for real-time updates
    if (user?.id) {
      socketService.connect(user.id, 'user');
    }

    // Listen for booking accepted
    const handleBookingAccepted = (data: any) => {
      if (data.bookingId === bookingId || data.booking?.id === bookingId) {
        console.log('✅ Booking accepted:', data);
        setNavStatus('accepted');
        // Refresh booking details
        setTimeout(() => {
          fetchBookingDetails();
        }, 500);
      }
    };

    // Listen for location tracking started
    const handleLocationTrackingStarted = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('📍 Location tracking started');
        setLocationTrackingStarted(true);
        setNavStatus('tracking');
      }
    };

    // Listen for worker location updates
    const handleWorkerLocation = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('📍 Worker location update:', data);
        setWorkerLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        
        // Calculate distance and ETA
        if (booking?.location?.coordinates) {
          const dist = calculateDistance(
            data.latitude,
            data.longitude,
            booking.location.coordinates.latitude,
            booking.location.coordinates.longitude
          );
          setDistance(dist);
          setEta(Math.ceil(dist * 2)); // 2 min per km
        }
      }
    };

    // Listen for navigation status changes
    const handleNavigationStarted = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('🚗 Worker started navigation');
        setNavStatus('navigating');
      }
    };

    const handleNavigationArrived = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('📍 Worker arrived');
        setNavStatus('arrived');
        Alert.alert('Worker Arrived!', 'The worker has arrived at your location');
      }
    };

    const handleNavigationEnded = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('✅ Navigation ended');
        setNavStatus('ended');
      }
    };

    // Listen for work status changes
    const handleWorkStarted = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('🔨 Work started at:', data.startTime || data.timestamp);
        setWorkStatus('in_progress');
        // Set work start time from the event data
        if (data.startTime || data.timestamp) {
          const startTime = new Date(data.startTime || data.timestamp);
          setWorkStartTime(startTime);
          console.log('⏰ Work start time set to:', startTime.toISOString());
        }
        // Update booking status in UI
        if (booking) {
          setBooking({
            ...booking,
            status: 'in_progress',
          });
        }
        // Show alert
        Alert.alert(
          'Work Started!',
          'The worker has started working on your service. Timer is running.',
          [{ text: 'OK' }]
        );
      }
    };

    const handleWorkCompleted = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('✅ Work completed:', data);
        setWorkStatus('completed');
        // Update booking status in UI
        if (booking) {
          setBooking({
            ...booking,
            status: 'completed',
          });
        }
        
        const workerName = data.workerName || booking?.workerId?.firstName || 'Worker';
        const serviceName = data.serviceName || booking?.serviceName || 'Service';
        const totalAmount = booking?.price || data.price || 0;
        const paymentMethod = data.paymentMethod;
        
        // Show payment confirmation dialog
        if (paymentMethod === 'cash') {
          // Cash payment - confirm and go to review
          Alert.alert(
            '✅ Service Completed!',
            `${workerName} has completed your ${serviceName}!\n\n💵 Total Amount: Rs. ${totalAmount}\n\nPlease pay cash to the worker.`,
            [
              {
                text: 'Payment Done',
                onPress: () => {
                  router.push({
                    pathname: '/review',
                    params: {
                      bookingId: bookingId,
                      serviceTitle: serviceName,
                      workerName: workerName,
                      workerId: booking?.workerId?._id || data.workerId,
                      amount: totalAmount,
                    },
                  });
                },
              },
            ]
          );
        } else if (paymentMethod === 'online') {
          // Online payment - show payment options
          Alert.alert(
            '✅ Service Completed!',
            `${workerName} has completed your ${serviceName}!\n\n💳 Total Amount: Rs. ${totalAmount}\n\nPlease complete online payment.`,
            [
              {
                text: 'Pay Now',
                onPress: () => {
                  // For now, simulate online payment success
                  Alert.alert(
                    'Online Payment',
                    'Payment options:\n\n• eSewa\n• Khalti\n• Bank Transfer',
                    [
                      {
                        text: 'Payment Completed',
                        onPress: () => {
                          router.push({
                            pathname: '/review',
                            params: {
                              bookingId: bookingId,
                              serviceTitle: serviceName,
                              workerName: workerName,
                              workerId: booking?.workerId?._id || data.workerId,
                              amount: totalAmount,
                            },
                          });
                        },
                      },
                    ]
                  );
                },
              },
            ]
          );
        } else {
          // No payment method specified - go directly to review
          Alert.alert(
            '✅ Service Completed!',
            `${workerName} has completed your ${serviceName}!\n\nTotal Amount: Rs. ${totalAmount}`,
            [
              {
                text: 'Rate & Review',
                onPress: () => {
                  router.push({
                    pathname: '/review',
                    params: {
                      bookingId: bookingId,
                      serviceTitle: serviceName,
                      workerName: workerName,
                      workerId: booking?.workerId?._id || data.workerId,
                      amount: totalAmount,
                    },
                  });
                },
              },
            ]
          );
        }
      }
    };

    // Listen for booking status updates (from backend status endpoint)
    const handleBookingUpdated = (updatedBooking: any) => {
      if (updatedBooking._id === bookingId || updatedBooking.id === bookingId) {
        console.log('📝 Booking updated event received in live-tracking:', updatedBooking);
        
        // Update booking state
        if (updatedBooking.status) {
          setBooking(prev => prev ? { ...prev, status: updatedBooking.status } : prev);
          
          // Update work status based on booking status
          if (updatedBooking.status === 'in_progress') {
            setWorkStatus('in_progress');
            // If workStartTime is provided, set it
            if (updatedBooking.workStartTime) {
              const startTime = new Date(updatedBooking.workStartTime);
              setWorkStartTime(startTime);
            }
          } else if (updatedBooking.status === 'completed') {
            setWorkStatus('completed');
          }
        }
        
        // Refresh booking details to get latest data
        setTimeout(() => {
          fetchBookingDetails();
        }, 500);
      }
    };

    // Register all socket listeners
    socketService.on('booking:accepted', handleBookingAccepted);
    socketService.on('location:tracking:started', handleLocationTrackingStarted);
    socketService.on('worker:location', handleWorkerLocation);
    socketService.on('navigation:started', handleNavigationStarted);
    socketService.on('navigation:arrived', handleNavigationArrived);
    socketService.on('navigation:ended', handleNavigationEnded);
    socketService.on('work:started', handleWorkStarted);
    socketService.on('work:completed', handleWorkCompleted);
    socketService.on('booking:updated', handleBookingUpdated);

    // Poll for updates every 30 seconds (backup)
    const interval = setInterval(fetchBookingDetails, 30000);

    return () => {
      clearInterval(interval);
      socketService.off('booking:accepted', handleBookingAccepted);
      socketService.off('location:tracking:started', handleLocationTrackingStarted);
      socketService.off('worker:location', handleWorkerLocation);
      socketService.off('navigation:started', handleNavigationStarted);
      socketService.off('navigation:arrived', handleNavigationArrived);
      socketService.off('navigation:ended', handleNavigationEnded);
      socketService.off('work:started', handleWorkStarted);
      socketService.off('work:completed', handleWorkCompleted);
      socketService.off('booking:updated', handleBookingUpdated);
    };
  }, [bookingId, booking, user?.id]);

  // Update work duration timer
  useEffect(() => {
    if (workStatus === 'in_progress' && workStartTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - workStartTime.getTime()) / 1000);
        setWorkDuration(diff);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [workStatus, workStartTime]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return '#2196F3';
      case 'in_progress':
        return '#9C27B0';
      case 'completed':
        return '#4CAF50';
      default:
        return '#666';
    }
  };

  // Get worker name from various possible sources
  const getWorkerName = () => {
    if (booking?.worker) {
      // If worker object exists with name
      if (booking.worker.name) {
        return booking.worker.name;
      }
      // If worker has firstName and lastName
      if (booking.worker.firstName || booking.worker.lastName) {
        return `${booking.worker.firstName || ''} ${booking.worker.lastName || ''}`.trim();
      }
    }
    
    // If workerId is an object with name fields
    if (booking?.workerId && typeof booking.workerId === 'object') {
      if (booking.workerId.name) {
        return booking.workerId.name;
      }
      if (booking.workerId.firstName || booking.workerId.lastName) {
        return `${booking.workerId.firstName || ''} ${booking.workerId.lastName || ''}`.trim();
      }
    }
    
    // If workerData was fetched separately
    if (workerData) {
      if (workerData.name) {
        return workerData.name;
      }
      if (workerData.firstName || workerData.lastName) {
        return `${workerData.firstName || ''} ${workerData.lastName || ''}`.trim();
      }
    }
    
    // Only show "Awaiting assignment" if status is pending and no worker assigned
    if ((booking?.status === 'pending' || !booking?.workerId) && !booking?.worker) {
      return 'Awaiting assignment';
    }
    
    // Fallback
    return 'Worker';
  };

  // Calculate worker info (before early returns to avoid hook order issues)
  const workerName = booking ? getWorkerName() : 'Awaiting assignment';
  const workerPhone = booking?.worker?.phone || (booking?.workerId && typeof booking.workerId === 'object' ? booking.workerId.phone : null) || workerData?.phone || '—';
  const workerProfileImage = booking?.worker?.profileImage || booking?.worker?.image || (booking?.workerId && typeof booking.workerId === 'object' ? (booking.workerId.profileImage || booking.workerId.image) : null) || workerData?.profileImage || workerData?.image;

  // Debug logging useEffect (must be before early returns)
  useEffect(() => {
    if (booking) {
      console.log('🔍 Worker Data Debug:', {
        workerName,
        workerPhone,
        hasProfileImage: !!workerProfileImage,
        profileImage: workerProfileImage,
        bookingStatus: booking.status,
        hasWorkerId: !!booking.workerId,
        worker: booking.worker,
        workerData,
      });
    }
  }, [booking, workerName, workerPhone, workerProfileImage, workerData]);

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.loadingText}>Failed to load tracking information</Text>
        <Text style={[styles.loadingText, { fontSize: 14, color: '#666', marginTop: 8 }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchBookingDetails}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading || !booking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading tracking information...</Text>
      </View>
    );
  }

  const userLocationCoords = booking.location?.coordinates || {
    latitude: 27.7172,
    longitude: 85.324,
  };
  
  // Use workerLocation from state (updated via socket), fallback to booking data
  const currentWorkerLocation = workerLocation || booking.workerLocation || null;
  
  console.log('📍 Tracking locations:', {
    userLocation: userLocationCoords,
    workerLocation: currentWorkerLocation,
    hasWorker: !!booking.worker,
    workerName: booking.worker?.name,
  });
  
  const calculatedDistance =
    currentWorkerLocation && userLocationCoords
      ? calculateDistance(
          currentWorkerLocation.latitude,
          currentWorkerLocation.longitude,
          userLocationCoords.latitude,
          userLocationCoords.longitude
        )
      : distance;
  
  // Handle phone call
  const handleCall = () => {
    const phone = workerPhone && workerPhone !== '—' ? workerPhone : null;
    
    if (!phone) {
      Alert.alert('No Phone Number', 'Worker phone number is not available.');
      return;
    }
    
    // Clean phone number - remove any spaces, dashes, or special characters except +
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    // If phone doesn't start with +, add it (assuming Nepal country code)
    if (!cleanPhone.startsWith('+')) {
      // If it starts with 977, add +, otherwise add +977
      if (cleanPhone.startsWith('977')) {
        cleanPhone = '+' + cleanPhone;
      } else {
        cleanPhone = '+977' + cleanPhone;
      }
    }
    
    const url = `tel:${cleanPhone}`;
    console.log('📞 Calling worker:', cleanPhone);
    
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
  };
  const serviceTitle =
    booking.serviceTitle || booking.serviceName || booking.serviceCategory || 'Service';
  const locationCity = booking.location?.city || 'Location pending';

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Map View */}
        <View style={styles.mapContainer}>
          <MapComponent
            ref={mapRef}
            provider={GOOGLE_PROVIDER}
            style={styles.map}
            initialRegion={{
              latitude: userLocationCoords.latitude,
              longitude: userLocationCoords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {/* User Location Marker */}
            <MarkerComponent
              coordinate={userLocationCoords}
              title="Your Location"
              description={booking.location?.address}
            >
              <View style={styles.markerContainer}>
                <Ionicons name="home" size={30} color="#4A90E2" />
              </View>
            </MarkerComponent>

            {/* Worker Location Marker */}
            {currentWorkerLocation && (
              <>
                <MarkerComponent
                  coordinate={{
                    latitude: currentWorkerLocation.latitude,
                    longitude: currentWorkerLocation.longitude,
                  }}
                  title={workerName}
                  description="Worker Location"
                >
                  <View style={styles.workerMarker}>
                    <Ionicons name="person" size={24} color="#fff" />
                  </View>
                </MarkerComponent>

                {/* Route Line */}
                {Platform.OS !== 'web' && PolylineComponent && (
                  <PolylineComponent
                    coordinates={[
                      currentWorkerLocation,
                      userLocationCoords,
                    ]}
                    strokeColor="#4A90E2"
                    strokeWidth={3}
                    lineDashPattern={[5, 5]}
                  />
                )}
              </>
            )}
          </MapComponent>

          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Booking Info Card */}
        <View style={styles.infoCard}>
          {/* Status Header */}
          <View style={styles.statusHeader}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(booking.status) }]} />
            <Text style={styles.statusTitle}>
              {workStatus === 'completed' && 'Work Completed!'}
              {workStatus === 'in_progress' && 'Work in Progress'}
              {navStatus === 'navigating' && `${workerName} is on the way...`}
              {navStatus === 'arrived' && `${workerName} has arrived!`}
              {navStatus === 'ended' && workStatus === 'not_started' && `Waiting for ${workerName} to start work...`}
              {navStatus === 'tracking' && `${workerName} started location tracking...`}
              {navStatus === 'accepted' && `${workerName} accepted! Waiting to start location tracking...`}
              {booking.status === 'pending' && navStatus === 'pending' && `Request sent to ${workerName}...`}
            </Text>
          </View>

          {/* Navigation Status Messages */}
          {booking.status === 'pending' && navStatus === 'pending' && (
            <View style={styles.requestSentBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.requestSentText}>
                Waiting for {workerName} to accept your request...
              </Text>
            </View>
          )}

          {navStatus === 'accepted' && (
            <View style={styles.acceptedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#2196F3" />
              <Text style={styles.acceptedText}>
                {workerName} accepted your request! Waiting for worker to start location tracking...
              </Text>
            </View>
          )}

          {navStatus === 'tracking' && !locationTrackingStarted && (
            <View style={styles.trackingBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.trackingText}>
                {workerName} is preparing to start navigation...
              </Text>
            </View>
          )}

          {navStatus === 'navigating' && currentWorkerLocation && (
            <View style={styles.movingBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.movingText}>
                {workerName} is on the way • Distance: {calculatedDistance.toFixed(2)} km • ETA: {eta} min
              </Text>
            </View>
          )}

          {navStatus === 'arrived' && (
            <View style={styles.arrivedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.arrivedText}>{workerName} has arrived at your location!</Text>
            </View>
          )}

          {navStatus === 'ended' && workStatus === 'not_started' && (
            <View style={styles.waitingBadge}>
              <Ionicons name="time" size={20} color="#FF9800" />
              <Text style={styles.waitingText}>Waiting for {workerName} to start work...</Text>
            </View>
          )}

          {workStatus === 'in_progress' && (
            <View style={styles.workingBadge}>
              <Ionicons name="hammer" size={20} color="#4CAF50" />
              <View style={styles.workingContent}>
                <Text style={styles.workingText}>
                  {workerName} is working on your project
                </Text>
                {workStartTime && (
                  <Text style={styles.workStartTimeText}>
                    Started: {workStartTime.toLocaleTimeString()}
                  </Text>
                )}
                {workStartTime && workDuration > 0 && (
                  <Text style={styles.workDurationText}>
                    Duration: {formatDuration(workDuration)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {workStatus === 'completed' && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.completedText}>
                {workerName} has completed the work! Please proceed to payment.
              </Text>
            </View>
          )}

          {/* Worker Info */}
          <View style={styles.workerCard}>
            <View style={styles.workerAvatar}>
              {workerProfileImage ? (
                <Image 
                  source={{ uri: workerProfileImage }} 
                  style={styles.workerAvatarImage}
                />
              ) : (
                <Ionicons name="person" size={32} color="#4A90E2" />
              )}
            </View>
            <View style={styles.workerDetails}>
              <Text style={styles.workerName}>{workerName}</Text>
              <Text style={styles.workerPhone}>{workerPhone}</Text>
            </View>
            <TouchableOpacity 
              style={[
                styles.callButton,
                (!workerPhone || workerPhone === '—') && styles.callButtonDisabled
              ]}
              onPress={handleCall}
              disabled={!workerPhone || workerPhone === '—'}
            >
              <Ionicons 
                name="call" 
                size={20} 
                color={(!workerPhone || workerPhone === '—') ? '#999' : '#4CAF50'} 
              />
            </TouchableOpacity>
          </View>

          {/* Service Details */}
          <View style={styles.serviceDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="construct-outline" size={16} color="#666" />
              <Text style={styles.detailLabel}>Service:</Text>
              <Text style={styles.detailValue}>{serviceTitle}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.detailLabel}>Location:</Text>
              <Text style={styles.detailValue}>{locationCity}</Text>
            </View>
            {distance !== null && (
              <View style={styles.detailRow}>
                <Ionicons name="navigate-outline" size={16} color="#666" />
                <Text style={styles.detailLabel}>Distance:</Text>
                <Text style={styles.detailValue}>{distance.toFixed(2)} km</Text>
              </View>
            )}
            {booking.remainingTime !== undefined && (
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.detailLabel}>Estimated Time:</Text>
                <Text style={styles.detailValue}>
                  {booking.remainingTime < 24 
                    ? `${booking.remainingTime} hours` 
                    : `${Math.ceil(booking.remainingTime / 24)} days`}
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
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    backgroundColor: '#fff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  workerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
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
  callButtonDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.5,
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
  requestSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    marginBottom: 16,
  },
  requestSentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF9800',
  },
  movingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    marginBottom: 16,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
  },
  movingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2196F3',
  },
  arrivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    marginBottom: 16,
  },
  arrivedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
  },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    marginBottom: 16,
  },
  waitingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF9800',
  },
  workingBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    marginBottom: 16,
  },
  workingContent: {
    flex: 1,
  },
  workingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4,
  },
  workStartTimeText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  workDurationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 4,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    marginBottom: 16,
  },
  completedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
    flex: 1,
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    marginBottom: 16,
  },
  acceptedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2196F3',
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    marginBottom: 16,
  },
  trackingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF9800',
  },
});

