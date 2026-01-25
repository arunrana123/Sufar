import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import { socketService } from '@/lib/SocketService';
import { useTheme } from '@/contexts/ThemeContext';
import { getApiUrl } from '@/lib/config';

interface Service {
  _id: string;
  title: string;
  category: string;
  price: number;
  priceType: string;
  rating: number;
  isActive?: boolean;
}

interface SearchResult extends Service {
  type: 'service';
}

export default function SearchServicesScreen() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'Plumbing',
    'Electrical',
    'Carpentry',
  ]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [isFetchingWorkers, setIsFetchingWorkers] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  useEffect(() => {
    fetchAllServices();
    
    // Connect to Socket.IO for real-time updates
    socketService.connect('search-services', 'user');
    
    // Listen for service updates
    socketService.on('service:updated', (updatedService: any) => {
      console.log('📢 Service update received in search:', updatedService);
      setAllServices(prev => 
        prev.map(service => 
          service._id === updatedService._id
            ? { ...service, ...updatedService }
            : service
        )
      );
      // Update search results if the updated service is in results
      setSearchResults(prev =>
        prev.map(result =>
          result._id === updatedService._id
            ? { ...result, ...updatedService }
            : result
        )
      );
    });
    
    // Get user location (best-effort)
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          if (req.status !== 'granted') {
            setLocationPermissionDenied(true);
          }
        }
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        // proceed without location; API will fall back to category-only
        setLocationPermissionDenied(true);
      }
    })();
    
    return () => {
      socketService.off('service:updated');
    };
  }, []);

  const fetchAllServices = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/services/all`);
      
      if (response.ok) {
        const data = await response.json();
        setAllServices(data.filter((s: Service) => s.isActive));
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults([]);
      setWorkers([]);
      return;
    }

    const filtered = allServices
      .filter(service => 
        service.title.toLowerCase().includes(query.toLowerCase()) ||
        service.category.toLowerCase().includes(query.toLowerCase())
      )
      .map(service => ({ ...service, type: 'service' as const }));

    setSearchResults(filtered);

    // If a category match exists, fetch available workers for that category
    const matchedCategory = filtered[0]?.category || (allServices.find(s => s.category.toLowerCase() === query.toLowerCase())?.category);
    if (matchedCategory) {
      fetchAvailableWorkers(matchedCategory);
    } else {
      setWorkers([]);
    }
  };

  const handleSelectSearch = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
    
    if (!recentSearches.includes(query)) {
      setRecentSearches([query, ...recentSearches.slice(0, 4)]);
    }
  };

  const fetchAvailableWorkers = async (category: string) => {
    setIsFetchingWorkers(true);
    try {
      const apiUrl = getApiUrl();
      const params = new URLSearchParams();
      params.append('serviceCategory', category);
      if (userLocation) {
        params.append('latitude', String(userLocation.latitude));
        params.append('longitude', String(userLocation.longitude));
        params.append('radius', '15');
      }
      const response = await fetch(`${apiUrl}/api/workers/available?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const foundWorkers = data.workers || [];
        
        // Ensure we only use workers with valid IDs (registered workers)
        const validWorkers = foundWorkers.filter((w: any) => w._id && typeof w._id === 'string');
        
        console.log('✅ Found registered workers:', validWorkers.length);
        console.log('📋 Worker IDs:', validWorkers.map((w: any) => ({
          id: w._id,
          name: w.name,
          phone: w.phone,
        })));
        
        if (validWorkers.length !== foundWorkers.length) {
          console.warn('⚠️ Filtered out workers without valid IDs:', foundWorkers.length - validWorkers.length);
        }
        
        setWorkers(validWorkers);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch workers:', response.status, errorText);
        setWorkers([]);
      }
    } catch (e) {
      setWorkers([]);
    } finally {
      setIsFetchingWorkers(false);
    }
  };

  const handleEnableLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setLocationPermissionDenied(false);
        // Re-run worker fetch with coordinates if there's a category match
        if (searchQuery.trim()) {
          const match = allServices.find(s => s.category.toLowerCase().includes(searchQuery.toLowerCase()));
          if (match) fetchAvailableWorkers(match.category);
        }
      } else {
        setLocationPermissionDenied(true);
        Linking.openSettings();
      }
    } catch {
      setLocationPermissionDenied(true);
      Linking.openSettings();
    }
  };

  const handleSelectService = (service: Service) => {
    router.push({
      pathname: '/book-service',
      params: {
        serviceId: service._id,
        title: service.title,
        category: service.category,
        price: service.price.toString(),
      },
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const formatPrice = (service: Service) => {
    const basePrice = `Rs. ${service.price}`;
    switch (service.priceType) {
      case 'hour':
        return `${basePrice}/Hour`;
      case 'per_foot':
        return `${basePrice}/ft`;
      case 'customize':
        return `${basePrice}/Customise`;
      default:
        return basePrice;
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>Search Services</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Section */}
        <View style={[styles.searchSection, { backgroundColor: theme.background }]}>
          <View style={[styles.searchContainer, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
            <Ionicons name="search" size={20} color={theme.icon} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search services..."
              placeholderTextColor={theme.icon}
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={theme.icon} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Search Results */}
          {searchQuery.trim() !== '' && searchResults.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Search Results ({searchResults.length})</Text>
              {searchResults.map((result) => (
                <TouchableOpacity
                  key={result._id}
                  style={[styles.resultItem, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => handleSelectService(result)}
                >
                  <View style={[styles.resultIcon, { backgroundColor: theme.tint + '15' }]}>
                    <Ionicons name="construct-outline" size={24} color={theme.tint} />
                  </View>
                  <View style={styles.resultContent}>
                    <Text style={[styles.resultTitle, { color: theme.text }]}>{result.title}</Text>
                    <Text style={[styles.resultCategory, { color: theme.secondary }]}>{result.category}</Text>
                    <View style={styles.resultFooter}>
                      <Text style={[styles.resultPrice, { color: theme.tint }]}>{formatPrice(result)}</Text>
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={12} color="#FFD700" />
                        <Text style={styles.ratingText}>{result.rating}</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.icon} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Available Workers in Selected Category */}
          {searchQuery.trim() !== '' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {isFetchingWorkers ? 'Finding nearby workers…' : `Available Workers (${workers.length})`}
              </Text>
              {locationPermissionDenied && (
                <View style={[styles.locationWarning, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
                  <Text style={[styles.locationWarningText, { color: theme.warning }]}>
                    Location permission is disabled. Enable it for better nearby results.
                  </Text>
                  <TouchableOpacity onPress={handleEnableLocation} style={[styles.enableLocationButton, { backgroundColor: theme.tint }]}>
                    <Text style={styles.enableLocationButtonText}>Enable Location</Text>
                  </TouchableOpacity>
                </View>
              )}
              {workers.map((w) => (
                <View key={w._id} style={styles.resultItem}>
                  <View style={styles.resultIcon}>
                    <Ionicons name="person-outline" size={22} color={w.status === 'available' ? '#10B981' : '#6B7280'} />
                  </View>
                  <View style={styles.resultContent}>
                    <Text style={styles.resultTitle}>{w.name}</Text>
                    <Text style={styles.resultCategory}>
                      {Array.isArray(w.serviceCategories) ? w.serviceCategories.join(', ') : w.serviceCategories}
                    </Text>
                    {w.distance !== undefined && (
                      <Text style={styles.workerMeta}>{w.distance} km away • ETA {w.estimatedArrival} min</Text>
                    )}
                  </View>
                </View>
              ))}
              {searchQuery.trim() !== '' && workers.length === 0 && !isFetchingWorkers && (
                <Text style={{ color: '#666', paddingHorizontal: 20 }}>No workers found for this category nearby.</Text>
              )}
            </View>
          )}

          {/* No Results */}
          {searchQuery.trim() !== '' && searchResults.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>Try searching with different keywords</Text>
            </View>
          )}

          {/* Recent Searches */}
          {searchQuery.trim() === '' && recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Searches</Text>
                <TouchableOpacity onPress={() => setRecentSearches([])}>
                  <Text style={[styles.clearAllText, { color: theme.tint }]}>Clear All</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((search, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.recentItem, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => handleSelectSearch(search)}
                >
                  <Ionicons name="time-outline" size={20} color={theme.icon} />
                  <Text style={[styles.recentText, { color: theme.text }]}>{search}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setRecentSearches(recentSearches.filter((_, i) => i !== index))
                    }
                  >
                    <Ionicons name="close" size={20} color="#999" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Popular Categories */}
          {searchQuery.trim() === '' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Services</Text>
              <View style={styles.tagsContainer}>
                {['Plumbing', 'Electrical', 'Carpentry', 'Cleaning', 'Painting', 'AC Repair'].map(
                  (tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.tag}
                      onPress={() => handleSelectSearch(tag)}
                    >
                      <Text style={styles.tagText}>{tag}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 8,
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  resultCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  resultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recentText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tag: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tagText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  locationWarning: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  locationWarningText: {
    marginBottom: 8,
  },
  enableLocationButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  enableLocationButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  workerMeta: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
});

