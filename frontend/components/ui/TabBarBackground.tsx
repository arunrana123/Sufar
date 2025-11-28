import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

export default function TabBarBackground() {
  if (Platform.OS === 'ios') {
    return <BlurView intensity={100} style={StyleSheet.absoluteFill} /> as any;
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.9)' }]} />;
}

export function useBottomTabOverflow() {
  return 0;
}


