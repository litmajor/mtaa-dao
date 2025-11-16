/**
 * Gateway Agent Message Bus Integration
 * Integrates with existing Coordinator message bus for inter-agent communication
 * Follows the pub/sub pattern for gateway:*_request and gateway:*_update messages
 */

import { EventEmitter } from "events";
import { GatewayMessage, GatewayMessageType } from "./types";

/**
 * Message handler function signature
 */
export type MessageHandler = (message: GatewayMessage) => Promise<void>;

/**
 * Message Bus Adapter - integrates with Coordinator message system
 * Provides pub/sub interface for Gateway Agent messages
 */
export class MessageBusAdapter extends EventEmitter {
  private name = "GATEWAY-MESSAGE-BUS";
  private handlers = new Map<string, MessageHandler[]>();
  private messageQueue: GatewayMessage[] = [];
  private isProcessing = false;
  private stats = {
    messagesPublished: 0,
    messagesProcessed: 0,
    messagesFailed: 0,
    subscriptions: 0,
  };

  constructor() {
    super();
    this.setupDefaultHandlers();
  }

  /**
   * Subscribe to specific message types
   */
  subscribe(messageType: GatewayMessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, []);
    }

    const handlers = this.handlers.get(messageType)!;
    handlers.push(handler);
    this.stats.subscriptions++;

    console.log(
      `[${this.name}] Subscribed to ${messageType} (${handlers.length} handler(s))`
    );

    // Return unsubscribe function
    return () => {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to multiple message types
   */
  subscribeMultiple(
    messageTypes: GatewayMessageType[],
    handler: MessageHandler
  ): () => void {
    const unsubscribers = messageTypes.map((type) => this.subscribe(type, handler));

    // Return combined unsubscribe function
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  /**
   * Publish message to bus
   */
  async publish(message: GatewayMessage): Promise<void> {
    this.messageQueue.push(message);
    this.stats.messagesPublished++;

    // Process queue asynchronously
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * Publish multiple messages
   */
  async publishMultiple(messages: GatewayMessage[]): Promise<void> {
    for (const message of messages) {
      await this.publish(message);
    }
  }

  /**
   * Process message queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()!;
        await this.processMessage(message);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process single message
   */
  private async processMessage(message: GatewayMessage): Promise<void> {
    try {
      const handlers = this.handlers.get(message.type) || [];

      if (handlers.length === 0) {
        console.warn(`[${this.name}] No handlers for message type: ${message.type}`);
        return;
      }

      // Execute all handlers concurrently
      const results = await Promise.allSettled(
        handlers.map((handler) => handler(message))
      );

      // Track failures
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        this.stats.messagesFailed++;
        console.error(
          `[${this.name}] ${failures.length}/${handlers.length} handlers failed for ${message.type}`
        );

        failures.forEach((failure, index) => {
          const reason = failure.status === "rejected" ? failure.reason : null;
          console.error(`  Handler ${index}: ${reason?.message || reason}`);
        });
      }

      this.stats.messagesProcessed++;
    } catch (error) {
      this.stats.messagesFailed++;
      console.error(`[${this.name}] Error processing message:`, error);
    }
  }

  /**
   * Get message statistics
   */
  getStats() {
    return {
      ...this.stats,
      queuedMessages: this.messageQueue.length,
      activeSubscriptions: Array.from(this.handlers.entries()).map(([type, handlers]) => ({
        type,
        handlerCount: handlers.length,
      })),
    };
  }

  /**
   * Clear all subscriptions for testing
   */
  clearSubscriptions(): void {
    this.handlers.clear();
    this.messageQueue = [];
    this.stats.subscriptions = 0;
    console.log(`[${this.name}] All subscriptions cleared`);
  }

  /**
   * Setup default handlers for logging
   */
  private setupDefaultHandlers(): void {
    // Message logging handler
    this.subscribe("gateway:price_request", async (message) => {
      console.debug(`[${this.name}] Price request:`, message.payload);
    });

    this.subscribe("gateway:liquidity_request", async (message) => {
      console.debug(`[${this.name}] Liquidity request:`, message.payload);
    });

    this.subscribe("gateway:apy_request", async (message) => {
      console.debug(`[${this.name}] APY request:`, message.payload);
    });

    this.subscribe("gateway:risk_request", async (message) => {
      console.debug(`[${this.name}] Risk request:`, message.payload);
    });
  }

  /**
   * Create request message
   */
  static createRequest(
    type: "price" | "liquidity" | "apy" | "risk",
    payload: any
  ): GatewayMessage {
    return {
      type: `gateway:${type}_request` as GatewayMessageType,
      from: "GATEWAY-MESSAGE-BUS",
      timestamp: new Date(),
      payload: {
        ...payload,
        requestId: `req:${Date.now()}:${Math.random()}`,
      },
    };
  }

  /**
   * Create update/response message
   */
  static createUpdate(
    type: "price" | "liquidity" | "apy" | "risk",
    data: any,
    success: boolean = true,
    error?: string
  ): GatewayMessage {
    return {
      type: `gateway:${type}_update` as GatewayMessageType,
      from: "GATEWAY-AGENT",
      timestamp: new Date(),
      payload: {
        success,
        data,
        error,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Coordinator Integration Wrapper
 * Bridges Gateway Agent with existing Coordinator message bus
 */
export class CoordinatorBridge {
  private name = "COORDINATOR-BRIDGE";
  private messageBus: MessageBusAdapter;
  private coordinatorInstance: any; // Reference to actual Coordinator instance

  constructor(messageBus: MessageBusAdapter, coordinatorInstance?: any) {
    this.messageBus = messageBus;
    this.coordinatorInstance = coordinatorInstance;
  }

  /**
   * Register Gateway Agent with Coordinator
   */
  registerWithCoordinator(gatewayAgent: any): void {
    if (!this.coordinatorInstance) {
      console.warn(
        `[${this.name}] Coordinator instance not available, using local message bus only`
      );
      return;
    }

    console.log(`[${this.name}] Registering Gateway Agent with Coordinator...`);

    // Subscribe to Coordinator messages and forward to local bus
    const requestTypes: GatewayMessageType[] = [
      "gateway:price_request",
      "gateway:liquidity_request",
      "gateway:apy_request",
      "gateway:risk_request",
    ];

    requestTypes.forEach((type) => {
      this.coordinatorInstance.subscribe(type, async (message: GatewayMessage) => {
        console.log(`[${this.name}] Received from Coordinator:`, type);
        await this.messageBus.publish(message);
      });
    });

    console.log(`[${this.name}] Gateway Agent registered with Coordinator`);
  }

  /**
   * Publish message to Coordinator
   */
  publishToCoordinator(message: GatewayMessage): void {
    if (!this.coordinatorInstance) {
      console.warn(`[${this.name}] Coordinator instance not available`);
      return;
    }

    this.coordinatorInstance.publish(message);
  }

  /**
   * Create a request and route through Coordinator
   */
  async requestThroughCoordinator(
    dataType: "price" | "liquidity" | "apy" | "risk",
    payload: any
  ): Promise<GatewayMessage | null> {
    const request = MessageBusAdapter.createRequest(dataType, payload);

    // Publish to message bus
    await this.messageBus.publish(request);

    // Also publish to Coordinator if available
    if (this.coordinatorInstance) {
      this.publishToCoordinator(request);
    }

    return request;
  }

  /**
   * Handle response from Coordinator
   */
  async handleCoordinatorResponse(message: GatewayMessage): Promise<void> {
    console.log(`[${this.name}] Processing Coordinator response:`, message.type);

    // Publish to local message bus for further processing
    await this.messageBus.publish(message);
  }

  /**
   * Get bridge statistics
   */
  getStats() {
    return {
      messageBusStats: this.messageBus.getStats(),
      coordinatorConnected: !!this.coordinatorInstance,
    };
  }
}

/**
 * Singleton instance for message bus
 */
let messageBusInstance: MessageBusAdapter | null = null;
let coordinatorBridgeInstance: CoordinatorBridge | null = null;

export function getMessageBus(): MessageBusAdapter {
  if (!messageBusInstance) {
    messageBusInstance = new MessageBusAdapter();
  }
  return messageBusInstance;
}

export function getCoordinatorBridge(
  coordinatorInstance?: any
): CoordinatorBridge {
  if (!coordinatorBridgeInstance) {
    coordinatorBridgeInstance = new CoordinatorBridge(
      getMessageBus(),
      coordinatorInstance
    );
  }
  return coordinatorBridgeInstance;
}

export function resetMessageBus(): void {
  messageBusInstance = null;
  coordinatorBridgeInstance = null;
}
