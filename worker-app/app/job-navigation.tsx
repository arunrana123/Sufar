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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { SocketService } from '@/lib/SocketService';
import { getApiUrl } from '@/lib/config';
import ToastNotification from '@/components/ToastNotification';

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
  const mapRef = useRef<any>(null);
  const locationSubscription = useRef<any>(null);
  
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

    return () => {
      stopLocationTracking();
      socketService.off('user:location');
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

          // Send location to user via socket
          if (navStatus === 'navigating') {
            socketService.emit('worker:location', {
              bookingId,
              latitude: newLoc.latitude,
              longitude: newLoc.longitude,
              timestamp: new Date().toISOString(),
            });
          }

          // Calculate distance and ETA
          if (userLocation) {
            const dist = calculateDistance(newLoc, userLocation);
            setDistance(dist);
            setEta(Math.ceil(dist * 2)); // Rough estimate: 2 min per km
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

  const handleStartNavigation = () => {
    setNavStatus('navigating');
    socketService.emit('navigation:started', { bookingId, workerId: worker?.id });
    Alert.alert('Navigation Started', 'Your live location is now being shared with the customer');
  };

  const handleArrived = async () => {
    setNavStatus('arrived');
    socketService.emit('navigation:arrived', { bookingId, workerId: worker?.id });
    
    // Update booking status
    try {
      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'arrived' }),
      });
    } catch (error) {
      console.error('Error updating booking status:', error);
    }

    Alert.alert('Arrived!', 'You have marked yourself as arrived at the destination');
  };

  const handleEndNavigation = () => {
    setNavStatus('idle');
    socketService.emit('navigation:ended', { bookingId, workerId: worker?.id });
    Alert.alert('Navigation Ended', 'You can now start the work');
  };

  const handleStartWork = async () => {
    const startTime = new Date();
    setWorkStartTime(startTime);
    setNavStatus('working');
    
    socketService.emit('work:started', {
      bookingId,
      workerId: worker?.id,
      startTime: startTime.toISOString(),
    });

    // Update booking status
    try {
      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'working', workStartTime: startTime }),
      });
    } catch (error) {
      console.error('Error updating booking status:', error);
    }

    showToast(
      'Timer is now running. Complete the work and mark as done.',
      'Work Started',
      'success'
    );
  };

  const handleCompleteWork = () => {
    Alert.alert(
      'Complete Work',
      'Are you sure you want to mark this job as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setNavStatus('completed');
            
            socketService.emit('work:completed', {
              bookingId,
              workerId: worker?.id,
              endTime: new Date().toISOString(),
              duration: workDuration,
            });

            // Update booking status
            try {
              const apiUrl = getApiUrl();
              await fetch(`${apiUrl}/api/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' }),
              });
              
              // Show toast notification
              showToast(
                'Great work! The customer will be notified.',
                'Job Completed!',
                'success'
              );
              
              // Navigate back after a short delay
              setTimeout(() => {
                router.push('/(tabs)');
              }, 1500);
            } catch (error) {
              console.error('Error updating booking status:', error);
              showToast(
                'Failed to update booking status. Please try again.',
                'Error',
                'error'
              );
            }
          },
        },
      ]
    );
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

  const fitMapToMarkers = () => {
    if (mapRef.current && workerLocation && userLocation) {
      mapRef.current.fitToCoordinates([workerLocation, userLocation], {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
  };

  useEffect(() => {
    if (workerLocation && userLocation) {
      fitMapToMarkers();
    }
  }, [workerLocation, userLocation]);

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
        {/* Map */}
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: workerLocation.latitude,
            longitude: workerLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Worker Marker (You) */}
          <Marker
            coordinate={workerLocation}
            title="You"
            description="Your current location"
          >
            <View style={styles.workerMarker}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
          </Marker>

          {/* User Marker (Customer) */}
          <Marker
            coordinate={userLocation}
            title="Customer"
            description={booking.location?.address || 'Customer location'}
          >
            <View style={styles.userMarker}>
              <Ionicons name="home" size={24} color="#fff" />
            </View>
          </Marker>
        </MapView>

        {/* Status Card */}
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

          {/* Work Duration (when working) */}
          {navStatus === 'working' && (
            <View style={styles.workTimer}>
              <Ionicons name="stopwatch" size={24} color="#4CAF50" />
              <Text style={styles.workDuration}>{formatDuration(workDuration)}</Text>
            </View>
          )}

          {/* Action Buttons */}
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
                <View style={styles.arrivedBadge}>
                  <Ionicons name="location" size={20} color="#4CAF50" />
                  <Text style={styles.arrivedText}>You've arrived at the destination!</Text>
                </View>
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
  workerMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF7A2C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 12,
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
  customerInfo: {
    marginBottom: 20,
    padding: 16,
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
    gap: 12,
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
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
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

