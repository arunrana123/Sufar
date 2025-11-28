// INDEX SCREEN - App entry point with splash, welcome screen, and biometric auth
// Flow: Splash → Welcome (first-time) → Biometric/Login
import { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashScreen from '@/components/SplashScreen';
import WelcomeScreen from '@/components/WelcomeScreen';
import { BiometricAuth } from '@/lib/BiometricAuth';
import { useTheme } from '@/contexts/ThemeContext';

export default function Index() {
  const { theme } = useTheme();
  const [splashCompleted, setSplashCompleted] = useState(false);
  const [welcomeCompleted, setWelcomeCompleted] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);

  const handleSplashComplete = async () => {
    setSplashCompleted(true);
    // Check if user has seen welcome screen before
    const hasSeenWelcome = await AsyncStorage.getItem('hasSeenWelcome');
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    } else {
      setWelcomeCompleted(true);
    }
  };

  const handleWelcomeComplete = async () => {
    // Mark welcome screen as seen
    await AsyncStorage.setItem('hasSeenWelcome', 'true');
    setShowWelcome(false);
    setWelcomeCompleted(true);
  };

  useEffect(() => {
    if (splashCompleted && welcomeCompleted && !biometricChecked) {
      checkBiometricAuth();
    }
  }, [splashCompleted, welcomeCompleted, biometricChecked]);

  const checkBiometricAuth = async () => {
    try {
      const isEnabled = await BiometricAuth.isEnabled();
      if (isEnabled) {
        const result = await BiometricAuth.authenticate();
        if (result.success) {
          // Biometric authentication successful, go to home
          router.replace('/home');
        } else {
          // Biometric failed, show options
          Alert.alert(
            'Biometric Authentication',
            'Biometric authentication failed. Would you like to try again or use password login?',
            [
              {
                text: 'Try Again',
                onPress: () => checkBiometricAuth(),
              },
              {
                text: 'Use Password',
                onPress: () => router.replace('/login'),
              },
            ]
          );
        }
      } else {
        // Biometric not enabled, go to login
        router.replace('/login');
      }
    } catch (error) {
      console.error('Biometric check error:', error);
      // On error, go to login
      router.replace('/login');
    } finally {
      setBiometricChecked(true);
    }
  };

  // Always show splash screen first
  if (!splashCompleted) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Show welcome screen for first-time users
  if (showWelcome) {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />;
  }

  // Show loading while checking biometric or navigating
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.tint} />
      <Text style={[styles.loadingText, { color: theme.text }]}>
        {biometricChecked ? 'Loading...' : 'Checking biometric authentication...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.8,
  },
});


