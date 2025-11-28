// VERIFY OTP SCREEN - OTP verification for password reset flow
// Features: 6-digit OTP input, verification via API, navigates to reset-password on success
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

export default function VerifyOtpScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const params = useLocalSearchParams<{ email?: string }>();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </Pressable>
        
        <ThemedText style={[styles.title, { color: theme.tint }]}>Enter OTP</ThemedText>
        <ThemedText style={styles.helper}>
          Enter the 4-digit code sent to {params.email}
        </ThemedText>
        
        <View style={styles.otpContainer}>
          <TextInput
            value={otp}
            onChangeText={setOtp}
            style={styles.otpInput}
            keyboardType="numeric"
            maxLength={4}
            placeholder="0000"
            placeholderTextColor="#999"
          />
        </View>
        
        <Pressable
          style={[styles.primary, { backgroundColor: theme.tint, opacity: verifying ? 0.7 : 1 }]}
          disabled={verifying}
          onPress={async () => {
            if (!otp || otp.length !== 4) {
              Alert.alert('Invalid OTP', 'Please enter a 4-digit code.');
              return;
            }
            if (!params.email) {
              Alert.alert('Error', 'Email not found. Please try again.');
              return;
            }
            
            try {
              setVerifying(true);
              const baseUrl = getApiUrl();
              
              const res = await fetch(`${baseUrl}/api/users/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: params.email, otp }),
              });
              
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                Alert.alert('Verification Failed', data?.message || 'Invalid or expired OTP');
                return;
              }
              
              const data = await res.json();
              Alert.alert('OTP Verified', 'You can now reset your password.', [
                { 
                  text: 'OK', 
                  onPress: () => router.replace({ 
                    pathname: '/reset-password', 
                    params: { token: data.resetToken } 
                  }) 
                },
              ]);
            } catch (e) {
              Alert.alert('Network error', 'Please try again later.');
            } finally {
              setVerifying(false);
            }
          }}
        >
          <ThemedText style={styles.primaryText}>
            {verifying ? 'Verifying…' : 'Verify OTP'}
          </ThemedText>
        </Pressable>
        
        <Pressable onPress={() => router.back()} style={styles.resendBtn}>
          <ThemedText type="link">Didn't receive code? Go back</ThemedText>
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
  otpContainer: { width: '60%', marginBottom: 20 },
  otpInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#0a7ea4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 24,
    textAlign: 'center',
    backgroundColor: '#fff',
    letterSpacing: 8,
  },
  primary: { width: '70%', paddingVertical: 14, borderRadius: 26, alignItems: 'center', marginBottom: 16 },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  resendBtn: { marginTop: 8 },
});
