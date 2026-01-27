// ORDER TRACKING SCREEN - Real-time order tracking with delivery boy location
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';
import { getMapboxDirections } from '@/lib/MapboxDirectionsService';
import { MapView, Marker, Polyline, PROVIDER_GOOGLE } from '@/components/react-native-maps';

interface OrderItem {
  productId: string;
  name: string;
  label: string;
  quantity: number;
  price: number;
}

interface DeliveryBoy {
  id: string;
  name: string;
  phone: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

interface Order {
  _id: string;
  orderId: string;
  userId: string;
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'preparing' | 'assigned' | 'picked' | 'on_way' | 'delivered' | 'cancelled';
  deliveryBoy?: DeliveryBoy;
  deliveryAddress: string;
  total: number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
}

export default function OrderTrackingScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryLocation, setDeliveryLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [routeETA, setRouteETA] = useState<number>(0);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [canRenderChildren, setCanRenderChildren] = useState<boolean>(false);
  const mapRef = useRef<MapView>(null);
  const locationUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user?.id) {
      socketService.connect(user.id, 'user');
    }
    fetchOrder();
    return () => {
      const socketAny = socketService as any;
      socketAny.off('order:updated');
      socketAny.off('order:status_updated');
      socketAny.off('delivery:location_updated');
      if (locationUpdateInterval.current) {
        clearInterval(locationUpdateInterval.current);
      }
    };
  }, [orderId, user?.id]);

  useEffect(() => {
    if (order && (socketService as any).isConnected?.()) {
      // Listen for order updates
      const handleOrderUpdate = (data: any) => {
        if (data.orderId === orderId || data.order?._id === order._id) {
          console.log('📦 Order updated:', data);
          if (data.order) {
            setOrder(data.order);
          } else {
            fetchOrder(); // Refresh order data
          }
        }
      };

      // Listen for order status updates
      const handleStatusUpdate = (data: any) => {
        if (data.orderId === orderId) {
          console.log('📊 Status updated:', data.status);
          setOrder((prev) => prev ? { ...prev, status: data.status } : null);
          
          // If delivered, show rating prompt
          if (data.status === 'delivered' && order.paymentStatus === 'paid') {
            setTimeout(() => {
              handleRateOrder();
            }, 2000);
          }
        }
      };

      // Listen for delivery boy location updates
      const handleLocationUpdate = async (data: any) => {
        if (data.orderId === orderId && data.deliveryBoyId === order.deliveryBoy?.id) {
          console.log('📍 Delivery location updated:', data);
          const newLocation = {
            latitude: data.latitude,
            longitude: data.longitude,
          };
          setDeliveryLocation(newLocation);
          
          // Fetch Mapbox route when we have both locations
          if (userLocation) {
            try {
              const route = await getMapboxDirections(
                newLocation,
                userLocation,
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
          
          // Update map
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: data.latitude,
              longitude: data.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 1000);
          }
        }
      };

      // Use type assertion for custom socket events
      const socketAny = socketService as any;
      socketAny.on('order:updated', handleOrderUpdate);
      socketAny.on('order:status_updated', handleStatusUpdate);
      socketAny.on('delivery:location_updated', handleLocationUpdate);

      // Poll for order updates every 5 seconds
      locationUpdateInterval.current = setInterval(() => {
        fetchOrder();
      }, 5000);

      return () => {
        const socketAny = socketService as any;
        socketAny.off('order:updated', handleOrderUpdate);
        socketAny.off('order:status_updated', handleStatusUpdate);
        socketAny.off('delivery:location_updated', handleLocationUpdate);
        if (locationUpdateInterval.current) {
          clearInterval(locationUpdateInterval.current);
        }
        // Clear map ready timeout
        if (mapReadyTimeoutRef.current) {
          clearTimeout(mapReadyTimeoutRef.current);
          mapReadyTimeoutRef.current = null;
        }
        // Reset map ready states
        setMapReady(false);
        setCanRenderChildren(false);
      };
    }
  }, [order, orderId, userLocation]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/orders/${orderId}`);
      
      if (response.ok) {
        const data = await response.json();
        const orderData = data.order || data;
        setOrder(orderData);
        
        if (orderData.deliveryBoy?.location) {
          setDeliveryLocation(orderData.deliveryBoy.location);
        }

        // Get user location for route calculation
        try {
          const { getCurrentPositionAsync } = await import('expo-location');
          const { requestForegroundPermissionsAsync } = await import('expo-location');
          const { status } = await requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await getCurrentPositionAsync({});
            const userLoc = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
            setUserLocation(userLoc);
            
            // Fetch Mapbox route if we have delivery location
            if (orderData.deliveryBoy?.location) {
              try {
                const route = await getMapboxDirections(
                  {
                    latitude: orderData.deliveryBoy.location.latitude,
                    longitude: orderData.deliveryBoy.location.longitude,
                  },
                  userLoc,
                  'driving-traffic'
                );
                if (route && route.coordinates.length > 0) {
                  setRouteCoordinates(route.coordinates);
                  setRouteDistance(route.distance / 1000); // Convert to km
                  setRouteETA(Math.ceil(route.duration / 60)); // Convert to minutes
                }
              } catch (error) {
                console.error('Error fetching initial route:', error);
              }
            }
          }
        } catch (error) {
          console.log('Could not get user location:', error);
        }
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Order not found' }));
        Alert.alert('Error', errorData.message || 'Order not found');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'confirmed': return '#3B82F6';
      case 'preparing': return '#8B5CF6';
      case 'assigned': return '#10B981';
      case 'picked': return '#06B6D4';
      case 'on_way': return '#6366F1';
      case 'delivered': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return theme.secondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Order Pending';
      case 'confirmed': return 'Order Confirmed';
      case 'preparing': return 'Preparing Order';
      case 'assigned': return 'Delivery Boy Assigned';
      case 'picked': return 'Order Picked Up';
      case 'on_way': return 'On the Way';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const handleCallDeliveryBoy = () => {
    if (order?.deliveryBoy?.phone) {
      const phoneUrl = `tel:${order.deliveryBoy.phone}`;
      // Linking.openURL(phoneUrl);
      Alert.alert('Call', `Call ${order.deliveryBoy.name} at ${order.deliveryBoy.phone}`);
    }
  };

  const handleRateOrder = () => {
    router.push({
      pathname: '/order-review',
      params: { orderId: order?._id || orderId },
    });
  };

  const handleConfirmCODPayment = async () => {
    if (!order) return;

    Alert.alert(
      'Confirm Payment',
      `Have you received the order and paid Rs. ${order.total.toLocaleString()} to the delivery boy?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Paid',
          onPress: async () => {
            try {
              const apiUrl = getApiUrl();
              const response = await fetch(`${apiUrl}/api/orders/${order._id}/payment`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  paymentStatus: 'paid',
                  transactionId: `COD-${Date.now()}`,
                }),
              });

              if (response.ok) {
                fetchOrder(); // Refresh order
                Alert.alert('Payment Confirmed', 'Thank you for confirming the payment!');
                
                // Navigate to rating after a delay
                setTimeout(() => {
                  handleRateOrder();
                }, 2000);
              } else {
                throw new Error('Failed to confirm payment');
              }
            } catch (error) {
              console.error('Payment confirmation error:', error);
              Alert.alert('Error', 'Failed to confirm payment. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getStatusSteps = () => {
    const statuses = ['pending', 'confirmed', 'preparing', 'assigned', 'picked', 'on_way', 'delivered'];
    const currentIndex = statuses.indexOf(order?.status || 'pending');
    return statuses.map((status, index) => ({
      status,
      label: getStatusText(status),
      completed: index <= currentIndex,
      current: index === currentIndex,
    }));
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.text }]}>
              Loading order details...
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!order) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe}>
          <View style={[styles.header, { backgroundColor: theme.tint }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>
              Order Tracking
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={80} color={theme.icon} />
            <ThemedText style={[styles.emptyText, { color: theme.text }]}>
              Order not found
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>
            Order #{order.orderId}
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Order Status Timeline */}
          <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              Order Status
            </ThemedText>
            <View style={styles.timeline}>
              {getStatusSteps().map((step, index) => (
                <View key={step.status} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                    {index > 0 && (
                      <View
                        style={[
                          styles.timelineLineConnector,
                          { backgroundColor: step.completed ? theme.primary : theme.border },
                        ]}
                      />
                    )}
                    <View
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor: step.completed ? theme.primary : theme.background,
                          borderColor: step.completed ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      {step.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </View>
                  <View style={styles.timelineContent}>
                    <ThemedText
                      style={[
                        styles.timelineLabel,
                        {
                          color: step.completed ? theme.text : theme.secondary,
                          fontWeight: step.current ? 'bold' : 'normal',
                        },
                      ]}
                    >
                      {step.label}
                    </ThemedText>
                    {step.current && step.status === 'on_way' && deliveryLocation && (
                      <ThemedText style={[styles.timelineSubtext, { color: theme.secondary }]}>
                        Delivery boy is on the way
                      </ThemedText>
                    )}
                  </View>
                </View>
              ))}
            </View>
            {order.estimatedDelivery && (
              <View style={styles.estimatedContainer}>
                <Ionicons name="time-outline" size={16} color={theme.primary} />
                <ThemedText style={[styles.estimatedText, { color: theme.secondary }]}>
                  Estimated Delivery: {new Date(order.estimatedDelivery).toLocaleString()}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Delivery Boy Info */}
          {order.deliveryBoy && (
            <View style={[styles.deliveryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.deliveryHeader}>
                <Ionicons name="bicycle" size={24} color={theme.primary} />
                <ThemedText style={[styles.deliveryTitle, { color: theme.text }]}>
                  Delivery Boy
                </ThemedText>
              </View>
              <View style={styles.deliveryInfo}>
                <ThemedText style={[styles.deliveryName, { color: theme.text }]}>
                  {order.deliveryBoy.name}
                </ThemedText>
                <ThemedText style={[styles.deliveryPhone, { color: theme.secondary }]}>
                  {order.deliveryBoy.phone}
                </ThemedText>
              </View>
              <TouchableOpacity
                style={[styles.callButton, { backgroundColor: theme.primary }]}
                onPress={handleCallDeliveryBoy}
              >
                <Ionicons name="call" size={20} color="#fff" />
                <ThemedText style={styles.callButtonText}>Call Delivery Boy</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* Map */}
          {(deliveryLocation || userLocation) && (
            <View style={[styles.mapContainer, { backgroundColor: theme.card, borderColor: theme.border }]} collapsable={false}>
              <ThemedText style={[styles.mapTitle, { color: theme.text }]}>
                Live Tracking
              </ThemedText>
              <View style={styles.mapWrapper} collapsable={false}>
                <MapView
                  key="map-component-stable-never-unmount"
                  ref={mapRef}
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  removeClippedSubviews={false}
                  collapsable={false}
                  initialRegion={{
                    latitude: deliveryLocation?.latitude || userLocation?.latitude || 27.7172,
                    longitude: deliveryLocation?.longitude || userLocation?.longitude || 85.3240,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  onMapReady={() => {
                    console.log('✅ Map ready in order-tracking');
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
                      {/* Delivery Boy marker - Use native pinColor */}
                      {deliveryLocation && (
                        <Marker
                          key="delivery-marker-universal"
                          identifier="delivery-marker"
                          coordinate={deliveryLocation}
                          title="Delivery Boy"
                          description={order.deliveryBoy?.name || 'Delivery in progress'}
                          pinColor={theme.primary || '#2563EB'}
                          anchor={{ x: 0.5, y: 1 }}
                          tracksViewChanges={false}
                        />
                      )}
                      {/* User Location marker - Use native pinColor */}
                      {userLocation && (
                        <Marker
                          key="user-marker-universal"
                          identifier="user-marker"
                          coordinate={userLocation}
                          title="Your Location"
                          description="Delivery Address"
                          pinColor="#4CAF50"
                          anchor={{ x: 0.5, y: 1 }}
                          tracksViewChanges={false}
                        />
                      )}
                      {/* Route Line - Mapbox route visualization on road - ALWAYS render when route exists */}
                      {routeCoordinates.length > 1 && (
                        <Polyline
                          key={`route-polyline-${routeCoordinates.length}`}
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
                </MapView>
              </View>
              {order.status === 'on_way' && deliveryLocation && userLocation && (
                <View style={styles.distanceInfo}>
                  <Ionicons name="navigate" size={16} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.distanceText, { color: theme.text }]}>
                      Delivery boy is on the way to your location
                    </ThemedText>
                    {routeDistance > 0 && (
                      <ThemedText style={[styles.distanceSubtext, { color: theme.secondary }]}>
                        {routeDistance.toFixed(2)} km away • ETA: {routeETA} min
                      </ThemedText>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Order Items */}
          <View style={[styles.itemsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              Order Items
            </ThemedText>
            {order.items.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <ThemedText style={[styles.itemName, { color: theme.text }]}>
                  {item.label || item.name} x{item.quantity}
                </ThemedText>
                <ThemedText style={[styles.itemPrice, { color: theme.text }]}>
                  Rs. {(item.price * item.quantity).toLocaleString()}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Delivery Address */}
          <View style={[styles.addressCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              Delivery Address
            </ThemedText>
            <View style={styles.addressContent}>
              <Ionicons name="location" size={20} color={theme.primary} />
              <ThemedText style={[styles.addressText, { color: theme.text }]}>
                {order.deliveryAddress}
              </ThemedText>
            </View>
          </View>

          {/* Order Summary */}
          <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              Order Summary
            </ThemedText>
            <View style={styles.summaryRow}>
              <ThemedText style={[styles.summaryLabel, { color: theme.text }]}>Total:</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.primary }]}>
                Rs. {order.total.toLocaleString()}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={[styles.summaryLabel, { color: theme.text }]}>Payment:</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
              </ThemedText>
            </View>
          </View>

          {/* COD Payment Confirmation */}
          {order.status === 'delivered' && order.paymentMethod === 'cod' && order.paymentStatus === 'pending' && (
            <TouchableOpacity
              style={[styles.codPaymentButton, { backgroundColor: '#FF9800' }]}
              onPress={handleConfirmCODPayment}
            >
              <Ionicons name="cash" size={20} color="#fff" />
              <ThemedText style={styles.codPaymentButtonText}>
                Confirm Cash Payment (Rs. {order.total.toLocaleString()})
              </ThemedText>
            </TouchableOpacity>
          )}

          {/* Rate Order Button */}
          {order.status === 'delivered' && order.paymentStatus === 'paid' && (
            <TouchableOpacity
              style={[styles.rateButton, { backgroundColor: theme.primary }]}
              onPress={handleRateOrder}
            >
              <Ionicons name="star" size={20} color="#fff" />
              <ThemedText style={styles.rateButtonText}>Rate & Review Order</ThemedText>
            </TouchableOpacity>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
    paddingVertical: 20,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  timeline: {
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineLine: {
    width: 30,
    alignItems: 'center',
    position: 'relative',
  },
  timelineLineConnector: {
    position: 'absolute',
    top: -16,
    left: 14,
    width: 2,
    height: 16,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
  },
  timelineLabel: {
    fontSize: 14,
    marginBottom: 2,
  },
  timelineSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  estimatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  estimatedText: {
    fontSize: 12,
    marginLeft: 8,
  },
  deliveryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  deliveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  deliveryTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  deliveryInfo: { marginBottom: 12 },
  deliveryName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  deliveryPhone: { fontSize: 14 },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  callButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  mapContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  mapTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  mapWrapper: {
    height: 250,
    borderRadius: 8,
    overflow: 'hidden',
  },
  map: { flex: 1 },
  deliveryMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF7A2C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#f0f7ff',
  },
  distanceText: {
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '600',
  },
  distanceSubtext: {
    fontSize: 12,
    marginLeft: 8,
    marginTop: 2,
  },
  codPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  codPaymentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
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
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  rateButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 18, marginTop: 16 },
});
