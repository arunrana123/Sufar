import { BlurView } from 'expo-blur';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import React, { useContext } from 'react';
import { StyleSheet } from 'react-native';

export default function TabBarBackground() {
  return <BlurView intensity={100} style={StyleSheet.absoluteFill} />;
}

export function useBottomTabOverflow() {
  return useContext(BottomTabBarHeightContext) ?? 0;
}


