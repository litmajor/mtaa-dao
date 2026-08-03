/**
 * Morio Data Hub WebSocket Integration
 *
 * Provides real-time data streaming to dashboard clients
 *
 * FIXES APPLIED:
 * 1. Distinct Socket.IO `path` — prevents collision with Admin/Gateway/
 *    Coordinator WS servers on the same HTTP server.
 * 2. subscribe:dashboard / subscribe:alerts / subscribe:section now check
 *    that the authenticated user actually belongs to the requested daoId
 *    (or is a superuser) before joining that DAO's room. Previously any
 *    authenticated user could pass an arbitrary daoId and receive another
 *    DAO's dashboard/alert stream.
 * 3. Periodic updates now target the actual rooms clients joined
 *    (`this.io.to(room).emit(...)`) instead of `this.io.emit(...)`, which
 *    broadcast every tick to literally every connected socket regardless
 *    of subscription — making the room structure meaningless for anything
 *    except the one-time initial push.
 * 4. DAO-scoped alert rooms now get their own periodic refresh (previously
 *    only the global alerts feed was ever refreshed on an interval; a
 *    DAO-specific subscriber got one push at subscribe time and nothing
 *    after that).
 * 5. subscribe:section validates `section` against a known enum.
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import socketAuthMiddleware from '../middleware/socketAuth';
import { morioDataHubService } from '../services/morio-data-hub.service';
import { WS_PATHS, MorioWS } from './websocket-events';
import { corsAllowedOrigins } from '../../shared/config.js';

const KNOWN_SECTIONS = new Set(['scry', 'kaizen', 'lumen', 'agents', 'treasury', 'governance']);

export class MorioWebSocketServer {
  private io: SocketIOServer;
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  /** Tracks which DAO-scoped alert rooms currently have at least one subscriber. */
  private activeAlertDaoRooms: Set<string> = new Set();

  constructor(httpServer: HttpServer) {
    const socketCorsOrigins = corsAllowedOrigins.length > 0
      ? corsAllowedOrigins
      : ['http://localhost:5173'];

    this.io = new SocketIOServer(httpServer, {
      // FIX #1
      path: WS_PATHS.MORIO,
      cors: {
        origin: socketCorsOrigins,
        credentials: true
      }
    });

    this.io.use(socketAuthMiddleware);
    this.setupEventHandlers();
    this.startPeriodicUpdates();
  }

  /**
   * FIX #2: verify the authenticated user actually belongs to daoId (or is
   * a superuser) before allowing them to join a DAO-scoped room. Global
   * scope ('global') requires no DAO membership.
   */
  private canAccessDao(user: any, daoId: string): boolean {
    if (daoId === MorioWS.GLOBAL_SCOPE) return true;
    if (!user) return false;
    return !!user.isSuperuser || !!user.daos?.includes(daoId);
  }

  /**
   * Setup main event handlers
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const user = (socket.data as any)?.user;
      console.log(`Client connected: ${socket.id}`);

      socket.on(MorioWS.ClientEvents.SUBSCRIBE_DASHBOARD, async (daoId?: string) => {
        const scope = daoId || MorioWS.GLOBAL_SCOPE;
        if (!this.canAccessDao(user, scope)) {
          socket.emit(MorioWS.ServerEvents.ERROR, { message: `No access to DAO ${scope}` });
          return;
        }

        socket.join(MorioWS.Rooms.dashboard(scope));
        console.log(`Client subscribed to dashboard: ${scope}`);

        try {
          const systemStatus = await morioDataHubService.getSystemStatus();
          socket.emit(MorioWS.ServerEvents.SYSTEM_STATUS, systemStatus);
        } catch (error) {
          console.error('Error sending initial system status:', error);
        }
      });

      socket.on(MorioWS.ClientEvents.SUBSCRIBE_ALERTS, async (daoId?: string) => {
        const scope = daoId || MorioWS.GLOBAL_SCOPE;
        if (!this.canAccessDao(user, scope)) {
          socket.emit(MorioWS.ServerEvents.ERROR, { message: `No access to DAO ${scope}` });
          return;
        }

        socket.join(MorioWS.Rooms.alerts(scope));
        if (scope !== MorioWS.GLOBAL_SCOPE) {
          // FIX #4: track this room so the periodic sweep also refreshes it
          this.activeAlertDaoRooms.add(scope);
        }
        console.log(`Client subscribed to alerts: ${scope}`);

        try {
          const alerts = await morioDataHubService.getRealTimeAlerts(daoId);
          socket.emit(MorioWS.ServerEvents.ALERTS, alerts);
        } catch (error) {
          console.error('Error sending alerts:', error);
        }
      });

      socket.on(MorioWS.ClientEvents.SUBSCRIBE_PERFORMANCE, async () => {
        socket.join(MorioWS.Rooms.performanceGlobal());
        console.log('Client subscribed to performance metrics');

        try {
          const metrics = await morioDataHubService.getPerformanceMetrics();
          socket.emit(MorioWS.ServerEvents.PERFORMANCE, metrics);
        } catch (error) {
          console.error('Error sending performance metrics:', error);
        }
      });

      socket.on(MorioWS.ClientEvents.SUBSCRIBE_SECTION, (section: string, daoId?: string) => {
        // FIX #5: validate section against a known set
        if (!KNOWN_SECTIONS.has(section)) {
          socket.emit(MorioWS.ServerEvents.ERROR, { message: `Unknown section: ${section}` });
          return;
        }
        const scope = daoId || MorioWS.GLOBAL_SCOPE;
        if (!this.canAccessDao(user, scope)) {
          socket.emit(MorioWS.ServerEvents.ERROR, { message: `No access to DAO ${scope}` });
          return;
        }

        const roomName = MorioWS.Rooms.section(section, scope);
        socket.join(roomName);
        console.log(`Client subscribed to section: ${roomName}`);
      });

      socket.on(MorioWS.ClientEvents.UNSUBSCRIBE_DASHBOARD, (daoId?: string) => {
        socket.leave(MorioWS.Rooms.dashboard(daoId || MorioWS.GLOBAL_SCOPE));
      });

      socket.on(MorioWS.ClientEvents.UNSUBSCRIBE_ALERTS, (daoId?: string) => {
        const scope = daoId || MorioWS.GLOBAL_SCOPE;
        socket.leave(MorioWS.Rooms.alerts(scope));
        // Only stop the periodic per-DAO refresh once nobody's left in that room
        const remaining = this.io.sockets.adapter.rooms.get(MorioWS.Rooms.alerts(scope))?.size || 0;
        if (remaining === 0) this.activeAlertDaoRooms.delete(scope);
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Start periodic updates
   *
   * FIX #3 + #4: broadcasts now go to the specific rooms clients joined,
   * and DAO-scoped alert rooms get their own periodic refresh alongside
   * the global feed.
   */
  private startPeriodicUpdates() {
    const statusInterval = setInterval(async () => {
      try {
        const status = await morioDataHubService.getSystemStatus();
        this.io.to(MorioWS.Rooms.dashboard(MorioWS.GLOBAL_SCOPE)).emit(MorioWS.ServerEvents.SYSTEM_STATUS, status);
      } catch (error) {
        console.error('Error broadcasting system status:', error);
      }
    }, 30000);

    const performanceInterval = setInterval(async () => {
      try {
        const metrics = await morioDataHubService.getPerformanceMetrics();
        this.io.to(MorioWS.Rooms.performanceGlobal()).emit(MorioWS.ServerEvents.PERFORMANCE, metrics);
      } catch (error) {
        console.error('Error broadcasting performance metrics:', error);
      }
    }, 60000);

    const alertsInterval = setInterval(async () => {
      try {
        // Global feed
        const globalAlerts = await morioDataHubService.getRealTimeAlerts();
        this.io.to(MorioWS.Rooms.alerts(MorioWS.GLOBAL_SCOPE)).emit(MorioWS.ServerEvents.ALERTS, globalAlerts);

        // FIX #4: refresh every DAO-scoped room that currently has subscribers
        await Promise.all(
          Array.from(this.activeAlertDaoRooms).map(async (daoId) => {
            try {
              const daoAlerts = await morioDataHubService.getRealTimeAlerts(daoId);
              this.io.to(MorioWS.Rooms.alerts(daoId)).emit(MorioWS.ServerEvents.ALERTS, daoAlerts);
            } catch (err) {
              console.error(`Error broadcasting alerts for DAO ${daoId}:`, err);
            }
          })
        );
      } catch (error) {
        console.error('Error broadcasting alerts:', error);
      }
    }, 15000);

    this.updateIntervals.set('status', statusInterval);
    this.updateIntervals.set('performance', performanceInterval);
    this.updateIntervals.set('alerts', alertsInterval);
  }

  broadcastToRoom(room: string, event: string, data: any) {
    this.io.to(room).emit(event, data);
  }

  broadcastDashboardUpdate(daoId: string, section: string, data: any) {
    this.io.to(MorioWS.Rooms.dashboard(daoId)).emit(`${MorioWS.ServerEvents.DASHBOARD_UPDATE_PREFIX}${section}`, data);
  }

  broadcastAlert(daoId: string, alert: any) {
    this.io.to(MorioWS.Rooms.alerts(daoId)).emit(MorioWS.ServerEvents.NEW_ALERT, alert);
  }

  getConnectedClientsCount(): number {
    return this.io.engine.clientsCount;
  }

  getClientsInRoom(room: string): number {
    return this.io.sockets.adapter.rooms.get(room)?.size || 0;
  }

  shutdown() {
    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals.clear();
    this.activeAlertDaoRooms.clear();
    this.io.close();
  }
}

export function createMorioWebSocketServer(httpServer: HttpServer): MorioWebSocketServer {
  return new MorioWebSocketServer(httpServer);
}