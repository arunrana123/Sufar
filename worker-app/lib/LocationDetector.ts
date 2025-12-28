// Location Detector - Automatically detects user's location and maps to available cities
import * as Location from 'expo-location';

// Approximate coordinate ranges for major cities in Nepal
const LOCATION_BOUNDS: { [key: string]: { lat: [number, number], lng: [number, number] } } = {
  'Kathmandu': {
    lat: [27.6, 27.8],
    lng: [85.2, 85.4]
  },
  'Kailali': {
    lat: [28.5, 29.0],
    lng: [80.5, 81.0]
  },
  'Kanchanpur': {
    lat: [28.8, 29.0],
    lng: [80.0, 80.5]
  },
  'Belauri': {
    lat: [28.9, 29.1],
    lng: [80.0, 80.3]
  }
};

// Available locations in the app
export const AVAILABLE_LOCATIONS = ['Kathmandu', 'Kanchanpur', 'Kailali', 'Belauri'];

/**
 * Detects user's current location and returns the matching city name
 * @returns Promise<string> - City name or 'Kathmandu' as default
 */
export const detectLocation = async (): Promise<string> => {
  try {
    // Request location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('⚠️ Location permission not granted, using default: Kathmandu');
      return 'Kathmandu';
    }

    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;
    console.log('📍 Current location detected:', { latitude, longitude });

    // Find matching city based on coordinates
    for (const [city, bounds] of Object.entries(LOCATION_BOUNDS)) {
      const [minLat, maxLat] = bounds.lat;
      const [minLng, maxLng] = bounds.lng;

      if (
        latitude >= minLat &&
        latitude <= maxLat &&
        longitude >= minLng &&
        longitude <= maxLng
      ) {
        console.log(`✅ Location matched: ${city}`);
        return city;
      }
    }

    // If no match found, try reverse geocoding to get city name
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (reverseGeocode && reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const city = address.city || address.district || address.subregion;
        
        // Check if the city name matches any available location
        const matchedLocation = AVAILABLE_LOCATIONS.find(loc => 
          city?.toLowerCase().includes(loc.toLowerCase()) ||
          loc.toLowerCase().includes(city?.toLowerCase() || '')
        );

        if (matchedLocation) {
          console.log(`✅ Location matched via reverse geocoding: ${matchedLocation}`);
          return matchedLocation;
        }
      }
    } catch (geocodeError) {
      console.error('Error in reverse geocoding:', geocodeError);
    }

    // Default to Kathmandu if no match
    console.log('⚠️ No location match found, using default: Kathmandu');
    return 'Kathmandu';
  } catch (error) {
    console.error('❌ Error detecting location:', error);
    return 'Kathmandu'; // Default location
  }
};
