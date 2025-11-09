import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';

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


export class WebSocketService {
  private static instance: WebSocketService | null = null;
  private static server: HttpServer | null = null;
  private wss: WebSocketServer;
  private clients: Map<WebSocket, DaoClient> = new Map();
  private typingUsers: Map<string, Set<string>> = new Map();
  private onlineUsers: Map<string, Set<string>> = new Map();
  private heartbeatInterval!: NodeJS.Timeout;

  private constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/realtime' // Use specific path to avoid conflicts with Vite HMR
    });
    WebSocketService.server = server;
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
    const client: DaoClient = {
      ws,
      userId: data.userId,
      userName: data.userName || 'Anonymous',
      daoIds: new Set(data.daoIds),
      isAlive: true
    };
    this.clients.set(ws, client);
    data.daoIds.forEach(daoId => {
      if (!this.onlineUsers.has(daoId)) {
        this.onlineUsers.set(daoId, new Set());
      }
      this.onlineUsers.get(daoId)!.add(data.userId);
      this.broadcastPresence(daoId);
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
    if (client) {
      client.daoIds.forEach(daoId => {
        this.typingUsers.get(daoId)?.delete(client.userId);
        this.onlineUsers.get(daoId)?.delete(client.userId);
        this.broadcastTyping(daoId);
        this.broadcastPresence(daoId);
      });
      this.clients.delete(ws);
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
      this.wss.clients.forEach((ws: WebSocket) => {
        const client = this.clients.get(ws);
        if (client && !client.isAlive) {
          client.ws.terminate();
          return;
        }
        if (client) client.isAlive = false;
        ws.ping();
      });
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
}