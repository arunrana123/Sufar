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
import { useState, useEffect, useCallback } from 'react';

export default function HomeScreen() {
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
  const { user } = useAuth();

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
  }, [user?.profilePhoto]);

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
    }, [])
  );

  const locations = ['Kathmandu', 'Kanchanpur', 'Kailali'];

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
        <View style={styles.header}>
          <View style={styles.profileLogo}>
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
          </View>
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
            <View style={styles.locationDropdown}>
              {locations.map((location) => (
                <Pressable
                  key={location}
                  style={[
                    styles.locationOption,
                    selectedLocation === location && styles.selectedLocationOption
                  ]}
                  onPress={() => {
                    setSelectedLocation(location);
                    setShowLocationDropdown(false);
                  }}
                >
                  <ThemedText style={[
                    styles.locationOptionText,
                    selectedLocation === location && styles.selectedLocationOptionText
                  ]}>
                    {location}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable style={styles.searchButton} onPress={() => router.push('/search-services')}>
            <Ionicons name="search" size={18} color="#000" />
          </Pressable>
          <Pressable style={styles.bellWrap} onPress={() => router.replace('/notifications')}>
            <Ionicons name="notifications-outline" size={18} color="#0a7ea4" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <ThemedText style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount.toString()}
                </ThemedText>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search Box */}
        {showSearchBox && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchBoxIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search services..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus={true}
              />
              <Pressable onPress={clearSearch} style={styles.clearButton}>
                <Ionicons name="close" size={20} color="#666" />
              </Pressable>
            </View>
            
            {/* Search Results */}
            {searchQuery.trim() !== '' && (
              <ScrollView style={styles.searchResults} showsVerticalScrollIndicator={false}>
                {searchResults.length > 0 ? (
                  searchResults.map((service) => (
                    <Pressable
                      key={service.id}
                      style={styles.searchResultItem}
                      onPress={() => {
                        router.replace(service.route);
                        clearSearch();
                      }}
                    >
                      <View style={styles.searchResultIcon}>
                        <Ionicons name={service.icon as any} size={24} color={service.color} />
                      </View>
                      <View style={styles.searchResultText}>
                        <ThemedText style={styles.searchResultName}>{service.name}</ThemedText>
                        <ThemedText style={styles.searchResultCategory}>{service.category}</ThemedText>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <View style={styles.noResults}>
                    <Ionicons name="search-outline" size={48} color="#ccc" />
                    <ThemedText style={styles.noResultsText}>Service not available</ThemedText>
                    <ThemedText style={styles.noResultsSubtext}>Try searching with different keywords</ThemedText>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.content}>
          <ThemedText style={styles.welcome}>Welcome to our Service Hub</ThemedText>
          
          <View style={styles.servicesSection}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Available services</ThemedText>
              <Pressable 
                style={styles.viewAllBtn} 
                onPress={() => router.replace('/all-services')}
              >
                <ThemedText style={styles.viewAllText}>View All</ThemedText>
              </Pressable>
            </View>
            
            <View style={styles.servicesGrid}>
              {displayedServices.map((service) => (
                <Pressable 
                  key={service.id} 
                  style={styles.serviceCard} 
                  onPress={() => router.replace(service.route)}
                >
                  <View style={styles.serviceIcon}>
                    <Ionicons name={service.icon as any} size={32} color={service.color} />
                  </View>
                  <ThemedText style={styles.serviceLabel}>{service.name}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
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
  content: { paddingHorizontal: 12, paddingTop: 14, alignItems: 'center' },
  welcome: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  servicesSection: { width: '100%', alignItems: 'flex-start' },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    width: '100%', 
    marginBottom: 16 
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


