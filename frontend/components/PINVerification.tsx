import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PINVerificationProps {
  onSuccess: () => void;
  onForgotPIN: () => void;
}

export default function PINVerification({ onSuccess, onForgotPIN }: PINVerificationProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTime, setLockTime] = useState(0);
  const [showPin, setShowPin] = useState(false);
  const [shakeAnimation] = useState(new Animated.Value(0));

  const MAX_ATTEMPTS = 3;
  const LOCK_DURATION = 30; // 30 seconds

  useEffect(() => {
    if (isLocked && lockTime > 0) {
      const timer = setTimeout(() => {
        setLockTime(lockTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isLocked && lockTime === 0) {
      setIsLocked(false);
      setAttempts(0);
    }
  }, [isLocked, lockTime]);

  const handleNumberPress = (number: string) => {
    if (isLocked) return;
    
    if (pin.length < 6) {
      const newPin = pin + number;
      setPin(newPin);
      if (newPin.length === 6) {
        verifyPIN(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (isLocked) return;
    setPin(pin.slice(0, -1));
  };

  const verifyPIN = async (enteredPin: string) => {
    try {
      const storedPIN = await AsyncStorage.getItem('user_pin');
      
      if (enteredPin === storedPIN) {
        // Reset attempts on successful verification
        setAttempts(0);
        onSuccess();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin('');
        
        // Shake animation for wrong PIN
        Animated.sequence([
          Animated.timing(shakeAnimation, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: -10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();

        Vibration.vibrate(200);

        if (newAttempts >= MAX_ATTEMPTS) {
          setIsLocked(true);
          setLockTime(LOCK_DURATION);
          Alert.alert(
            'Too Many Attempts',
            `You have exceeded the maximum number of attempts. Please wait ${LOCK_DURATION} seconds before trying again.`,
          );
        } else {
          Alert.alert(
            'Incorrect PIN',
            `Wrong PIN. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`,
          );
        }
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      Alert.alert('Error', 'Failed to verify PIN. Please try again.');
    }
  };

  const renderDots = () => {
    return (
      <Animated.View 
        style={[
          styles.dotsContainer,
          { transform: [{ translateX: shakeAnimation }] }
        ]}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index < pin.length 
                  ? theme.tint 
                  : theme.icon + '30',
              },
            ]}
          />
        ))}
      </Animated.View>
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
                  isLocked && styles.disabledButton,
                ]}
                onPress={() => {
                  if (isLocked) return;
                  if (item === 'backspace') {
                    handleBackspace();
                  } else if (item !== '') {
                    handleNumberPress(item);
                  }
                }}
                disabled={item === '' || isLocked}
              >
                {item === 'backspace' ? (
                  <Ionicons 
                    name="backspace-outline" 
                    size={24} 
                    color={isLocked ? theme.icon + '50' : theme.text} 
                  />
                ) : item !== '' ? (
                  <Text 
                    style={[
                      styles.keypadText, 
                      { 
                        color: isLocked ? theme.icon + '50' : theme.text 
                      }
                    ]}
                  >
                    {item}
                  </Text>
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
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name="lock-closed" 
            size={48} 
            color={isLocked ? theme.icon + '50' : theme.tint} 
          />
        </View>

        <ThemedText style={styles.title}>
          {isLocked ? 'App Locked' : 'Enter Your PIN'}
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          {isLocked 
            ? `Please wait ${lockTime} seconds before trying again`
            : 'Enter your 6-digit PIN to access the app'
          }
        </ThemedText>

        <View style={styles.pinContainer}>
          {renderDots()}
          <TouchableOpacity
            style={styles.showPinButton}
            onPress={() => setShowPin(!showPin)}
            disabled={isLocked}
          >
            <Ionicons 
              name={showPin ? "eye-off" : "eye"} 
              size={20} 
              color={isLocked ? theme.icon + '50' : theme.icon} 
            />
          </TouchableOpacity>
        </View>

        {showPin && !isLocked && (
          <View style={styles.pinDisplay}>
            <ThemedText style={styles.pinText}>{pin}</ThemedText>
          </View>
        )}

        {!isLocked && (
          <View style={styles.attemptsContainer}>
            <ThemedText style={styles.attemptsText}>
              {MAX_ATTEMPTS - attempts} attempts remaining
            </ThemedText>
          </View>
        )}

        {renderKeypad()}

        {!isLocked && (
          <TouchableOpacity 
            style={styles.forgotButton}
            onPress={onForgotPIN}
          >
            <ThemedText style={styles.forgotButtonText}>
              Forgot PIN?
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  attemptsContainer: {
    marginBottom: 20,
  },
  attemptsText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  keypad: {
    width: '100%',
    maxWidth: 300,
    marginBottom: 20,
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
  disabledButton: {
    opacity: 0.5,
  },
  keypadText: {
    fontSize: 24,
    fontWeight: '600',
  },
  forgotButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  forgotButtonText: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '500',
  },
});
