// Mock for react-native-maps on web
import React from 'react';

export const MapView = () => <div style={{ flex: 1, backgroundColor: '#f0f0f0' }} />;
export const Marker = () => null;
export const PROVIDER_GOOGLE = 'google';

export default {
  MapView,
  Marker,
  PROVIDER_GOOGLE,
};
