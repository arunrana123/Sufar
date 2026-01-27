import { SafeAreaView, StyleSheet, View, Pressable, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import BottomNav from '@/components/BottomNav';

export default function MenuScreen() {
  const { theme } = useTheme();

  const menuItems = [
    {
      icon: 'person-outline',
      title: 'Profile',
      onPress: () => router.push('/profile'),
    },
    {
      icon: 'clipboard-outline',
      title: 'My Bookings',
      onPress: () => router.push('/my-bookings'),
    },
    {
      icon: 'settings-outline',
      title: 'Settings',
      onPress: () => router.push('/settings'),
    },
    {
      icon: 'notifications-outline',
      title: 'Notifications',
      onPress: () => router.push('/notifications'),
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>Menu</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {menuItems.map((item) => (
            <Pressable
              key={item.title}
              style={[
                styles.menuItem,
                (item as any).isSmall ? styles.smallMenuItem : null,
                { backgroundColor: theme.card, borderColor: theme.border }
              ]}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: theme.tint + '15' }]}>
                  <Ionicons 
                    name={item.icon as any} 
                    size={(item as any).isSmall ? 20 : 24} 
                    color={theme.tint} 
                  />
                </View>
                <ThemedText style={[styles.menuItemText, (item as any).isSmall && styles.smallMenuItemText]}>
                  {item.title}
                </ThemedText>
              </View>
              {!(item as any).isSmall && (
                <Ionicons name="chevron-forward" size={20} color={theme.icon + '60'} />
              )}
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
      <BottomNav />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  smallMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  smallMenuItemText: {
    fontSize: 14,
  },
});


