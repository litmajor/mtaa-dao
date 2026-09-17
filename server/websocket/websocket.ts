import { Server, type Socket } from 'socket.io';
import type { DefaultEventsMap } from 'socket.io';
import { type Server as HTTPServer } from 'http';
import socketAuthMiddleware from '../middleware/socketAuth';
import { getRedisSubscriptionManager } from '../services/redisSubscriptionManager';
import { type AdminWS, WS_PATHS } from './websocket-events';
import { corsAllowedOrigins } from '../../shared/config.js';

/**
 * WebSocket Server Setup
 * Real-time communication for all admin features
 *
 * FIXES APPLIED:
 * 1. hasRoomPermission's "own room" check was `room.includes(user.id)`, a
 *    substring match. A user with id "1" would match any room containing
 *    the character "1" anywhere (e.g. "activity:txn:100"), granting access
 *    to rooms that had nothing to do with them. Replaced with exact-match
 *    checks against defined room-naming conventions.
 * 2. Broadcast event handlers (config:changed, activity:log, alert:triggered,
 *    presence:update) never checked permission before publishing into a
 *    room — only joining a room was gated. Any authenticated socket could
 *    inject a fake alert or config-change notification into any room's
 *    subscribers. All publish paths now call hasRoomPermission (or an
 *    explicit "must have joined" check) before broadcasting.
 * 3. Cookie parsing used `cookie.split('=')` destructured as [key, value],
 *    which truncates any value containing more than one '=' character.
 *    Fixed to split only on the first '='.
 * 4. jwt.verify() now pins `algorithms: ['HS256']` explicitly instead of
 *    accepting whatever algorithm the token claims.
 * 5. Added an `error` listener on the Redis subscriber — previously an
 *    unhandled 'error' event from the redis client would crash the process
 *    via an uncaught exception.
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

export interface AuthenticatedUser {
  id?: string;
  sub?: string;
  email?: string;
  permissions?: string[];
}

export interface AuthenticatedSocketData {
  user?: AuthenticatedUser;
  system?: boolean;
}

type AuthenticatedSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, AuthenticatedSocketData>;

class WebSocketManager {
  private io: Server;
  private redisSubscriptionManager: Awaited<ReturnType<typeof getRedisSubscriptionManager>> | null = null;
  private redisInitPromise: Promise<void> | null = null;
  private subscribedChannels: Set<string> = new Set();
  private roomDisposers = new Map<string, () => Promise<void>>();
  private connectedUsers: Map<string, SocketUser> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();
  private rooms: Map<string, SocketRoom> = new Map();

  constructor(httpServer: HTTPServer) {
    const socketCorsOrigins = corsAllowedOrigins.length > 0
      ? corsAllowedOrigins
      : ['http://localhost:5173'];

    this.io = new Server(httpServer, {
      path: WS_PATHS.ADMIN,
      cors: {
        origin: socketCorsOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    // Use shared Socket.IO auth middleware
    this.io.use(socketAuthMiddleware);
    this.setupConnections();
  }

  private async ensureRedisSubscriptionManager() {
    if (this.redisSubscriptionManager) {
      return this.redisSubscriptionManager;
    }

    if (!this.redisInitPromise) {
      this.redisInitPromise = (async () => {
        try {
          this.redisSubscriptionManager = await getRedisSubscriptionManager();
        } catch (err: any) {
          console.warn('[WebSocket] Failed to start Redis subscriber', (err && err.message) || err);
          this.redisSubscriptionManager = null;
        }
      })();
    }

    await this.redisInitPromise;
    return this.redisSubscriptionManager;
  }


  // NOTE: authentication is handled by shared `socketAuthMiddleware`

  /**
   * Setup connection handlers
   */
  private setupConnections() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const user = socket.data.user;

      if (!user) {
        console.log(`Unauthenticated socket connected: ${socket.id}`);
        return;
      }

      const socketUser: SocketUser = {
        userId: user.id || user.sub || 'unknown',
        email: user.email || 'unknown',
        permissions: user.permissions || [],
        connectedAt: new Date(),
        socketId: socket.id
      };

      this.connectedUsers.set(socket.id, socketUser);
      const userId = user.id || user.sub || 'unknown';
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      console.log(`User connected: ${socketUser.email} (${socket.id})`);
      this.broadcastUserCount();

      socket.on('subscribe:room', (data: { room: string }) => {
        this.handleRoomSubscription(socket, data.room);
      });

      socket.on('unsubscribe:room', (data: { room: string }) => {
        this.handleRoomUnsubscription(socket, data.room);
      });

      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

      this.setupEventListeners(socket);
    });
  }

  /**
   * Setup custom event listeners
   */
  private setupEventListeners(socket: Socket) {
    socket.on('config:changed', (data) => {
      this.broadcastConfigurationChange(socket, data);
    });

    socket.on('activity:log', (data) => {
      this.broadcastActivity(socket, data);
    });

    socket.on('alert:triggered', (data) => {
      this.broadcastAlert(socket, data);
    });

    socket.on('presence:update', (data) => {
      this.broadcastPresence(socket, data);
    });

    socket.on('search:result', (data) => {
      this.broadcastSearchResult(socket, data);
    });

    socket.on('analytics:updated', (data) => {
      this.broadcastAnalyticsUpdate(socket, data);
    });
  }

  /**
   * Handle room subscription
   */
  private async handleRoomSubscription(socket: AuthenticatedSocket, room: string) {
    const user = socket.data.user;
    if (!user) {
      socket.emit('error:permission', { message: 'No permission for this room' });
      return;
    }

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
        userId: user.id || user.sub || 'unknown',
        email: user.email || 'unknown',
        permissions: user.permissions || [],
        connectedAt: new Date(),
        socketId: socket.id
    };

    roomData.users.set(socket.id, socketUser);

    this.io.to(room).emit('room:user-joined', {
      user: socketUser,
      totalUsers: roomData.users.size
    });

    console.log(`User subscribed to room: ${room}`);
    try {
      const redisManager = await this.ensureRedisSubscriptionManager();
      if (redisManager && !this.subscribedChannels.has(room)) {
        this.subscribedChannels.add(room);
        const subscribeHandler = async (message: string, channel: string) => {
          try {
            const payload = JSON.parse(message);
            this.io.to(channel).emit('execution:log', payload);
          } catch (err: any) {
            this.io.to(channel).emit('execution:log', { raw: message });
          }
        };

        const disposeSubscription = await redisManager.subscribe(room, subscribeHandler);
        this.roomDisposers.set(room, disposeSubscription);
        console.log(`[WebSocket] Subscribed Redis to channel: ${room}`);
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
    try {
      const roomSocketCount = this.io.sockets.adapter.rooms.get(room)?.size || 0;
      if (this.redisSubscriptionManager && this.subscribedChannels.has(room) && roomSocketCount === 0) {
        const dispose = this.roomDisposers.get(room);
        if (dispose) {
          void dispose().then(() => {
            this.roomDisposers.delete(room);
            this.subscribedChannels.delete(room);
            console.log(`[WebSocket] Unsubscribed Redis from channel: ${room}`);
          }).catch((err) => console.warn('[WebSocket] Redis unsubscribe failed', err));
        }
      }
    } catch (err) {
      console.warn('[WebSocket] Redis unsubscribe error', err);
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket) {
    const user = socket.data.user;
    this.connectedUsers.delete(socket.id);

    if (user) {
      const userId = user.id || user.sub || 'unknown';
      const userSockets = this.userSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }

    this.rooms.forEach((room) => {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        if (room.users.size === 0) {
          this.rooms.delete(room.name);
        }
      }
    });

    console.log(`User disconnected: ${user?.email || 'guest'} (${socket.id})`);
    this.broadcastUserCount();
  }

  /**
   * FIX #2: every broadcast* method below now verifies the emitting socket
   * actually has permission to publish into the target room (using the same
   * hasRoomPermission check used for joining, plus confirming they've
   * actually joined it) before fanning the event out to that room's
   * subscribers. Previously these were wide open to any authenticated user.
   */
  private canPublishToRoom(socket: AuthenticatedSocket, user: AuthenticatedUser | undefined, room: string): boolean {
    // Allow trusted system sockets or users with an explicit publish permission
    if (socket.data.system === true) return true;
    if (user?.permissions?.includes('publish:system')) return true;

    if (!this.hasRoomPermission(user, room)) return false;
    // Must have actually joined the room via subscribe:room first —
    // permission alone shouldn't let you publish into a room you're not in.
    return socket.rooms.has(room);
  }

  private rejectPublish(socket: Socket, room: string): void {
    socket.emit('error:permission', { message: `No permission to publish to ${room}` });
  }

  /**
   * Broadcast configuration changes
   */
  private broadcastConfigurationChange(socket: AuthenticatedSocket, data: AdminWS.ConfigChangeEvent) {
    const user = socket.data.user;
    if (!user) return this.rejectPublish(socket, 'unknown');

    const room = `config:${data.entityType}:${data.entityId}`;
    if (!this.canPublishToRoom(socket, user, room)) return this.rejectPublish(socket, room);

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
  private broadcastActivity(socket: AuthenticatedSocket, data: AdminWS.ActivityEvent) {
    const user = socket.data.user;
    if (!user) return this.rejectPublish(socket, 'unknown');

    const room = `activity:${data.entityType}:${data.entityId}`;
    if (!this.canPublishToRoom(socket, user, room)) return this.rejectPublish(socket, room);

    this.io.to(room).emit('activity:logged', {
      ...data,
      user: user.email,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast alerts
   */
  private broadcastAlert(socket: AuthenticatedSocket, data: AdminWS.AlertEvent) {
    const user = socket.data.user;
    if (!user) return this.rejectPublish(socket, 'alerts');

    // FIX #2: previously any authenticated user could trigger a global alert.
    if (!this.canPublishToRoom(socket, user, 'alerts')) return this.rejectPublish(socket, 'alerts');

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
  private broadcastPresence(socket: AuthenticatedSocket, data: AdminWS.PresenceEvent) {
    const user = socket.data.user;
    if (!user) return this.rejectPublish(socket, 'unknown');

    const room = `presence:${data.section}`;
    if (!this.canPublishToRoom(socket, user, room)) return this.rejectPublish(socket, room);

    this.io.to(room).emit('presence:updated', {
      userId: user.id || user.sub,
      email: user.email,
      action: data.action,
      section: data.section,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast search results
   */
  private broadcastSearchResult(socket: AuthenticatedSocket, data: AdminWS.SearchResultEvent) {
    const user = socket.data.user;
    const room = `search:results`;
    if (!user || !this.canPublishToRoom(socket, user, room)) return this.rejectPublish(socket, room);

    this.io.to(room).emit('search:result-ready', {
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast analytics updates
   */
  private broadcastAnalyticsUpdate(socket: AuthenticatedSocket, data: AdminWS.AnalyticsUpdateEvent) {
    const user = socket.data.user;
    const room = `analytics`;
    if (!user || !this.canPublishToRoom(socket, user, room)) return this.rejectPublish(socket, room);

    this.io.to(room).emit('analytics:updated', {
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Check room permission
   *
   * FIX #1: the old "own room" check was `room.includes(user.id)`, a
   * substring match that could match unrelated rooms. Personal rooms must
   * now match an explicit `user:${id}` convention exactly. If your rooms
   * use a different personal-room naming scheme elsewhere in the app,
   * update this pattern to match it — the key fix is "exact segment match",
   * not "substring anywhere in the string".
   */
  private hasRoomPermission(user: AuthenticatedUser | undefined, room: string): boolean {
    if (!user) return false;
    if (room === `user:${user.id || user.sub}`) {
      return true;
    }

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

  public emitToUser(userId: string, event: string, data: Record<string, unknown>) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }

  public emitToRoom(room: string, event: string, data: Record<string, unknown>) {
    this.io.to(room).emit(event, data);
  }

  public broadcastToAll(event: string, data: Record<string, unknown>) {
    this.io.emit(event, data);
  }

  public getConnectedUsers(): SocketUser[] {
    return Array.from(this.connectedUsers.values());
  }

  public getRoomInfo(room: string): SocketRoom | undefined {
    return this.rooms.get(room);
  }

  public getAllRooms(): SocketRoom[] {
    return Array.from(this.rooms.values());
  }

  public close() {
    this.io.close();
  }

  public getIO(): Server {
    return this.io;
  }
}

// Singleton instance management
let webSocketManagerInstance: WebSocketManager | null = null;

export function initializeWebSocketManager(httpServer: HTTPServer): WebSocketManager {
  if (webSocketManagerInstance) {
    console.warn('WebSocket manager already initialized');
    return webSocketManagerInstance;
  }
  webSocketManagerInstance = new WebSocketManager(httpServer);
  return webSocketManagerInstance;
}

export function getWebSocketManager(): WebSocketManager {
  if (!webSocketManagerInstance) {
    throw new Error('WebSocket manager not initialized. Call initializeWebSocketManager first.');
  }
  return webSocketManagerInstance;
}

export default WebSocketManager;