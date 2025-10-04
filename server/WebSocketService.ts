import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from './utils/logger';

// Types for WebSocket messages
interface TypingMessage {
  type: 'typing';
  data: {
    daoId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
  };
}

type WebSocketMessage = TypingMessage;

export class WebSocketService {
  private io: SocketIOServer;
  private userSockets: Map<string, Socket> = new Map();
  private daoTypingUsers: Map<string, Set<string>> = new Map();
  private daoOnlineUsers: Map<string, Set<string>> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers() {
    this.io.on('connection', (socket: Socket) => {
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  authenticateUser(socket: Socket, userId: string) {
    // Store socket for user
    this.userSockets.set(userId, socket);
    socket.data.userId = userId;

    // Clean up on disconnect
    socket.on('disconnect', () => {
      this.userSockets.delete(userId);
      
      // Remove user from all DAO presence lists
      for (const [daoId, users] of this.daoOnlineUsers.entries()) {
        if (users.has(userId)) {
          users.delete(userId);
          this.broadcastPresenceUpdate(daoId);
        }
      }
    });
  }

  private handleDisconnect(socket: Socket) {
    const userId = socket.data.userId;
    if (userId) {
      // Remove from userSockets
      this.userSockets.delete(userId);

      // Remove from all DAO typing lists
      for (const [daoId, typingUsers] of this.daoTypingUsers.entries()) {
        if (typingUsers.has(userId)) {
          typingUsers.delete(userId);
          this.broadcastTypingUpdate(daoId);
        }
      }

      // Remove from all DAO presence lists
      for (const [daoId, onlineUsers] of this.daoOnlineUsers.entries()) {
        if (onlineUsers.has(userId)) {
          onlineUsers.delete(userId);
          this.broadcastPresenceUpdate(daoId);
        }
      }
    }
  }

  handleTyping(message: TypingMessage) {
    const { daoId, userId, isTyping } = message.data;

    // Initialize typing users set for this DAO if needed
    if (!this.daoTypingUsers.has(daoId)) {
      this.daoTypingUsers.set(daoId, new Set());
    }

    const typingUsers = this.daoTypingUsers.get(daoId)!;

    if (isTyping) {
      typingUsers.add(userId);
    } else {
      typingUsers.delete(userId);
    }

    this.broadcastTypingUpdate(daoId);
  }

  private broadcastTypingUpdate(daoId: string) {
    const typingUsers = Array.from(this.daoTypingUsers.get(daoId) || new Set());
    this.io.to(`dao:${daoId}`).emit('typing_update', {
      daoId,
      typingUsers
    });
  }

  private broadcastPresenceUpdate(daoId: string) {
    const onlineUsers = Array.from(this.daoOnlineUsers.get(daoId) || new Set());
    this.io.to(`dao:${daoId}`).emit('presence_update', {
      daoId,
      onlineUsers
    });
  }

  getOnlineUsers(daoId: string): string[] {
    return Array.from(this.daoOnlineUsers.get(daoId) || new Set());
  }

  getTypingUsers(daoId: string): string[] {
    return Array.from(this.daoTypingUsers.get(daoId) || new Set());
  }
}