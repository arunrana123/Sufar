import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class BiometricAuth {
  static async isEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem('worker_biometricEnabled');
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric setting:', error);
      return false;
    }
  }

  static async isAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }

  static async authenticate(): Promise<{ success: boolean; error?: string }> {
    try {
      const isEnabled = await this.isEnabled();
      if (!isEnabled) {
        return { success: false, error: 'Biometric authentication is not enabled' };
      }

      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        return { success: false, error: 'Biometric authentication is not available on this device' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Biometric Login',
        subPromptMessage: 'Use your biometric to continue',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      return { 
        success: result.success, 
        error: result.success ? undefined : 'Biometric authentication failed' 
      };
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  static async getBiometricType(): Promise<string> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'Face ID';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'Fingerprint';
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'Iris';
      }
      return 'Biometric';
    } catch (error) {
      console.error('Error getting biometric type:', error);
      return 'Biometric';
    }
  }
}
