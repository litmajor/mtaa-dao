/**
 * Coordinator WebSocket Handler
 * 
 * Enables real-time communication updates when elders communicate
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { elderCoordinator } from '../core/elders/coordinator';
import { coordinatorMessageBus } from '../core/elders/coordinator/message-bus';

export class CoordinatorWebSocketHandler {
  private io: SocketIOServer;
  private clientSubscriptions: Map<string, Set<string>> = new Map(); // socket.id -> topics
  private connectedClients: Map<string, any> = new Map(); // socket.id -> user

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const user = jwt.verify(token, secret) as any;
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
      
      // Track connected client
      this.connectedClients.set(socket.id, socket.data.user);
      this.clientSubscriptions.set(socket.id, new Set());

      // Send welcome message
      socket.emit('coordinator:connected', {
        socketId: socket.id,
        timestamp: new Date()
      });

      // Handle subscription requests
      socket.on('coordinator:subscribe', (data) => {
        this.handleSubscribe(socket, data);
      });

      // Handle unsubscription requests
      socket.on('coordinator:unsubscribe', (data) => {
        this.handleUnsubscribe(socket, data);
      });

      // Handle consensus request
      socket.on('coordinator:request-consensus', async (data) => {
        await this.handleConsensusRequest(socket, data);
      });

      // Handle heartbeat
      socket.on('coordinator:ping', () => {
        socket.emit('coordinator:pong', { timestamp: new Date() });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Send initial coordinator status
      const status = elderCoordinator.getStatus();
      socket.emit('coordinator:status', {
        status: status.status,
        uptime: status.coordinatorHealth.uptime,
        eldersConnected: status.coordinatorHealth.eldersConnected,
        timestamp: new Date()
      });
    });
  }

  /**
   * Setup listeners for elder events
   */
  private setupElderListeners(): void {
    // Listen for coordinator events
    elderCoordinator.on('coordinator:consensus', (consensus) => {
      this.broadcastToSubscribers('coordinator:consensus', consensus);
    });

    elderCoordinator.on('coordinator:scry:alert', (alert) => {
      this.broadcastToSubscribers('coordinator:scry-alert', alert);
    });

    elderCoordinator.on('coordinator:kaizen:recommendation', (recommendation) => {
      this.broadcastToSubscribers('coordinator:kaizen-recommendation', recommendation);
    });

    elderCoordinator.on('coordinator:lumen:review', (review) => {
      this.broadcastToSubscribers('coordinator:lumen-review', review);
    });

    // Listen for message bus events
    coordinatorMessageBus.on('message:published', (data) => {
      this.broadcastToSubscribers('message-bus:message-published', data);
    });

    coordinatorMessageBus.on('message:error', (error) => {
      this.broadcastToSubscribers('message-bus:error', error);
    });
  }

  /**
   * Handle subscription request
   */
  private handleSubscribe(socket: Socket, data: { topic: string }): void {
    const { topic } = data;
    const subscriptions = this.clientSubscriptions.get(socket.id) || new Set();
    
    subscriptions.add(topic);
    this.clientSubscriptions.set(socket.id, subscriptions);

    console.log(`[CoordinatorWebSocket] Client ${socket.id} subscribed to ${topic}`);

    socket.emit('coordinator:subscribed', {
      topic,
      timestamp: new Date()
    });

    // Join socket.io room for this topic
    socket.join(`coordinator:${topic}`);
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscribe(socket: Socket, data: { topic: string }): void {
    const { topic } = data;
    const subscriptions = this.clientSubscriptions.get(socket.id);
    
    if (subscriptions) {
      subscriptions.delete(topic);
    }

    socket.emit('coordinator:unsubscribed', {
      topic,
      timestamp: new Date()
    });

    // Leave socket.io room
    socket.leave(`coordinator:${topic}`);
  }

  /**
   * Handle consensus request
   */
  private async handleConsensusRequest(socket: Socket, data: { daoId: string; proposalId: string }): Promise<void> {
    try {
      const { daoId, proposalId } = data;
      const user = socket.data.user;

      // Verify user has access to DAO
      if (!user.daos?.includes(daoId) && !user.isSuperuser) {
        socket.emit('coordinator:error', {
          error: 'Unauthorized to access this DAO',
          timestamp: new Date()
        });
        return;
      }

      // Request consensus
      const consensus = await elderCoordinator.getElderConsensus(daoId, { proposalId });

      socket.emit('coordinator:consensus-response', {
        success: true,
        data: consensus,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('coordinator:error', {
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

    // Cleanup
    this.clientSubscriptions.delete(socket.id);
    this.connectedClients.delete(socket.id);
  }

  /**
   * Broadcast message to all subscribers of a topic
   */
  private broadcastToSubscribers(topic: string, data: any): void {
    const room = `coordinator:${topic}`;
    const message = {
      topic,
      data,
      timestamp: new Date()
    };

    this.io.to(room).emit(topic, message);

    console.log(`[CoordinatorWebSocket] Broadcast to ${room}`);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastAll(event: string, data: any): void {
    this.io.emit(event, {
      data,
      timestamp: new Date()
    });
  }

  /**
   * Send message to specific socket
   */
  sendToSocket(socketId: string, event: string, data: any): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, {
        data,
        timestamp: new Date()
      });
    }
  }

  /**
   * Get connected clients count
   */
  getConnectedCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Get subscription stats
   */
  getSubscriptionStats(): {
    totalClients: number;
    totalSubscriptions: number;
    byTopic: Record<string, number>;
  } {
    const byTopic: Record<string, number> = {};
    let totalSubscriptions = 0;

    this.clientSubscriptions.forEach(topics => {
      topics.forEach(topic => {
        byTopic[topic] = (byTopic[topic] || 0) + 1;
        totalSubscriptions++;
      });
    });

    return {
      totalClients: this.io.sockets.sockets.size,
      totalSubscriptions,
      byTopic
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
