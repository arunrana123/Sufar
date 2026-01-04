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
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const { worker } = useAuth();
  
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
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem(`worker_settings_${worker?.id}`);
      if (settings) {
        const parsed = JSON.parse(settings);
        setNotificationsEnabled(parsed.notificationsEnabled ?? true);
        setSoundEnabled(parsed.soundEnabled ?? true);
        setVibrationEnabled(parsed.vibrationEnabled ?? true);
        setLocationTracking(parsed.locationTracking ?? true);
        setAutoAccept(parsed.autoAccept ?? false);
        setShowOnlineStatus(parsed.showOnlineStatus ?? true);
        setLanguage(parsed.language || 'English');
        setTheme(parsed.theme || 'Light');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
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
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleSave = () => {
    saveSettings();
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
                onValueChange={setNotificationsEnabled}
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
                onValueChange={setSoundEnabled}
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
                onValueChange={setVibrationEnabled}
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
                onValueChange={setLocationTracking}
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
                onValueChange={setAutoAccept}
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
                onValueChange={setShowOnlineStatus}
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

          {/* Account Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => {
                Alert.alert(
                  'Clear Cache',
                  'This will clear all cached data. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await AsyncStorage.clear();
                          Alert.alert('Success', 'Cache cleared successfully');
                        } catch (error) {
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
