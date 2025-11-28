import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  priceType: 'hour' | 'per_foot' | 'fixed' | 'customize';
  description: string;
}

interface ServiceCartProps {
  services: Service[];
  onRemoveService: (serviceId: string) => void;
  onAddService: () => void;
}

export default function ServiceCart({
  services,
  onRemoveService,
  onAddService,
}: ServiceCartProps) {
  const getCategoryIcon = (category: string) => {
    const icons: {[key: string]: string} = {
      'Plumber': 'water',
      'Electrician': 'flash',
      'Carpenter': 'hammer',
      'Cleaner': 'sparkles',
      'Mechanic': 'construct',
      'AC Repair': 'snow',
      'Painter': 'brush',
      'Mason': 'cube',
      'Cook': 'restaurant',
      'Driver': 'car',
      'Security': 'shield',
      'Beautician': 'flower',
      'Technician': 'settings',
      'Delivery': 'bicycle',
      'Gardener': 'leaf'
    };
    return icons[category] || 'briefcase';
  };

  const handleRemoveService = (serviceId: string) => {
    Alert.alert(
      'Remove Service',
      'Are you sure you want to remove this service?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemoveService(serviceId) }
      ]
    );
  };

  const groupedServices = services.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as {[key: string]: Service[]});

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="briefcase" size={20} color="#FF7A2C" />
          <Text style={styles.headerTitle}>My Services</Text>
          <View style={styles.serviceCount}>
            <Text style={styles.serviceCountText}>{services.length}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={onAddService}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {services.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="briefcase-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Services Added</Text>
          <Text style={styles.emptyDescription}>
            Add services to show your skills to potential clients
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={onAddService}>
            <Text style={styles.emptyButtonText}>Add Your First Service</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.servicesList} showsVerticalScrollIndicator={false}>
          {Object.entries(groupedServices).map(([category, categoryServices]) => (
            <View key={category} style={styles.categoryGroup}>
              <View style={styles.categoryHeader}>
                <Ionicons 
                  name={getCategoryIcon(category) as any} 
                  size={16} 
                  color="#FF7A2C" 
                />
                <Text style={styles.categoryTitle}>{category}</Text>
                <Text style={styles.categoryCount}>({categoryServices.length})</Text>
              </View>

              {categoryServices.map((service) => (
                <View key={service.id} style={styles.serviceCard}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.serviceDescription} numberOfLines={2}>
                      {service.description}
                    </Text>
                  </View>

                  <View style={styles.serviceActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleRemoveService(service.id)}
                    >
                      <Ionicons name="trash" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  serviceCount: {
    backgroundColor: '#FF7A2C',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  serviceCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#FF7A2C',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: '#FF7A2C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  servicesList: {
    maxHeight: 300,
  },
  categoryGroup: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
  },
  categoryCount: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  serviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  serviceActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
});
