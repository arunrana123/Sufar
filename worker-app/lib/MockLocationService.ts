import { Alert } from 'react-native';
import { SocketService } from './SocketService';
import { getApiUrl } from './config';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

class MockLocationService {
  private static instance: MockLocationService;
  private isTracking = false;
  private socketService: SocketService;
  private currentLocation: LocationData | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private workerId: string | null = null;

  private constructor() {
    this.socketService = SocketService.getInstance();
  }

  static getInstance(): MockLocationService {
    if (!MockLocationService.instance) {
      MockLocationService.instance = new MockLocationService();
    }
    return MockLocationService.instance;
  }

  /**
   * Mock location permissions - always returns true for testing
   */
  async requestPermissions(): Promise<boolean> {
    console.log('Mock location permissions granted');
    return true;
  }

  /**
   * Start mock location tracking
   */
  async startTracking(): Promise<boolean> {
    if (this.isTracking) {
      return true;
    }

    try {
      // Set a mock location (Kathmandu, Nepal)
      this.currentLocation = {
        latitude: 27.7172,
        longitude: 85.3240,
        accuracy: 10,
        timestamp: Date.now(),
      };

      // Send initial location
      this.socketService.updateLocation(this.currentLocation);

      // Also update backend initially (with await)
      if (this.workerId) {
        await this.updateBackendLocation();
      } else {
        console.warn('⚠️ Worker ID not set, skipping initial backend update');
      }

      // Simulate location updates every 30 seconds
      this.updateInterval = setInterval(() => {
        if (this.currentLocation && this.workerId) {
          // Add small random variations to simulate movement
          this.currentLocation = {
            latitude: this.currentLocation.latitude + (Math.random() - 0.5) * 0.001,
            longitude: this.currentLocation.longitude + (Math.random() - 0.5) * 0.001,
            accuracy: 10,
            timestamp: Date.now(),
          };

          // Send location update via socket
          this.socketService.updateLocation(this.currentLocation);

          // Also update backend (fire and forget)
          void this.updateBackendLocation();
        } else {
          if (!this.workerId) {
            console.warn('⚠️ Mock location update skipped: Worker ID not set');
          }
          if (!this.currentLocation) {
            console.warn('⚠️ Mock location update skipped: No current location');
          }
        }
      }, 30000);

      this.isTracking = true;
      console.log('Mock location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting mock location tracking:', error);
      return false;
    }
  }

  /**
   * Stop location tracking
   */
  stopTracking(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.isTracking = false;
    console.log('Mock location tracking stopped');
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
          availableAfter: status === 'busy' ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() : null,
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
   * Update worker location in backend (mock implementation)
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

      console.log('📍 Updating backend location (mock):', {
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
          console.log('✅ Mock location updated in backend successfully:', data);
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
   * Check if tracking is active
   */
  isLocationTracking(): boolean {
    return this.isTracking;
  }
}

export default MockLocationService;
