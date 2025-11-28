import { SafeAreaView, StyleSheet, View, Pressable } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import BottomNav from '@/components/BottomNav';

export default function AddServiceScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.replace('/home')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ThemedText type="title">Add Service</ThemedText>
          <ThemedText style={{ marginTop: 8 }}>Create your custom service here</ThemedText>
        </View>
      </SafeAreaView>
      <BottomNav />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  backBtn: { position: 'absolute', top: 20, left: 12, padding: 6, zIndex: 10 },
});
