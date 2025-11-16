/**
 * Gateway Agent - Coordinator Integration Example
 * Shows how to integrate Gateway Agent with existing Coordinator message bus
 * 
 * Usage:
 * import { setupGatewayWithCoordinator } from './gateway-coordinator-integration'
 * 
 * // In your app initialization:
 * const coordinator = getCoordinator(); // Get existing Coordinator instance
 * const gatewayService = await setupGatewayWithCoordinator(coordinator);
 * 
 * // Request prices through message bus:
 * await gatewayService.requestPrices(['BTC', 'ETH']);
 */

import { ElderCoordinator } from "../../elders/coordinator"; // Elder Coordinator class
import { GatewayAgentService } from "./service";
import { initializeGatewayAgentWithCoordinator } from "./initialize";

/**
 * Setup Gateway Agent with Coordinator integration
 * 
 * @param coordinator - Existing ElderCoordinator instance
 * @param customConfig - Optional custom Gateway configuration
 * @returns Initialized GatewayAgentService
 */
export async function setupGatewayWithCoordinator(
  coordinator: ElderCoordinator,
  customConfig?: any
): Promise<GatewayAgentService> {
  console.log("Setting up Gateway Agent with Coordinator integration...");

  // Initialize with Coordinator
  const service = await initializeGatewayAgentWithCoordinator(coordinator, customConfig);

  // Setup bidirectional message routing
  setupBidirectionalRouting(coordinator, service);

  console.log("Gateway Agent ready for Coordinator integration");
  return service;
}

/**
 * Setup bidirectional message routing between Gateway and Coordinator
 * Note: This is a reference implementation. Actual integration depends on
 * your message bus topology and Elder Coordinator usage.
 */
function setupBidirectionalRouting(coordinator: ElderCoordinator, service: GatewayAgentService): void {
  const name = "GATEWAY-COORDINATOR-ROUTING";

  console.log(`[${name}] Setting up bidirectional routing...`);

  // Subscribe to Gateway update messages and forward to Coordinator
  const messageBus = (service as any).messageBus;

  messageBus.subscribe("gateway:price_update", async (message: any) => {
    console.log(`[${name}] Forwarding price update to Coordinator`);
    // Use emit() instead of publish() for ElderCoordinator
    coordinator.emit("gateway:price_update", message);
  });

  messageBus.subscribe("gateway:liquidity_update", async (message: any) => {
    console.log(`[${name}] Forwarding liquidity update to Coordinator`);
    coordinator.emit("gateway:liquidity_update", message);
  });

  messageBus.subscribe("gateway:apy_update", async (message: any) => {
    console.log(`[${name}] Forwarding APY update to Coordinator`);
    coordinator.emit("gateway:apy_update", message);
  });

  messageBus.subscribe("gateway:risk_update", async (message: any) => {
    console.log(`[${name}] Forwarding risk update to Coordinator`);
    coordinator.emit("gateway:risk_update", message);
  });

  console.log(`[${name}] Bidirectional routing established`);
}

/**
 * Example usage patterns
 */
export const GatewayCoordinatorExamples = {
  /**
   * Example 1: Request prices through Coordinator message bus
   */
  async requestPrices(service: GatewayAgentService) {
    console.log("Example: Requesting prices...");
    const request = await service.requestPrices(
      ["BTC", "ETH", "cUSD"],
      ["celo"],
      "chainlink"
    );
    console.log("Price request sent:", request?.payload.requestId);
  },

  /**
   * Example 2: Request APY data from lending protocols
   */
  async requestAPY(service: GatewayAgentService) {
    console.log("Example: Requesting APY data...");
    const request = await service.requestAPY(
      ["moola", "beefyfi"],
      ["cUSD", "USDC"],
      "celo"
    );
    console.log("APY request sent:", request?.payload.requestId);
  },

  /**
   * Example 3: Request liquidity data from DEXes
   */
  async requestLiquidity(service: GatewayAgentService) {
    console.log("Example: Requesting liquidity...");
    const request = await service.requestLiquidity(
      ["CELO-cUSD", "ETH-USDC"], // Pool addresses/pairs
      ["uniswap"],
      "celo"
    );
    console.log("Liquidity request sent:", request?.payload.requestId);
  },

  /**
   * Example 4: Request risk assessment
   */
  async requestRisk(service: GatewayAgentService) {
    console.log("Example: Requesting risk data...");
    const request = await service.requestRisk(["moola", "uniswap"]);
    console.log("Risk request sent:", request?.payload.requestId);
  },

  /**
   * Example 5: Get service status
   */
  async getStatus(service: GatewayAgentService) {
    console.log("Example: Getting service status...");
    const status = await service.getStatus();
    console.log("Service status:", JSON.stringify(status, null, 2));
  },

  /**
   * Example 6: Handle responses through Coordinator
   */
  setupResponseHandlers(coordinator: ElderCoordinator) {
    console.log("Example: Setting up response handlers...");

    // Subscribe to price updates
    coordinator.on("gateway:price_update", (message: any) => {
      console.log("Price update received:", message.payload?.data);
      // Process price data in your application
    });

    // Subscribe to APY updates
    coordinator.on("gateway:apy_update", (message: any) => {
      console.log("APY update received:", message.payload?.data);
      // Process APY data in your application
    });

    // Subscribe to liquidity updates
    coordinator.on("gateway:liquidity_update", (message: any) => {
      console.log("Liquidity update received:", message.payload?.data);
      // Process liquidity data in your application
    });

    // Subscribe to risk updates
    coordinator.on("gateway:risk_update", (message: any) => {
      console.log("Risk update received:", message.payload?.data);
      // Process risk data in your application
    });

    console.log("Response handlers registered with Coordinator");
  },

  /**
   * Example 7: Complete workflow
   */
  async completeWorkflow(coordinator: ElderCoordinator) {
    console.log("Example: Complete Gateway workflow...");

    // Setup Gateway
    const service = await setupGatewayWithCoordinator(coordinator);

    // Setup response handlers
    this.setupResponseHandlers(coordinator);

    // Request multiple data types
    await this.requestPrices(service);
    await this.requestAPY(service);
    await this.requestLiquidity(service);
    await this.requestRisk(service);

    // Check status
    await this.getStatus(service);

    console.log("Complete workflow initiated");
  },
};
