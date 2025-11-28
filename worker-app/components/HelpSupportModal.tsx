import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HelpSupportModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HelpSupportModal({
  visible,
  onClose,
}: HelpSupportModalProps) {
  const handleCall = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleWebsite = (url: string) => {
    Linking.openURL(url);
  };

  const handleChat = () => {
    Alert.alert(
      'Live Chat',
      'Live chat feature will be available soon. For immediate assistance, please call or email us.',
      [{ text: 'OK' }]
    );
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
            <Text style={styles.headerTitle}>Help & Support</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Contact Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Support</Text>

              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => handleCall('+977-9861234567')}
              >
                <View style={styles.contactInfo}>
                  <View style={[styles.contactIcon, { backgroundColor: '#E8F5E8' }]}>
                    <Ionicons name="call" size={24} color="#2E7D32" />
                  </View>
                  <View style={styles.contactText}>
                    <Text style={styles.contactLabel}>Call Support</Text>
                    <Text style={styles.contactValue}>+977-9861234567</Text>
                    <Text style={styles.contactDescription}>Available 24/7 for emergencies</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => handleEmail('support@sufar.com')}
              >
                <View style={styles.contactInfo}>
                  <View style={[styles.contactIcon, { backgroundColor: '#E3F2FD' }]}>
                    <Ionicons name="mail" size={24} color="#1976D2" />
                  </View>
                  <View style={styles.contactText}>
                    <Text style={styles.contactLabel}>Email Support</Text>
                    <Text style={styles.contactValue}>support@sufar.com</Text>
                    <Text style={styles.contactDescription}>We'll respond within 24 hours</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactItem}
                onPress={handleChat}
              >
                <View style={styles.contactInfo}>
                  <View style={[styles.contactIcon, { backgroundColor: '#FFF3E0' }]}>
                    <Ionicons name="chatbubble" size={24} color="#F57C00" />
                  </View>
                  <View style={styles.contactText}>
                    <Text style={styles.contactLabel}>Live Chat</Text>
                    <Text style={styles.contactValue}>Chat with us</Text>
                    <Text style={styles.contactDescription}>Coming soon</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            </View>

            {/* Quick Help */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Help</Text>

              <TouchableOpacity style={styles.helpItem}>
                <Ionicons name="document-text" size={20} color="#666" />
                <View style={styles.helpText}>
                  <Text style={styles.helpLabel}>How to complete jobs?</Text>
                  <Text style={styles.helpAnswer}>
                    Accept booking → Navigate to location → Start work → Mark completed
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.helpItem}>
                <Ionicons name="shield-checkmark" size={20} color="#666" />
                <View style={styles.helpText}>
                  <Text style={styles.helpLabel}>Document verification process?</Text>
                  <Text style={styles.helpAnswer}>
                    Upload documents → Wait for admin review → Get verified → Start working
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.helpItem}>
                <Ionicons name="card" size={20} color="#666" />
                <View style={styles.helpText}>
                  <Text style={styles.helpLabel}>How do I get paid?</Text>
                  <Text style={styles.helpAnswer}>
                    Payment is collected from users and transferred to your account weekly
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.helpItem}>
                <Ionicons name="star" size={20} color="#666" />
                <View style={styles.helpText}>
                  <Text style={styles.helpLabel}>How to improve my rating?</Text>
                  <Text style={styles.helpAnswer}>
                    Complete jobs on time, be professional, maintain quality service
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Resources */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resources</Text>

              <TouchableOpacity
                style={styles.resourceItem}
                onPress={() => handleWebsite('https://sufar.com/terms')}
              >
                <Ionicons name="document" size={20} color="#666" />
                <Text style={styles.resourceText}>Terms of Service</Text>
                <Ionicons name="open" size={16} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resourceItem}
                onPress={() => handleWebsite('https://sufar.com/privacy')}
              >
                <Ionicons name="lock-closed" size={20} color="#666" />
                <Text style={styles.resourceText}>Privacy Policy</Text>
                <Ionicons name="open" size={16} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resourceItem}
                onPress={() => handleWebsite('https://sufar.com/guidelines')}
              >
                <Ionicons name="checkmark-circle" size={20} color="#666" />
                <Text style={styles.resourceText}>Worker Guidelines</Text>
                <Ionicons name="open" size={16} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resourceItem}
                onPress={() => handleWebsite('https://sufar.com/faq')}
              >
                <Ionicons name="help-circle" size={20} color="#666" />
                <Text style={styles.resourceText}>FAQ</Text>
                <Ionicons name="open" size={16} color="#999" />
              </TouchableOpacity>
            </View>

            {/* App Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>App Information</Text>
              <View style={styles.appInfo}>
                <Text style={styles.appInfoText}>Sufar Worker v1.0.0</Text>
                <Text style={styles.appInfoText}>Build 2024.11.06</Text>
                <Text style={styles.appInfoText}>Made in Nepal 🇳🇵</Text>
              </View>
            </View>
          </ScrollView>
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
    maxHeight: '85%',
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
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  contactText: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    color: '#FF7A2C',
    fontWeight: '500',
    marginBottom: 2,
  },
  contactDescription: {
    fontSize: 12,
    color: '#666',
  },
  helpItem: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  helpText: {
    marginLeft: 12,
    flex: 1,
  },
  helpLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  helpAnswer: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  resourceText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  appInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});
