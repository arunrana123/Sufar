/**
 * Notification Sound Service
 * Handles playing sounds for different notification types
 */

import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { settingsService } from './SettingsService';

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
  public async playNotificationSound(notificationType: string, status?: string, workerId?: string) {
    try {
      // Check settings if workerId is provided
      if (workerId) {
        const shouldPlaySound = await settingsService.shouldPlaySound(workerId);
        const shouldVibrate = await settingsService.shouldVibrate(workerId);
        
        if (!shouldPlaySound && !shouldVibrate) {
          return; // Don't play anything if both are disabled
        }
        
        // Vibrate if enabled - use stronger haptic for booking requests
        if (shouldVibrate && Platform.OS !== 'web') {
          if (notificationType === 'booking' || notificationType === 'job') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Vibration.vibrate([100, 50, 100, 50, 100], false); // Non-repeating pattern
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Vibration.vibrate(200);
          }
        }
        
        // Only play sound if enabled
        if (!shouldPlaySound) {
          return; // Skip sound if disabled
        }
      } else {
        // Default behavior if no workerId (for backward compatibility)
        if (Platform.OS !== 'web') {
          if (notificationType === 'booking' || notificationType === 'job') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Vibration.vibrate([100, 50, 100, 50, 100], false);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Vibration.vibrate(200);
          }
        }
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
          soundType = 'booking'; // Special sound for new booking requests
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
        // Web: Use Web Audio API with better quality
        this.playWebBeep(soundType);
      } else if (AudioModule) {
        // Native: Use expo-av for better sound quality
        // For native platforms, we'll use Web Audio API fallback for now
        // You can add actual sound files later (beep.mp3, success.mp3, etc.)
        if (Platform.OS !== 'web') {
          // Use haptic feedback as primary native alert
          if (soundType === 'booking') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } else if (soundType === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else if (soundType === 'error') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      }
    } catch (error) {
      console.warn('Could not play sound, using vibration only:', error);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Vibration.vibrate(200);
      }
    }
  }

  /**
   * Play beep sound on web using Web Audio API - Enhanced for better quality
   */
  private playWebBeep(soundType: string) {
    if (typeof window === 'undefined') return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Different frequencies and patterns for different sound types
      let frequency = 800; // Default
      let duration = 0.2;
      let pattern: number[] = [0.3, 0.01]; // [startGain, endGain]
      
      if (soundType === 'booking') {
        // Special attention-grabbing sound for booking requests
        frequency = 1000;
        duration = 0.25;
        pattern = [0.4, 0.15, 0.4, 0.15, 0.4, 0.01]; // Triple beep pattern
        // Play triple beep
        this.playBeepPattern(audioContext, frequency, pattern, duration);
        return;
      } else if (soundType === 'success') {
        frequency = 1200; // Higher pitch for success
        duration = 0.3;
        pattern = [0.35, 0.01];
      } else if (soundType === 'error') {
        frequency = 500; // Lower pitch for error
        duration = 0.25;
        pattern = [0.35, 0.01];
      } else if (soundType === 'promotion') {
        frequency = 900;
        duration = 0.4;
        pattern = [0.3, 0.01];
      } else {
        pattern = [0.3, 0.01];
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine'; // Sine wave for smoother sound
      
      // Smooth gain envelope for better sound quality
      gainNode.gain.setValueAtTime(pattern[0], audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(pattern[pattern.length - 1], audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Web Audio API error:', error);
    }
  }

  /**
   * Play a beep pattern (for booking requests - triple beep)
   */
  private playBeepPattern(audioContext: AudioContext, frequency: number, pattern: number[], duration: number) {
    const beepCount = Math.floor(pattern.length / 2);
    const beepDuration = duration / beepCount;
    const pauseDuration = 0.05;
    
    for (let i = 0; i < beepCount; i++) {
      const startTime = audioContext.currentTime + (i * (beepDuration + pauseDuration));
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      const startGain = pattern[i * 2] || 0.3;
      const endGain = pattern[i * 2 + 1] || 0.01;
      
      gainNode.gain.setValueAtTime(startGain, startTime);
      gainNode.gain.exponentialRampToValueAtTime(endGain, startTime + beepDuration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + beepDuration);
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
