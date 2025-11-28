import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Service } from '@/lib/services';

interface ServiceCardProps {
  service: Service;
  onPress?: () => void;
}

export default function ServiceCard({ service, onPress }: ServiceCardProps) {
  const formatPrice = () => {
    const priceText = `Rs. ${service.price}`;
    switch (service.priceType) {
      case 'hour':
        return `${priceText}/Hour`;
      case 'per_foot':
        return `${priceText}/ft`;
      case 'customize':
        return `${priceText}/Customise`;
      default:
        return priceText;
    }
  };

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, index) => (
      <Ionicons
        key={index}
        name="star"
        size={12}
        color="#FFD700"
        style={{ marginRight: 1 }}
      />
    ));
  };

  const handleBookService = () => {
    router.push({
      pathname: '/book-service',
      params: {
        serviceId: service.id,
        serviceName: service.title,
        serviceCategory: service.category,
        price: service.price,
        image: service.image,
      },
    });
  };

  const handleViewService = () => {
    router.push({
      pathname: '/service-details',
      params: {
        serviceId: service.id,
        serviceName: service.title,
        serviceCategory: service.category,
        price: service.price,
        image: service.image,
        description: service.description,
        rating: service.rating.toString(),
        reviewCount: service.reviewCount.toString(),
      },
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.imageContainer}>
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={40} color="#ccc" />
          </View>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {service.title}
          </Text>
          
          <View style={styles.verifiedContainer}>
            <Text style={styles.verifiedText}>Verified by Sufar</Text>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Price </Text>
            <Text style={styles.priceValue}>{formatPrice()}</Text>
          </View>
          
          <View style={styles.ratingContainer}>
            {renderStars()}
            <Text style={styles.ratingText}>{service.rating}({service.reviewCount})</Text>
          </View>
        </View>
      </View>
      
      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Pressable style={styles.viewButton} onPress={handleViewService}>
          <Ionicons name="eye-outline" size={16} color="#3B82F6" />
          <Text style={styles.viewButtonText}>View</Text>
        </Pressable>
        
        <Pressable style={styles.bookButton} onPress={handleBookService}>
          <Ionicons name="calendar-outline" size={16} color="#fff" />
          <Text style={styles.bookButtonText}>Book</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  imageContainer: {
    width: 80,
    height: 80,
    marginRight: 12,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  verifiedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
    marginLeft: 6,
  },
  bookButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
});
