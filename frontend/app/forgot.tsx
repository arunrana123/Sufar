// FORGOT PASSWORD SCREEN - Initiates password reset via email OTP
// Features: Email input, sends OTP to email, navigates to verify-otp screen
import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, TextInput, View, Pressable, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getApiUrl } from '@/lib/config';

export default function ForgotScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.replace('/signin')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.title, { color: theme.tint }]}>Forgot password</ThemedText>
        <ThemedText style={styles.helper}>Enter your email to reset your password</ThemedText>
        <View style={styles.inputWrap}>
          <TextInput value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" />
        </View>
        <Pressable
          style={[styles.primary, { backgroundColor: theme.tint, opacity: sending ? 0.7 : 1 }]}
          disabled={sending}
          onPress={async () => {
            if (!email || !email.trim()) {
              Alert.alert('Missing email', 'Please enter your email address.');
              return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
              Alert.alert('Invalid email', 'Please enter a valid email address.');
              return;
            }
            
            try {
              setSending(true);
              const baseUrl = getApiUrl();
              
              const res = await fetch(`${baseUrl}/api/users/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
              });
              
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                Alert.alert('Error', data?.message || 'Could not request password reset');
                return;
              }
              
              const data = await res.json();
              Alert.alert('OTP Sent', 'A 4-digit code has been sent to your email. Check your console for the code during testing.', [
                { text: 'OK', onPress: () => router.replace({ pathname: '/verify-otp', params: { email: email.trim().toLowerCase() } }) },
              ]);
            } catch (e) {
              console.error('Forgot password error:', e);
              Alert.alert('Network error', 'Please check your connection and try again.');
            } finally {
              setSending(false);
            }
          }}
        >
          <ThemedText style={styles.primaryText}>{sending ? 'Sending…' : 'Send reset link'}</ThemedText>
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
  helper: { fontSize: 16, marginBottom: 14 },
  inputWrap: { width: '85%' },
  input: { width: '100%', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: '#00000055', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  primary: { width: '70%', paddingVertical: 14, borderRadius: 26, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});


