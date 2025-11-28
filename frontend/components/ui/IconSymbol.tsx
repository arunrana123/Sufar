import React from 'react';
import { Platform } from 'react-native';

export function IconSymbol({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  // iOS has a platform file `IconSymbol.ios.tsx` that renders using expo-symbols.
  // On Android and others, render nothing to avoid loading iOS-only modules.
  if (Platform.OS === 'ios') {
    // This branch will be replaced by IconSymbol.ios.tsx at build time.
    return null as any;
  }
  return null;
}


