import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Pressable,
  SafeAreaView,
  RefreshControl,
  FlatList,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import OptimizedServiceCard from '@/components/OptimizedServiceCard';
import { socketService } from '@/lib/SocketService';
import { getApiUrl } from '@/lib/config';

const { width } = Dimensions.get('window');

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
  imageUrl?: string;
  isActive: boolean;
}

export default function OptimizedHomeScreen() {
  const { user, updateUser } = useAuth();
  const [selectedLocation, setSelectedLocation] = useState('Kathmandu');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  const locations = ['Kathmandu', 'Kanchanpur', 'Kailali'];

  // Memoized service categories for better performance
  const serviceCategories = useMemo(() => [
    { id: 'plumber', name: 'Plumber', icon: 'water', color: '#4A90E2' },
    { id: 'electrician', name: 'Electrician', icon: 'flash', color: '#F5A623' },
    { id: 'carpenter', name: 'Carpenter', icon: 'hammer', color: '#7ED321' },
    { id: 'mechanic', name: 'Mechanic', icon: 'car', color: '#BD10E0' },
    { id: 'cleaner', name: 'Cleaner', icon: 'sparkles', color: '#50E3C2' },
    { id: 'driver', name: 'Driver', icon: 'car-sport', color: '#B8E986' },
    { id: 'cook', name: 'Cook', color: '#F8E71C' },
    { id: 'gardener', name: 'Gardener', icon: 'leaf', color: '#4A90E2' },
  ], []);

  // Load user profile photo
  useEffect(() => {
    if (user?.profilePhoto) {
      setProfilePhoto(user.profilePhoto);
    }
  }, [user?.profilePhoto]);

  // Load services based on selected location
  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      console.log(`📍 Loading services for location: ${selectedLocation}`);
      
      // Fetch services filtered by location (city)
      const url = `${apiUrl}/api/services/all${selectedLocation ? `?city=${encodeURIComponent(selectedLocation)}` : ''}`;
      console.log(`🔗 Fetching from: ${url}`);
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const activeServices = data.filter((service: Service) => service.isActive);
        console.log(`✅ Loaded ${activeServices.length} services for ${selectedLocation}`);
        setServices(activeServices);
      } else {
        console.error('❌ Failed to fetch services:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading services:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  // Load notifications count
  const loadNotifications = useCallback(async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [user?.token]);

  // Setup socket listeners
  useEffect(() => {
    if (user) {
      socketService.connect(user.id, 'user');
      
      socketService.on('notification:new', (notification) => {
        setUnreadCount(prev => prev + 1);
      });

      socketService.on('service:updated', (service) => {
        setServices(prev => 
          prev.map(s => s._id === service._id ? service : s)
        );
      });

      // Listen for booking acceptance globally
      const handleBookingAccepted = (data: any) => {
        console.log('Booking accepted event received (home):', data);
        const bookingId = data.bookingId || data.booking?._id;
        
        if (bookingId) {
          Alert.alert(
            'Worker Assigned!',
            'A worker has accepted your service request. You can now track them in real-time.',
            [
              {
                text: 'Start Tracking',
                onPress: () => {
                  router.push({
                    pathname: '/live-tracking',
                    params: { bookingId: String(bookingId) },
                  });
                },
              },
              {
                text: 'Later',
                style: 'cancel',
              },
            ]
          );
        }
      };

      socketService.on('booking:accepted', handleBookingAccepted);
      
      // Listen for booking cancellation
      socketService.on('booking:cancelled', (data: any) => {
        console.log('📢 Booking cancelled notification:', data);
        Alert.alert(
          'Booking Cancelled',
          data.message || 'Your service booking has been cancelled successfully',
          [{ text: 'OK' }]
        );
      });

      // Listen for new notifications (these should ONLY be for users, not workers)
      // Worker notifications don't use the Notification model, they use socket events only
      socketService.on('notification:new', (notification: any) => {
        console.log('📢 New notification received in user app:', notification);
        // Only show alerts for booking-related notifications (not shown in booking:accepted handler)
        if (notification.type === 'booking' && notification.data?.status === 'cancelled') {
          // Show alert for cancellation notification
          Alert.alert(
            notification.title || 'Booking Cancelled',
            notification.message || 'Your service booking has been cancelled successfully',
            [{ text: 'OK' }]
          );
        }
      });

      return () => {
        socketService.off('booking:accepted', handleBookingAccepted);
        socketService.off('booking:cancelled');
        socketService.off('notification:new');
      };
    }
  }, [user]);

  // Initial load and reload when location changes
  useEffect(() => {
    loadServices();
  }, [loadServices]); // This will trigger when selectedLocation changes since loadServices depends on it

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadServices(), loadNotifications()]);
    setRefreshing(false);
  }, [loadServices, loadNotifications]);

  // Handle service category press
  const handleCategoryPress = useCallback((category: string) => {
    router.push({
      pathname: '/services',
      params: { category },
    });
  }, []);

  // Handle service press
  const handleServicePress = useCallback((service: Service) => {
    router.push({
      pathname: '/book-service',
      params: {
        serviceId: service._id,
        title: service.title,
        category: service.category,
        price: service.price.toString(),
      },
    });
  }, []);

  // Render service category
  const renderCategory = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.categoryCard, { backgroundColor: item.color + '20' }]}
      onPress={() => handleCategoryPress(item.id)}
      activeOpacity={0.8}
    >
      <View style={[styles.categoryIcon, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon} size={24} color="#fff" />
      </View>
      <Text style={styles.categoryName}>{item.name}</Text>
    </TouchableOpacity>
  ), [handleCategoryPress]);

  // Render service
  const renderService = useCallback(({ item }: { item: Service }) => (
    <OptimizedServiceCard
      service={item}
      onPress={handleServicePress}
    />
  ), [handleServicePress]);

  // Render skeleton for services
  const renderServiceSkeleton = useCallback(() => (
    <View style={styles.servicesGrid}>
      {Array.from({ length: 4 }).map((_, index) => (
        <OptimizedServiceCard key={index} service={{} as Service} loading={true} />
      ))}
    </View>
  ), []);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <LinearGradient
          colors={['#FF7A2C', '#FF9A56']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <BlurView intensity={20} style={styles.headerContent}>
            {/* Profile */}
            <Pressable style={styles.profileContainer}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
              )}
            </Pressable>

            {/* Location */}
            <Pressable
              style={styles.locationWrap}
              onPress={() => setShowLocationDropdown(!showLocationDropdown)}
            >
              <Ionicons name="location" size={16} color="#fff" />
              <Text style={styles.locationText}>{selectedLocation}</Text>
              <Ionicons
                name={showLocationDropdown ? "chevron-up" : "chevron-down"}
                size={14}
                color="#fff"
              />
            </Pressable>

            {/* Search */}
            <Pressable
              style={styles.searchButton}
              onPress={() => router.push('/search-services')}
            >
              <Ionicons name="search" size={18} color="#000" />
            </Pressable>

            {/* Notifications */}
            <Pressable
              style={styles.bellWrap}
              onPress={() => router.push('/notifications')}
            >
              <Ionicons name="notifications-outline" size={18} color="#FF7A2C" />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount.toString()}
                  </Text>
                </View>
              )}
            </Pressable>
          </BlurView>

          {/* Location Dropdown */}
          {showLocationDropdown && (
            <View style={styles.locationDropdown}>
              {locations.map((location) => (
                <Pressable
                  key={location}
                  style={[
                    styles.locationOption,
                    selectedLocation === location && styles.selectedLocationOption
                  ]}
                  onPress={() => {
                    console.log(`📍 Location changed from ${selectedLocation} to ${location}`);
                    setSelectedLocation(location);
                    setShowLocationDropdown(false);
                    // Services will be reloaded automatically via useEffect when selectedLocation changes
                  }}
                >
                  <Text style={[
                    styles.locationOptionText,
                    selectedLocation === location && styles.selectedLocationOptionText
                  ]}>
                    {location}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </LinearGradient>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome to our service hub</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.locationInfo}>Now you are in current location: {selectedLocation}</Text>
          </View>

          {/* Service Categories */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services</Text>
            <FlatList
              data={serviceCategories}
              renderItem={renderCategory}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContainer}
            />
          </View>

          {/* Popular Services */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Services</Text>
              <TouchableOpacity onPress={() => router.push('/all-services')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            
            {loading ? (
              renderServiceSkeleton()
            ) : (
              <FlatList
                data={services.slice(0, 6)}
                renderItem={renderService}
                keyExtractor={(item) => item._id}
                numColumns={2}
                scrollEnabled={false}
                contentContainerStyle={styles.servicesGrid}
              />
            )}
          </View>
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
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    gap: 15,
  },
  profileContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationWrap: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 8,
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  locationDropdown: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  locationOption: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedLocationOption: {
    backgroundColor: '#FFE5CC',
  },
  locationOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectedLocationOptionText: {
    color: '#FF7A2C',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  welcomeSection: {
    padding: 20,
    paddingBottom: 10,
  },
  welcomeText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
    marginBottom: 5,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  locationInfo: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#FF7A2C',
    fontWeight: '600',
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 15,
  },
  categoryCard: {
    width: 80,
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  servicesGrid: {
    paddingHorizontal: 20,
    gap: 15,
  },
});
