import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { SocketService } from '@/lib/SocketService';
import { getApiUrl } from '@/lib/config';
import ToastNotification from '@/components/ToastNotification';

// Lazy load Mapbox to avoid crashes when native modules aren't built
let MapboxMap: any, Camera: any, ShapeSource: any, LineLayer: any, SymbolLayer: any;
let DEFAULT_MAP_STYLE: string;
let getDirections: any;
let mapboxAvailable = false;
let ReactNativeMaps: any = null;
let RNMapView: any = null;
let RNMarker: any = null;
let RNPolyline: any = null;
let useRNMaps = false;

// Try to load Mapbox native modules
try {
  const MapboxComponents = require('@rnmapbox/maps');
  MapboxMap = MapboxComponents.MapView;
  Camera = MapboxComponents.Camera;
  ShapeSource = MapboxComponents.ShapeSource;
  LineLayer = MapboxComponents.LineLayer;
  SymbolLayer = MapboxComponents.SymbolLayer;
  
  const MapboxConfig = require('@/lib/MapboxConfig');
  DEFAULT_MAP_STYLE = MapboxConfig.DEFAULT_MAP_STYLE;
  getDirections = MapboxConfig.getDirections;
  mapboxAvailable = true;
  console.log('✅ Mapbox native modules loaded successfully');
} catch (error) {
  console.log('⚠️ Mapbox native modules not available, trying react-native-maps fallback...');
  
  // Try react-native-maps as fallback
  try {
    const RNMaps = require('react-native-maps');
    RNMapView = RNMaps.default || RNMaps;
    RNMarker = RNMaps.Marker;
    RNPolyline = RNMaps.Polyline;
    useRNMaps = true;
    console.log('✅ Using react-native-maps as fallback');
  } catch (mapsError) {
    console.log('⚠️ react-native-maps also not available:', mapsError);
    useRNMaps = false;
  }
}

const { width, height } = Dimensions.get('window');
const socketService = SocketService.getInstance();

type NavigationStatus = 'idle' | 'navigating' | 'arrived' | 'working' | 'completed';

export default function JobNavigationScreen() {
  const params = useLocalSearchParams();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId as string;
  
  const { worker } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [navStatus, setNavStatus] = useState<NavigationStatus>('idle');
  const [workerLocation, setWorkerLocation] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [distance, setDistance] = useState<number>(0);
  const [eta, setEta] = useState<number>(0);
  const [workStartTime, setWorkStartTime] = useState<Date | null>(null);
  const [workDuration, setWorkDuration] = useState<number>(0);
  const locationSubscription = useRef<any>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [cameraBounds, setCameraBounds] = useState<{
    ne: [number, number];
    sw: [number, number];
  } | null>(null);
  const [mapRegion, setMapRegionState] = useState<any>(null);
  const destinationKeyRef = useRef<string | null>(null);
  const mapRef = useRef<any>(null);
  const [distanceTraveled, setDistanceTraveled] = useState<number>(0);
  const [distanceRemaining, setDistanceRemaining] = useState<number>(0);
  const [totalRouteDistance, setTotalRouteDistance] = useState<number>(0);
  const previousLocationRef = useRef<any>(null);
  const routeRecalculationInterval = useRef<any>(null);
  
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
  // Triggered by: Work completion, status updates
  const showToast = (message: string, title?: string, type?: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ visible: true, message, title, type });
  };

  useEffect(() => {
    // Initialize Mapbox if available
    if (mapboxAvailable) {
      const { initializeMapbox } = require('@/lib/MapboxConfig');
      initializeMapbox();
    }
    
    fetchBookingDetails();
    startLocationTracking();
    
    // Listen for user location updates
    socketService.on('user:location', (data: any) => {
      if (data.bookingId === bookingId) {
        setUserLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
      }
    });

    // Listen for booking updates
    socketService.on('booking:updated', (updatedBooking: any) => {
      if (updatedBooking._id === bookingId || updatedBooking.id === bookingId) {
        console.log('📝 Booking updated in job-navigation:', updatedBooking);
        setBooking(updatedBooking);
        
        // Update nav status based on booking status
        if (updatedBooking.status === 'accepted') {
          setNavStatus('idle');
        } else if (updatedBooking.status === 'in_progress') {
          setNavStatus('working');
          if (updatedBooking.workStartTime) {
            setWorkStartTime(new Date(updatedBooking.workStartTime));
          }
        } else if (updatedBooking.status === 'completed') {
          setNavStatus('completed');
        }
      }
    });

    // Listen for payment status updates
    socketService.on('payment:status_updated', (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('💳 Payment status updated in job-navigation:', data);
        setBooking((prev: any) => prev ? {
          ...prev,
          paymentStatus: data.paymentStatus,
          userConfirmedPayment: data.userConfirmed,
          workerConfirmedPayment: data.workerConfirmed,
        } : null);
      }
    });

    return () => {
      stopLocationTracking();
      socketService.off('user:location');
      socketService.off('booking:updated');
      socketService.off('payment:status_updated');
    };
  }, [bookingId]);

  // Update work duration timer
  useEffect(() => {
    if (navStatus === 'working' && workStartTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - workStartTime.getTime()) / 1000);
        setWorkDuration(diff);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [navStatus, workStartTime]);

  const fetchBookingDetails = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}`);
      
      if (response.ok) {
        const data = await response.json();
        setBooking(data);
        
        if (data.location?.coordinates) {
          setUserLocation({
            latitude: data.location.coordinates.latitude,
            longitude: data.location.coordinates.longitude,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching booking:', error);
    }
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for navigation');
        return;
      }

      // Get current location
      const currentLocation = await Location.getCurrentPositionAsync({});
      const newLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setWorkerLocation(newLocation);

      // Emit location tracking started event to user
      socketService.emit('location:tracking:started', {
        bookingId,
        workerId: worker?.id,
        timestamp: new Date().toISOString(),
      });

      // Watch for location changes
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or every 10 meters
        },
        (location) => {
          const newLoc = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setWorkerLocation(newLoc);

          // Send location to user via socket (always send when tracking, not just when navigating)
          socketService.emit('worker:location', {
            bookingId,
            latitude: newLoc.latitude,
            longitude: newLoc.longitude,
            timestamp: new Date().toISOString(),
          });

          // Calculate distance and ETA
          if (userLocation) {
            const dist = calculateDistance(newLoc, userLocation);
            setDistance(dist);
            setEta(Math.max(1, Math.ceil(dist * 2))); // Rough estimate: 2 min per km
          }
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  };

  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (routeRecalculationInterval.current) {
      clearInterval(routeRecalculationInterval.current);
      routeRecalculationInterval.current = null;
    }
  };

  const calculateDistance = (point1: any, point2: any): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchRoute = async (origin: any, destination: any) => {
    if (!mapboxAvailable || !getDirections) {
      console.log('⚠️ Mapbox not available, skipping route fetch');
      return;
    }

    try {
      setRouteError(null);
      const route = await getDirections(
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude],
        'driving-traffic' // Use driving-traffic for real-time traffic-aware routing
      );
      
      setRouteData(route);
      setTotalRouteDistance(route.distance || 0);
      setDistanceRemaining(route.distance || 0);
      setDistanceTraveled(0);
      
      // Update camera bounds to show entire route
      if (route.geometry && route.geometry.coordinates) {
        const coords = route.geometry.coordinates;
        let minLat = coords[0][1];
        let maxLat = coords[0][1];
        let minLon = coords[0][0];
        let maxLon = coords[0][0];
        
        coords.forEach((coord: [number, number]) => {
          minLat = Math.min(minLat, coord[1]);
          maxLat = Math.max(maxLat, coord[1]);
          minLon = Math.min(minLon, coord[0]);
          maxLon = Math.max(maxLon, coord[0]);
        });
        
        setCameraBounds({
          ne: [maxLon, maxLat],
          sw: [minLon, minLat],
        });
      }
      
      // Emit route data to user app
      socketService.emit('route:updated', {
        bookingId,
        route: route.geometry,
        distance: route.distance,
        duration: route.duration,
        timestamp: new Date().toISOString(),
      });
      
      console.log('✅ Route fetched successfully:', route.distance, 'meters');
    } catch (error: any) {
      console.error('❌ Error fetching route:', error);
      setRouteError(error.message || 'Failed to fetch route');
    }
  };

  const recalculateRoute = async (currentLocation: any, destination: any) => {
    // Only recalculate if worker has moved significantly (more than 50 meters)
    if (previousLocationRef.current) {
      const dist = calculateDistance(previousLocationRef.current, currentLocation);
      if (dist < 0.05) { // Less than 50 meters, skip recalculation
        return;
      }
    }
    
    previousLocationRef.current = currentLocation;
    await fetchRoute(currentLocation, destination);
  };

  const handleStartNavigation = async () => {
    setNavStatus('navigating');
    
    // Fetch initial route
    if (workerLocation && userLocation) {
      await fetchRoute(workerLocation, userLocation);
      
      // Start periodic route recalculation (every 30 seconds or when moved significantly)
      routeRecalculationInterval.current = setInterval(() => {
        if (workerLocation && userLocation && navStatus === 'navigating') {
          recalculateRoute(workerLocation, userLocation);
        }
      }, 30000); // Recalculate every 30 seconds
    }
    
    // Emit navigation started event to user
    socketService.emit('navigation:started', { 
      bookingId, 
      workerId: worker?.id,
      timestamp: new Date().toISOString(),
    });
    
    // Update booking status to accepted (if not already)
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      });
      
      if (response.ok) {
        const updatedBooking = await response.json();
        setBooking(updatedBooking);
        console.log('✅ Booking status updated to accepted');
      }
    } catch (error) {
      console.error('Error updating booking status:', error);
    }
    
    showToast(
      'Navigation started! Your live location is being shared with the customer.',
      'Navigation Started',
      'success'
    );
  };

  const handleArrived = async () => {
    setNavStatus('arrived');
    
    // Emit navigation arrived event to user
    socketService.emit('navigation:arrived', { 
      bookingId, 
      workerId: worker?.id,
      timestamp: new Date().toISOString(),
    });
    
    // Update booking status (keep as accepted, arrival is just a navigation event)
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      });
      
      if (response.ok) {
        const updatedBooking = await response.json();
        setBooking(updatedBooking);
        console.log('✅ Booking updated after arrival');
      }
    } catch (error) {
      console.error('Error updating booking status:', error);
    }

    showToast(
      'You have arrived at the destination! Customer has been notified.',
      'Arrived!',
      'success'
    );
  };

  const handleEndNavigation = async () => {
    setNavStatus('idle');
    
    // Emit navigation ended event to user
    socketService.emit('navigation:ended', { 
      bookingId, 
      workerId: worker?.id,
      timestamp: new Date().toISOString(),
    });
    
    // Update booking status
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      });
      
      if (response.ok) {
        const updatedBooking = await response.json();
        setBooking(updatedBooking);
        console.log('✅ Booking updated after navigation ended');
      }
    } catch (error) {
      console.error('Error updating booking status:', error);
    }
    
    showToast(
      'Navigation ended. You can now start the work.',
      'Navigation Ended',
      'info'
    );
  };

  const handleStartWork = async () => {
    const startTime = new Date();
    setWorkStartTime(startTime);
    setNavStatus('working');
    
    const startTimeISO = startTime.toISOString();
    
    // Emit work started event with timestamp to user FIRST
    socketService.emit('work:started', {
      bookingId,
      workerId: worker?.id,
      startTime: startTimeISO,
      timestamp: startTimeISO,
    });
    console.log('✅ Work started event emitted to user');

    // Update booking status to in_progress
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'in_progress', 
          workStartTime: startTimeISO 
        }),
      });
      
      if (response.ok) {
        const updatedBooking = await response.json();
        setBooking((prev: any) => prev ? { ...prev, ...updatedBooking, status: 'in_progress' } : updatedBooking);
        console.log('✅ Booking status updated to in_progress');
      }
    } catch (error) {
      console.error('Error updating booking status:', error);
    }

    showToast(
      'Work started! Timer is running. Customer has been notified.',
      'Work Started',
      'success'
    );
  };

  const handleCompleteWork = () => {
    // First ask for payment method
    Alert.alert(
      'Payment Method',
      'How will the customer pay?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '💵 Cash',
          onPress: () => handleCashPayment(),
        },
        {
          text: '💳 Online',
          onPress: () => handleOnlinePayment(),
        },
      ]
    );
  };

  const handleCashPayment = () => {
    Alert.alert(
      'Cash Payment',
      'Please collect the cash payment from the customer. Confirm when payment is received.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Payment Received',
          onPress: () => completeJobWithPayment('cash'),
        },
      ]
    );
  };

  const handleOnlinePayment = () => {
    Alert.alert(
      'Online Payment',
      'Customer will pay online. Waiting for payment confirmation...',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Payment Confirmed',
          onPress: () => completeJobWithPayment('online'),
        },
      ]
    );
  };

  const completeJobWithPayment = async (paymentMethod: 'cash' | 'online') => {
    setNavStatus('completed');
    
    // Emit work completed event with payment info (but don't set paymentStatus to paid yet)
    socketService.emit('work:completed', {
      bookingId,
      workerId: worker?.id,
      endTime: new Date().toISOString(),
      duration: workDuration,
      paymentMethod,
      paymentStatus: 'pending', // Keep as pending until both confirm
    });

    // Update booking status to completed (but keep paymentStatus as pending)
    try {
      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'completed',
          paymentMethod,
          paymentStatus: 'pending', // Keep as pending until both confirm
        }),
      });
      
      // Show success notification
      showToast(
        `Job completed! Please confirm payment when customer pays.`,
        '✅ Job Completed!',
        'success'
      );
      
      // Update local booking state
      setBooking((prev: any) => prev ? { ...prev, status: 'completed', paymentMethod, paymentStatus: 'pending' } : prev);
    } catch (error) {
      console.error('Error updating booking status:', error);
      showToast(
        'Failed to update booking status. Please try again.',
        'Error',
        'error'
      );
    }
  };

  const handleConfirmPayment = async () => {
    if (!booking || !worker?.id) return;
    
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/confirm-payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmedBy: 'worker',
          workerId: worker.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        showToast(data.message || 'Payment confirmed!', 'Success', 'success');
        // Update local state
        setBooking((prev: any) => prev ? {
          ...prev,
          workerConfirmedPayment: true,
          paymentStatus: data.booking.paymentStatus,
          userConfirmedPayment: data.booking.userConfirmedPayment,
        } : null);
        
        // If both confirmed, navigate back
        if (data.booking.paymentStatus === 'paid') {
          setTimeout(() => {
            router.push('/(tabs)');
          }, 2000);
        }
      } else {
        const errorData = await response.json();
        showToast(errorData.message || 'Failed to confirm payment', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      showToast('Failed to confirm payment. Please try again.', 'Error', 'error');
    }
  };

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

  const updateCameraBounds = () => {
    if (!workerLocation || !userLocation) return;
    const minLat = Math.min(workerLocation.latitude, userLocation.latitude);
    const maxLat = Math.max(workerLocation.latitude, userLocation.latitude);
    const minLon = Math.min(workerLocation.longitude, userLocation.longitude);
    const maxLon = Math.max(workerLocation.longitude, userLocation.longitude);
    setCameraBounds({
      sw: [minLon, minLat],
      ne: [maxLon, maxLat],
    });
  };

  useEffect(() => {
    if (workerLocation && userLocation && !routeData) {
      updateCameraBounds();
    }
  }, [workerLocation, userLocation]);

  // Calculate region for map - Updates in real-time when locations change
  // MUST be before conditional return to avoid hooks error
  useEffect(() => {
    if (workerLocation && userLocation) {
      const newRegion = {
        latitude: (workerLocation.latitude + userLocation.latitude) / 2,
        longitude: (workerLocation.longitude + userLocation.longitude) / 2,
        latitudeDelta: Math.max(
          Math.abs(workerLocation.latitude - userLocation.latitude) * 2.5 + 0.01,
          0.01
        ),
        longitudeDelta: Math.max(
          Math.abs(workerLocation.longitude - userLocation.longitude) * 2.5 + 0.01,
          0.01
        ),
      };
      setMapRegionState(newRegion);
    } else if (workerLocation) {
      setMapRegionState({
        latitude: workerLocation.latitude,
        longitude: workerLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [workerLocation, userLocation]);

  // Fit map to show both markers
  // MUST be before conditional return to avoid hooks error
  useEffect(() => {
    if (mapRef.current && workerLocation && userLocation && Platform.OS !== 'web') {
      try {
        if (mapboxAvailable && mapRef.current.fitToCoordinates) {
          // Mapbox fitToCoordinates
          mapRef.current.fitToCoordinates(
            [
              { latitude: workerLocation.latitude, longitude: workerLocation.longitude },
              { latitude: userLocation.latitude, longitude: userLocation.longitude },
            ],
            {
              edgePadding: { top: 80, right: 40, bottom: 320, left: 40 },
              animated: true,
            }
          );
        } else if (useRNMaps && mapRef.current.fitToCoordinates) {
          // react-native-maps fitToCoordinates
          mapRef.current.fitToCoordinates(
            [
              { latitude: workerLocation.latitude, longitude: workerLocation.longitude },
              { latitude: userLocation.latitude, longitude: userLocation.longitude },
            ],
            {
              edgePadding: { top: 80, right: 40, bottom: 320, left: 40 },
              animated: true,
            }
          );
        }
      } catch (error) {
        console.log('Map fit error:', error);
      }
    }
  }, [workerLocation, userLocation]);

  // Early return check - must be after all hooks
  if (!booking || !workerLocation || !userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading navigation...</Text>
      </View>
    );
  }

  // At this point, workerLocation and userLocation are guaranteed to be non-null
  // Calculate features for Mapbox markers (only used if mapboxAvailable)
  const workerFeature = pointFeatureCollection(workerLocation);
  const userFeature = pointFeatureCollection(userLocation);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Map */}
        {mapboxAvailable ? (
          <MapboxMap styleURL={DEFAULT_MAP_STYLE} style={styles.map} ref={mapRef}>
            {cameraBounds ? (
              <Camera
                bounds={{
                  ne: cameraBounds.ne,
                  sw: cameraBounds.sw,
                  paddingTop: 80,
                  paddingBottom: 320,
                  paddingLeft: 40,
                  paddingRight: 40,
                }}
                animationDuration={800}
              />
            ) : (
              <Camera
                zoomLevel={13}
                centerCoordinate={[workerLocation.longitude, workerLocation.latitude]}
              />
            )}

            {/* Route between worker and customer - Blue road path */}
            {routeData?.geometry && navStatus === 'navigating' && (
              <ShapeSource id="routeSource" shape={routeData.geometry}>
                <LineLayer
                  id="routeLayer"
                  style={{
                    lineColor: '#2563EB', // Blue color like Google Maps
                    lineWidth: 6,
                    lineCap: 'round',
                    lineJoin: 'round',
                    lineOpacity: 0.9,
                  }}
                />
              </ShapeSource>
            )}

            {/* Worker marker */}
            {workerFeature && (
              <ShapeSource id="workerSource" shape={workerFeature}>
                <SymbolLayer
                  id="workerLayer"
                  style={{
                    iconImage: 'marker-15',
                    iconColor: '#2563EB',
                    iconSize: 1.5,
                  }}
                />
              </ShapeSource>
            )}

            {/* Customer marker */}
            {userFeature && (
              <ShapeSource id="customerSource" shape={userFeature}>
                <SymbolLayer
                  id="customerLayer"
                  style={{
                    iconImage: 'marker-15',
                    iconColor: '#DC2626',
                    iconSize: 1.5,
                  }}
                />
              </ShapeSource>
            )}
          </MapboxMap>
        ) : useRNMaps && RNMapView && mapRegion ? (
          <RNMapView
            ref={mapRef}
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={(region: any) => setMapRegionState(region)}
            showsUserLocation={false}
            showsMyLocationButton={false}
            provider={Platform.OS === 'android' ? 'google' : undefined}
            mapType="standard"
          >
            {/* Worker Location Marker - Updates in real-time */}
            {workerLocation && (
              <RNMarker
                key={`worker-${workerLocation.latitude}-${workerLocation.longitude}`}
                coordinate={{
                  latitude: workerLocation.latitude,
                  longitude: workerLocation.longitude,
                }}
                title="Your Location"
                description="Worker - Moving"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.workerMarkerContainer}>
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
              </RNMarker>
            )}

            {/* Customer Location Marker */}
            {userLocation && (
              <RNMarker
                coordinate={{
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                }}
                title="Customer Location"
                description={booking.location?.address || 'Destination'}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.customerMarkerContainer}>
                  <Ionicons name="home" size={24} color="#fff" />
                </View>
              </RNMarker>
            )}

            {/* Route Line between worker and customer - Updates in real-time */}
            {workerLocation && userLocation && RNPolyline && (
              <RNPolyline
                key={`route-${workerLocation.latitude}-${userLocation.latitude}`}
                coordinates={[
                  { latitude: workerLocation.latitude, longitude: workerLocation.longitude },
                  { latitude: userLocation.latitude, longitude: userLocation.longitude },
                ]}
                strokeColor="#FF7A2C"
                strokeWidth={4}
                lineDashPattern={[5, 5]}
              />
            )}
          </RNMapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map-outline" size={64} color="#ccc" />
            <Text style={styles.mapPlaceholderTitle}>Maps Not Available</Text>
            <Text style={styles.mapPlaceholderText}>
              To enable maps, you need to build the native app:{'\n\n'}
              For Android:{'\n'}
              bunx expo run:android{'\n\n'}
              For iOS:{'\n'}
              bunx expo run:ios{'\n\n'}
              Maps require native build and cannot run in Expo Go.
            </Text>
          </View>
        )}

        {/* Status Card - Scrollable when arrived to show all content */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>
              {navStatus === 'idle' && 'Ready to Navigate'}
              {navStatus === 'navigating' && 'Navigating to Customer'}
              {navStatus === 'arrived' && 'Arrived at Destination'}
              {navStatus === 'working' && 'Work in Progress'}
              {navStatus === 'completed' && 'Job Completed'}
            </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {routeError && (
            <View style={styles.routeAlert}>
              <Ionicons name="warning" size={16} color="#EF4444" />
              <Text style={styles.routeAlertText}>{routeError}</Text>
            </View>
          )}

          {navStatus === 'arrived' ? (
            <ScrollView 
              style={styles.scrollableContent}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.scrollContentContainer}
            >
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Ionicons name="locate" size={20} color="#FF7A2C" />
                  <Text style={styles.infoText}>{distance.toFixed(2)} km</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="time" size={20} color="#FF7A2C" />
                  <Text style={styles.infoText}>{eta} min</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="briefcase" size={20} color="#FF7A2C" />
                  <Text style={styles.infoText}>{booking.serviceName}</Text>
                </View>
              </View>

              {/* Customer Info */}
              <View style={styles.customerInfo}>
                <Text style={styles.customerLabel}>Customer:</Text>
                <Text style={styles.customerName}>{booking.userName || 'Customer'}</Text>
                <Text style={styles.customerAddress}>{booking.location?.address}</Text>
              </View>

              {/* Arrived Badge */}
              <View style={styles.arrivedBadge}>
                <Ionicons name="location" size={20} color="#4CAF50" />
                <Text style={styles.arrivedText}>You've arrived at the destination!</Text>
              </View>
            </ScrollView>
          ) : (
            <>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Ionicons name="locate" size={20} color="#FF7A2C" />
                  <Text style={styles.infoText}>
                    {navStatus === 'navigating' && distanceRemaining > 0 
                      ? (distanceRemaining / 1000).toFixed(2) 
                      : distance.toFixed(2)} km
                  </Text>
                  <Text style={styles.infoSubtext}>
                    {navStatus === 'navigating' ? 'Remaining' : 'Distance'}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="time" size={20} color="#FF7A2C" />
                  <Text style={styles.infoText}>{eta} min</Text>
                  <Text style={styles.infoSubtext}>ETA</Text>
                </View>
                {navStatus === 'navigating' && distanceTraveled > 0 && (
                  <View style={styles.infoItem}>
                    <Ionicons name="navigate" size={20} color="#4CAF50" />
                    <Text style={styles.infoText}>{(distanceTraveled / 1000).toFixed(2)} km</Text>
                    <Text style={styles.infoSubtext}>Traveled</Text>
                  </View>
                )}
              </View>

              {/* Customer Info */}
              <View style={styles.customerInfo}>
                <Text style={styles.customerLabel}>Customer:</Text>
                <Text style={styles.customerName}>{booking.userName || 'Customer'}</Text>
                <Text style={styles.customerAddress}>{booking.location?.address}</Text>
              </View>

              {/* Work Duration (when working) */}
              {navStatus === 'working' && (
                <View style={styles.workTimer}>
                  <Ionicons name="stopwatch" size={24} color="#4CAF50" />
                  <Text style={styles.workDuration}>{formatDuration(workDuration)}</Text>
                </View>
              )}
            </>
          )}

          {/* Action Buttons - Always visible at bottom */}
          <View style={styles.actions}>
            {navStatus === 'idle' && (
              <TouchableOpacity style={styles.startButton} onPress={handleStartNavigation}>
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.startButtonText}>Start Navigation</Text>
              </TouchableOpacity>
            )}

            {navStatus === 'navigating' && (
              <>
                <View style={styles.navigatingBadge}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.navigatingText}>Moving to destination...</Text>
                </View>
                <TouchableOpacity style={styles.arrivedButton} onPress={handleArrived}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.arrivedButtonText}>Mark as Arrived</Text>
                </TouchableOpacity>
              </>
            )}

            {navStatus === 'arrived' && (
              <>
                <TouchableOpacity style={styles.endNavButton} onPress={handleEndNavigation}>
                  <Text style={styles.endNavButtonText}>End Navigation</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.startWorkButton} onPress={handleStartWork}>
                  <Ionicons name="hammer" size={20} color="#fff" />
                  <Text style={styles.startWorkButtonText}>Start Work</Text>
                </TouchableOpacity>
              </>
            )}

            {navStatus === 'working' && (
              <TouchableOpacity style={styles.completeButton} onPress={handleCompleteWork}>
                <Ionicons name="checkmark-done" size={20} color="#fff" />
                <Text style={styles.completeButtonText}>Complete Work</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Toast Notification - Shows for 3 seconds on work events */}
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

const pointFeatureCollection = (coords: { latitude: number; longitude: number }) => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [coords.longitude, coords.latitude],
      },
    },
  ],
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safe: {
    flex: 1,
  },
  map: {
    width,
    height: height * 0.6,
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
  mapPlaceholder: {
    width,
    height: height * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 30,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  mapPlaceholderText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  workerMarkerContainer: {
    backgroundColor: '#2563EB',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  customerMarkerContainer: {
    backgroundColor: '#DC2626',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 20,
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    maxHeight: height * 0.65, // Limit height to ensure buttons are visible
  },
  scrollableContent: {
    maxHeight: 200, // Limit scrollable area height
    marginBottom: 12,
  },
  scrollContentContainer: {
    paddingBottom: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  routeAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  routeAlertText: {
    color: '#B91C1C',
    fontSize: 12,
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  infoSubtext: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  customerInfo: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#FFF9F0',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF7A2C',
  },
  customerLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  customerAddress: {
    fontSize: 14,
    color: '#666',
  },
  workTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    marginBottom: 20,
  },
  workDuration: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  actions: {
    gap: 10,
    marginTop: 'auto', // Push buttons to bottom
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF7A2C',
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navigatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
  },
  navigatingText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  arrivedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
  },
  arrivedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  arrivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    marginBottom: 8,
  },
  arrivedText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  endNavButton: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  endNavButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  startWorkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
  },
  startWorkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    paddingVertical: 18,
    borderRadius: 12,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

