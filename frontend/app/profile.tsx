// PROFILE SCREEN - User profile management with photo upload, account settings, and logout
// Features: Edit profile info, upload/change profile photo (expo-image-picker), update account via API
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  TextInput,
  Alert,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import BottomNav from '@/components/BottomNav';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, updateUser, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(user?.profilePhoto || null);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    email: user?.email || '',
  });
  const [rewardPoints, setRewardPoints] = useState<number>((user as any)?.rewardPoints || 0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Sync formData when user data changes
  useEffect(() => {
    if (user && !isEditing) {
      setFormData({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        username: user?.username || '',
        email: user?.email || '',
      });
      setProfileImage(user?.profilePhoto || null);
    }
  }, [user, isEditing]);

  // Fetch and update reward points
  useEffect(() => {
    const fetchRewardPoints = async () => {
      if (!user?.id) return;
      
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/users/${user.id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          const userData = await response.json();
          const points = userData.rewardPoints || 0;
          setRewardPoints(points);
          
          // Update user context
          if (userData.rewardPoints !== undefined) {
            updateUser({ ...user, rewardPoints: points } as any);
          }
        }
      } catch (error) {
        console.error('Error fetching reward points:', error);
      }
    };

    fetchRewardPoints();
    
    // Connect to socket for real-time updates
    if (user?.id) {
      socketService.connect(user.id, 'user');
      
      // Listen for reward points updates
      const handleRewardPointsUpdate = (data: any) => {
        if (data.userId === user.id) {
          console.log('🎁 Reward points updated:', data);
          setRewardPoints(data.totalPoints);
          updateUser({ ...user, rewardPoints: data.totalPoints } as any);
        }
      };
      
      socketService.on('reward:points_updated', handleRewardPointsUpdate);
      
      // Refresh every 10 seconds for live updates
      const intervalId = setInterval(fetchRewardPoints, 10000);
      
      return () => {
        clearInterval(intervalId);
        socketService.off('reward:points_updated', handleRewardPointsUpdate);
      };
    }
  }, [user?.id]);

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
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0] && user?.id) {
      const imageUri = result.assets[0].uri;
      setProfileImage(imageUri);
      setIsUploadingPhoto(true);

      try {
        const apiUrl = getApiUrl();
        const formData = new FormData();

        // Normalize URI for different platforms
        const normalizeUri = (uri: string) => {
          if (Platform.OS === 'android') {
            if (uri.startsWith('content://') || uri.startsWith('file://') || uri.startsWith('http')) {
              return uri;
            }
            return `file://${uri}`;
          } else if (Platform.OS === 'ios') {
            if (uri.startsWith('file://') || uri.startsWith('ph://') || uri.startsWith('assets-library://')) {
              return uri;
            }
            return `file://${uri}`;
          }
          return uri;
        };

        // Prepare file object for FormData
        const imageFile = {
          uri: normalizeUri(imageUri),
          type: 'image/jpeg',
          name: `profile-photo-${user.id}-${Date.now()}.jpg`,
        } as any;

        formData.append('profilePhoto', imageFile);
        // Ensure userId is a string
        const userIdString = String(user.id);
        formData.append('userId', userIdString);
        
        console.log('FormData prepared:', {
          userId: userIdString,
          userIdType: typeof userIdString,
          hasFile: !!imageFile,
        });

        console.log('Uploading profile photo:', {
          userId: user.id,
          uri: imageFile.uri.substring(0, 60) + '...',
          type: imageFile.type,
          name: imageFile.name,
        });

        const response = await fetch(`${apiUrl}/api/users/profile-photo`, {
          method: 'PATCH',
          // Don't set Content-Type header - let fetch set it automatically with boundary for FormData
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Profile photo saved to backend:', data);
          
          // Update local state with the URL returned from backend
          const photoUrl = data.profilePhoto || data.profileImageUrl;
          if (photoUrl) {
            const updatedUser = { ...user, profilePhoto: photoUrl };
            updateUser(updatedUser);
            setProfileImage(photoUrl);
            Alert.alert('Success', 'Profile picture updated successfully!');
          } else {
            // Fallback to local URI if backend doesn't return URL
            const updatedUser = { ...user, profilePhoto: imageUri };
            updateUser(updatedUser);
            Alert.alert('Success', 'Profile picture updated successfully!');
          }
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Failed to save profile picture' }));
          console.error('Failed to save profile photo:', errorData);
          Alert.alert('Error', errorData.message || 'Failed to save profile picture to server');
          // Revert to previous image on error
          setProfileImage(user?.profilePhoto || null);
        }
      } catch (error: any) {
        console.error('Error saving profile photo:', error);
        Alert.alert('Error', error.message || 'Failed to save profile picture');
        // Revert to previous image on error
        setProfileImage(user?.profilePhoto || null);
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setIsSaving(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const updatedUserData = await response.json();
      
      // Update user context with the response from backend
      const updatedUser = {
        ...user,
        firstName: updatedUserData.firstName,
        lastName: updatedUserData.lastName,
        email: updatedUserData.email,
        phone: updatedUserData.phone,
        profilePhoto: updatedUserData.profilePhoto,
      };

      updateUser(updatedUser);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      username: user?.username || '',
      email: user?.email || '',
    });
    setIsEditing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout from your account?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              Alert.alert('Logged Out', 'You have been logged out successfully.');
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>Profile</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Profile Image Section */}
          <View style={styles.imageSection}>
            <View style={styles.imageContainer}>
              {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={[styles.profileImage, { borderColor: theme.tint }]}
                />
              ) : (
                <View style={[styles.placeholderImage, { backgroundColor: theme.tint + '20', borderColor: theme.tint }]}>
                  <Ionicons name="person" size={70} color={theme.tint} />
                </View>
              )}
              <TouchableOpacity 
                style={[styles.cameraButton, { backgroundColor: theme.tint }]} 
                onPress={pickImage}
                disabled={isUploadingPhoto}
              >
                {isUploadingPhoto ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.imageName, { color: theme.text }]}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={[styles.imageEmail, { color: theme.secondary }]}>{user?.email || ''}</Text>
            
            {/* Reward Points Display */}
            <View style={[styles.rewardPointsContainer, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}>
              <Ionicons name="star" size={20} color={theme.primary} />
              <Text style={[styles.rewardPointsLabel, { color: theme.text }]}>Reward Points:</Text>
              <Text style={[styles.rewardPointsValue, { color: theme.primary }]}>
                {rewardPoints.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Profile Details */}
          <View style={[styles.detailsSection, { backgroundColor: theme.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Information</Text>
              {!isEditing && (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={[styles.editButton, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name="create-outline" size={20} color={theme.primary} />
                  <Text style={[styles.editButtonText, { color: theme.primary }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* First Name Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>First Name</Text>
              {isEditing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={formData.firstName}
                  onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                  placeholder="Enter first name"
                />
              ) : (
                <Text style={styles.fieldValue}>{formData.firstName}</Text>
              )}
            </View>

            {/* Last Name Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Last Name</Text>
              {isEditing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={formData.lastName}
                  onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                  placeholder="Enter last name"
                />
              ) : (
                <Text style={styles.fieldValue}>{formData.lastName}</Text>
              )}
            </View>

            {/* Username Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Username</Text>
              {isEditing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={formData.username}
                  onChangeText={(text) => setFormData({ ...formData, username: text })}
                  placeholder="Enter username"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={styles.fieldValue}>{formData.username}</Text>
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
                  placeholder="Enter email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={styles.fieldValue}>{formData.email}</Text>
              )}
            </View>

            {/* Edit Buttons */}
            {isEditing && (
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={handleCancel}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <Text style={styles.saveButtonText}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Logout Section */}
          <View style={[styles.detailsSection, { backgroundColor: theme.card }]}>
            <TouchableOpacity style={[styles.accountOption, styles.dangerOption]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={theme.danger} />
              <Text style={[styles.accountOptionText, { color: theme.danger }]}>Logout</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.danger} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
      <BottomNav />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  imageSection: {
    alignItems: 'center',
    paddingVertical: 30,
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
  },
  placeholderImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
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
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
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
  rewardPointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    marginTop: 12,
  },
  rewardPointsLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  rewardPointsValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

