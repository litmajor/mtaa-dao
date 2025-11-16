/**
 * Gateway Agent Service
 * Orchestrates initialization, message handling, and lifecycle management
 * Bridges Gateway Agent with Message Bus and optional Coordinator
 */

import { GatewayAgent, getGatewayAgent, setGatewayAgent } from "./index";
import {
  MessageBusAdapter,
  CoordinatorBridge,
  getMessageBus,
  getCoordinatorBridge,
} from "./message-bus";
import { GatewayConfig, GatewayMessage } from "./types";
import { BaseAdapter } from "./adapters/base-adapter";

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
    console.log(`[${this.name}] Initializing...`);

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
      console.log(`[${this.name}] Initialization complete`);
    } catch (error) {
      console.error(`[${this.name}] Initialization failed:`, error);
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

    // Subscribe to price requests
    this.messageBus.subscribe("gateway:price_request", async (message) => {
      console.log(
        `[${this.name}] Processing price request:`,
        message.payload?.symbols?.slice(0, 3).join(",")
      );

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    // Subscribe to liquidity requests
    this.messageBus.subscribe("gateway:liquidity_request", async (message) => {
      console.log(`[${this.name}] Processing liquidity request`);

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    // Subscribe to APY requests
    this.messageBus.subscribe("gateway:apy_request", async (message) => {
      console.log(
        `[${this.name}] Processing APY request for protocols:`,
        message.payload?.protocols?.join(",")
      );

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    // Subscribe to risk requests
    this.messageBus.subscribe("gateway:risk_request", async (message) => {
      console.log(
        `[${this.name}] Processing risk request for protocols:`,
        message.payload?.protocols?.join(",")
      );

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    // Subscribe to cache invalidation
    this.messageBus.subscribe("gateway:cache_invalidate", async (message) => {
      console.log(`[${this.name}] Processing cache invalidation`);

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    // Subscribe to status requests
    this.messageBus.subscribe("gateway:status", async (message) => {
      console.log(`[${this.name}] Processing status request`);

      const response = await agent.handleMessage(message);
      if (response) {
        await this.messageBus.publish(response);
      }
    });

    console.log(`[${this.name}] Message handlers registered`);
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

    await this.messageBus.publish(request);
    return request;
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
    return request;
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
    return request;
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

export function resetGatewayAgentService(): void {
  serviceInstance = null;
}
