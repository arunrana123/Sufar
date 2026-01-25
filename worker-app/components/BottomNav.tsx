import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname, useSegments } from 'expo-router';
import QRGenerator from './QRGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { isFullyVerified } from '@/lib/permissions';

export default function BottomNav() {
  const pathname = usePathname();
  const segments = useSegments();
  const [showQRModal, setShowQRModal] = useState(false);
  const { worker } = useAuth();

  // Debug: Log pathname and segments to see what we're getting
  useEffect(() => {
    console.log('📍 BottomNav - Current pathname:', pathname);
    console.log('📍 BottomNav - Current segments:', segments);
  }, [pathname, segments]);

  const navItems = [
    { 
      key: 'index', 
      label: 'Home', 
      icon: 'home-outline', 
      iconActive: 'home', 
      route: '/(tabs)' 
    },
    { 
      key: 'requests', 
      label: 'Requests', 
      icon: 'clipboard-outline', 
      iconActive: 'clipboard', 
      route: '/(tabs)/requests' 
    },
    { 
      key: 'qr', 
      label: 'QR', 
      icon: 'qr-code', 
      isQR: true 
    },
    { 
      key: 'tracking', 
      label: 'Tracking', 
      icon: 'location-outline', 
      iconActive: 'location', 
      route: '/(tabs)/tracking' 
    },
    { 
      key: 'profile', 
      label: 'Profile', 
      icon: 'person-outline', 
      iconActive: 'person', 
      route: '/(tabs)/profile' 
    },
  ];

  const isActive = (item: any) => {
    // Use segments for more reliable route detection
    const lastSegment = segments[segments.length - 1] || '';
    const normalizedPath = (pathname || '').toLowerCase().trim();
    
    // Check both pathname and segments for reliability
    if (item.key === 'index') {
      const matches = 
        lastSegment === 'index' || 
        lastSegment === '' ||
        normalizedPath === '/(tabs)' || 
        normalizedPath === '/(tabs)/' || 
        normalizedPath === '/(tabs)/index' || 
        normalizedPath === '/' ||
        normalizedPath.endsWith('/(tabs)') ||
        normalizedPath.endsWith('/(tabs)/') ||
        (segments.length === 1 && segments[0] === '(tabs)') ||
        (segments.length === 0);
      return matches;
    }
    
    // More precise matching for other routes
    if (item.key === 'requests') {
      const matches = 
        lastSegment === 'requests' ||
        normalizedPath.includes('/requests') || 
        normalizedPath === '/(tabs)/requests' ||
        segments.includes('requests');
      return matches;
    }
    
    if (item.key === 'tracking') {
      const matches = 
        lastSegment === 'tracking' ||
        normalizedPath.includes('/tracking') || 
        normalizedPath === '/(tabs)/tracking' ||
        segments.includes('tracking');
      return matches;
    }
    
    if (item.key === 'profile') {
      const matches = 
        lastSegment === 'profile' ||
        normalizedPath.includes('/profile') || 
        normalizedPath === '/(tabs)/profile' ||
        segments.includes('profile');
      return matches;
    }
    
    return false;
  };

  return (
    <>
      <View style={styles.bottomNav}>
        {navItems.map((item) => {
          const active = isActive(item);
          
          if (item.isQR) {
            // Check if worker is verified before allowing QR access
            const handleQRPress = () => {
              // Check if worker is fully verified (overall + has verified services)
              const fullyVerified = isFullyVerified(worker);
              
              if (!fullyVerified) {
                Alert.alert(
                  'Verification Required',
                  'Please verify the required documents first. Once you submit your documents and get verified by admin, you will be ready to go and can access your QR code.',
                  [
                    { 
                      text: 'Go to Verification', 
                      onPress: () => router.push('/document-verification'),
                      style: 'default'
                    },
                    { text: 'OK', style: 'cancel' }
                  ]
                );
                return;
              }
              
              // Worker is verified, show QR code
              setShowQRModal(true);
            };
            
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.qrNavItem}
                onPress={handleQRPress}
              >
                <View style={styles.qrIconContainer}>
                  <Ionicons name={item.icon as any} size={28} color="#fff" />
                </View>
                <Text style={[styles.navLabel, { color: '#FF7A2C', fontWeight: 'bold' }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }
          
          const iconName = active ? (item.iconActive || item.icon) : item.icon;
          const iconColor = active ? '#0066FF' : '#999';
          const textColor = active ? '#0066FF' : '#999';
          
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => {
                router.push(item.route as any);
              }}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={iconName as any} 
                size={26} 
                color={iconColor}
              />
              <Text style={[styles.navLabel, { color: textColor, fontWeight: active ? '700' : '400', fontSize: active ? 13 : 12 }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal
        visible={showQRModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <QRGenerator onClose={() => setShowQRModal(false)} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingBottom: 20,
    borderTopWidth: 2,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  navItemActive: {
    // Visual indicator for active state
    backgroundColor: 'rgba(0, 102, 255, 0.08)',
    borderRadius: 8,
  },
  navLabel: {
    fontSize: 12,
  },
  qrNavItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    position: 'relative',
  },
  qrIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF7A2C',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 3,
    borderColor: '#fff',
  },
});

