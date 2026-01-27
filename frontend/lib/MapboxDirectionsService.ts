// MAPBOX DIRECTIONS SERVICE - Helper service for using Mapbox Directions API
// Features: Route calculation, distance, duration, coordinate conversion

import { getDirections } from './MapboxConfig';

export interface MapboxRouteResult {
  coordinates: Array<{ latitude: number; longitude: number }>;
  distance: number; // in meters
  duration: number; // in seconds
  distanceText: string;
  durationText: string;
  geometry?: any;
}

/**
 * Convert GeoJSON coordinates to {latitude, longitude} format
 */
const convertGeoJSONToCoordinates = (geometry: any): Array<{ latitude: number; longitude: number }> => {
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

    return [];
  } catch (error) {
    console.error('Error converting GeoJSON coordinates:', error);
    return [];
  }
};

/**
 * Format distance in meters to readable text
 */
const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

/**
 * Format duration in seconds to readable text
 */
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMinutes} min`;
};

/**
 * Fetch directions from Mapbox Directions API
 */
export const getMapboxDirections = async (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  profile: 'driving' | 'driving-traffic' | 'walking' | 'cycling' = 'driving-traffic'
): Promise<MapboxRouteResult | null> => {
  try {
    console.log('🗺️ Fetching Mapbox Directions:', {
      origin: `${origin.latitude}, ${origin.longitude}`,
      destination: `${destination.latitude}, ${destination.longitude}`,
      profile,
    });

    // Mapbox expects [longitude, latitude] format
    const directions = await getDirections(
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
      profile
    );

    if (!directions || !directions.geometry) {
      console.warn('⚠️ No route geometry returned from Mapbox');
      return null;
    }

    // Convert GeoJSON coordinates to {latitude, longitude} format
    const coordinates = convertGeoJSONToCoordinates(directions.geometry);

    if (coordinates.length === 0) {
      console.warn('⚠️ No coordinates in route geometry');
      return null;
    }

    const result: MapboxRouteResult = {
      coordinates,
      distance: directions.distance || 0,
      duration: directions.duration || 0,
      distanceText: formatDistance(directions.distance || 0),
      durationText: formatDuration(directions.duration || 0),
      geometry: directions.geometry,
    };

    console.log('✅ Mapbox Directions fetched:', {
      distance: result.distanceText,
      duration: result.durationText,
      points: coordinates.length,
    });

    return result;
  } catch (error: any) {
    console.error('❌ Error fetching Mapbox Directions:', error);
    return null;
  }
};

/**
 * Calculate straight-line distance between two points (Haversine formula)
 * Used as fallback when Directions API is not available
 */
export const calculateStraightDistance = (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (origin.latitude * Math.PI) / 180;
  const φ2 = (destination.latitude * Math.PI) / 180;
  const Δφ = ((destination.latitude - origin.latitude) * Math.PI) / 180;
  const Δλ = ((destination.longitude - origin.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};
