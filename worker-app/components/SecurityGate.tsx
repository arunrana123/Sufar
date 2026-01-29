import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PINVerification from './PINVerification';
import { BiometricAuth } from '@/lib/BiometricAuth';

interface SecurityGateProps {
  onSuccess: () => void;
}

export default function SecurityGate({ onSuccess }: SecurityGateProps) {
  const [checking, setChecking] = useState(true);
  const [showPIN, setShowPIN] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    checkSecurity();
  }, []);

  const checkSecurity = async () => {
    try {
      const pinStatus = await AsyncStorage.getItem('worker_pin_enabled');
      const biometricStatus = await AsyncStorage.getItem('worker_biometricEnabled');
      
      const hasPIN = pinStatus === 'true';
      const hasBiometric = biometricStatus === 'true';
      
      setPinEnabled(hasPIN);
      setBiometricEnabled(hasBiometric);
      
      if (!hasPIN && !hasBiometric) {
        // No security enabled, proceed directly
        onSuccess();
        return;
      }
      
      // Try biometric first if enabled
      if (hasBiometric) {
        const available = await BiometricAuth.isAvailable();
        if (available) {
          const result = await BiometricAuth.authenticate();
          if (result.success) {
            // Biometric success, proceed
            onSuccess();
            return;
          } else {
            // Biometric failed, show PIN if enabled, otherwise show error
            if (hasPIN) {
              setChecking(false);
              setShowPIN(true);
            } else {
              Alert.alert(
                'Biometric Authentication',
                'Biometric authentication failed. Please try again.',
                [
                  {
                    text: 'Try Again',
                    onPress: () => checkSecurity(),
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => {
                      // Could navigate to login or show error
                      Alert.alert('Error', 'Authentication required to access the app.');
                    },
                  },
                ]
              );
            }
            return;
          }
        } else {
          // Biometric not available, use PIN if enabled
          if (hasPIN) {
            setChecking(false);
            setShowPIN(true);
          } else {
            // No security available, proceed
            onSuccess();
          }
          return;
        }
      }
      
      // Only PIN enabled
      if (hasPIN) {
        setChecking(false);
        setShowPIN(true);
      } else {
        onSuccess();
      }
    } catch (error) {
      console.error('Error checking security:', error);
      // On error: if PIN is enabled show PIN screen; otherwise fail open
      try {
        const pinStatus = await AsyncStorage.getItem('worker_pin_enabled');
        if (pinStatus === 'true') {
          setPinEnabled(true);
          setShowPIN(true);
        } else {
          onSuccess();
        }
      } catch (e2) {
        onSuccess();
      }
    } finally {
      setChecking(false);
    }
  };

  const handlePINSuccess = () => {
    setShowPIN(false);
    onSuccess();
  };

  const handleForgotPIN = () => {
    Alert.alert(
      'Forgot PIN?',
      'To reset your PIN, you will need to log out and log back in. This will disable PIN security.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            // Clear auth and PIN
            await AsyncStorage.removeItem('worker_pin');
            await AsyncStorage.removeItem('worker_pin_enabled');
            // Navigate to login (this will be handled by parent)
            Alert.alert('PIN Reset', 'Please log in again to reset your PIN.');
          },
        },
      ]
    );
  };

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF7A2C" />
        <Text style={styles.loadingText}>Checking security...</Text>
      </View>
    );
  }

  if (showPIN) {
    return (
      <PINVerification
        onSuccess={handlePINSuccess}
        onForgotPIN={handleForgotPIN}
      />
    );
  }

  // Should not reach here, but just in case
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
