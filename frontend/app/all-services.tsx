import { SafeAreaView, StyleSheet, View, Pressable } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import BottomNav from '@/components/BottomNav';

export default function AllServicesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // All available services
  const allServices = [
    { id: 'plumber', name: 'Plumber', icon: 'build-outline', color: '#4A90E2', route: '/plumber' as const },
    { id: 'electrician', name: 'Electrician', icon: 'flash-outline', color: '#F5A623', route: '/electrician' as const },
    { id: 'mechanic', name: 'Mechanic', icon: 'car-outline', color: '#7ED321', route: '/mechanic' as const },
    { id: 'ac-repair', name: 'Freez/AC repair', icon: 'snow-outline', color: '#50E3C2', route: '/ac-repair' as const },
    { id: 'workers', name: 'Workers', icon: 'people-outline', color: '#BD10E0', route: '/workers' as const },
    { id: 'carpenter', name: 'Carpenter', icon: 'hammer-outline', color: '#D0021B', route: '/carpenter' as const },
    { id: 'mason', name: 'Mason', icon: 'home-outline', color: '#9013FE', route: '/mason' as const },
    { id: 'painter', name: 'Painter', icon: 'brush-outline', color: '#FF6B6B', route: '/painter' as const },
    { id: 'cleaner', name: 'Cleaner', icon: 'sparkles-outline', color: '#4ECDC4', route: '/cleaner' as const },
    { id: 'gardener', name: 'Gardener', icon: 'leaf-outline', color: '#45B7D1', route: '/gardener' as const },
    { id: 'cook', name: 'Cook', icon: 'restaurant-outline', color: '#FFA07A', route: '/cook' as const },
    { id: 'driver', name: 'Driver', icon: 'car-sport-outline', color: '#98D8C8', route: '/driver' as const },
    { id: 'security', name: 'Security', icon: 'shield-outline', color: '#F7DC6F', route: '/security' as const },
    { id: 'technician', name: 'Technician', icon: 'settings-outline', color: '#BB8FCE', route: '/technician' as const },
    { id: 'delivery', name: 'Delivery', icon: 'bicycle-outline', color: '#85C1E9', route: '/delivery' as const },
    { id: 'beautician', name: 'Beautician', icon: 'flower-outline', color: '#F8C471', route: '/beautician' as const },
  ];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <Pressable onPress={() => router.replace('/home')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </Pressable>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>All Services</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.content}>
          <ThemedText style={styles.subtitle}>Choose from our wide range of professional services</ThemedText>
          
          <View style={styles.servicesGrid}>
            {allServices.map((service) => (
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
      </SafeAreaView>
      <BottomNav />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
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
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: { 
    flex: 1, 
    paddingHorizontal: 12, 
    paddingTop: 20,
    alignItems: 'center' 
  },
  subtitle: { 
    fontSize: 16, 
    color: '#666', 
    marginBottom: 24,
    textAlign: 'center'
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
});
