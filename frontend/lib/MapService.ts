// MAP SERVICE - Centralized map operations for smooth, stable map updates
// Features: Throttled updates (3-5 seconds), route calculations, location tracking, smooth animations
import { getDirections } from './MapboxConfig';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface RouteData {
  coordinates: Array<{ latitude: number; longitude: number }>;
  distance: number; // in meters
  duration: number; // in seconds
  geometry?: any;
}

export interface MapUpdateOptions {
  origin: Location;
  destination: Location;
  updateInterval?: number; // milliseconds (default: 3000-5000)
  enableRoute?: boolean;
  onRouteUpdate?: (route: RouteData) => void;
  onLocationUpdate?: (location: Location) => void;
}

class MapService {
  private static instance: MapService;
  private updateInterval: number = 4000; // Default 4 seconds
  private updateTimer: NodeJS.Timeout | null = null;
  private lastUpdateTime: number = 0;
  private isUpdating: boolean = false;
  private currentRoute: RouteData | null = null;
  private lastOrigin: Location | null = null;
  private lastDestination: Location | null = null;
  private routeUpdateCallbacks: Array<(route: RouteData) => void> = [];
  private locationUpdateCallbacks: Array<(location: Location) => void> = [];

  private constructor() {}

  public static getInstance(): MapService {
    if (!MapService.instance) {
      MapService.instance = new MapService();
    }
    return MapService.instance;
  }

  /**
   * Start map updates with throttled route calculations
   * Updates every 3-5 seconds for smooth performance
   */
  public startMapUpdates(options: MapUpdateOptions): void {
    this.stopMapUpdates(); // Stop any existing updates

    const {
      origin,
      destination,
      updateInterval = 4000, // Default 4 seconds
      enableRoute = true,
      onRouteUpdate,
      onLocationUpdate,
    } = options;

    this.updateInterval = Math.max(3000, Math.min(5000, updateInterval)); // Clamp between 3-5 seconds
    this.lastOrigin = origin;
    this.lastDestination = destination;

    // Register callbacks
    if (onRouteUpdate) {
      this.routeUpdateCallbacks.push(onRouteUpdate);
    }
    if (onLocationUpdate) {
      this.locationUpdateCallbacks.push(onLocationUpdate);
    }

    // Initial update
    this.performUpdate(origin, destination, enableRoute);

    // Schedule periodic updates
    this.updateTimer = setInterval(() => {
      if (this.lastOrigin && this.lastDestination) {
        this.performUpdate(this.lastOrigin, this.lastDestination, enableRoute);
      }
    }, this.updateInterval);

    console.log(`✅ Map service started with ${this.updateInterval}ms update interval`);
  }

  /**
   * Update origin location (worker location)
   */
  public updateOrigin(location: Location): void {
    this.lastOrigin = location;
    
    // Notify location update callbacks immediately
    this.locationUpdateCallbacks.forEach(callback => {
      try {
        callback(location);
      } catch (error) {
        console.error('Error in location update callback:', error);
      }
    });

    // Only update route if enough time has passed (throttled)
    const now = Date.now();
    if (now - this.lastUpdateTime >= this.updateInterval && this.lastDestination) {
      this.performUpdate(location, this.lastDestination, true);
    }
  }

  /**
   * Update destination location (user location)
   */
  public updateDestination(location: Location): void {
    this.lastDestination = location;
    
    // Only update route if enough time has passed (throttled)
    const now = Date.now();
    if (now - this.lastUpdateTime >= this.updateInterval && this.lastOrigin) {
      this.performUpdate(this.lastOrigin, location, true);
    }
  }

  /**
   * Perform a single update (throttled internally)
   */
  private async performUpdate(
    origin: Location,
    destination: Location,
    enableRoute: boolean
  ): Promise<void> {
    // Prevent concurrent updates
    if (this.isUpdating) {
      console.log('⏳ Map update already in progress, skipping...');
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;

    // Throttle: Only update if enough time has passed
    if (timeSinceLastUpdate < this.updateInterval) {
      const waitTime = this.updateInterval - timeSinceLastUpdate;
      console.log(`⏳ Throttling map update, waiting ${waitTime}ms...`);
      return;
    }

    this.isUpdating = true;
    this.lastUpdateTime = now;

    try {
      if (enableRoute) {
        await this.calculateRoute(origin, destination);
      }
    } catch (error) {
      console.error('❌ Error in map update:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Calculate route between two points using Mapbox
   */
  private async calculateRoute(origin: Location, destination: Location): Promise<void> {
    try {
      console.log('🔄 Calculating route...', {
        origin: `${origin.latitude}, ${origin.longitude}`,
        destination: `${destination.latitude}, ${destination.longitude}`,
      });

      const directions = await getDirections(
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude],
        'driving-traffic' // Use traffic-aware routing
      );

      if (directions && directions.geometry) {
        // Convert GeoJSON coordinates to {latitude, longitude} format
        const coordinates = this.convertGeoJSONToCoordinates(directions.geometry);

        const routeData: RouteData = {
          coordinates,
          distance: directions.distance || 0,
          duration: directions.duration || 0,
          geometry: directions.geometry,
        };

        this.currentRoute = routeData;

        // Notify all route update callbacks
        this.routeUpdateCallbacks.forEach(callback => {
          try {
            callback(routeData);
          } catch (error) {
            console.error('Error in route update callback:', error);
          }
        });

        console.log('✅ Route calculated:', {
          points: coordinates.length,
          distance: (routeData.distance / 1000).toFixed(2) + ' km',
          duration: Math.ceil(routeData.duration / 60) + ' min',
        });
      }
    } catch (error: any) {
      console.error('❌ Error calculating route:', error);
      
      // Fallback: Create straight-line route
      const fallbackRoute: RouteData = {
        coordinates: [
          { latitude: origin.latitude, longitude: origin.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
        ],
        distance: this.calculateDistance(origin, destination),
        duration: 0,
      };

      this.currentRoute = fallbackRoute;

      // Notify callbacks with fallback route
      this.routeUpdateCallbacks.forEach(callback => {
        try {
          callback(fallbackRoute);
        } catch (error) {
          console.error('Error in route update callback:', error);
        }
      });
    }
  }

  /**
   * Convert GeoJSON geometry to coordinate array
   */
  private convertGeoJSONToCoordinates(geometry: any): Array<{ latitude: number; longitude: number }> {
    try {
      if (!geometry || !geometry.coordinates) {
        return [];
      }

      if (geometry.type === 'LineString') {
        return geometry.coordinates.map((coord: [number, number]) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));
      }

      if (geometry.type === 'Polyline') {
        // Handle encoded polyline if needed
        return [];
      }

      return [];
    } catch (error) {
      console.error('Error converting GeoJSON coordinates:', error);
      return [];
    }
  }

  /**
   * Calculate straight-line distance between two points (Haversine formula)
   */
  private calculateDistance(origin: Location, destination: Location): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (destination.latitude - origin.latitude) * Math.PI / 180;
    const dLon = (destination.longitude - origin.longitude) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(origin.latitude * Math.PI / 180) *
        Math.cos(destination.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get current route data
   */
  public getCurrentRoute(): RouteData | null {
    return this.currentRoute;
  }

  /**
   * Stop map updates
   */
  public stopMapUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this.routeUpdateCallbacks = [];
    this.locationUpdateCallbacks = [];
    this.isUpdating = false;
    console.log('🛑 Map service stopped');
  }

  /**
   * Remove a route update callback
   */
  public removeRouteCallback(callback: (route: RouteData) => void): void {
    this.routeUpdateCallbacks = this.routeUpdateCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Remove a location update callback
   */
  public removeLocationCallback(callback: (location: Location) => void): void {
    this.locationUpdateCallbacks = this.locationUpdateCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Force immediate route recalculation
   */
  public async forceRouteUpdate(origin: Location, destination: Location): Promise<void> {
    this.lastUpdateTime = 0; // Reset throttle
    await this.performUpdate(origin, destination, true);
  }
}

export const mapService = MapService.getInstance();
