// QR SCANNER SCREEN - Scans worker QR codes to verify worker identity and view nearby workers
// Features: Camera QR scanning (expo-barcode-scanner), worker verification, shows nearby workers on map
import React, { useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import QRScanner from '@/components/QRScanner';
import AvailableWorkersMap from '@/components/AvailableWorkersMap';
import { useAuth } from '@/contexts/AuthContext';
import * as Location from 'expo-location';

export default function QRScannerScreen() {
  const { user } = useAuth();
  const [isScanning, setIsScanning] = useState(true);
  const [showWorkersMap, setShowWorkersMap] = useState(false);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [serviceCategory, setServiceCategory] = useState<string>('');

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to find nearby workers.');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({});
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  };

  const handleQRScan = async (data: string) => {
    try {
      const qrData = JSON.parse(data);
      
      if (qrData.type === 'service_request' && qrData.serviceCategory) {
        // Show available workers for the service category
        const location = await getCurrentLocation();
        if (location) {
          setUserLocation(location);
          setServiceCategory(qrData.serviceCategory);
          setShowWorkersMap(true);
          setIsScanning(false);
        } else {
          Alert.alert('Error', 'Unable to get your location. Please try again.');
        }
      } else if (qrData.type === 'worker_verification' && qrData.workerId) {
        // Navigate to worker profile with QR data
        router.push({
          pathname: '/worker-profile',
          params: { qrData: data }
        });
      } else {
        Alert.alert(
          'Invalid QR Code',
          'This QR code is not a valid service request or worker verification code.',
          [
            {
              text: 'Try Again',
              onPress: () => setIsScanning(true),
            },
            {
              text: 'Cancel',
              onPress: () => router.replace('/home'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('QR Scan Error:', error);
      Alert.alert(
        'Error',
        'Failed to process QR code. Please try again.',
        [
          {
            text: 'Try Again',
            onPress: () => setIsScanning(true),
          },
          {
            text: 'Cancel',
            onPress: () => router.replace('/home'),
          },
        ]
      );
    }
  };

  const handleClose = () => {
    router.replace('/home');
  };

  const handleWorkerSelect = (worker: any) => {
    // Navigate to booking screen with selected worker
    router.push({
      pathname: '/book-service',
      params: {
        workerId: worker._id,
        workerName: worker.name,
        serviceCategory: serviceCategory,
      }
    });
  };

  const handleCloseWorkersMap = () => {
    setShowWorkersMap(false);
    setIsScanning(true);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {isScanning ? (
        <QRScanner
          onScan={handleQRScan}
          onClose={handleClose}
        />
      ) : (
        <AvailableWorkersMap
          visible={showWorkersMap}
          onClose={handleCloseWorkersMap}
          serviceCategory={serviceCategory}
          userLocation={userLocation!}
          onWorkerSelect={handleWorkerSelect}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
