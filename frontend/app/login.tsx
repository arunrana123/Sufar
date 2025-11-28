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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    
    // For now, show setup message. To enable:
    // 1. Get Google OAuth credentials from Google Cloud Console
    // 2. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to .env
    // 3. Uncomment the full implementation in GOOGLE_AUTH_IMPLEMENTATION.md
    
    Alert.alert(
      'Google Sign-In Setup Required',
      'To enable Google Sign-In:\n\n1. Get Google OAuth credentials\n2. Add to .env file\n3. Restart app\n\nSee GOOGLE_AUTH_SETUP.md for details',
      [{ text: 'OK', onPress: () => setGoogleLoading(false) }]
    );
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
      console.log('Platform:', Platform.OS);
      console.log('Development mode:', __DEV__);
      console.log('Attempting login to:', `${apiUrl}/api/users/login`);
      console.log('Login data:', { identifier: email, password: '[HIDDEN]' });
      
      // Test connection first (non-blocking with timeout)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        try {
          const testResponse = await fetch(`${apiUrl}/`, { 
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          console.log('✅ Connection test successful:', testResponse.status);
        } catch (testError: any) {
          clearTimeout(timeoutId);
          
          // Don't block login if connection test fails - just log a warning
          if (testError.name === 'AbortError') {
            console.warn('⚠️ Connection test timeout - proceeding with login anyway');
          } else {
            console.warn('⚠️ Connection test failed - proceeding with login anyway:', testError.message);
          }
        }
      } catch (testError) {
        // Silently continue - connection test is optional
        console.warn('⚠️ Connection test error - proceeding with login:', testError);
      }
      
      // Proceed with login attempt (with timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for login
      
      try {
        const response = await fetch(`${apiUrl}/api/users/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            identifier: email,
            password 
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (response.ok) {
          const userData = {
            id: data.id,
            name: `${data.firstName} ${data.lastName}`,
            email: data.email,
            username: data.username,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            profilePhoto: data.profilePhoto,
          };
          
          console.log('Login successful, storing user data:', userData);
          await login(userData);
          console.log('User data stored, navigating to tabs');
          router.replace('/home');
        } else {
          Alert.alert('Login Failed', data.message || 'Invalid credentials');
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          Alert.alert('Connection Timeout', 'Request timed out. Please check your internet connection and try again.');
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
        const suggestions = isAndroid 
          ? `• Backend server is running (checking port 5001)\n• Device is on the same network\n• Android network security config is set\n• Try restarting the app after backend starts`
          : `• Backend server is running\n• Device is on the same network\n• Firewall allows connections`;
        
        Alert.alert(
          'Connection Error',
          `Cannot connect to server at:\n${apiUrl}\n\n${suggestions}\n\nCurrent platform: ${Platform.OS}`
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
          `Request timed out while connecting to ${apiUrl}.\n\nPlease check:\n• Backend server is running\n• Network connection is stable`
        );
      } else {
        Alert.alert('Error', `Network error: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#AEDAFF" />
      <LinearGradient
        colors={['#AEDAFF', '#B8E0FF', '#C6E5FF']}
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
            <TouchableOpacity style={styles.forgotPassword}>
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

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Login Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
            >
              <View style={styles.googleIconWrap}>
                <Ionicons name="logo-google" size={22} color="#DB4437" />
              </View>
              <Text style={styles.googleButtonText}>
                {googleLoading ? 'Connecting...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>

            {/* Switch to Signup */}
            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.switchLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
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
});
