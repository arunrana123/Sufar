import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';

interface DocumentVerificationProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface DocumentData {
  certificate: string | null;
  citizenship: string | null;
  profilePhoto: string | null;
  license?: string | null; // For drivers
}

export default function DocumentVerification({ onComplete, onSkip }: DocumentVerificationProps) {
  const { worker, updateWorker } = useAuth();
  const [documents, setDocuments] = useState<DocumentData>({
    certificate: null,
    citizenship: null,
    profilePhoto: null,
    license: null,
  });
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { id: 'profilePhoto', title: 'Profile Photo', description: 'Upload a clear photo showing your face' },
    { id: 'certificate', title: 'Professional Certificate', description: 'Upload your professional certification' },
    { id: 'citizenship', title: 'Citizenship Document', description: 'Upload your citizenship or national ID' },
  ];

  // Add license step for drivers
  const isDriver = worker?.skills?.some(skill => 
    skill.toLowerCase().includes('driver') || 
    skill.toLowerCase().includes('delivery')
  );

  if (isDriver && !steps.find(step => step.id === 'license')) {
    steps.push({
      id: 'license',
      title: 'Driving License',
      description: 'Upload your valid driving license'
    });
  }

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return false;
      }
    }
    return true;
  };

  const pickImage = async (documentType: keyof DocumentData) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: documentType === 'profilePhoto' ? [1, 1] : [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setDocuments(prev => ({
        ...prev,
        [documentType]: result.assets[0].uri,
      }));
    }
  };

  const takePhoto = async (documentType: keyof DocumentData) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: documentType === 'profilePhoto' ? [1, 1] : [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setDocuments(prev => ({
        ...prev,
        [documentType]: result.assets[0].uri,
      }));
    }
  };

  const showImageOptions = (documentType: keyof DocumentData) => {
    Alert.alert(
      'Select Image',
      'Choose how you want to add the image',
      [
        { text: 'Camera', onPress: () => takePhoto(documentType) },
        { text: 'Gallery', onPress: () => pickImage(documentType) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const requiredDocs = ['profilePhoto', 'certificate', 'citizenship'];
    const missingDocs = requiredDocs.filter(doc => !documents[doc as keyof DocumentData]);
    
    if (isDriver && !documents.license) {
      missingDocs.push('license');
    }

    if (missingDocs.length > 0) {
      Alert.alert(
        'Missing Documents',
        `Please upload: ${missingDocs.join(', ')}`,
        [{ text: 'OK' }]
      );
      return;
    }

    setUploading(true);
    try {
      // Upload documents to backend
      const apiUrl = getApiUrl();
      const formData = new FormData();
      
      Object.entries(documents).forEach(([key, value]) => {
        if (value) {
          formData.append(key, {
            uri: value,
            type: 'image/jpeg',
            name: `${key}.jpg`,
          } as any);
        }
      });

      const response = await fetch(`${apiUrl}/api/workers/upload-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${worker?.token}`,
        },
        body: formData,
      });

      if (response.ok) {
        Alert.alert(
          'Documents Submitted',
          'Your documents have been submitted for verification. You will be notified once approved.',
          [{ text: 'OK', onPress: onComplete }]
        );
      } else {
        throw new Error('Failed to upload documents');
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      Alert.alert('Error', 'Failed to upload documents. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const currentStepData = steps[currentStep];
  const currentDocument = documents[currentStepData.id as keyof DocumentData];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Document Verification</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentStep + 1) / steps.length) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          Step {currentStep + 1} of {steps.length}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step Info */}
        <View style={styles.stepInfo}>
          <Text style={styles.stepTitle}>{currentStepData.title}</Text>
          <Text style={styles.stepDescription}>{currentStepData.description}</Text>
        </View>

        {/* Document Upload */}
        <View style={styles.uploadContainer}>
          {currentDocument ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: currentDocument }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => showImageOptions(currentStepData.id as keyof DocumentData)}
              >
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => showImageOptions(currentStepData.id as keyof DocumentData)}
            >
              <Ionicons name="cloud-upload-outline" size={48} color="#FF7A2C" />
              <Text style={styles.uploadText}>Tap to upload</Text>
              <Text style={styles.uploadSubtext}>
                {currentStepData.id === 'profilePhoto' 
                  ? 'Take a clear selfie' 
                  : 'Take a photo or select from gallery'
                }
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Requirements */}
        <View style={styles.requirements}>
          <Text style={styles.requirementsTitle}>Requirements:</Text>
          {currentStepData.id === 'profilePhoto' && (
            <>
              <Text style={styles.requirementText}>• Clear photo showing your face</Text>
              <Text style={styles.requirementText}>• Good lighting</Text>
              <Text style={styles.requirementText}>• No sunglasses or hat</Text>
            </>
          )}
          {currentStepData.id === 'certificate' && (
            <>
              <Text style={styles.requirementText}>• Professional certification</Text>
              <Text style={styles.requirementText}>• Clear and readable text</Text>
              <Text style={styles.requirementText}>• Valid and current</Text>
            </>
          )}
          {currentStepData.id === 'citizenship' && (
            <>
              <Text style={styles.requirementText}>• Citizenship or National ID</Text>
              <Text style={styles.requirementText}>• Both sides if applicable</Text>
              <Text style={styles.requirementText}>• Clear and readable</Text>
            </>
          )}
          {currentStepData.id === 'license' && (
            <>
              <Text style={styles.requirementText}>• Valid driving license</Text>
              <Text style={styles.requirementText}>• Front and back</Text>
              <Text style={styles.requirementText}>• Not expired</Text>
            </>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            !currentDocument && styles.nextButtonDisabled
          ]}
          onPress={handleNext}
          disabled={!currentDocument || uploading}
        >
          {uploading ? (
            <Text style={styles.nextButtonText}>Uploading...</Text>
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStep === steps.length - 1 ? 'Submit' : 'Next'}
            </Text>
          )}
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
  skipButton: {
    padding: 8,
  },
  skipText: {
    color: '#FF7A2C',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 60,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF7A2C',
    borderRadius: 2,
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepInfo: {
    marginBottom: 30,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  uploadContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  uploadButton: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: '#FF7A2C',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFE5CC',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF7A2C',
    marginTop: 10,
  },
  uploadSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  imagePreview: {
    position: 'relative',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  changeButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#FF7A2C',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  requirements: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  requirementText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  nextButton: {
    backgroundColor: '#FF7A2C',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
