import React from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

export function HapticTab({ onPress, ...rest }: BottomTabBarButtonProps) {
  return (
    <TouchableOpacity
      {...rest}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          Haptics.selectionAsync();
        }
        onPress?.(e);
      }}
    />
  );
}


