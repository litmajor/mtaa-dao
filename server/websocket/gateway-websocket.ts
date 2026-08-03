/**
 * Gateway Agent WebSocket Endpoint
 * Real-time streaming of price, liquidity, APY, and risk data
 * Uses Socket.IO for bi-directional communication
 *
 * FIXES APPLIED:
 * 1. registerSocketHandlers() is now called directly from the connection
 *    handler inside the class, not from an external factory. Previously,
 *    instantiating `new GatewayWebSocketServer(...)` directly (without going
 *    through createGatewayWebSocketServer) silently produced a server where
 *    no subscriptions worked at all.
 * 2. updateUnsubscribers is now actually wired up: each subscription gets a
 *    polling interval that re-requests data until the subscription is
 *    cancelled, and the interval is properly cleared on unsubscribe/disconnect.
 *    Previously this map was never populated, so all the "cleanup" code
 *    that referenced it was dead.
 * 3. Duplicate-subscription protection: subscribing again with the same
 *    type+params on the same socket reuses the existing subscription
 *    instead of creating a new one that would double (or triple, or...)
 *    every future broadcast to that socket.
 * 4. Per-socket subscription cap to prevent unbounded growth from a
 *    misbehaving or malicious client.
 * 5. broadcastUpdate no longer does an O(subscriptions * sockets) nested
 *    scan — each subscription now carries its owning socketId directly.
 * 6. Basic payload validation before creating a subscription.
 */

import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import type {DefaultEventsMap} from "socket.io";
import socketAuthMiddleware from "../middleware/socketAuth";
import { GatewayAgentService } from "../core/agents/gateway/service";
import { getGatewayAgentService } from "../core/agents/gateway/service";
import { MessageBusAdapter, getMessageBus } from "../core/agents/gateway/message-bus";
import type { GatewayMessage } from "../core/agents/gateway/types";
import { WS_PATHS } from "./websocket-events";
import { corsAllowedOrigins } from "../../shared/config.js";

const MAX_SUBSCRIPTIONS_PER_SOCKET = 20;
const POLL_INTERVAL_MS = parseInt(process.env.GATEWAY_WS_POLL_INTERVAL_MS || "10000");

/**
 * WebSocket subscription types
 */
export interface GatewaySubscription {
  id: string;
  userId: string;
  socketId: string;
  type: "prices" | "liquidity" | "apy" | "risk" | "all";
  params: GatewayRequestParams;
  createdAt: Date;
  active: boolean;
}

type SubscribableType = "prices" | "liquidity" | "apy" | "risk";

type GatewayRequestParams = {
  symbols?: string[];
  chains?: string[];
  source?: string;
  pools?: string[];
  protocols?: string[];
  chain?: string;
  assets?: string[];
};

type GatewayRequestPayload = {
  type?: SubscribableType;
  params?: GatewayRequestParams;
};

type GatewayCallback = (response: unknown) => void;

interface GatewaySocketData {
  user?: {
    id?: string;
    sub?: string;
    email?: string;
    role?: string;
    permissions?: string[];
  };
}

type GatewaySocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, GatewaySocketData>;

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

    const socketCorsOrigins = corsAllowedOrigins.length > 0
      ? corsAllowedOrigins
      : ['http://localhost:5173'];
    const allowAllSocketOrigins = socketCorsOrigins.some((origin) => ['*', 'all'].includes(origin.toLowerCase()));

    this.io = new SocketIOServer(httpServer, {
      path: WS_PATHS.GATEWAY,
      cors: {
        origin: allowAllSocketOrigins ? true : socketCorsOrigins,
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });

    // Use shared auth middleware
    this.io.use(socketAuthMiddleware);
    this.setupConnectionHandlers();
    this.setupMessageHandlers();
  }

  /**
   * Setup connection handlers
   *
   * FIX #1: registerSocketHandlers is now called here, directly, so the
   * class is self-contained regardless of how it's instantiated.
   */
  private setupConnectionHandlers(): void {
    this.io.on("connection", (socket: GatewaySocket) => {
      const userId = socket.data.user?.id || socket.data.user?.sub;
      console.log(
        `[Gateway WS] Client connected: ${socket.id} (user: ${userId})`
      );

      this.socketSubscriptions.set(socket.id, []);

      this.registerSocketHandlers(socket);

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });

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
    this.messageBus.subscribe("gateway:price_update", async (message: GatewayMessage) => {
      this.broadcastUpdate("prices", message);
    });

    this.messageBus.subscribe("gateway:liquidity_update", async (message: GatewayMessage) => {
      this.broadcastUpdate("liquidity", message);
    });

    this.messageBus.subscribe("gateway:apy_update", async (message: GatewayMessage) => {
      this.broadcastUpdate("apy", message);
    });

    this.messageBus.subscribe("gateway:risk_update", async (message: GatewayMessage) => {
      this.broadcastUpdate("risk", message);
    });
  }

  /**
   * Register socket event handlers. Safe to call multiple times per socket
   * since this only attaches listeners — but callers should generally rely
   * on setupConnectionHandlers doing this automatically on connect.
   */
  registerSocketHandlers(socket: GatewaySocket): void {
    socket.on("gateway:subscribe_prices", (payload: unknown, callback?: GatewayCallback) => {
      const request = payload as GatewayRequestPayload;
      this.handleSubscription(socket, "prices", request.params ?? {}, callback);
    });

    socket.on("gateway:subscribe_liquidity", (payload: unknown, callback?: GatewayCallback) => {
      const request = payload as GatewayRequestPayload;
      this.handleSubscription(socket, "liquidity", request.params ?? {}, callback);
    });

    socket.on("gateway:subscribe_apy", (payload: unknown, callback?: GatewayCallback) => {
      const request = payload as GatewayRequestPayload;
      this.handleSubscription(socket, "apy", request.params ?? {}, callback);
    });

    socket.on("gateway:subscribe_risk", (payload: unknown, callback?: GatewayCallback) => {
      const request = payload as GatewayRequestPayload;
      this.handleSubscription(socket, "risk", request.params ?? {}, callback);
    });

    socket.on("gateway:unsubscribe", (payload: unknown, callback?: GatewayCallback) => {
      const request = payload as { subscriptionId?: string };
      this.handleUnsubscription(socket, request.subscriptionId ?? '', callback);
    });

    socket.on("gateway:get_subscriptions", (callback?: GatewayCallback) => {
      const subs = this.socketSubscriptions.get(socket.id) || [];
      if (callback) callback({ subscriptions: subs });
    });

    socket.on("gateway:request_data", async (payload: unknown, callback?: GatewayCallback) => {
      await this.handleDirectRequest(socket, payload, callback);
    });

    socket.on("gateway:get_status", async (callback?: Function) => {
      try {
        const status = await this.service.getStatus();
        if (callback) callback({ success: true, data: status });
      } catch (error) {
        if (callback) callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on("gateway:health_check", (callback?: Function) => {
      if (callback) {
        callback({ healthy: this.service.isHealthy(), timestamp: new Date().toISOString() });
      }
    });
  }

  /**
   * Validate a subscription payload has the minimum shape needed for its type.
   */
  private validateSubscriptionParams(type: SubscribableType, params: unknown): string | null {
    if (!params || typeof params !== "object") return "Missing params object";
    const payload = params as Record<string, unknown>;
    switch (type) {
      case "prices":
        if (!Array.isArray(payload.symbols) || payload.symbols.length === 0) {
          return "params.symbols must be a non-empty array";
        }
        break;
      case "liquidity":
      case "apy":
        if (payload.protocols && !Array.isArray(payload.protocols)) {
          return "params.protocols must be an array";
        }
        break;
      case "risk":
        if (!Array.isArray(payload.protocols) || payload.protocols.length === 0) {
          return "params.protocols must be a non-empty array";
        }
        break;
    }
    return null;
  }

  /**
   * FIX #3: Find an existing active subscription on this socket with the
   * same type + params, so repeated subscribe calls don't pile up duplicates.
   */
  private findExistingSubscription(
    socketId: string,
    type: SubscribableType,
    params: GatewayRequestParams
  ): GatewaySubscription | undefined {
    const subs = this.socketSubscriptions.get(socketId) || [];
    const paramsKey = JSON.stringify(params);
    return subs.find(
      (s) => s.active && s.type === type && JSON.stringify(s.params) === paramsKey
    );
  }

  /**
   * Handle subscription request
   */
  private handleSubscription(
    socket: GatewaySocket,
    type: SubscribableType,
    params: GatewayRequestParams,
    callback?: GatewayCallback
  ): void {
    try {
      const validationError = this.validateSubscriptionParams(type, params);
      if (validationError) {
        if (callback) callback({ success: false, error: validationError });
        return;
      }

      // FIX #3: dedup
      const existing = this.findExistingSubscription(socket.id, type, params);
      if (existing) {
        if (callback) {
          callback({
            success: true,
            subscriptionId: existing.id,
            type,
            message: `Already subscribed to ${type} with these params`,
          });
        }
        return;
      }

      // FIX #4: cap subscriptions per socket
      const currentSubs = this.socketSubscriptions.get(socket.id) || [];
      if (currentSubs.filter((s) => s.active).length >= MAX_SUBSCRIPTIONS_PER_SOCKET) {
        if (callback) {
          callback({
            success: false,
            error: `Subscription limit (${MAX_SUBSCRIPTIONS_PER_SOCKET}) reached for this connection`,
          });
        }
        return;
      }

      const subscriptionId = `sub:${socket.id}:${type}:${Date.now()}`;
      const userId = socket.data.user?.id || socket.data.user?.sub || 'guest';

      const subscription: GatewaySubscription = {
        id: subscriptionId,
        userId,
        socketId: socket.id,
        type,
        params,
        createdAt: new Date(),
        active: true,
      };

      this.subscriptions.set(subscriptionId, subscription);
      currentSubs.push(subscription);
      this.socketSubscriptions.set(socket.id, currentSubs);

      console.log(`[Gateway WS] Subscription created: ${subscriptionId} (${type})`);

      // Initial push
      this.requestData(type, params, socket, subscription);

      // FIX #2: actually wire up periodic polling + its cleanup, instead of
      // leaving updateUnsubscribers permanently empty.
      const interval = setInterval(() => {
        if (!subscription.active) {
          clearInterval(interval);
          return;
        }
        this.requestData(type, params, socket, subscription);
      }, POLL_INTERVAL_MS);
      this.updateUnsubscribers.set(subscriptionId, () => clearInterval(interval));

      if (callback) {
        callback({
          success: true,
          subscriptionId,
          type,
          message: `Subscribed to ${type} updates`,
        });
      }

      socket.emit("gateway:subscribed", {
        subscriptionId,
        type,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Gateway WS] Subscription error:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
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
      if (!subscriptionId) {
        if (callback) callback({ success: false, error: "Missing subscriptionId" });
        return;
      }

      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        if (callback) callback({ success: false, error: "Subscription not found" });
        return;
      }

      subscription.active = false;
      this.subscriptions.delete(subscriptionId);

      const subs = this.socketSubscriptions.get(socket.id) || [];
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index > -1) subs.splice(index, 1);

      const unsub = this.updateUnsubscribers.get(subscriptionId);
      if (unsub) {
        unsub();
        this.updateUnsubscribers.delete(subscriptionId);
      }

      console.log(`[Gateway WS] Unsubscribed: ${subscriptionId}`);

      if (callback) callback({ success: true, message: "Unsubscribed successfully" });

      socket.emit("gateway:unsubscribed", {
        subscriptionId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Gateway WS] Unsubscription error:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Handle direct data request (non-streaming)
   */
  private async handleDirectRequest(
    socket: GatewaySocket,
    payload: unknown,
    callback?: GatewayCallback
  ): Promise<void> {
    try {
      const request = (payload as GatewayRequestPayload) || {};
      const { type, params = {} } = request;
      let result = null;

      switch (type) {
        case "prices":
          result = await this.service.requestPrices(params.symbols ?? [], params.chains, params.source);
          break;
        case "liquidity":
          result = await this.service.requestLiquidity(params.pools, params.protocols, params.chain);
          break;
        case "apy":
          result = await this.service.requestAPY(params.protocols ?? [], params.assets, params.chain);
          break;
        case "risk":
          result = await this.service.requestRisk(params.protocols ?? []);
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
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Request data and emit to socket
   */
  private async requestData(
    type: SubscribableType,
    params: GatewayRequestParams,
    socket: GatewaySocket,
    subscription: GatewaySubscription
  ): Promise<void> {
    try {
      let result = null;

      switch (type) {
        case "prices":
          result = await this.service.requestPrices(params.symbols ?? [], params.chains, params.source);
          break;
        case "liquidity":
          result = await this.service.requestLiquidity(params.pools, params.protocols, params.chain);
          break;
        case "apy":
          result = await this.service.requestAPY(params.protocols ?? [], params.assets, params.chain);
          break;
        case "risk":
          result = await this.service.requestRisk(params.protocols ?? []);
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
   *
   * FIX #5: subscriptions now carry their own socketId, so this is a direct
   * lookup instead of a nested scan over every socket for every subscription.
   */
  private broadcastUpdate(type: string, message: GatewayMessage): void {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.type !== type || !subscription.active) continue;

      const socket = this.io.sockets.sockets.get(subscription.socketId);
      if (!socket) continue;

      socket.emit(`gateway:${type}_update`, {
        subscriptionId: subscription.id,
        type,
        data: message.payload?.data,
        timestamp: message.timestamp?.toISOString(),
      });
    }
  }

  /**
   * Handle socket disconnect
   */
  private handleDisconnect(socket: GatewaySocket): void {
    const userId = socket.data.user?.id || socket.data.user?.sub;
    console.log(`[Gateway WS] Client disconnected: ${socket.id} (user: ${userId})`);

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

  getIO(): SocketIOServer {
    return this.io;
  }

  getStats() {
    return {
      connectedClients: this.io.engine.clientsCount,
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter((s) => s.active).length,
      subscriptionsByType: {
        prices: Array.from(this.subscriptions.values()).filter((s) => s.type === "prices" && s.active).length,
        liquidity: Array.from(this.subscriptions.values()).filter((s) => s.type === "liquidity" && s.active).length,
        apy: Array.from(this.subscriptions.values()).filter((s) => s.type === "apy" && s.active).length,
        risk: Array.from(this.subscriptions.values()).filter((s) => s.type === "risk" && s.active).length,
      },
    };
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    console.log("[Gateway WS] Shutting down WebSocket server...");

    for (const [, unsub] of this.updateUnsubscribers) {
      unsub();
    }
    this.updateUnsubscribers.clear();

    this.io.disconnectSockets();
    // No-op: shared middleware is applied at construction

    console.log("[Gateway WS] Shutdown complete");
  }
}
