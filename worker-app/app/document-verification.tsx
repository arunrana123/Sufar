// DOCUMENT VERIFICATION SCREEN - Service category-based document verification
// Features: Service category selection, document upload, uploaded documents view with status
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
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
import { robustFetch, checkNetworkConnectivity, checkServerHealth } from '@/lib/networkUtils';

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
  experienceCertificate?: DocumentFile | DocumentFile[] | null; // Allow single file or array for multiple images
}

export default function DocumentVerificationScreen() {
  const { worker, updateWorker } = useAuth();
  const [loading, setLoading] = useState(true);
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [categoryVerificationStatus, setCategoryVerificationStatus] = useState<{
    [category: string]: 'pending' | 'verified' | 'rejected' | undefined;
  }>({});
  const [categoryDocuments, setCategoryDocuments] = useState<{
    [category: string]: CategoryDocuments;
  }>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (worker?.id) {
      console.log('📋 Document verification screen mounted, loading data for worker:', worker.id);
      console.log('📋 Worker context serviceCategories:', worker.serviceCategories);
      
      // Immediately set serviceCategories from worker context if available (for faster display)
      if (worker.serviceCategories && Array.isArray(worker.serviceCategories) && worker.serviceCategories.length > 0) {
        const contextCategories = worker.serviceCategories.filter((cat: any) => cat && String(cat).trim().length > 0);
        console.log('⚡ Setting serviceCategories from worker context immediately:', contextCategories);
        setServiceCategories(contextCategories);
      }
      
      loadVerificationData();
      
      // Connect to socket for live updates
      const { socketService } = require('@/lib/SocketService');
      socketService.connect(worker.id, 'worker');
      
      // Listen for verification status updates
      const handleVerificationUpdate = (data: any) => {
        if (data.workerId === worker.id || data.category) {
          console.log('📢 Verification update received:', data);
          // Reload verification data
          setTimeout(() => {
            loadVerificationData();
          }, 1000);
        }
      };
      
      // Listen for category verification updates (when admin approves/rejects)
      const handleCategoryVerificationUpdate = (data: any) => {
        if (data.workerId === worker.id) {
          console.log('📢 Category verification update received:', data);
          setCategoryVerificationStatus(prev => ({
            ...prev,
            [data.category]: data.status,
          }));
          
          // Update worker context with new verification status
          if (updateWorker) {
            updateWorker({
              ...worker,
              categoryVerificationStatus: {
                ...worker.categoryVerificationStatus,
                [data.category]: data.status,
              },
            } as any);
          }
          
          // Show alert to worker
          Alert.alert(
            data.status === 'verified' ? '✅ Service Verified!' : '❌ Service Rejected',
            data.status === 'verified'
              ? `Your ${data.category} service has been verified! You can now receive requests for this service.`
              : `Your ${data.category} verification was rejected. ${data.rejectionReason || 'Please resubmit valid documents.'}`,
            [
              { 
                text: 'View Documents', 
                onPress: () => router.push('/uploaded-documents') 
              },
              { text: 'OK' }
            ]
          );
          
          // Reload verification data
          setTimeout(() => {
            loadVerificationData();
          }, 1000);
        }
      };
      
      // Listen for document submission confirmation
      const handleDocumentSubmitted = (data: any) => {
        if (data.workerId === worker.id) {
          console.log('📢 Document submitted confirmation:', data);
          Alert.alert(
            '✅ Documents Submitted',
            'Your documents have been submitted for verification. You will be notified once the review is complete.',
            [{ text: 'OK' }]
          );
          // Reload verification data
          setTimeout(() => {
            loadVerificationData();
          }, 1000);
        }
      };
      
      socketService.on('document:verification:updated', handleVerificationUpdate);
      socketService.on('category:verification:updated', handleCategoryVerificationUpdate);
      socketService.on('category:verification:submitted', handleDocumentSubmitted);
      socketService.on('document:verification:submitted', handleDocumentSubmitted);
      
      return () => {
        socketService.off('document:verification:updated', handleVerificationUpdate);
        socketService.off('category:verification:updated', handleCategoryVerificationUpdate);
        socketService.off('category:verification:submitted', handleDocumentSubmitted);
        socketService.off('document:verification:submitted', handleDocumentSubmitted);
      };
    }
  }, [worker?.id]);

  // Reload verification data when screen comes into focus (e.g., when returning from home)
  useFocusEffect(
    useCallback(() => {
      if (worker?.id) {
        console.log('🔄 Document verification screen focused, reloading data...');
        loadVerificationData(true); // Preserve local uploads when refocusing
      }
    }, [worker?.id])
  );

  const loadVerificationData = async (preserveLocalUploads: boolean = false) => {
    if (!worker?.id) {
      setLoading(false);
      return;
    }

    try {
      const apiUrl = getApiUrl();
      console.log('🔄 Loading verification data for worker:', worker.id);
      const response = await fetch(`${apiUrl}/api/workers/${worker.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const workerData = await response.json();
        console.log('📦 Raw workerData.serviceCategories:', workerData.serviceCategories);
        console.log('📦 Type of serviceCategories:', typeof workerData.serviceCategories);
        
        // Load service categories - ensure it's always an array
        let categories: string[] = [];
        if (Array.isArray(workerData.serviceCategories)) {
          categories = workerData.serviceCategories.filter((cat: string) => cat && String(cat).trim().length > 0);
        } else if (typeof workerData.serviceCategories === 'string' && workerData.serviceCategories.trim().length > 0) {
          categories = [workerData.serviceCategories.trim()];
        }
        
        // Fallback: Also check worker context if backend returns empty
        if (categories.length === 0 && worker?.serviceCategories && Array.isArray(worker.serviceCategories)) {
          console.log('⚠️ Backend returned empty categories, using worker context:', worker.serviceCategories);
          categories = worker.serviceCategories.filter((cat: any) => cat && String(cat).trim().length > 0);
        }
        
        console.log('📋 Document verification - Final serviceCategories to display:', categories);
        console.log('📋 Number of categories:', categories.length);
        setServiceCategories(categories);
        
        // Also update worker context with latest serviceCategories
        if (worker && categories.length > 0) {
          updateWorker({
            ...worker,
            serviceCategories: categories,
          } as any);
          console.log('✅ Updated worker context with serviceCategories in document verification:', categories);
        }

        // Load category documents and status
        const categoryDocs: { [key: string]: CategoryDocuments } = {};
        const categoryStatus: { [key: string]: 'pending' | 'verified' | 'rejected' | undefined } = {};
        
        // Get current local uploads to preserve them if needed
        const currentLocalDocs = preserveLocalUploads ? categoryDocuments : {};
        
        categories.forEach((cat: string): void => {
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
                  ? (Array.isArray(catDocs.experience) 
                      ? catDocs.experience.map((filename: string) => ({
                          uri: `${apiUrl}/uploads/${filename}`,
                          name: filename,
                          mimeType: filename.includes('.pdf') ? 'application/pdf' : 'image/jpeg'
                        }))
                      : {
                          uri: `${apiUrl}/uploads/${catDocs.experience || catDocs.experienceCertificate}`, 
                          name: catDocs.experience || catDocs.experienceCertificate,
                          mimeType: (catDocs.experience || catDocs.experienceCertificate || '').includes('.pdf') ? 'application/pdf' : 'image/jpeg'
                        })
                  : null),
          };
          
          // Only set status if it exists in backend - don't default to 'pending'
          // If no status exists, it means the category needs verification
          const backendStatus = workerData.categoryVerificationStatus?.[cat];
          if (backendStatus) {
            categoryStatus[cat] = backendStatus;
          } else {
            // No status means not yet submitted - leave as undefined
            categoryStatus[cat] = undefined;
          }
        });
        
        setCategoryDocuments(categoryDocs);
        setCategoryVerificationStatus(categoryStatus);
        
        // Update worker context with verificationSubmitted status from backend
        if (updateWorker && workerData) {
          updateWorker({
            ...worker,
            categoryVerificationStatus: categoryStatus,
            categoryDocuments: workerData.categoryDocuments || {},
            verificationStatus: workerData.verificationStatus || {},
            serviceCategories: categories,
            verificationSubmitted: workerData.verificationSubmitted || false,
            submittedAt: workerData.submittedAt || undefined,
          } as any);
          console.log('✅ Worker context updated with verificationSubmitted:', workerData.verificationSubmitted);
        }
        
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
            if (check) {
              if (Array.isArray(check)) {
                console.log('✅✅✅ Multiple documents CONFIRMED in state:', check.length, 'files');
              } else if ((check as DocumentFile).uri) {
                console.log('✅✅✅ Document CONFIRMED in state:', (check as DocumentFile).name, (check as DocumentFile).uri.substring(0, 50));
              }
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
        // Allow multiple selection for experienceCertificate
        const allowMultiple = docType === 'experienceCertificate';
        
        console.log('📷 Opening ImagePicker for image selection...', { allowMultiple, platform: Platform.OS });
        
        // Request permission first (not needed on web)
        if (Platform.OS !== 'web') {
          const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
          console.log('📷 Permission result:', permissionResult);
          
          if (permissionResult.granted === false) {
            Alert.alert(
              'Permission Required',
              'Permission to access photos is required to upload images. Please enable it in your device settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => {
                  ImagePicker.requestMediaLibraryPermissionsAsync();
                }}
              ]
            );
            return;
          }
        } else {
          console.log('🌐 Web platform: No permissions needed for file picker');
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: !allowMultiple, // Don't allow editing when multiple selection
          aspect: allowMultiple ? undefined : [4, 3],
          quality: 0.6, // Reduced from 0.8 to reduce file size (60% quality for faster uploads)
          allowsMultipleSelection: allowMultiple,
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

        // Handle multiple images for experienceCertificate
        if (allowMultiple && result.assets.length > 0) {
          const fileInfos: DocumentFile[] = result.assets.map((asset, index) => {
            if (!asset.uri) {
              throw new Error(`Asset ${index} has no URI`);
            }
            return {
              uri: asset.uri,
              name: asset.fileName || asset.uri.split('/').pop() || `experience-${Date.now()}-${index}.jpg`,
              mimeType: asset.type || 'image/jpeg',
              size: asset.fileSize || 0,
            };
          });
          
          console.log('✅ Multiple images prepared:', fileInfos.length, 'images');
          
          // Update state with array of images - append if already exists
          setCategoryDocuments(prev => {
            const currentCategory = prev[category] || {};
            const existing = currentCategory[docType];
            let newValue: DocumentFile[];
            
            if (Array.isArray(existing)) {
              // Append to existing array
              newValue = [...existing, ...fileInfos];
              console.log('✅ Appending', fileInfos.length, 'images to existing', existing.length, 'images');
            } else {
              // Create new array
              newValue = fileInfos;
              console.log('✅ Creating new array with', fileInfos.length, 'images');
            }
            
            const updated = {
              ...prev,
              [category]: {
                ...currentCategory,
                [docType]: newValue,
              },
            };
            console.log('✅ Multiple images state updated - Category:', category, 'DocType:', docType, 'Total:', newValue.length);
            return updated;
          });
          
          // Show success feedback
          Alert.alert(
            '✅ Images Selected Successfully!',
            `${fileInfos.length} image${fileInfos.length > 1 ? 's' : ''} selected for experience certificate.\n\nYou can add more images or submit now.`,
            [{ text: 'OK' }]
          );
        } else {
          // Single image selection
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
              if (check && (check as DocumentFile).uri) {
                console.log('✅✅✅ Image CONFIRMED in state:', (check as DocumentFile).name);
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

    // Get the latest state directly (avoid race conditions)
    // Use a small delay to ensure state is fully updated if user just picked a file
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get fresh state to avoid stale closures
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
    // Handle experienceCertificate as single file or array
    const experienceCert = docs.experienceCertificate;
    const isExperienceArray = Array.isArray(experienceCert);
    const hasValidExperience = isExperienceArray 
      ? experienceCert.length > 0 && experienceCert.every((f: DocumentFile) => f && f.uri)
      : experienceCert && (experienceCert as DocumentFile).uri;
    
    if (!docs.citizenship?.uri || !docs.serviceCertificate?.uri || !hasValidExperience) {
      Alert.alert('Error', 'Some documents are missing valid file paths. Please re-upload them.');
      return;
    }
    
    // Validate file sizes (max 10MB per file - matches backend limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    const validateFileSize = (file: DocumentFile | DocumentFile[] | null | undefined): { valid: boolean; message?: string } => {
      if (!file) return { valid: true };
      if (Array.isArray(file)) {
        const oversized = file.find(f => f.size && f.size > MAX_FILE_SIZE);
        if (oversized) {
          return { 
            valid: false, 
            message: `One or more Experience Certificate images exceed 10MB. Please compress them or select smaller files.` 
          };
        }
        return { valid: true };
      }
      if (file.size && file.size > MAX_FILE_SIZE) {
        return { 
          valid: false, 
          message: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum of 10MB. Please compress the file or select a smaller one.` 
        };
      }
      return { valid: true };
    };
    
    const sizeChecks = [
      { name: 'Citizenship Document', file: docs.citizenship },
      { name: 'Service Certificate', file: docs.serviceCertificate },
      { name: 'Experience Certificate', file: docs.experienceCertificate },
      { name: 'Driving License', file: docs.drivingLicense },
    ];
    
    for (const { name, file } of sizeChecks) {
      // Handle undefined by converting to null (validateFileSize handles null)
      const check = validateFileSize(file ?? null);
      if (!check.valid) {
        Alert.alert('File Too Large', check.message || `${name} exceeds the maximum file size of 10MB.`);
        return;
      }
    }

    setUploading(category);
    
    // Get API URL outside try block so it's accessible in catch block
    let apiUrl = getApiUrl();
    
    // CRITICAL: For web platform, ALWAYS use localhost (browsers can't connect to local network IPs)
    // This is a runtime safety check in case config didn't convert it properly
    if (Platform.OS === 'web' && apiUrl.match(/192\.168\.\d+\.\d+/)) {
      const portMatch = apiUrl.match(/:(\d+)/);
      const port = portMatch ? portMatch[1] : '5001';
      apiUrl = `http://localhost:${port}`;
      console.log('🌐 [document-verification] Web platform: Runtime conversion to localhost');
      console.log('   Original:', getApiUrl());
      console.log('   Converted:', apiUrl);
    }
    
    try {
      const formData = new FormData();
      
      formData.append('workerId', worker.id);
      formData.append('category', category);
      
      // CRITICAL: Helper function to create properly formatted file data for FormData
      // Android native layer is extremely picky - if type or name is missing, it crashes with "Network request failed"
      // This function ensures all required fields are present and valid before appending to FormData
      const createFormDataFile = (file: DocumentFile | null | undefined): { uri: string; type: string; name: string } | null => {
        // Return null if file is missing (caller should check)
        if (!file) {
          console.warn('⚠️ createFormDataFile: File is null or undefined');
          return null;
        }
        
        if (!file.uri || file.uri.trim().length === 0) {
          console.error('❌ createFormDataFile: URI is missing or empty');
          return null;
        }

        const uri = file.uri.trim();
        
        // CRITICAL: On Android, the type MUST be present and valid (not application/octet-stream)
        // If missing or generic, Android's native network layer will crash before sending the request
        let type = file.mimeType || getMimeType(file);
        if (!type || type === 'application/octet-stream' || type === '') {
          // Fallback to specific MIME type based on file extension
          const ext = getFileExtension(file);
          type = ext === 'pdf' ? 'application/pdf' : 
                 ext === 'png' ? 'image/png' : 'image/jpeg';
          console.warn(`⚠️ Missing or generic mimeType (${file.mimeType}), using fallback: ${type}`);
        }
        
        // CRITICAL: On Android, the name MUST be present and include extension
        // If missing, Android's native network layer will crash before sending the request
        let name = file.name;
        if (!name || name.trim().length === 0 || !name.includes('.')) {
          // Generate filename with proper extension if missing
          const ext = getFileExtension(file);
          const timestamp = Date.now();
          name = file.name && file.name.trim().length > 0
            ? `${file.name.replace(/\.[^/.]+$/, '')}.${ext}` // Replace existing extension
            : `upload_${timestamp}.${ext}`; // Generate new name with extension
          console.warn(`⚠️ Missing or invalid filename (${file.name}), generated: ${name}`);
        }
        
        // Final validation - all fields MUST be present and non-empty
        if (!uri || uri.trim().length === 0) {
          console.error('❌ createFormDataFile: URI is empty after trim');
          return null;
        }
        if (!type || type.trim().length === 0) {
          console.error('❌ createFormDataFile: Type is empty');
          return null;
        }
        if (!name || name.trim().length === 0) {
          console.error('❌ createFormDataFile: Name is empty');
          return null;
        }
        
        const fileData = {
          uri: uri,
          type: type.trim(), // REQUIRED: Must be valid MIME type (e.g., 'image/jpeg', 'application/pdf')
          name: name.trim(), // REQUIRED: Must include file extension (e.g., 'document.jpg', 'file.pdf')
        };
        
        // Verify structure one more time before returning
        if (!fileData.uri || !fileData.type || !fileData.name) {
          console.error('❌ createFormDataFile: File data structure is invalid', fileData);
          return null;
        }
        
        console.log('📄 FormData file created (validated):', {
          uri: uri.substring(0, 80) + (uri.length > 80 ? '...' : ''),
          type: type,
          name: name,
          platform: Platform.OS,
          isContentUri: uri.startsWith('content://'),
          isFileUri: uri.startsWith('file://'),
          uriLength: uri.length,
          allFieldsPresent: !!(fileData.uri && fileData.type && fileData.name),
        });
        
        return fileData;
      };
      
      // Helper function to normalize URI (kept for backward compatibility)
      const normalizeUri = (uri: string) => {
        // React Native FormData handles content:// URIs correctly on Android
        // and file:// URIs correctly on iOS, so we can use them as-is
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
        // On web, DocumentPicker and ImagePicker return blob: or data: URIs
        // We need to convert them to File objects for FormData
        console.log('🌐 Web platform: Converting file URIs to File objects for FormData');
        
        if (docs.drivingLicense) {
          try {
            const file = docs.drivingLicense;
            // On web, URI might be a blob: URL or data: URL
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const fileName = file.name || `drivingLicense-${category}-${Date.now()}.${getFileExtension(file)}`;
            const mimeType = getMimeType(file);
            const fileObj = new File([blob], fileName, { type: mimeType });
            formData.append('drivingLicense', fileObj);
            console.log('✅ Added driving license to FormData (web):', fileName, mimeType);
          } catch (e) {
            console.error('❌ Could not add driving license (web):', e);
            Alert.alert('Upload Error', `Failed to prepare driving license file: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        
        if (docs.citizenship) {
          try {
            const file = docs.citizenship;
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const fileName = file.name || `citizenship-${category}-${Date.now()}.${getFileExtension(file)}`;
            const mimeType = getMimeType(file);
            const fileObj = new File([blob], fileName, { type: mimeType });
            formData.append('citizenship', fileObj);
            console.log('✅ Added citizenship to FormData (web):', fileName, mimeType);
          } catch (e) {
            console.error('❌ Could not add citizenship (web):', e);
            Alert.alert('Upload Error', `Failed to prepare citizenship file: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        
        if (docs.serviceCertificate) {
          try {
            const file = docs.serviceCertificate;
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const fileName = file.name || `serviceCertificate-${category}-${Date.now()}.${getFileExtension(file)}`;
            const mimeType = getMimeType(file);
            const fileObj = new File([blob], fileName, { type: mimeType });
            formData.append('serviceCertificate', fileObj);
            console.log('✅ Added service certificate to FormData (web):', fileName, mimeType);
          } catch (e) {
            console.error('❌ Could not add service certificate (web):', e);
            Alert.alert('Upload Error', `Failed to prepare service certificate file: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        
        if (docs.experienceCertificate) {
          try {
            // Handle multiple images for experience certificate
            if (Array.isArray(docs.experienceCertificate)) {
              for (let i = 0; i < docs.experienceCertificate.length; i++) {
                const file = docs.experienceCertificate[i];
                const response = await fetch(file.uri);
                const blob = await response.blob();
                const fileName = file.name || `experienceCertificate-${category}-${Date.now()}-${i}.${getFileExtension(file)}`;
                const mimeType = getMimeType(file);
                const fileObj = new File([blob], fileName, { type: mimeType });
                formData.append('experienceCertificate', fileObj);
                console.log(`✅ Added experience certificate ${i + 1}/${docs.experienceCertificate.length} to FormData (web):`, fileName, mimeType);
              }
            } else {
              const file = docs.experienceCertificate;
              const response = await fetch(file.uri);
              const blob = await response.blob();
              const fileName = file.name || `experienceCertificate-${category}-${Date.now()}.${getFileExtension(file)}`;
              const mimeType = getMimeType(file);
              const fileObj = new File([blob], fileName, { type: mimeType });
              formData.append('experienceCertificate', fileObj);
              console.log('✅ Added experience certificate to FormData (web):', fileName, mimeType);
            }
          } catch (e) {
            console.error('❌ Could not add experience certificate (web):', e);
            Alert.alert('Upload Error', `Failed to prepare experience certificate file: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        
        console.log('✅ All files converted to File objects for web platform');
      } else {
        // Native platform handling (iOS/Android)
        // CRITICAL: Use createFormDataFile which ensures all required fields are present
        // Android will crash with "Network request failed" if type or name is missing
        
        if (docs.drivingLicense) {
          const fileData = createFormDataFile(docs.drivingLicense);
          if (fileData) {
            console.log('📤 Adding driving license to FormData:', {
              name: fileData.name,
              type: fileData.type,
              uri: fileData.uri.substring(0, 60) + '...',
            });
            formData.append('drivingLicense', fileData as any);
            console.log('✅ Added driving license to FormData');
          } else {
            console.error('❌ Failed to create file data for drivingLicense');
          }
        }
        
        if (docs.citizenship) {
          const fileData = createFormDataFile(docs.citizenship);
          if (fileData) {
            console.log('📤 Adding citizenship to FormData:', {
              name: fileData.name,
              type: fileData.type,
              uri: fileData.uri.substring(0, 60) + '...',
            });
            formData.append('citizenship', fileData as any);
            console.log('✅ Added citizenship to FormData');
          } else {
            console.error('❌ Failed to create file data for citizenship');
          }
        }
        
        if (docs.serviceCertificate) {
          const fileData = createFormDataFile(docs.serviceCertificate);
          if (fileData) {
            console.log('📤 Adding service certificate to FormData:', {
              name: fileData.name,
              type: fileData.type,
              uri: fileData.uri.substring(0, 60) + '...',
            });
            formData.append('serviceCertificate', fileData as any);
            console.log('✅ Added service certificate to FormData');
          } else {
            console.error('❌ Failed to create file data for serviceCertificate');
          }
        }
        
        if (docs.experienceCertificate) {
          // Handle multiple images for experience certificate
          if (Array.isArray(docs.experienceCertificate)) {
            for (let i = 0; i < docs.experienceCertificate.length; i++) {
              const file = docs.experienceCertificate[i];
              const fileData = createFormDataFile(file);
              if (fileData) {
                console.log(`📤 Adding experience certificate ${i + 1}/${docs.experienceCertificate.length} to FormData:`, {
                  name: fileData.name,
                  type: fileData.type,
                  uri: fileData.uri.substring(0, 60) + '...',
                });
                formData.append('experienceCertificate', fileData as any);
                console.log(`✅ Added experience certificate ${i + 1}/${docs.experienceCertificate.length} to FormData`);
              } else {
                console.error(`❌ Failed to create file data for experienceCertificate[${i}]`);
              }
            }
          } else {
            const fileData = createFormDataFile(docs.experienceCertificate);
            if (fileData) {
              console.log('📤 Adding experience certificate to FormData:', {
                name: fileData.name,
                type: fileData.type,
                uri: fileData.uri.substring(0, 60) + '...',
              });
              formData.append('experienceCertificate', fileData as any);
              console.log('✅ Added experience certificate to FormData');
            } else {
              console.error('❌ Failed to create file data for experienceCertificate');
            }
          }
        }
      }
      
      // CRITICAL: Validate all files have valid URIs before attempting upload
      // Android native layer will crash with "Network request failed" if any file is invalid
      console.log('🔍 Pre-upload validation - Checking all file URIs:');
      const validationErrors: string[] = [];
      
      if (docs.citizenship) {
        const uri = docs.citizenship.uri;
        if (!uri || uri.trim().length === 0) {
          validationErrors.push('Citizenship document URI is missing or empty');
        } else {
          console.log('   ✅ citizenship URI:', uri.substring(0, 80) + (uri.length > 80 ? '...' : ''));
        }
      } else {
        validationErrors.push('Citizenship document is required but not provided');
      }
      
      if (docs.serviceCertificate) {
        const uri = docs.serviceCertificate.uri;
        if (!uri || uri.trim().length === 0) {
          validationErrors.push('Service certificate URI is missing or empty');
        } else {
          console.log('   ✅ serviceCertificate URI:', uri.substring(0, 80) + (uri.length > 80 ? '...' : ''));
        }
      } else {
        validationErrors.push('Service certificate is required but not provided');
      }
      
      if (docs.experienceCertificate) {
        if (Array.isArray(docs.experienceCertificate)) {
          if (docs.experienceCertificate.length === 0) {
            validationErrors.push('Experience certificate array is empty');
          } else {
            docs.experienceCertificate.forEach((file, i) => {
              const uri = file.uri;
              if (!uri || uri.trim().length === 0) {
                validationErrors.push(`Experience certificate[${i}] URI is missing or empty`);
              } else {
                console.log(`   ✅ experienceCertificate[${i}] URI:`, uri.substring(0, 80) + (uri.length > 80 ? '...' : ''));
              }
            });
          }
        } else {
          const uri = docs.experienceCertificate.uri;
          if (!uri || uri.trim().length === 0) {
            validationErrors.push('Experience certificate URI is missing or empty');
          } else {
            console.log('   ✅ experienceCertificate URI:', uri.substring(0, 80) + (uri.length > 80 ? '...' : ''));
          }
        }
      } else {
        validationErrors.push('Experience certificate is required but not provided');
      }
      
      if (docs.drivingLicense) {
        const uri = docs.drivingLicense.uri;
        if (!uri || uri.trim().length === 0) {
          console.warn('   ⚠️ drivingLicense URI is missing (optional, but may cause issues)');
        } else {
          console.log('   ✅ drivingLicense URI:', uri.substring(0, 80) + (uri.length > 80 ? '...' : ''));
        }
      }
      
      // If validation fails, stop before attempting upload
      if (validationErrors.length > 0) {
        const errorMsg = `Cannot upload: ${validationErrors.join('; ')}`;
        console.error('❌ Pre-upload validation failed:', errorMsg);
        Alert.alert('Upload Validation Failed', errorMsg);
        return;
      }
      
      console.log('✅ All file URIs validated successfully');
      
      // CRITICAL: Final validation - ensure all required files were successfully added to FormData
      // Count how many files were actually appended
      let filesAppended = 0;
      if (docs.citizenship) filesAppended++;
      if (docs.serviceCertificate) filesAppended++;
      if (docs.experienceCertificate) {
        filesAppended += Array.isArray(docs.experienceCertificate) 
          ? docs.experienceCertificate.length 
          : 1;
      }
      if (docs.drivingLicense) filesAppended++;
      
      console.log(`📊 FormData summary: ${filesAppended} file(s) prepared for upload`);
      
      // Verify we have at least the required files
      const requiredFilesCount = 3; // citizenship, serviceCertificate, experienceCertificate
      if (filesAppended < requiredFilesCount) {
        const errorMsg = `Cannot upload: Only ${filesAppended} file(s) prepared, but ${requiredFilesCount} are required`;
        console.error('❌', errorMsg);
        Alert.alert('Upload Validation Failed', errorMsg);
        return;
      }

      console.log('📤 Submitting documents for category:', category);
      console.log('🌐 API URL:', apiUrl);
      
      // CRITICAL: Verify the API URL is correct for physical device
      // Must NOT be localhost or 127.0.0.1 on physical Android device
      // Web platform can use localhost, so only check for Android
      if (Platform.OS === 'android' && (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1'))) {
        const errorMsg = `❌ ERROR: API URL contains localhost/127.0.0.1 which won't work on physical Android device!\nCurrent URL: ${apiUrl}\n\nPlease ensure your .env file has EXPO_PUBLIC_API_URL set to your computer's IP address (e.g., http://192.168.1.66:5001)`;
        console.error(errorMsg);
        Alert.alert(
          'Configuration Error',
          `API URL is incorrect for physical device:\n${apiUrl}\n\nPlease check your .env file and ensure EXPO_PUBLIC_API_URL is set to your computer's IP address.`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      // For web platform, localhost is fine
      if (Platform.OS === 'web') {
        console.log('🌐 Web platform detected - localhost URLs are acceptable');
      }
      
      const uploadUrl = `${apiUrl}/api/workers/upload-service-documents`;
      console.log('📡 Final Upload URL:', uploadUrl);
      console.log('📱 Platform:', Platform.OS);
      console.log('📱 Device Type:', __DEV__ ? 'Development' : 'Production');
      
      // Verify URL format
      if (!uploadUrl.startsWith('http://') && !uploadUrl.startsWith('https://')) {
        console.error('❌ ERROR: Upload URL is missing protocol:', uploadUrl);
        Alert.alert('Configuration Error', `Invalid upload URL: ${uploadUrl}`);
        return;
      }
      
      // Debug: Log file URIs before creating FormData (to verify they're not null/undefined)
      console.log('🔍 Pre-FormData Debug - File URIs:');
      console.log('   Sending to:', uploadUrl);
      if (docs.drivingLicense) {
        console.log('   drivingLicense URI:', docs.drivingLicense.uri?.substring(0, 100) || 'MISSING');
      } else {
        console.log('   drivingLicense: NOT PROVIDED');
      }
      if (docs.citizenship) {
        console.log('   citizenship URI:', docs.citizenship.uri?.substring(0, 100) || 'MISSING');
      } else {
        console.log('   citizenship: NOT PROVIDED');
      }
      if (docs.serviceCertificate) {
        console.log('   serviceCertificate URI:', docs.serviceCertificate.uri?.substring(0, 100) || 'MISSING');
      } else {
        console.log('   serviceCertificate: NOT PROVIDED');
      }
      if (docs.experienceCertificate) {
        if (Array.isArray(docs.experienceCertificate)) {
          docs.experienceCertificate.forEach((file, i) => {
            console.log(`   experienceCertificate[${i}] URI:`, file.uri?.substring(0, 100) || 'MISSING');
          });
        } else {
          console.log('   experienceCertificate URI:', docs.experienceCertificate.uri?.substring(0, 100) || 'MISSING');
        }
      } else {
        console.log('   experienceCertificate: NOT PROVIDED');
      }
      
      // Log FormData contents for debugging (without exposing sensitive data)
      console.log('📦 FormData prepared with fields:', {
        workerId: worker.id,
        category: category,
        hasDrivingLicense: !!docs.drivingLicense,
        hasCitizenship: !!docs.citizenship,
        hasServiceCertificate: !!docs.serviceCertificate,
        hasExperienceCertificate: !!docs.experienceCertificate,
        experienceCertificateCount: Array.isArray(docs.experienceCertificate) 
          ? docs.experienceCertificate.length 
          : (docs.experienceCertificate ? 1 : 0),
      });
      
      // CRITICAL: Test network connectivity before attempting upload
      // This helps catch IP/routing issues early
      // Skip connectivity test on web (browser handles CORS/network errors differently)
      if (Platform.OS !== 'web') {
        console.log('🔍 Testing network connectivity before upload...');
        const testUrl = `${apiUrl}/health`;
        console.log('   Test URL:', testUrl);
        
        try {
          const testController = new AbortController();
          const testTimeoutId = setTimeout(() => testController.abort(), 5000); // 5 second timeout
          
          try {
            const testResponse = await fetch(testUrl, { 
              method: 'GET',
              signal: testController.signal
            });
            clearTimeout(testTimeoutId);
            
            if (testResponse.ok) {
              const healthData = await testResponse.json().catch(() => ({}));
              console.log('✅ Network connectivity test PASSED');
              console.log('   Server is reachable and responding');
              console.log('   Health check response:', healthData);
            } else {
              console.warn('⚠️ Network test returned status:', testResponse.status);
              console.warn('   Server is reachable but returned non-OK status');
              // Don't block - proceed with upload
            }
          } catch (testError: any) {
            clearTimeout(testTimeoutId);
            
            // This is a critical error - if we can't reach the server, the upload will definitely fail
            console.error('❌ Network connectivity test FAILED');
            console.error('   Error:', testError.message);
            console.error('   This means the server at', apiUrl, 'is not reachable');
            
            // Show user-friendly error with troubleshooting steps
            Alert.alert(
              'Cannot Reach Server',
              `Cannot connect to server at:\n${apiUrl}\n\n` +
              `Please verify:\n` +
              `1. Backend is running (cd backend && bun run dev)\n` +
              `2. Test in browser: ${apiUrl}/health\n` +
              `3. Same WiFi network (device and computer)\n` +
              `4. Correct IP address (check with: ifconfig/ipconfig)\n` +
              `5. Firewall allows port 5001\n` +
              `6. Router doesn't block device-to-device communication\n\n` +
              `Current API URL: ${apiUrl}`,
              [
                {
                  text: 'Retry',
                  onPress: () => {
                    // Retry the upload after user acknowledges
                    setTimeout(() => submitCategoryVerification(category), 1000);
                  }
                },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
            
            // Don't proceed with upload if connectivity test fails
            return;
          }
        } catch (testSetupError: any) {
          // If we can't even set up the test, something is very wrong
          console.error('❌ Could not set up connectivity test:', testSetupError.message);
          Alert.alert(
            'Network Error',
            `Cannot test server connectivity:\n${testSetupError.message}\n\nPlease check your network settings.`,
            [{ text: 'OK' }]
          );
          return;
        }
      } else {
        console.log('🌐 Web platform: Skipping connectivity test (browser handles network errors)');
      }

      // Use fetch for all platforms (React Native fetch handles FormData correctly)
      // Create AbortController for timeout handling (2 minutes for large files)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.error('⏱️ Upload timeout after 2 minutes');
      }, 120000); // 2 minute timeout
      
      console.log('🚀 Starting upload request...');
      console.log('   URL:', uploadUrl);
      console.log('   Method: POST');
      console.log('   Body: FormData (multipart/form-data)');
      console.log('   Platform:', Platform.OS);
      
      // CRITICAL: For native platforms, do NOT set Content-Type header
      // React Native fetch will automatically set: Content-Type: multipart/form-data; boundary=...
      // If you set it manually, the boundary won't be included, causing "Network request failed"
      let response: Response;
      try {
        // Build fetch options - NO Content-Type header for native platforms
        const fetchOptions: RequestInit = {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        };
        
        // Only add Accept header - DO NOT add Content-Type
        // For web platform, we can add Accept header
        // For native, we still add Accept but NEVER Content-Type
        if (Platform.OS === 'web') {
          fetchOptions.headers = {
            'Accept': 'application/json',
          };
        } else {
          // Native platform - only Accept, NO Content-Type
          fetchOptions.headers = {
            'Accept': 'application/json',
            // CRITICAL: DO NOT ADD 'Content-Type' HERE!
            // React Native will automatically add: Content-Type: multipart/form-data; boundary=...
            // If you add it manually, the boundary is missing and the request fails
          };
        }
        
        console.log('📡 Making fetch request:', {
          url: uploadUrl,
          method: fetchOptions.method,
          hasBody: !!fetchOptions.body,
          hasSignal: !!fetchOptions.signal,
          headers: fetchOptions.headers ? Object.keys(fetchOptions.headers) : [],
          // Explicitly showing that Content-Type is NOT in headers
          note: 'Content-Type will be set automatically by React Native with boundary',
          platform: Platform.OS,
        });
        
        // Final check: Ensure formData is not empty
        // This shouldn't happen due to validation above, but double-check
        if (!formData) {
          throw new Error('FormData is null or undefined');
        }
        
        console.log('📤 Sending fetch request now...');
        response = await fetch(uploadUrl, fetchOptions);
        clearTimeout(timeoutId);
        
        console.log('📥 Response received:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        console.error('❌ Fetch error details:', {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack,
          url: uploadUrl,
          platform: Platform.OS,
        });
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Upload timeout: The upload took too long (over 2 minutes). Please check your connection and try again with smaller files.');
        }
        
        // Enhanced error message for network failures
        if (fetchError.message?.includes('Network request failed') || 
            fetchError.message?.includes('Failed to fetch') ||
            fetchError.name === 'TypeError') {
          throw new Error(
            `Network request failed: Cannot connect to ${apiUrl}\n\n` +
            `Possible causes:\n` +
            `1. Backend server is not running\n` +
            `2. Wrong IP address (check .env file)\n` +
            `3. Device not on same WiFi network\n` +
            `4. Firewall blocking port 5001\n` +
            `5. Android cleartext traffic not allowed\n\n` +
            `Current API URL: ${apiUrl}`
          );
        }
        
        throw fetchError;
      }
      
      console.log('📥 Response received, status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Category verification submitted successfully:', result);
        
        // Clear the local documents for this category since they're now submitted
        setCategoryDocuments(prev => {
          const updated = { ...prev };
          updated[category] = {
            drivingLicense: null,
            citizenship: null,
            serviceCertificate: null,
            experienceCertificate: null,
          };
          return updated;
        });
        
        // Update local status to pending
        setCategoryVerificationStatus(prev => ({
          ...prev,
          [category]: 'pending',
        }));
        
        // Update worker context with pending status and verificationSubmitted flag
        if (updateWorker) {
          const updatedWorker = {
            ...worker,
            categoryVerificationStatus: {
              ...(worker.categoryVerificationStatus || {}),
              [category]: 'pending',
            },
            verificationSubmitted: true,
            submittedAt: new Date().toISOString(),
          };
          updateWorker(updatedWorker as any);
          console.log('✅ Worker context updated with verificationSubmitted:', updatedWorker.verificationSubmitted);
        }
        
        // Close the expanded category section
        setSelectedCategory(null);
        
        // Reload verification data immediately to reflect the submission
        await loadVerificationData(false);
        
        Alert.alert(
          '✅ Documents Submitted Successfully!',
          `Your ${category} verification documents have been submitted successfully.\n\n` +
          `Your documents are now pending admin review. You can view them in the "Uploaded Documents" section.\n\n` +
          `You will be notified once the admin reviews your documents.`,
          [
            { 
              text: 'View Uploaded Documents',
              onPress: () => {
                router.push('/uploaded-documents');
              }
            },
            { 
              text: 'OK',
              style: 'default'
            }
          ]
        );
      } else {
        // Get detailed error response from server
        const errorText = await response.text();
        let errorMessage = 'Failed to upload documents. Please try again.';
        let errorDetails = '';
        
        console.error('❌ Upload error response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText,
        });
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
          errorDetails = errorJson.error || errorJson.details || '';
        } catch (e) {
          // If not JSON, use the text as is
          if (errorText) {
            errorMessage = errorText;
            errorDetails = errorText;
          }
        }
        
        // Provide specific error messages based on status code
        let userFriendlyMessage = errorMessage;
        if (response.status === 413) {
          userFriendlyMessage = 'File too large: One or more files exceed the 10MB limit. Please compress your images and try again.';
        } else if (response.status === 400) {
          userFriendlyMessage = `Missing required fields: ${errorMessage}. Please ensure all required documents are uploaded.`;
        } else if (response.status === 500) {
          userFriendlyMessage = `Server error: ${errorMessage}. Please try again later or contact support.`;
        }
        
        console.error('❌ Upload error:', response.status, userFriendlyMessage);
        if (errorDetails) {
          console.error('❌ Error details:', errorDetails);
        }
        
        Alert.alert(
          'Upload Failed', 
          `Status: ${response.status}\n\n${userFriendlyMessage}${errorDetails ? `\n\nDetails: ${errorDetails}` : ''}`
        );
      }
    } catch (error: any) {
      console.error('❌ Error submitting verification:', error);
      
      // Check if it's a network error
      const isNetworkError = error.message?.includes('Network request failed') || 
                            error.name === 'TypeError' ||
                            error.message?.includes('Failed to fetch') ||
                            error.message?.includes('NetworkError');
      
      if (isNetworkError) {
        // Network error - provide helpful message with retry
        Alert.alert(
          'Network Error',
          `Cannot connect to server at ${apiUrl}\n\n` +
          `Please check:\n` +
          `1. Backend is running (cd backend && bun run dev)\n` +
          `2. Test in phone browser: ${apiUrl}/health\n` +
          `3. Same WiFi network\n` +
          `4. Firewall allows port 5001`,
          [
            { 
              text: 'Retry', 
              onPress: () => {
                // Retry after a short delay
                setTimeout(() => {
                  submitCategoryVerification(category);
                }, 1000);
              }
            },
            { text: 'OK', style: 'cancel' }
          ]
        );
      } else {
        // Other error
        Alert.alert(
          'Upload Failed',
          error.message || 'Failed to submit documents. Please try again.',
          [
            { 
              text: 'Retry', 
              onPress: () => {
                setTimeout(() => {
                  submitCategoryVerification(category);
                }, 1000);
              }
            },
            { text: 'OK', style: 'cancel' }
          ]
        );
      }
    } finally {
      setUploading(null);
    }
  };

  // Get categories that need verification
  // Show categories that:
  // 1. Have no status (undefined) - newly added, not yet submitted
  // 2. Are rejected (need resubmission)
  // 3. Have documents locally but haven't been submitted yet (status is undefined)
  // DO NOT show categories with:
  // - status 'verified' (already verified)
  // - status 'pending' (already submitted - they appear in uploaded-documents)
  const getCategoriesNeedingVerification = () => {
    console.log('🔍 Filtering categories needing verification...');
    console.log('   Total serviceCategories:', serviceCategories);
    console.log('   categoryVerificationStatus:', categoryVerificationStatus);
    
    const filtered = serviceCategories.filter(category => {
      const status = categoryVerificationStatus[category];
      const docs = categoryDocuments[category] || {};
      
      console.log(`   Category: ${category}, Status: ${status}, Has docs: ${!!docs.citizenship || !!docs.serviceCertificate || !!docs.experienceCertificate}`);
      
      // If status is 'verified', don't show (already verified)
      if (status === 'verified') {
        console.log(`     ❌ ${category} is verified - hiding`);
        return false;
      }
      
      // If status is 'pending' from server, don't show (already submitted - check uploaded-documents)
      if (status === 'pending') {
        console.log(`     ❌ ${category} is pending - hiding (check uploaded-documents)`);
        return false;
      }
      
      // If status is 'rejected', show (needs resubmission)
      if (status === 'rejected') {
        console.log(`     ✅ ${category} is rejected - showing (needs resubmission)`);
        return true;
      }
      
      // If status is undefined/null (no status from backend), show (needs verification)
      // This means the category was just added and hasn't been submitted yet
      if (status === undefined || status === null) {
        console.log(`     ✅ ${category} has no status - showing (needs verification)`);
        return true;
      }
      
      // If has documents locally but status is undefined/null, show (ready to submit)
      const hasDocuments = docs.citizenship?.uri || docs.serviceCertificate?.uri || docs.experienceCertificate;
      if (hasDocuments && (status === undefined || status === null)) {
        console.log(`     ✅ ${category} has local docs but no status - showing (ready to submit)`);
        return true;
      }
      
      // Default: show if no status
      console.log(`     ✅ ${category} - showing (default)`);
      return true;
    });
    
    console.log('   Filtered categories:', filtered);
    return filtered;
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
  
  console.log('📊 Render - serviceCategories:', serviceCategories);
  console.log('📊 Render - categoriesNeedingVerification:', categoriesNeedingVerification);
  console.log('📊 Render - categoriesNeedingVerification.length:', categoriesNeedingVerification.length);

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
              {serviceCategories.length === 0 ? (
                <>
                  <Ionicons name="document-text-outline" size={64} color="#999" />
                  <Text style={styles.emptyTitle}>No Services Added</Text>
                  <Text style={styles.emptyText}>
                    You haven't added any service categories yet. Please add services from the home screen first.
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                  <Text style={styles.emptyTitle}>All Services Verified</Text>
                  <Text style={styles.emptyText}>
                    All your service categories have been verified and are ready to receive requests.
                  </Text>
                </>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.infoText}>
                Please upload the required documents for each service category to get verified. 
                All documents will be reviewed by our admin team.
              </Text>

              {categoriesNeedingVerification.map((category) => {
                const status = categoryVerificationStatus[category];
                const docs = categoryDocuments[category] || {};
                const isExpanded = selectedCategory === category;
                const isUploading = uploading === category;
                
                // Determine display status - if undefined, show as "Not Started"
                const displayStatus = status || 'not_started';

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
                          displayStatus === 'verified' && styles.statusBadgeVerified,
                          displayStatus === 'rejected' && styles.statusBadgeRejected,
                          displayStatus === 'pending' && styles.statusBadgePending,
                          (displayStatus === 'not_started' || !status) && styles.statusBadgeNotStarted,
                        ]}>
                          <Text style={styles.statusText}>
                            {displayStatus === 'verified' ? 'Verified' : 
                             displayStatus === 'rejected' ? 'Rejected' : 
                             displayStatus === 'pending' ? 'Pending' : 'Not Started'}
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
                        {/* Show success message if status is pending (submitted, waiting for admin) */}
                        {displayStatus === 'pending' && (
                          <View style={styles.successNotice}>
                            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                            <Text style={styles.successText}>
                              ✅ Documents Submitted Successfully!
                            </Text>
                            <Text style={styles.successSubtext}>
                              Your {category} verification documents have been submitted and are pending admin review.
                            </Text>
                            <Text style={styles.successSubtext}>
                              You will be notified once the admin reviews your documents.
                            </Text>
                            <TouchableOpacity
                              style={styles.viewDocumentsLink}
                              onPress={() => router.push('/uploaded-documents')}
                            >
                              <Text style={styles.viewDocumentsLinkText}>View Uploaded Documents →</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        
                        {displayStatus === 'rejected' && (
                          <View style={styles.rejectionNotice}>
                            <Ionicons name="alert-circle" size={20} color="#F44336" />
                            <Text style={styles.rejectionText}>
                              Your documents were rejected. Please resubmit valid documents.
                            </Text>
                          </View>
                        )}
                        
                        {(displayStatus === 'not_started' || !status) && (
                          <View style={styles.notStartedNotice}>
                            <Ionicons name="document-text-outline" size={20} color="#6C757D" />
                            <Text style={styles.notStartedText}>
                              Please upload the required documents to start verification for this service category.
                            </Text>
                          </View>
                        )}
                        
                        {/* Upload sections */}
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

                        {/* Experience Certificate (Required - Multiple Images/PDF) */}
                        <View style={styles.uploadSection}>
                          <View style={styles.uploadLabelContainer}>
                            <Text style={styles.uploadLabel}>
                              Working Experience Certificate <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            {docs.experienceCertificate && (
                              <View style={styles.uploadedBadge}>
                                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                <Text style={styles.uploadedBadgeText}>
                                  {Array.isArray(docs.experienceCertificate) 
                                    ? `${docs.experienceCertificate.length} image${docs.experienceCertificate.length > 1 ? 's' : ''}`
                                    : 'Uploaded'}
                                </Text>
                              </View>
                            )}
                          </View>
                          {docs.experienceCertificate ? (
                            <View>
                              {Array.isArray(docs.experienceCertificate) ? (
                                // Multiple images
                                <ScrollView 
                                  horizontal 
                                  showsHorizontalScrollIndicator={false}
                                  style={styles.multipleImagesContainer}
                                  contentContainerStyle={styles.multipleImagesContent}
                                >
                                  {docs.experienceCertificate.map((file: DocumentFile, index: number) => (
                                    <View key={index} style={styles.multipleImageItem}>
                                      <View style={styles.uploadedPreview}>
                                        <View style={styles.previewHeader}>
                                          <Text style={styles.previewHeaderText}>
                                            Image {index + 1} of {Array.isArray(docs.experienceCertificate) ? docs.experienceCertificate.length : 1}
                                          </Text>
                                        </View>
                                        <Image source={{ uri: file.uri }} style={styles.previewImage} />
                                        <View style={styles.previewFooter}>
                                          <TouchableOpacity
                                            style={styles.removeButton}
                                            onPress={() => {
                                              setCategoryDocuments(prev => {
                                                const currentCategory = prev[category] || {};
                                                const updatedArray = [...(currentCategory.experienceCertificate as DocumentFile[])];
                                                updatedArray.splice(index, 1);
                                                return {
                                                  ...prev,
                                                  [category]: {
                                                    ...currentCategory,
                                                    experienceCertificate: updatedArray.length > 0 ? updatedArray : null,
                                                  },
                                                };
                                              });
                                            }}
                                          >
                                            <Ionicons name="trash-outline" size={16} color="#F44336" />
                                            <Text style={styles.removeButtonText}>Remove</Text>
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    </View>
                                  ))}
                                </ScrollView>
                              ) : (
                                // Single file (PDF or image)
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
                              )}
                              {/* Add More Images Button for Multiple Images */}
                              {docs.experienceCertificate && Array.isArray(docs.experienceCertificate) && (
                                <TouchableOpacity
                                  style={styles.addMoreButton}
                                  onPress={() => pickDocument(category, 'experienceCertificate', false)}
                                >
                                  <Ionicons name="add-circle-outline" size={20} color="#FF7A2C" />
                                  <Text style={styles.addMoreButtonText}>Add More Images</Text>
                                </TouchableOpacity>
                              )}
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
                              <Ionicons name="images-outline" size={32} color="#FF7A2C" />
                              <Text style={styles.uploadButtonText}>Upload Experience Certificate</Text>
                              <Text style={styles.uploadButtonSubtext}>PDF or Multiple Images (for multi-page documents)</Text>
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
                              Experience Certificate {
                                docs.experienceCertificate 
                                  ? (Array.isArray(docs.experienceCertificate) 
                                      ? `✓ (${docs.experienceCertificate.length} image${docs.experienceCertificate.length > 1 ? 's' : ''})`
                                      : '✓')
                                  : '(Required)'
                              }
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
                            (uploading === category || !docs.citizenship || !docs.serviceCertificate || !docs.experienceCertificate) && styles.submitButtonDisabled
                          ]}
                          onPress={() => submitCategoryVerification(category)}
                          disabled={uploading === category || !docs.citizenship || !docs.serviceCertificate || !docs.experienceCertificate}
                        >
                          {uploading === category ? (
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
  statusBadgeNotStarted: {
    backgroundColor: '#E9ECEF',
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
  notStartedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  notStartedText: {
    flex: 1,
    fontSize: 14,
    color: '#6C757D',
    marginLeft: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
  },
  removeButtonText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '600',
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
  multipleImagesContainer: {
    marginVertical: 12,
  },
  multipleImagesContent: {
    paddingRight: 12,
    gap: 12,
  },
  multipleImageItem: {
    width: 280,
    marginRight: 12,
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF7A2C',
    borderStyle: 'dashed',
    backgroundColor: '#FFF5F0',
    marginTop: 12,
  },
  addMoreButtonText: {
    color: '#FF7A2C',
    fontSize: 14,
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
  successNotice: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  successText: {
    color: '#2E7D32',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  successSubtext: {
    color: '#4CAF50',
    fontSize: 13,
    marginTop: 4,
  },
  viewDocumentsLink: {
    marginTop: 12,
    paddingVertical: 8,
  },
  viewDocumentsLinkText: {
    color: '#FF7A2C',
    fontSize: 14,
    fontWeight: '600',
  },
});
