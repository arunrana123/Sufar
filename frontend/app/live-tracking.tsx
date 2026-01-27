// LIVE TRACKING SCREEN - Real-time worker location tracking with map, route visualization, and ETA
// Features: Socket.IO real-time updates, Google Maps integration, worker info, status updates, call/message worker
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { notificationSoundService } from '@/lib/NotificationSoundService';
import { useAuth } from '@/contexts/AuthContext';
import { mapService, Location, RouteData } from '@/lib/MapService';
import { getMapboxDirections, MapboxRouteResult } from '@/lib/MapboxDirectionsService';
// ARCHITECTURE: User app uses MapService for smooth, throttled map updates with Mapbox Directions API

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
  price?: number;
  paymentStatus?: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  userConfirmedPayment?: boolean;
  workerConfirmedPayment?: boolean;
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
  const [distanceTraveled, setDistanceTraveled] = useState<number>(0);
  const [distanceRemaining, setDistanceRemaining] = useState<number>(0);
  const [routeData, setRouteData] = useState<any>(null);
  const [mapboxRouteData, setMapboxRouteData] = useState<MapboxRouteResult | null>(null);
  const [workerData, setWorkerData] = useState<any>(null);
  const [locationTrackingStarted, setLocationTrackingStarted] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [canRenderChildren, setCanRenderChildren] = useState<boolean>(false);
  const [isFetchingRoute, setIsFetchingRoute] = useState<boolean>(false);
  const mapRef = useRef<any>(null);
  const routeKeyRef = useRef<string>('');
  const markerKeyRef = useRef<string>('');
  const routeFetchInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch route using Mapbox Directions API - CRITICAL: This makes the actual API request
  const fetchMapboxDirections = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    force: boolean = false // Allow forcing even if already fetching
  ) => {
    // Only prevent concurrent requests if not forced (allows retries)
    if (isFetchingRoute && !force) {
      console.log('⏸️ Route fetch already in progress, skipping...');
      return;
    }
    
    setIsFetchingRoute(true);
    try {
      console.log('🗺️ [MAPBOX REQUEST] Fetching route:', {
        origin: `${origin.latitude.toFixed(6)}, ${origin.longitude.toFixed(6)}`,
        destination: `${destination.latitude.toFixed(6)}, ${destination.longitude.toFixed(6)}`,
        timestamp: new Date().toISOString(),
      });
      
      const route = await getMapboxDirections(origin, destination, 'driving-traffic');
      
      if (route) {
        console.log('✅ [MAPBOX SUCCESS] Route fetched:', {
          distance: route.distanceText,
          duration: route.durationText,
          points: route.coordinates.length,
          requestTime: new Date().toISOString(),
        });
        
        setMapboxRouteData(route);
        
        // Also update routeData for compatibility with existing code
        setRouteData({
          coordinates: route.coordinates,
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration,
        });
        
        // Update distance and ETA
        setDistance(route.distance / 1000); // Convert meters to km
        setDistanceRemaining(route.distance / 1000);
        setEta(Math.ceil(route.duration / 60)); // Convert seconds to minutes
        
        // Update route key for re-render
        routeKeyRef.current = `mapbox-route-${Date.now()}-${route.coordinates.length}`;
        
        console.log('✅ Mapbox route data set and ready for visualization:', {
          coordinates: route.coordinates.length,
          distance: route.distanceText,
          duration: route.durationText,
        });
      } else {
        console.warn('⚠️ [MAPBOX WARNING] Failed to fetch Mapbox Directions, using fallback');
      }
    } catch (error) {
      console.error('❌ [MAPBOX ERROR] Error fetching Mapbox Directions:', error);
    } finally {
      setIsFetchingRoute(false);
    }
  };

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
        console.log(' Fetched booking details:', {
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
            console.log(' Work start time loaded from booking:', startTime.toISOString());
          }
        } else if (data.status === 'completed') {
          setWorkStatus('completed');
        }
        
        // Fetch worker details if workerId exists but worker data is incomplete or missing
        if (data.workerId && (!data.worker || !data.worker.name || !data.worker.phone || !data.worker.profileImage)) {
          try {
            const workerId = typeof data.workerId === 'string' ? data.workerId : data.workerId._id || data.workerId;
            console.log(' Fetching worker details for ID:', workerId);
            const workerResponse = await fetch(`${apiUrl}/api/workers/${workerId}`);
            if (workerResponse.ok) {
              const workerDetails = await workerResponse.json();
              console.log(' Fetched worker details:', {
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
              console.warn(' Failed to fetch worker details:', workerResponse.status);
            }
          } catch (err) {
            console.error(' Error fetching worker details:', err);
          }
        } else if (data.worker) {
          // Worker data already exists in response, use it
          console.log(' Worker data already in booking response:', data.worker);
        }

        // CRITICAL: Fetch Mapbox Directions route immediately when booking loads
        if (data.workerLocation && data.location?.coordinates) {
          // Ensure workerLocation has latitude/longitude
          const workerLat = data.workerLocation.latitude || (data.workerLocation as any)?.location?.latitude;
          const workerLon = data.workerLocation.longitude || (data.workerLocation as any)?.location?.longitude;
          
          if (workerLat && workerLon) {
            console.log('🗺️ [BOOKING LOAD] Fetching route on initial booking load...', {
              worker: `${workerLat}, ${workerLon}`,
              user: `${data.location.coordinates.latitude}, ${data.location.coordinates.longitude}`,
            });
            fetchMapboxDirections(
              {
                latitude: workerLat,
                longitude: workerLon,
              },
              {
                latitude: data.location.coordinates.latitude,
                longitude: data.location.coordinates.longitude,
              }
            );
          } else {
            console.warn('⚠️ [BOOKING LOAD] Worker location missing coordinates:', data.workerLocation);
          }
        } else {
          console.warn('⚠️ [BOOKING LOAD] Cannot fetch route - missing locations:', {
            hasWorkerLocation: !!data.workerLocation,
            hasUserLocation: !!data.location?.coordinates,
            workerLocationData: data.workerLocation,
          });
        }
        
        // ARCHITECTURE: Start MapService for smooth route updates when we have both locations
        // This will be handled in the useEffect where handleMapServiceRouteUpdate is defined
        
        // Fit map to show both locations
        if (
          Platform.OS === 'android' &&
          data.workerLocation &&
          data.location?.coordinates &&
          mapRef.current?.fitToCoordinates
        ) {
          // Fit map to show both markers even without route (Android)
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
                  edgePadding: { top: 80, right: 40, bottom: 200, left: 40 },
                  animated: true,
                }
              );
            } catch (e) {
              console.warn('Map fit error:', e);
            }
          }, 300); // Faster for Android
        }
      } else {
        const errorText = await response.text();
        const errorMessage = `Failed to fetch booking details: ${response.status} - ${errorText}`;
        console.error('', errorMessage);
        setError(errorMessage);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        const errorMessage = 'Request timeout. Please check your network connection.';
        console.error('', errorMessage);
        setError(errorMessage);
      } else if (error.message === 'Network request failed' || error.message?.includes('NetworkError')) {
        const errorMessage = 'Network error. Please check your internet connection and ensure the backend server is running.';
        console.error(' Network error:', error);
        setError(errorMessage);
      } else {
        const errorMessage = `Error fetching booking details: ${error.message || error}`;
        console.error('', errorMessage);
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
      if (data.bookingId === bookingId || data.booking?._id === bookingId || data.booking?.id === bookingId) {
        console.log(' Booking accepted:', data);
        setNavStatus('accepted');
        // Update booking state immediately
        if (booking) {
          setBooking({
            ...booking,
            status: 'accepted',
            workerId: data.booking?.workerId || data.workerId || booking.workerId,
          });
        }
        // Refresh booking details
        setTimeout(() => {
          fetchBookingDetails();
        }, 500);
      }
    };

    // Listen for location tracking started
    const handleLocationTrackingStarted = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('📍 Location tracking started:', data);
        setLocationTrackingStarted(true);
        setNavStatus('tracking');
        // Refresh booking details to get latest status
        setTimeout(() => {
          fetchBookingDetails();
        }, 300);
      }
    };

    // Listen for enhanced route updates with live tracking data
    const handleRouteUpdated = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log(' Enhanced route updated:', {
          distance: data.distance,
          duration: data.duration,
          distanceTraveled: data.distanceTraveled,
          distanceRemaining: data.distanceRemaining,
          hasRoute: !!data.route
        });
        
        // Update route geometry for real road-based path display
        if (data.route && data.route.geometry) {
          routeKeyRef.current = `route-${Date.now()}-${data.route.geometry.coordinates?.length || 0}`;
          setRouteData({ 
            coordinates: data.route.geometry.coordinates || [],
            geometry: data.route 
          });
        }
        
        // Update live distance tracking
        if (data.distanceTraveled !== undefined) {
          setDistanceTraveled(data.distanceTraveled);
        }
        if (data.distanceRemaining !== undefined) {
          setDistanceRemaining(data.distanceRemaining);
          setDistance(data.distanceRemaining); // Already in km from backend
        }
        
        // Update ETA based on actual route duration
        if (data.duration) {
          setEta(Math.ceil(data.duration / 60)); // Convert seconds to minutes
        }
      }
    };

    // MapService route update callback - receives throttled route updates (every 3-5 seconds)
    const handleMapServiceRouteUpdate = (route: RouteData) => {
      console.log('🗺️ MapService route update:', {
        points: route.coordinates.length,
        distance: (route.distance / 1000).toFixed(2) + ' km',
        duration: Math.ceil(route.duration / 60) + ' min',
      });

      routeKeyRef.current = `route-${Date.now()}-${route.coordinates.length}`;
      setRouteData({
        coordinates: route.coordinates,
        geometry: route.geometry,
      });

      // Update distance and ETA
      if (route.distance) {
        setDistance(route.distance / 1000); // Convert meters to km
        setDistanceRemaining(route.distance / 1000);
      }
      if (route.duration) {
        setEta(Math.ceil(route.duration / 60)); // Convert seconds to minutes
      }
    };

    // Listen for enhanced worker location updates with distance tracking
    const handleWorkerLocation = (data: any) => {
      if (data.bookingId === bookingId || data.workerId === booking?.workerId || 
          (typeof booking?.workerId === 'object' && data.workerId === (booking.workerId as any)?._id)) {
        console.log('📍 Enhanced worker location update:', {
          location: `${data.latitude}, ${data.longitude}`,
          accuracy: data.accuracy,
          distanceTraveled: data.distanceTraveled,
          distanceRemaining: data.distanceRemaining
        });
        
        const newLocation: Location = {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy,
          timestamp: Date.now(),
        };
        
        // Generate stable key for marker (only update if location changed significantly)
        const locationKey = `${data.latitude.toFixed(4)}-${data.longitude.toFixed(4)}`;
        if (markerKeyRef.current !== locationKey) {
          markerKeyRef.current = locationKey;
        }
        
        // Update worker location - ensure it's in the correct format
        setWorkerLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        
        // Update MapService with new worker location (throttled internally to 3-5 seconds)
        if (booking?.location?.coordinates) {
          mapService.updateOrigin(newLocation);
          
          // Update Mapbox Directions route with new worker location
          // IMPORTANT: Fetch route on every significant location change (reduced throttle to 5 seconds for active navigation)
          const now = Date.now();
          const lastRouteUpdate = (mapRef.current as any)?._lastRouteUpdate || 0;
          const throttleTime = navStatus === 'navigating' ? 5000 : 10000; // More frequent during active navigation
          
          if (now - lastRouteUpdate > throttleTime) {
            (mapRef.current as any)._lastRouteUpdate = now;
            console.log('🔄 [ROUTE UPDATE] Worker location changed, fetching new route...');
            fetchMapboxDirections(
              newLocation,
              {
                latitude: booking.location.coordinates.latitude,
                longitude: booking.location.coordinates.longitude,
              }
            );
          } else {
            console.log(`⏸️ [ROUTE THROTTLE] Skipping route update (${Math.round((throttleTime - (now - lastRouteUpdate)) / 1000)}s remaining)`);
          }
        }
        
        // ARCHITECTURE: Camera updates ONLY every 3-5 seconds (Google Maps style)
        if (mapRef.current && (navStatus === 'tracking' || navStatus === 'navigating')) {
          const now = Date.now();
          const lastCameraUpdate = (mapRef.current as any)._lastCameraUpdate || 0;
          
          // ARCHITECTURE RULE: Camera updates every 3-5 seconds for smooth performance
          if (now - lastCameraUpdate < 4000) { // 4 seconds
            return;
          }
          
          try {
            (mapRef.current as any)._lastCameraUpdate = now;
            
            // ARCHITECTURE: Use smooth animations with duration ≥ 1500ms (Google Maps style)
            if (mapRef.current.animateToCoordinate) {
              mapRef.current.animateToCoordinate(
                {
                  latitude: newLocation.latitude,
                  longitude: newLocation.longitude,
                },
                1500 // Smooth 1.5s animation (Google Maps style)
              );
            } else if (mapRef.current.animateToRegion) {
              mapRef.current.animateToRegion(
                {
                  latitude: newLocation.latitude,
                  longitude: newLocation.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                },
                1500
              );
            }
          } catch (error) {
            console.log('Map follow error:', error);
          }
        }
        
        // Use worker's calculated distances (more accurate than straight-line)
        if (data.distanceTraveled !== undefined) {
          setDistanceTraveled(data.distanceTraveled);
        }
        if (data.distanceRemaining !== undefined) {
          setDistanceRemaining(data.distanceRemaining);
          setDistance(data.distanceRemaining); // Already in km from backend
          setEta(Math.max(1, Math.ceil(data.distanceRemaining * 2))); // 2 min per km estimate
        } else if (booking?.location?.coordinates) {
          // Fallback to straight-line calculation if enhanced data not available
          const dist = calculateDistance(
            data.latitude,
            data.longitude,
            booking.location.coordinates.latitude,
            booking.location.coordinates.longitude
          );
          setDistance(dist);
          setDistanceRemaining(dist);
          setEta(Math.ceil(dist * 2));
        }
      }
    };

    // Listen for enhanced navigation started with initial route data
    const handleNavigationStarted = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log(' Enhanced navigation started:', {
          distance: data.distance,
          duration: data.duration,
          hasRoute: !!data.route
        });
        
        setNavStatus('navigating');
        
        // Set initial route display from navigation start
        if (data.route && data.route.geometry) {
          routeKeyRef.current = `route-${Date.now()}-${data.route.geometry.coordinates?.length || 0}`;
          setRouteData({
            coordinates: data.route.geometry.coordinates || [],
            geometry: data.route
          });
        }
        
        // Fetch Mapbox Directions route
        if (workerLocation && booking?.location?.coordinates) {
          fetchMapboxDirections(
            {
              latitude: workerLocation.latitude,
              longitude: workerLocation.longitude,
            },
            {
              latitude: booking.location.coordinates.latitude,
              longitude: booking.location.coordinates.longitude,
            }
          );
          
          // Start periodic route updates (every 8 seconds during active navigation for real-time updates)
          if (routeFetchInterval.current) {
            clearInterval(routeFetchInterval.current);
          }
          console.log('🔄 [ROUTE INTERVAL] Starting periodic route updates every 8 seconds');
          routeFetchInterval.current = setInterval(() => {
            if (workerLocation && booking?.location?.coordinates) {
              console.log('🔄 [ROUTE INTERVAL] Periodic route update triggered');
              fetchMapboxDirections(
                {
                  latitude: workerLocation.latitude,
                  longitude: workerLocation.longitude,
                },
                {
                  latitude: booking.location.coordinates.latitude,
                  longitude: booking.location.coordinates.longitude,
                }
              );
            }
          }, 8000); // Update every 8 seconds for active navigation (reduced from 15s)
          
          // Start MapService for smooth, throttled route updates (every 3-5 seconds)
          mapService.startMapUpdates({
            origin: {
              latitude: workerLocation.latitude,
              longitude: workerLocation.longitude,
            },
            destination: {
              latitude: booking.location.coordinates.latitude,
              longitude: booking.location.coordinates.longitude,
            },
            updateInterval: 4000, // 4 seconds (between 3-5 seconds)
            enableRoute: true,
            onRouteUpdate: handleMapServiceRouteUpdate,
          });
        }
        
        // Initialize distance tracking
        if (data.distance) {
          const distanceKm = data.distance / 1000; // Convert meters to km
          setDistance(distanceKm);
          setDistanceRemaining(distanceKm);
          setDistanceTraveled(0);
        }
        
        // Initialize ETA
        if (data.duration) {
          setEta(Math.ceil(data.duration / 60)); // Convert seconds to minutes
        }
      }
    };

    const handleNavigationArrived = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('📍 Worker arrived:', data);
        setNavStatus('arrived');
        // Refresh booking details
        setTimeout(() => {
          fetchBookingDetails();
        }, 300);
        Alert.alert('Worker Arrived!', 'The worker has arrived at your location');
      }
    };

    const handleNavigationEnded = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('✅ Navigation ended:', data);
        setNavStatus('ended');
        // Refresh booking details
        setTimeout(() => {
          fetchBookingDetails();
        }, 300);
      }
    };

    // Listen for work status changes
    const handleWorkStarted = (data: any) => {
      if (data.bookingId === bookingId) {
        console.log('🔨 Work started at:', data.startTime || data.timestamp);
        setWorkStatus('in_progress');
        setNavStatus('ended'); // Navigation ended when work starts
        // Set work start time from the event data
        if (data.startTime || data.timestamp) {
          const startTime = new Date(data.startTime || data.timestamp);
          setWorkStartTime(startTime);
          console.log('⏰ Work start time set to:', startTime.toISOString());
        }
        // Update booking status in UI immediately
        if (booking) {
          setBooking({
            ...booking,
            status: 'in_progress',
            startTime: data.startTime || data.timestamp,
          });
        }
        // Refresh booking details to get latest data
        setTimeout(() => {
          fetchBookingDetails();
        }, 300);
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
        console.log(' Work completed:', data);
        setWorkStatus('completed');
        // Update booking status in UI
        if (booking) {
          setBooking({
            ...booking,
            status: 'completed',
          });
        }
        
        const workerName = data.workerName || (typeof booking?.workerId === 'object' ? (booking.workerId as any)?.firstName : null) || 'Worker';
        const serviceName = data.serviceName || booking?.serviceName || 'Service';
        const totalAmount = booking?.price || data.price || 0;
        const paymentMethod = data.paymentMethod;
        
        // Show payment confirmation dialog
        if (paymentMethod === 'cash') {
          // Cash payment - confirm and go to review
          Alert.alert(
            ' Service Completed!',
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
                      workerId: typeof booking?.workerId === 'string' ? booking.workerId : (booking?.workerId as any)?._id || data.workerId,
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
            ' Service Completed!',
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
                              workerId: typeof booking?.workerId === 'string' ? booking.workerId : (booking?.workerId as any)?._id || data.workerId,
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
                      workerId: typeof booking?.workerId === 'string' ? booking.workerId : (booking?.workerId as any)?._id || data.workerId,
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

    // Listen for payment status updates (real-time updates from socket)
    const handlePaymentStatusUpdated = (data: any) => {
      if (data.bookingId === bookingId || data.booking?._id === bookingId) {
        console.log('💳 Payment status updated via socket:', {
          paymentStatus: data.paymentStatus,
          userConfirmed: data.userConfirmed,
          workerConfirmed: data.workerConfirmed,
        });
        
        // Update booking state with latest payment information
        setBooking(prev => prev ? {
          ...prev,
          paymentStatus: data.paymentStatus || data.booking?.paymentStatus || prev.paymentStatus,
          userConfirmedPayment: data.userConfirmed !== undefined ? data.userConfirmed : (data.booking?.userConfirmedPayment ?? prev.userConfirmedPayment),
          workerConfirmedPayment: data.workerConfirmed !== undefined ? data.workerConfirmed : (data.booking?.workerConfirmedPayment ?? prev.workerConfirmedPayment),
          paymentConfirmedAt: (data.booking as any)?.paymentConfirmedAt || (prev as any).paymentConfirmedAt,
          // Update all booking fields if full booking object is provided
          ...(data.booking ? {
            ...data.booking,
            // Preserve existing fields that might not be in the update
            _id: prev._id,
            userId: (prev as any).userId,
            workerId: prev.workerId,
          } : {}),
        } : null);
        
        // Show notification if payment status changed to paid
        if (data.paymentStatus === 'paid' || data.booking?.paymentStatus === 'paid') {
          console.log('✅ Payment status updated to paid!');
        }
        
        // Refresh booking details to ensure consistency
        setTimeout(() => {
          fetchBookingDetails();
        }, 500);
      }
    };

    // Listen for booking status updates (from backend status endpoint)
    const handleBookingUpdated = (updatedBooking: any) => {
      if (updatedBooking._id === bookingId || updatedBooking.id === bookingId) {
        console.log('📝 Booking updated event received in live-tracking:', {
          bookingId: updatedBooking._id,
          status: updatedBooking.status,
          paymentStatus: updatedBooking.paymentStatus,
        });
        
        // Update booking state immediately with all fields
        setBooking(prev => {
          // Play haptic feedback and sound for status updates
          if (prev && updatedBooking.status && updatedBooking.status !== prev.status) {
            const status = updatedBooking.status;
            if (status === 'accepted') {
              notificationSoundService.playNotificationSound('booking', 'accepted');
            } else if (status === 'completed') {
              notificationSoundService.playNotificationSound('booking', 'completed');
            } else if (status === 'cancelled') {
              notificationSoundService.playNotificationSound('booking', 'cancelled');
            }
          }
          
          return prev ? { 
            ...prev, 
            ...updatedBooking,
            status: updatedBooking.status || prev.status,
            paymentStatus: updatedBooking.paymentStatus || prev.paymentStatus,
            userConfirmedPayment: updatedBooking.userConfirmedPayment !== undefined ? updatedBooking.userConfirmedPayment : prev.userConfirmedPayment,
            workerConfirmedPayment: updatedBooking.workerConfirmedPayment !== undefined ? updatedBooking.workerConfirmedPayment : prev.workerConfirmedPayment,
            paymentConfirmedAt: (updatedBooking as any).paymentConfirmedAt || (prev as any).paymentConfirmedAt,
          } : null;
        });
        
        // Update work status and navigation status based on booking status
        if (updatedBooking.status) {
          if (updatedBooking.status === 'accepted') {
            setNavStatus('accepted');
          } else if (updatedBooking.status === 'in_progress') {
            setWorkStatus('in_progress');
            setNavStatus('ended');
            // If workStartTime is provided, set it
            if (updatedBooking.workStartTime) {
              const startTime = new Date(updatedBooking.workStartTime);
              setWorkStartTime(startTime);
            }
          } else if (updatedBooking.status === 'completed') {
            setWorkStatus('completed');
          } else if (updatedBooking.status === 'cancelled' || updatedBooking.status === 'rejected') {
            // Handle cancelled/rejected status
            setNavStatus('ended');
            Alert.alert(
              updatedBooking.status === 'cancelled' ? 'Booking Cancelled' : 'Booking Rejected',
              updatedBooking.status === 'cancelled' 
                ? 'This booking has been cancelled.' 
                : 'No worker is available for this booking.',
              [{ text: 'OK', onPress: () => router.back() }]
            );
          }
        }
        
        // Refresh booking details to get latest data
        setTimeout(() => {
          fetchBookingDetails();
        }, 300);
      }
    };

    // Listen for booking cancelled
    const handleBookingCancelled = (data: any) => {
      if (data.bookingId === bookingId || data.booking?._id === bookingId) {
        console.log('🚫 Booking cancelled event received in live-tracking:', data);
        setBooking(prev => prev ? { ...prev, status: 'cancelled' } : null);
        setNavStatus('ended');
        Alert.alert(
          'Booking Cancelled',
          'This booking has been cancelled.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        setTimeout(() => {
          fetchBookingDetails();
        }, 300);
      }
    };

    // Listen for booking rejected
    const handleBookingRejected = (data: any) => {
      if (data.bookingId === bookingId || data.booking?._id === bookingId) {
        console.log('❌ Booking rejected event received in live-tracking:', data);
        setBooking(prev => prev ? { ...prev, status: 'rejected' } : null);
        setNavStatus('ended');
        Alert.alert(
          'Booking Rejected',
          'No worker is available for this booking.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        setTimeout(() => {
          fetchBookingDetails();
        }, 300);
      }
    };

    // Start MapService if we have both locations (from initial booking load or updates)
    const initializeMapService = () => {
      if (booking?.workerLocation && booking?.location?.coordinates) {
        mapService.startMapUpdates({
          origin: {
            latitude: booking.workerLocation.latitude,
            longitude: booking.workerLocation.longitude,
          },
          destination: {
            latitude: booking.location.coordinates.latitude,
            longitude: booking.location.coordinates.longitude,
          },
          updateInterval: 4000, // 4 seconds (between 3-5 seconds)
          enableRoute: true,
          onRouteUpdate: handleMapServiceRouteUpdate,
        });
      }
    };

    // Initialize MapService when booking is loaded
    if (booking) {
      initializeMapService();
    }

    // Register all socket listeners
    socketService.on('booking:accepted', handleBookingAccepted);
    socketService.on('booking:cancelled', handleBookingCancelled);
    socketService.on('booking:rejected', handleBookingRejected);
    socketService.on('location:tracking:started', handleLocationTrackingStarted);
    socketService.on('route:updated', handleRouteUpdated);
    socketService.on('worker:location', handleWorkerLocation);
    socketService.on('navigation:started', handleNavigationStarted);
    socketService.on('navigation:arrived', handleNavigationArrived);
    socketService.on('navigation:ended', handleNavigationEnded);
    socketService.on('work:started', handleWorkStarted);
    socketService.on('work:completed', handleWorkCompleted);
    socketService.on('booking:updated', handleBookingUpdated);
    socketService.on('payment:status_updated', handlePaymentStatusUpdated);

    // Poll for updates every 30 seconds (backup)
    const interval = setInterval(fetchBookingDetails, 30000);

    return () => {
      clearInterval(interval);
      // Stop route fetch interval
      if (routeFetchInterval.current) {
        clearInterval(routeFetchInterval.current);
        routeFetchInterval.current = null;
      }
      // Clear map ready timeout
      if (mapReadyTimeoutRef.current) {
        clearTimeout(mapReadyTimeoutRef.current);
        mapReadyTimeoutRef.current = null;
      }
      // Stop MapService updates
      mapService.stopMapUpdates();
      mapService.removeRouteCallback(handleMapServiceRouteUpdate);
      // Reset map ready states
      setMapReady(false);
      setCanRenderChildren(false);
      
      // Clean up socket listeners
      socketService.off('booking:accepted', handleBookingAccepted);
      socketService.off('booking:cancelled', handleBookingCancelled);
      socketService.off('booking:rejected', handleBookingRejected);
      socketService.off('location:tracking:started', handleLocationTrackingStarted);
      socketService.off('route:updated', handleRouteUpdated);
      socketService.off('worker:location', handleWorkerLocation);
      socketService.off('navigation:started', handleNavigationStarted);
      socketService.off('navigation:arrived', handleNavigationArrived);
      socketService.off('navigation:ended', handleNavigationEnded);
      socketService.off('work:started', handleWorkStarted);
      socketService.off('work:completed', handleWorkCompleted);
      socketService.off('booking:updated', handleBookingUpdated);
      socketService.off('payment:status_updated', handlePaymentStatusUpdated);
    };
  }, [bookingId, booking, user?.id]);

  // ARCHITECTURE: User app does NOT fetch routes - only receives via socket
  // Removed auto-fetch useEffect

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

  const handleConfirmPayment = async () => {
    if (!booking || !user?.id) return;
    
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
        setBooking(prev => prev ? {
          ...prev,
          userConfirmedPayment: data.booking.userConfirmedPayment || true,
          workerConfirmedPayment: data.booking.workerConfirmedPayment || false,
          paymentStatus: data.booking.paymentStatus || 'pending',
          paymentConfirmedAt: data.booking.paymentConfirmedAt,
          // Update all booking fields from response to ensure consistency
          ...data.booking,
        } : null);
        
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
        
        // Refresh booking details to get latest data from backend
        setTimeout(() => {
          fetchBookingDetails();
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

  // Memoize worker info to prevent hook order issues - MUST be before early returns
  const workerName = useMemo(() => {
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
    return booking ? 'Worker' : 'Awaiting assignment';
  }, [booking, workerData]);

  const workerPhone = useMemo(() => {
    return booking?.worker?.phone || (booking?.workerId && typeof booking.workerId === 'object' ? booking.workerId.phone : null) || workerData?.phone || '—';
  }, [booking, workerData]);

  const workerProfileImage = useMemo(() => {
    return booking?.worker?.profileImage || booking?.worker?.image || (booking?.workerId && typeof booking.workerId === 'object' ? (booking.workerId.profileImage || booking.workerId.image) : null) || workerData?.profileImage || workerData?.image;
  }, [booking, workerData]);

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

  // Calculate current worker location (used in routeCoordinates and rendering)
  // Handle both object format {latitude, longitude} and nested format {location: {latitude, longitude}}
  const currentWorkerLocation = useMemo(() => {
    if (workerLocation) {
      // If workerLocation has latitude/longitude directly
      if (workerLocation.latitude && workerLocation.longitude) {
        return {
          latitude: workerLocation.latitude,
          longitude: workerLocation.longitude,
        };
      }
    }
    if (booking?.workerLocation) {
      if (booking.workerLocation.latitude && booking.workerLocation.longitude) {
        return {
          latitude: booking.workerLocation.latitude,
          longitude: booking.workerLocation.longitude,
        };
      }
    }
    return null;
  }, [workerLocation, booking?.workerLocation]);
  
  // CRITICAL: Auto-fetch route when both locations become available
  useEffect(() => {
    if (currentWorkerLocation && booking?.location?.coordinates && !mapboxRouteData && !isFetchingRoute) {
      console.log('🔄 [AUTO-FETCH] Both locations available, fetching route automatically...', {
        worker: `${currentWorkerLocation.latitude.toFixed(6)}, ${currentWorkerLocation.longitude.toFixed(6)}`,
        user: `${booking.location.coordinates.latitude.toFixed(6)}, ${booking.location.coordinates.longitude.toFixed(6)}`,
      });
      fetchMapboxDirections(
        {
          latitude: currentWorkerLocation.latitude,
          longitude: currentWorkerLocation.longitude,
        },
        {
          latitude: booking.location.coordinates.latitude,
          longitude: booking.location.coordinates.longitude,
        }
      );
    }
  }, [currentWorkerLocation, booking?.location?.coordinates, mapboxRouteData, isFetchingRoute]);
  
  // ARCHITECTURE: Memoize polyline geometry - Prioritize Mapbox route data, fallback to routeData
  // Dependency ensures it only updates when route changes, not on GPS updates
  const routeCoordinates = useMemo(() => {
    try {
      // PRIORITY 1: Use Mapbox route data (most accurate, road-based)
      if (mapboxRouteData && mapboxRouteData.coordinates && mapboxRouteData.coordinates.length > 0) {
        console.log('✅ Using Mapbox route coordinates:', mapboxRouteData.coordinates.length, 'points');
        return mapboxRouteData.coordinates;
      }
      
      // PRIORITY 2: Use routeData from backend/socket
      if (routeData && routeData.coordinates && routeData.coordinates.length > 0) {
        // Handle both GeoJSON format [longitude, latitude] and {latitude, longitude} format
        const coords = routeData.coordinates.map((coord: any) => {
          if (Array.isArray(coord)) {
            // GeoJSON format: [longitude, latitude]
            return {
              latitude: coord[1],
              longitude: coord[0],
            };
          } else if (coord.latitude && coord.longitude) {
            // Already in {latitude, longitude} format
            return {
              latitude: coord.latitude,
              longitude: coord.longitude,
            };
          }
          return null;
        }).filter((coord: any) => coord !== null);
        
        console.log('✅ Route coordinates converted from routeData:', coords.length, 'points');
        return coords;
      }
      
      // FALLBACK: Create a simple straight-line route if we have both locations
      if (currentWorkerLocation && booking?.location?.coordinates) {
        console.log('⚠️ No route data, creating fallback straight-line route');
        return [
          {
            latitude: currentWorkerLocation.latitude,
            longitude: currentWorkerLocation.longitude,
          },
          {
            latitude: booking.location.coordinates.latitude,
            longitude: booking.location.coordinates.longitude,
          },
        ];
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error processing route coordinates:', error);
      return [];
    }
  }, [mapboxRouteData?.coordinates, routeData?.coordinates, currentWorkerLocation, booking?.location?.coordinates]);

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
        {/* Map View - CRITICAL: Always render MapView to prevent unmount/remount issues */}
        <View style={styles.mapContainer} collapsable={false}>
          {/* Error overlay - shown on top of map */}
          {mapError && (
            <View style={[styles.mapErrorContainer, { position: 'absolute', zIndex: 1000, width: '100%', height: '100%' }]}>
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
              <Text style={styles.mapErrorText}>Map Loading Error</Text>
              <Text style={styles.mapErrorSubtext}>{mapError}</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setMapError(null);
                  setMapReady(false);
                  setCanRenderChildren(false);
                }}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* MapView - ALWAYS rendered, never unmounted */}
          <MapComponent
            key="map-component-stable-never-unmount"
            ref={mapRef}
            provider={Platform.OS === 'android' ? GOOGLE_PROVIDER : undefined}
            style={[styles.map, mapError && { opacity: 0.3 }]}
            mapType="standard"
            initialRegion={{
              latitude: userLocationCoords.latitude,
              longitude: userLocationCoords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            removeClippedSubviews={false}
            collapsable={false}
            onMapReady={() => {
              console.log('✅ Map loaded successfully');
              setMapReady(true);
              setMapError(null);
              
              // CRITICAL: Fetch route immediately when map is ready if we have both locations
              if (currentWorkerLocation && booking?.location?.coordinates) {
                console.log('🗺️ [MAP READY] Fetching initial route on map load...');
                fetchMapboxDirections(
                  {
                    latitude: currentWorkerLocation.latitude,
                    longitude: currentWorkerLocation.longitude,
                  },
                  {
                    latitude: booking.location.coordinates.latitude,
                    longitude: booking.location.coordinates.longitude,
                  }
                );
              } else {
                console.warn('⚠️ [MAP READY] Cannot fetch route - missing locations:', {
                  hasWorkerLocation: !!currentWorkerLocation,
                  hasUserLocation: !!booking?.location?.coordinates,
                });
              }
              
              // CRITICAL FIX: Longer delay for lower-end Android devices (Samsung A70, Realme 14C)
              // These devices need more time for the native map view to fully initialize
              if (Platform.OS === 'android') {
                // Clear any existing timeout
                if (mapReadyTimeoutRef.current) {
                  clearTimeout(mapReadyTimeoutRef.current);
                }
                
                      // Universal delay: Works on ALL Android devices (low-end to high-end)
                      // Use 2 frames + 500ms delay - balanced for all devices
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          mapReadyTimeoutRef.current = setTimeout(() => {
                            console.log('✅ Map children can now render safely (universal delay)');
                            setCanRenderChildren(true);
                          }, 500);
                        });
                      });
              } else {
                // iOS can render immediately
                setCanRenderChildren(true);
              }
                
                // Fit map to show both locations if available
                if (Platform.OS === 'android' && mapRef.current?.fitToCoordinates) {
                  const locations: Array<{ latitude: number; longitude: number }> = [];
                  if (currentWorkerLocation && currentWorkerLocation.latitude && currentWorkerLocation.longitude) {
                    locations.push({
                      latitude: currentWorkerLocation.latitude,
                      longitude: currentWorkerLocation.longitude,
                    });
                  }
                  if (userLocationCoords && userLocationCoords.latitude && userLocationCoords.longitude) {
                    locations.push({
                      latitude: userLocationCoords.latitude,
                      longitude: userLocationCoords.longitude,
                    });
                  }
                  
                  if (locations.length > 1) {
                    setTimeout(() => {
                      try {
                        mapRef.current?.fitToCoordinates(locations, {
                          edgePadding: { top: 80, right: 40, bottom: 200, left: 40 },
                          animated: true,
                        });
                      } catch (e) {
                        console.warn('Map fit error:', e);
                      }
                    }, 500);
                  }
                }
              }}
              onError={(error: any) => {
                console.error('❌ Map error:', error);
                setMapError(error?.message || 'Failed to load map. Please check your internet connection.');
              }}
              // Remove region prop to prevent blinking - use animateToCoordinate instead
              onRegionChangeComplete={(region: any) => {
                // Prevent unnecessary updates
              }}
              showsUserLocation={false}
              showsMyLocationButton={false}
              loadingEnabled={true}
              loadingIndicatorColor="#2563EB"
              // Android-specific optimizations
              {...(Platform.OS === 'android' && {
                mapPadding: { top: 0, right: 0, bottom: 0, left: 0 },
                pitchEnabled: false,
                rotateEnabled: false,
                scrollEnabled: true,
                zoomEnabled: true,
                zoomControlEnabled: false,
                toolbarEnabled: false,
                cacheEnabled: true,
                liteMode: false,
              })}
            >
            {/* UNIVERSAL FIX: Use native markers (pinColor) for maximum compatibility across all devices/OS */}
            {/* Render markers only when map is ready - works on ALL devices (Android/iOS, any model) */}
            {mapReady && canRenderChildren && (
              <>
                {/* User marker - Use native pinColor for universal compatibility */}
                {userLocationCoords && userLocationCoords.latitude && userLocationCoords.longitude && (
                  <MarkerComponent
                    key="user-location-marker-universal"
                    identifier="user-location-marker"
                    coordinate={userLocationCoords}
                    title="Your Location"
                    description={booking.location?.address || 'Service Location'}
                    pinColor="#4A90E2"
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={false}
                  />
                )}

                {/* Worker marker - Use native pinColor for universal compatibility */}
                {currentWorkerLocation && currentWorkerLocation.latitude && currentWorkerLocation.longitude && (
                  <MarkerComponent
                    key="worker-marker-universal"
                    identifier="worker-location-marker"
                    coordinate={{
                      latitude: currentWorkerLocation.latitude,
                      longitude: currentWorkerLocation.longitude,
                    }}
                    title={workerName || 'Worker'}
                    description={navStatus === 'navigating' ? 'Navigating to you...' : 'Worker Location'}
                    pinColor={navStatus === 'navigating' ? '#2563EB' : '#10B981'}
                    anchor={{ x: 0.5, y: 1 }}
                    flat={false}
                    tracksViewChanges={false}
                  />
                )}

                {/* Route Line - Mapbox route visualization on road - ALWAYS render when route exists */}
                {PolylineComponent && routeCoordinates.length > 0 && (
                  <PolylineComponent
                    key={`route-polyline-${routeCoordinates.length}`}
                    identifier="route-polyline"
                    coordinates={routeCoordinates}
                    strokeColor="#2563EB"
                    strokeWidth={Platform.OS === 'ios' ? 6 : 8}
                    lineCap="round"
                    lineJoin="round"
                    geodesic={true}
                    tappable={false}
                    zIndex={1}
                  />
                )}
              </>
            )}
            
            {/* Loading indicator - Show when fetching route */}
            {(isFetchingRoute || (!mapboxRouteData && !routeData && locationTrackingStarted)) && (
              <View style={styles.routeLoadingContainer}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.routeLoadingText}>
                  {isFetchingRoute ? 'Fetching route from Mapbox...' : 'Calculating route...'}
                </Text>
              </View>
            )}
          </MapComponent>

          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Booking Info Card */}
        <View style={styles.infoCard}>
          {/* Status Flow Indicator */}
          <View style={styles.statusFlowContainer}>
            <View style={styles.statusFlowRow}>
              {/* Step 1: Request Sent */}
              <View style={styles.statusStep}>
                <View style={[
                  styles.statusStepCircle,
                  { backgroundColor: booking.status === 'pending' ? '#4CAF50' : '#E0E0E0' }
                ]}>
                  <Ionicons 
                    name="checkmark" 
                    size={16} 
                    color={booking.status === 'pending' ? '#fff' : '#9E9E9E'} 
                  />
                </View>
                <Text style={[
                  styles.statusStepText,
                  { color: booking.status === 'pending' ? '#4CAF50' : '#9E9E9E' }
                ]}>Request Sent</Text>
              </View>

              {/* Step 2: Accepted */}
              <View style={styles.statusStep}>
                <View style={[
                  styles.statusStepCircle,
                  { backgroundColor: (booking.status === 'accepted' || booking.status === 'in_progress' || booking.status === 'completed') ? '#4CAF50' : '#E0E0E0' }
                ]}>
                  <Ionicons 
                    name="checkmark" 
                    size={16} 
                    color={(booking.status === 'accepted' || booking.status === 'in_progress' || booking.status === 'completed') ? '#fff' : '#9E9E9E'} 
                  />
                </View>
                <Text style={[
                  styles.statusStepText,
                  { color: (booking.status === 'accepted' || booking.status === 'in_progress' || booking.status === 'completed') ? '#4CAF50' : '#9E9E9E' }
                ]}>Accepted</Text>
              </View>

              {/* Step 3: Navigating */}
              <View style={styles.statusStep}>
                <View style={[
                  styles.statusStepCircle,
                  { backgroundColor: (navStatus === 'navigating' || navStatus === 'arrived' || navStatus === 'ended' || workStatus === 'in_progress' || workStatus === 'completed') ? '#4CAF50' : '#E0E0E0' }
                ]}>
                  <Ionicons 
                    name={navStatus === 'navigating' ? "navigate" : "checkmark"} 
                    size={16} 
                    color={(navStatus === 'navigating' || navStatus === 'arrived' || navStatus === 'ended' || workStatus === 'in_progress' || workStatus === 'completed') ? '#fff' : '#9E9E9E'} 
                  />
                </View>
                <Text style={[
                  styles.statusStepText,
                  { color: (navStatus === 'navigating' || navStatus === 'arrived' || navStatus === 'ended' || workStatus === 'in_progress' || workStatus === 'completed') ? '#4CAF50' : '#9E9E9E' }
                ]}>Navigating</Text>
              </View>

              {/* Step 4: Arrived */}
              <View style={styles.statusStep}>
                <View style={[
                  styles.statusStepCircle,
                  { backgroundColor: (navStatus === 'arrived' || navStatus === 'ended' || workStatus === 'in_progress' || workStatus === 'completed') ? '#4CAF50' : '#E0E0E0' }
                ]}>
                  <Ionicons 
                    name="checkmark" 
                    size={16} 
                    color={(navStatus === 'arrived' || navStatus === 'ended' || workStatus === 'in_progress' || workStatus === 'completed') ? '#fff' : '#9E9E9E'} 
                  />
                </View>
                <Text style={[
                  styles.statusStepText,
                  { color: (navStatus === 'arrived' || navStatus === 'ended' || workStatus === 'in_progress' || workStatus === 'completed') ? '#4CAF50' : '#9E9E9E' }
                ]}>Arrived</Text>
              </View>

              {/* Step 5: Working */}
              <View style={styles.statusStep}>
                <View style={[
                  styles.statusStepCircle,
                  { backgroundColor: (workStatus === 'in_progress' || workStatus === 'completed') ? '#4CAF50' : '#E0E0E0' }
                ]}>
                  <Ionicons 
                    name={workStatus === 'in_progress' ? "hammer" : "checkmark"} 
                    size={16} 
                    color={(workStatus === 'in_progress' || workStatus === 'completed') ? '#fff' : '#9E9E9E'} 
                  />
                </View>
                <Text style={[
                  styles.statusStepText,
                  { color: (workStatus === 'in_progress' || workStatus === 'completed') ? '#4CAF50' : '#9E9E9E' }
                ]}>Working</Text>
              </View>

              {/* Step 6: Completed */}
              <View style={styles.statusStep}>
                <View style={[
                  styles.statusStepCircle,
                  { backgroundColor: workStatus === 'completed' ? '#4CAF50' : '#E0E0E0' }
                ]}>
                  <Ionicons 
                    name="checkmark" 
                    size={16} 
                    color={workStatus === 'completed' ? '#fff' : '#9E9E9E'} 
                  />
                </View>
                <Text style={[
                  styles.statusStepText,
                  { color: workStatus === 'completed' ? '#4CAF50' : '#9E9E9E' }
                ]}>Completed</Text>
              </View>
            </View>
          </View>

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
                {workerName} is on the way • {distanceRemaining > 0 ? `${distanceRemaining.toFixed(2)} km remaining` : `${calculatedDistance.toFixed(2)} km`} • ETA: {eta} min
              </Text>
              {distanceTraveled > 0 && (
                <Text style={styles.distanceTraveledText}>
                  Traveled: {distanceTraveled.toFixed(2)} km
                </Text>
              )}
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
            <>
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.completedText}>
                  {workerName} has completed the work! Please proceed to payment.
                </Text>
              </View>
              {booking.paymentStatus !== 'paid' && !booking.userConfirmedPayment && (
                <TouchableOpacity
                  style={[styles.confirmPaymentButton, { backgroundColor: '#4CAF50' }]}
                  onPress={handleConfirmPayment}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.confirmPaymentButtonText}>Confirm Payment</Text>
                </TouchableOpacity>
              )}
              {booking.paymentStatus !== 'paid' && booking.userConfirmedPayment && !booking.workerConfirmedPayment && (
                <View style={styles.waitingPaymentBadge}>
                  <Ionicons name="hourglass" size={16} color="#FF9800" />
                  <Text style={styles.waitingPaymentText}>Waiting for worker to confirm payment</Text>
                </View>
              )}
              {booking.paymentStatus === 'paid' && (
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.paidText}>Payment Confirmed by Both Parties</Text>
                </View>
              )}
            </>
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
  mapErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  mapErrorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 16,
    textAlign: 'center',
  },
  mapErrorSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
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
  workerMarkerNavigating: {
    backgroundColor: '#2563EB',
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 10,
    borderWidth: 4,
    borderColor: '#60A5FA',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
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
  statusFlowContainer: {
    marginBottom: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  statusFlowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statusStep: {
    alignItems: 'center',
    flex: 1,
  },
  statusStepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  statusStepText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
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
  distanceTraveledText: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
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
  confirmPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  confirmPaymentButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  waitingPaymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    marginBottom: 16,
  },
  waitingPaymentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    marginBottom: 16,
  },
  paidText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
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
  routeLoadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -80 }, { translateY: -20 }],
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  routeLoadingText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
});

