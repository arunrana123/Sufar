import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PINSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function PINSetup({ onComplete, onCancel }: PINSetupProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'setup' | 'confirm'>('setup');
  const [showPin, setShowPin] = useState(false);

  const handleNumberPress = (number: string) => {
    if (step === 'setup') {
      if (pin.length < 6) {
        const newPin = pin + number;
        setPin(newPin);
        if (newPin.length === 6) {
          setTimeout(() => {
            setStep('confirm');
            setShowPin(false);
          }, 300);
        }
      }
    } else {
      if (confirmPin.length < 6) {
        const newConfirmPin = confirmPin + number;
        setConfirmPin(newConfirmPin);
        if (newConfirmPin.length === 6) {
          setTimeout(() => {
            if (pin === newConfirmPin) {
              savePIN(newConfirmPin);
            } else {
              Alert.alert('PIN Mismatch', 'The PINs do not match. Please try again.');
              setPin('');
              setConfirmPin('');
              setStep('setup');
              setShowPin(false);
            }
          }, 300);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (step === 'setup') {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const savePIN = async (pinToSave: string) => {
    try {
      await AsyncStorage.setItem('user_pin', pinToSave);
      await AsyncStorage.setItem('pin_enabled', 'true');
      Alert.alert('Success', 'PIN has been set successfully!', [
        {
          text: 'OK',
          onPress: onComplete,
        },
      ]);
    } catch (error) {
      console.error('Error saving PIN:', error);
      Alert.alert('Error', 'Failed to save PIN. Please try again.');
    }
  };

  const renderDots = (currentPin: string) => {
    return (
      <View style={styles.dotsContainer}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index < currentPin.length 
                  ? theme.tint 
                  : theme.icon + '30',
              },
            ]}
          />
        ))}
      </View>
    );
  };

  const renderKeypad = () => {
    const numbers = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'backspace'],
    ];

    return (
      <View style={styles.keypad}>
        {numbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((item, colIndex) => (
              <TouchableOpacity
                key={`${rowIndex}-${colIndex}`}
                style={[
                  styles.keypadButton,
                  { backgroundColor: theme.background },
                  item === '' && styles.emptyButton,
                ]}
                onPress={() => {
                  if (item === 'backspace') {
                    handleBackspace();
                  } else if (item !== '') {
                    handleNumberPress(item);
                  }
                }}
                disabled={item === ''}
              >
                {item === 'backspace' ? (
                  <Ionicons name="backspace-outline" size={24} color={theme.text} />
                ) : item !== '' ? (
                  <Text style={[styles.keypadText, { color: theme.text }]}>{item}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Setup PIN</ThemedText>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name="lock-closed" 
            size={48} 
            color={theme.tint} 
          />
        </View>

        <ThemedText style={styles.title}>
          {step === 'setup' ? 'Create Your PIN' : 'Confirm Your PIN'}
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          {step === 'setup' 
            ? 'Enter a 6-digit PIN to secure your app'
            : 'Re-enter your PIN to confirm'
          }
        </ThemedText>

        <View style={styles.pinContainer}>
          {renderDots(step === 'setup' ? pin : confirmPin)}
          <TouchableOpacity
            style={styles.showPinButton}
            onPress={() => setShowPin(!showPin)}
          >
            <Ionicons 
              name={showPin ? "eye-off" : "eye"} 
              size={20} 
              color={theme.icon} 
            />
          </TouchableOpacity>
        </View>

        {showPin && (
          <View style={styles.pinDisplay}>
            <ThemedText style={styles.pinText}>
              {step === 'setup' ? pin : confirmPin}
            </ThemedText>
          </View>
        )}

        {renderKeypad()}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  cancelButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  pinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  showPinButton: {
    marginLeft: 16,
    padding: 8,
  },
  pinDisplay: {
    marginBottom: 20,
  },
  pinText: {
    fontSize: 18,
    fontFamily: 'monospace',
    letterSpacing: 4,
  },
  keypad: {
    width: '100%',
    maxWidth: 300,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  keypadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyButton: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  keypadText: {
    fontSize: 24,
    fontWeight: '600',
  },
});
