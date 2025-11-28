// AUTH SCREEN - Manages authentication flow with splash, welcome, login, and signup
// Flow: Splash → Welcome (first-time) → Login/Signup
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashScreen from '../components/SplashScreen';
import WelcomeScreen from '../components/WelcomeScreen';
import LoginScreen from '../components/LoginScreen';
import SignupScreen from '../components/SignupScreen';
import { useAuth } from '../contexts/AuthContext';

type AuthScreenType = 'splash' | 'welcome' | 'login' | 'signup';

interface AuthScreenProps {
  onSplashComplete?: () => void;
}

export default function AuthScreen({ onSplashComplete }: AuthScreenProps = {}) {
  const [currentScreen, setCurrentScreen] = useState<AuthScreenType>('splash');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const { login, isAuthenticated } = useAuth();

  // Handles splash screen completion, checks if worker has seen welcome
  // Triggered by: Splash animation completes
  const handleSplashComplete = async () => {
    const hasSeenWelcome = await AsyncStorage.getItem('worker_hasSeenWelcome');
    if (!hasSeenWelcome) {
      setCurrentScreen('welcome');
    } else {
    setCurrentScreen('login');
    }
    if (onSplashComplete) {
      onSplashComplete();
    }
  };

  // Marks welcome screen as completed for worker
  // Triggered by: Worker taps "Start Earning" or "Skip" on welcome screen
  const handleWelcomeComplete = async () => {
    await AsyncStorage.setItem('worker_hasSeenWelcome', 'true');
    setCurrentScreen('login');
  };

  const handleLoginSuccess = async (workerData: any) => {
    try {
      await login(workerData);
      // Navigation will be handled automatically by _layout.tsx
      // when isAuthenticated becomes true
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Error', 'Failed to complete login. Please try again.');
    }
  };

  const handleSignupSuccess = (email?: string) => {
    // After successful signup, switch to login screen
    if (email) {
      setSignupEmail(email);
    }
    setCurrentScreen('login');
  };

  const switchToSignup = () => {
    setSignupEmail(''); // Clear any previously stored email
    setCurrentScreen('signup');
  };

  const switchToLogin = () => {
    setCurrentScreen('login');
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen onAnimationComplete={handleSplashComplete} />;
      case 'welcome':
        return <WelcomeScreen onComplete={handleWelcomeComplete} />;
      case 'login':
        return (
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onSwitchToSignup={switchToSignup}
            prefilledEmail={signupEmail}
          />
        );
      case 'signup':
        return (
          <SignupScreen
            onSignupSuccess={handleSignupSuccess}
            onSwitchToLogin={switchToLogin}
          />
        );
      default:
        return <SplashScreen onAnimationComplete={handleSplashComplete} />;
    }
  };

  return (
    <View style={styles.container}>
      {renderCurrentScreen()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
