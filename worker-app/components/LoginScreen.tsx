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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '@/lib/config';
import { loginRequest } from '@/lib/networkUtils';
// Simple Google Sign-In implementation (no complex imports)
// For full functionality, set up Google OAuth credentials

interface LoginScreenProps {
  onLoginSuccess: (userData: any) => void;
  onSwitchToSignup: () => void;
  prefilledEmail?: string;
}

export default function LoginScreen({ onLoginSuccess, onSwitchToSignup, prefilledEmail }: LoginScreenProps) {
  const [email, setEmail] = useState(prefilledEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [forgotEmail, setForgotEmail] = useState(prefilledEmail || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [verifiedOtp, setVerifiedOtp] = useState<string | null>(null);


  const handleForgotPassword = async () => {
    if (!forgotEmail || !isValidEmail(forgotEmail)) {
      Alert.alert('Error', 'Please enter a valid registered email.');
      return;
    }
    setForgotLoading(true);
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/workers/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert(
          'OTP Sent',
          `We sent an OTP to ${forgotEmail}.${data.otp ? `\n\nTest OTP: ${data.otp}` : ''}`
        );
        setForgotStep('otp');
      } else {
        Alert.alert('Error', data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter the OTP.');
      return;
    }
    setForgotLoading(true);
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/workers/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        setVerifiedOtp(otp);
        setOtp('');
        setForgotStep('reset');
      } else {
        Alert.alert('Error', data.message || 'Failed to verify OTP');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (!verifiedOtp) {
      Alert.alert('Error', 'Please verify OTP first.');
      return;
    }
    setForgotLoading(true);
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/workers/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: verifiedOtp, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', 'Password reset successfully. Please login.', [
          { text: 'OK', onPress: () => setForgotVisible(false) },
        ]);
        // Prefill email and clear password
        setEmail(forgotEmail);
        setPassword('');
      } else {
        Alert.alert('Error', data.message || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setForgotLoading(false);
      setForgotStep('email');
      setVerifiedOtp(null);
      setNewPassword('');
      setConfirmPassword('');
    }
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
      console.log('🔐 Worker login attempt started');
      console.log('API URL:', apiUrl);
      console.log('Full login URL:', `${apiUrl}/api/workers/login`);
      
      // Validate API URL
      if (!apiUrl || apiUrl === 'undefined' || apiUrl.includes('undefined')) {
        Alert.alert(
          'Configuration Error',
          'API URL is not configured correctly. Please check your environment variables.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }
      
      // Verify IP address is correct (allow localhost and 10.0.2.2 for emulators)
      const defaultIp = '192.168.1.66';
      if (!apiUrl.includes(defaultIp) && !apiUrl.includes('localhost') && !apiUrl.includes('10.0.2.2')) {
        console.error(`❌ ERROR: API URL does not contain expected IP (${defaultIp}):`, apiUrl);
        Alert.alert(
          'Configuration Error',
          `Wrong server IP detected: ${apiUrl}\n\nExpected: http://${defaultIp}:5001\n\nPlease check your configuration.`,
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      } else {
        console.log('✅ API URL is correct:', apiUrl);
      }
      
      // Use robust login request with automatic retry
      console.log('📡 Making login request...');
      console.log('📡 Using robust network utility with retry logic');
      
      try {
        console.log('📡 Sending login request...');
        const response = await loginRequest('/api/workers/login', {
          email,
          password,
        }, apiUrl);
        
        console.log('✅ Login response received, status:', response.status);
        
        // Parse response - handle both JSON and text responses
        let data: any;
        const contentType = response.headers.get('content-type') || '';
        
        try {
          if (contentType.includes('application/json')) {
            data = await response.json();
            console.log('✅ Response parsed as JSON');
          } else {
            // Try to parse as JSON anyway (some servers don't set content-type correctly)
            const text = await response.text();
            console.log('⚠️ Non-JSON content-type, attempting to parse text as JSON...');
            try {
              data = JSON.parse(text);
              console.log('✅ Successfully parsed text as JSON');
            } catch (parseError) {
              console.error('❌ Failed to parse response:', text);
              Alert.alert('Error', `Server returned an invalid response: ${text.substring(0, 100)}`);
              setLoading(false);
              return;
            }
          }
        } catch (parseError: any) {
          console.error('❌ Error parsing response:', parseError);
          Alert.alert('Error', 'Failed to parse server response. Please try again.');
          setLoading(false);
          return;
        }

        console.log('📦 Response data:', { 
          hasWorker: !!data.worker, 
          hasToken: !!data.token,
          status: response.status 
        });

        if (response.ok && data.worker && data.token) {
          console.log('✅ Login successful, processing worker data...');
          
          // Try to load stored worker data to preserve profileImage and other local updates
          let storedWorkerData = null;
          try {
            const stored = await AsyncStorage.getItem('workerData');
            if (stored) {
              storedWorkerData = JSON.parse(stored);
              console.log('✅ Loaded stored worker data');
            }
          } catch (e) {
            console.log('ℹ️ No stored worker data found');
          }
          
          // Merge backend data with stored data (prefer stored profileImage if exists)
          const workerData = {
            id: data.worker._id || data.worker.id,
            name: data.worker.name || data.worker.firstName + ' ' + (data.worker.lastName || ''),
            email: data.worker.email,
            phone: data.worker.phone,
            skills: data.worker.skills || [],
            token: data.token,
            profileImage: storedWorkerData?.profileImage || data.worker.profileImage || data.worker.profilePhoto || null,
            serviceCategories: data.worker.serviceCategories || [], // Include service categories from backend
            categoryVerificationStatus: data.worker.categoryVerificationStatus || null,
            documents: storedWorkerData?.documents || data.worker.documents || null,
            verificationStatus: storedWorkerData?.verificationStatus || data.worker.verificationStatus || null,
            verificationSubmitted: storedWorkerData?.verificationSubmitted || data.worker.verificationSubmitted || false,
          };
          
          console.log('✅ Worker data prepared, calling onLoginSuccess...');
          onLoginSuccess(workerData);
          console.log('✅ Login flow completed successfully');
        } else {
          // Handle error responses
          const errorMessage = data.message || data.error || 'Invalid credentials. Please check your email and password.';
          console.error('❌ Login failed:', errorMessage);
          Alert.alert('Login Failed', errorMessage);
          setLoading(false);
        }
      } catch (fetchError: any) {
        // Error already handled by loginRequest with retry logic
        console.error('❌ Login request failed after retries:', fetchError.message);
        throw fetchError; // Re-throw to be caught by outer catch
      }
    } catch (error) {
      console.error('❌ Login error caught:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Don't show alert if login was actually successful (loading state will be cleared by onLoginSuccess)
      // Only show error if it's a real error
      if (errorMessage && !errorMessage.includes('success')) {
        // Display error message (loginRequest already provides detailed messages)
        Alert.alert(
          'Login Failed',
          errorMessage,
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Retry',
              onPress: () => {
                console.log('🔄 Retrying login...');
                handleLogin();
              },
              style: 'default'
            }
          ]
        );
      }
    } finally {
      // Always clear loading state
      setLoading(false);
      console.log('✅ Login attempt completed, loading state cleared');
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle="light-content" backgroundColor="#FF7A2C" />
        <LinearGradient
          colors={['#FF7A2C', '#FF8C42', '#FF9F5A']}
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
              <Text style={styles.subtitle}>Sign in to your worker account</Text>
            </View>

            {/* Login Form */}
            <View style={styles.formContainer}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#999"
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
                    color="#666"
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
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
              <Text style={styles.loginButtonText}>
                {loading ? 'Signing In...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            {/* Switch to Signup */}
              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>Don't have an account? </Text>
                <TouchableOpacity onPress={onSwitchToSignup}>
                  <Text style={styles.switchLink}>Sign Up</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.loginButton, forgotLoading && styles.loginButtonDisabled]}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                >
                  <Text style={styles.loginButtonText}>
                    {forgotLoading ? 'Sending...' : 'Send OTP'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {forgotStep === 'otp' && (
              <>
                <Text style={styles.modalLabel}>Enter OTP</Text>
                <View style={styles.modalInputRow}>
                  <Ionicons name="key-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="6-digit OTP"
                    placeholderTextColor="#999"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.loginButton, forgotLoading && styles.loginButtonDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={forgotLoading}
                >
                  <Text style={styles.loginButtonText}>
                    {forgotLoading ? 'Verifying...' : 'Verify OTP'}
                  </Text>
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
                    placeholder="New password"
                    placeholderTextColor="#999"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </View>
                <Text style={styles.modalLabel}>Confirm Password</Text>
                <View style={styles.modalInputRow}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Confirm password"
                    placeholderTextColor="#999"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>
                <TouchableOpacity
                  style={[styles.loginButton, forgotLoading && styles.loginButtonDisabled]}
                  onPress={handleResetPassword}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Reset Password</Text>
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
    color: '#FF7A2C',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#FF7A2C',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonDisabled: {
    backgroundColor: '#FFB88C',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
    color: '#FF7A2C',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
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
});
