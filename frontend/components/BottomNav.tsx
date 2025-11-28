import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { usePathname, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';

type TabKey = 'home' | 'record' | 'tracking' | 'menu';

function getTarget(key: TabKey) {
  switch (key) {
    case 'home':
      return '/home';
    case 'record':
      return '/record';
    case 'tracking':
      return '/tracking';
    case 'menu':
      return '/menu';
  }
}

export default function BottomNav() {
  const pathname = usePathname();

  const items: Array<{ key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }>= [
    { key: 'home', label: 'Home', icon: 'home' },
    { key: 'record', label: 'Record', icon: 'disc-outline' },
    { key: 'tracking', label: 'Tracking', icon: 'locate-outline' },
    { key: 'menu', label: 'Menu', icon: 'grid-outline' },
  ];

  return (
    <View style={styles.container}>
      {items.map((it, index) => {
        const target = getTarget(it.key);
        const active = pathname === target;
        const color = active ? '#FF7A2C' : '#000';
        return (
          <React.Fragment key={it.key}>
            <Pressable
              style={styles.item}
              onPress={() => router.replace(target)}
              android_ripple={{ color: '#00000010', radius: 28 }}
            >
              <Ionicons name={it.icon} size={24} color={color} />
              <ThemedText style={[styles.label, { color: '#111' }]}>{it.label}</ThemedText>
            </Pressable>
            {index === 1 && (
              <Pressable 
                style={[
                  styles.plusBtn, 
                  pathname === '/qr-scanner' && { backgroundColor: '#FF7A2C' }
                ]} 
                onPress={() => router.replace('/qr-scanner')}
              >
                <Ionicons name="scan" size={28} color="#fff" />
              </Pressable>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 18, android: 12 }),
    backgroundColor: '#BFE3FF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  item: { alignItems: 'center', gap: 4 },
  label: { fontSize: 14 },
  plusBtn: {
    position: 'absolute',
    top: -20,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});


