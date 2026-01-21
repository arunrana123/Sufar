// DOCUMENT VERIFICATION SCREEN - Service category-based document verification
// Features: Service category selection, document upload, uploaded documents view with status
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';

interface DocumentFile {
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

interface CategoryDocuments {
  drivingLicense?: DocumentFile | null;
  citizenship?: DocumentFile | null;
  serviceCertificate?: DocumentFile | null;
  experienceCertificate?: DocumentFile | null;
}

export default function DocumentVerificationScreen() {
  const { worker, updateWorker } = useAuth();
  const [loading, setLoading] = useState(true);
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [categoryVerificationStatus, setCategoryVerificationStatus] = useState<{
    [category: string]: 'pending' | 'verified' | 'rejected';
  }>({});
  const [categoryDocuments, setCategoryDocuments] = useState<{
    [category: string]: CategoryDocuments;
  }>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (worker?.id) {
      loadVerificationData();
    }
  }, [worker]);

  const loadVerificationData = async (preserveLocalUploads: boolean = false) => {
    if (!worker?.id) {
      setLoading(false);
      return;
    }

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/workers/${worker.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const workerData = await response.json();
        
        // Load service categories
        const categories = workerData.serviceCategories || [];
        setServiceCategories(categories);

        // Load category documents and status
        const categoryDocs: { [key: string]: CategoryDocuments } = {};
        const categoryStatus: { [key: string]: 'pending' | 'verified' | 'rejected' } = {};
        
        // Get current local uploads to preserve them if needed
        const currentLocalDocs = preserveLocalUploads ? categoryDocuments : {};
        
        categories.forEach((cat: string) => {
          const catDocs = workerData.categoryDocuments?.[cat] || {};
          // Backend stores as skillProof and experience, but we need to map them
          // Convert string URIs to DocumentFile objects for display
          
          // Check if we have local uploads for this category that should be preserved
          const localDocs = currentLocalDocs[cat] || {};
          
          categoryDocs[cat] = {
            // Use local upload if exists and preserveLocalUploads is true, otherwise use server data
            drivingLicense: preserveLocalUploads && localDocs.drivingLicense 
              ? localDocs.drivingLicense
              : (workerData.documents?.license 
                  ? { uri: `${apiUrl}/uploads/${workerData.documents.license}`, name: workerData.documents.license, mimeType: 'image/jpeg' }
                  : null),
            citizenship: preserveLocalUploads && localDocs.citizenship
              ? localDocs.citizenship
              : (workerData.documents?.citizenship
                  ? { uri: `${apiUrl}/uploads/${workerData.documents.citizenship}`, name: workerData.documents.citizenship, mimeType: 'image/jpeg' }
                  : null),
            serviceCertificate: preserveLocalUploads && localDocs.serviceCertificate
              ? localDocs.serviceCertificate
              : (catDocs.skillProof || catDocs.serviceCertificate
                  ? { 
                      uri: `${apiUrl}/uploads/${catDocs.skillProof || catDocs.serviceCertificate}`, 
                      name: catDocs.skillProof || catDocs.serviceCertificate,
                      mimeType: (catDocs.skillProof || catDocs.serviceCertificate || '').includes('.pdf') ? 'application/pdf' : 'image/jpeg'
                    }
                  : null),
            experienceCertificate: preserveLocalUploads && localDocs.experienceCertificate
              ? localDocs.experienceCertificate
              : (catDocs.experience || catDocs.experienceCertificate
                  ? { 
                      uri: `${apiUrl}/uploads/${catDocs.experience || catDocs.experienceCertificate}`, 
                      name: catDocs.experience || catDocs.experienceCertificate,
                      mimeType: (catDocs.experience || catDocs.experienceCertificate || '').includes('.pdf') ? 'application/pdf' : 'image/jpeg'
                    }
                  : null),
          };
          categoryStatus[cat] = workerData.categoryVerificationStatus?.[cat] || 'pending';
        });
        
        setCategoryDocuments(categoryDocs);
        setCategoryVerificationStatus(categoryStatus);
        
        console.log('✅ Verification data loaded, preserved local uploads:', preserveLocalUploads);
      } else {
        console.error('Failed to load verification data:', response.status);
      }
    } catch (error) {
      console.error('Error loading verification data:', error);
      Alert.alert('Error', 'Failed to load verification data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pickDocument = async (category: string, docType: keyof CategoryDocuments, isPDF: boolean = false) => {
    try {
      console.log('📂 Starting document picker for:', category, docType, 'isPDF:', isPDF);
      
      if (isPDF) {
        // For PDF documents - use DocumentPicker which handles both PDFs and images
        console.log('📄 Opening DocumentPicker for PDF/Image selection...');
        
        let result;
        try {
          // Try with specific types first
          result = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'image/*', '*/*'],
            copyToCacheDirectory: true,
            multiple: false,
          });
        } catch (typeError) {
          console.warn('⚠️ Error with specific types, trying with all types:', typeError);
          // Fallback: try with all file types
          try {
            result = await DocumentPicker.getDocumentAsync({
              type: '*/*',
              copyToCacheDirectory: true,
              multiple: false,
            });
          } catch (fallbackError) {
            console.error('❌ DocumentPicker failed completely:', fallbackError);
            Alert.alert(
              'Document Picker Error',
              'Unable to open document picker. Please check app permissions in device settings.',
              [{ text: 'OK' }]
            );
            return;
          }
        }
        
        if (result.canceled) {
          console.log('📄 User canceled document selection');
          return;
        }
        
        if (!result.assets || result.assets.length === 0) {
          console.error('❌ No assets in document picker result');
          Alert.alert('Error', 'No document was selected. Please try again.');
          return;
        }
        
        const asset = result.assets[0];
        console.log('📄 Asset received:', {
          uri: asset.uri?.substring(0, 80),
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size,
        });
        
        if (!asset.uri) {
          console.error('❌ Asset has no URI');
          Alert.alert('Error', 'Selected document has no valid file path. Please try again.');
          return;
        }
        
        // Determine file type and extension
        const fileName = asset.name || '';
        const uriLower = asset.uri.toLowerCase();
        const nameLower = fileName.toLowerCase();
        const mimeType = asset.mimeType || '';
        
        const isPDFFile = mimeType.includes('pdf') || 
                         nameLower.endsWith('.pdf') ||
                         uriLower.includes('.pdf');
        
        const fileInfo: DocumentFile = {
          uri: asset.uri,
          name: fileName || `document-${Date.now()}.${isPDFFile ? 'pdf' : 'jpg'}`,
          mimeType: mimeType || (isPDFFile ? 'application/pdf' : 'image/jpeg'),
          size: asset.size || 0,
        };
        
        console.log('✅ File info prepared:', {
          uri: fileInfo.uri.substring(0, 80) + '...',
          name: fileInfo.name,
          mimeType: fileInfo.mimeType,
          size: fileInfo.size,
          isPDF: isPDFFile,
        });
        
        // Update state immediately
        setCategoryDocuments(prev => {
          const currentCategory = prev[category] || {};
          const updated = {
            ...prev,
            [category]: {
              ...currentCategory,
              [docType]: fileInfo,
            },
          };
          console.log('✅ State updated - Category:', category, 'DocType:', docType);
          console.log('✅ Updated state for category:', updated[category]);
          return updated;
        });
        
        // Verify state was set (with multiple checks)
        setTimeout(() => {
          setCategoryDocuments(current => {
            const check = current[category]?.[docType];
            if (check && check.uri) {
              console.log('✅✅✅ Document CONFIRMED in state:', check.name, check.uri.substring(0, 50));
            } else {
              console.error('❌❌❌ Document NOT in state! Category:', category, 'DocType:', docType);
              console.error('Current state:', JSON.stringify(current[category], null, 2));
            }
            return current;
          });
        }, 200);
        
        // Show success feedback
        Alert.alert(
          '✅ Document Selected Successfully!',
          `File: ${fileInfo.name}\n\nType: ${isPDFFile ? 'PDF Document' : 'Image'}\nSize: ${fileInfo.size ? (fileInfo.size / 1024).toFixed(2) + ' KB' : 'Unknown'}\n\nYou can now submit this document.`,
          [{ text: 'OK' }]
        );
        
      } else {
        // For image-only documents - use ImagePicker
        console.log('📷 Opening ImagePicker for image selection...');
        
        // Request permission first
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('📷 Permission result:', permissionResult);
        
        if (permissionResult.granted === false) {
          Alert.alert(
            'Permission Required',
            'Permission to access photos is required to upload images. Please enable it in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => {
                if (Platform.OS !== 'web') {
                  ImagePicker.requestMediaLibraryPermissionsAsync();
                }
              }}
            ]
          );
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
          allowsMultipleSelection: false,
        });

        console.log('📷 ImagePicker result:', {
          canceled: result.canceled,
          assetsCount: result.assets?.length || 0,
        });

        if (result.canceled) {
          console.log('📷 User canceled image selection');
          return;
        }

        if (!result.assets || result.assets.length === 0) {
          console.error('❌ No assets in image picker result');
          Alert.alert('Error', 'No image was selected. Please try again.');
          return;
        }

        const asset = result.assets[0];
        
        if (!asset.uri) {
          console.error('❌ Asset has no URI');
          Alert.alert('Error', 'Selected image has no valid file path. Please try again.');
          return;
        }
        
        const fileInfo: DocumentFile = {
          uri: asset.uri,
          name: asset.fileName || asset.uri.split('/').pop() || `image-${Date.now()}.jpg`,
          mimeType: asset.type || 'image/jpeg',
          size: asset.fileSize || 0,
        };
        
        console.log('✅ Image info prepared:', {
          uri: fileInfo.uri.substring(0, 80) + '...',
          name: fileInfo.name,
          mimeType: fileInfo.mimeType,
          size: fileInfo.size,
        });
        
        // Update state immediately
        setCategoryDocuments(prev => {
          const currentCategory = prev[category] || {};
          const updated = {
            ...prev,
            [category]: {
              ...currentCategory,
              [docType]: fileInfo,
            },
          };
          console.log('✅ Image state updated - Category:', category, 'DocType:', docType);
          return updated;
        });
        
        // Verify state was set
        setTimeout(() => {
          setCategoryDocuments(current => {
            const check = current[category]?.[docType];
            if (check && check.uri) {
              console.log('✅✅✅ Image CONFIRMED in state:', check.name);
            } else {
              console.error('❌❌❌ Image NOT in state!');
            }
            return current;
          });
        }, 200);
        
        // Show success feedback
        Alert.alert(
          '✅ Image Selected Successfully!',
          `Image has been selected.\n\nFile: ${fileInfo.name}\nSize: ${fileInfo.size ? (fileInfo.size / 1024).toFixed(2) + ' KB' : 'Unknown'}\n\nYou can see the preview below.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('❌❌❌ Error picking document:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      
      let errorMessage = 'Failed to pick document. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        'Document Selection Error',
        errorMessage + '\n\nIf this problem persists, please check:\n• App permissions in device settings\n• Available storage space\n• File format compatibility',
        [{ text: 'OK' }]
      );
    }
  };

  const submitCategoryVerification = async (category: string) => {
    if (!worker?.id) {
      Alert.alert('Error', 'Worker information not available');
      return;
    }

    const docs = categoryDocuments[category] || {};
    
    // Check required documents - now checking DocumentFile objects
    if (!docs.citizenship || !docs.serviceCertificate || !docs.experienceCertificate) {
      Alert.alert(
        'Missing Documents',
        'Please upload all required documents:\n• Citizenship Document\n• Service Certificate\n• Experience Certificate'
      );
      return;
    }

    // Validate that documents have valid URIs
    if (!docs.citizenship.uri || !docs.serviceCertificate.uri || !docs.experienceCertificate.uri) {
      Alert.alert('Error', 'Some documents are missing. Please re-upload them.');
      return;
    }

    setUploading(category);
    
    try {
      const apiUrl = getApiUrl();
      const formData = new FormData();
      
      formData.append('workerId', worker.id);
      formData.append('category', category);
      
      // Helper function to normalize URI for native platforms
      const normalizeUri = (uri: string) => {
        // Handle different URI formats
        if (Platform.OS === 'android') {
          // Android can use content://, file://, or file paths
          if (uri.startsWith('content://') || uri.startsWith('file://') || uri.startsWith('http')) {
            return uri;
          }
          // If it's a plain path, add file://
          return `file://${uri}`;
        } else if (Platform.OS === 'ios') {
          // iOS typically uses file:// or asset-library://
          if (uri.startsWith('file://') || uri.startsWith('ph://') || uri.startsWith('assets-library://')) {
            return uri;
          }
          // If it's a plain path, add file://
          return `file://${uri}`;
        }
        // For web, return as-is
        return uri;
      };

      // Helper function to get file extension from name or mimeType
      const getFileExtension = (file: DocumentFile): string => {
        if (file.name) {
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (ext && ['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
            return ext === 'jpeg' ? 'jpg' : ext;
          }
        }
        if (file.mimeType) {
          if (file.mimeType.includes('pdf')) return 'pdf';
          if (file.mimeType.includes('jpeg') || file.mimeType.includes('jpg')) return 'jpg';
          if (file.mimeType.includes('png')) return 'png';
        }
        return 'jpg'; // default
      };

      // Helper function to get MIME type
      const getMimeType = (file: DocumentFile): string => {
        if (file.mimeType) return file.mimeType;
        const ext = getFileExtension(file);
        if (ext === 'pdf') return 'application/pdf';
        if (ext === 'png') return 'image/png';
        return 'image/jpeg';
      };

      // Handle file uploads for web vs native
      if (Platform.OS === 'web') {
        // Web platform handling - convert URIs to File objects
        if (docs.drivingLicense) {
          try {
            const file = docs.drivingLicense;
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const fileName = file.name || `drivingLicense-${category}-${Date.now()}.${getFileExtension(file)}`;
            const fileObj = new File([blob], fileName, { type: getMimeType(file) });
            formData.append('drivingLicense', fileObj);
            console.log('✅ Added driving license to FormData:', fileName);
          } catch (e) {
            console.error('❌ Could not add driving license:', e);
          }
        }
        
        if (docs.citizenship) {
          try {
            const file = docs.citizenship;
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const fileName = file.name || `citizenship-${category}-${Date.now()}.${getFileExtension(file)}`;
            const fileObj = new File([blob], fileName, { type: getMimeType(file) });
            formData.append('citizenship', fileObj);
            console.log('✅ Added citizenship to FormData:', fileName);
          } catch (e) {
            console.error('❌ Could not add citizenship:', e);
          }
        }
        
        if (docs.serviceCertificate) {
          try {
            const file = docs.serviceCertificate;
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const fileName = file.name || `serviceCertificate-${category}-${Date.now()}.${getFileExtension(file)}`;
            const fileObj = new File([blob], fileName, { type: getMimeType(file) });
            formData.append('serviceCertificate', fileObj);
            console.log('✅ Added service certificate to FormData:', fileName, getMimeType(file));
          } catch (e) {
            console.error('❌ Could not add service certificate:', e);
          }
        }
        
        if (docs.experienceCertificate) {
          try {
            const file = docs.experienceCertificate;
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const fileName = file.name || `experienceCertificate-${category}-${Date.now()}.${getFileExtension(file)}`;
            const fileObj = new File([blob], fileName, { type: getMimeType(file) });
            formData.append('experienceCertificate', fileObj);
            console.log('✅ Added experience certificate to FormData:', fileName);
          } catch (e) {
            console.error('❌ Could not add experience certificate:', e);
          }
        }
      } else {
        // Native platform handling (iOS/Android)
        if (docs.drivingLicense) {
          const file = docs.drivingLicense;
          const ext = getFileExtension(file);
          formData.append('drivingLicense', {
            uri: normalizeUri(file.uri),
            type: getMimeType(file),
            name: file.name || `drivingLicense-${category}-${Date.now()}.${ext}`,
          } as any);
          console.log('✅ Added driving license to FormData (native):', file.name || 'drivingLicense');
        }
        
        if (docs.citizenship) {
          const file = docs.citizenship;
          const ext = getFileExtension(file);
          formData.append('citizenship', {
            uri: normalizeUri(file.uri),
            type: getMimeType(file),
            name: file.name || `citizenship-${category}-${Date.now()}.${ext}`,
          } as any);
          console.log('✅ Added citizenship to FormData (native):', file.name || 'citizenship');
        }
        
        if (docs.serviceCertificate) {
          const file = docs.serviceCertificate;
          const ext = getFileExtension(file);
          const mimeType = getMimeType(file);
          const fileName = file.name || `serviceCertificate-${category}-${Date.now()}.${ext}`;
          
          // Ensure URI is properly formatted for native platforms
          let fileUri = normalizeUri(file.uri);
          
          // For Android, ensure content:// URIs are handled
          if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
            // Content URIs should work as-is for React Native FormData
            console.log('📄 Using content:// URI for Android');
          }
          
          console.log('📄 Preparing service certificate for upload:', {
            uri: fileUri.substring(0, 60) + '...',
            name: fileName,
            mimeType: mimeType,
            extension: ext,
            originalUri: file.uri.substring(0, 60) + '...',
          });
          
          formData.append('serviceCertificate', {
            uri: fileUri,
            type: mimeType,
            name: fileName,
          } as any);
          console.log('✅ Added service certificate to FormData (native):', fileName, mimeType);
        }
        
        if (docs.experienceCertificate) {
          const file = docs.experienceCertificate;
          const ext = getFileExtension(file);
          const mimeType = getMimeType(file);
          const fileName = file.name || `experienceCertificate-${category}-${Date.now()}.${ext}`;
          
          // Ensure URI is properly formatted for native platforms
          let fileUri = normalizeUri(file.uri);
          
          // For Android, ensure content:// URIs are handled
          if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
            // Content URIs should work as-is for React Native FormData
            console.log('📄 Using content:// URI for Android');
          }
          
          console.log('📄 Preparing experience certificate for upload:', {
            uri: fileUri.substring(0, 60) + '...',
            name: fileName,
            mimeType: mimeType,
            extension: ext,
            originalUri: file.uri.substring(0, 60) + '...',
          });
          
          formData.append('experienceCertificate', {
            uri: fileUri,
            type: mimeType,
            name: fileName,
          } as any);
          console.log('✅ Added experience certificate to FormData (native):', fileName, mimeType);
        }
      }

      console.log('📤 Submitting documents for category:', category);
      console.log('📤 FormData prepared with documents');

      const response = await fetch(`${apiUrl}/api/workers/upload-service-documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${worker?.token || ''}`,
          // Don't set Content-Type for FormData - let the browser set it with boundary
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Category verification submitted successfully:', result);
        
        // Update local state - set status to pending
        setCategoryVerificationStatus(prev => ({
          ...prev,
          [category]: 'pending',
        }));
        
        // DON'T clear documents immediately - keep them visible until we confirm server has them
        // The documents will be reloaded from server after a short delay
        
        // Update worker context if available
        if (updateWorker) {
          updateWorker({
            ...worker,
            verificationSubmitted: true,
            submittedAt: new Date().toISOString(),
          } as any);
        }
        
        Alert.alert(
          '✅ Documents Submitted Successfully!',
          `Your ${category} verification documents have been submitted successfully.\n\n` +
          `Status: Pending Admin Review\n\n` +
          `You will be notified once the admin reviews your documents.`,
          [
            { 
              text: 'OK',
              onPress: async () => {
                // Wait a moment for server to process, then reload
                // Don't preserve local uploads since they're now on server
                setTimeout(async () => {
                  await loadVerificationData(false);
                }, 1500);
              }
            }
          ]
        );
      } else {
        const errorText = await response.text();
        let errorMessage = 'Failed to upload documents. Please try again.';
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch (e) {
          // If not JSON, use the text as is
          if (errorText) {
            errorMessage = errorText;
          }
        }
        
        console.error('❌ Upload error:', response.status, errorMessage);
        Alert.alert('Upload Failed', errorMessage);
      }
    } catch (error: any) {
      console.error('❌ Error submitting verification:', error);
      let errorMessage = 'Failed to submit documents. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.toString) {
        errorMessage = error.toString();
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setUploading(null);
    }
  };

  // Get categories that need verification
  const getCategoriesNeedingVerification = () => {
    return serviceCategories.filter(category => {
      const status = categoryVerificationStatus[category] || 'pending';
      const docs = categoryDocuments[category] || {};
      // Show if: status is rejected OR documents are missing (check for DocumentFile objects)
      return status === 'rejected' || 
             !docs.citizenship || 
             !docs.serviceCertificate || 
             !docs.experienceCertificate ||
             (docs.citizenship && !docs.citizenship.uri) ||
             (docs.serviceCertificate && !docs.serviceCertificate.uri) ||
             (docs.experienceCertificate && !docs.experienceCertificate.uri);
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF7A2C" />
            <Text style={styles.loadingText}>Loading verification data...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const categoriesNeedingVerification = getCategoriesNeedingVerification();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Document Verification</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {categoriesNeedingVerification.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
              <Text style={styles.emptyTitle}>All Services Verified</Text>
              <Text style={styles.emptyText}>
                All your service categories have been verified and are ready to receive requests.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.infoText}>
                Please upload the required documents for each service category to get verified. 
                All documents will be reviewed by our admin team.
              </Text>

              {categoriesNeedingVerification.map((category) => {
                const status = categoryVerificationStatus[category] || 'pending';
                const docs = categoryDocuments[category] || {};
                const isExpanded = selectedCategory === category;
                const isUploading = uploading === category;

                return (
                  <View key={category} style={styles.categoryCard}>
                    {/* Category Header */}
                    <TouchableOpacity
                      style={styles.categoryHeader}
                      onPress={() => setSelectedCategory(isExpanded ? null : category)}
                    >
                      <View style={styles.categoryHeaderLeft}>
                        <Ionicons name="briefcase" size={24} color="#FF7A2C" />
                        <Text style={styles.categoryTitle}>{category}</Text>
                      </View>
                      <View style={styles.categoryHeaderRight}>
                        <View style={[
                          styles.statusBadge,
                          status === 'verified' && styles.statusBadgeVerified,
                          status === 'rejected' && styles.statusBadgeRejected,
                          status === 'pending' && styles.statusBadgePending,
                        ]}>
                          <Text style={styles.statusText}>
                            {status === 'verified' ? 'Verified' : 
                             status === 'rejected' ? 'Rejected' : 'Pending'}
                          </Text>
                        </View>
                        <Ionicons 
                          name={isExpanded ? "chevron-up" : "chevron-down"} 
                          size={20} 
                          color="#666" 
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Category Content */}
                    {isExpanded && (
                      <View style={styles.categoryContent}>
                        {status === 'rejected' && (
                          <View style={styles.rejectionNotice}>
                            <Ionicons name="alert-circle" size={20} color="#F44336" />
                            <Text style={styles.rejectionText}>
                              Your documents were rejected. Please resubmit valid documents.
                            </Text>
                          </View>
                        )}

                        {/* Driving License (Optional) */}
                        <View style={styles.uploadSection}>
                          <View style={styles.uploadLabelContainer}>
                            <Text style={styles.uploadLabel}>
                              Driving License (Optional)
                            </Text>
                            {docs.drivingLicense && (
                              <View style={styles.uploadedBadge}>
                                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                <Text style={styles.uploadedBadgeText}>Uploaded</Text>
                              </View>
                            )}
                          </View>
                          {docs.drivingLicense ? (
                            <View style={styles.uploadedPreview}>
                              <View style={styles.previewHeader}>
                                <Text style={styles.previewHeaderText}>Driving License Uploaded</Text>
                              </View>
                              <Image source={{ uri: docs.drivingLicense.uri }} style={styles.previewImage} />
                              <View style={styles.previewFooter}>
                                <TouchableOpacity
                                  style={styles.changeButton}
                                  onPress={() => pickDocument(category, 'drivingLicense')}
                                >
                                  <Text style={styles.changeButtonText}>Change Image</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.uploadButton}
                              onPress={() => {
                                console.log('🔘 Upload button pressed for drivingLicense');
                                pickDocument(category, 'drivingLicense', false);
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="cloud-upload-outline" size={32} color="#FF7A2C" />
                              <Text style={styles.uploadButtonText}>Upload Driving License</Text>
                              <Text style={styles.uploadButtonSubtext}>Tap to select from gallery</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Citizenship (Required) */}
                        <View style={styles.uploadSection}>
                          <View style={styles.uploadLabelContainer}>
                            <Text style={styles.uploadLabel}>
                              Citizenship Document <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            {docs.citizenship && (
                              <View style={styles.uploadedBadge}>
                                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                <Text style={styles.uploadedBadgeText}>Uploaded</Text>
                              </View>
                            )}
                          </View>
                          {docs.citizenship ? (
                            <View style={styles.uploadedPreview}>
                              <View style={styles.previewHeader}>
                                <Text style={styles.previewHeaderText}>Citizenship Document Uploaded</Text>
                              </View>
                              <Image source={{ uri: docs.citizenship.uri }} style={styles.previewImage} />
                              <View style={styles.previewFooter}>
                                <TouchableOpacity
                                  style={styles.changeButton}
                                  onPress={() => pickDocument(category, 'citizenship')}
                                >
                                  <Text style={styles.changeButtonText}>Change Image</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.uploadButton}
                              onPress={() => {
                                console.log('🔘 Upload button pressed for citizenship');
                                pickDocument(category, 'citizenship', false);
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="cloud-upload-outline" size={32} color="#FF7A2C" />
                              <Text style={styles.uploadButtonText}>Upload Citizenship</Text>
                              <Text style={styles.uploadButtonSubtext}>Tap to select from gallery</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Service Certificate (Required - PDF) */}
                        <View style={styles.uploadSection}>
                          <View style={styles.uploadLabelContainer}>
                            <Text style={styles.uploadLabel}>
                              Service Certificate (PDF/Image) <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            {docs.serviceCertificate && (
                              <View style={styles.uploadedBadge}>
                                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                <Text style={styles.uploadedBadgeText}>Uploaded</Text>
                              </View>
                            )}
                          </View>
                          {docs.serviceCertificate ? (
                            <View style={styles.uploadedPreview}>
                              <View style={styles.previewHeader}>
                                <Text style={styles.previewHeaderText}>Service Certificate Uploaded</Text>
                              </View>
                              {(() => {
                                const isPDF = docs.serviceCertificate.mimeType?.includes('pdf') || 
                                             docs.serviceCertificate.name?.toLowerCase().endsWith('.pdf');
                                return isPDF ? (
                                  <View style={styles.pdfPreviewContainer}>
                                    <View style={styles.pdfIconContainer}>
                                      <Ionicons name="document-text" size={64} color="#FF7A2C" />
                                    </View>
                                    <Text style={styles.fileNameText} numberOfLines={2}>
                                      {docs.serviceCertificate.name || 'Service Certificate.pdf'}
                                    </Text>
                                    <View style={styles.pdfBadge}>
                                      <Ionicons name="document" size={14} color="#FF7A2C" />
                                      <Text style={styles.pdfBadgeText}>PDF Document</Text>
                                    </View>
                                  </View>
                                ) : (
                                  <Image source={{ uri: docs.serviceCertificate.uri }} style={styles.previewImage} />
                                );
                              })()}
                              <View style={styles.previewFooter}>
                                <TouchableOpacity
                                  style={styles.changeButton}
                                  onPress={() => pickDocument(category, 'serviceCertificate', true)}
                                >
                                  <Text style={styles.changeButtonText}>
                                    {docs.serviceCertificate.mimeType?.includes('pdf') || 
                                     docs.serviceCertificate.name?.toLowerCase().endsWith('.pdf')
                                      ? 'Change Document' 
                                      : 'Change Image'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.uploadButton}
                              onPress={() => {
                                console.log('🔘 Upload button pressed for serviceCertificate');
                                pickDocument(category, 'serviceCertificate', true);
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="document-text-outline" size={32} color="#FF7A2C" />
                              <Text style={styles.uploadButtonText}>Upload Service Certificate</Text>
                              <Text style={styles.uploadButtonSubtext}>PDF or Image format</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Experience Certificate (Required) */}
                        <View style={styles.uploadSection}>
                          <View style={styles.uploadLabelContainer}>
                            <Text style={styles.uploadLabel}>
                              Working Experience Certificate <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            {docs.experienceCertificate && (
                              <View style={styles.uploadedBadge}>
                                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                <Text style={styles.uploadedBadgeText}>Uploaded</Text>
                              </View>
                            )}
                          </View>
                          {docs.experienceCertificate ? (
                            <View style={styles.uploadedPreview}>
                              <View style={styles.previewHeader}>
                                <Text style={styles.previewHeaderText}>Experience Certificate Uploaded</Text>
                              </View>
                              {(() => {
                                const isPDF = docs.experienceCertificate.mimeType?.includes('pdf') || 
                                             docs.experienceCertificate.name?.toLowerCase().endsWith('.pdf');
                                return isPDF ? (
                                  <View style={styles.pdfPreviewContainer}>
                                    <View style={styles.pdfIconContainer}>
                                      <Ionicons name="document-text" size={64} color="#FF7A2C" />
                                    </View>
                                    <Text style={styles.fileNameText} numberOfLines={2}>
                                      {docs.experienceCertificate.name || 'Experience Certificate.pdf'}
                                    </Text>
                                    <View style={styles.pdfBadge}>
                                      <Ionicons name="document" size={14} color="#FF7A2C" />
                                      <Text style={styles.pdfBadgeText}>PDF Document</Text>
                                    </View>
                                  </View>
                                ) : (
                                  <Image source={{ uri: docs.experienceCertificate.uri }} style={styles.previewImage} />
                                );
                              })()}
                              <View style={styles.previewFooter}>
                                <TouchableOpacity
                                  style={styles.changeButton}
                                  onPress={() => pickDocument(category, 'experienceCertificate', true)}
                                >
                                  <Text style={styles.changeButtonText}>
                                    {docs.experienceCertificate.mimeType?.includes('pdf') || 
                                     docs.experienceCertificate.name?.toLowerCase().endsWith('.pdf')
                                      ? 'Change Document' 
                                      : 'Change Image'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.uploadButton}
                              onPress={() => {
                                console.log('🔘 Upload button pressed for experienceCertificate');
                                pickDocument(category, 'experienceCertificate', true);
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="document-text-outline" size={32} color="#FF7A2C" />
                              <Text style={styles.uploadButtonText}>Upload Experience Certificate</Text>
                              <Text style={styles.uploadButtonSubtext}>PDF or Image format</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Documents Summary */}
                        <View style={styles.documentsSummary}>
                          <Text style={styles.summaryTitle}>Documents Summary</Text>
                          <View style={styles.summaryItem}>
                            <Ionicons 
                              name={docs.citizenship ? "checkmark-circle" : "ellipse-outline"} 
                              size={18} 
                              color={docs.citizenship ? "#4CAF50" : "#999"} 
                            />
                            <Text style={[styles.summaryText, docs.citizenship && styles.summaryTextComplete]}>
                              Citizenship Document {docs.citizenship ? '✓' : '(Required)'}
                            </Text>
                          </View>
                          <View style={styles.summaryItem}>
                            <Ionicons 
                              name={docs.serviceCertificate ? "checkmark-circle" : "ellipse-outline"} 
                              size={18} 
                              color={docs.serviceCertificate ? "#4CAF50" : "#999"} 
                            />
                            <Text style={[styles.summaryText, docs.serviceCertificate && styles.summaryTextComplete]}>
                              Service Certificate {docs.serviceCertificate ? '✓' : '(Required)'}
                            </Text>
                          </View>
                          <View style={styles.summaryItem}>
                            <Ionicons 
                              name={docs.experienceCertificate ? "checkmark-circle" : "ellipse-outline"} 
                              size={18} 
                              color={docs.experienceCertificate ? "#4CAF50" : "#999"} 
                            />
                            <Text style={[styles.summaryText, docs.experienceCertificate && styles.summaryTextComplete]}>
                              Experience Certificate {docs.experienceCertificate ? '✓' : '(Required)'}
                            </Text>
                          </View>
                          {docs.drivingLicense && (
                            <View style={styles.summaryItem}>
                              <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                              <Text style={[styles.summaryText, styles.summaryTextComplete]}>
                                Driving License ✓ (Optional)
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                          style={[
                            styles.submitButton, 
                            (isUploading || !docs.citizenship || !docs.serviceCertificate || !docs.experienceCertificate) && styles.submitButtonDisabled
                          ]}
                          onPress={() => submitCategoryVerification(category)}
                          disabled={isUploading || !docs.citizenship || !docs.serviceCertificate || !docs.experienceCertificate}
                        >
                          {isUploading ? (
                            <>
                              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                              <Text style={styles.submitButtonText}>Submitting...</Text>
                            </>
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                              <Text style={styles.submitButtonText}>Submit for Verification</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        
                        {(!docs.citizenship || !docs.serviceCertificate || !docs.experienceCertificate) && (
                          <Text style={styles.submitHint}>
                            Please upload all required documents to submit
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safe: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#FF7A2C',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    marginBottom: 80,
  },
  scrollContent: {
    padding: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeVerified: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  categoryContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  rejectionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  rejectionText: {
    flex: 1,
    fontSize: 14,
    color: '#C62828',
    lineHeight: 20,
  },
  uploadSection: {
    marginBottom: 20,
  },
  uploadLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  requiredStar: {
    color: '#F44336',
    fontSize: 14,
  },
  uploadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  uploadedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  uploadButton: {
    backgroundColor: '#FFF5F0',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF7A2C',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF7A2C',
    marginTop: 8,
  },
  uploadButtonSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  uploadedPreview: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#fff',
    minHeight: 250,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  previewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  previewHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  removeButton: {
    padding: 4,
  },
  previewImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
    backgroundColor: '#F5F5F5',
  },
  previewFooter: {
    width: '100%',
    backgroundColor: '#E3F2FD',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    alignItems: 'center',
  },
  previewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  previewInfoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  previewActions: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  pdfPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    width: '100%',
    minHeight: 250,
    backgroundColor: '#FFF5F0',
  },
  pdfIconContainer: {
    backgroundColor: '#FFE5CC',
    borderRadius: 50,
    padding: 20,
    marginBottom: 16,
  },
  fileNameText: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  pdfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFE5CC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  pdfBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF7A2C',
  },
  fileSizeText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  changeButton: {
    backgroundColor: '#FF7A2C',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  changeButtonFull: {
    backgroundColor: '#FF7A2C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#FF7A2C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  documentsSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: '#666',
  },
  summaryTextComplete: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});
