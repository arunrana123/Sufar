// ORDER DELIVERY TRACKING - Worker's view for tracking market order deliveries
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';
import { getMapboxDirections } from '@/lib/MapboxDirectionsService';

// Load react-native-maps for map rendering (only on native platforms, not web)
let RNMapView: any = null;
let RNMarker: any = null;
let RNPolyline: any = null;
let mapsAvailable = false;

if (Platform.OS !== 'web') {
  try {
    const RNMaps = require('react-native-maps');
    RNMapView = RNMaps.default || RNMaps;
    RNMarker = RNMaps.Marker;
    RNPolyline = RNMaps.Polyline;
    mapsAvailable = true;
    console.log('✅ react-native-maps loaded successfully');
  } catch (mapsError) {
    console.error('❌ react-native-maps not available:', mapsError);
    mapsAvailable = false;
  }
} else {
  console.log('🌐 Web platform: react-native-maps not available (native-only module)');
  mapsAvailable = false;
}

interface OrderItem {
  productId: string;
  name: string;
  label?: string;
  quantity: number;
  price: number;
  deliveryAddress?: string;
}

interface Order {
  _id: string;
  orderId: string;
  userId: string;
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'preparing' | 'assigned' | 'picked' | 'on_way' | 'delivered' | 'cancelled';
  deliveryAddress: string;
  total: number;
  paymentMethod: 'online' | 'cod';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: string;
  estimatedDelivery?: string;
}

export default function OrderDeliveryTrackingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  // Create theme object compatible with the code
  const theme = {
    text: colors.text,
    background: colors.background,
    tint: colors.tint,
    icon: colors.icon,
    primary: colors.tint, // Use tint as primary
    secondary: colors.icon, // Use icon as secondary
    card: colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF',
    border: colorScheme === 'dark' ? '#333333' : '#E0E0E0',
    danger: '#FF4444',
  };
  const { worker } = useAuth();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [routeETA, setRouteETA] = useState<number>(0);
  const [isTracking, setIsTracking] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [canRenderChildren, setCanRenderChildren] = useState<boolean>(false);
  const mapRef = useRef<any>(null);
  const mapReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (worker?.id) {
      socketService.connect(worker.id, 'worker');
    }
    fetchOrder();
    requestLocationPermission();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      const socketAny = socketService as any;
      socketAny.off('order:status_updated');
      socketAny.off('order:updated');
    };
  }, [orderId, worker?.id]);

  useEffect(() => {
    if (order) {
      const handleStatusUpdate = (data: any) => {
        if (data.orderId === orderId) {
          setOrder((prev) => prev ? { ...prev, status: data.status } : null);
        }
      };

      const handleOrderUpdate = (data: any) => {
        if (data.orderId === orderId || data.order?._id === order._id) {
          fetchOrder();
        }
      };

      const socketAny = socketService as any;
      socketAny.on('order:status_updated', handleStatusUpdate);
      socketAny.on('order:updated', handleOrderUpdate);

      return () => {
        socketAny.off('order:status_updated', handleStatusUpdate);
        socketAny.off('order:updated', handleOrderUpdate);
      };
    }
  }, [order, orderId]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Location permission error:', error);
    }
  };

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/orders/${orderId}`);
      
      if (response.ok) {
        const data = await response.json();
        const orderData = data.order || data;
        setOrder(orderData);

        // Geocode delivery address to get coordinates
        if (orderData.deliveryAddress) {
          try {
            const geocodeResult = await Location.geocodeAsync(orderData.deliveryAddress);
            if (geocodeResult && geocodeResult.length > 0) {
              const destLoc = {
                latitude: geocodeResult[0].latitude,
                longitude: geocodeResult[0].longitude,
              };
              setDestinationLocation(destLoc);
              
              // Fetch Mapbox route if we have current location
              if (currentLocation) {
                try {
                  const route = await getMapboxDirections(
                    currentLocation,
                    destLoc,
                    'driving-traffic'
                  );
                  if (route && route.coordinates.length > 0) {
                    setRouteCoordinates(route.coordinates);
                    setRouteDistance(route.distance / 1000); // Convert to km
                    setRouteETA(Math.ceil(route.duration / 60)); // Convert to minutes
                  }
                } catch (error) {
                  console.error('Error fetching route:', error);
                }
              }
            }
          } catch (error) {
            console.log('Could not geocode address:', error);
          }
        }
      } else {
        Alert.alert('Error', 'Order not found');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required for tracking');
        return;
      }

      setIsTracking(true);

      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(newLocation);

      // Fetch Mapbox route if we have destination
      if (destinationLocation) {
        try {
          const route = await getMapboxDirections(
            newLocation,
            destinationLocation,
            'driving-traffic'
          );
          if (route && route.coordinates.length > 0) {
            setRouteCoordinates(route.coordinates);
            setRouteDistance(route.distance / 1000); // Convert to km
            setRouteETA(Math.ceil(route.duration / 60)); // Convert to minutes
          }
        } catch (error) {
          console.error('Error fetching route:', error);
        }
      }

      // Watch position
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        async (location) => {
          const loc = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setCurrentLocation(loc);

          // Update backend with location
          updateDeliveryLocation(loc);

          // Update Mapbox route every 10 seconds (throttled)
          const now = Date.now();
          const lastRouteUpdate = (mapRef.current as any)?._lastRouteUpdate || 0;
          if (destinationLocation && now - lastRouteUpdate > 10000) {
            (mapRef.current as any)._lastRouteUpdate = now;
            try {
              const route = await getMapboxDirections(
                loc,
                destinationLocation,
                'driving-traffic'
              );
              if (route && route.coordinates.length > 0) {
                setRouteCoordinates(route.coordinates);
                setRouteDistance(route.distance / 1000); // Convert to km
                setRouteETA(Math.ceil(route.duration / 60)); // Convert to minutes
              }
            } catch (error) {
              console.error('Error updating route:', error);
            }
          }

          // Update map
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: loc.latitude,
              longitude: loc.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 1000);
          }
        }
      );

      setLocationSubscription(subscription);
    } catch (error) {
      console.error('Location tracking error:', error);
      Alert.alert('Error', 'Failed to start location tracking');
    }
  };

  const stopLocationTracking = () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
    setIsTracking(false);
  };

  const updateDeliveryLocation = async (location: { latitude: number; longitude: number }) => {
    try {
      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/api/orders/${orderId}/delivery-location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });
    } catch (error) {
      console.error('Error updating delivery location:', error);
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchOrder();
        
        if (newStatus === 'delivered') {
          stopLocationTracking();
          Alert.alert(
            'Order Delivered!',
            'Order has been marked as delivered. Please collect payment if COD.',
            [
              {
                text: 'Collect Payment',
                onPress: () => handleCollectPayment(),
              },
              { text: 'OK' },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const handleCollectPayment = async () => {
    if (!order || order.paymentMethod !== 'cod') return;

    Alert.alert(
      'Collect Payment',
      `Have you collected Rs. ${order.total.toLocaleString()} from the customer?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Collected',
          onPress: async () => {
            try {
              const apiUrl = getApiUrl();
              const response = await fetch(`${apiUrl}/api/orders/${orderId}/payment`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  paymentStatus: 'paid',
                  transactionId: `COD-${Date.now()}`,
                  confirmedBy: 'delivery_boy',
                }),
              });

              if (response.ok) {
                Alert.alert('Success', 'Payment confirmed successfully!');
                fetchOrder();
              } else {
                throw new Error('Failed to confirm payment');
              }
            } catch (error) {
              console.error('Payment confirmation error:', error);
              Alert.alert('Error', 'Failed to confirm payment');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return '#10B981';
      case 'picked': return '#06B6D4';
      case 'on_way': return '#6366F1';
      case 'delivered': return '#10B981';
      default: return theme.secondary;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Loading order...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']}>
          <View style={[styles.header, { backgroundColor: theme.tint }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: '#fff' }]}>
              Order Tracking
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={80} color={theme.icon} />
            <Text style={[styles.emptyText, { color: theme.text }]}>
              Order not found
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']}>
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: '#fff' }]}>
            Order #{order.orderId}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Order Status */}
          <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.statusHeader}>
              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(order.status)}20` }]}>
                <Ionicons name="cube" size={24} color={getStatusColor(order.status)} />
              </View>
              <View style={styles.statusInfo}>
                <Text style={[styles.statusText, { color: theme.text }]}>
                  {order.status === 'assigned' ? 'Assigned' : 
                   order.status === 'picked' ? 'Picked Up' :
                   order.status === 'on_way' ? 'On the Way' :
                   order.status === 'delivered' ? 'Delivered' : order.status}
                </Text>
                <Text style={[styles.statusSubtext, { color: theme.secondary }]}>
                  Total: Rs. {order.total.toLocaleString()}
                </Text>
                {routeDistance > 0 && order.status === 'on_way' && (
                  <Text style={[styles.statusSubtext, { color: theme.primary, marginTop: 4 }]}>
                    📍 {routeDistance.toFixed(2)} km • ⏱️ ETA: {routeETA} min
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Order Items */}
          <View style={[styles.itemsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Order Items
            </Text>
            {order.items.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <Text style={[styles.itemName, { color: theme.text }]}>
                  {item.label || item.name} x{item.quantity}
                </Text>
                <Text style={[styles.itemPrice, { color: theme.text }]}>
                  Rs. {(item.price * item.quantity).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>

          {/* Delivery Address */}
          <View style={[styles.addressCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Delivery Address
            </Text>
            <View style={styles.addressContent}>
              <Ionicons name="location" size={20} color={theme.primary} />
              <Text style={[styles.addressText, { color: theme.text }]}>
                {order.deliveryAddress}
              </Text>
            </View>
          </View>

          {/* Map */}
          {(currentLocation || destinationLocation) && (
            <View style={[styles.mapContainer, { backgroundColor: theme.card, borderColor: theme.border }]} collapsable={false}>
              <Text style={[styles.mapTitle, { color: theme.text }]}>
                Delivery Route
              </Text>
              <View style={styles.mapWrapper} collapsable={false}>
                {mapsAvailable && RNMapView ? (
                <RNMapView
                  key="map-component-stable-never-unmount"
                  ref={mapRef}
                  style={styles.map}
                  provider={Platform.OS === 'android' ? 'google' : undefined}
                  removeClippedSubviews={false}
                  collapsable={false}
                  initialRegion={{
                    latitude: currentLocation?.latitude || destinationLocation?.latitude || 27.7172,
                    longitude: currentLocation?.longitude || destinationLocation?.longitude || 85.3240,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  onMapReady={() => {
                    console.log('✅ Map ready in order-delivery-tracking');
                    setMapReady(true);
                    
                    // CRITICAL FIX: Longer delay for lower-end Android devices (Samsung A70, Realme 14C)
                    if (Platform.OS === 'android') {
                      if (mapReadyTimeoutRef.current) {
                        clearTimeout(mapReadyTimeoutRef.current);
                      }
                      
                      // Universal delay: Works on ALL Android devices (low-end to high-end)
                      // Use 2 frames + 500ms delay - balanced for all devices
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          mapReadyTimeoutRef.current = setTimeout(() => {
                            console.log('✅ Map children can now render safely (universal delay)');
                            setCanRenderChildren(true);
                          }, 500);
                        });
                      });
                    } else {
                      setCanRenderChildren(true);
                    }
                  }}
                >
                  {/* UNIVERSAL FIX: Use native markers (pinColor) for maximum compatibility across all devices/OS */}
                  {/* Render markers only when map is ready - works on ALL devices (Android/iOS, any model) */}
                  {mapReady && canRenderChildren && (
                    <>
                      {/* Worker/Delivery Boy marker - Use native pinColor */}
                      {currentLocation && (
                        <RNMarker
                          key="worker-location-marker-universal"
                          identifier="worker-location-marker"
                          coordinate={currentLocation}
                          title="Your Location"
                          description="Delivery Boy Location"
                          pinColor={theme.primary || '#2563EB'}
                          anchor={{ x: 0.5, y: 1 }}
                          tracksViewChanges={false}
                        />
                      )}
                      {/* Destination marker - Use native pinColor */}
                      {destinationLocation && (
                        <RNMarker
                          key="destination-marker-universal"
                          identifier="destination-marker"
                          coordinate={destinationLocation}
                          title="Delivery Address"
                          description={order.deliveryAddress || 'Destination'}
                          pinColor="#4CAF50"
                          anchor={{ x: 0.5, y: 1 }}
                          tracksViewChanges={false}
                        />
                      )}
                      {/* Route Line - Mapbox route visualization on road - ALWAYS render when route exists */}
                      {routeCoordinates.length > 1 && (
                        <RNPolyline
                          key={`route-polyline-${routeCoordinates.length}`}
                          identifier="route-polyline"
                          coordinates={routeCoordinates}
                          strokeColor={theme.primary || '#2563EB'}
                          strokeWidth={Platform.OS === 'ios' ? 4 : 5}
                          lineCap="round"
                          lineJoin="round"
                          geodesic={true}
                          tappable={false}
                          zIndex={1}
                        />
                      )}
                    </>
                  )}
                </RNMapView>
                ) : (
                  <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card }]}>
                    <Text style={{ color: theme.text }}>Map not available</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {!isTracking && order.status !== 'delivered' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={startLocationTracking}
              >
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Start Tracking</Text>
              </TouchableOpacity>
            )}

            {isTracking && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
                onPress={stopLocationTracking}
              >
                <Ionicons name="stop-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Stop Tracking</Text>
              </TouchableOpacity>
            )}

            {order.status === 'assigned' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#06B6D4' }]}
                onPress={() => updateOrderStatus('picked')}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Mark as Picked</Text>
              </TouchableOpacity>
            )}

            {order.status === 'picked' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#6366F1' }]}
                onPress={() => {
                  updateOrderStatus('on_way');
                  if (!isTracking) {
                    startLocationTracking();
                  }
                }}
              >
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Start Delivery</Text>
              </TouchableOpacity>
            )}

            {order.status === 'on_way' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#10B981' }]}
                onPress={() => updateOrderStatus('delivered')}
              >
                <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Mark as Delivered</Text>
              </TouchableOpacity>
            )}

            {order.status === 'delivered' && order.paymentMethod === 'cod' && order.paymentStatus === 'pending' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
                onPress={handleCollectPayment}
              >
                <Ionicons name="cash" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>
                  Collect Payment (Rs. {order.total.toLocaleString()})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 60,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: { padding: 8, marginLeft: -8, marginRight: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  content: { flex: 1, padding: 16 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusInfo: { flex: 1 },
  statusText: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  statusSubtext: { fontSize: 12 },
  itemsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemName: { flex: 1, fontSize: 14 },
  itemPrice: { fontSize: 14, fontWeight: '600' },
  addressCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  addressContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  mapContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  mapWrapper: {
    height: 300,
    borderRadius: 8,
    overflow: 'hidden',
  },
  map: { flex: 1 },
  workerMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF7A2C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  destinationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 18, marginTop: 16 },
});
