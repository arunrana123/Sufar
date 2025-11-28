// WORKERS SCREEN - Browse available workers by service category
// Features: Worker list with profiles, ratings, availability status, navigate to worker-profile
import { SafeAreaView, StyleSheet, View, Pressable, ScrollView } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import BottomNav from '@/components/BottomNav';
import ServiceCard from '@/components/ServiceCard';
import { getServicesByCategory, getCategoryInfo } from '@/lib/services';

export default function WorkersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  const categoryInfo = getCategoryInfo('workers');
  const services = getServicesByCategory('workers');

  const handleServicePress = (serviceId: string) => {
    // TODO: Navigate to service details or booking screen
    console.log('Service pressed:', serviceId);
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.replace('/home')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Workers</ThemedText>
          <Pressable style={styles.searchBtn}>
            <Ionicons name="search" size={20} color={theme.text} />
            <ThemedText style={styles.searchText}>Search</ThemedText>
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
    backgroundColor: '#f5f5f5',
  },
  safe: { 
    flex: 1 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  searchText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  servicesContainer: {
    paddingVertical: 16,
  },
});