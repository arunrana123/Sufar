import { SafeAreaView, StyleSheet, View, Pressable, ScrollView, Platform, TextInput, Modal, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import BottomNav from '@/components/BottomNav';
import ServiceCard from '@/components/ServiceCard';
import { getServicesByCategory, getCategoryInfo } from '@/lib/services';
import { useState, useMemo } from 'react';

export default function BeauticianScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  const categoryInfo = getCategoryInfo('beautician');
  const allServices = getServicesByCategory('beautician');
  
  // Search state
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServices, setFilteredServices] = useState(allServices);

  // Filter services based on search query
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredServices(allServices);
    } else {
      const filtered = allServices.filter(service =>
        service.title.toLowerCase().includes(query.toLowerCase()) ||
        service.description?.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredServices(filtered);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredServices(allServices);
    setSearchVisible(false);
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        {/* ScrollView wrapping all content */}
        <ScrollView 
          style={styles.scrollContainer} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.replace('/home')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <View style={styles.headerCenter}>
              <Ionicons name="flower-outline" size={24} color="#fff" style={styles.headerIcon} />
              <ThemedText style={styles.headerTitle}>Beautician</ThemedText>
            </View>
            <Pressable style={styles.searchBtn} onPress={() => setSearchVisible(true)}>
              <Ionicons name="search" size={20} color="#fff" />
              <ThemedText style={styles.searchText}>Search</ThemedText>
            </Pressable>
          </View>

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
                  <Ionicons name="search-outline" size={64} color="#ccc" />
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
          <View style={styles.searchModal}>
            <SafeAreaView style={styles.searchSafe}>
              {/* Search Header */}
              <View style={styles.searchHeader}>
                <TouchableOpacity onPress={() => setSearchVisible(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
                <ThemedText style={styles.searchTitle}>Search Services</ThemedText>
                <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
                  <ThemedText style={styles.clearText}>Clear</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Search Input */}
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search beautician services..."
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoFocus
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={clearSearch} style={styles.clearInputBtn}>
                    <Ionicons name="close-circle" size={20} color="#666" />
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
                      <Ionicons name="search-outline" size={64} color="#ccc" />
                      <ThemedText style={styles.noResultsText}>No services found</ThemedText>
                      <ThemedText style={styles.noResultsSubtext}>
                        Try searching with different keywords
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={styles.searchHintContainer}>
                      <Ionicons name="search-outline" size={48} color="#ccc" />
                      <ThemedText style={styles.searchHintText}>
                        Start typing to search for beautician services
                      </ThemedText>
                    </View>
                  )}
                </View>
              </ScrollView>
            </SafeAreaView>
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
    backgroundColor: '#f5f5f5',
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
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
    backgroundColor: '#3B82F6', // Highlighted blue background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backBtn: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  searchText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  servicesContainer: {
    paddingVertical: 16,
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
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Search Modal Styles
  searchModal: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeBtn: {
    padding: 8,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  clearBtn: {
    padding: 8,
  },
  clearText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '500',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
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
  searchHintContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  searchHintText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});
