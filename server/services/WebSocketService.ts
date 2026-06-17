import { WebSocketServer, WebSocket } from 'ws';
import { freemem } from 'os';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';
import { wsConnectionManager } from './WebSocketConnectionManager';
import { wsHealthMonitor } from './WebSocketHealthMonitor';
import { WebSocketMessageBatcher } from './WebSocketMessageBatcher';

interface TypingStatus {
  daoId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

interface PresenceStatus {
  daoId: string;
  userId: string;
  userName: string;
  status: 'online' | 'offline' | 'away';
}

interface DaoClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  daoIds: Set<string>;
  isAlive: boolean;
}

interface ConnectionMetadata {
  connectionId: string;
  userId: string;
  userName: string;
  subscriptions: string[];
}

export class WebSocketService {
  // Send a message to a specific user by userId
  public sendToUser(userId: string, message: any) {
    const sentCount = wsConnectionManager.sendToUser(userId, message);
    if (sentCount === 0) {
      logger.info(`[WebSocketService] No active socket for user ${userId}. Message:`, message);
    }
  }
  
  private static instance: WebSocketService | null = null;
  private static server: HttpServer | null = null;
  private wss: WebSocketServer;
  private clients: Map<WebSocket, DaoClient> = new Map();
  private connectionMetadata: Map<WebSocket, ConnectionMetadata> = new Map();
  private typingUsers: Map<string, Set<string>> = new Map();
  private onlineUsers: Map<string, Set<string>> = new Map();
  private heartbeatInterval!: NodeJS.Timeout;
  private messageBatcher: WebSocketMessageBatcher;
  
  // Track connections for monitoring
  private connectionStartTime: Date = new Date();

  private constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/realtime' // Use specific path to avoid conflicts with Vite HMR
    });
    this.messageBatcher = new WebSocketMessageBatcher();
    WebSocketService.server = server;
    
    // Setup message batching for common message types
    this.messageBatcher.registerBatch('price_update', {
      maxSize: 50,
      maxWaitMs: 50,
      handler: (batch) => {
        this.broadcastBatchedPriceUpdates(batch);
      }
    });
    
    this.messageBatcher.registerBatch('trade_update', {
      maxSize: 30,
      maxWaitMs: 100,
      handler: (batch) => {
        this.broadcastBatchedTradeUpdates(batch);
      }
    });
    
    this.setupWebSocket();
    this.startHeartbeat();
  }

  public static getInstance(server?: HttpServer): WebSocketService {
    if (!WebSocketService.instance) {
      if (!server) {
        throw new Error('WebSocketService not initialized: server required for first call');
      }
      WebSocketService.instance = new WebSocketService(server);
    }
    return WebSocketService.instance;
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('WebSocket client connected');
      
      // Don't register with connection manager yet - wait for init message
      // This prevents empty connections from taking slots
      
      const client: DaoClient = {
        ws,
        userId: '',
        userName: '',
        daoIds: new Set(),
        isAlive: true
      };
      this.clients.set(ws, client);
      
      ws.on('message', (data: WebSocket.RawData) => {
        try {
          this.handleMessage(ws, data.toString());
        } catch (error) {
          this.handleError(ws, error as Error);
        }
      });
      
      ws.on('close', () => this.handleDisconnect(ws));
      ws.on('error', (error: Error) => this.handleError(ws, error));
      ws.on('pong', () => this.handlePong(ws));
    });
  }

  private handleMessage(ws: WebSocket, message: string) {
    try {
      const data = JSON.parse(message);
      switch (data.type) {
        case 'init':
          this.handleInit(ws, data.data);
          break;
        case 'typing':
          this.handleTyping(ws, data.data);
          break;
        case 'presence':
          this.handlePresence(ws, data.data);
          break;
      }
    } catch (error) {
      logger.error('Error handling WebSocket message:', error);
    }
  }

  private handleInit(ws: WebSocket, data: { userId: string; userName?: string; daoIds: string[] }) {
    // Try to register connection with limit checking
    const registration = wsConnectionManager.registerConnection(
      ws,
      data.userId,
      data.daoIds
    );
    
    if (registration.error) {
      logger.warn(`[WebSocketService] Connection rejected: ${registration.error}`);
      ws.send(JSON.stringify({
        type: 'init_error',
        error: registration.error,
        retryAfter: wsConnectionManager['getReconnectDelay'](3) // Suggest retry delay
      }));
      ws.close(1008, 'Max connections reached');
      return;
    }

    const client: DaoClient = {
      ws,
      userId: data.userId,
      userName: data.userName || 'Anonymous',
      daoIds: new Set(data.daoIds),
      isAlive: true
    };
    this.clients.set(ws, client);
    
    // Store connection metadata for filtering
    this.connectionMetadata.set(ws, {
      connectionId: registration.connectionId,
      userId: data.userId,
      userName: data.userName || 'Anonymous',
      subscriptions: data.daoIds
    });

    data.daoIds.forEach(daoId => {
      if (!this.onlineUsers.has(daoId)) {
        this.onlineUsers.set(daoId, new Set());
      }
      this.onlineUsers.get(daoId)!.add(data.userId);
      this.broadcastPresence(daoId);
    });
    
    logger.info(`[WebSocketService] User ${data.userId} initialized with ${data.daoIds.length} DAOs`, {
      connectionId: registration.connectionId
    });
  }

  private handleTyping(ws: WebSocket, data: TypingStatus) {
    const client = this.clients.get(ws);
    if (!client?.daoIds.has(data.daoId)) return;
    if (!this.typingUsers.has(data.daoId)) {
      this.typingUsers.set(data.daoId, new Set());
    }
    const typingSet = this.typingUsers.get(data.daoId)!;
    if (data.isTyping) {
      typingSet.add(data.userId);
    } else {
      typingSet.delete(data.userId);
    }
    this.broadcastTyping(data.daoId);
  }

  private handlePresence(ws: WebSocket, data: PresenceStatus) {
    const client = this.clients.get(ws);
    if (!client?.daoIds.has(data.daoId)) return;
    if (!this.onlineUsers.has(data.daoId)) {
      this.onlineUsers.set(data.daoId, new Set());
    }
    const onlineSet = this.onlineUsers.get(data.daoId)!;
    if (data.status === 'online') {
      onlineSet.add(data.userId);
    } else {
      onlineSet.delete(data.userId);
    }
    this.broadcastPresence(data.daoId);
  }

  private handleDisconnect(ws: WebSocket) {
    const client = this.clients.get(ws);
    const metadata = this.connectionMetadata.get(ws);
    
    if (client) {
      client.daoIds.forEach(daoId => {
        this.typingUsers.get(daoId)?.delete(client.userId);
        this.onlineUsers.get(daoId)?.delete(client.userId);
        this.broadcastTyping(daoId);
        this.broadcastPresence(daoId);
      });
      this.clients.delete(ws);
    }
    
    // Unregister from connection manager
    if (metadata) {
      wsConnectionManager.unregisterConnection(metadata.connectionId);
      this.connectionMetadata.delete(ws);
      logger.info(`[WebSocketService] Disconnected ${metadata.connectionId}`);
    }
  }

  private handleError(ws: WebSocket, error: Error) {
    logger.error('WebSocket error:', error);
    const client = this.clients.get(ws);
    if (client) {
      this.handleDisconnect(ws);
    }
  }

  private handlePong(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (client) {
      client.isAlive = true;
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      // Collect stats for health monitor
      let liveConnections = 0;
      
      this.wss.clients.forEach((ws: WebSocket) => {
        const client = this.clients.get(ws);
        if (client && !client.isAlive) {
          client.ws.terminate();
          return;
        }
        if (client) {
          client.isAlive = false;
          liveConnections++;
        }
        ws.ping();
      });
      
      // Record health metrics
      wsHealthMonitor.recordMetric('avgLatency', Math.random() * 150, 'ms'); // Placeholder
      wsHealthMonitor.recordMetric('packetLoss', Math.random() * 0.5, '%');
      wsHealthMonitor.recordMetric('errorRate', Math.random() * 0.1, '%');
      wsHealthMonitor.recordMetric('memoryUsage', freemem() / 1024 / 1024, 'MB');
    }, 30000);
    
    this.wss.on('close', () => {
      clearInterval(this.heartbeatInterval);
    });
  }

  private broadcastTyping(daoId: string) {
    const message = {
      type: 'typing_update',
      data: {
        daoId,
        typingUsers: Array.from(this.typingUsers.get(daoId) || [])
      }
    };
    this.broadcast(daoId, message);
  }

  private broadcastPresence(daoId: string) {
    const message = {
      type: 'presence_update',
      data: {
        daoId,
        onlineUsers: Array.from(this.onlineUsers.get(daoId) || [])
      }
    };
    this.broadcast(daoId, message);
  }

  private broadcast(daoId: string, message: any) {
    this.clients.forEach(client => {
      if (client.daoIds.has(daoId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  public getTypingUsers(daoId: string): string[] {
    return Array.from(this.typingUsers.get(daoId) || []);
  }

  public getOnlineUsers(daoId: string): string[] {
    return Array.from(this.onlineUsers.get(daoId) || []);
  }

  /**
   * Broadcast batched price updates (efficient, reduced message count)
   */
  private broadcastBatchedPriceUpdates(batch: any) {
    const message = {
      type: 'price_updates_batch',
      data: batch.items,
      batchSize: batch.items.length,
      timestamp: new Date().toISOString()
    };
    
    // Use subscription-based filtering via connection manager
    const subscription = 'price_updates';
    wsConnectionManager.broadcastToSubscription(subscription, message);
  }

  /**
   * Broadcast batched trade updates (efficient, reduced message count)
   */
  private broadcastBatchedTradeUpdates(batch: any) {
    const message = {
      type: 'trade_updates_batch',
      data: batch.items,
      batchSize: batch.items.length,
      timestamp: new Date().toISOString()
    };
    
    const subscription = 'trade_updates';
    wsConnectionManager.broadcastToSubscription(subscription, message);
  }

  /**
   * Add message to batch for deferred sending
   */
  public addToPriceUpdateBatch(item: any): void {
    this.messageBatcher.addMessage('price_update', item);
  }

  /**
   * Add message to trade batch for deferred sending
   */
  public addToTradeUpdateBatch(item: any): void {
    this.messageBatcher.addMessage('trade_update', item);
  }

  /**
   * Get connection statistics for monitoring
   */
  public getConnectionStats() {
    return wsConnectionManager.getStats();
  }

  /**
   * Get health status
   */
  public getHealthStatus() {
    return wsHealthMonitor.getHealthStatus();
  }

  /**
   * Graceful shutdown
   */
  public shutdown(): void {
    logger.info('[WebSocketService] Starting graceful shutdown...');
    
    // Flush any pending batched messages
    this.messageBatcher.flushAll();
    
    // Close all connections gracefully
    this.wss.clients.forEach((ws: WebSocket) => {
      ws.close(1000, 'Server shutting down gracefully');
    });
    
    // Cleanup connection manager
    wsConnectionManager.shutdown();
    
    // Cleanup message batcher
    this.messageBatcher.destroy();
    
    logger.info('[WebSocketService] Graceful shutdown complete');
  }
}