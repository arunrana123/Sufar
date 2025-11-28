import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  biometricType?: string;
}

export class BiometricAuth {
  private static readonly PIN_KEY = 'worker_pin';
  private static readonly BIOMETRIC_ENABLED_KEY = 'worker_biometric_enabled';

  /**
   * Check if biometric authentication is available on the device
   */
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

  /**
   * Get available biometric types
   */
  static async getAvailableTypes(): Promise<string[]> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types.map(type => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return 'Fingerprint';
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return 'Face ID';
          case LocalAuthentication.AuthenticationType.IRIS:
            return 'Iris';
          default:
            return 'Unknown';
        }
      });
    } catch (error) {
      console.error('Error getting biometric types:', error);
      return [];
    }
  }

  /**
   * Authenticate using biometrics
   */
  static async authenticate(reason: string = 'Authenticate to continue'): Promise<BiometricAuthResult> {
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        return { success: false, error: 'Biometric authentication not available' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { 
          success: true, 
          biometricType: result.biometricType || 'Unknown' 
        };
      } else {
        return { 
          success: false, 
          error: result.error || 'Authentication failed' 
        };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return { 
        success: false, 
        error: 'Authentication error occurred' 
      };
    }
  }

  /**
   * Set up PIN for fallback authentication
   */
  static async setPIN(pin: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(this.PIN_KEY, pin);
      return true;
    } catch (error) {
      console.error('Error setting PIN:', error);
      return false;
    }
  }

  /**
   * Verify PIN
   */
  static async verifyPIN(pin: string): Promise<boolean> {
    try {
      const storedPIN = await SecureStore.getItemAsync(this.PIN_KEY);
      return storedPIN === pin;
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return false;
    }
  }

  /**
   * Enable biometric authentication
   */
  static async enableBiometric(): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(this.BIOMETRIC_ENABLED_KEY, 'true');
      return true;
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return false;
    }
  }

  /**
   * Disable biometric authentication
   */
  static async disableBiometric(): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(this.BIOMETRIC_ENABLED_KEY, 'false');
      return true;
    } catch (error) {
      console.error('Error disabling biometric:', error);
      return false;
    }
  }

  /**
   * Check if biometric is enabled
   */
  static async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(this.BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric status:', error);
      return false;
    }
  }

  /**
   * Authenticate with biometric or PIN fallback
   */
  static async authenticateWithFallback(reason: string = 'Authenticate to continue'): Promise<BiometricAuthResult> {
    try {
      const isBiometricEnabled = await this.isBiometricEnabled();
      
      if (isBiometricEnabled) {
        const biometricResult = await this.authenticate(reason);
        if (biometricResult.success) {
          return biometricResult;
        }
      }

      // Fallback to PIN if biometric fails or is disabled
      return { 
        success: false, 
        error: 'Please use PIN authentication' 
      };
    } catch (error) {
      console.error('Authentication with fallback error:', error);
      return { 
        success: false, 
        error: 'Authentication error occurred' 
      };
    }
  }

  /**
   * Clear all stored authentication data
   */
  static async clearAuthData(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(this.PIN_KEY);
      await SecureStore.deleteItemAsync(this.BIOMETRIC_ENABLED_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing auth data:', error);
      return false;
    }
  }
}
