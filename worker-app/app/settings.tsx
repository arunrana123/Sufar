// SETTINGS SCREEN - Worker app settings page
// Features: Profile settings, notification preferences, privacy settings, app preferences
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Vibration,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationService from '@/lib/LocationService';
import MockLocationService from '@/lib/MockLocationService';
import { notificationSoundService } from '@/lib/NotificationSoundService';
import { pushNotificationService } from '@/lib/PushNotificationService';
import { settingsService } from '@/lib/SettingsService';

export default function SettingsScreen() {
  const { worker } = useAuth();
  
  // Location services
  const locationService = LocationService.getInstance();
  const mockLocationService = MockLocationService.getInstance();
  
  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [bookingNotifications, setBookingNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [locationTracking, setLocationTracking] = useState(true);
  const [promotionalEmails, setPromotionalEmails] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [language, setLanguage] = useState('English');
  const [theme, setTheme] = useState('Light');

  // Load saved settings
  useEffect(() => {
    loadSettings();
    
    // Periodic refresh of location tracking status (every 5 seconds)
    const intervalId = setInterval(() => {
      if (worker?.id) {
        const isTracking = locationService.isLocationTracking() || mockLocationService.isLocationTracking();
        setLocationTracking(isTracking);
      }
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [worker?.id]);

  const loadSettings = async () => {
    try {
      if (!worker?.id) return;
      
      // Load from settings service
      const settings = await settingsService.loadSettings(worker.id);
      if (settings) {
        setNotificationsEnabled(settings.notificationsEnabled ?? true);
        setBookingNotifications(settings.bookingNotifications ?? true);
        setMessageNotifications(settings.messageNotifications ?? true);
        setSoundEnabled(settings.soundEnabled ?? true);
        setVibrationEnabled(settings.vibrationEnabled ?? true);
        setLocationTracking(settings.locationTracking ?? true);
        setAutoAccept(settings.autoAccept ?? false);
        setShowOnlineStatus(settings.showOnlineStatus ?? true);
        setLanguage(settings.language || 'English');
        setTheme(settings.theme || 'Light');
        setPromotionalEmails(settings.promotionalEmails ?? false);
      }
      
      // Check actual location tracking status
      const isTracking = locationService.isLocationTracking() || mockLocationService.isLocationTracking();
      setLocationTracking(isTracking);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (showAlert: boolean = false) => {
    try {
      const settings = {
        notificationsEnabled,
        bookingNotifications,
        messageNotifications,
        soundEnabled,
        vibrationEnabled,
        locationTracking,
        promotionalEmails,
        autoAccept,
        showOnlineStatus,
        language,
        theme,
      };
      await AsyncStorage.setItem(`worker_settings_${worker?.id}`, JSON.stringify(settings));
      
      // Clear settings cache so it reloads
      if (worker?.id) {
        settingsService.clearCache(worker.id);
      }
      
      // Also save to backend if worker ID exists
      if (worker?.id) {
        try {
          const apiUrl = getApiUrl();
          await fetch(`${apiUrl}/api/workers/${worker.id}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
          }).catch(err => console.warn('Failed to sync settings to backend:', err));
        } catch (err) {
          console.warn('Backend sync failed, settings saved locally:', err);
        }
      }
      
      if (showAlert) {
        Alert.alert('Success', 'Settings saved successfully');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      if (showAlert) {
        Alert.alert('Error', 'Failed to save settings');
      }
    }
  };

  // Auto-save when settings change
  useEffect(() => {
    if (worker?.id) {
      saveSettings(false); // Auto-save without alert
    }
  }, [
    notificationsEnabled,
    bookingNotifications,
    messageNotifications,
    soundEnabled,
    vibrationEnabled,
    locationTracking,
    promotionalEmails,
    autoAccept,
    showOnlineStatus,
    language,
    theme,
  ]);

  const handleSave = () => {
    saveSettings(true); // Show alert on manual save
  };

  // Handle notification settings changes
  const handleNotificationsToggle = (value: boolean) => {
    setNotificationsEnabled(value);
    if (!value) {
      // Disable all notification types when main toggle is off
      setBookingNotifications(false);
      setMessageNotifications(false);
      setSoundEnabled(false);
      setVibrationEnabled(false);
    }
  };

  // Handle location tracking toggle
  const handleLocationTrackingToggle = async (value: boolean) => {
    if (!worker?.id) {
      Alert.alert('Error', 'Worker information not available');
      return;
    }

    setLocationTracking(value);
    
    if (value) {
      // Start location tracking
      try {
        locationService.setWorkerId(worker.id);
        mockLocationService.setWorkerId(worker.id);
        
        let success = await locationService.startTracking();
        if (!success) {
          success = await mockLocationService.startTracking();
        }
        
        if (success) {
          // Update availability status to available
          await locationService.updateAvailabilityStatus('available', worker.id) ||
                 await mockLocationService.updateAvailabilityStatus('available', worker.id);
          Alert.alert('Success', 'Location tracking enabled');
        } else {
          setLocationTracking(false);
          Alert.alert('Error', 'Failed to start location tracking. Please check location permissions.');
        }
      } catch (error) {
        console.error('Error starting location tracking:', error);
        setLocationTracking(false);
        Alert.alert('Error', 'Failed to enable location tracking');
      }
    } else {
      // Stop location tracking
      try {
        locationService.stopTracking();
        mockLocationService.stopTracking();
        
        // Update availability status to busy
        await locationService.updateAvailabilityStatus('busy', worker.id) ||
               await mockLocationService.updateAvailabilityStatus('busy', worker.id);
        
        Alert.alert('Success', 'Location tracking disabled');
      } catch (error) {
        console.error('Error stopping location tracking:', error);
        Alert.alert('Error', 'Failed to disable location tracking');
      }
    }
  };

  // Handle sound toggle
  const handleSoundToggle = (value: boolean) => {
    setSoundEnabled(value);
    if (value) {
      // Test sound
      notificationSoundService.playNotificationSound('booking', 'new');
    }
  };

  // Handle vibration toggle
  const handleVibrationToggle = (value: boolean) => {
    setVibrationEnabled(value);
    if (value) {
      // Test vibration
      Vibration.vibrate(200);
    }
  };

  // Handle auto-accept toggle
  const handleAutoAcceptToggle = (value: boolean) => {
    setAutoAccept(value);
    if (value) {
      Alert.alert(
        'Auto Accept Enabled',
        'You will automatically accept all booking requests. You can disable this anytime.',
        [{ text: 'OK' }]
      );
    }
  };

  // Handle show online status toggle
  const handleShowOnlineStatusToggle = async (value: boolean) => {
    if (!worker?.id) {
      Alert.alert('Error', 'Worker information not available');
      return;
    }

    setShowOnlineStatus(value);
    
    // Update visibility in backend
    try {
      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/api/workers/${worker.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnlineStatus: value }),
      }).catch(err => console.warn('Failed to update online status visibility:', err));
    } catch (error) {
      console.error('Error updating online status visibility:', error);
    }
  };

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
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Notification Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="notifications-outline" size={22} color="#666" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Enable Notifications</Text>
                  <Text style={styles.settingDescription}>Receive booking requests and updates</Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
                thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="calendar-outline" size={22} color="#FF7A2C" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>New Booking Requests</Text>
                  <Text style={styles.settingDescription}>Get notified when users book your services</Text>
                </View>
              </View>
              <Switch
                value={bookingNotifications}
                onValueChange={setBookingNotifications}
                trackColor={{ false: '#E0E0E0', true: '#FFE5CC' }}
                thumbColor={bookingNotifications ? '#FF7A2C' : '#f4f3f4'}
                disabled={!notificationsEnabled}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="chatbubble-outline" size={22} color="#4A90E2" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Message Notifications</Text>
                  <Text style={styles.settingDescription}>Get notified of new messages from users</Text>
                </View>
              </View>
              <Switch
                value={messageNotifications}
                onValueChange={setMessageNotifications}
                trackColor={{ false: '#E0E0E0', true: '#E3F2FD' }}
                thumbColor={messageNotifications ? '#4A90E2' : '#f4f3f4'}
                disabled={!notificationsEnabled}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="volume-high-outline" size={22} color="#9C27B0" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Sound Notifications</Text>
                  <Text style={styles.settingDescription}>Play sound for notifications</Text>
                </View>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={handleSoundToggle}
                trackColor={{ false: '#E0E0E0', true: '#F3E5F5' }}
                thumbColor={soundEnabled ? '#fff' : '#f4f3f4'}
                disabled={!notificationsEnabled}
              />
            </View>

            <View style={[styles.settingItem, styles.lastItem]}>
              <View style={styles.settingLeft}>
                <Ionicons name="phone-portrait-outline" size={22} color="#795548" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Vibration</Text>
                  <Text style={styles.settingDescription}>Vibrate for important notifications</Text>
                </View>
              </View>
              <Switch
                value={vibrationEnabled}
                onValueChange={handleVibrationToggle}
                trackColor={{ false: '#E0E0E0', true: '#EFEBE9' }}
                thumbColor={vibrationEnabled ? '#fff' : '#f4f3f4'}
                disabled={!notificationsEnabled}
              />
            </View>
          </View>

          {/* Location Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location & Tracking</Text>
            
            <View style={[styles.settingItem, styles.lastItem]}>
              <View style={styles.settingLeft}>
                <Ionicons name="location-outline" size={22} color="#2E7D32" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Location Updates</Text>
                  <Text style={styles.settingDescription}>Share your location during active jobs</Text>
                </View>
              </View>
              <Switch
                value={locationTracking}
                onValueChange={handleLocationTrackingToggle}
                trackColor={{ false: '#E0E0E0', true: '#E8F5E8' }}
                thumbColor={locationTracking ? '#2E7D32' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Work Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work Preferences</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="checkmark-circle-outline" size={22} color="#666" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Auto Accept Requests</Text>
                  <Text style={styles.settingDescription}>Automatically accept booking requests</Text>
                </View>
              </View>
              <Switch
                value={autoAccept}
                onValueChange={handleAutoAcceptToggle}
                trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
                thumbColor={autoAccept ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={[styles.settingItem, styles.lastItem]}>
              <View style={styles.settingLeft}>
                <Ionicons name="eye-outline" size={22} color="#666" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Show Online Status</Text>
                  <Text style={styles.settingDescription}>Display when you're available</Text>
                </View>
              </View>
              <Switch
                value={showOnlineStatus}
                onValueChange={handleShowOnlineStatusToggle}
                trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
                thumbColor={showOnlineStatus ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* App Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Preferences</Text>
            
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => {
                Alert.alert(
                  'Language',
                  'Select language',
                  [
                    { text: 'English', onPress: () => setLanguage('English') },
                    { text: 'Nepali', onPress: () => setLanguage('Nepali') },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="language-outline" size={22} color="#666" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Language</Text>
                  <Text style={styles.settingDescription}>{language}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, styles.lastItem]}
              onPress={() => {
                Alert.alert(
                  'Theme',
                  'Select theme',
                  [
                    { text: 'Light', onPress: () => setTheme('Light') },
                    { text: 'Dark', onPress: () => setTheme('Dark') },
                    { text: 'System', onPress: () => setTheme('System') },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="color-palette-outline" size={22} color="#666" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Theme</Text>
                  <Text style={styles.settingDescription}>{theme}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Email Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email Preferences</Text>
            
            <View style={[styles.settingItem, styles.lastItem]}>
              <View style={styles.settingLeft}>
                <Ionicons name="mail-outline" size={22} color="#F57C00" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Promotional Emails</Text>
                  <Text style={styles.settingDescription}>Receive updates about new features</Text>
                </View>
              </View>
              <Switch
                value={promotionalEmails}
                onValueChange={setPromotionalEmails}
                trackColor={{ false: '#E0E0E0', true: '#FFF8E1' }}
                thumbColor={promotionalEmails ? '#F57C00' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Security Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => router.push('/security')}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="shield-outline" size={22} color="#FF7A2C" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>PIN & Biometric</Text>
                  <Text style={styles.settingDescription}>Setup PIN and biometric authentication</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Account Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => {
                Alert.alert(
                  'Clear Cache',
                  'This will clear all cached data except your settings. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          if (!worker?.id) {
                            Alert.alert('Error', 'Worker information not available');
                            return;
                          }
                          
                          // Save current settings before clearing
                          const settingsKey = `worker_settings_${worker.id}`;
                          const currentSettings = await AsyncStorage.getItem(settingsKey);
                          
                          // Clear all cache
                          await AsyncStorage.clear();
                          
                          // Restore settings
                          if (currentSettings) {
                            await AsyncStorage.setItem(settingsKey, currentSettings);
                            settingsService.clearCache(worker.id);
                          }
                          
                          Alert.alert('Success', 'Cache cleared successfully. Your settings have been preserved.');
                        } catch (error) {
                          console.error('Error clearing cache:', error);
                          Alert.alert('Error', 'Failed to clear cache');
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="trash-outline" size={22} color="#666" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Clear Cache</Text>
                  <Text style={styles.settingDescription}>Remove all cached data</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, styles.lastItem]}
              onPress={() => {
                Alert.alert(
                  'About',
                  `Worker App v1.0.0\n\nYour ID: ${worker?.id || 'N/A'}\nEmail: ${worker?.email || 'N/A'}`,
                  [{ text: 'OK' }]
                );
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="information-circle-outline" size={22} color="#666" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>About</Text>
                  <Text style={styles.settingDescription}>App version and info</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Save Button */}
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </TouchableOpacity>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 60,
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
    marginBottom: 80,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  saveButton: {
    backgroundColor: '#FF7A2C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
