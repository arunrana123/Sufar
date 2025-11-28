import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationSettingsModal({
  visible,
  onClose,
}: NotificationSettingsModalProps) {
  const [bookingNotifications, setBookingNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [locationUpdates, setLocationUpdates] = useState(true);
  const [promotionalEmails, setPromotionalEmails] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  const handleSave = () => {
    // Save notification settings to backend/storage
    Alert.alert('Success', 'Notification settings updated successfully!', [
      { text: 'OK', onPress: onClose }
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notification Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView}>
            {/* Booking Notifications */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Booking Notifications</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="calendar" size={20} color="#FF7A2C" style={styles.settingIcon} />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>New Booking Requests</Text>
                    <Text style={styles.settingDescription}>Get notified when users book your services</Text>
                  </View>
                </View>
                <Switch
                  value={bookingNotifications}
                  onValueChange={setBookingNotifications}
                  trackColor={{ false: '#E0E0E0', true: '#FFE5CC' }}
                  thumbColor={bookingNotifications ? '#FF7A2C' : '#999'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="chatbubble" size={20} color="#4A90E2" style={styles.settingIcon} />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Message Notifications</Text>
                    <Text style={styles.settingDescription}>Get notified of new messages from users</Text>
                  </View>
                </View>
                <Switch
                  value={messageNotifications}
                  onValueChange={setMessageNotifications}
                  trackColor={{ false: '#E0E0E0', true: '#E3F2FD' }}
                  thumbColor={messageNotifications ? '#4A90E2' : '#999'}
                />
              </View>
            </View>

            {/* Location Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location & Tracking</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="location" size={20} color="#2E7D32" style={styles.settingIcon} />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Location Updates</Text>
                    <Text style={styles.settingDescription}>Share your location during active jobs</Text>
                  </View>
                </View>
                <Switch
                  value={locationUpdates}
                  onValueChange={setLocationUpdates}
                  trackColor={{ false: '#E0E0E0', true: '#E8F5E8' }}
                  thumbColor={locationUpdates ? '#2E7D32' : '#999'}
                />
              </View>
            </View>

            {/* Sound & Vibration */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sound & Vibration</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="volume-high" size={20} color="#9C27B0" style={styles.settingIcon} />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Sound Notifications</Text>
                    <Text style={styles.settingDescription}>Play sound for notifications</Text>
                  </View>
                </View>
                <Switch
                  value={soundEnabled}
                  onValueChange={setSoundEnabled}
                  trackColor={{ false: '#E0E0E0', true: '#F3E5F5' }}
                  thumbColor={soundEnabled ? '#9C27B0' : '#999'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="phone-portrait" size={20} color="#795548" style={styles.settingIcon} />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Vibration</Text>
                    <Text style={styles.settingDescription}>Vibrate for important notifications</Text>
                  </View>
                </View>
                <Switch
                  value={vibrationEnabled}
                  onValueChange={setVibrationEnabled}
                  trackColor={{ false: '#E0E0E0', true: '#EFEBE9' }}
                  thumbColor={vibrationEnabled ? '#795548' : '#999'}
                />
              </View>
            </View>

            {/* Email Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Email Preferences</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="mail" size={20} color="#F57C00" style={styles.settingIcon} />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Promotional Emails</Text>
                    <Text style={styles.settingDescription}>Receive updates about new features</Text>
                  </View>
                </View>
                <Switch
                  value={promotionalEmails}
                  onValueChange={setPromotionalEmails}
                  trackColor={{ false: '#E0E0E0', true: '#FFF8E1' }}
                  thumbColor={promotionalEmails ? '#F57C00' : '#999'}
                />
              </View>
            </View>
          </ScrollView>

          {/* Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  scrollView: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#FF7A2C',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
