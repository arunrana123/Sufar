import { SafeAreaView as RNSafeAreaView, StyleSheet, View, Pressable, ScrollView, Platform, TextInput, Modal, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import BottomNav from '@/components/BottomNav';
import ServiceCard from '@/components/ServiceCard';
import { getServicesByCategory, getCategoryInfo, getServicesByCategoryFromAPI } from '@/lib/services';
import { useState, useEffect } from 'react';
import type { Service } from '@/lib/services';

const CATEGORY_SLUG = 'technician';

export default function TechnicianScreen() {
  const { theme } = useTheme();
  
  const categoryInfo = getCategoryInfo(CATEGORY_SLUG);
  const fallbackServices = getServicesByCategory(CATEGORY_SLUG);
  const [allServices, setAllServices] = useState<Service[]>(fallbackServices);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServices, setFilteredServices] = useState<Service[]>(fallbackServices);

  useEffect(() => {
    getServicesByCategoryFromAPI(CATEGORY_SLUG).then((api) => {
      if (api.length > 0) setAllServices(api);
    });
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredServices(allServices);
    } else {
      setFilteredServices(allServices.filter(service =>
        service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (service.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      ));
    }
  }, [allServices, searchQuery]);

  const handleSearch = (query: string) => setSearchQuery(query);
  const clearSearch = () => { setSearchQuery(''); setSearchVisible(false); };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/home'); }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>Technician</ThemedText>
          <Pressable style={styles.searchBtn} onPress={() => setSearchVisible(true)}>
            <Ionicons name="search" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* ScrollView wrapping content */}
        <ScrollView 
          style={styles.scrollContainer} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Services List */}
          <View style={styles.content}>
            <View style={styles.servicesContainer}>
              {filteredServices.length > 0 ? (
                filteredServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                  />
                ))
              ) : (
                <View style={styles.noResultsContainer}>
                  <Ionicons name="search-outline" size={64} color={theme.icon} />
                  <ThemedText style={styles.noResultsText}>No services found</ThemedText>
                  <ThemedText style={styles.noResultsSubtext}>
                    Try searching with different keywords
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Search Modal */}
        <Modal
          visible={searchVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSearchVisible(false)}
        >
          <View style={[styles.searchModal, { backgroundColor: theme.background }]}>
            <RNSafeAreaView style={styles.searchSafe}>
              {/* Search Header */}
              <View style={[styles.searchHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => setSearchVisible(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <ThemedText style={[styles.searchTitle, { color: theme.text }]}>Search Services</ThemedText>
                <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
                  <ThemedText style={[styles.clearText, { color: theme.tint }]}>Clear</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Search Input */}
              <View style={[styles.searchInputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                <Ionicons name="search" size={20} color={theme.icon} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholderTextColor={theme.icon}
                  placeholder="Search technician services..."
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoFocus
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={clearSearch} style={styles.clearInputBtn}>
                    <Ionicons name="close-circle" size={20} color={theme.icon} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Results */}
              <ScrollView style={styles.searchResults} showsVerticalScrollIndicator={false}>
                <View style={styles.resultsContainer}>
                  {filteredServices.length > 0 ? (
                    filteredServices.map((service) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                      />
                    ))
                  ) : searchQuery.length > 0 ? (
                    <View style={styles.noResultsContainer}>
                      <Ionicons name="search-outline" size={64} color={theme.icon} />
                      <ThemedText style={styles.noResultsText}>No services found</ThemedText>
                      <ThemedText style={styles.noResultsSubtext}>
                        Try searching with different keywords
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={styles.searchHintContainer}>
                      <Ionicons name="search-outline" size={48} color={theme.icon} />
                      <ThemedText style={styles.searchHintText}>
                        Start typing to search for technician services
                      </ThemedText>
                    </View>
                  )}
                </View>
              </ScrollView>
            </RNSafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
      <BottomNav />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  safe: { 
    flex: 1 
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Extra space for bottom navigation
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
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
  searchBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  servicesContainer: {
    paddingVertical: 16,
  },
  // Search Modal Styles
  searchModal: {
    flex: 1,
  },
  searchSafe: {
    flex: 1,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 50,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 8,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  clearBtn: {
    padding: 8,
  },
  clearText: {
    fontSize: 16,
    fontWeight: '500',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearInputBtn: {
    padding: 4,
  },
  searchResults: {
    flex: 1,
  },
  resultsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  noResultsSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.5,
  },
  searchHintContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  searchHintText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.6,
  },
});
