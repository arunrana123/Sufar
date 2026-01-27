// ADDRESS SELECTOR SCREEN - Map-based address selection for delivery
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  ScrollView,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useCart } from '@/contexts/CartContext';
import { MapView, Marker, PROVIDER_GOOGLE } from '@/components/react-native-maps';

interface Address {
  latitude: number;
  longitude: number;
  address: string;
  formattedAddress?: string;
}

export default function SelectAddressScreen() {
  const { theme } = useTheme();
  const { updateDeliveryAddress } = useCart();
  const params = useLocalSearchParams();
  const productId = params.productId as string;
  const returnTo = params.returnTo as string || 'cart';

  const [selectedLocation, setSelectedLocation] = useState<Address | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Address | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Address[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    requestLocationPermission();
    
    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mapReady && currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  }, [mapReady, currentLocation]);

  const requestLocationPermission = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to select delivery address.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      const address = await reverseGeocode(latitude, longitude);
      
      const currentAddr: Address = {
        latitude,
        longitude,
        address: address || 'Current Location',
        formattedAddress: address,
      };

      setCurrentLocation(currentAddr);
      setSelectedLocation(currentAddr);
      setLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to get your location. Please try again.');
      setLoading(false);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        const parts = [
          addr.name,
          addr.street,
          addr.streetNumber,
          addr.district,
          addr.subregion,
          addr.city,
          addr.region,
          addr.postalCode,
          addr.country,
        ].filter(Boolean);
        return parts.join(', ') || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (error) {
      console.error('Reverse geocode error:', error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  };

  const formatAddressFromGeocode = (addr: Location.LocationGeocodedAddress): string => {
    // Build a more readable address format
    const streetParts = [
      addr.streetNumber,
      addr.street,
    ].filter(Boolean);
    
    const locationParts = [
      addr.name,
      streetParts.join(' '),
      addr.district,
      addr.subregion,
      addr.city,
      addr.region,
    ].filter(Boolean);
    
    return locationParts.join(', ') || addr.name || 'Address';
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const address = await reverseGeocode(latitude, longitude);
    
    const newLocation: Address = {
      latitude,
      longitude,
      address: address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      formattedAddress: address,
    };

    setSelectedLocation(newLocation);
    
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const results = await Location.geocodeAsync(query);
      
      if (results && results.length > 0) {
        const formattedResults: Address[] = await Promise.all(
          results.map(async (result) => {
            const address = await reverseGeocode(result.latitude, result.longitude);
            return {
              latitude: result.latitude,
              longitude: result.longitude,
              address: address || formatAddressFromGeocode(result as any) || query,
              formattedAddress: address || formatAddressFromGeocode(result as any),
            };
          })
        );
        setSearchResults(formattedResults);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchInputChange = (text: string) => {
    setSearchQuery(text);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    if (text.trim().length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(text);
      }, 500);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = async (result: Address) => {
    setSelectedLocation(result);
    setSearchQuery(result.formattedAddress || result.address);
    setSearchResults([]);
    
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: result.latitude,
        longitude: result.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (currentLocation) {
      setSelectedLocation(currentLocation);
      if (mapRef.current && currentLocation) {
        mapRef.current.animateToRegion({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    } else {
      await requestLocationPermission();
    }
  };

  const handleConfirm = () => {
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a delivery address.');
      return;
    }

    if (productId) {
      updateDeliveryAddress(productId, selectedLocation.formattedAddress || selectedLocation.address);
    }

    Alert.alert('Success', 'Delivery address selected!', [
      {
        text: 'OK',
        onPress: () => {
          if (returnTo === 'cart') {
            router.back();
          } else {
            router.replace('/cart');
          }
        },
      },
    ]);
  };

  if (loading && !currentLocation) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.text }]}>
              Loading map...
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText 
            type="title" 
            style={[styles.headerTitle, { color: '#fff' }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Select Delivery Address
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.searchBar, { backgroundColor: '#fff', borderColor: theme.primary }]}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search address (e.g., street, city, landmark)..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={handleSearchInputChange}
                returnKeyType="search"
              />
              {isSearching && (
                <ActivityIndicator size="small" color={theme.primary} style={styles.searchLoader} />
              )}
              {searchQuery.length > 0 && !isSearching && (
                <TouchableOpacity onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.currentLocationButton, { backgroundColor: theme.primary }]}
              onPress={handleUseCurrentLocation}
            >
              <Ionicons name="locate" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={[styles.searchResultsContainer, { backgroundColor: theme.background }]}>
              <View style={styles.searchResultsHeader}>
                <ThemedText style={[styles.searchResultsTitle, { color: theme.text }]}>
                  Search Results ({searchResults.length})
                </ThemedText>
                <TouchableOpacity onPress={() => setSearchResults([])}>
                  <Ionicons name="close" size={20} color={theme.secondary} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={searchResults}
                keyExtractor={(item, index) => `${item.latitude}-${item.longitude}-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.searchResultItem, { 
                      backgroundColor: theme.card, 
                      borderColor: theme.border 
                    }]}
                    onPress={() => handleSelectSearchResult(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.searchResultIcon, { backgroundColor: `${theme.primary}20` }]}>
                      <Ionicons name="location" size={20} color={theme.primary} />
                    </View>
                    <View style={styles.searchResultContent}>
                      <ThemedText 
                        style={[styles.searchResultAddress, { color: theme.text }]} 
                        numberOfLines={2}
                      >
                        {item.formattedAddress || item.address}
                      </ThemedText>
                      <ThemedText 
                        style={[styles.searchResultCoords, { color: theme.secondary }]}
                        numberOfLines={1}
                      >
                        {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.secondary} />
                  </TouchableOpacity>
                )}
                style={styles.searchResultsList}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              />
            </View>
          )}

          {/* Map */}
          <View style={styles.mapContainer}>
            {currentLocation && (
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onPress={handleMapPress}
                onMapReady={() => setMapReady(true)}
                showsUserLocation={true}
                showsMyLocationButton={false}
              >
                {selectedLocation && (
                  <Marker
                    coordinate={{
                      latitude: selectedLocation.latitude,
                      longitude: selectedLocation.longitude,
                    }}
                    title="Delivery Address"
                    description={selectedLocation.address}
                    pinColor={theme.primary}
                  />
                )}
              </MapView>
            )}

            {/* Center Pin Indicator */}
            <View style={styles.centerPinContainer} pointerEvents="none">
              <Ionicons name="location" size={40} color={theme.primary} />
            </View>
          </View>

          {/* Selected Address Display */}
          {selectedLocation && (
            <View style={[styles.addressCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.addressHeader}>
                <Ionicons name="location" size={20} color={theme.primary} />
                <ThemedText style={[styles.addressTitle, { color: theme.text }]}>
                  Selected Address
                </ThemedText>
              </View>
              <ThemedText style={[styles.addressText, { color: theme.text }]}>
                {selectedLocation.formattedAddress || selectedLocation.address}
              </ThemedText>
              <ThemedText style={[styles.addressCoords, { color: theme.secondary }]}>
                {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </ThemedText>
            </View>
          )}

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: theme.primary }]}
            onPress={handleConfirm}
            disabled={!selectedLocation}
          >
            <ThemedText style={styles.confirmButtonText}>
              Confirm Address
            </ThemedText>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 50,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 0,
  },
  searchLoader: {
    marginLeft: 8,
  },
  searchResultsContainer: {
    maxHeight: 200,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  searchResultAddress: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  searchResultCoords: {
    fontSize: 12,
  },
  currentLocationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  addressText: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  addressCoords: {
    fontSize: 12,
    marginTop: 4,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});
