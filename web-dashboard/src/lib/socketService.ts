import { io, Socket } from 'socket.io-client';

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public connect(userId: string, userType: 'user' | 'worker' | 'admin' = 'admin'): void {
    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    
    try {
    console.log(`🔌 Connecting to Socket.IO server: ${apiUrl} as ${userType} (${userId})`);
    
    this.socket = io(apiUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      forceNew: true, // Force new connection
        timeout: 5000, // 5 second connection timeout
        autoConnect: true,
    });
    } catch (error) {
      console.warn('⚠️ Failed to initialize socket connection (backend may be offline):', error);
      // Don't throw, just log - socket will retry automatically
      return;
    }

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Authenticate with server immediately
      setTimeout(() => {
        this.socket?.emit('authenticate', { userId, userType });
        console.log(`📤 Authenticating as ${userType}: ${userId}`);
      }, 100);
    });

    this.socket.on('authenticated', (data: any) => {
      console.log('✅ Socket authenticated:', data);
      // Join admin room if userType is admin
      if (userType === 'admin') {
        this.socket?.emit('join_room', { roomId: 'admin' });
        console.log('✅ Admin joined admin room for notifications');
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('❌ Socket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error: Error) => {
      // Only log error, don't spam console - WebSocket errors are expected if backend is down
      if (this.reconnectAttempts === 0) {
        console.warn('⚠️ Socket connection error (this is normal if backend is not running):', error.message);
      }
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('⚠️ Max socket reconnection attempts reached. Socket will retry automatically.');
        // Don't throw error, just silently retry
      }
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log(`✅ Socket reconnected after ${attemptNumber} attempts`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.socket?.emit('authenticate', { userId, userType });
    });
  }

  public on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  public off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  public emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const socketService = SocketService.getInstance();

