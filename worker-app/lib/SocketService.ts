import { io, Socket } from 'socket.io-client';
import NetInfo from '@react-native-community/netinfo';
import { getApiUrl } from './config';

export interface SocketEvents {
  // Booking events
  'booking:request': (booking: any) => void;
  'booking:accepted': (booking: any) => void;
  'booking:rejected': (booking: any) => void;
  'booking:started': (booking: any) => void;
  'booking:completed': (booking: any) => void;
  'booking:cancelled': (booking: any) => void;
  'booking:updated': (booking: any) => void;
  'booking:status_updated': (data: any) => void;

  // Worker location and navigation events
  'worker:location_update': (data: { workerId: string; location: any }) => void;
  'worker:location': (data: { 
    workerId: string; 
    bookingId: string; 
    latitude: number; 
    longitude: number; 
    accuracy?: number; 
    timestamp: number;
    distanceTraveled?: number;
    distanceRemaining?: number;
  }) => void;
  'worker:status_change': (data: { workerId: string; status: string }) => void;
  'worker:available': (workerId: string) => void;
  'worker:busy': (workerId: string) => void;

  // Location tracking events
  'location:tracking:started': (data: { bookingId: string; workerId: string; timestamp: string }) => void;

  // Navigation events with enhanced data
  'navigation:started': (data: { 
    bookingId: string; 
    workerId: string; 
    route: any; 
    distance: number; 
    duration: number; 
    timestamp: string;
  }) => void;
  'navigation:arrived': (data: { bookingId: string; workerId: string; timestamp: string }) => void;
  'navigation:ended': (data: { bookingId: string; workerId: string; timestamp: string }) => void;
  'route:updated': (data: { 
    bookingId: string; 
    route: any; 
    distance: number; 
    duration: number; 
    timestamp: string;
    distanceTraveled: number;
    distanceRemaining: number;
  }) => void;

  // Work events
  'work:started': (data: any) => void;
  'work:completed': (data: any) => void;

  // Payment events
  'payment:status_updated': (data: { bookingId: string; paymentStatus: string; userConfirmed: boolean; workerConfirmed: boolean; booking?: any }) => void;

  // Notification events
  'notification:new': (notification: any) => void;
  'notification:read': (notificationId: string) => void;
  'notification:deleted': (data: any) => void;
  'notifications:cleared': (data?: any) => void;
  'notifications:all-read': (data?: any) => void;

  // Worker stats events
  'worker:stats_updated': (data: { workerId: string; message?: string }) => void;

  // Worker profile events
  'worker:profile_updated': (data: { workerId: string; name?: string; email?: string; phone?: string; profileImage?: string; [key: string]: any }) => void;

  // Service events
  'service:updated': (service: any) => void;
  'service:created': (service: any) => void;
  'service:deleted': (serviceId: string) => void;
  'worker:service_updated': (data: { workerId: string; services: any[] }) => void;

  // Document verification events
  'document:verification:updated': (data: { workerId: string; documentType: string; status: string; overallStatus?: string }) => void;

  // General events
  'connect': () => void;
  'disconnect': () => void;
  'error': (error: any) => void;
}

export class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private initialized = false;
  private currentUserId: string | null = null;
  private currentUserType: 'user' | 'worker' | null = null;

  private constructor() {
    // Don't auto-initialize - wait for explicit connect() call
  }

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  private async initializeSocket() {
    if (this.initialized) return;
    
    try {
      // Use getApiUrl() from config to ensure correct IP
      const apiUrl = getApiUrl();
      console.log('✅ Initializing socket connection to:', apiUrl);
      // Verify IP is correct (192.168.1.66 for physical devices, localhost/10.0.2.2 for emulators)
      const expectedIp = '192.168.1.66'; // Should match DEFAULT_API_URL in config.ts
      console.log(`   Using correct IP (${expectedIp}):`, apiUrl.includes(expectedIp) || apiUrl.includes('localhost') || apiUrl.includes('10.0.2.2'));
      
      this.socket = io(apiUrl, {
        transports: ['websocket', 'polling'], // Fallback to polling if websocket fails
        timeout: 20000,
        forceNew: true,
        autoConnect: false, // Don't auto-connect
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      this.setupEventListeners();
      this.initialized = true;
    } catch (error) {
      console.error('Socket initialization error:', error);
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Authenticate immediately when connected
      if (this.currentUserId && this.currentUserType && this.socket) {
        console.log(`🔐 Authenticating as ${this.currentUserType}: ${this.currentUserId}`);
        this.socket.emit('authenticate', { 
          userId: this.currentUserId, 
          userType: this.currentUserType 
        });
      } else {
        console.warn('⚠️ Socket connected but no user credentials available');
      }
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ Authentication confirmed:', data);
      console.log('✅ Socket ID:', data.socketId);
      console.log('✅ Joined rooms:', data.rooms);
      console.log('✅ User type:', data.userType);
      
      if (data.userType === 'worker') {
        console.log('🎧 WORKER IS NOW READY TO RECEIVE BOOKING REQUESTS');
        console.log('📡 Listening in room: "worker"');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
      this.handleReconnect();
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Listen for network changes
    NetInfo.addEventListener(state => {
      if (state.isConnected && !this.isConnected && this.initialized) {
        this.reconnect();
      }
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        this.reconnect();
      }, delay);
    }
  }

  private reconnect() {
    if (this.socket && this.initialized) {
      this.socket.connect();
    }
  }

  /**
   * Connect to socket with user authentication
   */
  async connect(userId: string, userType: 'user' | 'worker') {
    // Store credentials for re-authentication
    this.currentUserId = userId;
    this.currentUserType = userType;

    // Initialize socket if not already done
    if (!this.initialized) {
      await this.initializeSocket();
    }

    if (this.socket) {
      // Only connect if not already connected
      if (!this.isConnected) {
        console.log(`🔌 Connecting socket as ${userType}: ${userId}`);
        this.socket.connect();
        
        // Set up authentication when socket connects
        this.socket.once('connect', () => {
          console.log(`🔐 Socket connected, authenticating as ${userType}: ${userId}`);
          this.socket?.emit('authenticate', { userId, userType });
        });
      } else {
        // Already connected, authenticate immediately
        console.log(`🔐 Already connected, authenticating as ${userType}: ${userId}`);
        this.socket.emit('authenticate', { userId, userType });
      }
    }
  }

  /**
   * Disconnect from socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
      this.currentUserId = null;
      this.currentUserType = null;
    }
  }

  /**
   * Emit an event to the server
   */
  emit(event: string, data?: any) {
    if (this.socket) {
      if (this.isConnected) {
        this.socket.emit(event, data);
      } else {
        // Queue the event if not connected yet
        this.socket.once('connect', () => {
          this.socket?.emit(event, data);
        });
        // Also try to connect if not already trying
        if (!this.isConnected && this.initialized) {
          this.socket.connect();
        }
      }
    } else {
      console.warn('Socket not initialized, cannot emit event:', event);
    }
  }

  /**
   * Listen to an event from the server
   */
  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]) {
    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  }

  /**
   * Remove event listener
   */
  off<K extends keyof SocketEvents>(event: K, callback?: SocketEvents[K]) {
    if (this.socket) {
      this.socket.off(event, callback as any);
    }
  }

  /**
   * Join a room (for location-based updates)
   */
  joinRoom(roomId: string) {
    this.emit('join_room', { roomId });
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string) {
    this.emit('leave_room', { roomId });
  }

  /**
   * Update worker location
   */
  updateLocation(location: { latitude: number; longitude: number; accuracy?: number }) {
    this.emit('location_update', location);
  }

  /**
   * Accept booking request
   */
  acceptBooking(bookingId: string, workerId: string) {
    this.emit('booking:accept', { bookingId, workerId });
  }

  /**
   * Reject booking request
   */
  rejectBooking(bookingId: string, workerId: string, reason?: string) {
    this.emit('booking:reject', { bookingId, workerId, reason });
  }

  /**
   * Start booking
   */
  startBooking(bookingId: string, workerId: string) {
    this.emit('booking:start', { bookingId, workerId });
  }

  /**
   * Complete booking
   */
  completeBooking(bookingId: string, workerId: string) {
    this.emit('booking:complete', { bookingId, workerId });
  }

  /**
   * Update worker status
   */
  updateStatus(status: 'available' | 'busy' | 'offline') {
    this.emit('worker:status_update', { status });
  }

  /**
   * Send notification
   */
  sendNotification(notification: any) {
    this.emit('notification:send', notification);
  }

  /**
   * Mark notification as read
   */
  markNotificationAsRead(notificationId: string) {
    this.emit('notification:read', { notificationId });
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance (but don't initialize yet)
export const socketService = SocketService.getInstance();
