import React from 'react';
import { Modal, View, StyleSheet, Pressable, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

type Props = {
  visible: boolean;
  onClose: () => void;
  photoUri?: string | null;
  onPhotoUpdate?: (uri: string | null) => void;
  onEditProfile?: () => void;
  name?: string | null;
  email?: string | null;
};

export default function ProfileSheet({ visible, onClose, photoUri, onPhotoUpdate, onEditProfile, name, email }: Props) {
  
  const handlePhotoOptions = () => {
    Alert.alert(
      'Profile Photo',
      'Choose an option',
      [
        { text: 'Camera', onPress: openCamera },
        { text: 'Gallery', onPress: openGallery },
        ...(photoUri ? [{ text: 'Remove Photo', onPress: removePhoto, style: 'destructive' as const }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const openCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      onPhotoUpdate?.(result.assets[0].uri);
    }
  };

  const openGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Gallery access is required to select photos.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      onPhotoUpdate?.(result.assets[0].uri);
    }
  };

  const removePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onPhotoUpdate?.(null) },
      ]
    );
  };

  const handleEditProfile = () => {
    Alert.alert(
      'Edit Profile',
      'Choose an option',
      [
        { text: 'Change Image', onPress: openGallery },
        ...(photoUri ? [{ text: 'Remove Photo', onPress: removePhoto, style: 'destructive' as const }] : []),
        { text: 'Edit Details', onPress: () => onEditProfile?.() },
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <ThemedView style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Image
              source={photoUri ? { uri: photoUri } : require('@/assets/images/icon.png')}
              style={styles.avatar}
            />
            <View style={{ marginLeft: 12 }}>
              <ThemedText style={styles.name}>Hi {name || 'User'}</ThemedText>
              <ThemedText style={styles.email}>{email || 'you@example.com'}</ThemedText>
            </View>
          </View>

        <Pressable style={styles.action} onPress={handlePhotoOptions}>
          <Ionicons name="image-outline" size={20} />
          <ThemedText style={styles.actionText}>Upload photo</ThemedText>
        </Pressable>

        <Pressable style={styles.action} onPress={handleEditProfile}>
          <Ionicons name="create-outline" size={20} />
          <ThemedText style={styles.actionText}>Edit profile</ThemedText>
        </Pressable>

        <Pressable style={[styles.action, { justifyContent: 'center' }]} onPress={onClose}>
          <ThemedText style={[styles.actionText, { fontWeight: '700' }]}>Close</ThemedText>
        </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#00000055',
  },
  sheet: {
    height: '50%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    zIndex: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#B3B3B3',
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  name: { fontSize: 18, fontWeight: '700' },
  email: { fontSize: 14, opacity: 0.7 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  actionText: { fontSize: 16 },
});


