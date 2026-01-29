import { StyleSheet, View, Pressable, ScrollView, Alert, Switch, Modal, TouchableOpacity, TextInput, Linking, ActivityIndicator, Text, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import UserOnboarding from '@/components/UserOnboarding';
import { BiometricAuth } from '@/lib/BiometricAuth';
import { getApiUrl } from '@/lib/config';
import { useState, useEffect } from 'react';

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const { logout, user } = useAuth();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
    loadBiometricSetting();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const available = await BiometricAuth.isAvailable();
      setBiometricAvailable(available);
      if (available) {
        const type = await BiometricAuth.getBiometricType();
        setBiometricType(type);
      }
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
          fallbackLabel: 'Use Password',
          disableDeviceFallback: false,
          cancelLabel: 'Cancel',
        });
        if (authResult.success) {
          await AsyncStorage.setItem('biometricEnabled', 'true');
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
    } else {
      try {
        await AsyncStorage.setItem('biometricEnabled', 'false');
        setBiometricEnabled(false);
        Alert.alert('Biometric Disabled', 'Face ID / biometric login has been disabled.');
      } catch (error) {
        console.error('Error disabling biometric:', error);
        Alert.alert('Error', 'Failed to update setting.');
      }
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

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const openChangePasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setChangePasswordModalVisible(true);
  };

  const closeChangePasswordModal = () => {
    setChangePasswordModalVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setChangePasswordLoading(false);
  };

  const handleChangePasswordSubmit = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to change your password.');
      return;
    }
    if (!currentPassword.trim()) {
      Alert.alert('Missing field', 'Please enter your current password.');
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert('Missing field', 'Please enter your new password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Weak password', 'New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password mismatch', 'New password and confirm password do not match.');
      return;
    }
    setChangePasswordLoading(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/users/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        Alert.alert('Success', 'Your password has been changed successfully.');
        closeChangePasswordModal();
      } else {
        Alert.alert('Failed', data.message || 'Could not change password. Please try again.');
      }
    } catch (error) {
      console.error('Change password error:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleHelpSupport = () => {
    Alert.alert(
      'Help & Support',
      'For assistance, email us or visit the help center.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Email support', onPress: () => Linking.openURL('mailto:support@example.com') },
        { text: 'OK' },
      ]
    );
  };

  const handleTermsPrivacy = () => {
    Alert.alert(
      'Terms & Privacy',
      'View our Terms of Service and Privacy Policy in your browser.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open in browser', onPress: () => Linking.openURL('https://example.com/terms') },
        { text: 'OK' },
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
          icon: biometricType === 'Face ID' ? 'face-recognition-outline' : 'finger-print-outline',
          title: biometricType === 'Face ID' ? 'Face ID' : 'Biometric Login',
          subtitle: biometricAvailable
            ? (biometricEnabled
              ? (biometricType === 'Face ID' ? 'Face ID registered - Unlock with Face ID' : 'Enabled - Use biometric to login')
              : (biometricType === 'Face ID' ? 'Register Face ID to unlock the app' : 'Use fingerprint or Face ID'))
            : 'Set up Face ID / fingerprint in device Settings first',
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
          onPress: openChangePasswordModal,
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
          onPress: () => router.push('/notifications'),
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
          icon: 'school-outline',
          title: 'How to Use App',
          subtitle: 'View step-by-step guide',
          onPress: () => {
            setShowOnboarding(true);
          },
        },
        {
          icon: 'help-circle-outline',
          title: 'Help & Support',
          subtitle: 'Get help and contact support',
          onPress: handleHelpSupport,
        },
        {
          icon: 'document-text-outline',
          title: 'Terms & Privacy',
          subtitle: 'Read our terms and privacy policy',
          onPress: handleTermsPrivacy,
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

  if (showOnboarding) {
    return <UserOnboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']}>
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/menu'); }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
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

      {/* Change Password Modal */}
      <Modal
        visible={changePasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeChangePasswordModal}
      >
        <View style={[styles.modalOverlay, styles.modalOverlayCenter]}>
          <View style={[styles.modalContent, styles.changePasswordModal, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Change Password</ThemedText>
              <Pressable onPress={closeChangePasswordModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.changePasswordForm}>
              <ThemedText style={styles.changePasswordLabel}>Current password</ThemedText>
              <View style={[styles.passwordInputWrap, { borderColor: theme.icon + '30' }]}>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showCurrentPassword}
                  style={[styles.passwordInput, { color: theme.text }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowCurrentPassword((v) => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.icon} />
                </Pressable>
              </View>
              <ThemedText style={styles.changePasswordLabel}>New password</ThemedText>
              <View style={[styles.passwordInputWrap, { borderColor: theme.icon + '30' }]}>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password (min 6 characters)"
                  placeholderTextColor="#999"
                  secureTextEntry={!showNewPassword}
                  style={[styles.passwordInput, { color: theme.text }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowNewPassword((v) => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.icon} />
                </Pressable>
              </View>
              <ThemedText style={styles.changePasswordLabel}>Confirm new password</ThemedText>
              <View style={[styles.passwordInputWrap, { borderColor: theme.icon + '30' }]}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showConfirmPassword}
                  style={[styles.passwordInput, { color: theme.text }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowConfirmPassword((v) => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.icon} />
                </Pressable>
              </View>
              <View style={styles.changePasswordActions}>
                <Pressable
                  style={[styles.changePasswordCancel, { borderColor: theme.icon + '40' }]}
                  onPress={closeChangePasswordModal}
                  disabled={changePasswordLoading}
                >
                  <ThemedText style={styles.changePasswordCancelText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.changePasswordSubmit, { backgroundColor: theme.tint, opacity: changePasswordLoading ? 0.7 : 1 }]}
                  onPress={handleChangePasswordSubmit}
                  disabled={changePasswordLoading}
                >
                  {changePasswordLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.changePasswordSubmitText}>Change password</Text>
                  )}
                </Pressable>
              </View>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 50,
    paddingBottom: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
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
  modalOverlayCenter: {
    justifyContent: 'center',
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
  changePasswordModal: {
    marginHorizontal: 20,
    borderRadius: 16,
  },
  changePasswordForm: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  changePasswordLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.9,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeBtn: {
    padding: 8,
  },
  changePasswordActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  changePasswordCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  changePasswordCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  changePasswordSubmit: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePasswordSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
