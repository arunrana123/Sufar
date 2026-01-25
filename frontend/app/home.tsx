// HOME SCREEN - Main landing page with service categories, search, and location selector
// Features: Service search, location selection, quick actions, profile access, notification bell, helpful tooltips
import { SafeAreaView, StyleSheet, View, TextInput, Pressable, Platform, Alert, ScrollView, Image } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import BottomNav from '@/components/BottomNav';
import ProfileSheet from '@/components/ProfileSheet';
import HelpTooltip from '@/components/HelpTooltip';
import { getCurrentUser, setCurrentUser } from '@/lib/session';
import { notificationService } from '@/lib/NotificationService';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { detectLocation, AVAILABLE_LOCATIONS } from '@/lib/LocationDetector';
import { useState, useEffect, useCallback } from 'react';

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState('Kathmandu');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  // Syncs profile image state when user data changes
  // Triggered by: User profile updates or screen focus
  useEffect(() => {
    console.log('Home screen - Profile image state changed to:', profileImage);
  }, [profileImage]);

  // Loads user's profile image from AuthContext
  // Triggered by: User login or profile photo update
  useEffect(() => {
    console.log('Home screen - User data:', user);
    console.log('Home screen - Profile photo:', user?.profilePhoto);
    if (user?.profilePhoto) {
      setProfileImage(user.profilePhoto);
    } else {
      setProfileImage(null);
    }
  }, [user?.profilePhoto, user?.firstName, user?.lastName, user?.email]);

  // Updates profile image when user changes or re-authenticates
  // Triggered by: User ID change or profile photo update
  useEffect(() => {
    console.log('Home screen - User ID changed, refreshing profile image');
    console.log('Home screen - Current profile photo:', user?.profilePhoto);
    if (user?.profilePhoto) {
      setProfileImage(user.profilePhoto);
      console.log('Home screen - Profile image set to:', user.profilePhoto);
    } else {
      setProfileImage(null);
      console.log('Home screen - No profile photo, setting to null');
    }
  }, [user?.id, user?.profilePhoto]);

  // Refreshes profile image from current user data
  // Triggered by: Screen focus, manual refresh
  const refreshProfileImage = () => {
    console.log('Refreshing profile image for user:', user?.id);
    console.log('Profile photo URL:', user?.profilePhoto);
    if (user?.profilePhoto) {
      setProfileImage(user.profilePhoto);
    } else {
      setProfileImage(null);
    }
  };

  // Refreshes profile when user navigates back to home screen
  // Triggered by: Screen comes into focus (useFocusEffect hook)
  useFocusEffect(
    useCallback(() => {
      refreshProfileImage();
      
      // Auto-update location when screen comes into focus
      const updateLocation = async () => {
        try {
          const detectedLocation = await detectLocation();
          if (detectedLocation && detectedLocation !== selectedLocation) {
            console.log('📍 Location updated on focus:', detectedLocation);
            setSelectedLocation(detectedLocation);
          }
        } catch (error) {
          console.error('Error updating location on focus:', error);
        }
      };
      
      updateLocation();
    }, [selectedLocation, user])
  );

  const locations = AVAILABLE_LOCATIONS;

  // Auto-detect location on mount
  useEffect(() => {
    const autoDetectLocation = async () => {
      try {
        const detectedLocation = await detectLocation();
        console.log('📍 Auto-detected location:', detectedLocation);
        setSelectedLocation(detectedLocation);
      } catch (error) {
        console.error('Error auto-detecting location:', error);
      }
    };

    autoDetectLocation();
  }, []);

  // Filters services based on user search query
  // Triggered by: User types in search input
  // Searches: Service name and category fields
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    const filtered = allServices.filter(service => 
      service.name.toLowerCase().includes(query.toLowerCase()) ||
      service.category.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(filtered);
  };

  // Clears search input and results
  // Triggered by: User taps 'X' icon in search box
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchBox(false);
  };

  // All available services for search
  const allServices = [
    { id: 'plumber', name: 'Plumber', icon: 'build-outline', color: '#4A90E2', route: '/plumber' as const, category: 'Repair' },
    { id: 'electrician', name: 'Electrician', icon: 'flash-outline', color: '#F5A623', route: '/electrician' as const, category: 'Repair' },
    { id: 'mechanic', name: 'Mechanic', icon: 'car-outline', color: '#7ED321', route: '/mechanic' as const, category: 'Automotive' },
    { id: 'ac-repair', name: 'Freez/AC repair', icon: 'snow-outline', color: '#50E3C2', route: '/ac-repair' as const, category: 'Repair' },
    { id: 'workers', name: 'Workers', icon: 'people-outline', color: '#BD10E0', route: '/workers' as const, category: 'General' },
    { id: 'carpenter', name: 'Carpenter', icon: 'hammer-outline', color: '#D0021B', route: '/carpenter' as const, category: 'Construction' },
    { id: 'mason', name: 'Mason', icon: 'home-outline', color: '#9013FE', route: '/mason' as const, category: 'Construction' },
    { id: 'painter', name: 'Painter', icon: 'brush-outline', color: '#FF6B6B', route: '/painter' as const, category: 'Construction' },
    { id: 'cleaner', name: 'Cleaner', icon: 'sparkles-outline', color: '#4ECDC4', route: '/cleaner' as const, category: 'Maintenance' },
    { id: 'gardener', name: 'Gardener', icon: 'leaf-outline', color: '#45B7D1', route: '/gardener' as const, category: 'Maintenance' },
    { id: 'cook', name: 'Cook', icon: 'restaurant-outline', color: '#FFA07A', route: '/cook' as const, category: 'Food' },
    { id: 'driver', name: 'Driver', icon: 'car-sport-outline', color: '#98D8C8', route: '/driver' as const, category: 'Transport' },
    { id: 'security', name: 'Security', icon: 'shield-outline', color: '#F7DC6F', route: '/security' as const, category: 'Safety' },
    { id: 'technician', name: 'Technician', icon: 'settings-outline', color: '#BB8FCE', route: '/technician' as const, category: 'Repair' },
    { id: 'delivery', name: 'Delivery', icon: 'bicycle-outline', color: '#85C1E9', route: '/delivery' as const, category: 'Transport' },
    { id: 'beautician', name: 'Beautician', icon: 'flower-outline', color: '#F8C471', route: '/beautician' as const, category: 'Beauty' },
  ];

  // First 8 services to display on home page
  const displayedServices = [
    { id: 'plumber', name: 'Plumber', icon: 'build-outline', color: '#4A90E2', route: '/plumber' as const },
    { id: 'electrician', name: 'Electrician', icon: 'flash-outline', color: '#F5A623', route: '/electrician' as const },
    { id: 'mechanic', name: 'Mechanic', icon: 'car-outline', color: '#7ED321', route: '/mechanic' as const },
    { id: 'ac-repair', name: 'Freez/AC repair', icon: 'snow-outline', color: '#50E3C2', route: '/ac-repair' as const },
    { id: 'workers', name: 'Workers', icon: 'people-outline', color: '#BD10E0', route: '/workers' as const },
    { id: 'carpenter', name: 'Carpenter', icon: 'hammer-outline', color: '#D0021B', route: '/carpenter' as const },
    { id: 'mason', name: 'Mason', icon: 'home-outline', color: '#9013FE', route: '/mason' as const },
    { id: 'painter', name: 'Painter', icon: 'brush-outline', color: '#FF6B6B', route: '/painter' as const },
  ];

  // Load unread count using optimized service
  const loadUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const count = await notificationService.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    // Load unread notification count
    loadUnreadCount();
    
    // Setup real-time notification updates
    if (user?.id) {
      notificationService.setupRealtimeUpdates(user.id);
      
      // Listen for notification updates
      const handleNotificationUpdate = () => {
        const count = notificationService.getCachedUnreadCount();
        setUnreadCount(count);
      };
      
      notificationService.addListener(handleNotificationUpdate);
      
      return () => {
        notificationService.removeListener(handleNotificationUpdate);
      };
    }
  }, [user, loadUnreadCount]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <Pressable style={styles.profileLogo} onPress={() => router.push('/profile')}>
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
                onError={() => {
                  console.log('Error loading profile image, falling back to icon');
                  setProfileImage(null);
                }}
                onLoad={() => {
                  console.log('Profile image loaded successfully');
                }}
              />
            ) : (
              <Ionicons name="person" size={24} color="#fff" />
            )}
          </Pressable>
          <Pressable 
            style={styles.locationWrap} 
            onPress={() => setShowLocationDropdown(!showLocationDropdown)}
          >
            <Ionicons name="location" size={16} color="#fff" style={styles.locationIcon} />
            <ThemedText style={styles.locationText}>{selectedLocation}</ThemedText>
            <Ionicons 
              name={showLocationDropdown ? "chevron-up" : "chevron-down"} 
              size={14} 
              color="#fff" 
              style={styles.chevronIcon} 
            />
          </Pressable>
          
          {showLocationDropdown && (
            <View style={[styles.locationDropdown, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {locations.map((location) => (
                <Pressable
                  key={location}
                  style={[
                    styles.locationOption,
                    selectedLocation === location && { backgroundColor: theme.primary + '15' }
                  ]}
                  onPress={() => {
                    setSelectedLocation(location);
                    setShowLocationDropdown(false);
                  }}
                >
                  <ThemedText style={[
                    styles.locationOptionText,
                    { color: selectedLocation === location ? theme.primary : theme.text }
                  ]}>
                    {location}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable style={[styles.searchButton, { backgroundColor: theme.background }]} onPress={() => router.push('/search-services')}>
            <Ionicons name="search" size={18} color={theme.text} />
          </Pressable>
          <Pressable style={[styles.bellWrap, { backgroundColor: theme.background }]} onPress={() => router.replace('/notifications')}>
            <Ionicons name="notifications-outline" size={18} color={theme.text} />
            {unreadCount > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: theme.danger }]}>
                <ThemedText style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount.toString()}
                </ThemedText>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search Box */}
        {showSearchBox && (
          <View style={[styles.searchContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.searchBox, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
              <Ionicons name="search" size={20} color={theme.icon} style={styles.searchBoxIcon} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search services..."
                placeholderTextColor={theme.icon}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus={true}
              />
              <Pressable onPress={clearSearch} style={styles.clearButton}>
                <Ionicons name="close" size={20} color={theme.icon} />
              </Pressable>
            </View>
            
            {/* Search Results */}
            {searchQuery.trim() !== '' && (
              <ScrollView style={[styles.searchResults, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false}>
                {searchResults.length > 0 ? (
                  searchResults.map((service) => (
                    <Pressable
                      key={service.id}
                      style={[styles.searchResultItem, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => {
                        router.replace(service.route);
                        clearSearch();
                      }}
                    >
                      <View style={styles.searchResultIcon}>
                        <Ionicons name={service.icon as any} size={24} color={service.color} />
                      </View>
                      <View style={styles.searchResultText}>
                        <ThemedText style={[styles.searchResultName, { color: theme.text }]}>{service.name}</ThemedText>
                        <ThemedText style={[styles.searchResultCategory, { color: theme.secondary }]}>{service.category}</ThemedText>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <View style={styles.noResults}>
                    <Ionicons name="search-outline" size={48} color={theme.icon} />
                    <ThemedText style={[styles.noResultsText, { color: theme.text }]}>Service not available</ThemedText>
                    <ThemedText style={[styles.noResultsSubtext, { color: theme.secondary }]}>Try searching with different keywords</ThemedText>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.welcome}>Welcome to our Service Hub</ThemedText>
          
          {/* Available Services Grid */}
          <View style={styles.servicesSection}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Available Services</ThemedText>
              <Pressable 
                style={styles.viewAllBtn} 
                onPress={() => router.replace('/all-services')}
              >
                <ThemedText style={[styles.viewAllText, { color: theme.primary }]}>View All</ThemedText>
              </Pressable>
            </View>
            
            <View style={styles.servicesGrid}>
              {displayedServices.map((service) => (
                <Pressable 
                  key={service.id} 
                  style={[styles.serviceCard, { backgroundColor: theme.card }]} 
                  onPress={() => router.replace(service.route)}
                >
                  <View style={styles.serviceIcon}>
                    <Ionicons name={service.icon as any} size={32} color={service.color} />
                  </View>
                  <ThemedText style={[styles.serviceLabel, { color: theme.text }]}>{service.name}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Popular Services - Horizontal Scroll */}
          <View style={styles.horizontalSection}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>🔥 Popular Services</ThemedText>
              <Pressable style={styles.viewAllBtn} onPress={() => router.replace('/all-services')}>
                <ThemedText style={[styles.viewAllText, { color: theme.primary }]}>See All</ThemedText>
              </Pressable>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.horizontalScroll}
            >
              {[
                { id: 'plumber', name: 'Plumber', icon: 'build-outline', color: '#4A90E2', route: '/plumber', price: 'From Rs.450', rating: '4.8' },
                { id: 'electrician', name: 'Electrician', icon: 'flash-outline', color: '#F5A623', route: '/electrician', price: 'From Rs.300', rating: '4.9' },
                { id: 'cleaner', name: 'Cleaner', icon: 'sparkles-outline', color: '#4ECDC4', route: '/cleaner', price: 'From Rs.600', rating: '4.7' },
                { id: 'beautician', name: 'Beautician', icon: 'flower-outline', color: '#E91E63', route: '/beautician', price: 'From Rs.300', rating: '4.9' },
                { id: 'ac-repair', name: 'AC Repair', icon: 'snow-outline', color: '#50E3C2', route: '/ac-repair', price: 'From Rs.600', rating: '4.6' },
              ].map((service) => (
                <Pressable 
                  key={service.id} 
                  style={[styles.popularCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => router.replace(service.route as any)}
                >
                  <View style={[styles.popularIconWrap, { backgroundColor: service.color + '20' }]}>
                    <Ionicons name={service.icon as any} size={28} color={service.color} />
                  </View>
                  <ThemedText style={[styles.popularName, { color: theme.text }]}>{service.name}</ThemedText>
                  <ThemedText style={[styles.popularPrice, { color: theme.secondary }]}>{service.price}</ThemedText>
                  <View style={styles.popularRating}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <ThemedText style={[styles.popularRatingText, { color: theme.text }]}>{service.rating}</ThemedText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Recommended For You - Horizontal Scroll */}
          <View style={styles.horizontalSection}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>⭐ Recommended For You</ThemedText>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.horizontalScroll}
            >
              {[
                { id: 'carpenter', name: 'Carpenter', icon: 'hammer-outline', color: '#D0021B', route: '/carpenter', desc: 'Furniture & Repair', rating: '4.8' },
                { id: 'cook', name: 'Cook', icon: 'restaurant-outline', color: '#FFA07A', route: '/cook', desc: 'Home Cooking', rating: '4.9' },
                { id: 'driver', name: 'Driver', icon: 'car-sport-outline', color: '#98D8C8', route: '/driver', desc: 'Personal Driver', rating: '4.7' },
                { id: 'gardener', name: 'Gardener', icon: 'leaf-outline', color: '#45B7D1', route: '/gardener', desc: 'Garden Care', rating: '4.6' },
                { id: 'technician', name: 'Technician', icon: 'settings-outline', color: '#BB8FCE', route: '/technician', desc: 'Tech Support', rating: '4.8' },
              ].map((service) => (
                <Pressable 
                  key={service.id} 
                  style={[styles.recommendedCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => router.replace(service.route as any)}
                >
                  <View style={[styles.recommendedIconWrap, { backgroundColor: service.color }]}>
                    <Ionicons name={service.icon as any} size={24} color="#fff" />
                  </View>
                  <View style={styles.recommendedInfo}>
                    <ThemedText style={[styles.recommendedName, { color: theme.text }]}>{service.name}</ThemedText>
                    <ThemedText style={[styles.recommendedDesc, { color: theme.secondary }]}>{service.desc}</ThemedText>
                  </View>
                  <View style={styles.recommendedRating}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <ThemedText style={styles.recommendedRatingText}>{service.rating}</ThemedText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          
          {/* Bottom spacing for nav */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
      <BottomNav />
      <ProfileSheet
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        onEditProfile={() => {
          setProfileOpen(false);
          router.push('/profile');
        }}
        name={user?.firstName || user?.username || undefined}
        email={user?.email || undefined}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    backgroundColor: '#4A90E2',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 15,
    paddingBottom: 20,
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  profileLogo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    resizeMode: 'cover',
  },
  locationWrap: {
    flex: 1,
    height: 36,
    backgroundColor: '#FF7A2C',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: 20,
    position: 'relative',
  },
  locationIcon: {
    marginRight: 8,
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  locationDropdown: {
    position: 'absolute',
    top: 50,
    left: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
    minWidth: 120,
    alignSelf: 'flex-start',
  },
  locationOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedLocationOption: {
    backgroundColor: '#FFF3E0',
  },
  locationOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectedLocationOptionText: {
    color: '#FF7A2C',
    fontWeight: '600',
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  searchBoxIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  searchResults: {
    maxHeight: 300,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  searchResultCategory: {
    fontSize: 14,
    color: '#666',
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginRight: 8,
  },
  bellWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  content: { flex: 1, paddingTop: 14 },
  welcome: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 16, paddingHorizontal: 12 },
  
  // Horizontal sections
  horizontalSection: { marginBottom: 20 },
  horizontalScroll: { paddingHorizontal: 12, gap: 12 },
  
  // Popular cards
  popularCard: {
    width: 140,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  popularIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  popularName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  popularPrice: { fontSize: 12, marginBottom: 6 },
  popularRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  popularRatingText: { fontSize: 12, fontWeight: '500' },
  
  // Recommended cards
  recommendedCard: {
    width: 200,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  recommendedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  recommendedInfo: { flex: 1 },
  recommendedName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  recommendedDesc: { fontSize: 12 },
  recommendedRating: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 2,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  recommendedRatingText: { fontSize: 11, fontWeight: '600', color: '#F59E0B' },
  
  servicesSection: { width: '100%', alignItems: 'flex-start', paddingHorizontal: 12 },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    width: '100%', 
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  viewAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
  servicesGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    width: '100%',
  },
  serviceCard: { 
    width: '22%', 
    aspectRatio: 0.8,
    alignItems: 'center', 
    marginBottom: 16,
    borderRadius: 12,
    padding: 8,
  },
  serviceIcon: { 
    width: '100%', 
    flex: 1, 
    backgroundColor: '#F8F9FA', 
    borderRadius: 12, 
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceLabel: { 
    fontSize: 12, 
    textAlign: 'center', 
    lineHeight: 14,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});


