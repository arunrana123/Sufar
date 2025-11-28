import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { SocketService } from './SocketService';
import { getApiUrl } from './config';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

class LocationService {
  private static instance: LocationService;
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;
  private socketService: SocketService;
  private currentLocation: LocationData | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private workerId: string | null = null;

  private constructor() {
    this.socketService = SocketService.getInstance();
  }

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // Check if location services are available
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings to use this feature.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Check current permission status first
      const { status: currentStatus } = await Location.getForegroundPermissionsAsync();

      if (currentStatus === 'granted') {
        return true; // Already granted
      }

      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to show your availability on the map. You can still use the app without location tracking.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Location.openSettingsAsync() }
          ]
        );
        return false;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission not granted. Location updates may be limited.');
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      // Show user-friendly error message
      Alert.alert(
        'Location Permission Error',
        'There was an issue requesting location permissions. Please try again or check your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }

  /**
   * Start location tracking
   */
  async startTracking(): Promise<boolean> {
    if (this.isTracking) {
      return true;
    }

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('Location permission not granted, location tracking disabled');
        return false;
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      this.currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: Date.now(),
      };

      // Send initial location
      this.socketService.updateLocation(this.currentLocation);

      // Also update backend initially
      await this.updateBackendLocation();

      // Start continuous tracking
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 50, // Update every 50 meters
        },
        (location) => {
          this.currentLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            timestamp: Date.now(),
          };

          // Send location update via socket
          this.socketService.updateLocation(this.currentLocation);
        }
      );

      // Also update backend periodically
      this.updateInterval = setInterval(() => {
        if (this.currentLocation && this.workerId) {
          // Use void to explicitly ignore promise (fire and forget)
          void this.updateBackendLocation();
        } else {
          if (!this.workerId) {
            console.warn('⚠️ Location update skipped: Worker ID not set');
          }
          if (!this.currentLocation) {
            console.warn('⚠️ Location update skipped: No current location');
          }
        }
      }, 30000); // Update backend every 30 seconds

      this.isTracking = true;
      console.log('Location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      // Don't throw error, just log and return false to prevent app crash
      return false;
    }
  }

  /**
   * Stop location tracking
   */
  stopTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.isTracking = false;
    console.log('Location tracking stopped');
  }

  /**
   * Update worker location in backend
   */
  private async updateBackendLocation(): Promise<void> {
    if (!this.currentLocation) {
      console.warn('⚠️ Cannot update backend: No current location');
      return;
    }
    
    if (!this.workerId) {
      console.warn('⚠️ Cannot update backend: Worker ID not set');
      return;
    }

    try {
      const apiUrl = getApiUrl();

      console.log('📍 Updating backend location:', {
        workerId: this.workerId,
        location: {
          latitude: this.currentLocation.latitude,
          longitude: this.currentLocation.longitude,
        },
      });

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(`${apiUrl}/api/workers/update-location`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workerId: this.workerId,
            location: {
              latitude: this.currentLocation.latitude,
              longitude: this.currentLocation.longitude,
              accuracy: this.currentLocation.accuracy,
            },
            timestamp: this.currentLocation.timestamp,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to update location in backend: ${response.status}`, errorText);
          
          // Try to parse error if it's JSON
          try {
            const errorData = JSON.parse(errorText);
            console.error('Error details:', errorData);
          } catch (e) {
            // Not JSON, just log the text
          }
        } else {
          const data = await response.json();
          console.log('✅ Location updated in backend successfully:', data);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Check if it's an abort (timeout)
        if (fetchError.name === 'AbortError') {
          console.warn('⚠️ Location update timeout - backend may be slow or unreachable');
          return;
        }
        
        // Network error handling
        if (fetchError.message === 'Network request failed' || fetchError.name === 'TypeError') {
          console.warn('⚠️ Network error - backend may be unreachable. Check:', {
            apiUrl,
            message: 'Ensure backend is running and device is on same network',
          });
          // Silently fail - network issues shouldn't crash the app
          return;
        }
        
        throw fetchError; // Re-throw other errors
      }
    } catch (error: any) {
      // Only log non-network errors
      if (error?.message !== 'Network request failed') {
        console.error('❌ Error updating backend location:', error);
        console.error('Error details:', {
          message: error?.message,
          name: error?.name,
          workerId: this.workerId,
          hasLocation: !!this.currentLocation,
        });
      }
      // Don't throw error to prevent app crash
    }
  }

  /**
   * Update worker availability status
   */
  async updateAvailabilityStatus(status: 'available' | 'busy', workerId?: string): Promise<boolean> {
    if (!workerId) {
      console.error('Worker ID is required to update availability status');
      return false;
    }

    try {
      const apiUrl = getApiUrl();
      
      const response = await fetch(`${apiUrl}/api/workers/update-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId,
          status,
          availableAfter: status === 'busy' ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() : null, // 2 hours from now if busy
        }),
      });

      if (response.ok) {
        // Emit status change via socket
        this.socketService.emit('worker:status_change', { status });
        return true;
      } else {
        console.error('Failed to update availability status');
        return false;
      }
    } catch (error) {
      console.error('Error updating availability status:', error);
      return false;
    }
  }

  /**
   * Get current location
   */
  getCurrentLocation(): LocationData | null {
    return this.currentLocation;
  }

  /**
   * Set worker ID for location updates
   */
  setWorkerId(workerId: string): void {
    this.workerId = workerId;
  }

  /**
   * Check if tracking is active
   */
  isLocationTracking(): boolean {
    return this.isTracking;
  }
}

export default LocationService;
