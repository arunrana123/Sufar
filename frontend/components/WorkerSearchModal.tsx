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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiUrl } from '@/lib/config';

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
  estimatedArrival?: number; // in minutes
  isAvailable: boolean;
  profileImage?: string;
}

interface WorkerSearchModalProps {
  visible: boolean;
  onClose: () => void;
  serviceCategory: string;
  userLocation: {
    latitude: number;
    longitude: number;
  };
  onWorkerSelect: (worker: Worker) => void;
}

export default function WorkerSearchModal({
  visible,
  onClose,
  serviceCategory,
  userLocation,
  onWorkerSelect,
}: WorkerSearchModalProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  useEffect(() => {
    if (visible) {
      searchWorkers();
    }
  }, [visible, serviceCategory]);

  const searchWorkers = async () => {
    setLoading(true);
    setSearching(true);
    
    try {
      const baseUrl = getApiUrl();
      
      console.log('🔍 Searching for workers:', {
        serviceCategory,
        userLocation,
        radius: 10,
      });
      
      // Call backend API to find available workers
      const response = await fetch(`${baseUrl}/api/workers/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceCategory,
          userLocation,
          radius: 10, // 10km radius
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Workers found:', data.workers?.length || 0);
        console.log('📋 Worker details:', data.workers?.map((w: Worker) => ({
          id: w._id,
          name: w.name,
          phone: w.phone,
          categories: w.serviceCategories,
          status: w.isAvailable,
          distance: w.distance,
        })));
        
        const foundWorkers = data.workers || [];
        
        // Ensure we only use workers with valid IDs (registered workers)
        const validWorkers = foundWorkers.filter((w: Worker) => w._id && typeof w._id === 'string');
        
        if (validWorkers.length !== foundWorkers.length) {
          console.warn('⚠️ Filtered out workers without valid IDs:', foundWorkers.length - validWorkers.length);
        }
        
        console.log('✅ Using registered workers only:', validWorkers.length);
        setWorkers(validWorkers);
        
        if (validWorkers.length > 0) {
          console.log('✅ Using first worker:', validWorkers[0].name, validWorkers[0]._id);
          
          // Auto-select first worker if only one is found
          if (validWorkers.length === 1) {
            console.log('🎯 Auto-selecting the only available worker:', validWorkers[0].name);
            setSelectedWorker(validWorkers[0]);
          }
        } else {
          console.warn('⚠️ No registered workers found for category:', serviceCategory);
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch workers:', response.status, errorText);
        setWorkers([]);
      }
    } catch (error) {
      console.error('❌ Error searching workers:', error);
      setWorkers([]);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  const handleWorkerSelect = (worker: Worker) => {
    setSelectedWorker(worker);
    onWorkerSelect(worker);
    onClose(); // Close modal after selecting worker
  };

  const renderWorkerCard = (worker: Worker) => (
    <TouchableOpacity
      key={worker._id}
      style={[
        styles.workerCard,
        selectedWorker?._id === worker._id && styles.selectedWorkerCard,
      ]}
      onPress={() => handleWorkerSelect(worker)}
    >
      <View style={styles.workerAvatar}>
        {worker.profileImage ? (
          <Text style={styles.avatarText}>📷</Text>
        ) : (
          <Ionicons name="person" size={24} color="#3B82F6" />
        )}
      </View>
      
      <View style={styles.workerInfo}>
        <View style={styles.workerHeader}>
          <Text style={styles.workerName}>{worker.name}</Text>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>{worker.rating}</Text>
          </View>
        </View>
        
        <Text style={styles.workerPhone}>{worker.phone}</Text>
        
        <View style={styles.workerStats}>
          <Text style={styles.statText}>
            {worker.completedJobs} jobs completed
          </Text>
          <Text style={styles.statText}>•</Text>
          <Text style={styles.statText}>
            {worker.distance?.toFixed(1)} km away
          </Text>
        </View>
        
        <View style={styles.arrivalContainer}>
          <Ionicons name="time" size={14} color="#666" />
          <Text style={styles.arrivalText}>
            ETA: {worker.estimatedArrival} minutes
          </Text>
        </View>
      </View>
      
      <View style={styles.selectButton}>
        <Ionicons 
          name={selectedWorker?._id === worker._id ? "checkmark-circle" : "radio-button-off"} 
          size={24} 
          color={selectedWorker?._id === worker._id ? "#3B82F6" : "#ccc"} 
        />
      </View>
    </TouchableOpacity>
  );

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
          <Text style={styles.headerTitle}>Find Available Workers</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Search Status */}
        <View style={styles.searchStatus}>
          {searching ? (
            <View style={styles.searchingContainer}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={styles.searchingText}>Searching for workers...</Text>
            </View>
          ) : (
            <Text style={styles.statusText}>
              Found {workers.length} available workers
            </Text>
          )}
        </View>

        {/* Workers List */}
        <ScrollView style={styles.workersList} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading workers...</Text>
            </View>
          ) : workers.length > 0 ? (
            workers.map(renderWorkerCard)
          ) : (
            <View style={styles.noWorkersContainer}>
              <Ionicons name="person-outline" size={64} color="#ccc" />
              <Text style={styles.noWorkersText}>No workers available</Text>
              <Text style={styles.noWorkersSubtext}>
                Try again in a few minutes or expand your search area
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        {selectedWorker && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => {
                console.log('✅ Confirming worker selection:', selectedWorker.name, selectedWorker._id);
                handleWorkerSelect(selectedWorker);
              }}
            >
              <Text style={styles.confirmButtonText}>
                {workers.length === 1 
                  ? `Book with ${selectedWorker.name}` 
                  : 'Confirm Worker'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Auto-select notification */}
        {workers.length === 1 && selectedWorker && (
          <View style={styles.autoSelectBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.autoSelectText}>
              {selectedWorker.name} is the only available worker. Tap to confirm.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  searchStatus: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  workersList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  workerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedWorkerCard: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  workerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
  },
  workerInfo: {
    flex: 1,
  },
  workerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666',
  },
  workerPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  workerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  arrivalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrivalText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  selectButton: {
    padding: 8,
  },
  noWorkersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noWorkersText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  noWorkersSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButtons: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  autoSelectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 8,
    gap: 8,
  },
  autoSelectText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
});
