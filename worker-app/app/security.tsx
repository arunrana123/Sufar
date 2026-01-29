import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import PINSetup from '@/components/PINSetup';
import PINVerification from '@/components/PINVerification';
import { BiometricAuth } from '@/lib/BiometricAuth';

export default function SecurityScreen() {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [showPINSetup, setShowPINSetup] = useState(false);
  const [showPINVerification, setShowPINVerification] = useState(false);
  const [action, setAction] = useState<'setup' | 'change' | 'disable'>('setup');

  useEffect(() => {
    checkSecurityStatus();
  }, []);

  const checkSecurityStatus = async () => {
    try {
      const pinStatus = await AsyncStorage.getItem('worker_pin_enabled');
      setPinEnabled(pinStatus === 'true');
      
      const biometricStatus = await AsyncStorage.getItem('worker_biometricEnabled');
      setBiometricEnabled(biometricStatus === 'true');
      
      const available = await BiometricAuth.isAvailable();
      setBiometricAvailable(available);
      
      if (available) {
        const type = await BiometricAuth.getBiometricType();
        setBiometricType(type);
      }
    } catch (error) {
      console.error('Error checking security status:', error);
    }
  };

  const handleSetupPIN = () => {
    setAction('setup');
    setShowPINSetup(true);
  };

  const handleChangePIN = () => {
    setAction('change');
    setShowPINVerification(true);
  };

  const handleDisablePIN = () => {
    Alert.alert(
      'Disable PIN',
      'Are you sure you want to disable PIN security? This will make your app less secure.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: () => {
            setAction('disable');
            setShowPINVerification(true);
          },
        },
      ]
    );
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value && !biometricAvailable) {
      Alert.alert(
        'Face ID / Biometric Not Set Up',
        'Please set up Face ID (or fingerprint) in your device Settings first, then try again.',
      );
      return;
    }

    if (value) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) {
          Alert.alert(
            'Face ID / Biometric Not Set Up',
            'Please set up Face ID (or fingerprint) in your device Settings first, then try again.',
          );
          return;
        }
        const type = await BiometricAuth.getBiometricType();
        const promptMessage = type === 'Face ID'
          ? 'Register Face ID - Look at your device to enable Face ID unlock'
          : 'Register Biometric - Use your fingerprint to enable unlock';
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage,
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: false,
          cancelLabel: 'Cancel',
        });
        if (authResult.success) {
          await AsyncStorage.setItem('worker_biometricEnabled', 'true');
          setBiometricEnabled(true);
          Alert.alert('Success', type === 'Face ID' ? 'Face ID registered. You can now unlock the app with Face ID.' : 'Biometric registered. You can now unlock the app.');
        } else {
          const err = (authResult as { error?: string }).error;
          if (err === 'user_cancel' || err === 'user_fallback' || err === 'app_cancel' || err === 'system_cancel') {
            Alert.alert('Cancelled', 'Registration was cancelled. Turn the switch on again to enable Face ID / biometric unlock.');
          } else if (err === 'not_enrolled' || err === 'passcode_not_set') {
            Alert.alert('Set Up Required', 'Please set up Face ID (or fingerprint) and device passcode in Settings > Face ID & Passcode (or Touch ID & Passcode), then try again.');
          } else {
            Alert.alert('Registration Failed', err || 'Face ID / biometric authentication failed. Please try again.');
          }
        }
      } catch (error: unknown) {
        console.error('Biometric registration error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Error', `Failed to register Face ID / biometric. ${message} Please try again.`);
      }
      return;
    }

    try {
      await AsyncStorage.setItem('worker_biometricEnabled', 'false');
      setBiometricEnabled(false);
      Alert.alert('Success', 'Face ID / biometric authentication disabled');
    } catch (error) {
      console.error('Error toggling biometric:', error);
      Alert.alert('Error', 'Failed to update biometric setting');
    }
  };

  const handlePINSetupComplete = async () => {
    setShowPINSetup(false);
    await checkSecurityStatus();
    Alert.alert('Success', 'PIN has been set successfully!');
  };

  const handlePINVerificationSuccess = async () => {
    setShowPINVerification(false);
    
    if (action === 'change') {
      setAction('setup');
      setShowPINSetup(true);
    } else if (action === 'disable') {
      try {
        await AsyncStorage.removeItem('worker_pin');
        await AsyncStorage.removeItem('worker_pin_enabled');
        await checkSecurityStatus();
        Alert.alert('Success', 'PIN has been disabled successfully!');
      } catch (error) {
        console.error('Error disabling PIN:', error);
        Alert.alert('Error', 'Failed to disable PIN. Please try again.');
      }
    }
  };

  const handleForgotPIN = () => {
    Alert.alert(
      'Forgot PIN?',
      'To reset your PIN, you will need to log out and log back in. This will disable PIN security and you can set it up again.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset PIN',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('worker_pin');
              await AsyncStorage.removeItem('worker_pin_enabled');
              await checkSecurityStatus();
              Alert.alert(
                'PIN Reset',
                'PIN has been reset. You can now set up a new PIN.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error) {
              console.error('Error resetting PIN:', error);
              Alert.alert('Error', 'Failed to reset PIN. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (showPINSetup) {
    return (
      <PINSetup
        onComplete={handlePINSetupComplete}
        onCancel={() => setShowPINSetup(false)}
      />
    );
  }

  if (showPINVerification) {
    return (
      <PINVerification
        onSuccess={handlePINVerificationSuccess}
        onForgotPIN={handleForgotPIN}
      />
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Security</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* PIN Security Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PIN Security</Text>
            
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View style={[styles.statusIcon, { backgroundColor: pinEnabled ? '#4CAF50' : '#FF9800' }]}>
                  <Ionicons 
                    name={pinEnabled ? "shield-checkmark" : "shield-outline"} 
                    size={24} 
                    color="#fff" 
                  />
                </View>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusTitle}>
                    {pinEnabled ? 'PIN Security Enabled' : 'PIN Security Disabled'}
                  </Text>
                  <Text style={styles.statusSubtitle}>
                    {pinEnabled 
                      ? 'Your app is protected with a PIN'
                      : 'Add a PIN to secure your app'
                    }
                  </Text>
                </View>
              </View>
            </View>

            {!pinEnabled ? (
              <TouchableOpacity
                style={styles.settingItem}
                onPress={handleSetupPIN}
              >
                <View style={styles.settingLeft}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="lock-closed-outline" size={22} color="#FF7A2C" />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.settingTitle}>Setup PIN</Text>
                    <Text style={styles.settingSubtitle}>Create a 6-digit PIN to secure your app</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleChangePIN}
                >
                  <View style={styles.settingLeft}>
                    <View style={styles.iconContainer}>
                      <Ionicons name="key-outline" size={22} color="#FF7A2C" />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.settingTitle}>Change PIN</Text>
                      <Text style={styles.settingSubtitle}>Update your current PIN</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleDisablePIN}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 68, 68, 0.1)' }]}>
                      <Ionicons name="lock-open-outline" size={22} color="#FF4444" />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={[styles.settingTitle, { color: '#FF4444' }]}>Disable PIN</Text>
                      <Text style={styles.settingSubtitle}>Remove PIN security from your app</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Biometric Security Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Biometric Security</Text>
            
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View style={[styles.statusIcon, { backgroundColor: biometricEnabled ? '#4CAF50' : '#FF9800' }]}>
                  <Ionicons 
                    name={biometricEnabled ? "finger-print" : "finger-print-outline"} 
                    size={24} 
                    color="#fff" 
                  />
                </View>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusTitle}>
                    {biometricEnabled ? `${biometricType} Enabled` : `${biometricType || 'Biometric'} Disabled`}
                  </Text>
                  <Text style={styles.statusSubtitle}>
                    {biometricAvailable
                      ? biometricEnabled
                        ? (biometricType === 'Face ID' ? 'Face ID registered - Unlock with Face ID' : `Use ${biometricType} to unlock your app`)
                        : (biometricType === 'Face ID' ? 'Register Face ID to unlock the app' : `Enable ${biometricType} for quick access`)
                      : 'Set up Face ID / fingerprint in device Settings first'
                    }
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons 
                    name={biometricType === 'Face ID' ? "face-recognition-outline" : "finger-print-outline"} 
                    size={22} 
                    color="#FF7A2C" 
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>
                    {biometricType || 'Biometric'} Authentication
                  </Text>
                  <Text style={styles.settingSubtitle}>
                    {biometricAvailable
                      ? `Use ${biometricType || 'biometric'} to unlock your app`
                      : 'Not available on this device'
                    }
                  </Text>
                </View>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: '#E0E0E0', true: '#FFE5CC' }}
                thumbColor={biometricEnabled ? '#FF7A2C' : '#f4f3f4'}
                disabled={!biometricAvailable}
              />
            </View>
          </View>

          {/* Security Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security Information</Text>
            
            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={20} color="#FF7A2C" />
              <Text style={styles.infoText}>
                Your PIN is stored securely on your device and is never shared with our servers.
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#FF7A2C" />
              <Text style={styles.infoText}>
                After 3 failed attempts, the app will be locked for 30 seconds.
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="refresh-outline" size={20} color="#FF7A2C" />
              <Text style={styles.infoText}>
                If you forget your PIN, you can reset it by logging out and logging back in.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safe: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FF7A2C',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 122, 44, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 122, 44, 0.05)',
    borderRadius: 8,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
});
