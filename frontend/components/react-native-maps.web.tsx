// Web fallback for react-native-maps
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MapViewProps {
  children?: React.ReactNode;
  style?: any;
  [key: string]: any;
}

const MapViewComponent = React.forwardRef<any, MapViewProps>((props, ref) => {
  const { children, style } = props;
  
  React.useImperativeHandle(ref, () => ({
    fitToCoordinates: () => {},
    animateToRegion: () => {},
    getMapBoundaries: () => Promise.resolve(null),
  }));
  
  return (
    <View style={[styles.mapContainer, style]}>
      <Text style={styles.placeholderText}>🗺️ Map Preview (Web)</Text>
      <Text style={styles.placeholderSubtext}>Maps are available in the mobile app</Text>
      {children}
    </View>
  );
});

MapViewComponent.displayName = 'MapView';

export const MapView = MapViewComponent;

export const Marker: React.FC<any> = ({ coordinate, title, children, ...props }) => {
  return <View>{children}</View>;
};

export const Polyline: React.FC<any> = ({ coordinates, ...props }) => {
  return null;
};

export const PROVIDER_GOOGLE = 'google';

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  placeholderText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#999',
  },
});
