import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

/**
 * WebSocket Server Setup
 * Real-time communication for all admin features
 */

export interface SocketUser {
  userId: string;
  email: string;
  permissions: string[];
  connectedAt: Date;
  socketId: string;
}

export interface SocketRoom {
  name: string;
  users: Map<string, SocketUser>;
  createdAt: Date;
}

class WebSocketManager {
  private io: Server;
  private redisSub: Redis | null = null;
  private subscribedChannels: Set<string> = new Set();
  private connectedUsers: Map<string, SocketUser> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();
  private rooms: Map<string, SocketRoom> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupConnections();
    this.setupRedisSubscriber();
  }

  private setupRedisSubscriber() {
    try {
      const host = process.env.REDIS_HOST || 'localhost';
      const port = Number(process.env.REDIS_PORT) || 6379;
      const password = process.env.REDIS_PASSWORD || undefined;
      const db = Number(process.env.REDIS_DB) || 0;
      const opts: any = { host, port, db, password };
      this.redisSub = new Redis(opts);

      this.redisSub.on('error', (err) => {
        console.warn('[WebSocket] Redis subscriber error', err.message || err);
      });

      this.redisSub.on('message', (channel: string, message: string) => {
        try {
          const payload = JSON.parse(message);
          // Forward to socket.io room matching the channel name
          this.io.to(channel).emit('execution:log', payload);
        } catch (err) {
          // Send raw message if JSON parse fails
          this.io.to(channel).emit('execution:log', { raw: message });
        }
      });
    } catch (err) {
      console.warn('[WebSocket] Failed to start Redis subscriber', err);
      this.redisSub = null;
    }
  }

  /**
   * Authentication middleware
   * Validates JWT from httpOnly cookie (same pattern as REST API)
   * Cookies are automatically included by browser in Socket.IO handshake
   */
  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        // Socket.IO inherits cookies from handshake (same as browser XHR)
        const token = socket.handshake.headers.cookie
          ? this.extractJWTFromCookie(socket.handshake.headers.cookie)
          : null;

        if (!token) {
          // Allow connection but mark as unauthenticated
          socket.data.user = null;
          return next();
        }

        // Validate JWT token using same secret as REST API
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          console.error('JWT_SECRET not configured — socket token verification disabled');
          socket.data.user = null;
          return next();
        }

        const decoded = jwt.verify(token, secret) as any;

        // Attach user data to socket for later use in event handlers
        socket.data.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          daos: decoded.daos || [],
          permissions: decoded.permissions || []
        };

        next();
      } catch (err: any) {
        console.error('Socket.IO authentication failed:', err.message);
        // Allow connection but mark as unauthenticated (don't fail handshake)
        socket.data.user = null;
        next();
      }
    });
  }

  /**
   * Extract JWT token from httpOnly cookie
   * Parses cookie string to find JWT token
   * Cookie format: "token=<jwt>; other=value"
   */
  private extractJWTFromCookie(cookieString: string): string | null {
    try {
      const cookies = cookieString.split(';').map(c => c.trim());
      for (const cookie of cookies) {
        const [key, value] = cookie.split('=');
        if (key === 'token' || key === 'jwt' || key === 'authToken') {
          return decodeURIComponent(value);
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Setup connection handlers
   */
  private setupConnections() {
    this.io.on('connection', (socket: Socket) => {
      const user = socket.data.user;

      // If unauthenticated, register lightweight connection and skip protected handlers
      if (!user) {
        console.log(`Unauthenticated socket connected: ${socket.id}`);
        // Do not register as authenticated user; allow basic public events if any
        return;
      }

      // Register authenticated user
      const socketUser: SocketUser = {
        userId: user.id,
        email: user.email,
        permissions: user.permissions || [],
        connectedAt: new Date(),
        socketId: socket.id
      };

      this.connectedUsers.set(socket.id, socketUser);
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(socket.id);

      console.log(`User connected: ${user.email} (${socket.id})`);
      this.broadcastUserCount();

      // Handle room subscriptions
      socket.on('subscribe:room', (data: { room: string }) => {
        this.handleRoomSubscription(socket, user, data.room);
      });

      socket.on('unsubscribe:room', (data: { room: string }) => {
        this.handleRoomUnsubscription(socket, data.room);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket, user);
      });

      // Setup event listeners
      this.setupEventListeners(socket);
    });
  }

  /**
   * Setup custom event listeners
   */
  private setupEventListeners(socket: Socket) {
    // Configuration events
    socket.on('config:changed', (data) => {
      this.broadcastConfigurationChange(socket, data);
    });

    // Activity events
    socket.on('activity:log', (data) => {
      this.broadcastActivity(socket, data);
    });

    // Alert events
    socket.on('alert:triggered', (data) => {
      this.broadcastAlert(socket, data);
    });

    // Presence events
    socket.on('presence:update', (data) => {
      this.broadcastPresence(socket, data);
    });

    // Search events
    socket.on('search:result', (data) => {
      this.broadcastSearchResult(socket, data);
    });

    // Analytics events
    socket.on('analytics:updated', (data) => {
      this.broadcastAnalyticsUpdate(socket, data);
    });
  }

  /**
   * Handle room subscription
   */
  private handleRoomSubscription(socket: Socket, user: any, room: string) {
    // Check permissions
    if (!this.hasRoomPermission(user, room)) {
      socket.emit('error:permission', { message: 'No permission for this room' });
      return;
    }

    socket.join(room);

    if (!this.rooms.has(room)) {
      this.rooms.set(room, {
        name: room,
        users: new Map(),
        createdAt: new Date()
      });
    }

    const roomData = this.rooms.get(room)!;
    const socketUser: SocketUser = {
      userId: user.id,
      email: user.email,
      permissions: user.permissions || [],
      connectedAt: new Date(),
      socketId: socket.id
    };

    roomData.users.set(socket.id, socketUser);

    // Notify room members
    this.io.to(room).emit('room:user-joined', {
      user: socketUser,
      totalUsers: roomData.users.size
    });

    console.log(`User subscribed to room: ${room}`);
    // Ensure Redis subscriber is subscribed to this room/channel
    try {
      if (this.redisSub && !this.subscribedChannels.has(room)) {
        this.redisSub.subscribe(room).then(() => {
          this.subscribedChannels.add(room);
          console.log(`[WebSocket] Subscribed Redis to channel: ${room}`);
        }).catch((err) => console.warn('[WebSocket] Redis subscribe failed', err));
      }
    } catch (err) {
      console.warn('[WebSocket] Redis subscribe error', err);
    }
  }

  /**
   * Handle room unsubscription
   */
  private handleRoomUnsubscription(socket: Socket, room: string) {
    socket.leave(room);

    const roomData = this.rooms.get(room);
    if (roomData) {
      roomData.users.delete(socket.id);

      if (roomData.users.size === 0) {
        this.rooms.delete(room);
      } else {
        this.io.to(room).emit('room:user-left', {
          totalUsers: roomData.users.size
        });
      }
    }

    console.log(`User unsubscribed from room: ${room}`);
    // If no users remain in this room, unsubscribe Redis
    try {
      const roomSocketCount = this.io.sockets.adapter.rooms.get(room)?.size || 0;
      if (this.redisSub && this.subscribedChannels.has(room) && roomSocketCount === 0) {
        this.redisSub.unsubscribe(room).then(() => {
          this.subscribedChannels.delete(room);
          console.log(`[WebSocket] Unsubscribed Redis from channel: ${room}`);
        }).catch((err) => console.warn('[WebSocket] Redis unsubscribe failed', err));
      }
    } catch (err) {
      console.warn('[WebSocket] Redis unsubscribe error', err);
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(socket: Socket, user: any) {
    this.connectedUsers.delete(socket.id);

    const userSockets = this.userSockets.get(user.id);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.userSockets.delete(user.id);
      }
    }

    // Remove from all rooms
    this.rooms.forEach((room) => {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        if (room.users.size === 0) {
          this.rooms.delete(room.name);
        }
      }
    });

    console.log(`User disconnected: ${user.email} (${socket.id})`);
    this.broadcastUserCount();
  }

  /**
   * Broadcast configuration changes
   */
  private broadcastConfigurationChange(socket: Socket, data: any) {
    const user = socket.data.user;
    const room = `config:${data.entityType}:${data.entityId}`;

    this.io.to(room).emit('config:changed', {
      ...data,
      changedBy: user.email,
      timestamp: new Date(),
      socketId: socket.id
    });
  }

  /**
   * Broadcast activity logs
   */
  private broadcastActivity(socket: Socket, data: any) {
    const user = socket.data.user;
    const room = `activity:${data.entityType}:${data.entityId}`;

    this.io.to(room).emit('activity:logged', {
      ...data,
      user: user.email,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast alerts
   */
  private broadcastAlert(socket: Socket, data: any) {
    const user = socket.data.user;

    // Broadcast to alert room
    this.io.to('alerts').emit('alert:new', {
      ...data,
      triggeredBy: user.email,
      timestamp: new Date(),
      severity: data.severity || 'info'
    });
  }

  /**
   * Broadcast presence updates
   */
  private broadcastPresence(socket: Socket, data: any) {
    const user = socket.data.user;
    const room = `presence:${data.section}`;

    this.io.to(room).emit('presence:updated', {
      userId: user.id,
      email: user.email,
      action: data.action, // 'viewing', 'editing', 'searching'
      section: data.section,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast search results
   */
  private broadcastSearchResult(socket: Socket, data: any) {
    const room = `search:results`;

    this.io.to(room).emit('search:result-ready', {
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast analytics updates
   */
  private broadcastAnalyticsUpdate(socket: Socket, data: any) {
    const room = `analytics`;

    this.io.to(room).emit('analytics:updated', {
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Check room permission
   */
  private hasRoomPermission(user: any, room: string): boolean {
    // All authenticated users can join their own rooms
    if (room.includes(user.id)) {
      return true;
    }

    // Check permission-based rooms
    if (room === 'alerts' && user.permissions?.includes('view:alerts')) {
      return true;
    }

    if (room === 'analytics' && user.permissions?.includes('view:analytics')) {
      return true;
    }

    if (room.startsWith('config:') && user.permissions?.includes('view:configuration')) {
      return true;
    }

    if (room.startsWith('activity:') && user.permissions?.includes('view:activity')) {
      return true;
    }

    return false;
  }

  /**
   * Broadcast user count
   */
  private broadcastUserCount() {
    this.io.emit('system:user-count', {
      totalConnected: this.connectedUsers.size,
      totalUsers: this.userSockets.size
    });
  }

  /**
   * Emit to specific user
   */
  public emitToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }

  /**
   * Emit to room
   */
  public emitToRoom(room: string, event: string, data: any) {
    this.io.to(room).emit(event, data);
  }

  /**
   * Emit to all authenticated users
   */
  public broadcastToAll(event: string, data: any) {
    this.io.emit(event, data);
  }

  /**
   * Get connected users
   */
  public getConnectedUsers(): SocketUser[] {
    return Array.from(this.connectedUsers.values());
  }

  /**
   * Get room info
   */
  public getRoomInfo(room: string): SocketRoom | undefined {
    return this.rooms.get(room);
  }

  /**
   * Get all rooms
   */
  public getAllRooms(): SocketRoom[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Close connection
   */
  public close() {
    this.io.close();
  }

  /**
   * Get Socket.IO server instance (for advanced usage)
   */
  public getIO(): Server {
    return this.io;
  }
}

// Singleton instance management
let webSocketManagerInstance: WebSocketManager | null = null;

/**
 * Initialize WebSocket manager singleton
 * Call this once from server setup
 */
export function initializeWebSocketManager(httpServer: HTTPServer): WebSocketManager {
  if (webSocketManagerInstance) {
    console.warn('WebSocket manager already initialized');
    return webSocketManagerInstance;
  }
  webSocketManagerInstance = new WebSocketManager(httpServer);
  return webSocketManagerInstance;
}

/**
 * Get WebSocket manager instance
 */
export function getWebSocketManager(): WebSocketManager {
  if (!webSocketManagerInstance) {
    throw new Error('WebSocket manager not initialized. Call initializeWebSocketManager first.');
  }
  return webSocketManagerInstance;
}

export default WebSocketManager;
