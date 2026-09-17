/**
 * Gateway Agent Service
 * Orchestrates initialization, message handling, and lifecycle management
 * Bridges Gateway Agent with Message Bus and optional Coordinator
 */

import { GatewayAgent, getGatewayAgent, setGatewayAgent } from "./index";
import { logger } from '../../../utils/logger';
import {
  MessageBusAdapter,
  type CoordinatorBridge,
  getMessageBus,
  getCoordinatorBridge,
} from "./message-bus";
import type { GatewayConfig, GatewayMessage } from "./types";
import { type BaseAdapter } from "./adapters/base-adapter";

/**
 * Gateway Agent Service - Main entry point for gateway functionality
 */
export class GatewayAgentService {
  private name = "GATEWAY-AGENT-SERVICE";
  private gatewayAgent: GatewayAgent | null = null;
  private messageBus: MessageBusAdapter;
  private coordinatorBridge: CoordinatorBridge;
  private adapters: Map<string, BaseAdapter> = new Map();
  private isInitialized = false;

  constructor() {
    this.messageBus = getMessageBus();
    this.coordinatorBridge = getCoordinatorBridge();
  }

  /**
   * Initialize Gateway Agent Service
   */
  async initialize(
    config: GatewayConfig,
    adapters: Map<string, BaseAdapter>,
    coordinatorInstance?: any
  ): Promise<void> {
    logger.info(`[${this.name}] Initializing...`);

    try {
      // Store adapters
      this.adapters = adapters;

      // Create Gateway Agent
      const agent = new GatewayAgent(config);
      setGatewayAgent(agent);
      this.gatewayAgent = agent;

      // Initialize Gateway Agent with adapters
      await this.gatewayAgent.initialize(adapters);

      // Setup message bus handlers
      this.setupMessageHandlers();

      // Register with Coordinator if available
      if (coordinatorInstance) {
        this.coordinatorBridge = getCoordinatorBridge(coordinatorInstance);
        this.coordinatorBridge.registerWithCoordinator(this.gatewayAgent);
      }

      this.isInitialized = true;
      logger.info(`[${this.name}] Initialization complete`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error || {});
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error(`[${this.name}] Initialization failed: ${msg}`, { stack });
      throw error;
    }
  }

  /**
   * Setup message bus handlers for all request types
   */
  private setupMessageHandlers(): void {
    if (!this.gatewayAgent) {
      throw new Error("Gateway Agent not initialized");
    }

    const agent = this.gatewayAgent;

    // Register each handler once per service lifecycle to avoid duplicate subscriptions.
    const handlers = new Map<string, (message: GatewayMessage) => Promise<void>>();

    // Subscribe to price requests
    handlers.set("gateway:price_request", async (message) => {
      logger.debug(`[${this.name}] Processing price request: ${message.payload?.symbols?.slice(0, 3).join(",")}`);

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    // Subscribe to liquidity requests
    handlers.set("gateway:liquidity_request", async (message) => {
      logger.debug(`[${this.name}] Processing liquidity request`);

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    // Subscribe to APY requests
    handlers.set("gateway:apy_request", async (message) => {
      logger.debug(`[${this.name}] Processing APY request for protocols: ${message.payload?.protocols?.join(",")}`);

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    // Subscribe to risk requests
    handlers.set("gateway:risk_request", async (message) => {
      logger.debug(`[${this.name}] Processing risk request for protocols: ${message.payload?.protocols?.join(",")}`);

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    // Subscribe to cache invalidation
    handlers.set("gateway:cache_invalidate", async (message) => {
      logger.debug(`[${this.name}] Processing cache invalidation`);

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    // Subscribe to status requests
    handlers.set("gateway:status", async (message) => {
      logger.debug(`[${this.name}] Processing status request`);

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    Array.from(handlers.entries()).forEach(([messageType, handler]) => {
      this.messageBus.subscribe(messageType as any, handler);
    });

    logger.info(`[${this.name}] Message handlers registered`);
  }

  /**
   * Request prices through message bus
   */
  async requestPrices(
    symbols: string[],
    chains?: string[],
    preferredSource?: string
  ): Promise<GatewayMessage | null> {
    if (!this.isInitialized) {
      throw new Error("Service not initialized");
    }

    const request = MessageBusAdapter.createRequest("price", {
      symbols,
      chains,
      preferredSource,
    });

    // Publish request and wait for correlated update message
    await this.messageBus.publish(request);

    const expectedUpdateType = request.type.replace("_request", "_update");
    return await new Promise<GatewayMessage | null>((resolve) => {
      const timeoutMs = 2000;
      let resolved = false;

      const unsubscribe = this.messageBus.subscribe(expectedUpdateType as any, async (msg) => {
        try {
          if (msg?.payload?.requestId && request.payload?.requestId && msg.payload.requestId === request.payload.requestId) {
            if (!resolved) {
              resolved = true;
              unsubscribe();
              resolve(msg);
            }
          }
        } catch (err) {
          // ignore handler errors
        }
      });

      // Fallback timeout: resolve with null after timeoutMs
      const t = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { unsubscribe(); } catch {}
          resolve(null);
        }
        clearTimeout(t);
      }, timeoutMs);
    });
  }

  /**
   * Request liquidity data through message bus
   */
  async requestLiquidity(
    pools?: string[],
    protocols?: string[],
    chain?: string
  ): Promise<GatewayMessage | null> {
    if (!this.isInitialized) {
      throw new Error("Service not initialized");
    }

    const request = MessageBusAdapter.createRequest("liquidity", {
      pools,
      protocols,
      chain,
    });

    await this.messageBus.publish(request);

    const expectedUpdateType = request.type.replace("_request", "_update");
    return await new Promise<GatewayMessage | null>((resolve) => {
      const timeoutMs = 2000;
      let resolved = false;

      const unsubscribe = this.messageBus.subscribe(expectedUpdateType as any, async (msg) => {
        try {
          if (msg?.payload?.requestId && request.payload?.requestId && msg.payload.requestId === request.payload.requestId) {
            if (!resolved) {
              resolved = true;
              unsubscribe();
              resolve(msg);
            }
          }
        } catch (err) {}
      });

      const t = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { unsubscribe(); } catch {}
          resolve(null);
        }
        clearTimeout(t);
      }, timeoutMs);
    });
  }

  /**
   * Request APY data through message bus
   */
  async requestAPY(
    protocols: string[],
    assets?: string[],
    chain?: string
  ): Promise<GatewayMessage | null> {
    if (!this.isInitialized) {
      throw new Error("Service not initialized");
    }

    const request = MessageBusAdapter.createRequest("apy", {
      protocols,
      assets,
      chain,
    });

    await this.messageBus.publish(request);

    const expectedUpdateType = request.type.replace("_request", "_update");
    return await new Promise<GatewayMessage | null>((resolve) => {
      const timeoutMs = 2000;
      let resolved = false;

      const unsubscribe = this.messageBus.subscribe(expectedUpdateType as any, async (msg) => {
        try {
          if (msg?.payload?.requestId && request.payload?.requestId && msg.payload.requestId === request.payload.requestId) {
            if (!resolved) {
              resolved = true;
              unsubscribe();
              resolve(msg);
            }
          }
        } catch (err) {}
      });

      const t = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { unsubscribe(); } catch {}
          resolve(null);
        }
        clearTimeout(t);
      }, timeoutMs);
    });
  }

  /**
   * Request risk data through message bus
   */
  async requestRisk(protocols: string[]): Promise<GatewayMessage | null> {
    if (!this.isInitialized) {
      throw new Error("Service not initialized");
    }

    const request = MessageBusAdapter.createRequest("risk", {
      protocols,
    });

    await this.messageBus.publish(request);

    const expectedUpdateType = request.type.replace("_request", "_update");
    return await new Promise<GatewayMessage | null>((resolve) => {
      const timeoutMs = 2000;
      let resolved = false;

      const unsubscribe = this.messageBus.subscribe(expectedUpdateType as any, async (msg) => {
        try {
          if (msg?.payload?.requestId && request.payload?.requestId && msg.payload.requestId === request.payload.requestId) {
            if (!resolved) {
              resolved = true;
              unsubscribe();
              resolve(msg);
            }
          }
        } catch (err) {}
      });

      const t = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { unsubscribe(); } catch {}
          resolve(null);
        }
        clearTimeout(t);
      }, timeoutMs);
    });
  }

  /**
   * Ask the gateway agent to evaluate whether an execution is safe
   * Returns the agent response (may include `isSafeToExecute` in payload.data)
   */
  async requestExecutionCheck(
    payload: { vaultId?: string; tokenSymbol?: string; amount?: number | string; chain?: string; tolerancePct?: number }
  ): Promise<GatewayMessage | null> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    // If the gateway agent instance is available, call handleMessage directly to get synchronous response
    if (this.gatewayAgent && typeof this.gatewayAgent.handleMessage === 'function') {
      const message = {
        type: 'gateway:execution_check',
        from: this.name,
        timestamp: new Date(),
        payload,
      } as GatewayMessage;

      const response = await this.gatewayAgent.handleMessage(message);
      return response;
    }

    // Fallback: publish through message bus and return the request
    const request = MessageBusAdapter.createRequest('risk', { protocols: [] });
    await this.messageBus.publish(request);
    return request;
  }

  /**
   * Get Gateway Agent status
   */
  async getStatus() {
    if (!this.gatewayAgent) {
      throw new Error("Gateway Agent not initialized");
    }

    return {
      service: {
        initialized: this.isInitialized,
        adaptersCount: this.adapters.size,
        messageBusStats: this.messageBus.getStats(),
      },
      gateway: await this.gatewayAgent.getStatus(),
      coordinator: this.coordinatorBridge.getStats(),
    };
  }

  /**
   * Shutdown service gracefully
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.name}] Shutting down...`);

    try {
      if (this.gatewayAgent) {
        await this.gatewayAgent.shutdown();
      }

      this.messageBus.clearSubscriptions();
      this.isInitialized = false;

      console.log(`[${this.name}] Shutdown complete`);
    } catch (error) {
      console.error(`[${this.name}] Shutdown error:`, error);
      throw error;
    }
  }

  /**
   * Health check
   */
  isHealthy(): boolean {
    return this.isInitialized && this.gatewayAgent !== null;
  }
}

/**
 * Singleton service instance
 */
let serviceInstance: GatewayAgentService | null = null;

export function getGatewayAgentService(): GatewayAgentService {
  if (!serviceInstance) {
    serviceInstance = new GatewayAgentService();
  }
  return serviceInstance;
}

export function setGatewayAgentService(service: GatewayAgentService): void {
  serviceInstance = service;
}

export function resetGatewayAgentService(): void {
  serviceInstance = null;
}
