/**
 * Gateway Agent - Main Orchestrator
 * Multi-API aggregation with failover, caching, and circuit breaking
 */

import { CircuitBreakerManager } from "./circuit-breaker";
import { DataNormalizer } from "./normalizer";
import { CacheManager } from "./cache-manager";
import {
  GatewayConfig,
  GatewayStatus,
  GatewayMessage,
  GatewayMessageType,
  GatewayMetrics,
  DataPayload,
  AdapterStatus,
  NormalizedData,
  BaseAdapterConfig,
} from "./types";
import { BaseAdapter } from "./adapters/base-adapter";

export class GatewayAgent {
  private name = "GATEWAY-AGENT";
  private config: GatewayConfig;
  private adapters = new Map<string, BaseAdapter>();
  private circuitBreakerManager: CircuitBreakerManager;
  private normalizer: DataNormalizer;
  private cacheManager: CacheManager;
  private metrics: GatewayMetrics;
  private startTime = Date.now();
  private requestQueue: GatewayMessage[] = [];
  private activeRequests = 0;
  private latencyHistory: number[] = [];

  constructor(config: GatewayConfig) {
    this.config = config;
    this.circuitBreakerManager = new CircuitBreakerManager();
    this.normalizer = new DataNormalizer({
      priceDecimalPlaces: 8,
      apyDecimalPlaces: 4,
      tvlDecimalPlaces: 2,
    });
    this.cacheManager = new CacheManager({
      enabled: true,
      maxItems: 10000,
      maxMemoryMb: 512,
      keyPrefix: "gateway:",
      defaultTtl: 300,
    });
    this.metrics = {
      requestsTotal: 0,
      requestsFailed: 0,
      avgLatencyMs: 0,
      maxLatencyMs: 0,
      p95LatencyMs: 0,
      failoverCount: 0,
      staleDataReturned: 0,
    };
  }

  /**
   * Initialize gateway with adapters
   */
  async initialize(adapters: Map<string, BaseAdapter>): Promise<void> {
    console.log(`[${this.name}] Initializing...`);

    // Initialize cache
    await this.cacheManager.initialize();

    // Register adapters
    for (const [name, adapter] of adapters) {
      this.adapters.set(name, adapter);
      console.log(`[${this.name}] Registered adapter: ${name}`);
    }

    // Initialize circuit breakers for each adapter
    for (const adapterName of this.config.priorityOrder) {
      if (this.adapters.has(adapterName)) {
        this.circuitBreakerManager.getBreaker(adapterName, this.config.circuitBreaker);
      }
    }

    console.log(`[${this.name}] Initialized with ${this.adapters.size} adapters`);
  }

  /**
   * Register an adapter at runtime
   */
  registerAdapter(name: string, adapter: BaseAdapter): void {
    this.adapters.set(name, adapter);
    this.circuitBreakerManager.getBreaker(name, this.config.circuitBreaker);
    console.log(`[${this.name}] Adapter registered at runtime: ${name}`);
  }

  /**
   * Process incoming message request
   */
  async handleMessage(message: GatewayMessage): Promise<GatewayMessage | null> {
    const requestId = `${this.name}:${Date.now()}:${Math.random()}`;

    try {
      this.metrics.requestsTotal++;

      if (this.activeRequests >= this.config.maxConcurrentRequests) {
        this.requestQueue.push(message);
        return null; // Request queued, will be processed later
      }

      this.activeRequests++;
      const startTime = Date.now();

      let response: GatewayMessage | null = null;

      switch (message.type) {
        case "gateway:price_request":
          response = await this.handlePriceRequest(message, requestId);
          break;
        case "gateway:liquidity_request":
          response = await this.handleLiquidityRequest(message, requestId);
          break;
        case "gateway:apy_request":
          response = await this.handleAPYRequest(message, requestId);
          break;
        case "gateway:risk_request":
          response = await this.handleRiskRequest(message, requestId);
          break;
        case "gateway:cache_invalidate":
          await this.invalidateCache(message.payload);
          response = this.createResponse(message.type, true, {}, requestId);
          break;
        case "gateway:status":
          response = await this.createStatusResponse(requestId);
          break;
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }

      const latencyMs = Date.now() - startTime;
      this.updateMetrics(latencyMs, response?.payload?.error ? 1 : 0);

      this.activeRequests--;
      return response;
    } catch (error) {
      this.metrics.requestsFailed++;
      this.activeRequests--;

      console.error(`[${this.name}] Error handling message:`, error);
      return this.createResponse(
        message.type,
        false,
        { error: (error as Error).message },
        requestId
      );
    }
  }

  /**
   * Handle price request with failover
   */
  private async handlePriceRequest(message: GatewayMessage, requestId: string): Promise<GatewayMessage> {
    const { symbols, chains, preferredSource } = message.payload;

    const results: NormalizedData[] = [];

    for (const symbol of symbols) {
      const result = await this.fetchWithFailover(
        "price",
        { symbol, chains, preferredSource },
        requestId
      );
      if (result) {
        if (Array.isArray(result)) {
          results.push(...result);
        } else {
          results.push(result);
        }
      }
    }

    return this.createResponse(message.type, results.length > 0, results, requestId);
  }

  /**
   * Handle liquidity request
   */
  private async handleLiquidityRequest(message: GatewayMessage, requestId: string): Promise<GatewayMessage> {
    const { pools, protocols, chain } = message.payload;

    const results: NormalizedData[] = [];

    // Fetch from each protocol
    for (const protocol of protocols || []) {
      const result = await this.fetchWithFailover(
        "liquidity",
        { protocol, pools, chain },
        requestId
      );
      if (result) {
        if (Array.isArray(result)) {
          results.push(...result);
        } else {
          results.push(result);
        }
      }
    }

    return this.createResponse(message.type, results.length > 0, results, requestId);
  }

  /**
   * Handle APY request
   */
  private async handleAPYRequest(message: GatewayMessage, requestId: string): Promise<GatewayMessage> {
    const { protocols, assets, chain } = message.payload;

    const results: NormalizedData[] = [];

    for (const protocol of protocols) {
      const result = await this.fetchWithFailover(
        "apy",
        { protocol, assets, chain },
        requestId
      );
      if (result) {
        if (Array.isArray(result)) {
          results.push(...result);
        } else {
          results.push(result);
        }
      }
    }

    return this.createResponse(message.type, results.length > 0, results, requestId);
  }

  /**
   * Handle risk request
   */
  private async handleRiskRequest(message: GatewayMessage, requestId: string): Promise<GatewayMessage> {
    const { protocols } = message.payload;

    const results: NormalizedData[] = [];

    for (const protocol of protocols) {
      const result = await this.fetchWithFailover(
        "risk",
        { protocol },
        requestId
      );
      if (result) {
        if (Array.isArray(result)) {
          results.push(...result);
        } else {
          results.push(result);
        }
      }
    }

    return this.createResponse(message.type, results.length > 0, results, requestId);
  }

  /**
   * Fetch from adapter with failover and caching
   */
  private async fetchWithFailover(
    dataType: string,
    params: any,
    requestId: string
  ): Promise<NormalizedData | NormalizedData[] | null> {
    const startTime = Date.now();

    // Generate cache key
    const cacheKey = this.generateCacheKey(dataType, params);

    // Try cache first
    try {
      const cachedData = await this.cacheManager.get<NormalizedData>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    } catch (error) {
      console.error("Cache retrieval error:", error);
    }

    // Try each adapter in priority order
    for (const adapterName of this.config.priorityOrder) {
      const adapter = this.adapters.get(adapterName);
      if (!adapter) continue;

      const breaker = this.circuitBreakerManager.getBreaker(adapterName);

      if (!breaker.canAttempt()) {
        console.log(`[${this.name}] Circuit breaker open for ${adapterName}, skipping`);
        continue;
      }

      try {
        const result = await adapter.fetch(dataType, params);

        if (result.success && result.data) {
          breaker.recordSuccess();

          // Normalize and cache the data
          let normalizedData = result.data;
          if (Array.isArray(normalizedData)) {
            normalizedData = normalizedData.map((item) =>
              this.normalizer.normalize(item)
            );
          } else {
            normalizedData = this.normalizer.normalize(normalizedData);
          }

          // Cache normalized data
          try {
            await this.cacheManager.set(cacheKey, normalizedData as NormalizedData);
          } catch (cacheError) {
            console.error("Cache write error:", cacheError);
          }

          return normalizedData;
        }

        breaker.recordFailure(new Error(result.error || "Unknown error"));
      } catch (error) {
        breaker.recordFailure(error as Error);
        console.error(
          `[${this.name}] ${adapterName} failed:`,
          (error as Error).message
        );
      }
    }

    // All adapters failed, try to get stale cached data
    try {
      const staleData = await this.cacheManager.get<NormalizedData>(cacheKey);
      if (staleData) {
        this.metrics.staleDataReturned++;
        console.warn(`[${this.name}] Returning stale cached data for: ${cacheKey}`);
        return staleData;
      }
    } catch (error) {
      console.error("Stale cache retrieval error:", error);
    }

    this.metrics.failoverCount++;
    return null;
  }

  /**
   * Generate cache key from data type and parameters
   */
  private generateCacheKey(dataType: string, params: any): string {
    const parts = [dataType];

    // Add identifiers to key based on data type
    if (params.symbol) parts.push(params.symbol);
    if (params.protocol) parts.push(params.protocol);
    if (params.chain) parts.push(params.chain);
    if (params.poolAddress) parts.push(params.poolAddress);

    return parts.join(":").toLowerCase();
  }

  /**
   * Invalidate cache for specific data
   */
  private async invalidateCache(payload: any): Promise<void> {
    console.log(`[${this.name}] Invalidating cache for:`, payload);

    if (payload.pattern) {
      await this.cacheManager.invalidate(payload.pattern);
    } else if (payload.dataType) {
      await this.cacheManager.invalidateByType(payload.dataType);
    } else if (payload.source) {
      await this.cacheManager.invalidateBySource(payload.source);
    } else {
      await this.cacheManager.clear();
    }

    // Also invalidate adapter-level caches
    for (const adapter of this.adapters.values()) {
      if (adapter.invalidateCache) {
        adapter.invalidateCache(payload);
      }
    }
  }

  /**
   * Get gateway status
   */
  async getStatus(): Promise<GatewayStatus> {
    const adapterStatuses: AdapterStatus[] = [];

    for (const [name, adapter] of this.adapters) {
      const breaker = this.circuitBreakerManager.getBreaker(name);
      const metrics = breaker.getMetrics();

      adapterStatuses.push({
        name,
        status: breaker.getState() === "closed" ? "healthy" : "degraded",
        lastCheck: new Date(),
        failureCount: metrics.failureCount,
        circuitBreakerState: metrics.state,
        nextCheckTime: new Date(Date.now() + 5000),
      });
    }

    // Get cache stats
    const cacheStats = await this.cacheManager.getStats();

    return {
      uptime: Date.now() - this.startTime,
      adapters: adapterStatuses,
      cache: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hitRate,
        entries: cacheStats.itemsStored,
        memoryUsageMB: Math.round(cacheStats.memoryUsageBytes / 1024 / 1024),
      },
      metrics: this.metrics,
      health: this.circuitBreakerManager.hasOpenBreaker() ? "degraded" : "healthy",
    };
  }

  /**
   * Update metrics
   */
  private updateMetrics(latencyMs: number, failureInc: number): void {
    // Update latency metrics
    const totalRequests = this.metrics.requestsTotal;
    this.metrics.avgLatencyMs =
      (this.metrics.avgLatencyMs * (totalRequests - 1) + latencyMs) / totalRequests;
    this.metrics.maxLatencyMs = Math.max(this.metrics.maxLatencyMs, latencyMs);
    this.metrics.p95LatencyMs = latencyMs; // Simplified, should calculate properly

    this.metrics.requestsFailed += failureInc;
  }

  /**
   * Create response message
   */
  private createResponse(
    type: GatewayMessageType,
    success: boolean,
    data: any,
    requestId: string
  ): GatewayMessage {
    return {
      type: type.replace("_request", "_update") as GatewayMessageType,
      from: this.name,
      timestamp: new Date(),
      payload: {
        success,
        data,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };
  }

  /**
   * Create status response
   */
  private async createStatusResponse(requestId: string): Promise<GatewayMessage> {
    return {
      type: "gateway:status",
      from: this.name,
      timestamp: new Date(),
      payload: {
        success: true,
        data: await this.getStatus(),
        requestId,
      },
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.name}] Shutting down...`);

    // Close cache manager
    await this.cacheManager.close();

    // Close all adapters
    for (const adapter of this.adapters.values()) {
      console.log(`[${this.name}] Closing adapter: ${adapter.getName()}`);
    }

    console.log(`[${this.name}] Shutdown complete`);
  }
}

/**
 * Singleton instance
 */
let gatewayAgentInstance: GatewayAgent | null = null;

export function getGatewayAgent(config?: GatewayConfig): GatewayAgent {
  if (!gatewayAgentInstance) {
    if (!config) throw new Error("Config required for first initialization");
    gatewayAgentInstance = new GatewayAgent(config);
  }
  return gatewayAgentInstance;
}

export function setGatewayAgent(agent: GatewayAgent): void {
  gatewayAgentInstance = agent;
}
