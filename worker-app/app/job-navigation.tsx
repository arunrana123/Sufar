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

  const fetchRoute = async (origin: any, destination: any) => {
    if (!getDirections) {
      console.log('⚠️ Mapbox not available, skipping route fetch');
      setRouteError('Mapbox is not available. Please ensure Mapbox is properly configured.');
      return null;
    }

    try {
      setRouteError(null);
      console.log(' Fetching route from Mapbox...');
      const route = await getDirections(
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude],
        'driving-traffic' // Use driving-traffic for real-time traffic-aware routing
      );
      
      if (!route || !route.geometry) {
        throw new Error('Invalid route data received from Mapbox');
      }
      
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
    try {
      setNavStatus('navigating');

      // Ensure we have location data
      if (!workerLocation || !userLocation) {
        Alert.alert('Error', 'Location data not available. Please wait for GPS to initialize.');
        setNavStatus('idle');
        return;
      }

      // Fetch initial route and get route data
      const routeResponse = await fetchRoute(workerLocation, userLocation);
      
      if (routeResponse && routeResponse.geometry) {
        // Use route-based distance, not straight-line
        const totalDistance = routeResponse.distance / 1000; // Convert to km
        
        setTotalRouteDistance(totalDistance);
        setDistanceRemaining(totalDistance); // Use route distance
        setDistance(totalDistance);
        setDistanceTraveled(0);
        previousLocationRef.current = workerLocation;

        // Start periodic route recalculation
        routeRecalculationInterval.current = setInterval(() => {
          if (workerLocation && userLocation && navStatus === 'navigating') {
            recalculateRoute(workerLocation, userLocation);
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
        // Show more specific error message
        const errorMsg = routeError || 'Could not calculate route. Please check your internet connection and Mapbox configuration.';
        Alert.alert(
          'Route Error', 
          errorMsg,
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Retry', 
              onPress: () => handleStartNavigation(),
              style: 'default'
            }
          ]
        );
        setNavStatus('idle');
      }
    } catch (error) {
      console.error('Error starting navigation:', error);
      Alert.alert('Navigation Error', 'Failed to start navigation. Please check your connection and try again.');
      setNavStatus('idle');
    }
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
  }, [workerLocation, userLocation, navStatus]);

  // No need for Mapbox features - using react-native-maps markers directly

  // Early return check - must be after all hooks
  if (!booking || !workerLocation || !userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading navigation...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Map - Using react-native-maps only, Mapbox Directions API for routes */}
        {mapsAvailable && RNMapView ? (
          <RNMapView
            ref={mapRef}
            style={styles.map}
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
              latitude: workerLocation?.latitude || 27.7172,
              longitude: workerLocation?.longitude || 85.3240,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {/* Worker marker - Always mounted, coordinate updates via props */}
            <RNMarker
              key="worker-marker"
              identifier="worker-marker"
              coordinate={workerLocation ? {
                latitude: workerLocation.latitude,
                longitude: workerLocation.longitude,
              } : { latitude: 0, longitude: 0 }}
              title="Your Location"
              description={navStatus === 'navigating' ? 'Navigating...' : 'Worker Location'}
              anchor={{ x: 0.5, y: 0.5 }}
              flat={navStatus === 'navigating'}
              rotation={0}
            >
              <View style={[
                styles.workerMarkerContainer,
                navStatus === 'navigating' && styles.workerMarkerNavigating
              ]}>
                <Ionicons 
                  name={navStatus === 'navigating' ? 'navigate' : 'person'} 
                  size={navStatus === 'navigating' ? 28 : 24} 
                  color="#fff" 
                />
              </View>
            </RNMarker>

            {/* Customer marker - Always mounted, coordinate updates via props */}
            <RNMarker
              key="customer-marker"
              identifier="customer-marker"
              coordinate={userLocation ? {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              } : { latitude: 0, longitude: 0 }}
              title="Customer Location"
              description={booking.location?.address || 'Destination'}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.customerMarkerContainer}>
                <Ionicons name="home" size={24} color="#fff" />
              </View>
            </RNMarker>

            {/* Route Line - Display route from Mapbox Directions API on react-native-maps Polyline */}
            <RNPolyline
              key="route-polyline"
              identifier="route-polyline"
              coordinates={memoizedRouteCoordinates}
              strokeColor={navStatus === 'navigating' ? '#2563EB' : '#9CA3AF'}
              strokeWidth={memoizedRouteCoordinates.length > 0 ? (navStatus === 'navigating' ? 8 : 6) : 0}
              lineCap="round"
              lineJoin="round"
              geodesic={false}
              tappable={false}
              zIndex={1}
            />
            
            {/* Show loading indicator only when route is being calculated */}
            {workerLocation && userLocation && !routeData && navStatus === 'navigating' && (
              <View style={styles.routeLoadingIndicator}>
                <Text style={styles.routeLoadingText}>Calculating route...</Text>
              </View>
            )}
          </RNMapView>
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
                      ? distanceRemaining.toFixed(2) 
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
                    <Text style={styles.infoText}>{distanceTraveled.toFixed(2)} km</Text>
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
                {/* Navigation Guidance Card - Google Maps style */}
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
                          {distanceToNextTurn < 0.1 
                            ? `${Math.round(distanceToNextTurn * 1000)}m` 
                            : `${distanceToNextTurn.toFixed(2)}km`} to next turn
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

