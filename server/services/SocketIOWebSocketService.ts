/**
 * Socket.IO Unified WebSocket Service
 * Replaces raw ws with Socket.IO for:
 * - Unified connection management
 * - Built-in room/namespace support
 * - Automatic heartbeat and reconnection
 * - Event-based communication
 * - Better error handling
 * 
 * Eliminates: ws.router warning
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { wsConnectionManager } from './WebSocketConnectionManager';
import { wsHealthMonitor } from './WebSocketHealthMonitor';
import { verifyAccessToken, AuthRequest } from '../auth';

interface ClientData {
  userId: string;
  userName: string;
  connectionId: string;
  subscriptions: Set<string>;
  joinedAt: Date;
}

export class SocketIOWebSocketService {
  private static instance: SocketIOWebSocketService | null = null;
  private io: SocketIOServer;
  private clientData: Map<string, ClientData> = new Map();
  private typingUsers: Map<string, Set<string>> = new Map();
  private onlineUsers: Map<string, Set<string>> = new Map();

  private constructor(server: HttpServer) {
    // Initialize Socket.IO with proper CORS and transports
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling'],
      pingInterval: 30000,
      pingTimeout: 60000,
      maxHttpBufferSize: 1024 * 1024, // 1MB max message size
      perMessageDeflate: true // Enable compression
    });

    this.setupMiddleware();
    this.setupConnections();
    this.startHealthMonitoring();
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(server?: HttpServer): SocketIOWebSocketService {
    if (!SocketIOWebSocketService.instance) {
      if (!server) {
        throw new Error('SocketIOWebSocketService not initialized: server required');
      }
      SocketIOWebSocketService.instance = new SocketIOWebSocketService(server);
    }
    return SocketIOWebSocketService.instance;
  }

  /**
   * Setup Socket.IO middleware for authentication
   */
  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Verify JWT token
        const payload = verifyAccessToken(token);
        if (!payload) {
          return next(new Error('Invalid or expired token'));
        }

        // Attach user info to socket
        (socket as any).userId = payload.sub;
        (socket as any).userEmail = payload.email;
        (socket as any).userRole = payload.role || 'user';

        next();
      } catch (error) {
        logger.error('[SocketIO Auth] Middleware error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup connection handlers
   */
  private setupConnections(): void {
    this.io.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;
      logger.info(`[SocketIO] Client connected: ${socket.id} (User: ${userId})`);

      // Handle initialization
      socket.on('init', (data: any) => this.handleInit(socket, data));

      // Handle subscriptions
      socket.on('subscribe', (channels: string[]) => this.handleSubscribe(socket, channels));
      socket.on('unsubscribe', (channels: string[]) => this.handleUnsubscribe(socket, channels));

      // Handle typing status
      socket.on('typing', (data: any) => this.handleTyping(socket, data));

      // Handle presence
      socket.on('presence', (status: string) => this.handlePresence(socket, status));

      // Handle disconnect
      socket.on('disconnect', () => this.handleDisconnect(socket));

      // Handle errors
      socket.on('error', (error: any) => {
        logger.error(`[SocketIO] Error on ${socket.id}:`, error);
      });
    });
  }

  /**
   * Handle client initialization
   */
  private handleInit(socket: Socket, data: any): void {
    const userId = (socket as any).userId;
    
    if (!data.userName || !Array.isArray(data.subscriptions)) {
      socket.emit('init_error', { error: 'Invalid initialization data' });
      socket.disconnect();
      return;
    }

    // Register with connection manager (enforces per-user limits)
    const registration = wsConnectionManager.registerConnection(
      socket as any,
      userId,
      data.subscriptions
    );

    if (registration.error) {
      logger.warn(`[SocketIO] Connection rejected for ${userId}: ${registration.error}`);
      socket.emit('init_error', {
        error: registration.error,
        retryAfter: wsConnectionManager['getReconnectDelay'](3)
      });
      socket.disconnect(true);
      return;
    }

    // Store client data
    const clientData: ClientData = {
      userId,
      userName: data.userName,
      connectionId: registration.connectionId,
      subscriptions: new Set(data.subscriptions),
      joinedAt: new Date()
    };
    this.clientData.set(socket.id, clientData);

    // Join rooms for each subscription (enables targeted broadcasts)
    data.subscriptions.forEach((sub: string) => {
      socket.join(`subscription:${sub}`);
    });

    // Track online users per subscription
    data.subscriptions.forEach((sub: string) => {
      if (!this.onlineUsers.has(sub)) {
        this.onlineUsers.set(sub, new Set());
      }
      this.onlineUsers.get(sub)!.add(userId);
    });

    // Broadcast presence update
    data.subscriptions.forEach((sub: string) => {
      this.broadcastPresence(sub);
    });

    // Confirm initialization
    socket.emit('init_success', {
      connectionId: registration.connectionId,
      subscriptions: data.subscriptions.length,
      timestamp: new Date()
    });

    logger.info(`[SocketIO] Initialized ${socket.id} for ${userId}`, {
      subscriptions: data.subscriptions.length
    });
  }

  /**
   * Handle subscription changes
   */
  private handleSubscribe(socket: Socket, channels: string[]): void {
    const clientData = this.clientData.get(socket.id);
    if (!clientData) return;

    channels.forEach(channel => {
      socket.join(`subscription:${channel}`);
      clientData.subscriptions.add(channel);

      // Track online presence
      if (!this.onlineUsers.has(channel)) {
        this.onlineUsers.set(channel, new Set());
      }
      this.onlineUsers.get(channel)!.add(clientData.userId);

      this.broadcastPresence(channel);
    });

    logger.info(`[SocketIO] ${socket.id} subscribed to ${channels.length} channels`);
  }

  /**
   * Handle unsubscription
   */
  private handleUnsubscribe(socket: Socket, channels: string[]): void {
    const clientData = this.clientData.get(socket.id);
    if (!clientData) return;

    channels.forEach(channel => {
      socket.leave(`subscription:${channel}`);
      clientData.subscriptions.delete(channel);

      // Update presence
      const onlineSet = this.onlineUsers.get(channel);
      if (onlineSet) {
        onlineSet.delete(clientData.userId);
        this.broadcastPresence(channel);
      }
    });

    logger.info(`[SocketIO] ${socket.id} unsubscribed from ${channels.length} channels`);
  }

  /**
   * Handle typing indicator
   */
  private handleTyping(socket: Socket, data: any): void {
    const clientData = this.clientData.get(socket.id);
    if (!clientData || !data.channel || data.isTyping === undefined) return;

    if (!this.typingUsers.has(data.channel)) {
      this.typingUsers.set(data.channel, new Set());
    }

    const typingSet = this.typingUsers.get(data.channel)!;
    if (data.isTyping) {
      typingSet.add(clientData.userId);
    } else {
      typingSet.delete(clientData.userId);
    }

    this.broadcastTyping(data.channel);
  }

  /**
   * Handle presence status
   */
  private handlePresence(socket: Socket, status: 'online' | 'away' | 'offline'): void {
    const clientData = this.clientData.get(socket.id);
    if (!clientData) return;

    // Broadcast to all subscribed channels
    clientData.subscriptions.forEach(channel => {
      if (status === 'offline') {
        this.onlineUsers.get(channel)?.delete(clientData.userId);
      } else if (status === 'online' && !this.onlineUsers.get(channel)?.has(clientData.userId)) {
        if (!this.onlineUsers.has(channel)) {
          this.onlineUsers.set(channel, new Set());
        }
        this.onlineUsers.get(channel)!.add(clientData.userId);
      }
      this.broadcastPresence(channel);
    });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(socket: Socket): void {
    const clientData = this.clientData.get(socket.id);
    if (!clientData) return;

    // Cleanup from all subscriptions
    clientData.subscriptions.forEach(channel => {
      this.typingUsers.get(channel)?.delete(clientData.userId);
      this.onlineUsers.get(channel)?.delete(clientData.userId);
      this.broadcastTyping(channel);
      this.broadcastPresence(channel);
    });

    // Unregister from connection manager
    wsConnectionManager.unregisterConnection(clientData.connectionId);

    // Remove client data
    this.clientData.delete(socket.id);

    logger.info(`[SocketIO] Client disconnected: ${socket.id}`);
  }

  /**
   * Broadcast typing status (efficient with rooms)
   */
  private broadcastTyping(channel: string): void {
    const typingUsers = Array.from(this.typingUsers.get(channel) || []);
    this.io.to(`subscription:${channel}`).emit('typing_update', {
      channel,
      typingUsers,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast presence status (efficient with rooms)
   */
  private broadcastPresence(channel: string): void {
    const onlineUsers = Array.from(this.onlineUsers.get(channel) || []);
    this.io.to(`subscription:${channel}`).emit('presence_update', {
      channel,
      onlineUsers,
      timestamp: new Date()
    });
  }

  /**
   * Send message to specific user (all their connections)
   */
  public sendToUser(userId: string, message: any): number {
    let sentCount = 0;
    this.clientData.forEach((data, socketId) => {
      if (data.userId === userId) {
        this.io.to(socketId).emit('user_message', message);
        sentCount++;
      }
    });
    return sentCount;
  }

  /**
   * Broadcast to subscription (via rooms = efficient)
   */
  public broadcastToSubscription(subscription: string, message: any): number {
    this.io.to(`subscription:${subscription}`).emit(message.type || 'message', message);

    // Count recipients from subscribed room
    const sockets = this.io.sockets.adapter.rooms.get(`subscription:${subscription}`);
    return sockets?.size || 0;
  }

  /**
   * Get typing users for a channel
   */
  public getTypingUsers(channel: string): string[] {
    return Array.from(this.typingUsers.get(channel) || []);
  }

  /**
   * Get online users for a channel
   */
  public getOnlineUsers(channel: string): string[] {
    return Array.from(this.onlineUsers.get(channel) || []);
  }

  /**
   * Get connection stats
   */
  public getStats() {
    return wsConnectionManager.getStats();
  }

  /**
   * Get health status
   */
  public getHealthStatus() {
    return wsHealthMonitor.getHealthStatus();
  }

  /**
   * Start health monitoring loop
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      // Record metrics
      const connectedSockets = this.io.sockets.sockets.size;
      wsHealthMonitor.recordMetric('activeConnections', connectedSockets, 'count');

      // Check for dead connections
      let deadCount = 0;
      this.clientData.forEach((data, socketId) => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket || !socket.connected) {
          deadCount++;
        }
      });

      if (deadCount > 0) {
        logger.warn(`[SocketIO] ${deadCount} dead connections detected`);
      }
    }, 60000);
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('[SocketIO] Starting graceful shutdown...');

    // Notify all clients
    this.io.emit('server_shutdown', {
      message: 'Server shutting down',
      timestamp: new Date()
    });

    // Close all connections gracefully
    this.io.disconnectSockets();

    // Close server
    await new Promise<void>((resolve) => {
      this.io.close(() => {
        logger.info('[SocketIO] Server closed');
        resolve();
      });
    });

    // Cleanup connection manager
    wsConnectionManager.shutdown();

    logger.info('[SocketIO] Graceful shutdown complete');
  }
}

export const getSocketIOService = (server?: HttpServer) => {
  return SocketIOWebSocketService.getInstance(server);
};
