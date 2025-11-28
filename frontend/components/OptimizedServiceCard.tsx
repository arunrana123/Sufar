import React, { memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2;

interface Service {
  _id: string;
  title: string;
  description: string;
  price: number;
  priceType: string;
  category: string;
  subCategory?: string;
  rating: number;
  reviewCount: number;
  imageUrl?: string;
  isActive: boolean;
}

interface OptimizedServiceCardProps {
  service: Service;
  onPress?: (service: Service) => void;
  loading?: boolean;
}

const OptimizedServiceCard = memo(({ service, onPress, loading = false }: OptimizedServiceCardProps) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      const shimmerAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      shimmerAnimation.start();
      return () => shimmerAnimation.stop();
    }
  }, [loading, shimmerAnim]);

  const handlePress = () => {
    if (onPress) {
      onPress(service);
    } else {
      router.push({
        pathname: '/book-service',
        params: {
          serviceId: service._id,
          title: service.title,
          category: service.category,
          price: service.price.toString(),
        },
      });
    }
  };

  if (loading) {
    const shimmerOpacity = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    });

    return (
      <View style={[styles.container, { width: cardWidth }]}>
        <Animated.View style={[styles.skeletonImage, { opacity: shimmerOpacity }]} />
        <View style={styles.content}>
          <Animated.View style={[styles.skeletonTitle, { opacity: shimmerOpacity }]} />
          <Animated.View style={[styles.skeletonTitle, { width: '70%', marginTop: 8, opacity: shimmerOpacity }]} />
          <Animated.View style={[styles.skeletonTitle, { width: '50%', marginTop: 8, opacity: shimmerOpacity }]} />
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, { width: cardWidth }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Service Image */}
      <View style={styles.imageContainer}>
        {service.imageUrl ? (
          <Image
            source={{ uri: service.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={['#FFE5CC', '#FF9A56']}
            style={styles.placeholderImage}
          >
            <Ionicons name="construct-outline" size={32} color="#FF7A2C" />
          </LinearGradient>
        )}
        
        {/* Rating Badge */}
        {service.rating > 0 && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#fff" />
            <Text style={styles.ratingText}>{service.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      {/* Service Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {service.title}
        </Text>
        
        <Text style={styles.category} numberOfLines={1}>
          {service.category}
        </Text>
        
        <Text style={styles.description} numberOfLines={2}>
          {service.description}
        </Text>

        {/* Price and Action */}
        <View style={styles.footer}>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>Rs. {service.price}</Text>
            <Text style={styles.priceType}>/{service.priceType}</Text>
          </View>
          
          <TouchableOpacity style={styles.bookButton} onPress={handlePress}>
            <Ionicons name="add" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Reviews Count */}
        {service.reviewCount > 0 && (
          <Text style={styles.reviewCount}>
            {service.reviewCount} review{service.reviewCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  skeletonImage: {
    height: 100,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginBottom: 0,
    backgroundColor: '#E0E0E0',
  },
  content: {
    padding: 12,
    flex: 1,
  },
  skeletonTitle: {
    height: 14,
    borderRadius: 7,
    marginBottom: 8,
    backgroundColor: '#E0E0E0',
  },
  imageContainer: {
    height: 100,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF7A2C',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  ratingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  category: {
    fontSize: 12,
    color: '#FF7A2C',
    fontWeight: '500',
    marginBottom: 6,
  },
  description: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF7A2C',
  },
  priceType: {
    fontSize: 12,
    color: '#666',
    marginLeft: 2,
  },
  bookButton: {
    backgroundColor: '#FF7A2C',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewCount: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
});

export default OptimizedServiceCard;
