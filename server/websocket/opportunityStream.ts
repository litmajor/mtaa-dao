/**
 * Opportunity Stream WebSocket Handler
 * 
 * Broadcasts real-time opportunities to connected clients
 */

import WebSocket, { WebSocketServer } from 'ws';
import { Server as HTTPServer } from 'http';
import { opportunityEngine, OpportunityData } from '../services/opportunityEngine';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Type Definitions
 */
interface ClientConnection {
  id: string;
  socket: WebSocket;
  isAlive: boolean;
  subscribedTypes: Set<'arbitrage' | 'dex-spread' | 'emerging-token'>;
  minProfitFilter?: number;
}

/**
 * Opportunity Stream WebSocket Server
 */
class OpportunityStreamServer {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, ClientConnection>();
  private lastOpportunities: OpportunityData[] = [];
  private isInitialized = false;

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    if (this.isInitialized) {
      logger.warn('OpportunityStreamServer already initialized');
      return;
    }

    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/api/opportunities-stream'
    });

    this.wss.on('connection', (socket: WebSocket) => {
      this.handleNewClient(socket);
    });

    // Register for opportunity updates
    opportunityEngine.onOpportunitiesFound((opportunities: OpportunityData[]) => {
      this.lastOpportunities = opportunities;
      this.broadcastToClients({
        type: 'opportunities',
        data: opportunities,
        timestamp: Date.now()
      });
    });

    // Heartbeat to detect stale connections
    setInterval(() => {
      this.wss?.clients.forEach((socket: WebSocket) => {
        const client = Array.from(this.clients.values()).find(c => c.socket === socket);
        if (!client) return;

        if (!client.isAlive) {
          socket.terminate();
          return;
        }

        client.isAlive = false;
        socket.ping();
      });
    }, 30000); // 30 seconds

    this.isInitialized = true;
    logger.info('OpportunityStreamServer initialized');
  }

  /**
   * Handle new WebSocket client
   */
  private handleNewClient(socket: WebSocket): void {
    const clientId = uuidv4();
    const client: ClientConnection = {
      id: clientId,
      socket,
      isAlive: true,
      subscribedTypes: new Set(['arbitrage', 'dex-spread', 'emerging-token']),
      minProfitFilter: 0.5
    };

    this.clients.set(clientId, client);
    logger.info(`Opportunity stream client connected: ${clientId}`);

    // Send initial connection confirmation
    socket.send(JSON.stringify({
      type: 'connected',
      clientId,
      message: 'Connected to opportunity stream',
      timestamp: Date.now()
    }));

    // Send recent opportunities
    if (this.lastOpportunities.length > 0) {
      socket.send(JSON.stringify({
        type: 'opportunities',
        data: this.lastOpportunities,
        timestamp: Date.now()
      }));
    }

    // Handle incoming messages
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(clientId, message);
      } catch (error) {
        logger.error(`Error parsing opportunity stream message from ${clientId}:`, error);
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: Date.now()
        }));
      }
    });

    // Handle pong
    socket.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.isAlive = true;
      }
    });

    // Handle client disconnect
    socket.on('close', () => {
      this.clients.delete(clientId);
      logger.info(`Opportunity stream client disconnected: ${clientId}`);
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
    });
  }

  /**
   * Handle incoming client messages
   */
  private handleClientMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { type, payload } = message;

    switch (type) {
      case 'subscribe':
        this.handleSubscribe(client, payload);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(client, payload);
        break;

      case 'set-filter':
        this.handleSetFilter(client, payload);
        break;

      case 'get-status':
        this.handleGetStatus(client);
        break;

      case 'ping':
        client.socket.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now()
        }));
        break;

      default:
        logger.warn(`Unknown message type from ${clientId}: ${type}`);
    }
  }

  /**
   * Handle subscribe message
   */
  private handleSubscribe(client: ClientConnection, payload: any): void {
    const { types } = payload;
    if (Array.isArray(types)) {
      types.forEach((type: string) => {
        if (['arbitrage', 'dex-spread', 'emerging-token'].includes(type)) {
          client.subscribedTypes.add(type as 'arbitrage' | 'dex-spread' | 'emerging-token');
        }
      });
    }

    client.socket.send(JSON.stringify({
      type: 'subscribed',
      subscribedTypes: Array.from(client.subscribedTypes),
      timestamp: Date.now()
    }));

    logger.debug(`Client ${client.id} subscribed to: ${Array.from(client.subscribedTypes).join(', ')}`);
  }

  /**
   * Handle unsubscribe message
   */
  private handleUnsubscribe(client: ClientConnection, payload: any): void {
    const { types } = payload;
    if (Array.isArray(types)) {
      types.forEach((type: string) => {
        client.subscribedTypes.delete(type as 'arbitrage' | 'dex-spread' | 'emerging-token');
      });
    }

    client.socket.send(JSON.stringify({
      type: 'unsubscribed',
      subscribedTypes: Array.from(client.subscribedTypes),
      timestamp: Date.now()
    }));

    logger.debug(`Client ${client.id} unsubscribed from: ${Array.from(client.subscribedTypes).join(', ')}`);
  }

  /**
   * Handle set filter message
   */
  private handleSetFilter(client: ClientConnection, payload: any): void {
    const { minProfitPercent } = payload;
    if (typeof minProfitPercent === 'number' && minProfitPercent >= 0) {
      client.minProfitFilter = minProfitPercent;
      client.socket.send(JSON.stringify({
        type: 'filter-updated',
        minProfitPercent,
        timestamp: Date.now()
      }));
      logger.debug(`Client ${client.id} filter updated to ${minProfitPercent}%`);
    }
  }

  /**
   * Handle get status message
   */
  private handleGetStatus(client: ClientConnection): void {
    const engineStatus = opportunityEngine.getStatus();
    client.socket.send(JSON.stringify({
      type: 'status',
      engine: engineStatus,
      connectedClients: this.clients.size,
      lastOpportunitiesCount: this.lastOpportunities.length,
      timestamp: Date.now()
    }));
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcastToClients(message: any): void {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((client: ClientConnection) => {
      // Filter opportunities based on client preferences
      if (message.type === 'opportunities' && message.data) {
        const filtered = message.data.filter((opp: OpportunityData) => {
          // Check type subscription
          if (!client.subscribedTypes.has(opp.type)) {
            return false;
          }

          // Check profit filter
          if (opp.profitPercent < (client.minProfitFilter || 0)) {
            return false;
          }

          return true;
        });

        if (filtered.length === 0) {
          return; // Don't send empty updates
        }

        client.socket.send(JSON.stringify({
          type: 'opportunities',
          data: filtered,
          timestamp: Date.now()
        }));
      } else {
        // Send other messages as-is
        client.socket.send(messageStr);
      }
    });
  }

  /**
   * Get server status
   */
  getStatus(): {
    isInitialized: boolean;
    connectedClients: number;
    lastOpportunitiesCount: number;
  } {
    return {
      isInitialized: this.isInitialized,
      connectedClients: this.clients.size,
      lastOpportunitiesCount: this.lastOpportunities.length
    };
  }

  /**
   * Shutdown server
   */
  shutdown(): void {
    if (this.wss) {
      this.wss.close();
      this.clients.clear();
      this.isInitialized = false;
      logger.info('OpportunityStreamServer shut down');
    }
  }
}

// Export singleton
export const opportunityStream = new OpportunityStreamServer();
