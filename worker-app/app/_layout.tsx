import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import AuthScreen from '../screens/AuthScreen';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { pushNotificationService } from '../lib/PushNotificationService';
import GlobalBookingAlert from '../components/GlobalBookingAlert';
import GlobalDeliveryAlert from '../components/GlobalDeliveryAlert';
import GlobalReviewThankYou from '../components/GlobalReviewThankYou';
import SecurityGate from '../components/SecurityGate';

import { useColorScheme } from '@/hooks/use-color-scheme';

// Prevent auto-hiding splash screen
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors if already prevented
});

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAuth();
  const [splashCompleted, setSplashCompleted] = useState(false);
  const [securityPassed, setSecurityPassed] = useState(false);

  // Hide expo splash screen once component mounts
  useEffect(() => {
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
        console.log('✅ Expo splash screen hidden');
      } catch (error) {
        console.log('Splash screen already hidden or error:', error);
      }
    };
    
    // Hide splash screen after a short delay
    const timer = setTimeout(hideSplash, 100);
    return () => clearTimeout(timer);
  }, []);

  // Register for push notifications when app loads
  useEffect(() => {
    pushNotificationService.registerForPushNotifications().then((token) => {
      if (token) {
        console.log('✅ Push notifications registered for worker app:', token);
        // You can send this token to your backend to send push notifications
      }
    });
  }, []);

  // Emergency timeout: If stuck on loading for more than 5 seconds, force navigation
  useEffect(() => {
    if (isLoading) {
      const emergencyTimer = setTimeout(() => {
        console.log('⚠️ EMERGENCY: Loading took too long, forcing app to continue');
        setSplashCompleted(true);
      }, 5000);
      return () => clearTimeout(emergencyTimer);
    }
  }, [isLoading]);

  // Reset security gate when authentication changes
  useEffect(() => {
    if (!isAuthenticated) {
      setSecurityPassed(false);
    }
  }, [isAuthenticated]);

  // Always show splash screen first - no authentication checks
  if (!splashCompleted) {
    return (
      <AuthScreen 
        onSplashComplete={() => {
          setSplashCompleted(true);
        }} 
      />
    );
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7A2C" />
      </View>
    );
  }

  // After splash, show auth screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // If authenticated but security not passed, show security gate
  if (isAuthenticated && !securityPassed) {
    return <SecurityGate onSuccess={() => setSecurityPassed(true)} />;
  }

  // If authenticated and security passed, show main app
  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SafeAreaView style={{ flex: 1 }} edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']}>
          <View style={{ flex: 1 }}>
            <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="job-navigation" options={{ headerShown: false }} />
          <Stack.Screen name="document-verification" options={{ headerShown: false }} />
          <Stack.Screen name="uploaded-documents" options={{ headerShown: false }} />
          <Stack.Screen name="earnings" options={{ headerShown: false }} />
          <Stack.Screen name="rewards" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="security" options={{ headerShown: false }} />
          <Stack.Screen name="order-delivery-tracking" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            {/* Global booking alert - shows on ANY screen when new request arrives */}
            <GlobalBookingAlert />
            {/* Global delivery alert - shows on ANY screen when delivery is assigned */}
            <GlobalDeliveryAlert />
            {/* Thank you message when user submits rating and review */}
            <GlobalReviewThankYou />
          </View>
        </SafeAreaView>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
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
