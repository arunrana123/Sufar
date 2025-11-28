import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentUser, setCurrentUser } from '@/lib/session';

interface ProfileLogoProps {
  size?: number;
  onPress?: () => void;
  showEditIcon?: boolean;
  onPhotoUpdate?: (uri: string) => void;
}

export default function ProfileLogo({ 
  size = 50, 
  onPress, 
  showEditIcon = false,
  onPhotoUpdate 
}: ProfileLogoProps) {
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const user = getCurrentUser();

  useEffect(() => {
    // Load profile photo from user data
    if (user?.profilePhoto) {
      setProfilePhoto(user.profilePhoto);
    }
  }, [user?.profilePhoto]);

  const handlePhotoUpdate = async (uri: string) => {
    try {
      setLoading(true);
      
      // Update local state immediately for better UX
      setProfilePhoto(uri);
      
      // Update user session
      if (user?.id) {
        setCurrentUser({ ...user, profilePhoto: uri });
      }
      
      // Notify parent component
      if (onPhotoUpdate) {
        onPhotoUpdate(uri);
      }
      
      // TODO: Upload to backend if needed
      // await uploadProfilePhoto(uri);
      
    } catch (error) {
      console.error('Error updating profile photo:', error);
      Alert.alert('Error', 'Failed to update profile photo');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        await handlePhotoUpdate(uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        await handlePhotoUpdate(uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Update Profile Photo',
      'Choose an option',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Gallery', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (showEditIcon) {
      showImageOptions();
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.container, { width: size, height: size }]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[styles.avatarContainer, { width: size, height: size }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3B82F6" />
          </View>
        ) : profilePhoto ? (
          <Image 
            source={{ uri: profilePhoto }} 
            style={[styles.avatar, { width: size, height: size }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.defaultAvatar, { width: size, height: size }]}>
            <Ionicons 
              name="person" 
              size={size * 0.5} 
              color="#fff" 
            />
          </View>
        )}
        
        {showEditIcon && (
          <View style={styles.editIcon}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatarContainer: {
    position: 'relative',
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    borderRadius: 25,
  },
  defaultAvatar: {
    backgroundColor: '#3B82F6',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
