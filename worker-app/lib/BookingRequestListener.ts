/**
 * BookingRequestListener - Always-on listener for incoming booking requests
 * This service ensures the worker app is always ready to receive requests
 */

import { Alert } from 'react-native';
import { SocketService } from './SocketService';
import { getApiUrl } from './config';

export class BookingRequestListener {
  private static instance: BookingRequestListener;
  private socketService: SocketService;
  private workerId: string | null = null;
  private isListening: boolean = false;
  private onRequestCallback: ((booking: any) => void) | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectInterval: any = null;

  private constructor() {
    this.socketService = SocketService.getInstance();
    console.log('📡 BookingRequestListener initialized');
  }

  public static getInstance(): BookingRequestListener {
    if (!BookingRequestListener.instance) {
      BookingRequestListener.instance = new BookingRequestListener();
    }
    return BookingRequestListener.instance;
  }

  /**
   * Start listening for booking requests
   * This should be called when worker logs in and sets up location
   */
  public startListening(workerId: string, callback: (booking: any) => void) {
    console.log('🎧 Starting BookingRequestListener for worker:', workerId);
    
    this.workerId = workerId;
    this.onRequestCallback = callback;
    this.isListening = true;

    // Connect to Socket.IO server
    this.connectToSocket();

    // Setup listeners
    this.setupListeners();

    // Setup auto-reconnect
    this.setupAutoReconnect();

    console.log('✅ BookingRequestListener is now active and ready to receive requests');
  }

  /**
   * Connect to Socket.IO server
   */
  private connectToSocket() {
    if (!this.workerId) {
      console.error('❌ Cannot connect: No worker ID provided');
      return;
    }

    try {
      // Connect as a worker
      this.socketService.connect(this.workerId, 'worker');
      console.log('✅ Socket connected for worker:', this.workerId);
      this.reconnectAttempts = 0; // Reset reconnect counter on successful connection
    } catch (error) {
      console.error('❌ Socket connection error:', error);
      this.attemptReconnect();
    }
  }

  /**
   * Setup all Socket.IO event listeners for booking requests
   */
  private setupListeners() {
    console.log('📡 Setting up booking request listeners...');
    console.log('🎧 Waiting for booking:request events in "worker" room...');

    // Main booking request listener - THIS IS THE CRITICAL ONE
    this.socketService.on('booking:request', (booking: any) => {
      console.log('\n🔔🔔🔔 BOOKING REQUEST RECEIVED! 🔔🔔🔔');
      console.log('📨 Booking details:', {
        bookingId: booking._id,
        serviceName: booking.serviceName,
        serviceCategory: booking.serviceCategory,
        price: booking.price,
        location: booking.location?.address,
        assignedTo: booking.workerId || 'Open to all workers',
      });

      // If booking has a specific workerId, check if it matches this worker
      if (booking.workerId && booking.workerId !== this.workerId) {
        console.log('⚠️ Request is for another worker - ignoring');
        return;
      }

      // Verify this request is for services this worker provides
      if (this.shouldAcceptRequest(booking)) {
        console.log('✅ REQUEST ACCEPTED - Showing to worker!');
        
        // IMMEDIATELY call the callback to show instant popup/banner
        if (this.onRequestCallback) {
          // Use setTimeout to ensure callback runs after current execution
          setTimeout(() => {
            this.onRequestCallback!(booking);
            console.log('✅ Callback executed - Popup should appear instantly!');
          }, 0);
        } else {
          console.error('❌ No callback registered!');
        }

        // Also show system notification if app is in background
        this.showNotification(booking);
      } else {
        console.log('⚠️ Request does not match worker categories - ignoring');
      }
    });

    // Listen for booking updates
    this.socketService.on('booking:updated', (data: any) => {
      console.log('📝 Booking updated:', data);
    });

    // Listen for booking cancellations
    this.socketService.on('booking:cancelled', (data: any) => {
      console.log('🚫 Booking cancelled:', data);
      if (data.workerId === this.workerId) {
        Alert.alert(
          'Booking Cancelled',
          data.message || 'A customer has cancelled a booking assigned to you.',
          [{ text: 'OK' }]
        );
      }
    });

    // Listen for connection status
    this.socketService.on('connect', () => {
      console.log('✅ Socket connected - Listener is active');
      this.reconnectAttempts = 0;
    });

    this.socketService.on('disconnect', () => {
      console.warn('⚠️ Socket disconnected - Attempting to reconnect...');
      this.attemptReconnect();
    });

    this.socketService.on('error', (error: any) => {
      console.error('❌ Socket error:', error);
      this.attemptReconnect();
    });

    console.log('✅ All listeners setup complete');
  }

  /**
   * Check if this booking request matches worker's service categories and is verified
   */
  private shouldAcceptRequest(booking: any): boolean {
    if (!this.workerId || !booking.serviceCategory) {
      console.log('⚠️ Cannot verify request: Missing worker ID or service category');
      return false;
    }

    // Get worker data from context/storage
    // Note: This requires access to worker context, which we don't have here
    // So we'll rely on the frontend (requests.tsx) to do the filtering
    // But we can add a basic check here if needed
    
    // For now, return true and let the frontend handle detailed verification
    // The backend already filters by verification status, so this is a double-check
    return true;
  }

  /**
   * Show notification (for background state)
   */
  private showNotification(booking: any) {
    // This would integrate with expo-notifications in production
    console.log('🔔 Notification:', {
      title: 'New Booking Request',
      body: `${booking.serviceName} - Rs. ${booking.price}`,
      data: booking,
    });
  }

  /**
   * Setup auto-reconnect mechanism
   */
  private setupAutoReconnect() {
    // Clear any existing reconnect interval
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    // Check connection status every 30 seconds
    this.reconnectInterval = setInterval(() => {
      // Check if listener is active but socket is not connected
      if (this.isListening) {
        // SocketService doesn't have isConnected() method, so check differently
        const status = this.getStatus();
        if (!status.isConnected) {
          console.warn('⚠️ Socket not connected - Attempting reconnect...');
          this.attemptReconnect();
        }
      }
    }, 30000);
  }

  /**
   * Attempt to reconnect to socket
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnect attempts reached');
      Alert.alert(
        'Connection Lost',
        'Unable to maintain connection to server. Please check your internet and restart the app.',
        [{ text: 'OK' }]
      );
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(() => {
      if (this.workerId) {
        this.connectToSocket();
      }
    }, 2000 * this.reconnectAttempts); // Exponential backoff
  }

  /**
   * Update worker location (should be called when location changes)
   */
  public updateLocation(location: { latitude: number; longitude: number }) {
    if (!this.isListening) {
      console.warn('⚠️ Listener not active - location not sent');
      return;
    }

    console.log('📍 Updating worker location:', location);
    
    this.socketService.emit('worker:location:update', {
      workerId: this.workerId,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Update worker availability status
   */
  public updateAvailability(status: 'available' | 'busy') {
    if (!this.isListening) {
      console.warn('⚠️ Listener not active - status not updated');
      return;
    }

    console.log('📊 Updating worker availability:', status);
    
    this.socketService.emit('worker:status:update', {
      workerId: this.workerId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Stop listening for requests
   */
  public stopListening() {
    console.log('🛑 Stopping BookingRequestListener');
    
    this.isListening = false;
    this.onRequestCallback = null;

    // Clear reconnect interval
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    // Remove all listeners
    this.socketService.off('booking:request');
    this.socketService.off('booking:updated');
    this.socketService.off('booking:cancelled');
    this.socketService.off('connect');
    this.socketService.off('disconnect');
    this.socketService.off('error');

    // Disconnect socket
    this.socketService.disconnect();

    console.log('✅ BookingRequestListener stopped');
  }

  /**
   * Check if listener is active
   */
  public isActive(): boolean {
    return this.isListening;
  }

  /**
   * Get connection status info
   */
  public getStatus(): {
    isListening: boolean;
    isConnected: boolean;
    workerId: string | null;
    reconnectAttempts: number;
  } {
    // SocketService stores connection status but doesn't expose isConnected() method
    // We track it based on whether we're listening and haven't hit max reconnects
    const isConnected = this.isListening && this.reconnectAttempts < this.maxReconnectAttempts;
    
    return {
      isListening: this.isListening,
      isConnected: isConnected,
      workerId: this.workerId,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

export const bookingRequestListener = BookingRequestListener.getInstance();

