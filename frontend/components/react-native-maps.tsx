import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MapViewProps {
  children?: React.ReactNode;
  provider?: string;
  style?: any;
  initialRegion?: any;
  onRegionChangeComplete?: () => void;
}

interface MarkerProps {
  coordinate?: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

interface PolylineProps {
  coordinates?: Array<{ latitude: number; longitude: number }>;
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
}

export const MapView = forwardRef<any, MapViewProps>(({ children, style, initialRegion }, ref) => {
  return (
    <View ref={ref} style={[styles.mapContainer, style]}>
      <Text style={styles.placeholderText}>
        Map view is not available on web platform
      </Text>
      {initialRegion && (
        <Text style={styles.coordinatesText}>
          Viewing: {initialRegion.latitude.toFixed(4)}, {initialRegion.longitude.toFixed(4)}
        </Text>
      )}
      {children}
    </View>
  );
});

MapView.displayName = 'MapView';

export const Marker: React.FC<MarkerProps> = ({ coordinate, title, children }) => {
  return (
    <View style={styles.markerContainer}>
      {children || (
        <>
          <Text style={styles.markerText}>{title || '📍'}</Text>
          {coordinate && (
            <Text style={styles.markerCoordinates}>
              {coordinate.latitude.toFixed(4)}, {coordinate.longitude.toFixed(4)}
            </Text>
          )}
        </>
      )}
    </View>
  );
};

export const Polyline: React.FC<PolylineProps> = ({ coordinates, strokeColor, strokeWidth, lineDashPattern }) => {
  return (
    <View style={styles.polylineContainer}>
      <Text style={styles.polylineText}>
        {coordinates && coordinates.length > 0 ? `Route: ${coordinates.length} points` : 'No route'}
      </Text>
    </View>
  );
};

export const PROVIDER_GOOGLE = 'google';

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    minHeight: 300,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  coordinatesText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  markerContainer: {
    backgroundColor: 'transparent',
  },
  markerText: {
    fontSize: 12,
  },
  markerCoordinates: {
    fontSize: 10,
    color: '#999',
  },
});

export default { MapView, Marker, PROVIDER_GOOGLE };
