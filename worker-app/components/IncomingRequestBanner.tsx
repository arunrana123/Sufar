import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface IncomingRequestBannerProps {
  visible: boolean;
  booking: any | null;
  onReview: () => void;
  onAccept: () => void | Promise<void>;
  onDismiss: () => void;
}

export default function IncomingRequestBanner({
  visible,
  booking,
  onReview,
  onAccept,
  onDismiss,
}: IncomingRequestBannerProps) {
  if (!visible || !booking) return null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="briefcase-outline" size={20} color="#fff" />
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            New {booking.serviceName || booking.serviceTitle} request
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {booking.location?.address || 'Nearby'} • Rs. {booking.price}
          </Text>
        </View>
        <TouchableOpacity style={styles.reviewBtn} onPress={onReview}>
          <Text style={styles.reviewText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
          <Ionicons name="close" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 100,
    zIndex: 9999,
    elevation: 999,
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FF7A2C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  reviewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  reviewText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  acceptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#10B981',
  },
  acceptText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  closeBtn: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
});


