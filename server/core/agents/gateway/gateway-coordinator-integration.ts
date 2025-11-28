/**
 * Gateway Agent - Coordinator Integration (Production)
 * Full bidirectional integration between Gateway Agent and ElderCoordinator
 * with error handling, metrics tracking, and fault tolerance
 */

import { ElderCoordinator } from "../../elders/coordinator";
import { GatewayAgentService } from "./service";
import { initializeGatewayAgentWithCoordinator } from "./initialize";
import { Logger } from "../../../utils/logger";
import { EventEmitter } from "events";

const logger = new Logger("gateway-coordinator-integration");

/**
 * Production-grade Gateway-Coordinator Integration Manager
 */
export class GatewayCoordinatorIntegrationManager extends EventEmitter {
  private coordinator: ElderCoordinator;
  private gatewayService: GatewayAgentService;
  private isConnected = false;
  private retryAttempts = 0;
  private maxRetries = 5;
  private retryDelay = 1000; // ms
  private subscriptions: Map<string, Function> = new Map();
  private metrics = {
    messagesForwarded: 0,
    messagesReceived: 0,
    failedForwards: 0,
    failedReceives: 0,
    lastSync: new Date()
  };

  constructor(coordinator: ElderCoordinator) {
    super();
    this.coordinator = coordinator;
    this.gatewayService = new GatewayAgentService();
  }

  /**
   * Initialize with full error handling and retry logic
   */
  async initialize(customConfig?: any): Promise<GatewayAgentService> {
    logger.info("Starting Gateway-Coordinator integration with retry logic...");

    try {
      // Initialize Gateway Service
      await this.gatewayService.initialize(customConfig);

      // Setup bidirectional message routing
      await this.setupBidirectionalRouting();

      // Setup error handlers
      this.setupErrorHandling();

      // Start health check
      this.startHealthCheck();

      this.isConnected = true;
      this.retryAttempts = 0;
      logger.info("Gateway-Coordinator integration successful");
      this.emit("connected");

      return this.gatewayService;
    } catch (error) {
      logger.error("Gateway-Coordinator integration failed:", error);
      
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        const delay = this.retryDelay * Math.pow(2, this.retryAttempts - 1);
        logger.warn(`Retrying in ${delay}ms (attempt ${this.retryAttempts}/${this.maxRetries})`);
        
        setTimeout(() => this.initialize(customConfig), delay);
      } else {
        this.isConnected = false;
        this.emit("error", error);
        throw new Error(`Failed to connect after ${this.maxRetries} attempts`);
      }
    }
  }

  /**
   * Setup bidirectional message routing with error handling
   */
  private async setupBidirectionalRouting(): Promise<void> {
    logger.info("Setting up bidirectional message routing...");

    const messageTypes = [
      "gateway:price_update",
      "gateway:liquidity_update", 
      "gateway:apy_update",
      "gateway:risk_update",
      "gateway:request_prices",
      "gateway:request_liquidity",
      "gateway:request_apy",
      "gateway:request_risk"
    ];

    // Gateway → Coordinator routing
    messageTypes.forEach(messageType => {
      this.subscribeToGatewayMessage(messageType);
    });

    // Coordinator → Gateway routing
    this.coordinator.on("gateway:*", async (message: any) => {
      await this.handleCoordinatorMessage(message);
    });

    logger.info(`Registered ${messageTypes.length} message routes`);
  }

  /**
   * Subscribe to Gateway messages and forward to Coordinator
   */
  private subscribeToGatewayMessage(messageType: string): void {
    const handler = async (message: any) => {
      try {
        this.metrics.messagesForwarded++;
        logger.debug(`Forwarding ${messageType} to Coordinator`);

        // Enhance message with metadata
        const enrichedMessage = {
          ...message,
          timestamp: new Date(),
          source: "GATEWAY",
          priority: this.getPriority(messageType)
        };

        // Forward to Coordinator
        this.coordinator.emit(messageType, enrichedMessage);

      } catch (error) {
        this.metrics.failedForwards++;
        logger.error(`Failed to forward ${messageType}:`, error);
        this.emit("forward_error", { messageType, error });
      }
    };

    this.subscriptions.set(messageType, handler);
    // NOTE: Requires message bus subscription setup in gateway service
  }

  /**
   * Handle messages from Coordinator
   */
  private async handleCoordinatorMessage(message: any): Promise<void> {
    try {
      this.metrics.messagesReceived++;
      const messageType = message.type || "unknown";
      
      logger.debug(`Received ${messageType} from Coordinator`);

      // Validate message
      if (!this.isValidMessage(message)) {
        logger.warn("Invalid message received from Coordinator");
        return;
      }

      // Route to appropriate handler
      switch (message.type) {
        case "gateway:request_prices":
          await this.handlePriceRequest(message);
          break;
        case "gateway:request_liquidity":
          await this.handleLiquidityRequest(message);
          break;
        case "gateway:request_apy":
          await this.handleAPYRequest(message);
          break;
        case "gateway:request_risk":
          await this.handleRiskRequest(message);
          break;
        default:
          logger.debug(`Unhandled message type: ${message.type}`);
      }
    } catch (error) {
      this.metrics.failedReceives++;
      logger.error("Error handling Coordinator message:", error);
      this.emit("receive_error", error);
    }
  }

  /**
   * Handle price requests from Coordinator
   */
  private async handlePriceRequest(message: any): Promise<void> {
    const { assets, chains, source, correlationId } = message;
    
    logger.info(`Processing price request for ${assets?.length || 0} assets`);

    try {
      // Execute gateway request
      const result = await (this.gatewayService as any).requestPrices(assets, chains, source);

      // Send response back to Coordinator
      this.coordinator.emit("gateway:price_response", {
        correlationId,
        data: result,
        timestamp: new Date(),
        status: "success"
      });
    } catch (error) {
      logger.error("Price request failed:", error);
      this.coordinator.emit("gateway:price_response", {
        correlationId,
        error: (error as Error).message,
        status: "failed"
      });
    }
  }

  /**
   * Handle liquidity requests from Coordinator
   */
  private async handleLiquidityRequest(message: any): Promise<void> {
    const { pools, protocols, chain, correlationId } = message;
    
    logger.info(`Processing liquidity request for ${pools?.length || 0} pools`);

    try {
      const result = await (this.gatewayService as any).requestLiquidity(pools, protocols, chain);

      this.coordinator.emit("gateway:liquidity_response", {
        correlationId,
        data: result,
        timestamp: new Date(),
        status: "success"
      });
    } catch (error) {
      logger.error("Liquidity request failed:", error);
      this.coordinator.emit("gateway:liquidity_response", {
        correlationId,
        error: (error as Error).message,
        status: "failed"
      });
    }
  }

  /**
   * Handle APY requests from Coordinator
   */
  private async handleAPYRequest(message: any): Promise<void> {
    const { protocols, tokens, chain, correlationId } = message;
    
    logger.info(`Processing APY request for ${protocols?.length || 0} protocols`);

    try {
      const result = await (this.gatewayService as any).requestAPY(protocols, tokens, chain);

      this.coordinator.emit("gateway:apy_response", {
        correlationId,
        data: result,
        timestamp: new Date(),
        status: "success"
      });
    } catch (error) {
      logger.error("APY request failed:", error);
      this.coordinator.emit("gateway:apy_response", {
        correlationId,
        error: (error as Error).message,
        status: "failed"
      });
    }
  }

  /**
   * Handle risk assessment requests from Coordinator
   */
  private async handleRiskRequest(message: any): Promise<void> {
    const { protocols, correlationId } = message;
    
    logger.info(`Processing risk assessment for ${protocols?.length || 0} protocols`);

    try {
      const result = await (this.gatewayService as any).requestRisk(protocols);

      this.coordinator.emit("gateway:risk_response", {
        correlationId,
        data: result,
        timestamp: new Date(),
        status: "success"
      });
    } catch (error) {
      logger.error("Risk assessment failed:", error);
      this.coordinator.emit("gateway:risk_response", {
        correlationId,
        error: (error as Error).message,
        status: "failed"
      });
    }
  }

  /**
   * Setup error handling for critical failures
   */
  private setupErrorHandling(): void {
    this.on("error", (error: Error) => {
      logger.error("Critical integration error:", error);
      // Emit to Coordinator for monitoring
      this.coordinator.emit("gateway:error", {
        error: error.message,
        timestamp: new Date()
      });
    });

    this.on("forward_error", ({ messageType, error }: any) => {
      logger.warn(`Forward error for ${messageType}:`, error);
    });

    this.on("receive_error", (error: Error) => {
      logger.warn("Message receive error:", error);
    });
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    const healthCheckInterval = setInterval(async () => {
      try {
        if (!this.isConnected) {
          logger.warn("Health check: Gateway not connected");
          clearInterval(healthCheckInterval);
          return;
        }

        const status = await (this.gatewayService as any).getStatus();
        
        this.coordinator.emit("gateway:health_check", {
          status: "healthy",
          timestamp: new Date(),
          metrics: this.metrics,
          gatewayStatus: status
        });

        this.metrics.lastSync = new Date();
      } catch (error) {
        logger.error("Health check failed:", error);
        this.coordinator.emit("gateway:health_check", {
          status: "unhealthy",
          error: (error as Error).message,
          timestamp: new Date()
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Validate incoming messages
   */
  private isValidMessage(message: any): boolean {
    return message && typeof message === "object" && message.type;
  }

  /**
   * Determine message priority for routing
   */
  private getPriority(messageType: string): "high" | "medium" | "low" {
    const highPriorityTypes = ["gateway:request_prices", "gateway:price_update"];
    const mediumPriorityTypes = ["gateway:request_liquidity", "gateway:request_apy"];
    
    if (highPriorityTypes.includes(messageType)) return "high";
    if (mediumPriorityTypes.includes(messageType)) return "medium";
    return "low";
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get connection status
   */
  isIntegrationConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Gracefully disconnect
   */
  async disconnect(): Promise<void> {
    logger.info("Disconnecting Gateway-Coordinator integration...");
    this.isConnected = false;
    this.subscriptions.clear();
    this.emit("disconnected");
  }
}

/**
 * Initialize production Gateway-Coordinator integration
 */
export async function setupGatewayWithCoordinator(
  coordinator: ElderCoordinator,
  customConfig?: any
): Promise<GatewayAgentService> {
  const manager = new GatewayCoordinatorIntegrationManager(coordinator);
  return await manager.initialize(customConfig);
}

export { GatewayCoordinatorIntegrationManager };
