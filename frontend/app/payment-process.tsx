// PAYMENT PROCESS SCREEN - Complete payment processing with merchant details
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { paymentService, PaymentRequest } from '@/lib/PaymentService';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';

export default function PaymentProcessScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { clearCart } = useCart();
  const params = useLocalSearchParams();
  
  const orderType = params.orderType as string || 'market';
  const orderData = params.orderData ? JSON.parse(params.orderData as string) : null;
  const amount = parseFloat(params.amount as string) || 0;
  const walletProvider = params.walletProvider as string;
  const rewardPointsUsed = parseFloat(params.rewardPointsUsed as string) || 0;
  const discount = parseFloat(params.discount as string) || 0;
  const subtotal = parseFloat(params.subtotal as string) || 0;
  const deliveryCharge = parseFloat(params.deliveryCharge as string) || 0;
  const codExtra = parseFloat(params.codExtra as string) || 0;

  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success' | 'failed'>('pending');
  const [orderId, setOrderId] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');

  // Generate order ID
  useEffect(() => {
    if (!orderId) {
      const generatedOrderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      setOrderId(generatedOrderId);
    }
  }, []);

  const getWalletName = () => {
    switch (walletProvider) {
      case 'phonepay': return 'PhonePay';
      case 'esewa': return 'eSewa';
      case 'stripe': return 'Stripe Card';
      default: return 'Online Payment';
    }
  };

  const getMerchantInfo = () => {
    return {
      name: 'On Tap Market',
      id: 'ONTAP-MERCHANT-001',
      email: 'merchant@ontap.com',
      phone: '+977-9800000000',
    };
  };

  const handleProcessPayment = async () => {
    if (!user) {
      Alert.alert('Error', 'Please login to continue');
      return;
    }

    setProcessing(true);
    setPaymentStatus('processing');

    try {
      const apiUrl = getApiUrl();
      const merchant = getMerchantInfo();

      // Step 1: Create order first (pending payment)
      // Ensure all required fields are present
      if (!orderData || !orderData.userId || !orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
        throw new Error('Invalid order data. Missing userId or items.');
      }

      const orderPayload = {
        userId: orderData.userId,
        items: orderData.items.map((item: any) => ({
          productId: item.productId || item._id,
          name: item.name,
          label: item.label,
          price: parseFloat(item.price) || 0,
          quantity: parseInt(item.quantity) || 1,
          deliveryAddress: item.deliveryAddress || item.selectedDeliveryAddress,
          images: item.images || [],
          category: item.category,
        })),
        subtotal: parseFloat(orderData.subtotal || subtotal) || 0,
        deliveryCharge: parseFloat(orderData.deliveryCharge || deliveryCharge) || 50,
        codExtra: parseFloat(orderData.codExtra || codExtra) || 0,
        rewardPointsUsed: parseFloat(orderData.rewardPointsUsed || rewardPointsUsed) || 0,
        discount: parseFloat(orderData.discount || discount) || 0,
        total: parseFloat(orderData.total || amount) || 0,
        paymentMethod: 'online',
        walletProvider: walletProvider,
        paymentStatus: 'pending',
        status: 'pending',
        orderId: orderId, // Include generated orderId
      };

      console.log('📦 Creating order with payload:', {
        userId: orderPayload.userId,
        itemsCount: orderPayload.items.length,
        total: orderPayload.total,
        orderId: orderPayload.orderId,
      });

      const orderResponse = await fetch(`${apiUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Order creation error:', errorData);
        throw new Error(errorData.message || `Failed to create order: ${orderResponse.status} ${orderResponse.statusText}`);
      }

      const orderResult = await orderResponse.json();
      if (!orderResult.success) {
        throw new Error(orderResult.message || 'Failed to create order');
      }

      const createdOrderId = orderResult.orderId || orderResult.order?.orderId || orderResult._id || orderResult.order?._id;
      
      if (!createdOrderId) {
        throw new Error('Order created but no order ID returned');
      }

      // Step 2: Initiate payment
      const paymentData: PaymentRequest = {
        amount: amount,
        orderId: createdOrderId,
        orderType: orderType as 'service' | 'market',
        orderData: orderPayload,
        customerName: `${user.firstName} ${user.lastName}`,
        customerEmail: user.email,
        customerPhone: user.phone || '',
        walletProvider: walletProvider as 'phonepay' | 'esewa' | 'stripe',
        rewardPointsUsed: rewardPointsUsed,
        discountAmount: discount,
      };

      let paymentResult;
      
      if (walletProvider === 'phonepay') {
        paymentResult = await paymentService.initiatePhonePayStripe(paymentData);
      } else if (walletProvider === 'esewa') {
        paymentResult = await paymentService.initiateEsewaStripe(paymentData);
      } else if (walletProvider === 'stripe') {
        paymentResult = await paymentService.initiateStripeCard(paymentData);
      } else {
        // Fallback to eSewa
        paymentResult = await paymentService.initiateEsewaPayment(paymentData);
      }

      if (paymentResult.success && paymentResult.paymentId) {
        setTransactionId(paymentResult.paymentId);
        
        // Step 3: Verify payment with backend
        const verifyResponse = await fetch(`${apiUrl}/api/payments/stripe/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: paymentResult.paymentId,
            orderId: createdOrderId,
          }),
        });

        if (!verifyResponse.ok) {
          throw new Error('Payment verification failed');
        }

        const verifyResult = await verifyResponse.json();

        if (verifyResult.success) {
          // Step 4: Update order with payment details
          const updateResponse = await fetch(`${apiUrl}/api/orders/${createdOrderId}/payment`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentStatus: 'paid',
              transactionId: paymentResult.paymentId,
              paymentMethod: 'online',
              walletProvider,
              paidAt: new Date().toISOString(),
              status: 'confirmed', // Move to confirmed status after payment
            }),
          });

          if (updateResponse.ok) {
            // Step 5: Notify user and backend
            setPaymentStatus('success');
            
            // Clear cart
            clearCart();

            // Send notification via socket
            if (socketService.isConnected() && user.id) {
              socketService.emit('order:payment_completed', {
                orderId: createdOrderId,
                userId: user.id,
                amount: amount,
                paymentMethod: walletProvider,
                transactionId: paymentResult.paymentId,
              });

              // Notify admin about new order
              socketService.emit('order:new', {
                orderId: createdOrderId,
                userId: user.id,
                amount: amount,
                status: 'confirmed',
              });
            }

            // Show success and navigate
            setTimeout(() => {
              Alert.alert(
                'Payment Successful! 🎉',
                `Your payment of Rs. ${amount.toLocaleString()} has been processed successfully.\n\nOrder ID: ${orderId}\nTransaction ID: ${paymentResult.paymentId}\n\nYour order is now confirmed and will be prepared for delivery.`,
                [
                  {
                    text: 'Track Order',
                    onPress: () => {
                      router.replace({
                        pathname: '/order-tracking',
                        params: { orderId: createdOrderId },
                      });
                    },
                  },
                  {
                    text: 'OK',
                    onPress: () => router.replace('/home'),
                  },
                ]
              );
            }, 1500);
          } else {
            throw new Error('Failed to update order payment status');
          }
        } else {
          throw new Error(verifyResult.error || 'Payment verification failed');
        }
      } else {
        throw new Error(paymentResult.error || 'Payment failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentStatus('failed');
      Alert.alert(
        'Payment Failed',
        error.message || 'Failed to process payment. Please try again.',
        [
          {
            text: 'Try Again',
            onPress: () => setPaymentStatus('pending'),
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setProcessing(false);
    }
  };

  const merchant = getMerchantInfo();

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>
            Payment
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Merchant Information Card */}
          <View style={[styles.merchantCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.merchantHeader}>
              <Ionicons name="storefront" size={32} color={theme.primary} />
              <ThemedText style={[styles.merchantTitle, { color: theme.text }]}>
                Merchant Information
              </ThemedText>
            </View>
            <View style={styles.merchantInfo}>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.secondary }]}>Merchant Name:</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>{merchant.name}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.secondary }]}>Merchant ID:</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>{merchant.id}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.secondary }]}>Email:</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>{merchant.email}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.secondary }]}>Phone:</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>{merchant.phone}</ThemedText>
              </View>
            </View>
          </View>

          {/* Payment Details Card */}
          <View style={[styles.paymentCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              Payment Details
            </ThemedText>
            
            <View style={styles.detailRow}>
              <ThemedText style={[styles.detailLabel, { color: theme.secondary }]}>Order ID:</ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>{orderId}</ThemedText>
            </View>

            <View style={styles.detailRow}>
              <ThemedText style={[styles.detailLabel, { color: theme.secondary }]}>Payment Method:</ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>{getWalletName()}</ThemedText>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <ThemedText style={[styles.detailLabel, { color: theme.secondary }]}>Subtotal:</ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                Rs. {subtotal.toLocaleString()}
              </ThemedText>
            </View>

            <View style={styles.detailRow}>
              <ThemedText style={[styles.detailLabel, { color: theme.secondary }]}>Delivery Charge:</ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                Rs. {deliveryCharge.toLocaleString()}
              </ThemedText>
            </View>

            {codExtra > 0 && (
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailLabel, { color: theme.secondary }]}>COD Charge:</ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                  Rs. {codExtra.toLocaleString()}
                </ThemedText>
              </View>
            )}

            {discount > 0 && (
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailLabel, { color: '#4caf50' }]}>
                  Reward Points Discount:
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: '#4caf50' }]}>
                  -Rs. {discount.toLocaleString()}
                </ThemedText>
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: theme.primary }]} />

            <View style={styles.totalRow}>
              <ThemedText style={[styles.totalLabel, { color: theme.text }]}>Total Amount:</ThemedText>
              <ThemedText style={[styles.totalValue, { color: theme.primary }]}>
                Rs. {amount.toLocaleString()}
              </ThemedText>
            </View>
          </View>

          {/* Payment Status */}
          {paymentStatus === 'processing' && (
            <View style={[styles.statusCard, { backgroundColor: '#FFF3CD', borderColor: '#FFC107' }]}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText style={[styles.statusText, { color: '#856404' }]}>
                Processing your payment...
              </ThemedText>
              <ThemedText style={[styles.statusSubtext, { color: '#856404' }]}>
                Please wait while we process your payment
              </ThemedText>
            </View>
          )}

          {paymentStatus === 'success' && (
            <View style={[styles.statusCard, { backgroundColor: '#D4EDDA', borderColor: '#28A745' }]}>
              <Ionicons name="checkmark-circle" size={48} color="#28A745" />
              <ThemedText style={[styles.statusText, { color: '#155724' }]}>
                Payment Successful!
              </ThemedText>
              {transactionId && (
                <ThemedText style={[styles.statusSubtext, { color: '#155724' }]}>
                  Transaction ID: {transactionId}
                </ThemedText>
              )}
            </View>
          )}

          {paymentStatus === 'failed' && (
            <View style={[styles.statusCard, { backgroundColor: '#F8D7DA', borderColor: '#DC3545' }]}>
              <Ionicons name="close-circle" size={48} color="#DC3545" />
              <ThemedText style={[styles.statusText, { color: '#721C24' }]}>
                Payment Failed
              </ThemedText>
              <ThemedText style={[styles.statusSubtext, { color: '#721C24' }]}>
                Please try again or use a different payment method
              </ThemedText>
            </View>
          )}

          {/* Customer Information */}
          <View style={[styles.customerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              Customer Information
            </ThemedText>
            <View style={styles.detailRow}>
              <ThemedText style={[styles.detailLabel, { color: theme.secondary }]}>Name:</ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                {user?.firstName} {user?.lastName}
              </ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={[styles.detailLabel, { color: theme.secondary }]}>Email:</ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>{user?.email}</ThemedText>
            </View>
            {user?.phone && (
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailLabel, { color: theme.secondary }]}>Phone:</ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>{user.phone}</ThemedText>
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Pay Button */}
        {paymentStatus === 'pending' && (
          <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: theme.primary }]}
              onPress={handleProcessPayment}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={20} color="#fff" />
                  <ThemedText style={styles.payButtonText}>
                    Pay Rs. {amount.toLocaleString()}
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  merchantCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  merchantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  merchantTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  merchantInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  paymentCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  statusSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  customerCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
