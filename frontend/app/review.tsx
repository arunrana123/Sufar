// REVIEW SCREEN - Submit rating and review for completed service
// Features: Star rating (1-5), text review, submits to backend API, updates booking record
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getApiUrl } from '@/lib/config';
import { useTheme } from '@/contexts/ThemeContext';

// App theme colors - consistent across the app
const APP_COLORS = {
  primary: '#4A90E2', // App primary blue
  primaryDark: '#1E40AF', // Darker blue for text
  starYellow: '#FFD700', // Yellow for stars only
  background: '#F8F9FA', // Light gray background
  white: '#FFFFFF',
  textPrimary: '#333333',
  textSecondary: '#666666',
  textLight: '#999999',
  border: '#E0E0E0',
  success: '#10B981', // Green for success
  cardShadow: '#000000',
};

export default function ReviewScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const bookingId = params.bookingId as string;
  const serviceTitle = params.serviceTitle as string || 'Service';
  const workerName = params.workerName as string || 'Worker';
  const workerId = params.workerId as string;
  const amount = params.amount as string;
  
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmitReview = async () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = getApiUrl();
      console.log('📝 Submitting review:', { bookingId, rating, comment });
      
      // Use AbortController for proper timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      let response;
      try {
        response = await fetch(`${apiUrl}/api/bookings/${bookingId}/review`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rating,
            comment,
          }),
          signal: controller.signal,
          cache: 'no-cache',
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout: The server took too long to respond. Please check your connection and try again.');
        }
        
        // Check for network errors
        if (fetchError.message?.includes('Network request failed') || fetchError.name === 'TypeError') {
          console.error('❌ Network error details:', {
            message: fetchError.message,
            name: fetchError.name,
            apiUrl: `${apiUrl}/api/bookings/${bookingId}/review`,
          });
          throw new Error(`Network connection failed. Please ensure:\n• Backend server is running at ${apiUrl}\n• Your device is on the same WiFi network\n• Try again in a moment`);
        }
        
        throw fetchError;
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned an invalid response. Please try again.');
      }

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Review submitted successfully:', data);
        Alert.alert(
          '🎉 Thank You!',
          `Your ${rating}-star review has been submitted successfully!\n\nThis helps ${workerName} improve their service ranking.`,
          [
            {
              text: 'Done',
              onPress: () => router.replace('/home'),
            },
          ]
        );
      } else {
        console.error('❌ Review submission failed:', data);
        Alert.alert('Error', data.message || 'Failed to submit review. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Review submission error:', error);
      
      // More specific error messages
      let errorMessage = 'Failed to submit review. Please try again.';
      let errorTitle = 'Submission Error';
      
      if (error?.message?.includes('timeout') || error?.message?.includes('Request timeout')) {
        errorTitle = 'Request Timeout';
        errorMessage = 'The request took too long. Please check your connection and try again.';
      } else if (error?.message?.includes('Network connection failed') || error?.message?.includes('Network request failed')) {
        errorTitle = 'Network Error';
        errorMessage = error.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        errorTitle,
        errorMessage,
        [
          { text: 'OK', style: 'default' },
          {
            text: 'Retry',
            onPress: () => handleSubmitReview(),
            style: 'default'
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: APP_COLORS.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={APP_COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rate Service</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={[styles.content, { backgroundColor: APP_COLORS.background }]}>
          {/* Service Info */}
          <View style={[styles.serviceInfo, { backgroundColor: APP_COLORS.white }]}>
            <Ionicons name="construct" size={40} color={APP_COLORS.primary} />
            <Text style={[styles.serviceTitle, { color: APP_COLORS.textPrimary }]}>{serviceTitle}</Text>
            <Text style={[styles.workerName, { color: APP_COLORS.textSecondary }]}>by {workerName}</Text>
            {amount && (
              <Text style={[styles.amountText, { color: APP_COLORS.success }]}>Amount Paid: Rs. {amount}</Text>
            )}
          </View>

          {/* Rating */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: APP_COLORS.textPrimary }]}>How was your experience?</Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= rating ? APP_COLORS.starYellow : APP_COLORS.border}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text style={[styles.ratingText, { color: APP_COLORS.primary }]}>
                {rating === 1 ? 'Poor' :
                 rating === 2 ? 'Fair' :
                 rating === 3 ? 'Good' :
                 rating === 4 ? 'Very Good' :
                 'Excellent'}
              </Text>
            )}
          </View>

          {/* Comment */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: APP_COLORS.textPrimary }]}>Share your feedback (optional)</Text>
            <TextInput
              style={[styles.commentInput, { 
                backgroundColor: APP_COLORS.white, 
                borderColor: APP_COLORS.border,
                color: APP_COLORS.textPrimary 
              }]}
              placeholder="Tell us about your experience..."
              placeholderTextColor={APP_COLORS.textLight}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton, 
              { backgroundColor: APP_COLORS.primary },
              loading && styles.submitButtonDisabled
            ]}
            onPress={handleSubmitReview}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Submitting...' : 'Submit Review'}
            </Text>
            <Ionicons name="checkmark-circle" size={20} color={APP_COLORS.white} />
          </TouchableOpacity>

          {/* Skip Option */}
          <TouchableOpacity onPress={() => router.back()} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: APP_COLORS.textSecondary }]}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: APP_COLORS.white,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  serviceInfo: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: APP_COLORS.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  workerName: {
    fontSize: 14,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  commentInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    minHeight: 120,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: APP_COLORS.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#B0BEC5',
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_COLORS.white,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  skipText: {
    fontSize: 14,
  },
});

