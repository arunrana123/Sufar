/**
 * Notification Sound Service
 * Handles playing sounds for different notification types
 */

import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

// Dynamic import for expo-av
let AudioModule: any = null;
try {
  AudioModule = require('expo-av').Audio;
} catch (e) {
  console.warn('expo-av not available for notification sounds');
}

class NotificationSoundService {
  private static instance: NotificationSoundService;
  private soundRef: any = null;
  private isPlaying = false;

  private constructor() {
    // Initialize audio mode
    this.initializeAudio();
  }

  public static getInstance(): NotificationSoundService {
    if (!NotificationSoundService.instance) {
      NotificationSoundService.instance = new NotificationSoundService();
    }
    return NotificationSoundService.instance;
  }

  private async initializeAudio() {
    if (AudioModule) {
      try {
        await AudioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.warn('Could not set audio mode:', error);
      }
    }
  }

  /**
   * Play notification sound based on notification type
   */
  public async playNotificationSound(notificationType: string, status?: string) {
    try {
      // Vibrate first
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Vibration.vibrate(200);
      }

      // Determine sound based on type and status
      let soundType = 'default';
      
      if (notificationType === 'document_verification' || notificationType === 'verification_submitted' || notificationType === 'verification_complete' || notificationType === 'category_verification_submitted') {
        if (status === 'verified' || status === 'complete') {
          soundType = 'success';
        } else if (status === 'rejected' || status === 'denied') {
          soundType = 'error';
        } else {
          soundType = 'info';
        }
      } else if (notificationType === 'booking' || notificationType === 'job') {
        if (status === 'accepted' || status === 'completed') {
          soundType = 'success';
        } else if (status === 'cancelled' || status === 'rejected') {
          soundType = 'error';
        } else {
          soundType = 'info';
        }
      } else if (notificationType === 'payment') {
        soundType = 'success';
      } else if (notificationType === 'promotion' || notificationType === 'service' || notificationType === 'offer') {
        soundType = 'promotion';
      }

      // Play sound
      await this.playSound(soundType);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  /**
   * Play a specific sound type
   */
  private async playSound(soundType: string) {
    try {
      if (Platform.OS === 'web') {
        // Web: Use Web Audio API
        this.playWebBeep(soundType);
      } else if (AudioModule) {
        // Native: Use expo-av (you can add sound files later)
        // For now, just vibrate
        if (Platform.OS !== 'web') {
          Vibration.vibrate(300);
        }
      }
    } catch (error) {
      console.warn('Could not play sound, using vibration only:', error);
      if (Platform.OS !== 'web') {
        Vibration.vibrate(200);
      }
    }
  }

  /**
   * Play beep sound on web using Web Audio API
   */
  private playWebBeep(soundType: string) {
    if (typeof window === 'undefined') return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for different sound types
      let frequency = 800; // Default
      let duration = 0.2;
      
      if (soundType === 'success') {
        frequency = 1000; // Higher pitch for success
        duration = 0.3;
      } else if (soundType === 'error') {
        frequency = 600; // Lower pitch for error
        duration = 0.25;
      } else if (soundType === 'promotion') {
        frequency = 900;
        duration = 0.4;
      }
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Web Audio API error:', error);
    }
  }

  /**
   * Stop any playing sounds
   */
  public async stopSound() {
    try {
      if (this.soundRef && AudioModule) {
        await this.soundRef.stopAsync();
        await this.soundRef.unloadAsync();
        this.soundRef = null;
      }
      this.isPlaying = false;
    } catch (error) {
      console.warn('Error stopping sound:', error);
    }
  }
}

export const notificationSoundService = NotificationSoundService.getInstance();
