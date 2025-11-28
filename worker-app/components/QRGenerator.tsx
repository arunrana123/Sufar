import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Share,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');

interface QRGeneratorProps {
  onClose: () => void;
}

export default function QRGenerator({ onClose }: QRGeneratorProps) {
  const { worker } = useAuth();
  const [qrCode, setQrCode] = useState<string>('');

  useEffect(() => {
    if (worker) {
      // Generate QR data for worker verification
      const verificationData = {
        type: 'worker_verification',
        workerId: worker.id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        skills: worker.skills,
        experience: worker.experience,
        rating: worker.rating || 0,
        completedJobs: worker.completedJobs || 0,
        profileImage: worker.profileImage,
        verified: true,
        timestamp: new Date().toISOString(),
      };
      
      setQrCode(JSON.stringify(verificationData));
    }
  }, [worker]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Worker Verification QR Code\n\nWorker: ${worker?.name}\nEmail: ${worker?.email}\nSkills: ${worker?.skills.join(', ')}\n\nQR Data: ${qrCode}`,
        title: 'Worker Verification',
      });
    } catch (error) {
      console.error('Error sharing QR code:', error);
      Alert.alert('Error', 'Failed to share QR code');
    }
  };

  const handleSave = () => {
    Alert.alert(
      'QR Code Generated',
      'Your verification QR code has been generated. Users can scan this to verify your credentials.',
      [
        { text: 'OK', onPress: () => {} },
        { text: 'Share', onPress: handleShare },
      ]
    );
  };

  if (!worker) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF7A2C" />
          <Text style={styles.errorText}>Worker data not available</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Worker Verification QR</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Ionicons name="share" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Worker Info */}
        <View style={styles.workerInfo}>
          <Text style={styles.workerName}>{worker.name}</Text>
          <Text style={styles.workerEmail}>{worker.email}</Text>
          <Text style={styles.workerSkills}>
            Skills: {worker.skills.join(', ')}
          </Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrContainer}>
          <View style={styles.qrBox}>
            {qrCode ? (
              <QRCode
                value={qrCode}
                size={200}
                color="#000000"
                backgroundColor="#FFFFFF"
              />
            ) : (
              <Ionicons name="qr-code" size={120} color="#FF7A2C" />
            )}
            <Text style={styles.qrText}>QR Code Generated</Text>
            <Text style={styles.qrSubtext}>Share this with users to verify your identity</Text>
          </View>
        </View>

        {/* Worker Info Display */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color="#FF7A2C" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{worker.name}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="mail" size={20} color="#FF7A2C" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{worker.email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="construct" size={20} color="#FF7A2C" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Skills</Text>
              <Text style={styles.infoValue}>{worker.skills.join(', ')}</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>How it works:</Text>
          <Text style={styles.instructionText}>
            • Users can scan this QR code to verify your credentials
          </Text>
          <Text style={styles.instructionText}>
            • Your profile and verification status will be displayed
          </Text>
          <Text style={styles.instructionText}>
            • This helps build trust with customers
          </Text>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>QR Code Ready</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.secondaryButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#FF7A2C" />
          <Text style={styles.secondaryButtonText}>Share QR Code</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  workerInfo: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  workerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  workerEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  workerSkills: {
    fontSize: 14,
    color: '#FF7A2C',
    fontWeight: '500',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  qrBox: {
    width: width * 0.7,
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF7A2C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  qrText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
  },
  qrSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  instructions: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 5,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#FF7A2C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF7A2C',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#FF7A2C',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#FF7A2C',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
