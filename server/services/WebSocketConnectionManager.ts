/**
 * WebSocket Connection Manager
 * Manages per-user connection limits, graceful reconnection, and stability
 * 
 * Features:
 * - Max connections per user (prevents memory exhaustion)
 * - Subscription filtering (only send relevant data)
 * - Dead connection detection and cleanup
 * - Exponential backoff reconnection logic
 * - Memory/CPU monitoring and alerting
 */

import { WebSocket } from 'ws';
import { logger } from '../utils/logger';

interface WsClient {
  id: string;                    // Unique connection ID
  userId: string;
  subscriptions: Set<string>;    // What this client is subscribed to (e.g., 'BTCUSDT', 'portfolio')
  ws: WebSocket;
  connectedAt: Date;
  lastHeartbeat: Date;
  reconnectAttempts: number;
  isAlive: boolean;
  messageCount: number;          // For monitoring
}

interface WsStats {
  totalConnections: number;
  connectionsByUser: Map<string, number>;
  totalMessages: number;
  messagesByType: Map<string, number>;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  deadConnections: number;
  subscriptionBreakdown: Map<string, number>;
}

export class WebSocketConnectionManager {
  private clients: Map<string, WsClient> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();  // userId -> connectionIds
  private subscriptionClients: Map<string, Set<string>> = new Map(); // subscription -> connectionIds
  
  // Configuration
  private readonly MAX_CONNECTIONS_PER_USER = 5;  // Max 5 concurrent connections per user
  private readonly HEARTBEAT_INTERVAL = 30000;    // 30 seconds
  private readonly HEARTBEAT_TIMEOUT = 60000;     // 60 second timeout
  private readonly RECONNECT_BASE_DELAY = 1000;   // 1 second base delay
  private readonly RECONNECT_MAX_DELAY = 30000;   // 30 second max delay
  private readonly MESSAGE_CACHE_TTL = 5000;      // 5 second cache for frequent messages
  
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private stats: WsStats = {
    totalConnections: 0,
    connectionsByUser: new Map(),
    totalMessages: 0,
    messagesByType: new Map(),
    memoryUsageMB: 0,
    cpuUsagePercent: 0,
    deadConnections: 0,
    subscriptionBreakdown: new Map()
  };
  
  private messageCache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor() {
    this.startHeartbeat();
    this.startMonitoring();
  }

  /**
   * Register a new WebSocket connection
   */
  public registerConnection(
    ws: WebSocket,
    userId: string,
    subscriptions: string[] = []
  ): { connectionId: string; error?: string } {
    // Check per-user connection limit
    const userConnCount = this.userConnections.get(userId)?.size || 0;
    if (userConnCount >= this.MAX_CONNECTIONS_PER_USER) {
      logger.warn(`[WebSocket] User ${userId} exceeded max connections (${this.MAX_CONNECTIONS_PER_USER})`);
      return {
        connectionId: '',
        error: `Maximum ${this.MAX_CONNECTIONS_PER_USER} connections allowed per user`
      };
    }

    // Create unique connection ID
    const connectionId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create client object
    const client: WsClient = {
      id: connectionId,
      userId,
      subscriptions: new Set(subscriptions),
      ws,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      reconnectAttempts: 0,
      isAlive: true,
      messageCount: 0
    };

    // Store connection
    this.clients.set(connectionId, client);

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // Track subscriptions
    subscriptions.forEach(sub => {
      if (!this.subscriptionClients.has(sub)) {
        this.subscriptionClients.set(sub, new Set());
      }
      this.subscriptionClients.get(sub)!.add(connectionId);
    });

    // Update stats
    this.stats.totalConnections++;
    this.stats.connectionsByUser.set(userId, userConnCount + 1);
    subscriptions.forEach(sub => {
      const current = this.stats.subscriptionBreakdown.get(sub) || 0;
      this.stats.subscriptionBreakdown.set(sub, current + 1);
    });

    logger.info(`[WebSocket] Connected ${connectionId} for user ${userId}`, {
      subscriptions: subscriptions.length,
      userConnections: userConnCount + 1
    });

    return { connectionId };
  }

  /**
   * Unregister a WebSocket connection
   */
  public unregisterConnection(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (!client) return;

    // Remove from subscribers
    client.subscriptions.forEach(sub => {
      this.subscriptionClients.get(sub)?.delete(connectionId);
      const subCount = this.subscriptionClients.get(sub)?.size || 0;
      if (subCount > 0) {
        this.stats.subscriptionBreakdown.set(sub, subCount);
      } else {
        this.stats.subscriptionBreakdown.delete(sub);
      }
    });

    // Remove from user connections
    const userConns = this.userConnections.get(client.userId);
    if (userConns) {
      userConns.delete(connectionId);
      if (userConns.size > 0) {
        this.stats.connectionsByUser.set(client.userId, userConns.size);
      } else {
        this.stats.connectionsByUser.delete(client.userId);
      }
    }

    // Remove client
    this.clients.delete(connectionId);
    this.stats.totalConnections--;

    logger.info(`[WebSocket] Disconnected ${connectionId}`, {
      totalConnections: this.stats.totalConnections
    });
  }

  /**
   * Update subscriptions for a connection
   */
  public updateSubscriptions(connectionId: string, subscriptions: string[]): boolean {
    const client = this.clients.get(connectionId);
    if (!client) return false;

    // Remove from old subscriptions
    client.subscriptions.forEach(sub => {
      this.subscriptionClients.get(sub)?.delete(connectionId);
    });

    // Add to new subscriptions
    client.subscriptions.clear();
    subscriptions.forEach(sub => {
      client.subscriptions.add(sub);
      if (!this.subscriptionClients.has(sub)) {
        this.subscriptionClients.set(sub, new Set());
      }
      this.subscriptionClients.get(sub)!.add(connectionId);
    });

    logger.debug(`[WebSocket] Updated subscriptions for ${connectionId}`, {
      subscriptions: subscriptions.length
    });

    return true;
  }

  /**
   * Send message to specific subscriptions (only to subscribed clients)
   */
  public broadcastToSubscription(subscription: string, message: any): number {
    const connectionIds = this.subscriptionClients.get(subscription) || new Set();
    let sentCount = 0;

    connectionIds.forEach(connectionId => {
      const client = this.clients.get(connectionId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
          client.messageCount++;
          sentCount++;
        } catch (error) {
          logger.warn(`[WebSocket] Failed to send to ${connectionId}:`, error);
          this.markConnectionDead(connectionId);
        }
      }
    });

    // Update stats
    this.stats.totalMessages++;
    const msgType = message.type || 'unknown';
    const current = this.stats.messagesByType.get(msgType) || 0;
    this.stats.messagesByType.set(msgType, current + 1);

    return sentCount;
  }

  /**
   * Send message to specific user (all their connections)
   */
  public sendToUser(userId: string, message: any): number {
    const connectionIds = this.userConnections.get(userId) || new Set();
    let sentCount = 0;

    connectionIds.forEach(connectionId => {
      const client = this.clients.get(connectionId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
          client.messageCount++;
          sentCount++;
        } catch (error) {
          logger.warn(`[WebSocket] Failed to send to user ${userId}:`, error);
          this.markConnectionDead(connectionId);
        }
      }
    });

    return sentCount;
  }

  /**
   * Handle heartbeat response
   */
  public handlePong(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (client) {
      client.isAlive = true;
      client.lastHeartbeat = new Date();
      client.reconnectAttempts = 0;
    }
  }

  /**
   * Mark connection as dead (will be cleaned up)
   */
  private markConnectionDead(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (client) {
      client.isAlive = false;
      this.stats.deadConnections++;
    }
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, connectionId) => {
        // Check if connection is dead
        const timeSinceLastHeartbeat = Date.now() - client.lastHeartbeat.getTime();
        if (timeSinceLastHeartbeat > this.HEARTBEAT_TIMEOUT) {
          logger.warn(`[WebSocket] Connection ${connectionId} timeout, terminating`);
          try {
            client.ws.terminate();
          } catch (error) {
            logger.error('Error terminating connection:', error);
          }
          this.unregisterConnection(connectionId);
          return;
        }

        // Send ping
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.isAlive = false;
            client.ws.ping();
          } catch (error) {
            logger.warn(`[WebSocket] Error sending ping to ${connectionId}:`, error);
            this.markConnectionDead(connectionId);
          }
        }
      });

      // Cleanup properly closed connections
      this.clients.forEach((client, connectionId) => {
        if (client.ws.readyState === WebSocket.CLOSED) {
          this.unregisterConnection(connectionId);
        }
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Start resource monitoring
   */
  private startMonitoring(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.stats.memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      // Alert on high memory usage
      if (this.stats.memoryUsageMB > 500) {
        logger.warn(`[WebSocket] High memory usage: ${this.stats.memoryUsageMB}MB`, {
          connections: this.stats.totalConnections,
          deadConnections: this.stats.deadConnections
        });
      }

      // Alert on many dead connections
      if (this.stats.deadConnections > 10) {
        logger.warn(`[WebSocket] ${this.stats.deadConnections} dead connections detected`, {
          totalConnections: this.stats.totalConnections
        });
        // Aggressively cleanup dead connections
        this.clients.forEach((client, connectionId) => {
          if (!client.isAlive || client.ws.readyState !== WebSocket.OPEN) {
            this.unregisterConnection(connectionId);
          }
        });
        this.stats.deadConnections = 0;
      }
    }, 60000); // Check every minute
  }

  /**
   * Calculate reconnection delay with exponential backoff
   */
  public getReconnectDelay(reconnectAttempts: number): number {
    const delayMs = Math.min(
      this.RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts),
      this.RECONNECT_MAX_DELAY
    );
    // Add jitter (±20%)
    return delayMs * (0.8 + Math.random() * 0.4);
  }

  /**
   * Cache a message to reduce recomputation
   */
  public cacheMessage(key: string, data: any): void {
    this.messageCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached message if still valid
   */
  public getCachedMessage(key: string): any | null {
    const cached = this.messageCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.MESSAGE_CACHE_TTL) {
      this.messageCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Get current statistics
   */
  public getStats(): WsStats {
    return {
      ...this.stats,
      connectionsByUser: new Map(this.stats.connectionsByUser),
      messagesByType: new Map(this.stats.messagesByType),
      subscriptionBreakdown: new Map(this.stats.subscriptionBreakdown)
    };
  }

  /**
   * Cleanup and shutdown
   */
  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.clients.forEach((client) => {
      try {
        client.ws.close();
      } catch (error) {
        logger.error('Error closing WebSocket:', error);
      }
    });
    this.clients.clear();
    logger.info('[WebSocket] Connection manager shutdown complete');
  }
}

export const wsConnectionManager = new WebSocketConnectionManager();
