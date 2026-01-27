// ORDER REVIEW SCREEN - Rate and review completed orders
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';

interface OrderItem {
  productId: string;
  name: string;
  label: string;
  quantity: number;
  price: number;
}

interface Review {
  productId: string;
  rating: number;
  comment: string;
}

export default function OrderReviewScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/orders/${orderId}`);
      
      if (response.ok) {
        const data = await response.json();
        const order = data.order || data;
        setOrderItems(order.items || []);
        
        // Initialize reviews for each item
        const initialReviews: Record<string, Review> = {};
        order.items?.forEach((item: OrderItem) => {
          initialReviews[item.productId] = {
            productId: item.productId,
            rating: 0,
            comment: '',
          };
        });
        setReviews(initialReviews);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = (productId: string, rating: number) => {
    setReviews((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        rating,
      },
    }));
  };

  const handleCommentChange = (productId: string, comment: string) => {
    setReviews((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        comment,
      },
    }));
  };

  const handleSubmit = async () => {
    // Validate all items have ratings
    const allRated = Object.values(reviews).every((review) => review.rating > 0);
    if (!allRated) {
      Alert.alert('Rating Required', 'Please rate all products before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/orders/${orderId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          reviews: Object.values(reviews),
          orderId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const pointsEarned = result.pointsEarned || Object.values(reviews).length * 100;
        
        Alert.alert(
          'Thank You! 🎉',
          `Your review has been submitted successfully!\n\nYou earned ${pointsEarned} reward points for your review.`,
          [
            {
              text: 'OK',
              onPress: () => router.replace('/home'),
            },
          ]
        );
      } else {
        throw new Error('Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (productId: string, currentRating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleRatingChange(productId, star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= currentRating ? 'star' : 'star-outline'}
              size={32}
              color={star <= currentRating ? '#FFD700' : theme.secondary}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
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

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>
            Rate Your Order
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText style={[styles.subtitle, { color: theme.text }]}>
            Please rate and review your order items
          </ThemedText>

          {orderItems.map((item) => {
            const review = reviews[item.productId] || { productId: item.productId, rating: 0, comment: '' };
            return (
              <View
                key={item.productId}
                style={[styles.reviewCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <ThemedText style={[styles.itemName, { color: theme.text }]}>
                  {item.label || item.name}
                </ThemedText>
                <ThemedText style={[styles.itemQuantity, { color: theme.secondary }]}>
                  Quantity: {item.quantity}
                </ThemedText>

                <View style={styles.ratingSection}>
                  <ThemedText style={[styles.ratingLabel, { color: theme.text }]}>
                    Rating:
                  </ThemedText>
                  {renderStars(item.productId, review.rating)}
                </View>

                <View style={styles.commentSection}>
                  <ThemedText style={[styles.commentLabel, { color: theme.text }]}>
                    Your Review (Optional):
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.commentInput,
                      { borderColor: theme.border, color: theme.text, backgroundColor: theme.background },
                    ]}
                    placeholder="Share your experience..."
                    placeholderTextColor={theme.secondary}
                    multiline
                    numberOfLines={4}
                    value={review.comment}
                    onChangeText={(text) => handleCommentChange(item.productId, text)}
                  />
                </View>
              </View>
            );
          })}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <ThemedText style={styles.submitButtonText}>Submit Review</ThemedText>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  reviewCard: {
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
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    marginBottom: 16,
  },
  ratingSection: {
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  commentSection: {
    marginTop: 8,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
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
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
