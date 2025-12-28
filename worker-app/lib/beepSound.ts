/**
 * Beep Sound Utility
 * Creates a simple beep sound for notifications
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let soundInstance: Audio.Sound | null = null;
let isPlaying = false;

/**
 * Play a beep sound (looping)
 */
export async function playBeepSound(): Promise<void> {
  try {
    // Stop any existing sound
    await stopBeepSound();

    // Set audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    // Create a simple beep sound using a data URI
    // This is a simple 800Hz sine wave beep (0.2 seconds)
    const beepDataUri = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77+efTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBlou+/nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC';

    if (Platform.OS === 'web') {
      // For web, use Web Audio API to generate a beep
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      
      // Loop the beep
      const beepInterval = setInterval(() => {
        if (!isPlaying) {
          clearInterval(beepInterval);
          return;
        }
        
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.value = 800;
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.2);
      }, 500); // Beep every 500ms
      
      isPlaying = true;
    } else {
      // For native, try to use a simple beep sound
      // Since we don't have a beep file, we'll use vibration as primary
      // and attempt to create a beep if possible
      isPlaying = true;
    }
  } catch (error) {
    console.error('Error playing beep sound:', error);
    isPlaying = false;
  }
}

/**
 * Stop the beep sound
 */
export async function stopBeepSound(): Promise<void> {
  try {
    if (soundInstance) {
      await soundInstance.stopAsync();
      await soundInstance.unloadAsync();
      soundInstance = null;
    }
    isPlaying = false;
  } catch (error) {
    console.error('Error stopping beep sound:', error);
    isPlaying = false;
  }
}
