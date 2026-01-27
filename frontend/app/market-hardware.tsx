// HARDWARE MARKET SCREEN - View all hardware products
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { getApiUrl } from '@/lib/config';

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
  isPopular?: boolean;
  isRecommended?: boolean;
}

export default function HardwareMarketScreen() {
  const { theme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/market/products?category=Hardware`);
      
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      } else {
        // Mock data
        const mockProducts: Product[] = [
          {
            _id: '19',
            name: 'Hammer Set',
            label: 'Professional Hammer Set - 3 Pieces',
            price: 1200,
            originalPrice: 1500,
            discount: 20,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.7,
            reviewCount: 85,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234582',
            description: 'Professional quality hammer set with different sizes',
          },
          {
            _id: '20',
            name: 'Screwdriver Set',
            label: 'Multi-Purpose Screwdriver Set - 20 Pieces',
            price: 800,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.6,
            reviewCount: 120,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234583',
            description: 'Complete screwdriver set with various sizes',
          },
          {
            _id: '21',
            name: 'Paint - White',
            label: 'Premium White Paint - 5 Liters',
            price: 1800,
            originalPrice: 2200,
            discount: 18,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.5,
            reviewCount: 95,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234584',
            description: 'High quality white paint for interior and exterior',
          },
          {
            _id: '22',
            name: 'Nails - Assorted',
            label: 'Steel Nails - Assorted Sizes (1 kg)',
            price: 250,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.4,
            reviewCount: 60,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234585',
            description: 'Assorted steel nails in various sizes',
          },
          {
            _id: '23',
            name: 'Drill Machine',
            label: 'Electric Drill Machine - 500W',
            price: 4500,
            originalPrice: 5500,
            discount: 18,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.8,
            reviewCount: 150,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234586',
            description: 'Powerful electric drill machine with accessories',
          },
          {
            _id: '24',
            name: 'Wrench Set',
            label: 'Adjustable Wrench Set - 5 Pieces',
            price: 1500,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.6,
            reviewCount: 75,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234587',
            description: 'Professional wrench set for various applications',
          },
          {
            _id: '25',
            name: 'Wire - Electrical',
            label: 'Electrical Wire - 100 meters',
            price: 3500,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.7,
            reviewCount: 110,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234588',
            description: 'Quality electrical wire for home wiring',
          },
          {
            _id: '26',
            name: 'Pliers Set',
            label: 'Professional Pliers Set - 4 Pieces',
            price: 900,
            originalPrice: 1100,
            discount: 18,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.5,
            reviewCount: 80,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234589',
            description: 'Complete pliers set for electrical and mechanical work',
          },
        ];
        setProducts(mockProducts);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    return searchQuery === '' || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.label?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleProductPress = (product: Product) => {
    router.push({
      pathname: '/market-product',
      params: { productId: product._id },
    });
  };

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
            Hardware Market
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.searchBar, { backgroundColor: '#fff', borderColor: '#FF7A2C' }]}>
            <View style={styles.searchIconContainer}>
              <Ionicons name="search" size={20} color="#666" />
            </View>
            <TextInput
              style={[styles.searchInput, { color: '#333' }]}
              placeholder="Search hardware items..."
              placeholderTextColor="rgba(0, 0, 0, 0.3)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.text }]}>
              Loading products...
            </ThemedText>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {filteredProducts.length > 0 ? (
              <View style={styles.productsGrid}>
                {filteredProducts.map((product) => (
                  <TouchableOpacity
                    key={product._id}
                    style={[styles.productCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => handleProductPress(product)}
                  >
                    <View style={styles.imageContainer}>
                      {product.images && product.images.length > 0 ? (
                        <Image
                          source={{ uri: product.images[0] }}
                          style={styles.productImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.productImage, { backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="image-outline" size={32} color="#999" />
                        </View>
                      )}
                      {product.discount && product.discount > 0 && (
                        <View style={styles.discountBadge}>
                          <ThemedText style={styles.discountText}>-{product.discount}%</ThemedText>
                        </View>
                      )}
                      {product.images && product.images.length > 1 && (
                        <View style={styles.imageCountBadge}>
                          <Ionicons name="images" size={12} color="#fff" />
                          <ThemedText style={styles.imageCountText}>{product.images.length}</ThemedText>
                        </View>
                      )}
                      {product.inStock === false && (
                        <View style={styles.outOfStockOverlay}>
                          <ThemedText style={styles.outOfStockText}>Out of Stock</ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={styles.productInfo}>
                      <ThemedText style={[styles.productName, { color: theme.text }]} numberOfLines={2}>
                        {product.label || product.name}
                      </ThemedText>
                      {product.description && (
                        <ThemedText style={[styles.productDescription, { color: theme.secondary }]} numberOfLines={1}>
                          {product.description}
                        </ThemedText>
                      )}
                      <View style={styles.priceRow}>
                        <ThemedText style={[styles.productPrice, { color: theme.primary }]}>
                          Rs. {product.price}
                        </ThemedText>
                        {product.originalPrice && (
                          <ThemedText style={[styles.originalPrice, { color: theme.secondary }]}>
                            Rs. {product.originalPrice}
                          </ThemedText>
                        )}
                      </View>
                      {product.phoneNumber && (
                        <TouchableOpacity 
                          style={styles.phoneRow}
                          onPress={() => {
                            // TODO: Implement phone call
                            console.log('Call:', product.phoneNumber);
                          }}
                        >
                          <Ionicons name="call" size={14} color={theme.primary} />
                          <ThemedText style={[styles.phoneText, { color: theme.primary }]} numberOfLines={1}>
                            {product.phoneNumber}
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="hammer-outline" size={64} color={theme.icon} />
                <ThemedText style={[styles.emptyText, { color: theme.text }]}>
                  No hardware items found
                </ThemedText>
                <ThemedText style={[styles.emptySubtext, { color: theme.secondary }]}>
                  {searchQuery ? 'Try a different search term' : 'Check back later for new hardware items'}
                </ThemedText>
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    borderWidth: 1.5,
    paddingHorizontal: 4,
    paddingVertical: 0,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIconContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 0,
    height: '100%',
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
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
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  productCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 150,
    position: 'relative',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  discountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  imageCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  imageCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  outOfStockOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    minHeight: 40,
  },
  productDescription: {
    fontSize: 12,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
