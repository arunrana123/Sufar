// CART SCREEN - Shopping cart with products and checkout
import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Alert,
  TextInput,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useCart, CartItem } from '@/contexts/CartContext';

export default function CartScreen() {
  const { theme } = useTheme();
  const { items, removeFromCart, updateQuantity, clearCart, getTotalPrice, getTotalItems, updateDeliveryAddress } = useCart();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(items.map(item => item._id)));

  // Refresh selected items when cart items change
  useEffect(() => {
    setSelectedItems(new Set(items.map(item => item._id)));
  }, [items]);

  const handleQuantityChange = (productId: string, change: number) => {
    const item = items.find(i => i._id === productId);
    if (item) {
      const newQuantity = item.quantity + change;
      if (newQuantity > 0) {
        updateQuantity(productId, newQuantity);
      } else {
        removeFromCart(productId);
      }
    }
  };

  const handleRemoveItem = (productId: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFromCart(productId),
        },
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => clearCart(),
        },
      ]
    );
  };

  const handleSelectAddress = (item: CartItem) => {
    router.push({
      pathname: '/select-address',
      params: {
        productId: item._id,
        returnTo: 'cart',
      },
    });
  };

  const handleCheckout = () => {
    const itemsWithoutAddress = items.filter(item => !item.selectedDeliveryAddress);
    if (itemsWithoutAddress.length > 0) {
      Alert.alert(
        'Delivery Address Required',
        'Please select delivery address for all items before checkout.',
        [{ text: 'OK' }]
      );
      return;
    }

    router.push('/checkout');
  };

  if (items.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe}>
          <View style={[styles.header, { backgroundColor: theme.tint }]}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <ThemedText 
              type="title" 
              style={[styles.headerTitle, { color: '#fff' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Shopping Cart
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
              <ThemedText style={styles.shopButtonText}>Start Shopping</ThemedText>
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
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText 
            type="title" 
            style={[styles.headerTitle, { color: '#fff' }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Shopping Cart ({getTotalItems()})
          </ThemedText>
          {items.length > 0 ? (
            <TouchableOpacity 
              style={styles.clearCartButton}
              onPress={handleClearCart}
            >
              <Ionicons name="trash-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {items.map((item) => (
            <View key={item._id} style={[styles.cartItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Image
                source={{ uri: item.images[0] || 'https://via.placeholder.com/100' }}
                style={styles.itemImage}
                resizeMode="cover"
              />
              <View style={styles.itemInfo}>
                <ThemedText style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
                  {item.label || item.name}
                </ThemedText>
                <ThemedText style={[styles.itemPrice, { color: theme.primary }]}>
                  Rs. {item.price.toLocaleString()}
                </ThemedText>

                {/* Quantity Controls */}
                <View style={styles.quantityContainer}>
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => handleQuantityChange(item._id, -1)}
                  >
                    <Ionicons name="remove" size={18} color={theme.text} />
                  </TouchableOpacity>
                  <ThemedText style={[styles.quantityText, { color: theme.text }]}>
                    {item.quantity}
                  </ThemedText>
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => handleQuantityChange(item._id, 1)}
                  >
                    <Ionicons name="add" size={18} color={theme.text} />
                  </TouchableOpacity>
                </View>

                {/* Delivery Address Selection */}
                <TouchableOpacity
                  style={[styles.addressButton, { borderColor: item.selectedDeliveryAddress ? theme.primary : theme.border }]}
                  onPress={() => handleSelectAddress(item)}
                >
                  <Ionicons 
                    name={item.selectedDeliveryAddress ? "location" : "location-outline"} 
                    size={16} 
                    color={item.selectedDeliveryAddress ? theme.primary : theme.text} 
                  />
                  <ThemedText 
                    style={[
                      styles.addressText, 
                      { color: item.selectedDeliveryAddress ? theme.primary : theme.secondary }
                    ]} 
                    numberOfLines={1}
                  >
                    {item.selectedDeliveryAddress || 'Select Delivery Address'}
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={16} color={theme.secondary} />
                </TouchableOpacity>

                <View style={styles.itemTotal}>
                  <ThemedText style={[styles.itemTotalText, { color: theme.text }]}>
                    Subtotal: Rs. {(item.price * item.quantity).toLocaleString()}
                  </ThemedText>
                </View>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveItem(item._id)}
              >
                <Ionicons name="close-circle" size={24} color={theme.error || '#ff4444'} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <ThemedText style={[styles.summaryLabel, { color: theme.text }]}>
                Total Items:
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                {getTotalItems()}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={[styles.summaryLabel, { color: theme.text }]}>
                Subtotal:
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                Rs. {getTotalPrice().toLocaleString()}
              </ThemedText>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <ThemedText style={[styles.totalLabel, { color: theme.text }]}>
                Total:
              </ThemedText>
              <ThemedText style={[styles.totalValue, { color: theme.primary }]}>
                Rs. {getTotalPrice().toLocaleString()}
              </ThemedText>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Checkout Button */}
        <View style={[styles.checkoutContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <View style={styles.checkoutInfo}>
            <ThemedText style={[styles.checkoutTotal, { color: theme.text }]}>
              Rs. {getTotalPrice().toLocaleString()}
            </ThemedText>
            <ThemedText style={[styles.checkoutItems, { color: theme.secondary }]}>
              {getTotalItems()} {getTotalItems() === 1 ? 'item' : 'items'}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.checkoutButton, { backgroundColor: theme.primary }]}
            onPress={handleCheckout}
          >
            <ThemedText style={styles.checkoutButtonText}>Checkout</ThemedText>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
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
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  clearCartButton: {
    padding: 8,
    marginRight: -8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cartItem: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16,
    minWidth: 30,
    textAlign: 'center',
  },
  addressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
  },
  itemTotal: {
    marginTop: 4,
  },
  itemTotalText: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  summary: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  checkoutContainer: {
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
  checkoutInfo: {
    flex: 1,
    marginRight: 12,
  },
  checkoutTotal: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  checkoutItems: {
    fontSize: 12,
    marginTop: 2,
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
  },
  checkoutButtonText: {
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
  emptyText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  shopButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
