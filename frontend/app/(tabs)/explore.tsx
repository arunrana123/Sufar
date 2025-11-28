import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ExploreScreen() {
  const services = [
    { id: 1, name: 'Plumber', icon: 'water-outline', color: '#1E40AF' },
    { id: 2, name: 'Electrician', icon: 'flash-outline', color: '#DC2626' },
    { id: 3, name: 'Mechanic', icon: 'car-outline', color: '#059669' },
    { id: 4, name: 'Cleaner', icon: 'sparkles-outline', color: '#7C3AED' },
    { id: 5, name: 'Carpenter', icon: 'hammer-outline', color: '#EA580C' },
    { id: 6, name: 'Painter', icon: 'brush-outline', color: '#DB2777' },
    { id: 7, name: 'Gardener', icon: 'leaf-outline', color: '#16A34A' },
    { id: 8, name: 'Cook', icon: 'restaurant-outline', color: '#CA8A04' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Our Services</Text>
        <Text style={styles.headerSubtitle}>Choose from our professional services</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.servicesGrid}>
          {services.map((service) => (
            <TouchableOpacity key={service.id} style={styles.serviceCard}>
              <View style={[styles.serviceIcon, { backgroundColor: service.color + '20' }]}>
                <Ionicons name={service.icon as any} size={32} color={service.color} />
              </View>
              <Text style={styles.serviceName}>{service.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Ionicons name="star-outline" size={24} color="#F59E0B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Quality Guaranteed</Text>
              <Text style={styles.infoDescription}>All our workers are verified and skilled professionals</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={24} color="#1E40AF" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Quick Response</Text>
              <Text style={styles.infoDescription}>Get service within 30 minutes of booking</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#059669" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Safe & Secure</Text>
              <Text style={styles.infoDescription}>Your safety and security is our top priority</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#AEDAFF',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  serviceIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    textAlign: 'center',
  },
  infoSection: {
    gap: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoContent: {
    flex: 1,
    marginLeft: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});


