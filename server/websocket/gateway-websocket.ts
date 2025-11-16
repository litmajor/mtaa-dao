/**
 * Gateway Agent WebSocket Endpoint
 * Real-time streaming of price, liquidity, APY, and risk data
 * Uses Socket.IO for bi-directional communication
 */

import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { GatewayAgentService } from "../core/agents/gateway/service";
import { getGatewayAgentService } from "../core/agents/gateway/service";
import { MessageBusAdapter, getMessageBus } from "../core/agents/gateway/message-bus";
import { GatewayMessage } from "../core/agents/gateway/types";

/**
 * WebSocket subscription types
 */
export interface GatewaySubscription {
  id: string;
  userId: string;
  type: "prices" | "liquidity" | "apy" | "risk" | "all";
  params: Record<string, any>;
  createdAt: Date;
  active: boolean;
}

/**
 * Gateway WebSocket Server
 */
export class GatewayWebSocketServer {
  private io: SocketIOServer;
  private service: GatewayAgentService;
  private messageBus: MessageBusAdapter;
  private subscriptions = new Map<string, GatewaySubscription>();
  private socketSubscriptions = new Map<string, GatewaySubscription[]>();
  private updateUnsubscribers = new Map<string, () => void>();

  constructor(httpServer: HTTPServer, service?: GatewayAgentService) {
    this.service = service || getGatewayAgentService();
    this.messageBus = getMessageBus();

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });

    this.setupMiddleware();
    this.setupConnectionHandlers();
    this.setupMessageHandlers();
  }

  /**
   * Setup middleware for authentication/validation
   */
  private setupMiddleware(): void {
    this.io.use((socket, next) => {
      try {
        // Validate connection
        const token = socket.handshake.auth.token;
        const userId = socket.handshake.auth.userId;

        // In production, validate JWT token here
        //const user = validateToken(token);
        //if (!user) return next(new Error('Unauthorized'));

        // Store user info on socket
        (socket as any).userId = userId || "anonymous";
        (socket as any).token = token;

        next();
      } catch (error) {
        next(error as any);
      }
    });
  }

  /**
   * Setup connection handlers
   */
  private setupConnectionHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      const userId = (socket as any).userId;
      console.log(
        `[Gateway WS] Client connected: ${socket.id} (user: ${userId})`
      );

      // Initialize socket subscriptions
      this.socketSubscriptions.set(socket.id, []);

      // Handle disconnect
      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });

      // Send welcome message
      socket.emit("gateway:connected", {
        id: socket.id,
        userId,
        timestamp: new Date().toISOString(),
        message: "Connected to Gateway Agent",
      });
    });
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    const socket = this.io;

    // Subscribe to price updates from message bus
    this.messageBus.subscribe("gateway:price_update", async (message: GatewayMessage) => {
      this.broadcastUpdate("prices", message);
    });

    // Subscribe to liquidity updates
    this.messageBus.subscribe("gateway:liquidity_update", async (message: GatewayMessage) => {
      this.broadcastUpdate("liquidity", message);
    });

    // Subscribe to APY updates
    this.messageBus.subscribe("gateway:apy_update", async (message: GatewayMessage) => {
      this.broadcastUpdate("apy", message);
    });

    // Subscribe to risk updates
    this.messageBus.subscribe("gateway:risk_update", async (message: GatewayMessage) => {
      this.broadcastUpdate("risk", message);
    });
  }

  /**
   * Register socket event handlers
   * Called after connection
   */
  registerSocketHandlers(socket: Socket): void {
    /**
     * Subscribe to price updates
     * Payload: { symbols: string[]; chains?: string[]; source?: string }
     */
    socket.on("gateway:subscribe_prices", (payload: any, callback?: Function) => {
      this.handleSubscription(socket, "prices", payload, callback);
    });

    /**
     * Subscribe to liquidity updates
     * Payload: { protocols: string[]; pools?: string[]; chain?: string }
     */
    socket.on("gateway:subscribe_liquidity", (payload: any, callback?: Function) => {
      this.handleSubscription(socket, "liquidity", payload, callback);
    });

    /**
     * Subscribe to APY updates
     * Payload: { protocols: string[]; assets?: string[]; chain?: string }
     */
    socket.on("gateway:subscribe_apy", (payload: any, callback?: Function) => {
      this.handleSubscription(socket, "apy", payload, callback);
    });

    /**
     * Subscribe to risk updates
     * Payload: { protocols: string[] }
     */
    socket.on("gateway:subscribe_risk", (payload: any, callback?: Function) => {
      this.handleSubscription(socket, "risk", payload, callback);
    });

    /**
     * Unsubscribe from updates
     * Payload: { subscriptionId: string }
     */
    socket.on("gateway:unsubscribe", (payload: any, callback?: Function) => {
      this.handleUnsubscription(socket, payload.subscriptionId, callback);
    });

    /**
     * Get current subscriptions
     */
    socket.on("gateway:get_subscriptions", (callback?: Function) => {
      const subs = this.socketSubscriptions.get(socket.id) || [];
      if (callback) {
        callback({ subscriptions: subs });
      }
    });

    /**
     * Request immediate data (one-time, not streaming)
     * Payload: { type: 'prices'|'liquidity'|'apy'|'risk'; params: any }
     */
    socket.on("gateway:request_data", async (payload: any, callback?: Function) => {
      await this.handleDirectRequest(socket, payload, callback);
    });

    /**
     * Get gateway status
     */
    socket.on("gateway:get_status", async (callback?: Function) => {
      try {
        const status = await this.service.getStatus();
        if (callback) {
          callback({ success: true, data: status });
        }
      } catch (error) {
        if (callback) {
          callback({
            success: false,
            error: (error as Error).message,
          });
        }
      }
    });

    /**
     * Health check
     */
    socket.on("gateway:health_check", (callback?: Function) => {
      if (callback) {
        callback({
          healthy: this.service.isHealthy(),
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Handle subscription request
   */
  private handleSubscription(
    socket: Socket,
    type: "prices" | "liquidity" | "apy" | "risk",
    params: any,
    callback?: Function
  ): void {
    try {
      const subscriptionId = `sub:${socket.id}:${type}:${Date.now()}`;
      const userId = (socket as any).userId;

      const subscription: GatewaySubscription = {
        id: subscriptionId,
        userId,
        type,
        params,
        createdAt: new Date(),
        active: true,
      };

      // Store subscription
      this.subscriptions.set(subscriptionId, subscription);
      const subs = this.socketSubscriptions.get(socket.id) || [];
      subs.push(subscription);
      this.socketSubscriptions.set(socket.id, subs);

      console.log(
        `[Gateway WS] Subscription created: ${subscriptionId} (${type})`
      );

      // Make initial request
      this.requestData(type, params, socket, subscription);

      // Respond to client
      if (callback) {
        callback({
          success: true,
          subscriptionId,
          type,
          message: `Subscribed to ${type} updates`,
        });
      }

      // Emit subscription confirmed event
      socket.emit("gateway:subscribed", {
        subscriptionId,
        type,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Gateway WS] Subscription error:", error);
      if (callback) {
        callback({
          success: false,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscription(
    socket: Socket,
    subscriptionId: string,
    callback?: Function
  ): void {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        if (callback) {
          callback({
            success: false,
            error: "Subscription not found",
          });
        }
        return;
      }

      // Remove subscription
      subscription.active = false;
      this.subscriptions.delete(subscriptionId);

      const subs = this.socketSubscriptions.get(socket.id) || [];
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index > -1) {
        subs.splice(index, 1);
      }

      // Cleanup unsubscriber
      const unsub = this.updateUnsubscribers.get(subscriptionId);
      if (unsub) {
        unsub();
        this.updateUnsubscribers.delete(subscriptionId);
      }

      console.log(`[Gateway WS] Unsubscribed: ${subscriptionId}`);

      if (callback) {
        callback({
          success: true,
          message: "Unsubscribed successfully",
        });
      }

      socket.emit("gateway:unsubscribed", {
        subscriptionId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Gateway WS] Unsubscription error:", error);
      if (callback) {
        callback({
          success: false,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Handle direct data request (non-streaming)
   */
  private async handleDirectRequest(
    socket: Socket,
    payload: any,
    callback?: Function
  ): Promise<void> {
    try {
      const { type, params } = payload;

      let result = null;

      switch (type) {
        case "prices":
          result = await this.service.requestPrices(
            params.symbols,
            params.chains,
            params.source
          );
          break;
        case "liquidity":
          result = await this.service.requestLiquidity(
            params.pools,
            params.protocols,
            params.chain
          );
          break;
        case "apy":
          result = await this.service.requestAPY(
            params.protocols,
            params.assets,
            params.chain
          );
          break;
        case "risk":
          result = await this.service.requestRisk(params.protocols);
          break;
        default:
          throw new Error(`Unknown request type: ${type}`);
      }

      if (callback) {
        callback({
          success: true,
          data: result?.payload?.data,
          requestId: result?.payload?.requestId,
        });
      }
    } catch (error) {
      if (callback) {
        callback({
          success: false,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Request data and emit to socket
   */
  private async requestData(
    type: "prices" | "liquidity" | "apy" | "risk",
    params: any,
    socket: Socket,
    subscription: GatewaySubscription
  ): Promise<void> {
    try {
      let result = null;

      switch (type) {
        case "prices":
          result = await this.service.requestPrices(
            params.symbols,
            params.chains,
            params.source
          );
          break;
        case "liquidity":
          result = await this.service.requestLiquidity(
            params.pools,
            params.protocols,
            params.chain
          );
          break;
        case "apy":
          result = await this.service.requestAPY(
            params.protocols,
            params.assets,
            params.chain
          );
          break;
        case "risk":
          result = await this.service.requestRisk(params.protocols);
          break;
      }

      if (result && subscription.active) {
        socket.emit(`gateway:${type}_update`, {
          subscriptionId: subscription.id,
          type,
          data: result.payload?.data,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("[Gateway WS] Request error:", error);
      socket.emit("gateway:error", {
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Broadcast update to relevant subscribers
   */
  private broadcastUpdate(type: string, message: GatewayMessage): void {
    // Find all subscriptions matching this type
    for (const [subscriptionId, subscription] of this.subscriptions) {
      if (subscription.type === type && subscription.active) {
        // Find the socket for this subscription
        for (const [socketId, subs] of this.socketSubscriptions) {
          if (subs.some((s) => s.id === subscriptionId)) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit(`gateway:${type}_update`, {
                subscriptionId,
                type,
                data: message.payload?.data,
                timestamp: message.timestamp?.toISOString(),
              });
            }
          }
        }
      }
    }
  }

  /**
   * Handle socket disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const userId = (socket as any).userId;
    console.log(`[Gateway WS] Client disconnected: ${socket.id} (user: ${userId})`);

    // Clean up subscriptions
    const subs = this.socketSubscriptions.get(socket.id) || [];
    for (const sub of subs) {
      sub.active = false;
      this.subscriptions.delete(sub.id);

      const unsub = this.updateUnsubscribers.get(sub.id);
      if (unsub) {
        unsub();
        this.updateUnsubscribers.delete(sub.id);
      }
    }

    this.socketSubscriptions.delete(socket.id);
  }

  /**
   * Get server instance
   */
  getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      connectedClients: this.io.engine.clientsCount,
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(
        (s) => s.active
      ).length,
      subscriptionsByType: {
        prices: Array.from(this.subscriptions.values()).filter(
          (s) => s.type === "prices" && s.active
        ).length,
        liquidity: Array.from(this.subscriptions.values()).filter(
          (s) => s.type === "liquidity" && s.active
        ).length,
        apy: Array.from(this.subscriptions.values()).filter((s) => s.type === "apy" && s.active)
          .length,
        risk: Array.from(this.subscriptions.values()).filter((s) => s.type === "risk" && s.active)
          .length,
      },
    };
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    console.log("[Gateway WS] Shutting down WebSocket server...");

    // Close all subscriptions
    for (const [subId, unsub] of this.updateUnsubscribers) {
      unsub();
    }

    // Disconnect all clients
    this.io.disconnectSockets();
    this.io.close();

    console.log("[Gateway WS] Shutdown complete");
  }
}

/**
 * Attach WebSocket handlers to socket after connection
 */
export function attachGatewayWebSocketHandlers(
  wsServer: GatewayWebSocketServer
): (socket: Socket) => void {
  return (socket: Socket) => {
    wsServer.registerSocketHandlers(socket);
  };
}

/**
 * Create and initialize Gateway WebSocket server
 */
export function createGatewayWebSocketServer(
  httpServer: HTTPServer,
  service?: GatewayAgentService
): GatewayWebSocketServer {
  const wsServer = new GatewayWebSocketServer(httpServer, service);

  // Register handlers for all new connections
  wsServer.getIO().on("connection", (socket: Socket) => {
    wsServer.registerSocketHandlers(socket);
  });

  return wsServer;
}
