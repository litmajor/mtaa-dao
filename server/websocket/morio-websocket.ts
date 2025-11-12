/**
 * Morio Data Hub WebSocket Integration
 * 
 * Provides real-time data streaming to dashboard clients
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { authenticateToken } from '../middleware/auth';
import { morioDataHubService } from '../services/morio-data-hub.service';

export class MorioWebSocketServer {
  private io: SocketIOServer;
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startPeriodicUpdates();
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware() {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }
      // Token validation would happen here
      next();
    });
  }

  /**
   * Setup main event handlers
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Subscribe to dashboard updates
      socket.on('subscribe:dashboard', async (daoId?: string) => {
        socket.join(`dashboard:${daoId || 'global'}`);
        console.log(`Client subscribed to dashboard: ${daoId || 'global'}`);

        // Send initial data
        try {
          const systemStatus = await morioDataHubService.getSystemStatus();
          socket.emit('data:system-status', systemStatus);
        } catch (error) {
          console.error('Error sending initial system status:', error);
        }
      });

      // Subscribe to real-time alerts
      socket.on('subscribe:alerts', async (daoId?: string) => {
        socket.join(`alerts:${daoId || 'global'}`);
        console.log(`Client subscribed to alerts: ${daoId || 'global'}`);

        try {
          const alerts = await morioDataHubService.getRealTimeAlerts(daoId);
          socket.emit('data:alerts', alerts);
        } catch (error) {
          console.error('Error sending alerts:', error);
        }
      });

      // Subscribe to performance metrics
      socket.on('subscribe:performance', async () => {
        socket.join('performance:global');
        console.log('Client subscribed to performance metrics');

        try {
          const metrics = await morioDataHubService.getPerformanceMetrics();
          socket.emit('data:performance', metrics);
        } catch (error) {
          console.error('Error sending performance metrics:', error);
        }
      });

      // Subscribe to specific section updates
      socket.on('subscribe:section', (section: string, daoId?: string) => {
        const roomName = `section:${section}:${daoId || 'global'}`;
        socket.join(roomName);
        console.log(`Client subscribed to section: ${roomName}`);
      });

      // Unsubscribe handlers
      socket.on('unsubscribe:dashboard', (daoId?: string) => {
        socket.leave(`dashboard:${daoId || 'global'}`);
      });

      socket.on('unsubscribe:alerts', (daoId?: string) => {
        socket.leave(`alerts:${daoId || 'global'}`);
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Start periodic updates
   */
  private startPeriodicUpdates() {
    // Update system status every 30 seconds
    const statusInterval = setInterval(async () => {
      try {
        const status = await morioDataHubService.getSystemStatus();
        this.io.emit('data:system-status', status);
      } catch (error) {
        console.error('Error broadcasting system status:', error);
      }
    }, 30000);

    // Update performance metrics every 60 seconds
    const performanceInterval = setInterval(async () => {
      try {
        const metrics = await morioDataHubService.getPerformanceMetrics();
        this.io.emit('data:performance', metrics);
      } catch (error) {
        console.error('Error broadcasting performance metrics:', error);
      }
    }, 60000);

    // Update alerts every 15 seconds
    const alertsInterval = setInterval(async () => {
      try {
        const alerts = await morioDataHubService.getRealTimeAlerts();
        this.io.emit('data:alerts', alerts);
      } catch (error) {
        console.error('Error broadcasting alerts:', error);
      }
    }, 15000);

    this.updateIntervals.set('status', statusInterval);
    this.updateIntervals.set('performance', performanceInterval);
    this.updateIntervals.set('alerts', alertsInterval);
  }

  /**
   * Broadcast event to specific room
   */
  broadcastToRoom(room: string, event: string, data: any) {
    this.io.to(room).emit(event, data);
  }

  /**
   * Broadcast to dashboard subscribers
   */
  broadcastDashboardUpdate(daoId: string, section: string, data: any) {
    this.io.to(`dashboard:${daoId}`).emit(`update:${section}`, data);
  }

  /**
   * Broadcast alert to subscribers
   */
  broadcastAlert(daoId: string, alert: any) {
    this.io.to(`alerts:${daoId}`).emit('new:alert', alert);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.io.engine.clientsCount;
  }

  /**
   * Get clients in specific room
   */
  getClientsInRoom(room: string): number {
    return this.io.sockets.adapter.rooms.get(room)?.size || 0;
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown() {
    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals.clear();
    this.io.close();
  }
}

/**
 * Create and export WebSocket server instance
 */
export function createMorioWebSocketServer(httpServer: HttpServer): MorioWebSocketServer {
  return new MorioWebSocketServer(httpServer);
}
