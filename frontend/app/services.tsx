// SERVICES SCREEN - Browse all available services with categories and filters
// Features: Service grid display, pull-to-refresh, real-time updates via Socket.IO, category filtering
import { SafeAreaView, StyleSheet, View, Pressable, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';

interface Service {
  _id: string;
  title: string;
  description: string;
  price: number;
  priceType: string;
  category: string;
  subCategory?: string;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  imageUrl?: string;
  isMainCategory?: boolean;
  parentCategory?: string;
  createdAt: string;
}

interface HierarchicalService {
  category: string;
  mainService: Service | null;
  subServices: Service[];
}

export default function ServicesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [services, setServices] = useState<Service[]>([]);
  const [hierarchicalServices, setHierarchicalServices] = useState<HierarchicalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  const fetchServices = async (isRefresh = false) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/services/all`);
      
      if (response.ok) {
        const data = await response.json();
        const activeServices = data.filter((service: Service) => service.isActive);
        setServices(activeServices);
        setLastUpdateTime(Date.now());
        
        if (isRefresh) {
          console.log('Services refreshed successfully');
        }
      } else {
        console.warn('Failed to fetch services');
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchHierarchicalServices = async (isRefresh = false) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/services/hierarchy/all`);
      
      if (response.ok) {
        const data = await response.json();
        setHierarchicalServices(data);
        setLastUpdateTime(Date.now());
        
        if (isRefresh) {
          console.log('Hierarchical services refreshed successfully');
        }
      } else {
        console.warn('Failed to fetch hierarchical services');
        // Fallback to regular services
        fetchServices(isRefresh);
      }
    } catch (error) {
      console.error('Error fetching hierarchical services:', error);
      // Fallback to regular services
      fetchServices(isRefresh);
    }
  };

  // Update service in hierarchical services
  const updateServiceInHierarchy = (updatedService: Service) => {
    setHierarchicalServices(prev => {
      return prev.map(hierarchy => {
        // Update main service if it matches
        if (hierarchy.mainService?._id === updatedService._id) {
          return {
            ...hierarchy,
            mainService: { ...hierarchy.mainService, ...updatedService }
          };
        }
        
        // Update sub-services
        const updatedSubServices = hierarchy.subServices.map(subService =>
          subService._id === updatedService._id
            ? { ...subService, ...updatedService }
            : subService
        );
        
        return {
          ...hierarchy,
          subServices: updatedSubServices
        };
      });
    });
    
    // Also update flat services list
    setServices(prev => 
      prev.map(service => 
        service._id === updatedService._id 
          ? { ...service, ...updatedService }
          : service
      )
    );
    
    console.log(`✅ Service updated in real-time: ${updatedService.title} (Price: ${updatedService.price})`);
  };

  useEffect(() => {
    fetchHierarchicalServices();
    
    // Connect to Socket.IO for real-time updates
    const userId = 'services-user-' + Date.now(); // Unique ID for services page
    socketService.connect(userId, 'user');
    
    // Wait a bit for connection to establish
    const connectTimeout = setTimeout(() => {
      // Listen for service updates
      socketService.on('service:updated', (updatedService: any) => {
        console.log('📢 Service update received in frontend:', updatedService);
        updateServiceInHierarchy(updatedService);
        setLastUpdateTime(Date.now());
      });
      
      console.log('✅ Socket.IO listener registered for service:updated');
    }, 1000);
    
    // Set up polling as backup every 30 seconds
    const interval = setInterval(() => {
      fetchHierarchicalServices(true);
    }, 30000); // Poll every 30 seconds as backup
    
    return () => {
      clearTimeout(connectTimeout);
      clearInterval(interval);
      socketService.off('service:updated');
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHierarchicalServices(true);
  };

  const formatPrice = (price: number, priceType: string) => {
    switch (priceType) {
      case 'hour':
        return `Rs. ${price}/Hour`;
      case 'per_foot':
        return `Rs. ${price}/fit`;
      case 'customize':
        return `Rs. ${price}/Customise`;
      default:
        return `Rs. ${price}`;
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'Plumber': 'build-outline',
      'Electrician': 'flash-outline',
      'Carpenter': 'hammer-outline',
      'Cleaner': 'sparkles-outline',
      'Mechanic': 'car-outline',
      'AC Repair': 'snow-outline',
      'Painter': 'brush-outline',
      'Mason': 'home-outline',
      'Cook': 'restaurant-outline',
      'Driver': 'car-sport-outline',
      'Security': 'shield-outline',
      'Beautician': 'flower-outline',
      'Technician': 'settings-outline',
      'Delivery': 'bicycle-outline',
      'Gardener': 'leaf-outline',
    };
    return icons[category] || 'build-outline';
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Plumber': '#4A90E2',
      'Electrician': '#F5A623',
      'Carpenter': '#D0021B',
      'Cleaner': '#4ECDC4',
      'Mechanic': '#7ED321',
      'AC Repair': '#50E3C2',
      'Painter': '#FF6B6B',
      'Mason': '#9013FE',
      'Cook': '#FFA07A',
      'Driver': '#98D8C8',
      'Security': '#F7DC6F',
      'Beautician': '#F8C471',
      'Technician': '#BB8FCE',
      'Delivery': '#85C1E9',
      'Gardener': '#45B7D1',
    };
    return colors[category] || '#4A90E2';
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe}>
          <Pressable onPress={() => router.replace('/home')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={28} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#FF7A2C" />
            <ThemedText style={{ marginTop: 16 }}>Loading services...</ThemedText>
          </View>
        </SafeAreaView>
        <BottomNav />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.replace('/home')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </Pressable>
        
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>Available Services</ThemedText>
          <ThemedText style={styles.subtitle}>
            {services.length} service{services.length !== 1 ? 's' : ''} available
          </ThemedText>
          {lastUpdateTime > 0 && (
            <ThemedText style={styles.lastUpdate}>
              Last updated: {new Date(lastUpdateTime).toLocaleTimeString()}
            </ThemedText>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {hierarchicalServices.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="grid-outline" size={64} color="#FF7A2C" />
              <ThemedText type="title" style={styles.emptyTitle}>No Services Available</ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                Check back later for available services
              </ThemedText>
            </View>
          ) : (
            <View style={styles.servicesList}>
              {hierarchicalServices.map((hierarchy) => (
                <View key={hierarchy.category} style={styles.categoryCard}>
                  {/* Category Header */}
                  <View style={[styles.categoryHeader, { backgroundColor: getCategoryColor(hierarchy.category) + '20' }]}>
                    <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(hierarchy.category) + '40' }]}>
                      <Ionicons 
                        name={getCategoryIcon(hierarchy.category) as any} 
                        size={24} 
                        color={getCategoryColor(hierarchy.category)} 
                      />
                    </View>
                    <View style={styles.categoryInfo}>
                      <ThemedText style={styles.categoryTitle}>{hierarchy.category}</ThemedText>
                      <ThemedText style={styles.categorySubtitle}>
                        {hierarchy.subServices.length} service{hierarchy.subServices.length !== 1 ? 's' : ''} available
                      </ThemedText>
                    </View>
                  </View>
                  
                  {/* Sub Services */}
                  <View style={styles.subServicesList}>
                    {hierarchy.subServices.map((service) => (
                      <Pressable key={service._id} style={styles.serviceCard}>
                        <View style={styles.serviceHeader}>
                          <View style={styles.serviceInfo}>
                            <ThemedText style={styles.serviceTitle}>{service.title}</ThemedText>
                            {service.subCategory && (
                              <ThemedText style={styles.serviceSubCategory}>{service.subCategory}</ThemedText>
                            )}
                          </View>
                          <View style={styles.servicePrice}>
                            <ThemedText style={styles.priceText}>
                              {formatPrice(service.price, service.priceType)}
                            </ThemedText>
                          </View>
                        </View>
                        
                        <ThemedText style={styles.serviceDescription} numberOfLines={2}>
                          {service.description}
                        </ThemedText>
                        
                        <View style={styles.serviceFooter}>
                          <View style={styles.ratingContainer}>
                            <Ionicons name="star" size={16} color="#FFD700" />
                            <ThemedText style={styles.ratingText}>
                              {service.rating} ({service.reviewCount} reviews)
                            </ThemedText>
                          </View>
                          <View style={styles.statusContainer}>
                            <View style={[styles.statusDot, { backgroundColor: service.isActive ? '#10B981' : '#EF4444' }]} />
                            <ThemedText style={styles.statusText}>
                              {service.isActive ? 'Available' : 'Unavailable'}
                            </ThemedText>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <BottomNav />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  backBtn: { position: 'absolute', top: 20, left: 12, padding: 6, zIndex: 10 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  lastUpdate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  servicesList: {
    paddingBottom: 20,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  subServicesList: {
    padding: 8,
  },
  serviceSubCategory: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  serviceCategory: {
    fontSize: 14,
    color: '#666',
  },
  servicePrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF7A2C',
  },
  serviceDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
});
