// MAPBOX CONFIGURATION - Access token and map settings for worker app
// Features: Map initialization, directions API, location tracking

// Get token from environment (validated when actually used)
const tokenFromEnv = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

// Export token for API calls (doesn't require native modules)
export const MAPBOX_ACCESS_TOKEN = tokenFromEnv;

// Lazy initialize Mapbox - only called when navigation screen loads
// This avoids crashes when native modules aren't built yet
export const initializeMapbox = () => {
  try {
    // Dynamic import to avoid loading native module at app startup
    const Mapbox = require('@rnmapbox/maps').default;
    
    if (!tokenFromEnv) {
      console.warn('⚠️ Missing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN. Add it to worker-app/.env');
      return false;
    }

    if (!tokenFromEnv.startsWith('pk.')) {
      console.warn('⚠️ EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN must start with "pk."');
      return false;
    }

    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
    console.log('✅ Mapbox initialized for worker app');
    return true;
  } catch (error) {
    console.warn('⚠️ Mapbox native modules not available. Run `expo prebuild` and rebuild the app.');
    return false;
  }
};

// Default map settings
export const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';
export const DEFAULT_MAP_ZOOM = 14;
export const DEFAULT_COORDINATES = {
  latitude: 27.7172, // Kathmandu, Nepal
  longitude: 85.3240,
};

// Map configuration for different use cases
export const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
};

// Directions API configuration
export const DIRECTIONS_API_BASE_URL = 'https://api.mapbox.com/directions/v5/mapbox';
export const DIRECTIONS_PROFILE = {
  driving: 'driving',
  walking: 'walking',
  cycling: 'cycling',
  drivingTraffic: 'driving-traffic',
};

// Fetches directions between two points
// Triggered by: Worker navigating to customer location
export const getDirections = async (
  origin: [number, number], // [longitude, latitude]
  destination: [number, number],
  profile: string = DIRECTIONS_PROFILE.driving
): Promise<any> => {
  try {
    const url = `${DIRECTIONS_API_BASE_URL}/${profile}/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}&steps=true&banner_instructions=true&voice_instructions=true`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      return {
        route: data.routes[0],
        distance: data.routes[0].distance, // in meters
        duration: data.routes[0].duration, // in seconds
        geometry: data.routes[0].geometry,
        steps: data.routes[0].legs[0].steps,
      };
    }
    
    throw new Error('No route found');
  } catch (error) {
    console.error('❌ Error fetching directions:', error);
    throw error;
  }
};

// Converts meters to kilometers
export const metersToKilometers = (meters: number): string => {
  return (meters / 1000).toFixed(2);
};

// Converts seconds to minutes
export const secondsToMinutes = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
};

// Formats address from coordinates using Mapbox Geocoding API
export const reverseGeocode = async (
  longitude: number,
  latitude: number
): Promise<string> => {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      return data.features[0].place_name;
    }
    
    return 'Unknown location';
  } catch (error) {
    console.error('❌ Error reverse geocoding:', error);
    return 'Unknown location';
  }
};

// Searches for places using Mapbox Geocoding API
export const searchPlaces = async (
  query: string,
  proximity?: [number, number] // [longitude, latitude]
): Promise<any[]> => {
  try {
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=NP`; // NP for Nepal
    
    if (proximity) {
      url += `&proximity=${proximity[0]},${proximity[1]}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data.features || [];
  } catch (error) {
    console.error('❌ Error searching places:', error);
    return [];
  }
};

