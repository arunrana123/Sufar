// MAPBOX DIRECTIONS COMPONENT - Shows navigation route on map for worker app
// Features: Display route, turn-by-turn directions, distance and duration
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDirections, metersToKilometers, secondsToMinutes, DEFAULT_MAP_STYLE } from '@/lib/MapboxConfig';

// Conditionally import Mapbox components (native-only, not available on web)
let Mapbox: any = null;
let MapView: any = null;
let Camera: any = null;
let ShapeSource: any = null;
let LineLayer: any = null;
let SymbolLayer: any = null;
let mapboxAvailable = false;

if (Platform.OS !== 'web') {
  try {
    const MapboxModule = require('@rnmapbox/maps');
    Mapbox = MapboxModule.default;
    MapView = MapboxModule.MapView;
    Camera = MapboxModule.Camera;
    ShapeSource = MapboxModule.ShapeSource;
    LineLayer = MapboxModule.LineLayer;
    SymbolLayer = MapboxModule.SymbolLayer;
    mapboxAvailable = true;
    console.log('✅ @rnmapbox/maps loaded successfully');
  } catch (error) {
    console.error('❌ @rnmapbox/maps not available:', error);
    mapboxAvailable = false;
  }
} else {
  console.log('🌐 Web platform: @rnmapbox/maps not available (native-only module)');
  mapboxAvailable = false;
}

interface MapboxDirectionsProps {
  origin: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  onClose?: () => void;
}

export default function MapboxDirections({ origin, destination, onClose }: MapboxDirectionsProps) {
  const [routeData, setRouteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  // Fetches directions when component mounts
  // Triggered by: Component mounted with origin and destination
  useEffect(() => {
    fetchRoute();
  }, [origin, destination]);

  const fetchRoute = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const directions = await getDirections(
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude]
      );
      
      setRouteData(directions);
    } catch (err) {
      console.error('Error fetching route:', err);
      setError('Failed to fetch route. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7A2C" />
        <Text style={styles.loadingText}>Loading route...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchRoute}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show placeholder on web or if Mapbox is not available
  if (Platform.OS === 'web' || !mapboxAvailable || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={64} color="#ccc" />
          <Text style={styles.mapPlaceholderTitle}>
            {Platform.OS === 'web' ? 'Maps Not Available on Web' : 'Maps Not Available'}
          </Text>
          <Text style={styles.mapPlaceholderText}>
            {Platform.OS === 'web' 
              ? 'Maps require native modules and are not available in the web version. Please use the mobile app for map features.'
              : 'Maps require native build. Please build the native app to use map features.'}
          </Text>
          {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView style={styles.map} styleURL={DEFAULT_MAP_STYLE}>
        <Camera
          zoomLevel={12}
          centerCoordinate={[
            (origin.longitude + destination.longitude) / 2,
            (origin.latitude + destination.latitude) / 2,
          ]}
        />
        
        {/* Route Line */}
        {routeData && (
          <ShapeSource id="routeSource" shape={routeData.geometry}>
            <LineLayer
              id="routeLine"
              style={{
                lineColor: '#FF7A2C',
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}
        
        {/* Origin Marker */}
        <ShapeSource
          id="originSource"
          shape={{
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [origin.longitude, origin.latitude],
            },
            properties: {},
          }}
        >
          <SymbolLayer
            id="originSymbol"
            style={{
              iconImage: 'marker-15',
              iconSize: 1.5,
              iconColor: '#10B981',
            }}
          />
        </ShapeSource>
        
        {/* Destination Marker */}
        <ShapeSource
          id="destinationSource"
          shape={{
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [destination.longitude, destination.latitude],
            },
            properties: {},
          }}
        >
          <SymbolLayer
            id="destinationSymbol"
            style={{
              iconImage: 'marker-15',
              iconSize: 1.5,
              iconColor: '#EF4444',
            }}
          />
        </ShapeSource>
      </MapView>

      {/* Route Info */}
      {routeData && (
        <View style={styles.infoContainer}>
          <View style={styles.infoHeader}>
            <View style={styles.infoStats}>
              <View style={styles.statItem}>
                <Ionicons name="navigate" size={20} color="#FF7A2C" />
                <Text style={styles.statValue}>{metersToKilometers(routeData.distance)} km</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="time" size={20} color="#FF7A2C" />
                <Text style={styles.statValue}>{secondsToMinutes(routeData.duration)}</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.stepsToggle}
              onPress={() => setShowSteps(!showSteps)}
            >
              <Text style={styles.stepsToggleText}>
                {showSteps ? 'Hide' : 'Show'} Steps
              </Text>
              <Ionicons
                name={showSteps ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          {/* Turn-by-turn directions */}
          {showSteps && routeData.steps && (
            <ScrollView style={styles.stepsContainer} showsVerticalScrollIndicator={false}>
              {routeData.steps.map((step: any, index: number) => (
                <View key={index} style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepInstruction}>{step.maneuver.instruction}</Text>
                    <Text style={styles.stepDistance}>
                      {metersToKilometers(step.distance)} km
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FF7A2C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  stepsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepsToggleText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  stepsContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF7A2C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  stepContent: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  stepDistance: {
    fontSize: 12,
    color: '#6B7280',
  },
  closeButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 30,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  mapPlaceholderText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
});

