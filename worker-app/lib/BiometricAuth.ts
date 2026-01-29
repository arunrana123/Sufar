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

  static async isFaceIDEnrolled(): Promise<boolean> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasFaceID = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      if (!hasFaceID) return false;
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return isEnrolled;
    } catch (error) {
      console.error('Error checking Face ID enrollment:', error);
      return false;
    }
  }

  static async registerFaceID(): Promise<{ success: boolean; error?: string }> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        return { success: false, error: 'Please set up Face ID (or fingerprint) in your device Settings first.' };
      }
      const type = await this.getBiometricType();
      const promptMessage = type === 'Face ID'
        ? 'Register Face ID - Look at your device to enable Face ID unlock'
        : 'Register Biometric - Use your fingerprint to enable unlock';
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });
      return { success: result.success, error: result.success ? undefined : 'Registration cancelled or failed.' };
    } catch (error) {
      console.error('Face ID registration error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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

      const type = await this.getBiometricType();
      const promptMessage = type === 'Face ID' ? 'Unlock with Face ID' : type === 'Fingerprint' ? 'Unlock with Fingerprint' : 'Unlock with Biometric';
      const subPromptMessage = type === 'Face ID' ? 'Look at your device to unlock' : 'Use your biometric to continue';
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        subPromptMessage,
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      return {
        success: result.success,
        error: result.success ? undefined : 'Biometric authentication failed',
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
