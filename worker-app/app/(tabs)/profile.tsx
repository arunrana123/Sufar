import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  SafeAreaView,
  Platform,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';
import { router } from 'expo-router';
import { socketService } from '@/lib/SocketService';
import PasswordChangeModal from '@/components/PasswordChangeModal';
import NotificationSettingsModal from '@/components/NotificationSettingsModal';
import HelpSupportModal from '@/components/HelpSupportModal';

export default function ProfileScreen() {
  const { worker, updateWorker, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(worker?.profileImage || null);
  const [pendingImageUpdate, setPendingImageUpdate] = useState(false);
  const [formData, setFormData] = useState({
    name: worker?.name || '',
    email: worker?.email || '',
    phone: worker?.phone || '',
    skills: worker?.skills?.join(', ') || '',
  });

  const [documents, setDocuments] = useState({
    profilePhoto: worker?.documents?.profilePhoto || null,
    certificate: worker?.documents?.certificate || null,
    citizenship: worker?.documents?.citizenship || null,
    license: worker?.documents?.license || null,
  });

  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState({
    profilePhoto: null as string | null,
    certificate: null as string | null,
    citizenship: null as string | null,
    license: null as string | null,
  });

  const [verificationStatus, setVerificationStatus] = useState<{
    profilePhoto: string;
    certificate: string;
    citizenship: string;
    license?: string;
    overall: string;
  }>({
    profilePhoto: worker?.verificationStatus?.profilePhoto || 'pending',
    certificate: worker?.verificationStatus?.certificate || 'pending',
    citizenship: worker?.verificationStatus?.citizenship || 'pending',
    license: worker?.verificationStatus?.license || 'pending',
    overall: worker?.verificationStatus?.overall || 'pending',
  });
  
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(worker?.verificationSubmitted || false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Service category verification state
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [categoryVerificationDocs, setCategoryVerificationDocs] = useState<{
    [category: string]: {
      skillProof: string | null;
      experience: string | null;
    }
  }>({});
  const [categoryVerificationStatus, setCategoryVerificationStatus] = useState<{
    [category: string]: 'pending' | 'verified' | 'rejected';
  }>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);

  // Initialize data from worker on mount only
  useEffect(() => {
    if (worker) {
      setProfileImage(worker.profileImage || null);
      
      if (worker.documents) {
        setUploadedDocuments({
          profilePhoto: worker.documents.profilePhoto || null,
          certificate: worker.documents.certificate || null,
          citizenship: worker.documents.citizenship || null,
          license: worker.documents.license || null,
        });
      }
      
      if (worker.verificationStatus) {
        setVerificationStatus({
          profilePhoto: worker.verificationStatus.profilePhoto || 'pending',
          certificate: worker.verificationStatus.certificate || 'pending',
          citizenship: worker.verificationStatus.citizenship || 'pending',
          license: worker.verificationStatus.license || 'pending',
          overall: worker.verificationStatus.overall || 'pending',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency - only run on mount to avoid re-render loops

  // Sync profile image to context when component unmounts (Android-safe)
  useEffect(() => {
    return () => {
      // On unmount, sync the local profileImage to context
      if (profileImage && profileImage !== worker?.profileImage) {
        console.log('🔄 Syncing profile image to context on unmount');
        updateWorker({ profileImage });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileImage]); // Only depend on profileImage

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      
      // CRITICAL Android Fix: ONLY update local state, NEVER touch context during upload
      // Context will sync automatically on component unmount (see useEffect above)
      console.log('📸 Image selected:', imageUri);
      setProfileImage(imageUri);
      setPendingImageUpdate(true);
      
      // Save to backend in background (don't wait for it)
      if (worker) {
        (async () => {
          try {
            const apiUrl = getApiUrl();
            console.log('💾 Saving image to backend...');
            const response = await fetch(`${apiUrl}/api/workers/update-profile-image`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                workerId: worker.id,
                profileImage: imageUri,
              }),
            });

            if (response.ok) {
              console.log('✅ Profile image saved to backend successfully');
              setPendingImageUpdate(false);
            } else {
              console.log('⚠️ Backend save failed');
              setPendingImageUpdate(false);
            }
          } catch (error) {
            console.error('❌ Error saving profile image:', error);
            setPendingImageUpdate(false);
          }
        })();
      }
      
      // NO CONTEXT UPDATE HERE - Will happen on unmount automatically
    }
  };

  const pickDocument = async (documentType: string) => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newDocuments = { ...documents, [documentType]: result.assets[0].uri };
      setDocuments(newDocuments);
      
      // Update worker documents
      if (worker) {
        updateWorker({ 
          documents: newDocuments,
          verificationStatus: { ...verificationStatus, [documentType]: 'pending' }
        });
        Alert.alert('Success', 'Document uploaded successfully! It will be reviewed by our team.');
      }
    }
  };

  const pickSingleDocument = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedDocument(result.assets[0].uri);
    }
  };

  // Picks document for category verification (skill proof or experience)
  // Triggered by: Worker clicks upload button for category document
  const pickCategoryDocument = async (category: string, docType: 'skillProof' | 'experience') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCategoryVerificationDocs(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [docType]: result.assets[0].uri,
        },
      }));
      Alert.alert('Success', 'Document selected! Click Submit to upload.');
    }
  };

  // Submits category verification documents to backend
  // Triggered by: Worker clicks submit button for category verification
  const submitCategoryVerification = async (category: string) => {
    if (!worker?.id) {
      Alert.alert('Error', 'Worker information not available');
      return;
    }

    const categoryDocs = categoryVerificationDocs[category];
    if (!categoryDocs?.skillProof || !categoryDocs?.experience) {
      Alert.alert('Missing Documents', 'Please upload both Skill Proof and Working Experience documents.');
      return;
    }

    setUploadingCategory(category);
    try {
      const apiUrl = getApiUrl();
      const formData = new FormData();
      
      formData.append('workerId', worker.id);
      formData.append('category', category);
      formData.append('skillProof', {
        uri: categoryDocs.skillProof,
        type: 'image/jpeg',
        name: `skillProof-${category}.jpg`,
      } as any);
      formData.append('experience', {
        uri: categoryDocs.experience,
        type: 'image/jpeg',
        name: `experience-${category}.jpg`,
      } as any);

      const response = await fetch(`${apiUrl}/api/workers/upload-category-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setCategoryVerificationStatus(prev => ({
          ...prev,
          [category]: 'pending',
        }));
        Alert.alert(
          'Documents Submitted',
          `Your ${category} verification documents have been submitted. Please wait for verification.`,
          [{ text: 'OK' }]
        );
        // Refresh category data - fetch worker data again to get updated categories
        try {
          const apiUrl = getApiUrl();
          const refreshResponse = await fetch(`${apiUrl}/api/workers/${worker.id}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (refreshResponse.ok) {
            const workerData = await refreshResponse.json();
            const categories = workerData.serviceCategories || [];
            setServiceCategories(categories);
            
            const categoryDocs: { [key: string]: { skillProof: string | null; experience: string | null } } = {};
            const categoryStatus: { [key: string]: 'pending' | 'verified' | 'rejected' } = {};
            
            categories.forEach((cat: string) => {
              categoryDocs[cat] = {
                skillProof: workerData.categoryDocuments?.[cat]?.skillProof || null,
                experience: workerData.categoryDocuments?.[cat]?.experience || null,
              };
              categoryStatus[cat] = workerData.categoryVerificationStatus?.[cat] || 'pending';
            });
            
            setCategoryVerificationDocs(categoryDocs);
            setCategoryVerificationStatus(categoryStatus);
          }
        } catch (err) {
          console.error('Error refreshing category data:', err);
        }
      } else {
        const errorText = await response.text();
        console.error('Upload error:', errorText);
        Alert.alert('Error', 'Failed to upload documents. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting category verification:', error);
      Alert.alert('Error', 'Failed to submit documents. Please check your connection and try again.');
    } finally {
      setUploadingCategory(null);
    }
  };

  const pickDocumentByType = async (documentType: 'profilePhoto' | 'certificate' | 'citizenship' | 'license') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    // Use square aspect for profile photo, 4:3 for others
    const aspect: [number, number] = documentType === 'profilePhoto' ? [1, 1] : [4, 3];

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: aspect,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadedDocuments(prev => ({
        ...prev,
        [documentType]: result.assets[0].uri
      }));
      const documentNames: Record<string, string> = {
        profilePhoto: 'Profile Photo',
        certificate: 'Professional Certificate',
        citizenship: 'Citizenship Document',
        license: 'Driving License',
      };
      Alert.alert('Success', `${documentNames[documentType] || documentType} uploaded successfully!`);
    }
  };

  const handleDoneUploading = () => {
    // Check if at least required documents are uploaded
    if (!uploadedDocuments.profilePhoto || !uploadedDocuments.certificate || !uploadedDocuments.citizenship) {
      Alert.alert('Missing Documents', 'Please upload Profile Photo, Certificate, and Citizenship documents before proceeding.');
      return;
    }

    setShowUploadSection(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return '#4CAF50';
      case 'rejected': return '#F44336';
      case 'pending': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'pending': return 'time';
      default: return 'help-circle';
    }
  };

  const fetchNotifications = async () => {
    if (!worker) return;
    
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/notifications/user/${worker.id}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    if (worker) {
      fetchNotifications();
      
      // Connect to Socket.IO for real-time verification updates
      if (worker.id) {
        socketService.connect(worker.id, 'worker');
        
        // Listen for document verification status updates
        const handleVerificationUpdate = (data: any) => {
          console.log('📢 Document verification update received:', data);
          
          if (data.workerId === worker.id) {
            // Update verification status
            setVerificationStatus((prev) => ({
              ...prev,
              [data.documentType]: data.status,
              overall: data.overallStatus || prev.overall,
            }));
            
            // Show appropriate message
            if (data.status === 'rejected') {
              setVerificationMessage(
                `Your ${data.documentType.replace(/([A-Z])/g, ' $1').toLowerCase()} is not valid. Please resubmit it or submit the original document.`
              );
            } else if (data.status === 'verified' && data.overallStatus === 'verified') {
              setVerificationMessage(
                'Your document is verified. Now you are ready to use your worker service.'
              );
            } else if (data.status === 'verified') {
              setVerificationMessage(
                `Your ${data.documentType.replace(/([A-Z])/g, ' $1').toLowerCase()} has been verified.`
              );
            }
            
            // Refresh notifications
            fetchNotifications();
          }
        };
        
        // Wait a bit for connection to establish
        setTimeout(() => {
          socketService.on('document:verification:updated', handleVerificationUpdate);
          console.log('✅ Socket.IO listener registered for document:verification:updated');
        }, 1000);
        
        return () => {
          socketService.off('document:verification:updated', handleVerificationUpdate);
        };
      }
    }
  }, [worker]);

  const submitVerification = async () => {
    if (!worker) return;

    // Check if required documents are uploaded
    if (!uploadedDocuments.profilePhoto || !uploadedDocuments.certificate || !uploadedDocuments.citizenship) {
      Alert.alert('Missing Documents', 'Please upload Profile Photo, Certificate, and Citizenship documents before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = getApiUrl();
      
      // Create FormData for file upload
      const formData = new FormData();
      
      // Append document files
      if (uploadedDocuments.profilePhoto) {
        formData.append('profilePhoto', {
          uri: uploadedDocuments.profilePhoto,
          type: 'image/jpeg',
          name: 'profilePhoto.jpg',
        } as any);
      }
      
      if (uploadedDocuments.certificate) {
        formData.append('certificate', {
          uri: uploadedDocuments.certificate,
          type: 'image/jpeg',
          name: 'certificate.jpg',
        } as any);
      }
      
      if (uploadedDocuments.citizenship) {
        formData.append('citizenship', {
          uri: uploadedDocuments.citizenship,
          type: 'image/jpeg',
          name: 'citizenship.jpg',
        } as any);
      }
      
      if (uploadedDocuments.license) {
        formData.append('license', {
          uri: uploadedDocuments.license,
          type: 'image/jpeg',
          name: 'license.jpg',
        } as any);
      }
      
      formData.append('workerId', worker.id);

      // Upload documents to backend
      const uploadResponse = await fetch(`${apiUrl}/api/workers/upload-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload error response:', errorText);
        throw new Error('Failed to upload documents');
      }

      // Get the uploaded document paths from the server response
      const uploadResult = await uploadResponse.json();
      console.log('📤 Upload response:', uploadResult);
      
      // Use server paths if available, otherwise use local URIs as fallback
      const apiUrlForDocs = apiUrl;
      const newDocuments = {
        profilePhoto: uploadResult.documents?.profilePhoto 
          ? `${apiUrlForDocs}/uploads/${uploadResult.documents.profilePhoto}`
          : uploadedDocuments.profilePhoto,
        certificate: uploadResult.documents?.certificate
          ? `${apiUrlForDocs}/uploads/${uploadResult.documents.certificate}`
          : uploadedDocuments.certificate,
        citizenship: uploadResult.documents?.citizenship
          ? `${apiUrlForDocs}/uploads/${uploadResult.documents.citizenship}`
          : uploadedDocuments.citizenship,
        license: uploadResult.documents?.license
          ? `${apiUrlForDocs}/uploads/${uploadResult.documents.license}`
          : (uploadedDocuments.license || null),
      };
      
      console.log('📄 Documents to submit:', newDocuments);

      const updateResponse = await fetch(`${apiUrl}/api/admin/submit-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId: worker.id,
          documents: newDocuments,
          verificationStatus: {
            profilePhoto: 'pending',
            certificate: 'pending',
            citizenship: 'pending',
            license: uploadedDocuments.license ? 'pending' : undefined,
            overall: 'pending',
          }
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to submit verification');
      }

      const updatedVerificationStatus = {
        profilePhoto: 'pending',
        certificate: 'pending',
        citizenship: 'pending',
        license: uploadedDocuments.license ? 'pending' : undefined,
        overall: 'pending',
      };

      updateWorker({
        documents: newDocuments,
        verificationStatus: updatedVerificationStatus,
        verificationSubmitted: true,
        submittedAt: new Date().toISOString(),
      });
      setHasSubmitted(true);
      setVerificationStatus(updatedVerificationStatus);
      setVerificationMessage(null);

      // Send notification to admin dashboard
      await fetch(`${apiUrl}/api/admin/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'document_verification',
          workerId: worker.id,
          workerName: worker.name,
          message: `${worker.name} has submitted documents for verification`,
          priority: 'high',
          data: {
            documents: newDocuments,
            submittedAt: new Date().toISOString(),
          }
        }),
      });

      // Send success notification to worker
      await fetch(`${apiUrl}/api/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: worker.id,
          type: 'verification_submitted',
          title: 'Documents Submitted Successfully',
          message: 'Your documents have been submitted for verification. You will be notified once the review is complete.',
          data: {
            submittedAt: new Date().toISOString(),
            status: 'pending'
          }
        }),
      });

      // Refresh notifications after submission
      await fetchNotifications();

      Alert.alert(
        'Documents Submitted Successfully!',
        'Your document has been submitted for verification. Please wait for document verification.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Clear the selected document and go back to profile
              setSelectedDocument(null);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting verification:', error);
      Alert.alert('Error', 'Failed to submit verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.email || !formData.phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    updateWorker({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      skills: formData.skills.split(',').map(s => s.trim()).filter(s => s),
    });
    setIsEditing(false);
    Alert.alert('Success', 'Profile updated successfully!');
  };

  const handleCancel = () => {
    setFormData({
      name: worker?.name || '',
      email: worker?.email || '',
      phone: worker?.phone || '',
      skills: worker?.skills?.join(', ') || '',
    });
    setIsEditing(false);
  };

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
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Profile Image Section */}
          <View style={styles.imageSection}>
            <View style={styles.imageContainer}>
              {profileImage || (worker as any)?.profileImage ? (
                <Image
                  key={profileImage || (worker as any)?.profileImage} // Force re-render when image changes
                  source={{ uri: profileImage || (worker as any)?.profileImage }}
                  style={styles.profileImage}
                  onError={(e) => {
                    console.log('Error loading profile image');
                    setProfileImage(null);
                  }}
                />
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name="person" size={70} color="#FF7A2C" />
                </View>
              )}
              <TouchableOpacity style={styles.cameraButton} onPress={pickImage}>
                <Ionicons name="camera" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.imageName}>{worker?.name || 'Worker'}</Text>
            <Text style={styles.imageEmail}>{worker?.email || ''}</Text>
          </View>

          {/* Profile Details */}
          <View style={styles.detailsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              {!isEditing && (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
                  <Ionicons name="create-outline" size={20} color="#FF7A2C" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Name Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              {isEditing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Enter your name"
                />
              ) : (
                <Text style={styles.fieldValue}>{formData.name}</Text>
              )}
            </View>

            {/* Email Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Email</Text>
              {isEditing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={styles.fieldValue}>{formData.email}</Text>
              )}
            </View>

            {/* Phone Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              {isEditing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Enter your phone"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.fieldValue}>{formData.phone}</Text>
              )}
            </View>

            {/* Skills Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Skills</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.fieldInput, styles.textArea]}
                  value={formData.skills}
                  onChangeText={(text) => setFormData({ ...formData, skills: text })}
                  placeholder="Enter skills (comma separated)"
                  multiline
                  numberOfLines={3}
                />
              ) : (
                <View style={styles.skillsContainer}>
                  {formData.skills.split(',').map((skill, index) => (
                    <View key={index} style={styles.skillTag}>
                      <Text style={styles.skillText}>{skill.trim()}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Edit Buttons */}
            {isEditing && (
              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Document Verification Section */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Document Verification</Text>
            
            {!showUploadSection ? (
              <>
                {/* Upload Button */}
                <TouchableOpacity 
                  style={styles.simpleUploadButton} 
                  onPress={() => setShowUploadSection(true)}
                >
                  <Ionicons 
                    name={uploadedDocuments.profilePhoto || uploadedDocuments.certificate || uploadedDocuments.citizenship || uploadedDocuments.license ? "eye" : "cloud-upload"} 
                    size={24} 
                    color="#FF7A2C" 
                  />
                  <Text style={styles.simpleUploadText}>
                    {uploadedDocuments.profilePhoto || uploadedDocuments.certificate || uploadedDocuments.citizenship || uploadedDocuments.license ? 'View/Edit Documents' : 'Upload Documents'}
                  </Text>
                </TouchableOpacity>
                
                {/* Document Preview */}
                {(uploadedDocuments.profilePhoto || uploadedDocuments.certificate || uploadedDocuments.citizenship || uploadedDocuments.license) && (
                  <View style={styles.documentsSummary}>
                    {uploadedDocuments.profilePhoto && (
                      <View style={styles.documentSummaryItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                        <Text style={styles.documentSummaryText}>Profile Photo</Text>
                        {verificationStatus.profilePhoto === 'rejected' && (
                          <Ionicons name="close-circle" size={16} color="#F44336" />
                        )}
                      </View>
                    )}
                    {uploadedDocuments.certificate && (
                      <View style={styles.documentSummaryItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                        <Text style={styles.documentSummaryText}>Professional Certificate</Text>
                        {verificationStatus.certificate === 'rejected' && (
                          <Ionicons name="close-circle" size={16} color="#F44336" />
                        )}
                      </View>
                    )}
                    {uploadedDocuments.citizenship && (
                      <View style={styles.documentSummaryItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                        <Text style={styles.documentSummaryText}>Citizenship Document</Text>
                        {verificationStatus.citizenship === 'rejected' && (
                          <Ionicons name="close-circle" size={16} color="#F44336" />
                        )}
                      </View>
                    )}
                    {uploadedDocuments.license && (
                      <View style={styles.documentSummaryItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                        <Text style={styles.documentSummaryText}>Driving License</Text>
                        {verificationStatus.license === 'rejected' && (
                          <Ionicons name="close-circle" size={16} color="#F44336" />
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Verification Status Message */}
                {verificationMessage && (
                  <View style={[
                    styles.verificationMessageContainer,
                    verificationStatus.overall === 'verified' ? styles.verificationMessageSuccess : styles.verificationMessageError
                  ]}>
                    <Ionicons 
                      name={verificationStatus.overall === 'verified' ? 'checkmark-circle' : 'alert-circle'} 
                      size={20} 
                      color={verificationStatus.overall === 'verified' ? '#4CAF50' : '#F44336'} 
                    />
                    <Text style={[
                      styles.verificationMessageText,
                      verificationStatus.overall === 'verified' ? styles.verificationMessageTextSuccess : styles.verificationMessageTextError
                    ]}>
                      {verificationMessage}
                    </Text>
                  </View>
                )}

                {/* Submit Button */}
                {!hasSubmitted ? (
                  <TouchableOpacity 
                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
                    onPress={submitVerification}
                    disabled={isSubmitting || !uploadedDocuments.profilePhoto || !uploadedDocuments.certificate || !uploadedDocuments.citizenship}
                  >
                    <Ionicons 
                      name={isSubmitting ? "hourglass" : "checkmark-circle"} 
                      size={20} 
                      color="#fff" 
                    />
                    <Text style={styles.submitButtonText}>
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.submittedContainer}>
                    <View style={styles.submittedStatus}>
                      <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                      <Text style={styles.submittedText}>Submitted</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.resubmitButton}
                      onPress={() => {
                        setHasSubmitted(false);
                        setShowUploadSection(true);
                      }}
                    >
                      <Text style={styles.resubmitButtonText}>Resubmit</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.uploadSection}>
                <Text style={styles.uploadSectionTitle}>Upload Required Documents</Text>
                <Text style={styles.uploadSectionSubtitle}>Please upload the following documents for verification</Text>

                {/* Profile Photo Upload */}
                <TouchableOpacity 
                  style={[styles.documentUploadButton, uploadedDocuments.profilePhoto && styles.documentUploadButtonSuccess]} 
                  onPress={() => pickDocumentByType('profilePhoto')}
                >
                  <View style={styles.documentUploadIconContainer}>
                    {uploadedDocuments.profilePhoto ? (
                      <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                    ) : (
                      <Ionicons name="camera-outline" size={28} color="#FF7A2C" />
                    )}
                  </View>
                  <View style={styles.documentUploadTextContainer}>
                    <Text style={styles.documentUploadTitle}>Profile Photo *</Text>
                    <Text style={styles.documentUploadSubtitle}>
                      {uploadedDocuments.profilePhoto ? 'Uploaded successfully' : 'Upload a clear photo showing your face'}
                    </Text>
                    {verificationStatus.profilePhoto === 'rejected' && (
                      <Text style={styles.documentRejectedText}>This document is not valid. Please resubmit.</Text>
                    )}
                  </View>
                  {uploadedDocuments.profilePhoto && (
                    <Image source={{ uri: uploadedDocuments.profilePhoto }} style={styles.documentThumbnail} />
                  )}
                </TouchableOpacity>

                {/* Certificate Upload */}
                <TouchableOpacity 
                  style={[styles.documentUploadButton, uploadedDocuments.certificate && styles.documentUploadButtonSuccess]} 
                  onPress={() => pickDocumentByType('certificate')}
                >
                  <View style={styles.documentUploadIconContainer}>
                    {uploadedDocuments.certificate ? (
                      <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                    ) : (
                      <Ionicons name="school-outline" size={28} color="#FF7A2C" />
                    )}
                  </View>
                  <View style={styles.documentUploadTextContainer}>
                    <Text style={styles.documentUploadTitle}>Professional Certificate *</Text>
                    <Text style={styles.documentUploadSubtitle}>
                      {uploadedDocuments.certificate ? 'Uploaded successfully' : 'Upload your professional certification'}
                    </Text>
                    {verificationStatus.certificate === 'rejected' && (
                      <Text style={styles.documentRejectedText}>This document is not valid. Please resubmit.</Text>
                    )}
                  </View>
                  {uploadedDocuments.certificate && (
                    <Image source={{ uri: uploadedDocuments.certificate }} style={styles.documentThumbnail} />
                  )}
                </TouchableOpacity>

                {/* Citizenship Upload */}
                <TouchableOpacity 
                  style={[styles.documentUploadButton, uploadedDocuments.citizenship && styles.documentUploadButtonSuccess]} 
                  onPress={() => pickDocumentByType('citizenship')}
                >
                  <View style={styles.documentUploadIconContainer}>
                    {uploadedDocuments.citizenship ? (
                      <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                    ) : (
                      <Ionicons name="card-outline" size={28} color="#FF7A2C" />
                    )}
                  </View>
                  <View style={styles.documentUploadTextContainer}>
                    <Text style={styles.documentUploadTitle}>Citizenship Document *</Text>
                    <Text style={styles.documentUploadSubtitle}>
                      {uploadedDocuments.citizenship ? 'Uploaded successfully' : 'Upload your citizenship or national ID'}
                    </Text>
                    {verificationStatus.citizenship === 'rejected' && (
                      <Text style={styles.documentRejectedText}>This document is not valid. Please resubmit.</Text>
                    )}
                  </View>
                  {uploadedDocuments.citizenship && (
                    <Image source={{ uri: uploadedDocuments.citizenship }} style={styles.documentThumbnail} />
                  )}
                </TouchableOpacity>

                {/* License Upload (Optional) */}
                {worker?.skills?.some(skill => 
                  skill.toLowerCase().includes('driver') || 
                  skill.toLowerCase().includes('delivery')
                ) && (
                  <TouchableOpacity 
                    style={[styles.documentUploadButton, uploadedDocuments.license && styles.documentUploadButtonSuccess]} 
                    onPress={() => pickDocumentByType('license')}
                  >
                    <View style={styles.documentUploadIconContainer}>
                      {uploadedDocuments.license ? (
                        <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                      ) : (
                        <Ionicons name="car-outline" size={28} color="#FF7A2C" />
                      )}
                    </View>
                    <View style={styles.documentUploadTextContainer}>
                      <Text style={styles.documentUploadTitle}>Driving License</Text>
                      <Text style={styles.documentUploadSubtitle}>
                        {uploadedDocuments.license ? 'Uploaded successfully' : 'Upload your valid driving license (Optional)'}
                      </Text>
                      {verificationStatus.license === 'rejected' && (
                        <Text style={styles.documentRejectedText}>This document is not valid. Please resubmit.</Text>
                      )}
                    </View>
                    {uploadedDocuments.license && (
                      <Image source={{ uri: uploadedDocuments.license }} style={styles.documentThumbnail} />
                    )}
                  </TouchableOpacity>
                )}

                {/* Done Button */}
                <TouchableOpacity 
                  style={styles.doneButton}
                  onPress={handleDoneUploading}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Verification Notifications */}
          {hasSubmitted && (
            <View style={styles.detailsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Verification Updates</Text>
                <View style={styles.notificationHeaderActions}>
                  <TouchableOpacity 
                    style={styles.refreshButton}
                    onPress={fetchNotifications}
                  >
                    <Ionicons name="refresh" size={20} color="#FF7A2C" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.notificationToggle}
                    onPress={() => setShowNotifications(!showNotifications)}
                  >
                    <Ionicons 
                      name={showNotifications ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#FF7A2C" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {showNotifications && (
                <View style={styles.notificationsContainer}>
                  {notifications.length === 0 ? (
                    <Text style={styles.noNotificationsText}>
                      No verification updates yet
                    </Text>
                  ) : (
                    notifications
                      .filter(notification => 
                        notification.type === 'verification_submitted' || 
                        notification.type === 'document_verification' || 
                        notification.type === 'verification_complete'
                      )
                      .map((notification, index) => (
                        <View key={index} style={styles.notificationItem}>
                          <View style={styles.notificationHeader}>
                            <Ionicons 
                              name={
                                notification.type === 'verification_complete' ? 'checkmark-circle' :
                                notification.data?.status === 'verified' ? 'checkmark-circle' :
                                notification.data?.status === 'rejected' ? 'close-circle' :
                                'time'
                              } 
                              size={20} 
                              color={
                                notification.type === 'verification_complete' ? '#4CAF50' :
                                notification.data?.status === 'verified' ? '#4CAF50' :
                                notification.data?.status === 'rejected' ? '#F44336' :
                                '#FF9800'
                              } 
                            />
                            <Text style={styles.notificationTitle}>
                              {notification.title}
                            </Text>
                            <Text style={styles.notificationTime}>
                              {new Date(notification.createdAt).toLocaleDateString()}
                            </Text>
                          </View>
                          <Text style={styles.notificationMessage}>
                            {notification.message}
                          </Text>
                        </View>
                      ))
                  )}
                </View>
              )}
            </View>
          )}

          {/* Service Category Verification Section */}
          {serviceCategories.length > 0 && (
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Service Category Verification</Text>
              <Text style={styles.sectionSubtitle}>
                Verify each service category by uploading required documents
              </Text>
              
              {serviceCategories.map((category) => {
                const status = categoryVerificationStatus[category] || 'pending';
                const docs = categoryVerificationDocs[category] || { skillProof: null, experience: null };
                const isExpanded = expandedCategory === category;
                const isUploading = uploadingCategory === category;
                
                return (
                  <View key={category} style={styles.categoryVerificationCard}>
                    <TouchableOpacity
                      style={styles.categoryVerificationHeader}
                      onPress={() => setExpandedCategory(isExpanded ? null : category)}
                    >
                      <View style={styles.categoryVerificationHeaderLeft}>
                        <Ionicons 
                          name={status === 'verified' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'time-outline'} 
                          size={24} 
                          color={
                            status === 'verified' ? '#4CAF50' : 
                            status === 'rejected' ? '#F44336' : 
                            '#FF9800'
                          } 
                        />
                        <Text style={styles.categoryVerificationTitle}>{category}</Text>
                      </View>
                      <View style={styles.categoryVerificationHeaderRight}>
                        <Text style={[
                          styles.categoryVerificationStatus,
                          status === 'verified' && styles.categoryVerificationStatusVerified,
                          status === 'rejected' && styles.categoryVerificationStatusRejected,
                        ]}>
                          {status === 'verified' ? 'Verified' : status === 'rejected' ? 'Rejected' : 'Pending'}
                        </Text>
                        <Ionicons 
                          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                          size={20} 
                          color="#666" 
                        />
                      </View>
                    </TouchableOpacity>
                    
                    {isExpanded && (
                      <View style={styles.categoryVerificationContent}>
                        {/* Skill Proof Document */}
                        <View style={styles.categoryDocumentSection}>
                          <Text style={styles.categoryDocumentLabel}>Skill Proof Document *</Text>
                          <TouchableOpacity
                            style={[
                              styles.categoryDocumentButton,
                              docs.skillProof && styles.categoryDocumentButtonSuccess
                            ]}
                            onPress={() => pickCategoryDocument(category, 'skillProof')}
                            disabled={isUploading}
                          >
                            <Ionicons
                              name={docs.skillProof ? 'checkmark-circle' : 'document-outline'}
                              size={24}
                              color={docs.skillProof ? '#4CAF50' : '#FF7A2C'}
                            />
                            <Text style={styles.categoryDocumentButtonText}>
                              {docs.skillProof ? 'Document Selected' : 'Upload Skill Proof'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* Working Experience Document */}
                        <View style={styles.categoryDocumentSection}>
                          <Text style={styles.categoryDocumentLabel}>Working Experience Document *</Text>
                          <TouchableOpacity
                            style={[
                              styles.categoryDocumentButton,
                              docs.experience && styles.categoryDocumentButtonSuccess
                            ]}
                            onPress={() => pickCategoryDocument(category, 'experience')}
                            disabled={isUploading}
                          >
                            <Ionicons
                              name={docs.experience ? 'checkmark-circle' : 'document-outline'}
                              size={24}
                              color={docs.experience ? '#4CAF50' : '#FF7A2C'}
                            />
                            <Text style={styles.categoryDocumentButtonText}>
                              {docs.experience ? 'Document Selected' : 'Upload Experience'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* Submit Button */}
                        {docs.skillProof && docs.experience && status !== 'verified' && (
                          <TouchableOpacity
                            style={[styles.categorySubmitButton, isUploading && styles.categorySubmitButtonDisabled]}
                            onPress={() => submitCategoryVerification(category)}
                            disabled={isUploading}
                          >
                            <Ionicons
                              name={isUploading ? 'hourglass' : 'checkmark-circle'}
                              size={20}
                              color="#fff"
                            />
                            <Text style={styles.categorySubmitButtonText}>
                              {isUploading ? 'Submitting...' : 'Submit for Verification'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        
                        {/* Status Message */}
                        {status === 'pending' && docs.skillProof && docs.experience && (
                          <Text style={styles.categoryStatusMessage}>
                            ⏳ Waiting for verification. You will be notified once reviewed.
                          </Text>
                        )}
                        {status === 'verified' && (
                          <Text style={[styles.categoryStatusMessage, styles.categoryStatusMessageSuccess]}>
                            ✅ This service category is verified and ready to use.
                          </Text>
                        )}
                        {status === 'rejected' && (
                          <Text style={[styles.categoryStatusMessage, styles.categoryStatusMessageError]}>
                            ❌ Verification rejected. Please resubmit documents.
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Account Section */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <TouchableOpacity 
              style={styles.accountOption}
              onPress={() => {
                console.log('Change Password clicked');
                if (worker) {
                  setShowPasswordModal(true);
                } else {
                  Alert.alert('Error', 'Worker information not available');
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="lock-closed-outline" size={20} color="#666" />
              <Text style={styles.accountOptionText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.accountOption}
              onPress={() => {
                console.log('Notification Settings clicked');
                setShowNotificationModal(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={20} color="#666" />
              <Text style={styles.accountOptionText}>Notification Settings</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.accountOption}
              onPress={() => {
                console.log('Help & Support clicked');
                setShowHelpModal(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="help-circle-outline" size={20} color="#666" />
              <Text style={styles.accountOptionText}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.accountOption, styles.dangerOption]} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={[styles.accountOptionText, styles.dangerText]}>Logout</Text>
              <Ionicons name="chevron-forward" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        {/* Bottom Navigation */}
        <BottomNav />
      </SafeAreaView>
      <PasswordChangeModal
        visible={showPasswordModal && !!worker}
        onClose={() => {
          console.log('Closing password modal');
          setShowPasswordModal(false);
        }}
        workerId={worker?.id || ''}
        workerEmail={worker?.email || ''}
      />
      <NotificationSettingsModal
        visible={showNotificationModal}
        onClose={() => {
          console.log('Closing notification modal');
          setShowNotificationModal(false);
        }}
      />
      <HelpSupportModal
        visible={showHelpModal}
        onClose={() => {
          console.log('Closing help modal');
          setShowHelpModal(false);
        }}
      />
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
  logoutButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    marginBottom: 80,
  },
  imageSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#FF7A2C',
  },
  placeholderImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFE5CC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FF7A2C',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#FF7A2C',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  imageName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  imageEmail: {
    fontSize: 14,
    color: '#666',
  },
  detailsSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    color: '#FF7A2C',
    fontSize: 14,
    fontWeight: '600',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
  },
  fieldInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillTag: {
    backgroundColor: '#FFE5CC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillText: {
    color: '#FF7A2C',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#FF7A2C',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
    minHeight: 50,
  },
  accountOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  dangerOption: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#EF4444',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  overallStatusContainer: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  overallStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  overallStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  documentList: {
    gap: 16,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  documentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  documentDetails: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  documentSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  documentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  uploadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FF7A2C',
  },
  verificationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  verificationInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#1976D2',
    lineHeight: 16,
  },
  submitButton: {
    backgroundColor: '#FF7A2C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submittedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5E8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  submittedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  submittedText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  resubmitButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  resubmitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 8,
  },
  notificationToggle: {
    padding: 8,
  },
  notificationsContainer: {
    marginTop: 16,
    gap: 12,
  },
  notificationItem: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF7A2C',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noNotificationsText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  // New styles for simplified document upload
  singleDocumentContainer: {
    marginTop: 20,
  },
  documentUploadArea: {
    marginBottom: 20,
  },
  singleUploadButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF7A2C',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF7A2C',
    marginTop: 8,
  },
  uploadSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  documentPreview: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  documentTypesInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  documentTypesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  documentTypesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  documentTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  documentTypeText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  // Simplified upload button styles
  simpleUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF7A2C',
    marginTop: 12,
  },
  simpleUploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF7A2C',
    marginLeft: 8,
  },
  simpleDocumentPreview: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  simplePreviewImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  // New upload section styles
  uploadSection: {
    marginTop: 16,
  },
  uploadSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  uploadSectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  documentUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    marginBottom: 12,
    gap: 12,
  },
  documentUploadButtonSuccess: {
    borderColor: '#4CAF50',
    borderStyle: 'solid',
    backgroundColor: '#F1F8F4',
  },
  documentUploadIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentUploadTextContainer: {
    flex: 1,
  },
  documentUploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  documentUploadSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  documentThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  doneButton: {
    backgroundColor: '#FF7A2C',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  documentsSummary: {
    marginTop: 12,
    gap: 8,
  },
  documentSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  documentSummaryText: {
    fontSize: 14,
    color: '#666',
  },
  verificationMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
  },
  verificationMessageSuccess: {
    backgroundColor: '#E8F5E8',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  verificationMessageError: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  verificationMessageText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  verificationMessageTextSuccess: {
    color: '#2E7D32',
  },
  verificationMessageTextError: {
    color: '#C62828',
  },
  documentRejectedText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Category Verification Styles
  categoryVerificationCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  categoryVerificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  categoryVerificationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  categoryVerificationHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryVerificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  categoryVerificationStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFF3E0',
  },
  categoryVerificationStatusVerified: {
    color: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  categoryVerificationStatusRejected: {
    color: '#F44336',
    backgroundColor: '#FFEBEE',
  },
  categoryVerificationContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  categoryDocumentSection: {
    marginBottom: 16,
  },
  categoryDocumentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  categoryDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF7A2C',
    borderStyle: 'dashed',
  },
  categoryDocumentButtonSuccess: {
    borderColor: '#4CAF50',
    borderStyle: 'solid',
    backgroundColor: '#F1F8F4',
  },
  categoryDocumentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  categorySubmitButton: {
    backgroundColor: '#FF7A2C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  categorySubmitButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  categorySubmitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryStatusMessage: {
    fontSize: 13,
    color: '#666',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    lineHeight: 18,
  },
  categoryStatusMessageSuccess: {
    color: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  categoryStatusMessageError: {
    color: '#F44336',
    backgroundColor: '#FFEBEE',
  },
});

