// PRODUCT DETAIL SCREEN - Individual product detail page
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Linking,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useCart } from '@/contexts/CartContext';
import { getApiUrl } from '@/lib/config';
import { getMarketMockProductById } from './market';

interface Product {
  _id: string;
  name: string;
  label?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  images: string[];
  videoUrl?: string;
  category: string;
  description?: string;
  deliveryLocation?: string;
  phoneNumber?: string;
  inStock?: boolean;
  rating?: number;
  reviewCount?: number;
}

export default function ProductDetailScreen() {
  const { theme } = useTheme();
  const { addToCart } = useCart();
  const params = useLocalSearchParams();
  const productId = params.productId as string;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      let data: any = null;
      try {
        const response = await fetch(`${apiUrl}/api/market/products/${productId}`);
        if (response.ok) {
          data = await response.json();
          const productData = data.product || data;
          if (productData && (productData._id || productData.name)) {
            setProduct(productData);
            return;
          }
        }
      } catch (_) {
        // Use default product by id below
      }
      const mockById = productId ? getMarketMockProductById(productId) : null;
      if (mockById) {
        setProduct(mockById);
      } else {
        const fallback: Product = {
          _id: productId || '1',
          name: 'Bulk Vegetables',
          label: 'Fresh Vegetables - 50 kg',
          price: 2500,
          originalPrice: 3000,
          discount: 16,
          images: ['https://via.placeholder.com/400'],
          category: 'Wholesale',
          inStock: true,
          rating: 4.7,
          reviewCount: 80,
          deliveryLocation: 'Kathmandu',
          phoneNumber: '+977-9841234567',
          description: 'Fresh vegetables in bulk - 50 kg pack. Includes tomatoes, onions, potatoes, and seasonal vegetables.',
        };
        setProduct(fallback);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      const mockById = productId ? getMarketMockProductById(productId) : null;
      if (mockById) setProduct(mockById);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  };

  const handleBuy = () => {
    if (!product) return;

    if (product.inStock === false) {
      Alert.alert('Out of Stock', 'This product is currently out of stock.');
      return;
    }

    Alert.alert(
      'Buy Now',
      `Buy ${product.label || product.name} for Rs. ${product.price.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Select Address & Buy', 
          onPress: () => {
            // Add to cart first
            addToCart({
              _id: product._id,
              name: product.name,
              label: product.label,
              price: product.price,
              originalPrice: product.originalPrice,
              discount: product.discount,
              images: product.images,
              category: product.category,
              description: product.description,
              deliveryLocation: product.deliveryLocation,
              phoneNumber: product.phoneNumber,
            }, 1);

            // Navigate to address selection
            router.push({
              pathname: '/select-address',
              params: {
                productId: product._id,
                returnTo: 'checkout',
              },
            });
          }
        }
      ]
    );
  };

  const handleAddToCart = () => {
    if (!product) return;

    if (product.inStock === false) {
      Alert.alert('Out of Stock', 'This product is currently out of stock.');
      return;
    }

    addToCart({
      _id: product._id,
      name: product.name,
      label: product.label,
      price: product.price,
      originalPrice: product.originalPrice,
      discount: product.discount,
      images: product.images,
      category: product.category,
      description: product.description,
      deliveryLocation: product.deliveryLocation,
      phoneNumber: product.phoneNumber,
    }, 1);

    Alert.alert('Success', 'Product added to cart!', [
      {
        text: 'View Cart',
        onPress: () => router.push('/cart'),
      },
      {
        text: 'Continue Shopping',
        style: 'cancel',
      },
    ]);
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.text }]}>
              Loading product...
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!product) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <ThemedText style={[styles.headerTitle, { color: '#fff' }]}>
              Product Not Found
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={theme.icon} />
            <ThemedText style={[styles.emptyText, { color: theme.text }]}>
              Product not found
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const hasDiscount = product.discount && product.discount > 0;
  const finalPrice = hasDiscount && product.originalPrice
    ? product.originalPrice * (1 - product.discount / 100)
    : product.price;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
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
            Product Details
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Product Images */}
          {product.images && product.images.length > 0 && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: product.images[currentImageIndex] }}
                style={styles.mainImage}
                resizeMode="cover"
              />
              {product.images.length > 1 && (
                <View style={styles.imageIndicators}>
                  {product.images.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.indicatorDot,
                        { backgroundColor: index === currentImageIndex ? '#fff' : 'rgba(255,255,255,0.5)' },
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Product Info */}
          <View style={[styles.productInfo, { backgroundColor: theme.card }]}>
            <View style={styles.productHeader}>
              <ThemedText style={[styles.productName, { color: theme.text }]}>
                {product.label || product.name}
              </ThemedText>
              {hasDiscount && (
                <View style={styles.discountBadge}>
                  <ThemedText style={styles.discountText}>-{product.discount}%</ThemedText>
                </View>
              )}
            </View>

            {product.description != null && String(product.description).trim() !== '' ? (
              <ThemedText style={[styles.productDescription, { color: theme.secondary }]}>
                {String(product.description)}
              </ThemedText>
            ) : null}

            <View style={styles.priceSection}>
              <ThemedText style={[styles.price, { color: theme.primary }]}>
                Rs. {finalPrice.toFixed(2)}
              </ThemedText>
              {(product.originalPrice ?? 0) > 0 && (
                <ThemedText style={[styles.originalPrice, { color: theme.secondary }]}>
                  Rs. {Number(product.originalPrice).toFixed(2)}
                </ThemedText>
              )}
            </View>

            {(product.rating ?? 0) > 0 ? (
              <View style={styles.ratingSection}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <ThemedText style={[styles.ratingText, { color: theme.text }]}>
                  {Number(product.rating).toFixed(1)} ({product.reviewCount ?? 0} reviews)
                </ThemedText>
              </View>
            ) : null}

            {/* Contact Info */}
            {(!!product.phoneNumber || !!product.deliveryLocation) ? (
              <View style={styles.contactSection}>
                {product.phoneNumber != null && String(product.phoneNumber).trim() !== '' ? (
                  <TouchableOpacity
                    style={[styles.contactRow, { backgroundColor: theme.inputBackground }]}
                    onPress={() => handleCall(product.phoneNumber!)}
                  >
                    <Ionicons name="call" size={20} color={theme.primary} />
                    <View style={styles.contactInfo}>
                      <ThemedText style={[styles.contactLabel, { color: theme.secondary }]}>
                        Phone Number
                      </ThemedText>
                      <ThemedText style={[styles.contactValue, { color: theme.text }]}>
                        {String(product.phoneNumber)}
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.icon} />
                  </TouchableOpacity>
                ) : null}

                {product.deliveryLocation != null && String(product.deliveryLocation).trim() !== '' ? (
                  <View style={[styles.contactRow, { backgroundColor: theme.inputBackground }]}>
                    <Ionicons name="location" size={20} color={theme.primary} />
                    <View style={styles.contactInfo}>
                      <ThemedText style={[styles.contactLabel, { color: theme.secondary }]}>
                        Delivery Location
                      </ThemedText>
                      <ThemedText style={[styles.contactValue, { color: theme.text }]}>
                        {String(product.deliveryLocation)}
                      </ThemedText>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.addToCartButton, { borderColor: theme.primary }]}
                onPress={handleAddToCart}
                disabled={product.inStock === false}
              >
                <Ionicons name="cart-outline" size={20} color={theme.primary} />
                <ThemedText style={[styles.addToCartText, { color: theme.primary }]}>
                  Add to Cart
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.buyButton, { backgroundColor: theme.primary }]}
                onPress={handleBuy}
                disabled={product.inStock === false}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <ThemedText style={styles.buyButtonText}>
                  Buy Now
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
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
    marginBottom: 8,
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
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: [{ translateX: -40 }],
    flexDirection: 'row',
    gap: 6,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  productInfo: {
    padding: 20,
    marginTop: 16,
    borderRadius: 16,
    marginHorizontal: 12,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productName: {
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  discountBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  discountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  productDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 16,
    textDecorationLine: 'line-through',
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  ratingText: {
    fontSize: 14,
  },
  contactSection: {
    marginBottom: 20,
    gap: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  addToCartText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
});
