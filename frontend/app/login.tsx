// LOGIN SCREEN - User authentication with email/password and Google Sign-In
// Features: Email/password login, Google OAuth integration, remember me, forgot password link
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getApiUrl } from '@/lib/config';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

export default function LoginScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  // Google Sign-In Hook
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleAuthentication(authentication);
    }
  }, [response]);

  const handleGoogleAuthentication = async (authentication: any) => {
    setGoogleLoading(true);
    try {
      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${authentication.accessToken}` },
      });
      
      const googleUser = await userInfoResponse.json();
      
      // Send to backend
      const apiUrl = getApiUrl();
      const backendResponse = await fetch(`${apiUrl}/api/users/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleId: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          firstName: googleUser.given_name,
          lastName: googleUser.family_name,
          profilePhoto: googleUser.picture,
        }),
      });

      const data = await backendResponse.json();

      if (backendResponse.ok) {
        const userData = {
          id: data.id,
          name: data.name,
          email: data.email,
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          profilePhoto: data.profilePhoto,
        };
        await login(userData);
        router.replace('/home');
      } else {
        Alert.alert('Login Failed', data.message || 'Failed to authenticate with Google');
      }
    } catch (error) {
      console.error('Google auth error:', error);
      Alert.alert('Error', 'Failed to authenticate with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    // Configure WebBrowser for AuthSession
    WebBrowser.maybeCompleteAuthSession();
  }, []);
  
  // Forgot password flow states
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifiedOtp, setVerifiedOtp] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    promptAsync().catch((error) => {
      console.error('Google prompt error:', error);
      setGoogleLoading(false);
      Alert.alert('Error', 'Failed to start Google Sign-In');
    });
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = getApiUrl();
      console.log('🔐 Login attempt started');
      console.log('Platform:', Platform.OS);
      console.log('Development mode:', __DEV__);
      console.log('API URL:', apiUrl);
      console.log('Full login URL:', `${apiUrl}/api/users/login`);
      console.log('Login data:', { identifier: email, password: '[HIDDEN]' });
      
      // Validate API URL
      if (!apiUrl || apiUrl === 'undefined' || apiUrl.includes('undefined')) {
        Alert.alert(
          'Configuration Error',
          'API URL is not configured correctly. Please check your environment variables.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Verify IP address is correct
      if (!apiUrl.includes('192.168.1.112') && !apiUrl.includes('localhost') && !apiUrl.includes('10.0.2.2')) {
        console.error('❌ ERROR: API URL does not contain expected IP (192.168.1.112):', apiUrl);
        Alert.alert(
          'Configuration Error',
          `Wrong server IP detected: ${apiUrl}\n\nExpected: http://192.168.1.112:5001\n\nPlease check your configuration.`,
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      } else {
        console.log('✅ API URL is correct:', apiUrl);
      }
      
      // Proceed with login attempt (with increased timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for login
      
      try {
        console.log('📡 Making login request to:', `${apiUrl}/api/users/login`);
        console.log('📡 Request method: POST');
        console.log('📡 Request headers:', {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        });
        
        const response = await fetch(`${apiUrl}/api/users/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ 
            identifier: email,
            password 
          }),
          signal: controller.signal,
          // Add these options for better network handling
          cache: 'no-cache',
          credentials: 'omit',
        });

        clearTimeout(timeoutId);

        console.log('Response status:', response.status);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Non-JSON response:', text);
          Alert.alert('Error', 'Server returned an invalid response. Please try again.');
          return;
        }
        
        const data = await response.json();
        console.log('Response data:', data);

        if (response.ok) {
          const userData = {
            id: data.id || data._id,
            name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || 'User',
            email: data.email,
            username: data.username || data.email,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            role: data.role || 'user',
            profilePhoto: data.profilePhoto || data.profileImage,
          };
          
          console.log('Login successful, storing user data:', userData);
          await login(userData);
          console.log('User data stored, navigating to home');
          router.replace('/home');
        } else {
          Alert.alert('Login Failed', data.message || 'Invalid credentials');
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        console.error('❌ Fetch error details:', {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack,
          apiUrl: apiUrl,
        });
        
        if (fetchError.name === 'AbortError') {
          // Timeout error - provide helpful message
          Alert.alert(
            'Connection Timeout',
            `Unable to connect to server at ${apiUrl}\n\nPlease check:\n• Backend server is running on port 5001\n• Your device is on the same network\n• Firewall is not blocking the connection\n\nTry restarting the backend server and try again.`,
            [
              { text: 'OK', style: 'default' },
              { 
                text: 'Retry', 
                onPress: () => handleLogin(),
                style: 'default'
              }
            ]
          );
          return; // Don't throw, we've handled it
        } else if (fetchError.message?.includes('Network request failed') || fetchError.name === 'TypeError') {
          // Network failure - provide specific Android/iOS guidance
          const isAndroid = Platform.OS === 'android';
          const serverIP = apiUrl.split('://')[1]?.split(':')[0] || 'unknown';
          
          Alert.alert(
            'Network Connection Failed',
            `Cannot reach server at:\n${apiUrl}\n\n${isAndroid ? '🔧 Android Fix Required:' : '📱 iOS Checks:'}\n${isAndroid ? '1. Rebuild the app (network config was updated):\n   bunx expo prebuild --clean\n   bunx expo run:android\n\n2. Verify network security config is applied\n3. Ensure device and computer are on same WiFi\n4. Check if backend is accessible from phone browser:\n   http://' + serverIP + ':5001' : '• Check iOS network permissions\n• Ensure device and computer are on same network\n• Try restarting the app'}\n\n✅ General Checks:\n• Backend server is running: cd backend && bun run dev\n• Server is listening on port 5001\n• Computer IP is ${serverIP}\n• Firewall allows port 5001\n• Try accessing http://${serverIP}:5001 in phone browser`,
            [
              { text: 'OK', style: 'default' },
              { 
                text: 'Retry Login', 
                onPress: () => {
                  console.log('🔄 Retrying login...');
                  handleLogin();
                },
                style: 'default'
              }
            ]
          );
          return; // Don't throw, we've handled it
        } else {
          throw fetchError; // Re-throw to be caught by outer catch
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const apiUrl = getApiUrl();
      
      // Provide helpful error messages based on error type
      if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
        // Check if it's Android and suggest network security config
        const isAndroid = Platform.OS === 'android';
        const serverIP = apiUrl.split('://')[1]?.split(':')[0] || 'unknown';
        const suggestions = isAndroid 
          ? `🔧 IMPORTANT: Rebuild the app for network config changes:\n\nbunx expo prebuild --clean\nbunx expo run:android\n\nThen verify:\n• Backend server is running (port 5001)\n• Device and computer on same WiFi\n• Test in phone browser: http://${serverIP}:5001\n• Network security config is applied`
          : `• Backend server is running\n• Device is on the same network\n• Firewall allows connections\n• Test in phone browser: http://${serverIP}:5001`;
        
        Alert.alert(
          'Connection Error',
          `Cannot connect to server at:\n${apiUrl}\n\n${suggestions}\n\nPlatform: ${Platform.OS}`,
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Retry',
              onPress: () => handleLogin(),
              style: 'default'
            }
          ]
        );
        
        // Log additional debug info
        console.log('🔍 Debug info:', {
          platform: Platform.OS,
          apiUrl,
          envVar: process.env.EXPO_PUBLIC_API_URL || 'not set',
          devMode: __DEV__,
        });
        console.log('💡 Tip: If using Android physical device, ensure backend IP matches your computer\'s IP');
        console.log('💡 Tip: For Android emulator, try setting EXPO_PUBLIC_API_URL=http://10.0.2.2:5001');
        console.log('💡 Tip: For physical device, ensure EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:5001');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
        Alert.alert(
          'Connection Timeout',
          `Request timed out while connecting to:\n${apiUrl}\n\nPlease verify:\n• Backend server is running (check terminal)\n• Server is listening on port 5001\n• Your device and computer are on the same network\n• Firewall is not blocking connections\n\nTry:\n1. Restart the backend server\n2. Check if you can access ${apiUrl} in a browser\n3. Verify your network connection`,
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Retry Login', 
              onPress: () => handleLogin(),
              style: 'default'
            }
          ]
        );
      } else {
        Alert.alert(
          'Login Error', 
          `An error occurred: ${errorMessage}\n\nAPI URL: ${apiUrl}\n\nPlease check your connection and try again.`,
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Retry', 
              onPress: () => handleLogin(),
              style: 'default'
            }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Forgot password handlers
  const handleSendOtp = async () => {
    if (!forgotEmail || !isValidEmail(forgotEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setForgotLoading(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'OTP Sent',
          `OTP has been sent to ${forgotEmail}. ${data.otp ? `\n\nOTP: ${data.otp} (for testing)` : ''}`,
          [{ text: 'OK', onPress: () => setForgotStep('otp') }]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter the OTP');
      return;
    }

    setForgotLoading(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/users/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        setVerifiedOtp(otp);
        setForgotStep('reset');
        setOtp('');
      } else {
        Alert.alert('Error', data.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      Alert.alert('Error', 'Failed to verify OTP. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setForgotLoading(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          otp: verifiedOtp,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Password reset successfully', [
          {
            text: 'OK',
            onPress: () => {
              setForgotVisible(false);
              setEmail(forgotEmail);
              setForgotStep('email');
              setForgotEmail('');
              setOtp('');
              setVerifiedOtp(null);
              setNewPassword('');
              setConfirmPassword('');
            },
          },
        ]);
      } else {
        Alert.alert('Error', data.message || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
        <LinearGradient
          colors={[theme.primary, theme.primary + 'E0', theme.primary + 'C0']}
          style={styles.gradient}
        >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>S</Text>
              </View>
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Email Address"
                placeholderTextColor={theme.icon}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View style={[styles.inputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.icon} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Password"
                placeholderTextColor={theme.icon}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.icon}
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => {
                setForgotVisible(true);
                setForgotStep('email');
                setForgotEmail(email);
                setOtp('');
                setVerifiedOtp(null);
                setNewPassword('');
                setConfirmPassword('');
              }}
            >
              <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: theme.primary }, loading && { backgroundColor: theme.primary + 'A0' }]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'Signing In...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.secondary }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Google Login Button */}
            <TouchableOpacity
              style={[styles.googleButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
            >
              <View style={styles.googleIconWrap}>
                <Ionicons name="logo-google" size={22} color="#DB4437" />
              </View>
              <Text style={[styles.googleButtonText, { color: theme.text }]}>
                {googleLoading ? 'Connecting...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>

            {/* Switch to Signup */}
            <View style={styles.switchContainer}>
              <Text style={[styles.switchText, { color: theme.secondary }]}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={[styles.switchLink, { color: theme.primary }]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setForgotVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {forgotStep === 'email' && 'Forgot Password'}
                {forgotStep === 'otp' && 'Verify OTP'}
                {forgotStep === 'reset' && 'Set New Password'}
              </Text>
              <TouchableOpacity onPress={() => setForgotVisible(false)}>
                <Ionicons name="close" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            {forgotStep === 'email' && (
              <>
                <Text style={styles.modalLabel}>Registered Email</Text>
                <View style={styles.modalInputRow}>
                  <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter your email"
                    placeholderTextColor="#999"
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.modalButton, forgotLoading && styles.modalButtonDisabled]}
                  onPress={handleSendOtp}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {forgotStep === 'otp' && (
              <>
                <Text style={styles.modalLabel}>Enter OTP</Text>
                <Text style={styles.modalSubtext}>
                  We've sent a verification code to {forgotEmail}
                </Text>
                <View style={styles.modalInputRow}>
                  <Ionicons name="key-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor="#999"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.modalButton, forgotLoading && styles.modalButtonDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Verify OTP</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={() => setForgotStep('email')}
                >
                  <Text style={styles.modalSecondaryButtonText}>Back</Text>
                </TouchableOpacity>
              </>
            )}

            {forgotStep === 'reset' && (
              <>
                <Text style={styles.modalLabel}>New Password</Text>
                <View style={styles.modalInputRow}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter new password"
                    placeholderTextColor="#999"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
                <Text style={styles.modalLabel}>Confirm Password</Text>
                <View style={styles.modalInputRow}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Confirm new password"
                    placeholderTextColor="#999"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.modalButton, forgotLoading && styles.modalButtonDisabled]}
                  onPress={handleResetPassword}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 5,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    color: '#1E40AF',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonDisabled: {
    backgroundColor: '#3B82F6',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 50,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 16,
  },
  googleIconWrap: {
    marginRight: 10,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E9ECEF',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#666',
    fontSize: 14,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    color: '#666',
    fontSize: 14,
  },
  switchLink: {
    color: '#1E40AF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  modalSubtext: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 16,
  },
  modalInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  modalButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonDisabled: {
    backgroundColor: '#3B82F6',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#F3F4F6',
  },
  modalSecondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});
