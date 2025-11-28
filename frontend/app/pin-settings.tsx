import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PINSetup from '@/components/PINSetup';
import PINVerification from '@/components/PINVerification';

export default function PINSettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  const [pinEnabled, setPinEnabled] = useState(false);
  const [showPINSetup, setShowPINSetup] = useState(false);
  const [showPINVerification, setShowPINVerification] = useState(false);
  const [action, setAction] = useState<'setup' | 'change' | 'disable'>('setup');

  useEffect(() => {
    checkPINStatus();
  }, []);

  const checkPINStatus = async () => {
    try {
      const enabled = await AsyncStorage.getItem('pin_enabled');
      setPinEnabled(enabled === 'true');
    } catch (error) {
      console.error('Error checking PIN status:', error);
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

  const handlePINSetupComplete = async () => {
    setShowPINSetup(false);
    await checkPINStatus();
    Alert.alert('Success', 'PIN has been set successfully!');
  };

  const handlePINVerificationSuccess = async () => {
    setShowPINVerification(false);
    
    if (action === 'change') {
      setAction('setup');
      setShowPINSetup(true);
    } else if (action === 'disable') {
      try {
        await AsyncStorage.removeItem('user_pin');
        await AsyncStorage.removeItem('pin_enabled');
        await checkPINStatus();
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
              await AsyncStorage.removeItem('user_pin');
              await AsyncStorage.removeItem('pin_enabled');
              await checkPINStatus();
              Alert.alert(
                'PIN Reset',
                'PIN has been reset. You can now set up a new PIN.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/home'),
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
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>PIN Security</ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
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
                <ThemedText style={styles.statusTitle}>
                  {pinEnabled ? 'PIN Security Enabled' : 'PIN Security Disabled'}
                </ThemedText>
                <ThemedText style={styles.statusSubtitle}>
                  {pinEnabled 
                    ? 'Your app is protected with a PIN'
                    : 'Add a PIN to secure your app'
                  }
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>PIN Settings</ThemedText>
          
          {!pinEnabled ? (
            <TouchableOpacity
              style={[styles.settingItem, { backgroundColor: theme.background, borderColor: theme.icon + '20' }]}
              onPress={handleSetupPIN}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconContainer, { backgroundColor: theme.tint + '15' }]}>
                  <Ionicons name="lock-closed-outline" size={22} color={theme.tint} />
                </View>
                <View style={styles.textContainer}>
                  <ThemedText style={styles.settingTitle}>Setup PIN</ThemedText>
                  <ThemedText style={styles.settingSubtitle}>Create a 6-digit PIN to secure your app</ThemedText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.icon + '60'} />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: theme.background, borderColor: theme.icon + '20' }]}
                onPress={handleChangePIN}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: theme.tint + '15' }]}>
                    <Ionicons name="key-outline" size={22} color={theme.tint} />
                  </View>
                  <View style={styles.textContainer}>
                    <ThemedText style={styles.settingTitle}>Change PIN</ThemedText>
                    <ThemedText style={styles.settingSubtitle}>Update your current PIN</ThemedText>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.icon + '60'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingItem, { backgroundColor: theme.background, borderColor: theme.icon + '20' }]}
                onPress={handleDisablePIN}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: '#FF4444' + '15' }]}>
                    <Ionicons name="lock-open-outline" size={22} color="#FF4444" />
                  </View>
                  <View style={styles.textContainer}>
                    <ThemedText style={[styles.settingTitle, { color: '#FF4444' }]}>Disable PIN</ThemedText>
                    <ThemedText style={styles.settingSubtitle}>Remove PIN security from your app</ThemedText>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.icon + '60'} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Security Information</ThemedText>
          
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={theme.tint} />
            <ThemedText style={styles.infoText}>
              Your PIN is stored securely on your device and is never shared with our servers.
            </ThemedText>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.tint} />
            <ThemedText style={styles.infoText}>
              After 3 failed attempts, the app will be locked for 30 seconds.
            </ThemedText>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="refresh-outline" size={20} color={theme.tint} />
            <ThemedText style={styles.infoText}>
              If you forget your PIN, you can reset it by logging out and logging back in.
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.6,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 144, 226, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.2)',
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
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    opacity: 0.6,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(74, 144, 226, 0.05)',
    borderRadius: 8,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
});
