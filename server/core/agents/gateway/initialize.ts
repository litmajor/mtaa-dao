/**
 * Gateway Agent Initialization Helper
 * Simplifies setup of all Gateway Agent components
 * Loads adapters, configures message bus, and integrates with Coordinator
 */

import { GatewayConfig } from "./types";
import { GatewayAgentService } from "./service";
import { BaseAdapter } from "./adapters/base-adapter";
import { ChainlinkAdapter } from "./adapters/chainlink-adapter";
import { UniswapAdapter } from "./adapters/uniswap-adapter";
import { CoinGeckoAdapter } from "./adapters/coingecko-adapter";
import { MoolaAdapter } from "./adapters/moola-adapter";
import { BeefyfiAdapter } from "./adapters/beefyfi-adapter";
import { BlockchainAdapter } from "./adapters/blockchain-adapter";

/**
 * Initialize all Gateway Agent adapters with default configuration
 */
export function initializeAdapters(baseConfig: any = {}): Map<string, BaseAdapter> {
  const adapters = new Map<string, BaseAdapter>();

  // Chainlink adapter (priority 1)
  adapters.set(
    "chainlink",
    new ChainlinkAdapter({
      name: "chainlink",
      apiKey: process.env.CHAINLINK_API_KEY,
      rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
      ...baseConfig,
    })
  );

  // Uniswap adapter (priority 2)
  adapters.set(
    "uniswap",
    new UniswapAdapter({
      name: "uniswap",
      apiKey: process.env.UNISWAP_API_KEY,
      rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
      ...baseConfig,
    })
  );

  // CoinGecko adapter (priority 3)
  adapters.set(
    "coingecko",
    new CoinGeckoAdapter({
      name: "coingecko",
      apiKey: process.env.COINGECKO_API_KEY,
      ...baseConfig,
    })
  );

  // Moola adapter (priority 4)
  adapters.set(
    "moola",
    new MoolaAdapter({
      name: "moola",
      rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
      ...baseConfig,
    })
  );

  // Beefyfi adapter (priority 5)
  adapters.set(
    "beefyfi",
    new BeefyfiAdapter({
      name: "beefyfi",
      ...baseConfig,
    })
  );

  // Blockchain adapter (priority 6)
  adapters.set(
    "blockchain",
    new BlockchainAdapter({
      name: "blockchain",
      rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
      ...baseConfig,
    })
  );

  console.log("[Gateway Init] Initialized 6 adapters");
  return adapters;
}

/**
 * Get default Gateway Agent configuration
 */
export function getDefaultGatewayConfig(): GatewayConfig {
  return {
    enabled: true,
    adapters: {
      chainlink: { enabled: true, priority: 1, timeout: 5000, maxRetries: 3 },
      uniswap: { enabled: true, priority: 2, timeout: 5000, maxRetries: 3 },
      coingecko: { enabled: true, priority: 3, timeout: 8000, maxRetries: 2 },
      moola: { enabled: true, priority: 4, timeout: 5000, maxRetries: 3 },
      beefyfi: { enabled: true, priority: 5, timeout: 5000, maxRetries: 2 },
      blockchain: { enabled: true, priority: 6, timeout: 5000, maxRetries: 3 },
    },
    maxConcurrentRequests: parseInt(process.env.GATEWAY_MAX_CONCURRENT || "100"),
    priorityOrder: ["chainlink", "uniswap", "coingecko", "moola", "beefyfi", "blockchain"],
    fallbackOrder: ["coingecko", "blockchain"],
    requestTimeout: parseInt(process.env.GATEWAY_TIMEOUT || "10000"),
    enableMetrics: process.env.GATEWAY_METRICS_ENABLED !== "false",
    metricsInterval: parseInt(process.env.GATEWAY_METRICS_INTERVAL || "60000"),
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      halfOpenRequests: 3,
    },
    cache: {
      enabled: process.env.GATEWAY_CACHE_ENABLED !== "false",
      maxItems: parseInt(process.env.GATEWAY_CACHE_MAX_ITEMS || "10000"),
      maxMemoryMb: parseInt(process.env.GATEWAY_CACHE_MAX_MEMORY || "512"),
      redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
      keyPrefix: "gateway:",
      defaultTtl: 300,
    },
  };
}

/**
 * Initialize entire Gateway Agent system
 */
export async function initializeGatewayAgent(
  config?: Partial<GatewayConfig>,
  coordinatorInstance?: any,
  adapterConfig?: any
): Promise<GatewayAgentService> {
  try {
    console.log("[Gateway Init] Starting initialization...");

    // Merge configs
    const finalConfig = {
      ...getDefaultGatewayConfig(),
      ...config,
    };

    // Initialize adapters
    const adapters = initializeAdapters(adapterConfig);

    // Get service instance
    const service = new GatewayAgentService();

    // Initialize service
    await service.initialize(finalConfig, adapters, coordinatorInstance);

    console.log("[Gateway Init] Initialization complete");
    return service;
  } catch (error) {
    console.error("[Gateway Init] Initialization failed:", error);
    throw error;
  }
}

/**
 * Initialize Gateway Agent in standalone mode (without Coordinator)
 */
export async function initializeGatewayAgentStandalone(
  config?: Partial<GatewayConfig>,
  adapterConfig?: any
): Promise<GatewayAgentService> {
  return initializeGatewayAgent(config, undefined, adapterConfig);
}

/**
 * Initialize Gateway Agent with Coordinator integration
 */
export async function initializeGatewayAgentWithCoordinator(
  coordinatorInstance: any,
  config?: Partial<GatewayConfig>,
  adapterConfig?: any
): Promise<GatewayAgentService> {
  if (!coordinatorInstance) {
    throw new Error("Coordinator instance required for integration");
  }

  return initializeGatewayAgent(config, coordinatorInstance, adapterConfig);
}
