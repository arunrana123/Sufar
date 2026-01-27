// CHECKOUT SCREEN - Order review, payment method selection, and payment processing
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useCart, PaymentMethod, WalletProvider } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';

export default function CheckoutScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const {
    items,
    paymentMethod,
    walletProvider,
    rewardPointsUsed,
    setPaymentMethod,
    setWalletProvider,
    setRewardPointsUsed,
    getSubtotal,
    getDeliveryCharge,
    getRewardPointsDiscount,
    getFinalTotal,
    clearCart,
  } = useCart();

  const [rewardPoints, setRewardPoints] = useState<number>((user as any)?.rewardPoints || 0);
  const [useRewardPoints, setUseRewardPoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    fetchRewardPoints();
  }, [user?.id]);

  const fetchRewardPoints = async () => {
    if (!user?.id) return;
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/users/${user.id}`);
      if (response.ok) {
        const userData = await response.json();
        setRewardPoints(userData.rewardPoints || 0);
      }
    } catch (error) {
      console.error('Error fetching reward points:', error);
    }
  };

  const subtotal = getSubtotal();
  const deliveryCharge = getDeliveryCharge();
  const codExtra = paymentMethod === 'cod' ? 20 : 0;
  const discount = useRewardPoints ? getRewardPointsDiscount(pointsToUse) : 0;
  const finalTotal = Math.max(0, subtotal + deliveryCharge + codExtra - discount);

  const handleRewardPointsToggle = () => {
    if (!useRewardPoints && rewardPoints >= 100) {
      setUseRewardPoints(true);
      setPointsToUse(Math.min(rewardPoints, Math.floor(subtotal * 50))); // Max 50% of subtotal
    } else {
      setUseRewardPoints(false);
      setPointsToUse(0);
      setRewardPointsUsed(0);
    }
  };

  const handlePointsChange = (value: string) => {
    const points = parseInt(value) || 0;
    const maxPoints = Math.min(rewardPoints, Math.floor(subtotal * 50));
    setPointsToUse(Math.min(points, maxPoints));
    setRewardPointsUsed(Math.min(points, maxPoints));
  };

  const handlePlaceOrder = async () => {
    if (!paymentMethod) {
      Alert.alert('Payment Method Required', 'Please select a payment method.');
      return;
    }

    if (paymentMethod === 'online' && !walletProvider) {
      Alert.alert('Wallet Required', 'Please select a payment wallet.');
      return;
    }

    setProcessingPayment(true);

    try {
      const apiUrl = getApiUrl();
      // Get delivery address from first item or use a default
      const deliveryAddress = items.find(item => item.selectedDeliveryAddress)?.selectedDeliveryAddress || 
                             items[0]?.selectedDeliveryAddress || 
                             'Delivery address not specified';

      const orderData = {
        userId: user?.id,
        items: items.map(item => ({
          productId: item._id,
          name: item.name,
          label: item.label,
          price: item.price,
          quantity: item.quantity,
          deliveryAddress: item.selectedDeliveryAddress,
        })),
        subtotal,
        deliveryCharge,
        codExtra,
        rewardPointsUsed: useRewardPoints ? pointsToUse : 0,
        discount,
        total: finalTotal,
        paymentMethod,
        walletProvider: paymentMethod === 'online' ? walletProvider : null,
        status: 'pending',
        deliveryAddress, // Add delivery address at order level
      };

      if (paymentMethod === 'online') {
        if (!walletProvider) {
          Alert.alert('Wallet Required', 'Please select a payment wallet (PhonePay, eSewa, or Stripe).');
          return;
        }
        // Navigate to payment processing page
        router.push({
          pathname: '/payment-process',
          params: {
            orderType: 'market',
            amount: finalTotal.toString(),
            orderData: JSON.stringify(orderData),
            walletProvider: walletProvider,
            rewardPointsUsed: (useRewardPoints ? pointsToUse : 0).toString(),
            discount: discount.toString(),
            subtotal: subtotal.toString(),
            deliveryCharge: deliveryCharge.toString(),
            codExtra: codExtra.toString(),
          },
        });
      } else {
        // Cash on Delivery - Create order directly
        const response = await fetch(`${apiUrl}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });

        if (response.ok) {
          const result = await response.json();
          clearCart();
          Alert.alert(
            'Order Placed!',
            `Your order has been placed successfully. Order ID: ${result.orderId || 'N/A'}`,
            [
              {
                text: 'Track Order',
                onPress: () => router.replace({
                  pathname: '/order-tracking',
                  params: { orderId: result.orderId || result._id },
                }),
              },
              {
                text: 'OK',
                onPress: () => router.replace('/home'),
              },
            ]
          );
        } else {
          throw new Error('Failed to place order');
        }
      }
    } catch (error) {
      console.error('Order error:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  if (items.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe}>
          <View style={[styles.header, { backgroundColor: theme.tint }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>
              Checkout
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={80} color={theme.icon} />
            <ThemedText style={[styles.emptyText, { color: theme.text }]}>
              Your cart is empty
            </ThemedText>
            <TouchableOpacity
              style={[styles.shopButton, { backgroundColor: theme.primary }]}
              onPress={() => router.replace('/market')}
            >
              <ThemedText style={styles.shopButtonText}>Continue Shopping</ThemedText>
            </TouchableOpacity>
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
            Checkout
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Order Summary */}
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              Order Summary
            </ThemedText>
            {items.map((item) => (
              <View key={item._id} style={styles.orderItem}>
                <ThemedText style={[styles.orderItemName, { color: theme.text }]} numberOfLines={1}>
                  {item.label || item.name} x{item.quantity}
                </ThemedText>
                <ThemedText style={[styles.orderItemPrice, { color: theme.text }]}>
                  Rs. {(item.price * item.quantity).toLocaleString()}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Delivery Addresses */}
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              Delivery Addresses
            </ThemedText>
            {items.map((item) => (
              <View key={item._id} style={styles.addressItem}>
                <Ionicons name="location" size={16} color={theme.primary} />
                <View style={styles.addressContent}>
                  <ThemedText style={[styles.addressLabel, { color: theme.text }]} numberOfLines={1}>
                    {item.label || item.name}
                  </ThemedText>
                  <ThemedText style={[styles.addressText, { color: theme.secondary }]} numberOfLines={2}>
                    {item.selectedDeliveryAddress || 'No address selected'}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/select-address',
                    params: { productId: item._id, returnTo: 'checkout' },
                  })}
                >
                  <Ionicons name="create-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Reward Points */}
          {rewardPoints >= 100 && (
            <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.rewardHeader}>
                <View style={styles.rewardInfo}>
                  <Ionicons name="gift" size={20} color={theme.primary} />
                  <ThemedText style={[styles.rewardTitle, { color: theme.text }]}>
                    Reward Points
                  </ThemedText>
                </View>
                <ThemedText style={[styles.rewardPoints, { color: theme.primary }]}>
                  {rewardPoints.toLocaleString()} pts
                </ThemedText>
              </View>
              <TouchableOpacity
                style={[styles.rewardToggle, { borderColor: theme.border }]}
                onPress={handleRewardPointsToggle}
              >
                <ThemedText style={[styles.rewardToggleText, { color: theme.text }]}>
                  {useRewardPoints ? 'Using Reward Points' : 'Use Reward Points'}
                </ThemedText>
                <View style={[styles.toggle, { backgroundColor: useRewardPoints ? theme.primary : '#ccc' }]}>
                  <View style={[styles.toggleCircle, { backgroundColor: '#fff' }]} />
                </View>
              </TouchableOpacity>
              {useRewardPoints && (
                <View style={styles.pointsInputContainer}>
                  <TextInput
                    style={[styles.pointsInput, { borderColor: theme.border, color: theme.text }]}
                    placeholder="Enter points to use"
                    placeholderTextColor={theme.secondary}
                    keyboardType="numeric"
                    value={pointsToUse.toString()}
                    onChangeText={handlePointsChange}
                  />
                  <ThemedText style={[styles.pointsHint, { color: theme.secondary }]}>
                    Max: {Math.min(rewardPoints, Math.floor(subtotal * 50)).toLocaleString()} pts
                    (100 pts = Rs. 1 discount)
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Payment Method */}
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              Payment Method
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.paymentOption,
                { borderColor: paymentMethod === 'online' ? theme.primary : theme.border },
                paymentMethod === 'online' && { backgroundColor: `${theme.primary}10` },
              ]}
              onPress={() => setPaymentMethod('online')}
            >
              <Ionicons
                name={paymentMethod === 'online' ? 'radio-button-on' : 'radio-button-off'}
                size={24}
                color={paymentMethod === 'online' ? theme.primary : theme.secondary}
              />
              <View style={styles.paymentOptionContent}>
                <ThemedText style={[styles.paymentOptionTitle, { color: theme.text }]}>
                  Online Payment
                </ThemedText>
                <ThemedText style={[styles.paymentOptionDesc, { color: theme.secondary }]}>
                  Pay securely with PhonePay, eSewa, or Stripe
                </ThemedText>
              </View>
            </TouchableOpacity>

            {paymentMethod === 'online' && (
              <View style={styles.walletOptions}>
                <TouchableOpacity
                  style={[
                    styles.walletOption,
                    { borderColor: walletProvider === 'phonepay' ? theme.primary : theme.border },
                  ]}
                  onPress={() => setWalletProvider('phonepay')}
                >
                  <Ionicons
                    name={walletProvider === 'phonepay' ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={walletProvider === 'phonepay' ? theme.primary : theme.secondary}
                  />
                  <ThemedText style={[styles.walletOptionText, { color: theme.text }]}>
                    PhonePay
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.walletOption,
                    { borderColor: walletProvider === 'esewa' ? theme.primary : theme.border },
                  ]}
                  onPress={() => setWalletProvider('esewa')}
                >
                  <Ionicons
                    name={walletProvider === 'esewa' ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={walletProvider === 'esewa' ? theme.primary : theme.secondary}
                  />
                  <ThemedText style={[styles.walletOptionText, { color: theme.text }]}>
                    eSewa
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.walletOption,
                    { borderColor: walletProvider === 'stripe' ? theme.primary : theme.border },
                  ]}
                  onPress={() => setWalletProvider('stripe')}
                >
                  <Ionicons
                    name={walletProvider === 'stripe' ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={walletProvider === 'stripe' ? theme.primary : theme.secondary}
                  />
                  <ThemedText style={[styles.walletOptionText, { color: theme.text }]}>
                    Stripe (Card)
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.paymentOption,
                { borderColor: paymentMethod === 'cod' ? theme.primary : theme.border },
                paymentMethod === 'cod' && { backgroundColor: `${theme.primary}10` },
              ]}
              onPress={() => {
                setPaymentMethod('cod');
                setWalletProvider(null);
              }}
            >
              <Ionicons
                name={paymentMethod === 'cod' ? 'radio-button-on' : 'radio-button-off'}
                size={24}
                color={paymentMethod === 'cod' ? theme.primary : theme.secondary}
              />
              <View style={styles.paymentOptionContent}>
                <View style={styles.codHeader}>
                  <ThemedText style={[styles.paymentOptionTitle, { color: theme.text }]}>
                    Cash on Delivery
                  </ThemedText>
                  <View style={[styles.codBadge, { backgroundColor: '#ff9800' }]}>
                    <ThemedText style={styles.codBadgeText}>+Rs. 20</ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.paymentOptionDesc, { color: theme.secondary }]}>
                  Pay when you receive (Extra Rs. 20 risk charge)
                </ThemedText>
              </View>
            </TouchableOpacity>
          </View>

          {/* Price Breakdown */}
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              Price Breakdown
            </ThemedText>
            <View style={styles.priceRow}>
              <ThemedText style={[styles.priceLabel, { color: theme.text }]}>Subtotal:</ThemedText>
              <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                Rs. {subtotal.toLocaleString()}
              </ThemedText>
            </View>
            <View style={styles.priceRow}>
              <ThemedText style={[styles.priceLabel, { color: theme.text }]}>Delivery:</ThemedText>
              <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                Rs. {deliveryCharge.toLocaleString()}
              </ThemedText>
            </View>
            {codExtra > 0 && (
              <View style={styles.priceRow}>
                <ThemedText style={[styles.priceLabel, { color: theme.text }]}>COD Charge:</ThemedText>
                <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                  Rs. {codExtra.toLocaleString()}
                </ThemedText>
              </View>
            )}
            {discount > 0 && (
              <View style={styles.priceRow}>
                <ThemedText style={[styles.priceLabel, { color: '#4caf50' }]}>
                  Reward Points Discount:
                </ThemedText>
                <ThemedText style={[styles.priceValue, { color: '#4caf50' }]}>
                  -Rs. {discount.toLocaleString()}
                </ThemedText>
              </View>
            )}
            <View style={[styles.priceRow, styles.totalRow]}>
              <ThemedText style={[styles.totalLabel, { color: theme.text }]}>Total:</ThemedText>
              <ThemedText style={[styles.totalValue, { color: theme.primary }]}>
                Rs. {finalTotal.toLocaleString()}
              </ThemedText>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Place Order Button */}
        <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <View style={styles.footerInfo}>
            <ThemedText style={[styles.footerTotal, { color: theme.text }]}>
              Rs. {finalTotal.toLocaleString()}
            </ThemedText>
            <ThemedText style={[styles.footerItems, { color: theme.secondary }]}>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.placeOrderButton, { backgroundColor: theme.primary }]}
            onPress={handlePlaceOrder}
            disabled={processingPayment}
          >
            {processingPayment ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <ThemedText style={styles.placeOrderText}>Place Order</ThemedText>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
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
  section: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderItemName: { flex: 1, fontSize: 14 },
  orderItemPrice: { fontSize: 14, fontWeight: '600' },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addressContent: { flex: 1, marginLeft: 12 },
  addressLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  addressText: { fontSize: 12 },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rewardInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rewardTitle: { fontSize: 16, fontWeight: '600' },
  rewardPoints: { fontSize: 16, fontWeight: 'bold' },
  rewardToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  rewardToggleText: { fontSize: 14, fontWeight: '500' },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  pointsInputContainer: { marginTop: 8 },
  pointsInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 8,
  },
  pointsHint: { fontSize: 12 },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  paymentOptionContent: { flex: 1, marginLeft: 12 },
  paymentOptionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  paymentOptionDesc: { fontSize: 12 },
  codHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  codBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  walletOptions: { marginLeft: 40, marginTop: 8, marginBottom: 8 },
  walletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  walletOptionText: { marginLeft: 8, fontSize: 14 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  priceLabel: { fontSize: 14 },
  priceValue: { fontSize: 14, fontWeight: '600' },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  totalLabel: { fontSize: 18, fontWeight: 'bold' },
  totalValue: { fontSize: 20, fontWeight: 'bold' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  footerInfo: { flex: 1, marginRight: 12 },
  footerTotal: { fontSize: 20, fontWeight: 'bold' },
  footerItems: { fontSize: 12, marginTop: 2 },
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
  },
  placeOrderText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 18, marginTop: 16, marginBottom: 24 },
  shopButton: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 25 },
  shopButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
