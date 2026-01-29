import React, { useState, useEffect, useRef, useMemo } from 'react';
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

// ARCHITECTURE: Use react-native-maps for map rendering, Mapbox Directions API for route calculation only
let RNMapView: any = null;
let RNMarker: any = null;
let RNPolyline: any = null;
let getDirections: any;
let mapsAvailable = false;

// Load react-native-maps for map rendering (only on native platforms, not web)
if (Platform.OS !== 'web') {
  try {
    const RNMaps = require('react-native-maps');
    RNMapView = RNMaps.default || RNMaps;
    RNMarker = RNMaps.Marker;
    RNPolyline = RNMaps.Polyline;
    mapsAvailable = true;
    console.log('✅ react-native-maps loaded successfully');
  } catch (mapsError) {
    console.error('❌ react-native-maps not available:', mapsError);
    mapsAvailable = false;
  }
} else {
  console.log('🌐 Web platform: react-native-maps not available (native-only module)');
  mapsAvailable = false;
}

// Load Mapbox Directions API (for route calculation only, no native modules needed)
try {
  const MapboxConfig = require('@/lib/MapboxConfig');
  getDirections = MapboxConfig.getDirections;
  console.log(' Mapbox Directions API loaded (for route calculation only)');
} catch (error) {
  console.error(' Mapbox Directions API not available:', error);
  getDirections = null;
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
  const [navigationStartTime, setNavigationStartTime] = useState<Date | null>(null);
  const [navigationDuration, setNavigationDuration] = useState<number>(0);
  const navigationStartTimeRef = useRef<Date | null>(null); // Use ref for immediate access
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
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [canRenderChildren, setCanRenderChildren] = useState<boolean>(false);
  const mapReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // ARCHITECTURE: Live GPS stored in useRef, React state only for UI updates
  const liveLocationRef = useRef<any>(null);
  const lastSocketEmitRef = useRef<number>(0);
  const lastUIUpdateRef = useRef<number>(0);
  const [currentStep, setCurrentStep] = useState<any>(null);
  const [nextStep, setNextStep] = useState<any>(null);
  const [navigationInstructions, setNavigationInstructions] = useState<string>('');
  const [distanceToNextTurn, setDistanceToNextTurn] = useState<number>(0);
  
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
    // Maps are loaded at module level - no initialization needed
    fetchBookingDetails();
    startLocationTracking();
    
    // Note: User location is fetched from booking data, not via socket
    // This ensures we always have the correct booking location

    // Listen for booking updates
    socketService.on('booking:updated', (updatedBooking: any) => {
      if (updatedBooking._id === bookingId || updatedBooking.id === bookingId) {
        console.log(' Booking updated in job-navigation:', updatedBooking);
        setBooking(updatedBooking);
        
        // Update nav status based on booking status - do NOT set 'idle' on 'accepted'
        // so that when worker clicks Start Navigation we don't overwrite 'navigating' with 'idle'
        if (updatedBooking.status === 'in_progress') {
          setNavStatus('working');
          if (updatedBooking.workStartTime) {
            setWorkStartTime(new Date(updatedBooking.workStartTime));
          }
        } else if (updatedBooking.status === 'completed') {
          setNavStatus('completed');
        }
        // When status === 'accepted': leave navStatus unchanged (keeps 'navigating' if worker just started)
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
      socketService.off('booking:updated');
      socketService.off('payment:status_updated');
      // Clear map ready timeout
      if (mapReadyTimeoutRef.current) {
        clearTimeout(mapReadyTimeoutRef.current);
        mapReadyTimeoutRef.current = null;
      }
      // Reset map ready states
      setMapReady(false);
      setCanRenderChildren(false);
    };
  }, [bookingId]);

  // Update navigation duration timer (starts when navigation begins)
  useEffect(() => {
    if (navStatus === 'navigating' && navigationStartTimeRef.current) {
      console.log('⏰ Starting navigation timer useEffect, start time:', navigationStartTimeRef.current.toISOString());
      const interval = setInterval(() => {
        if (navigationStartTimeRef.current) {
          const now = new Date();
          const diff = Math.floor((now.getTime() - navigationStartTimeRef.current.getTime()) / 1000);
          setNavigationDuration(diff);
          if (diff % 10 === 0) { // Log every 10 seconds for debugging
            console.log('⏰ Navigation timer:', diff, 'seconds');
          }
        }
      }, 1000);
      
      return () => {
        console.log('⏰ Clearing navigation timer interval');
        clearInterval(interval);
      };
    } else if (navStatus !== 'navigating') {
      // Reset navigation duration when not navigating
      setNavigationDuration(0);
      navigationStartTimeRef.current = null;
    }
  }, [navStatus]);

  // Update work duration timer (starts when work begins)
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
        
        // CRITICAL: Initialize navigation and work status from booking data
        // This ensures the timer starts if work has already started
        if (data.status === 'in_progress') {
          setNavStatus('working');
          if (data.workStartTime) {
            const startTime = new Date(data.workStartTime);
            setWorkStartTime(startTime);
            console.log('⏰ Work start time loaded from booking:', startTime.toISOString());
            // Calculate initial work duration
            const now = new Date();
            const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
            setWorkDuration(Math.max(0, diff));
          }
        } else if (data.status === 'accepted') {
          // Only set to idle on initial load - don't overwrite if already 'navigating' (use functional update)
          setNavStatus(prev => (prev === 'navigating' ? 'navigating' : 'idle'));
        } else if (data.status === 'completed') {
          setNavStatus('completed');
          if (data.workStartTime) {
            const startTime = new Date(data.workStartTime);
            setWorkStartTime(startTime);
            // Calculate final work duration
            if (data.completedAt) {
              const completedAt = new Date(data.completedAt);
              const diff = Math.floor((completedAt.getTime() - startTime.getTime()) / 1000);
              setWorkDuration(Math.max(0, diff));
            }
          }
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

      // ARCHITECTURE: Watch GPS with quality control and throttling
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 1000, // Fast GPS updates for internal use
          distanceInterval: 5,
          mayShowUserSettingsDialog: true,
        },
        (location) => {
          // ARCHITECTURE RULE: Ignore GPS if accuracy > 40 meters or stale
          if (location.coords.accuracy && location.coords.accuracy > 40) {
            console.warn(' Ignoring low-quality GPS:', location.coords.accuracy, 'meters (threshold: 40m)');
            return; // Skip this update
          }
          
          // Check timestamp freshness (ignore if > 5 seconds old)
          const now = Date.now();
          const locationAge = now - location.timestamp;
          if (locationAge > 5000) {
            console.warn(' Ignoring stale GPS reading:', locationAge, 'ms old');
            return;
          }
          
          const newLoc = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
          };
          
          // ARCHITECTURE: Store in useRef for live tracking
          liveLocationRef.current = newLoc;
          
          // ARCHITECTURE: UI state update max once every 2 seconds
          const timeSinceLastUIUpdate = now - lastUIUpdateRef.current;
          if (timeSinceLastUIUpdate >= 2000) {
            setWorkerLocation(newLoc);
            lastUIUpdateRef.current = now;
          }

          // ARCHITECTURE: Calculate distance only if navigating and have route
          if (navStatus === 'navigating' && previousLocationRef.current && routeData) {
            const segmentDistance = calculateDistance(previousLocationRef.current, newLoc);
            const newDistanceTraveled = distanceTraveled + segmentDistance;
            const routeDistanceKm = routeData.distance / 1000;
            const remaining = Math.max(0, routeDistanceKm - newDistanceTraveled);
            
            setDistanceTraveled(newDistanceTraveled);
            setDistanceRemaining(remaining);
            setDistance(remaining);
            
            // Update navigation step
            if (routeData?.steps) {
              updateNavigationStep(newLoc);
            }
            
            previousLocationRef.current = newLoc;
            
            // ARCHITECTURE RULE: Recalculate route ONLY if deviation > 120 meters from polyline
            // Check distance to nearest point on route polyline
            if (routeData.geometry?.coordinates) {
              let minDistanceToRoute = Infinity;
              routeData.geometry.coordinates.forEach((coord: [number, number]) => {
                const dist = calculateDistance(newLoc, {
                  latitude: coord[1],
                  longitude: coord[0],
                });
                minDistanceToRoute = Math.min(minDistanceToRoute, dist);
              });
              
              // Only recalculate if deviated > 120m from route
              if (minDistanceToRoute > 0.12) { // 120 meters
                console.log(' Worker deviated >120m from route, recalculating...');
                recalculateRoute(newLoc, userLocation);
              }
            }
          } else if (navStatus === 'navigating') {
            previousLocationRef.current = newLoc;
          }

          // ARCHITECTURE RULE: Throttle socket emits to 3-5 seconds
          const timeSinceLastSocketEmit = now - lastSocketEmitRef.current;
          if (timeSinceLastSocketEmit >= 3000) { // 3 seconds
            // ARCHITECTURE: Worker emits ONLY basic location data (no route calculation)
            socketService.emit('worker:location', {
              workerId: worker?.id,
              bookingId,
              latitude: newLoc.latitude,
              longitude: newLoc.longitude,
              accuracy: newLoc.accuracy,
              timestamp: newLoc.timestamp,
            });
            lastSocketEmitRef.current = now;
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

  // Helper to calculate distance in meters
  const calculateDistanceMeters = (point1: any, point2: any): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchRoute = async (origin: any, destination: any) => {
    // Calculate straight-line distance first
    const straightLineDistance = calculateDistanceMeters(origin, destination);
    
    // CRITICAL: If users are very close (< 50 meters), skip route fetching and use straight-line
    const MIN_ROUTE_DISTANCE = 50; // 50 meters minimum distance to fetch route
    if (straightLineDistance < MIN_ROUTE_DISTANCE) {
      console.log(`📍 [NEARBY] Users are very close (${straightLineDistance.toFixed(1)}m), skipping route fetch and using straight-line`);
      
      // Create a simple straight-line route for visualization
      const simpleRoute = {
        geometry: {
          type: 'LineString',
          coordinates: [
            [origin.longitude, origin.latitude],
            [destination.longitude, destination.latitude]
          ]
        },
        distance: straightLineDistance, // in meters
        duration: Math.max(1, Math.ceil(straightLineDistance / 1.4)), // Walking speed ~1.4 m/s, minimum 1 second
        steps: [] // No steps for very short routes
      };
      
      setRouteData(simpleRoute);
      const routeDistanceKm = straightLineDistance / 1000;
      setTotalRouteDistance(routeDistanceKm);
      setDistanceRemaining(routeDistanceKm);
      setDistanceTraveled(0);
      setDistance(routeDistanceKm);
      setEta(Math.max(1, Math.ceil(straightLineDistance / 1.4 / 60))); // Convert to minutes, minimum 1
      
      // Emit route update to user app
      socketService.emit('route:updated', {
        bookingId,
        route: simpleRoute.geometry,
        distance: straightLineDistance,
        duration: simpleRoute.duration,
        timestamp: new Date().toISOString(),
        distanceTraveled: 0,
        distanceRemaining: routeDistanceKm,
      });
      
      console.log('✅ [NEARBY] Straight-line route created for nearby locations:', {
        distance: `${Math.round(straightLineDistance)} m`,
        duration: `${simpleRoute.duration} sec`,
      });
      
      return simpleRoute; // Return the simple route
    }
    
    if (!getDirections) {
      console.log('⚠️ Mapbox not available, skipping route fetch');
      setRouteError('Mapbox is not available. Please ensure Mapbox is properly configured.');
      return null;
    }

    try {
      setRouteError(null);
      console.log('🗺️ [MAPBOX REQUEST] Fetching route from Mapbox...', {
        origin: `${origin.latitude.toFixed(6)}, ${origin.longitude.toFixed(6)}`,
        destination: `${destination.latitude.toFixed(6)}, ${destination.longitude.toFixed(6)}`,
        straightLineDistance: `${(straightLineDistance / 1000).toFixed(2)} km`,
        timestamp: new Date().toISOString(),
      });
      const route = await getDirections(
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude],
        'driving-traffic' // Use driving-traffic for real-time traffic-aware routing
      );
      
      if (!route || !route.geometry) {
        throw new Error('Invalid route data received from Mapbox');
      }
      
      console.log('✅ [MAPBOX SUCCESS] Route fetched:', {
        distance: route.distance ? `${(route.distance / 1000).toFixed(2)} km` : 'N/A',
        duration: route.duration ? `${Math.ceil(route.duration / 60)} min` : 'N/A',
        points: route.geometry?.coordinates?.length || 0,
        requestTime: new Date().toISOString(),
      });
      
      setRouteData(route);
      const routeDistanceKm = (route.distance || 0) / 1000; // Convert to km
      setTotalRouteDistance(routeDistanceKm);
      setDistanceRemaining(routeDistanceKm);
      setDistanceTraveled(0);
      
      // Initialize navigation steps
      if (route.steps && route.steps.length > 0) {
        setCurrentStep(route.steps[0]);
        setNextStep(route.steps.length > 1 ? route.steps[1] : null);
        updateNavigationInstructions(route.steps[0], route.steps[1]);
      }
      
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
      
      // Emit enhanced route data to user app with distance tracking
      socketService.emit('route:updated', {
        bookingId,
        route: route.geometry,
        distance: route.distance,
        duration: route.duration,
        timestamp: new Date().toISOString(),
        distanceTraveled: 0,
        distanceRemaining: routeDistanceKm,
      });
      
      console.log(' Route fetched successfully:', route.distance, 'meters', route.duration, 'seconds');
      return route; // Return route data for caller
    } catch (error: any) {
      console.error(' Error fetching route:', error);
      const errorMessage = error.message || 'Failed to fetch route. Please check your internet connection and Mapbox configuration.';
      setRouteError(errorMessage);
      
      // If it's a network error, provide more specific guidance
      if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        setRouteError('Network error. Please check your internet connection and try again.');
      } else if (error.message?.includes('token') || error.message?.includes('access')) {
        setRouteError('Mapbox authentication error. Please check your API token configuration.');
      }
      
      return null;
    }
  };
  
  // Update navigation instructions based on current step
  const updateNavigationInstructions = (step: any, nextStep: any) => {
    if (!step) {
      setNavigationInstructions('Follow the route');
      return;
    }
    
    const instruction = step.banner_instructions?.[0]?.primary?.text || 
                       step.maneuver?.instruction || 
                       'Continue straight';
    
    setNavigationInstructions(instruction);
    
    // Calculate distance to next turn
    if (step.distance) {
      setDistanceToNextTurn(step.distance / 1000); // Convert to km
    } else if (nextStep) {
      // Estimate distance to next step
      const estimatedDistance = calculateDistance(
        { latitude: step.maneuver?.location?.[1] || 0, longitude: step.maneuver?.location?.[0] || 0 },
        { latitude: nextStep.maneuver?.location?.[1] || 0, longitude: nextStep.maneuver?.location?.[0] || 0 }
      );
      setDistanceToNextTurn(estimatedDistance);
    }
  };
  
  // Update current navigation step based on worker's position
  const updateNavigationStep = (currentLocation: any) => {
    if (!routeData?.steps || routeData.steps.length === 0) return;
    
    // Find the next upcoming step (not the closest, but the next one we haven't reached)
    let nextStepIndex = 0;
    let minDistance = Infinity;
    
    routeData.steps.forEach((step: any, index: number) => {
      if (step.maneuver?.location) {
        const stepLocation = {
          latitude: step.maneuver.location[1],
          longitude: step.maneuver.location[0],
        };
        const distance = calculateDistance(currentLocation, stepLocation);
        
        // Find the next step that's ahead of us (within reasonable distance)
        if (distance < minDistance && distance < 0.5) { // Within 500m
          minDistance = distance;
          nextStepIndex = index;
        }
      }
    });
    
    // Update current and next steps
    const currentStepData = routeData.steps[nextStepIndex];
    const nextStepData = nextStepIndex + 1 < routeData.steps.length 
      ? routeData.steps[nextStepIndex + 1] 
      : null;
    
    setCurrentStep(currentStepData);
    setNextStep(nextStepData);
    updateNavigationInstructions(currentStepData, nextStepData);
  };

  // ARCHITECTURE: Route recalculation ONLY when deviation > 120m (called from GPS callback)
  const recalculateRoute = async (currentLocation: any, destination: any) => {
    if (!getDirections || navStatus !== 'navigating') {
      return;
    }
    
    // Calculate straight-line distance first
    const straightLineDistance = calculateDistanceMeters(currentLocation, destination);
    
    // CRITICAL: If users are very close (< 50 meters), skip route recalculation
    const MIN_ROUTE_DISTANCE = 50; // 50 meters minimum distance to fetch route
    if (straightLineDistance < MIN_ROUTE_DISTANCE) {
      console.log(`📍 [NEARBY] Users are very close (${straightLineDistance.toFixed(1)}m), skipping route recalculation`);
      return;
    }
    
    // Prevent concurrent recalculations
    if ((mapRef.current as any)?._recalculating) {
      return;
    }
    (mapRef.current as any)._recalculating = true;
    
    try {
      console.log(' Recalculating route due to position change...');
      
      const newRoute = await getDirections(
        [currentLocation.longitude, currentLocation.latitude],
        [destination.longitude, destination.latitude],
        'driving-traffic'
      );
      
      if (newRoute && newRoute.geometry) {
        setRouteData(newRoute);
        
        // Update route distance calculations using route distance, not straight-line
        const newRouteDistance = newRoute.distance / 1000; // Convert to km
        const routeDistanceRemaining = newRouteDistance; // Use route distance, not straight-line
        
        setDistanceRemaining(routeDistanceRemaining);
        setTotalRouteDistance(newRouteDistance);
        
        // Update navigation steps
        if (newRoute.steps && newRoute.steps.length > 0) {
          updateNavigationStep(currentLocation);
        }
        
        // Emit updated route to user app
        socketService.emit('route:updated', {
          bookingId,
          route: newRoute.geometry,
          distance: newRoute.distance,
          duration: newRoute.duration,
          timestamp: new Date().toISOString(),
          distanceTraveled: distanceTraveled,
          distanceRemaining: routeDistanceRemaining,
        });
        
        console.log(' Route recalculated and updated to user app');
        previousLocationRef.current = currentLocation;
      }
    } catch (error) {
      console.error(' Error recalculating route:', error);
    } finally {
      (mapRef.current as any)._recalculating = false;
    }
  };

  const handleStartNavigation = async () => {
    // Use fallbacks so navigation can start even if state is slightly stale (e.g. GPS just updated in ref)
    const effectiveWorkerLocation = workerLocation ?? liveLocationRef.current ?? null;
    const effectiveUserLocation = userLocation ?? (booking?.location?.coordinates
      ? { latitude: booking.location.coordinates.latitude, longitude: booking.location.coordinates.longitude }
      : null);

    try {
      // Ensure we have location data before starting
      if (!effectiveWorkerLocation?.latitude || !effectiveWorkerLocation?.longitude) {
        Alert.alert('Error', 'Your location is not available yet. Please wait for GPS to initialize and try again.');
        return;
      }
      if (!effectiveUserLocation?.latitude || !effectiveUserLocation?.longitude) {
        Alert.alert('Error', 'Customer address is not available. Please ensure the booking has a location.');
        return;
      }

      // Start navigation timer FIRST using ref (immediate access)
      const navStartTime = new Date();
      navigationStartTimeRef.current = navStartTime;
      setNavigationStartTime(navStartTime);
      setNavigationDuration(0);
      console.log('⏰ Navigation timer started at:', navStartTime.toISOString());

      // Set navigation status so UI and timer effect update immediately
      setNavStatus('navigating');

      // Sync state if we used ref/booking fallbacks (so rest of app has latest)
      if (!workerLocation && effectiveWorkerLocation) setWorkerLocation(effectiveWorkerLocation);
      if (!userLocation && effectiveUserLocation) setUserLocation(effectiveUserLocation);

      // Fetch initial route and get route data
      console.log('🗺️ [NAVIGATION START] Fetching route...', {
        workerLocation: `${effectiveWorkerLocation.latitude.toFixed(6)}, ${effectiveWorkerLocation.longitude.toFixed(6)}`,
        userLocation: `${effectiveUserLocation.latitude.toFixed(6)}, ${effectiveUserLocation.longitude.toFixed(6)}`,
      });

      const routeResponse = await fetchRoute(effectiveWorkerLocation, effectiveUserLocation);
      console.log('🗺️ [NAVIGATION START] Route response:', {
        hasRoute: !!routeResponse,
        hasGeometry: !!routeResponse?.geometry,
        distance: routeResponse?.distance,
        routeType: routeResponse?.distance && routeResponse.distance < 50 ? 'simpleRoute (nearby)' : 'mapboxRoute',
      });
      
      // Check if route was successfully created (either Mapbox route or simple route for nearby)
      if (routeResponse && routeResponse.geometry && routeResponse.distance !== undefined) {
        // Use route-based distance, not straight-line
        const totalDistance = routeResponse.distance / 1000; // Convert to km
        
        setTotalRouteDistance(totalDistance);
        setDistanceRemaining(totalDistance); // Use route distance
        setDistance(totalDistance);
        setDistanceTraveled(0);
        previousLocationRef.current = effectiveWorkerLocation;

        // Start periodic route recalculation (use ref for latest worker loc inside interval)
        routeRecalculationInterval.current = setInterval(() => {
          const currentWorker = workerLocation ?? liveLocationRef.current;
          const currentUser = userLocation ?? (booking?.location?.coordinates
            ? { latitude: booking.location.coordinates.latitude, longitude: booking.location.coordinates.longitude }
            : null);
          if (currentWorker && currentUser) {
            recalculateRoute(currentWorker, currentUser);
          }
        }, 30000);

        // Emit enhanced navigation started event to user with route data
        socketService.emit('navigation:started', { 
          bookingId, 
          workerId: worker?.id,
          route: routeResponse.geometry,
          distance: routeResponse.distance,
          duration: routeResponse.duration,
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
            console.log(' Booking status updated to accepted');
          }
        } catch (error) {
          console.error('Error updating booking status:', error);
        }

        showToast(
          'Navigation started! Your live location is being shared with the customer.',
          'Navigation Started',
          'success'
        );
      } else {
        // Check if it's a nearby case (route was created but might have different structure)
        const straightLineDistance = calculateDistanceMeters(effectiveWorkerLocation, effectiveUserLocation);
        if (straightLineDistance < 50) {
          // Very close - navigation should still work with simple route
          console.log('📍 [NEARBY] Users are very close, continuing navigation with simple route');
          // Navigation can continue even without Mapbox route for very close locations
          // The route was already created in fetchRoute for nearby case
          // Just ensure we have the route data
          if (!routeData) {
            // Create simple route if not already created
            const simpleRoute = {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [effectiveWorkerLocation.longitude, effectiveWorkerLocation.latitude],
                  [effectiveUserLocation.longitude, effectiveUserLocation.latitude]
                ]
              },
              distance: straightLineDistance,
              duration: Math.max(1, Math.ceil(straightLineDistance / 1.4)),
              steps: []
            };
            setRouteData(simpleRoute);
            setTotalRouteDistance(straightLineDistance / 1000);
            setDistanceRemaining(straightLineDistance / 1000);
            setDistance(straightLineDistance / 1000);
            setDistanceTraveled(0);
            setEta(Math.max(1, Math.ceil(straightLineDistance / 1.4 / 60)));
            previousLocationRef.current = effectiveWorkerLocation;

            // Emit navigation started even for nearby case
            socketService.emit('navigation:started', { 
              bookingId, 
              workerId: worker?.id,
              route: simpleRoute.geometry,
              distance: straightLineDistance,
              duration: simpleRoute.duration,
              timestamp: new Date().toISOString(),
            });
            
            showToast(
              'Navigation started! You are very close to the customer.',
              'Navigation Started',
              'success'
            );
          }
        } else {
          // Show more specific error message for actual route failures
          // CRITICAL: Don't reset navStatus to 'idle' - keep navigation started and allow retry
          const errorMsg = routeError || 'Could not calculate route. Please check your internet connection and Mapbox configuration.';
          console.error('❌ [NAVIGATION START] Route fetch failed:', errorMsg);
          Alert.alert(
            'Route Error', 
            errorMsg + '\n\nNavigation is still active. You can retry fetching the route.',
            [
              { text: 'OK', style: 'default' },
              { 
                text: 'Retry Route', 
                onPress: async () => {
                  // Retry route fetch without resetting navigation
                  try {
                    const retryRoute = await fetchRoute(effectiveWorkerLocation, effectiveUserLocation);
                    if (retryRoute && retryRoute.geometry && retryRoute.distance !== undefined) {
                      const totalDistance = retryRoute.distance / 1000;
                      setTotalRouteDistance(totalDistance);
                      setDistanceRemaining(totalDistance);
                      setDistance(totalDistance);
                      setDistanceTraveled(0);
                      setRouteData(retryRoute);
                      previousLocationRef.current = effectiveWorkerLocation;
                      showToast('Route recalculated successfully!', 'Route Updated', 'success');
                    }
                  } catch (retryError) {
                    console.error('Route retry failed:', retryError);
                  }
                },
                style: 'default'
              }
            ]
          );
          // Keep navigation status as 'navigating' - don't reset to 'idle'
          // Navigation can continue even without route (worker can still move and we'll track distance)
        }
      }
    } catch (error) {
      console.error('Error starting navigation:', error);
      // Only reset if it's a critical error (e.g. no locations), otherwise keep navigation started
      const hadLocations = (workerLocation ?? liveLocationRef.current) && (userLocation ?? (booking?.location?.coordinates ? { latitude: booking.location.coordinates.latitude, longitude: booking.location.coordinates.longitude } : null));
      if (!hadLocations) {
        // Critical: no locations available
        Alert.alert('Navigation Error', 'Failed to start navigation. Location data is missing.');
        setNavStatus('idle');
        navigationStartTimeRef.current = null;
        setNavigationStartTime(null);
        setNavigationDuration(0);
      } else {
        // Non-critical error (e.g. network issue) - navigation is already started, just show error
        Alert.alert(
          'Navigation Started',
          'Navigation has started, but there was an issue fetching the route. You can continue and retry the route later.',
          [{ text: 'OK' }]
        );
        // Keep navStatus as 'navigating' - navigation is active
      }
    }
  };

  const handleArrived = async () => {
    const finalNavDuration = navigationDuration; // Capture before reset
    setNavStatus('arrived');
    // Stop navigation timer
    navigationStartTimeRef.current = null;
    setNavigationStartTime(null);
    console.log('⏰ Navigation timer stopped. Total duration:', formatDuration(finalNavDuration));
    
    // Emit navigation arrived event to user
    socketService.emit('navigation:arrived', { 
      bookingId, 
      workerId: worker?.id,
      timestamp: new Date().toISOString(),
      navigationDuration: finalNavDuration,
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
        console.log(' Booking updated after arrival');
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
    const finalNavDuration = navigationDuration; // Capture before reset
    setNavStatus('idle');
    // Stop navigation timer
    navigationStartTimeRef.current = null;
    setNavigationStartTime(null);
    console.log('⏰ Navigation timer stopped. Total duration:', formatDuration(finalNavDuration));
    
    // Emit navigation ended event to user
    socketService.emit('navigation:ended', { 
      bookingId, 
      workerId: worker?.id,
      timestamp: new Date().toISOString(),
      navigationDuration: finalNavDuration,
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
        console.log(' Booking updated after navigation ended');
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
    console.log(' Work started event emitted to user');

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
        console.log(' Booking status updated to in_progress');
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
          text: ' Cash',
          onPress: () => handleCashPayment(),
        },
        {
          text: ' Online',
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
        ' Job Completed!',
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
    if (workerLocation && userLocation) {
      updateCameraBounds();
      
      // ARCHITECTURE: Route fetched ONLY when navigation starts (removed auto-fetch)
    }
  }, [workerLocation, userLocation, routeData, navStatus]);

  // Calculate region for map - Updates in real-time when locations change
  // MUST be before conditional return to avoid hooks error
  // ARCHITECTURE: Memoize polyline geometry - NEVER recreate on location updates
  // Dependency on routeData.geometry ensures it only updates when route changes, not on GPS updates
  const memoizedRouteCoordinates = useMemo(() => {
    if (routeData?.geometry?.coordinates && routeData.geometry.coordinates.length > 0) {
      return routeData.geometry.coordinates.map((coord: [number, number]) => ({
        latitude: coord[1],
        longitude: coord[0],
      }));
    }
    return [];
  }, [routeData?.geometry]); // Only recreate when route geometry object changes (not on location updates)

  useEffect(() => {
    if (workerLocation && userLocation) {
      // Calculate distance to determine appropriate zoom level
      const dist = calculateDistanceMeters(workerLocation, userLocation);
      
      // For very close locations (< 50m), use a fixed reasonable zoom level
      // Otherwise, calculate based on actual distance
      let latDelta: number;
      let lonDelta: number;
      
      if (dist < 50) {
        // Very close - use a fixed zoom level (about 500m view)
        latDelta = 0.005;
        lonDelta = 0.005;
      } else {
        // Normal distance - calculate based on actual locations
        latDelta = Math.max(
          Math.abs(workerLocation.latitude - userLocation.latitude) * 2.5 + 0.01,
          0.01
        );
        lonDelta = Math.max(
          Math.abs(workerLocation.longitude - userLocation.longitude) * 2.5 + 0.01,
          0.01
        );
      }
      
      const newRegion = {
        latitude: (workerLocation.latitude + userLocation.latitude) / 2,
        longitude: (workerLocation.longitude + userLocation.longitude) / 2,
        latitudeDelta: latDelta,
        longitudeDelta: lonDelta,
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

  // ARCHITECTURE: Camera updates ONLY every 2-3 seconds (Uber style)
  useEffect(() => {
    if (navStatus === 'navigating' && workerLocation && mapRef.current) {
      const now = Date.now();
      const lastCameraUpdate = (mapRef.current as any)._lastCameraUpdate || 0;
      
      // ARCHITECTURE RULE: Camera updates every 2-3 seconds
      if (now - lastCameraUpdate < 2500) { // 2.5 seconds
        return;
      }
      
      try {
        (mapRef.current as any)._lastCameraUpdate = now;
        
        if (mapsAvailable && mapRef.current.animateToCoordinate) {
          // ARCHITECTURE: Use flyTo/easeTo with duration ≥ 1000ms
          mapRef.current.animateToCoordinate(
            {
              latitude: workerLocation.latitude,
              longitude: workerLocation.longitude,
            },
            1200 // Smooth 1.2s animation
          );
        }
      } catch (error) {
        console.log('Camera follow error:', error);
      }
    }
  }, [workerLocation, navStatus]);

  // Fit map to show both markers (only when not navigating)
  useEffect(() => {
    if (mapRef.current && workerLocation && userLocation && Platform.OS !== 'web' && navStatus !== 'navigating') {
      try {
        if (mapsAvailable && mapRef.current.fitToCoordinates) {
          // Check distance - if very close, use fixed zoom instead
          const dist = calculateDistanceMeters(workerLocation, userLocation);
          
          if (dist >= 50) {
            // Normal distance - use fitToCoordinates
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
          } else {
            // Very close - use fixed zoom level to avoid zoom issues
            const centerLat = (workerLocation.latitude + userLocation.latitude) / 2;
            const centerLon = (workerLocation.longitude + userLocation.longitude) / 2;
            mapRef.current.animateToRegion({
              latitude: centerLat,
              longitude: centerLon,
              latitudeDelta: 0.005, // ~500m view
              longitudeDelta: 0.005,
            }, 500);
          }
        }
      } catch (error) {
        console.log('Map fit error:', error);
      }
    }
  }, [workerLocation, userLocation, navStatus]);

  // No need for Mapbox features - using react-native-maps markers directly

  // Format distance for display (show meters if < 1km, otherwise km)
  const formatDistance = (distKm: number): string => {
    if (distKm < 0.001) {
      // Less than 1 meter
      return `${Math.round(distKm * 1000)} m`;
    } else if (distKm < 1) {
      // Less than 1 km, show in meters
      return `${Math.round(distKm * 1000)} m`;
    } else {
      // 1 km or more, show in km
      return `${distKm.toFixed(2)} km`;
    }
  };
  
  // Format distance remaining for display
  const formatDistanceRemaining = (distKm: number): string => {
    if (distKm <= 0) {
      return '0 m';
    } else if (distKm < 0.001) {
      return `${Math.round(distKm * 1000)} m`;
    } else if (distKm < 1) {
      return `${Math.round(distKm * 1000)} m`;
    } else {
      return `${distKm.toFixed(2)} km`;
    }
  };

  // Never return early - keep same component structure to avoid "Rendered fewer hooks than expected"
  // Use fallbacks so map always has valid coordinates when loading
  const isLoading = !booking || !workerLocation || !userLocation;
  const safeWorkerLocation = workerLocation || { latitude: 27.7172, longitude: 85.3240 };
  const safeUserLocation = userLocation || { latitude: 27.7172, longitude: 85.3240 };

  return (
    <View style={styles.container} collapsable={false}>
      {/* Loading overlay when data not ready - does not change hook order */}
      {isLoading && (
        <View style={[styles.loadingContainer, StyleSheet.absoluteFill, { zIndex: 10, backgroundColor: '#F8F9FA' }]}>
          <Text style={styles.loadingText}>Loading navigation...</Text>
        </View>
      )}
      <SafeAreaView style={styles.safe} collapsable={false}>
        {/* Map - Using react-native-maps only, Mapbox Directions API for routes */}
        {mapsAvailable && RNMapView ? (
          <>
            <RNMapView
              key="map-component-stable-never-unmount"
              ref={mapRef}
              style={styles.map}
              removeClippedSubviews={false}
              collapsable={false}
              onMapReady={() => {
                console.log('✅ Map ready in job-navigation');
                setMapReady(true);
                
                // CRITICAL FIX: Longer delay for lower-end Android devices (Samsung A70, Realme 14C)
                if (Platform.OS === 'android') {
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
                  setCanRenderChildren(true);
                }
              }}
              onRegionChangeComplete={(region: any) => {
                // Prevent unnecessary updates
                if (navStatus !== 'navigating') {
                  setMapRegionState(region);
                }
              }}
              showsUserLocation={false}
              showsMyLocationButton={false}
              provider={Platform.OS === 'android' ? 'google' : undefined}
              mapType="standard"
              followsUserLocation={false}
              initialRegion={mapRegion || {
                latitude: safeWorkerLocation?.latitude || 27.7172,
                longitude: safeWorkerLocation?.longitude || 85.3240,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {/* UNIVERSAL FIX: Use native markers (pinColor) for maximum compatibility across all devices/OS */}
              {/* Render markers only when map is ready - works on ALL devices (Android/iOS, any model) */}
              {mapReady && canRenderChildren && (
                <>
                  {/* Worker marker - Use native pinColor for universal compatibility */}
                  {safeWorkerLocation && safeWorkerLocation.latitude !== 0 && safeWorkerLocation.longitude !== 0 && (
                    <RNMarker
                      key="worker-marker-universal"
                      identifier="worker-marker"
                      coordinate={{
                        latitude: safeWorkerLocation.latitude,
                        longitude: safeWorkerLocation.longitude,
                      }}
                      title="Your Location"
                      description={navStatus === 'navigating' ? 'Navigating...' : 'Worker Location'}
                      pinColor={navStatus === 'navigating' ? '#2563EB' : '#10B981'}
                      anchor={{ x: 0.5, y: 1 }}
                      flat={false}
                      tracksViewChanges={false}
                    />
                  )}

                  {/* Customer marker - Use native pinColor for universal compatibility */}
                  {safeUserLocation && safeUserLocation.latitude !== 0 && safeUserLocation.longitude !== 0 && (
                    <RNMarker
                      key="customer-marker-universal"
                      identifier="customer-marker"
                      coordinate={{
                        latitude: safeUserLocation.latitude,
                        longitude: safeUserLocation.longitude,
                      }}
                      title="Customer Location"
                      description={booking.location?.address || 'Destination'}
                      pinColor="#DC2626"
                      anchor={{ x: 0.5, y: 1 }}
                      tracksViewChanges={false}
                    />
                  )}

                  {/* Route Line - Mapbox route visualization on road - ALWAYS render when route exists */}
                  {memoizedRouteCoordinates.length > 0 && (
                    <RNPolyline
                      key={`route-polyline-${memoizedRouteCoordinates.length}`}
                      identifier="route-polyline"
                      coordinates={memoizedRouteCoordinates}
                      strokeColor={navStatus === 'navigating' ? '#2563EB' : '#9CA3AF'}
                      strokeWidth={Platform.OS === 'ios' ? 6 : (navStatus === 'navigating' ? 8 : 6)}
                      lineCap="round"
                      lineJoin="round"
                      geodesic={false}
                      tappable={false}
                      zIndex={1}
                    />
                  )}
                </>
              )}
            </RNMapView>
            
            {/* Show loading indicator - Moved outside RNMapView to prevent UIFrameGuarded error */}
            {workerLocation && userLocation && !routeData && navStatus === 'navigating' && (
              <View style={styles.routeLoadingIndicator}>
                <Text style={styles.routeLoadingText}>Calculating route...</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map-outline" size={64} color="#ccc" />
            <Text style={styles.mapPlaceholderTitle}>
              {Platform.OS === 'web' ? 'Maps Not Available on Web' : 'Maps Not Available'}
            </Text>
            <Text style={styles.mapPlaceholderText}>
              {Platform.OS === 'web' ? (
                'Maps require native modules and are not available in the web version. Please use the mobile app for navigation features.'
              ) : (
                `To enable maps, you need to build the native app:${'\n\n'}` +
                `For Android:${'\n'}` +
                `bunx expo run:android${'\n\n'}` +
                `For iOS:${'\n'}` +
                `bunx expo run:ios${'\n\n'}` +
                `Maps require native build and cannot run in Expo Go.`
              )}
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

          {(navStatus === 'arrived' || navStatus === 'navigating') ? (
            <ScrollView 
              style={styles.scrollableContent}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.scrollContentContainer}
            >
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Ionicons name="locate" size={20} color="#FF7A2C" />
                  <Text style={styles.infoText}>
                    {navStatus === 'navigating' && distanceRemaining > 0 
                      ? formatDistanceRemaining(distanceRemaining)
                      : formatDistance(distance)}
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
                    <Text style={styles.infoText}>{formatDistance(distanceTraveled)}</Text>
                    <Text style={styles.infoSubtext}>Traveled</Text>
                  </View>
                )}
                {navStatus === 'arrived' && (
                  <View style={styles.infoItem}>
                    <Ionicons name="briefcase" size={20} color="#FF7A2C" />
                    <Text style={styles.infoText}>{booking?.serviceName}</Text>
                  </View>
                )}
              </View>

              {/* Customer Info */}
              <View style={styles.customerInfo}>
                <Text style={styles.customerLabel}>Customer:</Text>
                <Text style={styles.customerName}>{booking?.userName ?? 'Customer'}</Text>
                <Text style={styles.customerAddress}>{booking?.location?.address}</Text>
              </View>

              {/* Arrived Badge - only show when arrived */}
              {navStatus === 'arrived' && (
                <View style={styles.arrivedBadge}>
                  <Ionicons name="location" size={20} color="#4CAF50" />
                  <Text style={styles.arrivedText}>You've arrived at the destination!</Text>
                </View>
              )}

              {/* When navigating: include guidance and actions inside ScrollView so whole card scrolls */}
              {navStatus === 'navigating' && (
                <>
                  {navigationInstructions && (
                    <View style={styles.navigationGuidance}>
                      <View style={styles.guidanceHeader}>
                        <Ionicons name="navigate" size={24} color="#2563EB" />
                        <Text style={styles.guidanceTitle}>Navigation Active</Text>
                      </View>
                      <View style={styles.instructionCard}>
                        <Text style={styles.instructionText}>{navigationInstructions}</Text>
                        {distanceToNextTurn > 0 && (
                          <Text style={styles.distanceToTurn}>
                            {formatDistanceRemaining(distanceToNextTurn)} to next turn
                          </Text>
                        )}
                      </View>
                      {nextStep && (
                        <View style={styles.nextStepPreview}>
                          <Text style={styles.nextStepLabel}>Then:</Text>
                          <Text style={styles.nextStepText}>
                            {nextStep.banner_instructions?.[0]?.primary?.text ||
                              nextStep.maneuver?.instruction ||
                              'Continue on route'}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={styles.navigatingBadge}>
                    <View style={styles.pulseDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.navigatingText}>Moving to destination...</Text>
                      {navigationStartTime && (
                        <Text style={styles.navigationTimerText}>
                          Navigation time: {formatDuration(navigationDuration)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity style={styles.arrivedButton} onPress={handleArrived}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.arrivedButtonText}>Mark as Arrived</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* When arrived: include action buttons inside ScrollView */}
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
            </ScrollView>
          ) : (
            <>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Ionicons name="locate" size={20} color="#FF7A2C" />
                  <Text style={styles.infoText}>{formatDistance(distance)}</Text>
                  <Text style={styles.infoSubtext}>Distance</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="time" size={20} color="#FF7A2C" />
                  <Text style={styles.infoText}>{eta} min</Text>
                  <Text style={styles.infoSubtext}>ETA</Text>
                </View>
              </View>

              {/* Customer Info */}
              <View style={styles.customerInfo}>
                <Text style={styles.customerLabel}>Customer:</Text>
                <Text style={styles.customerName}>{booking?.userName ?? 'Customer'}</Text>
                <Text style={styles.customerAddress}>{booking?.location?.address}</Text>
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

// Removed pointFeatureCollection - no longer needed (using react-native-maps markers directly)

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
  workerMarkerNavigating: {
    backgroundColor: '#2563EB',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#60A5FA',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
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
    flex: 1, // Use flex instead of maxHeight to allow full scrolling
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
  navigationTimerText: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 4,
    opacity: 0.8,
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
  navigationGuidance: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  guidanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  guidanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  instructionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  distanceToTurn: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  nextStepPreview: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextStepLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
    fontWeight: '500',
  },
  nextStepText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  routeLoadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -20 }],
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 8,
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

