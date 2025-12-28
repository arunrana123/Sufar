// PROFILE SCREEN - User profile management with photo upload, account settings, and logout
// Features: Edit profile info, upload/change profile photo (expo-image-picker), update account via API
import React, { useState } from 'react';
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
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import BottomNav from '@/components/BottomNav';
import { getApiUrl } from '@/lib/config';

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
      setProfileImage(result.assets[0].uri);
      // Update user profile image
      if (user) {
        try {
          // Save to backend
          const apiUrl = getApiUrl();
          const response = await fetch(`${apiUrl}/api/users/profile-photo`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              profilePhoto: result.assets[0].uri,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log('Profile photo saved to backend:', data);
            
            // Update local state
            const updatedUser = { ...user, profilePhoto: result.assets[0].uri };
            updateUser(updatedUser);
            Alert.alert('Success', 'Profile picture updated successfully!');
          } else {
            const errorData = await response.json();
            console.error('Failed to save profile photo:', errorData);
            Alert.alert('Error', 'Failed to save profile picture to server');
          }
        } catch (error) {
          console.error('Error saving profile photo:', error);
          Alert.alert('Error', 'Failed to save profile picture');
        }
      }
    }
  };

  const handleSave = () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (user) {
      const updatedUser = {
        ...user,
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username,
        email: formData.email,
      };

      updateUser(updatedUser);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
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
          <Pressable onPress={() => router.push('/menu')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </Pressable>
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
              <TouchableOpacity style={[styles.cameraButton, { backgroundColor: theme.tint }]} onPress={pickImage}>
                <Ionicons name="camera" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.imageName, { color: theme.text }]}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={[styles.imageEmail, { color: theme.secondary }]}>{user?.email || ''}</Text>
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
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Save Changes</Text>
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
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
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
});

