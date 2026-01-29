// WORKERS SCREEN - Browse available workers by service category
// Features: Worker list with profiles, ratings, availability status, navigate to worker-profile
import { StyleSheet, View, Pressable, ScrollView, Platform, StatusBar } from 'react-native';
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

const CATEGORY_SLUG = 'workers';

export default function WorkersScreen() {
  const { theme } = useTheme();
  
  const categoryInfo = getCategoryInfo(CATEGORY_SLUG);
  const fallbackServices = getServicesByCategory(CATEGORY_SLUG);
  const [services, setServices] = useState<Service[]>(fallbackServices);

  useEffect(() => {
    getServicesByCategoryFromAPI(CATEGORY_SLUG).then((api) => {
      if (api.length > 0) setServices(api);
    });
  }, []);

  const handleServicePress = (serviceId: string) => {
    // TODO: Navigate to service details or booking screen
    console.log('Service pressed:', serviceId);
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <Pressable onPress={() => router.replace('/home')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </Pressable>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>Workers</ThemedText>
          <Pressable style={styles.searchBtn}>
            <Ionicons name="search" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Services List */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.servicesContainer}>
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onPress={() => handleServicePress(service.id)}
              />
            ))}
          </View>
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 50,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
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
    flex: 1,
    paddingHorizontal: 20,
  },
  servicesContainer: {
    paddingVertical: 16,
  },
});