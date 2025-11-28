import React from 'react';
import { SymbolView } from 'expo-symbols';

export function IconSymbol({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return <SymbolView name={name as any} tintColor={color} size={size} />;
}


