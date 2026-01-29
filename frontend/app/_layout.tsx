import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { CartProvider } from '../contexts/CartContext';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import GlobalNotificationHandler from '../components/GlobalNotificationHandler';
import { pushNotificationService } from '../lib/PushNotificationService';

// Prevent auto-hiding splash screen
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors if already prevented
});

function RootLayoutNav() {
  const { colorScheme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Hide expo splash screen once fonts are loaded
  useEffect(() => {
    const hideSplash = async () => {
      if (loaded) {
        try {
          await SplashScreen.hideAsync();
          console.log('✅ Expo splash screen hidden');
        } catch (error) {
          console.log('Splash screen already hidden or error:', error);
        }
      }
    };
    
    hideSplash();
  }, [loaded]);

  // Register for push notifications when app loads
  useEffect(() => {
    pushNotificationService.registerForPushNotifications().then((token) => {
      if (token) {
        console.log('✅ Push notifications registered for user app:', token);
        // You can send this token to your backend to send push notifications
      }
    });
  }, []);

  // Emergency timeout: If stuck on loading for more than 5 seconds, force to index
  useEffect(() => {
    if (loaded && isLoading) {
      const emergencyTimer = setTimeout(() => {
        console.log('⚠️ EMERGENCY: Loading took too long, check AsyncStorage or network');
      }, 5000);
      return () => clearTimeout(emergencyTimer);
    }
  }, [loaded, isLoading]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#AEDAFF" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SafeAreaView style={{ flex: 1 }} edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']}>
          <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signin" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="forgot" options={{ headerShown: false }} />
        <Stack.Screen name="verify-otp" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="add-service" options={{ headerShown: false }} />
        <Stack.Screen name="qr-scanner" options={{ headerShown: false }} />
        <Stack.Screen name="pin-settings" options={{ headerShown: false }} />
        <Stack.Screen name="plumber" options={{ headerShown: false }} />
        <Stack.Screen name="electrician" options={{ headerShown: false }} />
        <Stack.Screen name="mechanic" options={{ headerShown: false }} />
        <Stack.Screen name="ac-repair" options={{ headerShown: false }} />
        <Stack.Screen name="workers" options={{ headerShown: false }} />
        <Stack.Screen name="carpenter" options={{ headerShown: false }} />
        <Stack.Screen name="mason" options={{ headerShown: false }} />
        <Stack.Screen name="painter" options={{ headerShown: false }} />
        <Stack.Screen name="cleaner" options={{ headerShown: false }} />
        <Stack.Screen name="gardener" options={{ headerShown: false }} />
        <Stack.Screen name="cook" options={{ headerShown: false }} />
        <Stack.Screen name="driver" options={{ headerShown: false }} />
        <Stack.Screen name="security" options={{ headerShown: false }} />
        <Stack.Screen name="technician" options={{ headerShown: false }} />
        <Stack.Screen name="delivery" options={{ headerShown: false }} />
        <Stack.Screen name="beautician" options={{ headerShown: false }} />
        <Stack.Screen name="all-services" options={{ headerShown: false }} />
        <Stack.Screen name="services" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="record" options={{ headerShown: false }} />
        <Stack.Screen name="tracking" options={{ headerShown: false }} />
        <Stack.Screen name="menu" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="book-service" options={{ headerShown: false }} />
        <Stack.Screen name="my-bookings" options={{ headerShown: false }} />
        <Stack.Screen name="live-tracking" options={{ headerShown: false }} />
        <Stack.Screen name="payment" options={{ headerShown: false }} />
        <Stack.Screen name="review" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="search-services" options={{ headerShown: false }} />
        <Stack.Screen name="optimized-home" options={{ headerShown: false }} />
        <Stack.Screen name="market" options={{ headerShown: false }} />
        <Stack.Screen name="market-wholesale" options={{ headerShown: false }} />
        <Stack.Screen name="market-furniture" options={{ headerShown: false }} />
        <Stack.Screen name="market-hardware" options={{ headerShown: false }} />
        <Stack.Screen name="market-farm" options={{ headerShown: false }} />
        <Stack.Screen name="market-product" options={{ headerShown: false }} />
        <Stack.Screen name="cart" options={{ headerShown: false }} />
        <Stack.Screen name="select-address" options={{ headerShown: false }} />
        <Stack.Screen name="checkout" options={{ headerShown: false }} />
        <Stack.Screen name="payment-process" options={{ headerShown: false }} />
        <Stack.Screen name="order-tracking" options={{ headerShown: false }} />
        <Stack.Screen name="order-review" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
          </Stack>
          {/* Global notification handler - shows floating toasts on all screens */}
          <GlobalNotificationHandler />
          <StatusBar style="auto" />
        </SafeAreaView>
      </NavigationThemeProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <RootLayoutNav />
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
