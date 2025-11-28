import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { MapView, Marker, PROVIDER_GOOGLE } from './react-native-maps';

interface Worker {
  _id: string;
  name: string;
  phone: string;
  email: string;
  serviceCategories: string[];
  rating: number;
  totalJobs: number;
  completedJobs: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
  estimatedArrival?: number;
  isAvailable: boolean;
  profileImage?: string;
  status: 'available' | 'busy';
}

interface AvailableWorkersMapProps {
  visible: boolean;
  onClose: () => void;
  serviceCategory: string;
  userLocation: {
    latitude: number;
    longitude: number;
  };
  onWorkerSelect: (worker: Worker) => void;
}

const { width, height } = Dimensions.get('window');

export default function AvailableWorkersMap({
  visible,
  onClose,
  serviceCategory,
  userLocation,
  onWorkerSelect,
}: AvailableWorkersMapProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    if (visible) {
      fetchAvailableWorkers();
    }
  }, [visible, serviceCategory]);

  const fetchAvailableWorkers = async () => {
    setLoading(true);
    
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.92:5001';
      
      const response = await fetch(`${apiUrl}/api/workers/available?serviceCategory=${serviceCategory}&latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&radius=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkers(data.workers || []);
        
        // Update map region to show all workers
        if (data.workers && data.workers.length > 0) {
          const coordinates = data.workers
            .filter((worker: Worker) => worker.currentLocation)
            .map((worker: Worker) => worker.currentLocation!);
          
          if (coordinates.length > 0) {
            const minLat = Math.min(...coordinates.map(coord => coord.latitude));
            const maxLat = Math.max(...coordinates.map(coord => coord.latitude));
            const minLon = Math.min(...coordinates.map(coord => coord.longitude));
            const maxLon = Math.max(...coordinates.map(coord => coord.longitude));
            
            setMapRegion({
              latitude: (minLat + maxLat) / 2,
              longitude: (minLon + maxLon) / 2,
              latitudeDelta: Math.max(maxLat - minLat, 0.01) * 1.2,
              longitudeDelta: Math.max(maxLon - minLon, 0.01) * 1.2,
            });
          }
        }
      } else {
        console.error('Failed to fetch available workers');
        setWorkers([]);
      }
    } catch (error) {
      console.error('Error fetching available workers:', error);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerPress = (worker: Worker) => {
    setSelectedWorker(worker);
  };

  const handleSelectWorker = () => {
    if (selectedWorker) {
      onWorkerSelect(selectedWorker);
      onClose();
    }
  };

  const renderWorkerMarker = (worker: Worker) => {
    if (!worker.currentLocation) return null;

    return (
      <Marker
        key={worker._id}
        coordinate={worker.currentLocation}
        onPress={() => handleWorkerPress(worker)}
      >
        <View style={[
          styles.markerContainer,
          selectedWorker?._id === worker._id && styles.selectedMarker
        ]}>
          <View style={[
            styles.markerPin,
            { backgroundColor: worker.status === 'available' ? '#10B981' : '#6B7280' }
          ]}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
          <View style={styles.markerLabel}>
            <Text style={styles.markerText}>{worker.name}</Text>
            <Text style={styles.markerDistance}>
              {worker.distance ? `${worker.distance}km` : 'Nearby'}
            </Text>
          </View>
        </View>
      </Marker>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Available Workers</Text>
          <TouchableOpacity onPress={fetchAvailableWorkers} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Finding available workers...</Text>
            </View>
          ) : (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              region={mapRegion}
              showsUserLocation
              showsMyLocationButton
            >
              {/* User location marker */}
              <Marker
                coordinate={userLocation}
                title="Your Location"
                pinColor="#3B82F6"
              />
              
              {/* Worker markers */}
              {workers.map(renderWorkerMarker)}
            </MapView>
          )}
        </View>

        {/* Worker List */}
        <View style={styles.workerList}>
          <Text style={styles.listTitle}>
            {workers.length} Available Workers
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {workers.map((worker) => (
              <TouchableOpacity
                key={worker._id}
                style={[
                  styles.workerCard,
                  selectedWorker?._id === worker._id && styles.selectedWorkerCard
                ]}
                onPress={() => handleWorkerPress(worker)}
              >
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  <View style={styles.workerDetails}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.workerRating}>{worker.rating.toFixed(1)}</Text>
                    <Text style={styles.workerJobs}>({worker.completedJobs} jobs)</Text>
                  </View>
                  <Text style={styles.workerDistance}>
                    {worker.distance ? `${worker.distance}km away` : 'Nearby'}
                  </Text>
                  <Text style={styles.workerETA}>
                    ETA: {worker.estimatedArrival || 'N/A'} min
                  </Text>
                </View>
                <View style={[
                  styles.statusIndicator,
                  { backgroundColor: worker.status === 'available' ? '#10B981' : '#6B7280' }
                ]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Select Button */}
        {selectedWorker && (
          <View style={styles.selectButtonContainer}>
            <TouchableOpacity style={styles.selectButton} onPress={handleSelectWorker}>
              <Text style={styles.selectButtonText}>
                Select {selectedWorker.name}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  markerContainer: {
    alignItems: 'center',
  },
  selectedMarker: {
    transform: [{ scale: 1.2 }],
  },
  markerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  markerLabel: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  markerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  markerDistance: {
    fontSize: 10,
    color: '#666',
  },
  workerList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  workerCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 140,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedWorkerCard: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  workerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  workerRating: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
  },
  workerJobs: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  workerDistance: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  workerETA: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  statusIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  selectButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  selectButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
