// RESET PASSWORD SCREEN - Final step to set new password after OTP verification
// Features: New password input, confirm password validation, updates password via API
import { useState } from 'react';
import { Alert, Platform, SafeAreaView, StyleSheet, TextInput, View, Pressable } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getApiUrl } from '@/lib/config';

export default function ResetPasswordScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const params = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </Pressable>
        
        <ThemedText style={[styles.title, { color: theme.tint }]}>Reset Password</ThemedText>
        <ThemedText style={styles.helper}>Enter your new password</ThemedText>
        
        <ThemedText style={styles.label}>New Password</ThemedText>
        <View style={styles.inputIconWrapper}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry={!showPassword}
            placeholder="Enter new password"
            placeholderTextColor="#999"
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} />
          </Pressable>
        </View>

        <ThemedText style={styles.label}>Confirm Password</ThemedText>
        <View style={styles.inputIconWrapper}>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
            secureTextEntry={!showConfirm}
            placeholder="Confirm new password"
            placeholderTextColor="#999"
          />
          <Pressable onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn}>
            <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} />
          </Pressable>
        </View>
        
        <Pressable
          style={[styles.primary, { backgroundColor: theme.tint, opacity: resetting ? 0.7 : 1 }]}
          disabled={resetting}
          onPress={async () => {
            if (!password || !confirmPassword) {
              Alert.alert('Missing fields', 'Please fill in both password fields.');
              return;
            }
            if (password.length < 6) {
              Alert.alert('Weak password', 'Password should be at least 6 characters long.');
              return;
            }
            if (password !== confirmPassword) {
              Alert.alert('Password mismatch', 'Passwords do not match.');
              return;
            }
            if (!params.token) {
              Alert.alert('Error', 'Reset token not found. Please try again.');
              return;
            }
            
            try {
              setResetting(true);
              const baseUrl = getApiUrl();
              
              const res = await fetch(`${baseUrl}/api/users/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: params.token, password }),
              });
              
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                Alert.alert('Reset Failed', data?.message || 'Could not reset password');
                return;
              }
              
              Alert.alert('Success', 'Your password has been reset successfully!', [
                { text: 'OK', onPress: () => router.replace('/signin') },
              ]);
            } catch (e) {
              Alert.alert('Network error', 'Please try again later.');
            } finally {
              setResetting(false);
            }
          }}
        >
          <ThemedText style={styles.primaryText}>
            {resetting ? 'Resetting…' : 'Reset Password'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  backBtn: { position: 'absolute', top: 20, left: 12, padding: 6 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 10 },
  helper: { fontSize: 16, marginBottom: 20, textAlign: 'center' },
  label: { alignSelf: 'flex-start', width: '85%', fontSize: 16, marginBottom: 8, marginTop: 8 },
  input: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: '#00000055',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    paddingRight: 50,
  },
  inputIconWrapper: { position: 'relative', width: '85%', marginBottom: 8 },
  eyeBtn: { position: 'absolute', right: 12, top: 12 },
  primary: { width: '70%', paddingVertical: 14, borderRadius: 26, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
