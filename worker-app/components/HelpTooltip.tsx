// HELP TOOLTIP COMPONENT - Reusable tooltip for showing helpful hints to workers
// Features: Icon button that shows/hides tooltip, customizable message, worker-friendly styling
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HelpTooltipProps {
  message: string;
  title?: string;
  iconSize?: number;
  iconColor?: string;
}

export default function HelpTooltip({ 
  message, 
  title = 'Help', 
  iconSize = 20, 
  iconColor = '#FF7A2C' 
}: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      {/* Help Icon Button */}
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={styles.iconButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="help-circle-outline" size={iconSize} color={iconColor} />
      </TouchableOpacity>

      {/* Tooltip Modal */}
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setVisible(false)}
        >
          <View style={styles.tooltipContainer}>
            <View style={styles.tooltipHeader}>
              <Ionicons name="information-circle" size={24} color="#FF7A2C" />
              <Text style={styles.tooltipTitle}>{title}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.tooltipMessage}>{message}</Text>
            <TouchableOpacity
              style={styles.gotItButton}
              onPress={() => setVisible(false)}
            >
              <Text style={styles.gotItText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltipContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxWidth: 320,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  tooltipTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tooltipMessage: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
  },
  gotItButton: {
    backgroundColor: '#FF7A2C',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  gotItText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

