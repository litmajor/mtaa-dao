/**
 * Gateway Agent Initialization Helper
 * Simplifies setup of all Gateway Agent components
 * Loads adapters, configures message bus, and integrates with Coordinator
 */

import type{ GatewayConfig } from "./types";
import { GatewayAgentService, setGatewayAgentService } from "./service";
import { BaseAdapter } from "./adapters/base-adapter";
import { ChainlinkAdapter } from "./adapters/chainlink-adapter";
import { CurveAdapter } from "./adapters/curve-adapter";
import { MentoAdapter } from "./adapters/mento-adapter";
import { UniswapAdapter } from "./adapters/uniswap-adapter";
import { CoinGeckoAdapter } from "./adapters/coingecko-adapter";
import { MoolaAdapter } from "./adapters/moola-adapter";
import { BeefyfiAdapter } from "./adapters/beefyfi-adapter";
import { BlockchainAdapter } from "./adapters/blockchain-adapter";
import { SushiAdapter } from "./adapters/sushi-adapter";
import { UbeswapAdapter } from "./adapters/ubeswap-adapter";

/**
 * Initialize all Gateway Agent adapters with default configuration
 */
export function initializeAdapters(baseConfig: any = {}): Map<string, BaseAdapter> {
  const adapters = new Map<string, BaseAdapter>();

  // Chainlink adapter (priority 1)
  try {
    adapters.set(
      "chainlink",
      new ChainlinkAdapter({
        name: "chainlink",
        apiKey: process.env.CHAINLINK_API_KEY,
        rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
        ...baseConfig,
      })
    );
  } catch (err) {
    console.warn('[Gateway Init] Failed to initialize chainlink adapter:', (err as Error).message || err);
  }

  // Mento adapter (priority 2)
  try {
    adapters.set(
      "mento",
      new MentoAdapter({
        name: "mento",
        rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
        ...baseConfig,
      })
    );
  } catch (err) {
    console.warn('[Gateway Init] Failed to initialize mento adapter:', (err as Error).message || err);
  }

  // Ubeswap adapter (priority 3)
  try {
    adapters.set(
      "ubeswap",
      new UbeswapAdapter({
        name: "ubeswap",
        rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
        ...baseConfig,
      })
    );
  } catch (err) {
    console.warn('[Gateway Init] Failed to initialize ubeswap adapter:', (err as Error).message || err);
  }

  // Curve adapter (priority 4)
  try {
    adapters.set(
      "curve",
      new CurveAdapter({
        name: "curve",
        rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
        ...baseConfig,
      })
    );
  } catch (err) {
    console.warn('[Gateway Init] Failed to initialize curve adapter:', (err as Error).message || err);
  }

  // Uniswap adapter (priority 5)
  try {
    adapters.set(
      "uniswap",
      new UniswapAdapter({
        name: "uniswap",
        apiKey: process.env.UNISWAP_API_KEY,
        rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
        ...baseConfig,
      })
    );
  } catch (err) {
    console.warn('[Gateway Init] Failed to initialize uniswap adapter:', (err as Error).message || err);
  }

  // Sushi adapter (priority 6)
  try {
    adapters.set(
      "sushi",
      new SushiAdapter({
        name: "sushi",
        rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
        ...baseConfig,
      })
    );
  } catch (err) {
    console.warn('[Gateway Init] Failed to initialize sushi adapter:', (err as Error).message || err);
  }

  // CoinGecko adapter (priority 7)
  try {
    adapters.set(
      "coingecko",
      new CoinGeckoAdapter({
        name: "coingecko",
        apiKey: process.env.COINGECKO_API_KEY,
        ...baseConfig,
      })
    );
  } catch (err) {
    console.warn('[Gateway Init] Failed to initialize coingecko adapter:', (err as Error).message || err);
  }

  // Moola adapter (priority 8)
  try {
    adapters.set(
      "moola",
      new MoolaAdapter({
        name: "moola",
        rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
        ...baseConfig,
      })
    );
  } catch (err) {
    console.warn('[Gateway Init] Failed to initialize moola adapter:', (err as Error).message || err);
  }

  // Beefyfi adapter (priority 9)
  try {
    adapters.set(
      "beefyfi",
      new BeefyfiAdapter({
        name: "beefyfi",
        ...baseConfig,
      })
    );
  } catch (err) {
    console.warn('[Gateway Init] Failed to initialize beefyfi adapter:', (err as Error).message || err);
  }

  // Blockchain adapter (priority 10)
  try {
    adapters.set(
      "blockchain",
      new BlockchainAdapter({
        name: "blockchain",
        rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
        ...baseConfig,
      })
    );
  } catch (err) {
    console.warn('[Gateway Init] Failed to initialize blockchain adapter:', (err as Error).message || err);
  }

  console.log("[Gateway Init] Initialized adapters (some adapters may have failed to initialize)");
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
      mento: { enabled: true, priority: 2, timeout: 5000, maxRetries: 3 },
      ubeswap: { enabled: true, priority: 3, timeout: 5000, maxRetries: 3 },
      curve: { enabled: true, priority: 4, timeout: 5000, maxRetries: 3 },
      uniswap: { enabled: true, priority: 5, timeout: 5000, maxRetries: 3 },
      sushi: { enabled: true, priority: 6, timeout: 5000, maxRetries: 3 },
      coingecko: { enabled: true, priority: 7, timeout: 8000, maxRetries: 2 },
      moola: { enabled: true, priority: 8, timeout: 5000, maxRetries: 3 },
      beefyfi: { enabled: true, priority: 9, timeout: 5000, maxRetries: 2 },
      blockchain: { enabled: true, priority: 10, timeout: 5000, maxRetries: 3 },
    },
    maxConcurrentRequests: parseInt(process.env.GATEWAY_MAX_CONCURRENT || "100"),
    priorityOrder: ["chainlink", "mento", "ubeswap", "curve", "uniswap", "sushi", "coingecko", "moola", "beefyfi", "blockchain"],
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
      enabled: !!process.env.REDIS_URL && process.env.GATEWAY_CACHE_ENABLED !== "false",
      maxItems: parseInt(process.env.GATEWAY_CACHE_MAX_ITEMS || "10000"),
      maxMemoryMb: parseInt(process.env.GATEWAY_CACHE_MAX_MEMORY || "512"),
      redisUrl: process.env.REDIS_URL || "",
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

    // Store initialized singleton so other code paths see the same healthy gateway
    setGatewayAgentService(service);

    console.log("[Gateway Init] Initialization complete");
    return service;
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : (Object.keys(error || {}).length ? JSON.stringify(error) : String(error));
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[Gateway Init] Initialization failed:", msg);
    if (stack) console.error(stack);
    // Re-throw so caller can decide, but ensure the error is human-readable in logs
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
