/**
 * Coordinator WebSocket Handler
 *
 * Enables real-time communication updates when elders communicate
 *
 * FIXES APPLIED:
 * 1. Distinct Socket.IO `path` — prevents collision with Admin/Gateway WS
 *    servers if they're attached to the same underlying HTTP server.
 * 2. jwt.verify() now pins `algorithms: ['HS256']` explicitly.
 * 3. Topic subscriptions are now restricted to a known enum (CoordinatorWS.Topics)
 *    instead of accepting any client-supplied string as a room name.
 * 4. DAO-scoped topics (consensus, scry-alert, kaizen-recommendation,
 *    message-bus:message-published) now require the subscribing user to be
 *    a member of the daoId they're subscribing to (or a superuser) — mirrors
 *    the check handleConsensusRequest already did for direct requests.
 *    Previously any authenticated user could subscribe to `coordinator:consensus`
 *    and passively receive consensus results for every DAO in the system,
 *    not just their own — a cross-tenant data leak.
 * 5. broadcastToSubscribers for DAO-scoped topics now requires a daoId and
 *    emits into the per-DAO room instead of a single flat global room.
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { elderCoordinator } from '../core/elders/coordinator';
import { coordinatorMessageBus } from '../core/elders/coordinator/message-bus';
import { WS_PATHS, CoordinatorWS } from './websocket-events';
import { corsAllowedOrigins } from '../../shared/config.js';

const JWT_ALGORITHMS: jwt.Algorithm[] = ['HS256'];

export class CoordinatorWebSocketHandler {
  private io: SocketIOServer;
  private clientSubscriptions: Map<string, Set<string>> = new Map(); // socket.id -> room names (not raw topics)
  private connectedClients: Map<string, any> = new Map(); // socket.id -> user

  constructor(httpServer: HTTPServer) {
    const socketCorsOrigins = corsAllowedOrigins.length > 0
      ? corsAllowedOrigins
      : ['http://localhost:5173'];

    this.io = new SocketIOServer(httpServer, {
      // FIX #1
      path: WS_PATHS.COORDINATOR,
      cors: {
        origin: socketCorsOrigins,
        methods: ['GET', 'POST']
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupElderListeners();

    console.log('[CoordinatorWebSocket] WebSocket handler initialized');
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware(): void {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          return next(new Error('Server misconfiguration: JWT_SECRET not configured'));
        }
        // FIX #2: pin allowed algorithms explicitly
        const user = jwt.verify(token, secret, { algorithms: JWT_ALGORITHMS }) as any;
        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });
  }

  /**
   * Setup client event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const userId = socket.data.user?.userId;

      console.log(`[CoordinatorWebSocket] Client connected: ${socket.id} (${userId})`);

      this.connectedClients.set(socket.id, socket.data.user);
      this.clientSubscriptions.set(socket.id, new Set());

      socket.emit(CoordinatorWS.ServerEvents.CONNECTED, {
        socketId: socket.id,
        timestamp: new Date()
      });

      socket.on(CoordinatorWS.ClientEvents.SUBSCRIBE, (data) => {
        this.handleSubscribe(socket, data);
      });

      socket.on(CoordinatorWS.ClientEvents.UNSUBSCRIBE, (data) => {
        this.handleUnsubscribe(socket, data);
      });

      socket.on(CoordinatorWS.ClientEvents.REQUEST_CONSENSUS, async (data) => {
        await this.handleConsensusRequest(socket, data);
      });

      socket.on(CoordinatorWS.ClientEvents.PING, () => {
        socket.emit(CoordinatorWS.ServerEvents.PONG, { timestamp: new Date() });
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      const status = elderCoordinator.getStatus();
      socket.emit(CoordinatorWS.ServerEvents.STATUS, {
        status: status.status,
        uptime: status.coordinatorHealth.uptime,
        eldersConnected: status.coordinatorHealth.eldersConnected,
        timestamp: new Date()
      });
    });
  }

  /**
   * Setup listeners for elder events
   *
   * FIX #5: DAO-scoped events now require a daoId to route into the correct
   * per-DAO room. If the upstream event payload doesn't carry a daoId,
   * we log and skip rather than silently broadcasting to everyone.
   */
  private setupElderListeners(): void {
    elderCoordinator.on('coordinator:consensus', (consensus) => {
      this.broadcastScoped(CoordinatorWS.Topics.CONSENSUS, consensus);
    });

    elderCoordinator.on('coordinator:scry:alert', (alert) => {
      this.broadcastScoped(CoordinatorWS.Topics.SCRY_ALERT, alert);
    });

    elderCoordinator.on('coordinator:kaizen:recommendation', (recommendation) => {
      this.broadcastScoped(CoordinatorWS.Topics.KAIZEN_RECOMMENDATION, recommendation);
    });

    elderCoordinator.on('coordinator:lumen:review', (review) => {
      this.broadcastScoped(CoordinatorWS.Topics.LUMEN_REVIEW, review);
    });

    coordinatorMessageBus.on('message:published', (data) => {
      this.broadcastScoped(CoordinatorWS.Topics.MESSAGE_BUS_PUBLISHED, data);
    });

    // Global, not DAO-scoped
    coordinatorMessageBus.on('message:error', (error) => {
      this.io.to(CoordinatorWS.Rooms.topic(CoordinatorWS.Topics.MESSAGE_BUS_ERROR)).emit(
        CoordinatorWS.ServerEvents.MESSAGE_ERROR,
        { topic: CoordinatorWS.Topics.MESSAGE_BUS_ERROR, data: error, timestamp: new Date() }
      );
    });
  }

  /**
   * FIX #5: broadcast a DAO-scoped event only into that DAO's room. If the
   * event payload doesn't carry an identifiable daoId, it's logged and
   * dropped rather than fanned out globally — a missing daoId on a
   * DAO-scoped event upstream is a bug to fix at the source, not something
   * to paper over by broadcasting to everyone.
   */
  private broadcastScoped(topic: CoordinatorWS.Topic, data: any): void {
    const daoId = data?.daoId;
    if (!daoId) {
      console.warn(
        `[CoordinatorWebSocket] Dropping "${topic}" broadcast: payload has no daoId, cannot scope it safely`
      );
      return;
    }

    const room = CoordinatorWS.Rooms.forDao(topic, daoId);
    const eventName = `coordinator:${topic}`;
    this.io.to(room).emit(eventName, { topic, data, timestamp: new Date() });
    console.log(`[CoordinatorWebSocket] Broadcast to ${room}`);
  }

  /**
   * Handle subscription request
   *
   * FIX #3 + #4: topic must be one of the known enum values, and DAO-scoped
   * topics require the user to actually belong to the daoId they're asking
   * to subscribe to (or be a superuser) — mirroring handleConsensusRequest's
   * existing check for direct requests.
   */
  private handleSubscribe(socket: Socket, data: { topic: string; daoId?: string }): void {
    const { topic, daoId } = data || ({} as any);
    const user = socket.data.user;

    const isKnownTopic = (Object.values(CoordinatorWS.Topics) as string[]).includes(topic);
    if (!isKnownTopic) {
      socket.emit(CoordinatorWS.ServerEvents.ERROR, {
        error: `Unknown topic: ${topic}`,
        timestamp: new Date()
      });
      return;
    }

    const isDaoScoped = (CoordinatorWS.DAO_SCOPED_TOPICS as string[]).includes(topic);

    let room: string;
    if (isDaoScoped) {
      if (!daoId) {
        socket.emit(CoordinatorWS.ServerEvents.ERROR, {
          error: `Topic "${topic}" requires a daoId`,
          timestamp: new Date()
        });
        return;
      }
      if (!user?.daos?.includes(daoId) && !user?.isSuperuser) {
        socket.emit(CoordinatorWS.ServerEvents.ERROR, {
          error: `Unauthorized to subscribe to "${topic}" for this DAO`,
          timestamp: new Date()
        });
        return;
      }
      room = CoordinatorWS.Rooms.forDao(topic as CoordinatorWS.Topic, daoId);
    } else {
      room = CoordinatorWS.Rooms.topic(topic as CoordinatorWS.Topic);
    }

    const subscriptions = this.clientSubscriptions.get(socket.id) || new Set();
    subscriptions.add(room);
    this.clientSubscriptions.set(socket.id, subscriptions);

    console.log(`[CoordinatorWebSocket] Client ${socket.id} subscribed to ${room}`);

    socket.emit(CoordinatorWS.ServerEvents.SUBSCRIBED, { topic, daoId, timestamp: new Date() });
    socket.join(room);
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscribe(socket: Socket, data: { topic: string; daoId?: string }): void {
    const { topic, daoId } = data || ({} as any);
    const isDaoScoped = (CoordinatorWS.DAO_SCOPED_TOPICS as string[]).includes(topic);
    const room = isDaoScoped && daoId
      ? CoordinatorWS.Rooms.forDao(topic as CoordinatorWS.Topic, daoId)
      : CoordinatorWS.Rooms.topic(topic as CoordinatorWS.Topic);

    const subscriptions = this.clientSubscriptions.get(socket.id);
    if (subscriptions) {
      subscriptions.delete(room);
    }

    socket.emit(CoordinatorWS.ServerEvents.UNSUBSCRIBED, { topic, daoId, timestamp: new Date() });
    socket.leave(room);
  }

  /**
   * Handle consensus request
   */
  private async handleConsensusRequest(socket: Socket, data: { daoId: string; proposalId: string }): Promise<void> {
    try {
      const { daoId, proposalId } = data;
      const user = socket.data.user;

      if (!user.daos?.includes(daoId) && !user.isSuperuser) {
        socket.emit(CoordinatorWS.ServerEvents.ERROR, {
          error: 'Unauthorized to access this DAO',
          timestamp: new Date()
        });
        return;
      }

      const consensus = await elderCoordinator.getElderConsensus(daoId, { proposalId });

      socket.emit(CoordinatorWS.ServerEvents.CONSENSUS_RESPONSE, {
        success: true,
        data: consensus,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit(CoordinatorWS.ServerEvents.ERROR, {
        error: (error as Error).message,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const userId = socket.data.user?.userId;
    console.log(`[CoordinatorWebSocket] Client disconnected: ${socket.id} (${userId})`);

    this.clientSubscriptions.delete(socket.id);
    this.connectedClients.delete(socket.id);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastAll(event: string, data: any): void {
    this.io.emit(event, { data, timestamp: new Date() });
  }

  /**
   * Send message to specific socket
   */
  sendToSocket(socketId: string, event: string, data: any): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, { data, timestamp: new Date() });
    }
  }

  getConnectedCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Get subscription stats
   */
  getSubscriptionStats(): {
    totalClients: number;
    totalSubscriptions: number;
    byRoom: Record<string, number>;
  } {
    const byRoom: Record<string, number> = {};
    let totalSubscriptions = 0;

    this.clientSubscriptions.forEach(rooms => {
      rooms.forEach(room => {
        byRoom[room] = (byRoom[room] || 0) + 1;
        totalSubscriptions++;
      });
    });

    return {
      totalClients: this.io.sockets.sockets.size,
      totalSubscriptions,
      byRoom
    };
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    console.log('[CoordinatorWebSocket] Shutting down WebSocket handler');
    this.io.disconnectSockets();
    this.io.close();
    this.clientSubscriptions.clear();
    this.connectedClients.clear();
  }
}

// Singleton instance
let wsHandler: CoordinatorWebSocketHandler;

export function createCoordinatorWebSocketHandler(httpServer: HTTPServer): CoordinatorWebSocketHandler {
  wsHandler = new CoordinatorWebSocketHandler(httpServer);
  return wsHandler;
}

export function getCoordinatorWebSocketHandler(): CoordinatorWebSocketHandler {
  if (!wsHandler) {
    throw new Error('WebSocket handler not initialized');
  }
  return wsHandler;
}