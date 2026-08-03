/**
 * Opportunity Stream WebSocket Handler
 *
 * Broadcasts real-time opportunities to connected clients
 *
 * FIXES APPLIED:
 * 1. Added token-based auth on connection (query param), matching
 *    PriceStreamServer's convention. Previously this stream — which
 *    exposes live arbitrage opportunities — had no authentication at all.
 * 2. Heartbeat check now iterates `this.clients` directly instead of
 *    rebuilding an array from it and linear-scanning for every socket in
 *    `wss.clients` — was O(n^2) per tick, now O(n).
 * 3. The heartbeat interval is now stored and cleared in shutdown() —
 *    previously it ran forever even after shutdown() was called.
 */

import WebSocket, { WebSocketServer } from 'ws';
import { Server as HTTPServer } from 'http';
import { IncomingMessage } from 'http';
import { opportunityEngine, OpportunityData } from '../services/opportunityEngine';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { verifyAccessToken } from '../auth';
import { OpportunityWS } from './websocket-events';

interface ClientConnection {
  id: string;
  socket: WebSocket;
  isAlive: boolean;
  subscribedTypes: Set<OpportunityWS.OpportunityType>;
  minProfitFilter?: number;
}

class OpportunityStreamServer {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, ClientConnection>();
  private lastOpportunities: OpportunityData[] = [];
  private isInitialized = false;
  private heartbeatInterval: NodeJS.Timeout | null = null; // FIX #3

  initialize(httpServer: HTTPServer): void {
    if (this.isInitialized) {
      logger.warn('OpportunityStreamServer already initialized');
      return;
    }

    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/api/opportunities-stream',
      // FIX #1: verify auth token during the HTTP upgrade
      verifyClient: (info, callback) => this.verifyClient(info, callback),
    });

    this.wss.on('connection', (socket: WebSocket) => {
      this.handleNewClient(socket);
    });

    opportunityEngine.onOpportunitiesFound((opportunities: OpportunityData[]) => {
      this.lastOpportunities = opportunities;
      this.broadcastToClients({
        type: OpportunityWS.ServerMessageTypes.OPPORTUNITIES,
        data: opportunities,
        timestamp: Date.now()
      });
    });

    // FIX #2 + #3: iterate this.clients directly, store the interval handle
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients.values()) {
        if (!client.isAlive) {
          client.socket.terminate();
          this.clients.delete(client.id);
          continue;
        }
        client.isAlive = false;
        client.socket.ping();
      }
    }, 30000);

    this.isInitialized = true;
    logger.info('OpportunityStreamServer initialized');
  }

  /**
   * FIX #1: reject connections without a valid access token.
   */
  private verifyClient(
    info: { req: IncomingMessage },
    callback: (res: boolean, code?: number, message?: string) => void
  ): void {
    try {
      const url = new URL(info.req.url || '', 'http://localhost');
      const token = url.searchParams.get(OpportunityWS.AUTH_QUERY_PARAM);

      if (!token) {
        callback(false, 401, 'Missing auth token');
        return;
      }
      const payload = verifyAccessToken(token);
      if (!payload) {
        callback(false, 401, 'Invalid or expired token');
        return;
      }
      callback(true);
    } catch (error: any) {
      logger.warn('Opportunity stream auth verification failed:', error.message);
      callback(false, 401, 'Authentication error');
    }
  }

  private handleNewClient(socket: WebSocket): void {
    const clientId = uuidv4();
    const client: ClientConnection = {
      id: clientId,
      socket,
      isAlive: true,
      subscribedTypes: new Set(OpportunityWS.OpportunityTypes),
      minProfitFilter: 0.5
    };

    this.clients.set(clientId, client);
    logger.info(`Opportunity stream client connected: ${clientId}`);

    socket.send(JSON.stringify({
      type: OpportunityWS.ServerMessageTypes.CONNECTED,
      clientId,
      message: 'Connected to opportunity stream',
      timestamp: Date.now()
    }));

    if (this.lastOpportunities.length > 0) {
      socket.send(JSON.stringify({
        type: OpportunityWS.ServerMessageTypes.OPPORTUNITIES,
        data: this.lastOpportunities,
        timestamp: Date.now()
      }));
    }

    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(clientId, message);
      } catch (error) {
        logger.error(`Error parsing opportunity stream message from ${clientId}:`, error);
        socket.send(JSON.stringify({
          type: OpportunityWS.ServerMessageTypes.ERROR,
          message: 'Invalid message format',
          timestamp: Date.now()
        }));
      }
    });

    socket.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) client.isAlive = true;
    });

    socket.on('close', () => {
      this.clients.delete(clientId);
      logger.info(`Opportunity stream client disconnected: ${clientId}`);
    });

    socket.on('error', (error: Error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
    });
  }

  private handleClientMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { type, payload } = message;

    switch (type) {
      case OpportunityWS.ClientMessageTypes.SUBSCRIBE:
        this.handleSubscribe(client, payload);
        break;
      case OpportunityWS.ClientMessageTypes.UNSUBSCRIBE:
        this.handleUnsubscribe(client, payload);
        break;
      case OpportunityWS.ClientMessageTypes.SET_FILTER:
        this.handleSetFilter(client, payload);
        break;
      case OpportunityWS.ClientMessageTypes.GET_STATUS:
        this.handleGetStatus(client);
        break;
      case OpportunityWS.ClientMessageTypes.PING:
        client.socket.send(JSON.stringify({ type: OpportunityWS.ServerMessageTypes.PONG, timestamp: Date.now() }));
        break;
      default:
        logger.warn(`Unknown message type from ${clientId}: ${type}`);
    }
  }

  private handleSubscribe(client: ClientConnection, payload: any): void {
    const { types } = payload || {};
    if (Array.isArray(types)) {
      types.forEach((type: string) => {
        if ((OpportunityWS.OpportunityTypes as readonly string[]).includes(type)) {
          client.subscribedTypes.add(type as OpportunityWS.OpportunityType);
        }
      });
    }

    client.socket.send(JSON.stringify({
      type: OpportunityWS.ServerMessageTypes.SUBSCRIBED,
      subscribedTypes: Array.from(client.subscribedTypes),
      timestamp: Date.now()
    }));

    logger.debug(`Client ${client.id} subscribed to: ${Array.from(client.subscribedTypes).join(', ')}`);
  }

  private handleUnsubscribe(client: ClientConnection, payload: any): void {
    const { types } = payload || {};
    if (Array.isArray(types)) {
      types.forEach((type: string) => {
        client.subscribedTypes.delete(type as OpportunityWS.OpportunityType);
      });
    }

    client.socket.send(JSON.stringify({
      type: OpportunityWS.ServerMessageTypes.UNSUBSCRIBED,
      subscribedTypes: Array.from(client.subscribedTypes),
      timestamp: Date.now()
    }));

    logger.debug(`Client ${client.id} unsubscribed from: ${Array.from(client.subscribedTypes).join(', ')}`);
  }

  private handleSetFilter(client: ClientConnection, payload: any): void {
    const { minProfitPercent } = payload || {};
    if (typeof minProfitPercent === 'number' && minProfitPercent >= 0) {
      client.minProfitFilter = minProfitPercent;
      client.socket.send(JSON.stringify({
        type: OpportunityWS.ServerMessageTypes.FILTER_UPDATED,
        minProfitPercent,
        timestamp: Date.now()
      }));
      logger.debug(`Client ${client.id} filter updated to ${minProfitPercent}%`);
    }
  }

  private handleGetStatus(client: ClientConnection): void {
    const engineStatus = opportunityEngine.getStatus();
    client.socket.send(JSON.stringify({
      type: OpportunityWS.ServerMessageTypes.STATUS,
      engine: engineStatus,
      connectedClients: this.clients.size,
      lastOpportunitiesCount: this.lastOpportunities.length,
      timestamp: Date.now()
    }));
  }

  private broadcastToClients(message: any): void {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((client: ClientConnection) => {
      if (message.type === OpportunityWS.ServerMessageTypes.OPPORTUNITIES && message.data) {
        const filtered = message.data.filter((opp: OpportunityData) => {
          if (!client.subscribedTypes.has(opp.type as OpportunityWS.OpportunityType)) return false;
          if (opp.profitPercent < (client.minProfitFilter || 0)) return false;
          return true;
        });

        if (filtered.length === 0) return;

        client.socket.send(JSON.stringify({
          type: OpportunityWS.ServerMessageTypes.OPPORTUNITIES,
          data: filtered,
          timestamp: Date.now()
        }));
      } else {
        client.socket.send(messageStr);
      }
    });
  }

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

  shutdown(): void {
    if (this.heartbeatInterval) { // FIX #3
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.wss) {
      this.wss.close();
      this.clients.clear();
      this.isInitialized = false;
      logger.info('OpportunityStreamServer shut down');
    }
  }
}

export const opportunityStream = new OpportunityStreamServer();