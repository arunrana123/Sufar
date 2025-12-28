import { SafeAreaView, StyleSheet, View, Pressable, ScrollView, Alert, Switch, Modal } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useState, useEffect } from 'react';

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const { logout, user } = useAuth();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
    loadBiometricSetting();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
  };

  const loadBiometricSetting = async () => {
    try {
      const enabled = await AsyncStorage.getItem('biometricEnabled');
      setBiometricEnabled(enabled === 'true');
    } catch (error) {
      console.error('Error loading biometric setting:', error);
    }
  };

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      // Enable biometric - authenticate first
      try {
                 const result = await LocalAuthentication.authenticateAsync({
                   promptMessage: 'Enable Biometric Login - Use your biometric to enable quick login',
                   fallbackLabel: 'Use Password',
                 });

        if (result.success) {
          await AsyncStorage.setItem('biometricEnabled', 'true');
          setBiometricEnabled(true);
          Alert.alert('Success', 'Biometric login enabled successfully!');
        } else {
          Alert.alert('Authentication Failed', 'Biometric authentication was cancelled or failed.');
        }
      } catch (error) {
        console.error('Biometric authentication error:', error);
        Alert.alert('Error', 'Failed to enable biometric login. Please try again.');
      }
    } else {
      // Disable biometric
      await AsyncStorage.setItem('biometricEnabled', 'false');
      setBiometricEnabled(false);
      Alert.alert('Biometric Disabled', 'Biometric login has been disabled.');
    }
  };

  const saveThemeSetting = async (theme: string) => {
    try {
      await setThemeMode(theme as 'light' | 'dark' | 'system');
      setThemeModalVisible(false);
      Alert.alert('Theme Updated', 'Theme preference saved successfully!');
    } catch (error) {
      console.error('Error saving theme setting:', error);
      Alert.alert('Error', 'Failed to save theme preference. Please try again.');
    }
  };

  const getThemeDisplayName = (theme: string) => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System Default';
      default:
        return 'System Default';
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout from your account?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              Alert.alert('Logged Out', 'You have been logged out successfully.');
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const settingsSections = [
    {
      title: 'Security',
      items: [
        {
          icon: 'lock-closed-outline',
          title: 'Setup PIN',
          subtitle: 'Add an extra layer of security',
          onPress: () => {
            router.push('/pin-settings');
          },
        },
        {
          icon: 'finger-print-outline',
          title: 'Biometric Login',
          subtitle: biometricAvailable 
            ? (biometricEnabled ? 'Enabled - Use biometric to login' : 'Use fingerprint or face ID')
            : 'Not available on this device',
          onPress: biometricAvailable ? () => toggleBiometric(!biometricEnabled) : undefined,
          isToggle: biometricAvailable,
          toggleValue: biometricEnabled,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'person-outline',
          title: 'Edit Profile',
          subtitle: 'Update your personal information',
          onPress: () => {
            router.push('/profile');
          },
        },
        {
          icon: 'key-outline',
          title: 'Change Password',
          subtitle: 'Update your password',
          onPress: () => {
            // TODO: Navigate to change password
            console.log('Change password');
          },
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: 'notifications-outline',
          title: 'Notifications',
          subtitle: 'Manage your notification preferences',
          onPress: () => {
            // TODO: Navigate to notification settings
            console.log('Notification settings');
          },
        },
        {
          icon: 'moon-outline',
          title: 'Theme',
          subtitle: getThemeDisplayName(themeMode),
          onPress: () => {
            setThemeModalVisible(true);
          },
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          icon: 'help-circle-outline',
          title: 'Help & Support',
          subtitle: 'Get help and contact support',
          onPress: () => {
            // TODO: Navigate to help
            console.log('Help & Support');
          },
        },
        {
          icon: 'document-text-outline',
          title: 'Terms & Privacy',
          subtitle: 'Read our terms and privacy policy',
          onPress: () => {
            // TODO: Navigate to terms
            console.log('Terms & Privacy');
          },
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'log-out-outline',
          title: 'Logout',
          subtitle: 'Sign out of your account',
          onPress: handleLogout,
          isDestructive: true,
        },
      ],
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <Pressable onPress={() => router.push('/menu')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </Pressable>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>Settings</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {settingsSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.section}>
              <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
              {section.items.map((item, itemIndex) => (
                <Pressable
                  key={itemIndex}
                  style={[
                    styles.settingItem,
                    { backgroundColor: theme.background, borderColor: theme.icon + '20' }
                  ]}
                  onPress={item.onPress}
                  disabled={!item.onPress}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.tint + '15' }]}>
                      <Ionicons 
                        name={item.icon as any} 
                        size={22} 
                        color={(item as any).isDestructive ? '#FF4444' : theme.tint} 
                      />
                    </View>
                    <View style={styles.textContainer}>
                      <ThemedText 
                        style={[
                          styles.settingTitle,
                          (item as any).isDestructive && { color: '#FF4444' }
                        ]}
                      >
                        {item.title}
                      </ThemedText>
                      <ThemedText style={styles.settingSubtitle}>{item.subtitle}</ThemedText>
                    </View>
                  </View>
                  {(item as any).isToggle ? (
                    <Switch
                      value={(item as any).toggleValue}
                      onValueChange={(value) => item.onPress && item.onPress()}
                      trackColor={{ false: '#E0E0E0', true: theme.tint + '40' }}
                      thumbColor={(item as any).toggleValue ? theme.tint : '#FFFFFF'}
                    />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={theme.icon + '60'} />
                  )}
                </Pressable>
              ))}
            </View>
          ))}

        </ScrollView>
      </SafeAreaView>

      {/* Theme Selection Modal */}
      <Modal
        visible={themeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Choose Theme</ThemedText>
              <Pressable
                onPress={() => setThemeModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.themeOptions}>
              {[
                { key: 'system', name: 'System Default', icon: 'phone-portrait-outline', description: 'Follow device setting' },
                { key: 'light', name: 'Light', icon: 'sunny-outline', description: 'Light theme' },
                { key: 'dark', name: 'Dark', icon: 'moon-outline', description: 'Dark theme' },
              ].map((option) => (
                <Pressable
                  key={option.key}
                  style={[
                    styles.themeOption,
                    { 
                      backgroundColor: themeMode === option.key ? theme.tint + '15' : 'transparent',
                      borderColor: themeMode === option.key ? theme.tint : theme.icon + '20',
                    }
                  ]}
                  onPress={() => saveThemeSetting(option.key)}
                >
                  <View style={styles.themeOptionLeft}>
                    <View style={[styles.themeIconContainer, { backgroundColor: theme.tint + '15' }]}>
                      <Ionicons 
                        name={option.icon as any} 
                        size={24} 
                        color={themeMode === option.key ? theme.tint : theme.icon} 
                      />
                    </View>
                    <View style={styles.themeTextContainer}>
                      <ThemedText style={[
                        styles.themeOptionTitle,
                        { color: themeMode === option.key ? theme.tint : theme.text }
                      ]}>
                        {option.name}
                      </ThemedText>
                      <ThemedText style={styles.themeOptionDescription}>
                        {option.description}
                      </ThemedText>
                    </View>
                  </View>
                  {themeMode === option.key && (
                    <Ionicons name="checkmark-circle" size={24} color={theme.tint} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
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
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
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
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 32,
    marginBottom: 20,
    gap: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  themeOptions: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  themeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  themeTextContainer: {
    flex: 1,
  },
  themeOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  themeOptionDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
});
