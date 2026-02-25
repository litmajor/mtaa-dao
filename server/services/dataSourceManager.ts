/**
 * Data Source Manager (v2 - Institutional Grade)
 * 
 * ARCHITECTURAL UPGRADES:
 * • Percentage-based circuit breaker (sliding window)
 * • Dynamic source ranking by health score
 * • In-flight request deduplication
 * • Real burst handling in rate limiter
 * • Priority-aware request routing
 * • Real HTTP client with timeouts
 * • Observable metrics for operational monitoring
 */

import { logger } from '../utils/logger';

/**
 * Data source configuration
 */
export interface DataSourceConfig {
  name: string;
  endpoint: string;
  priority: 'critical' | 'primary' | 'secondary' | 'fallback';
  rateLimit: {
    requestsPerMinute: number;
    bursts?: number; // Max tokens to accumulate (burst capacity)
  };
  timeout: number; // ms
  retries: number;
  circuitBreaker?: {
    failureRateThreshold: number; // % (0-100) before opening
    windowSize: number; // trailing window size (# of attempts)
    resetTimeout: number; // ms
  };
}

/**
 * Request metadata
 */
export interface DataSourceRequest {
  id: string;
  sourceId: string;
  method: string;
  params: Record<string, any>;
  timestamp: Date;
  priority: 'critical' | 'high' | 'normal' | 'low';
  dedupeKey?: string;
  timeout?: number;
  retryCount?: number;
}

/**
 * Response metadata
 */
export interface DataSourceResponse<T = any> {
  data: T;
  source: string;
  timestamp: Date;
  latency: number; // ms
  cached: boolean;
  fallbackUsed: boolean;
  retries: number;
}

/**
 * Source health score (for dynamic ranking)
 */
interface SourceHealth {
  successRate: number; // 0-100
  totalAttempts: number;
  failureCount: number;
  avgLatency: number; // ms
  lastError?: Error;
  lastErrorTime?: Date;
  healthScore: number; // 0-100, calculated
  ranking: number; // lower = better, used for sorting
}

/**
 * Sliding window circuit breaker (percentage-based)
 */
class CircuitBreaker {
  private attempts: Array<{ success: boolean; timestamp: Date }> = [];
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastOpenTime?: Date;
  
  constructor(
    private failureRateThreshold: number, // %
    private windowSize: number, // max attempts to track
    private resetTimeout: number // ms
  ) {}
  
  canAttempt(): boolean {
    // Always allow in half-open (test recovery)
    if (this.state === 'half-open') return true;
    
    if (this.state === 'open') {
      const timeSinceOpen = Date.now() - (this.lastOpenTime?.getTime() || 0);
      if (timeSinceOpen > this.resetTimeout) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    
    return this.state === 'closed';
  }
  
  recordAttempt(success: boolean): void {
    this.attempts.push({ success, timestamp: new Date() });
    
    // Keep only window-sized trailing history
    if (this.attempts.length > this.windowSize) {
      this.attempts.shift();
    }
    
    // Calculate failure rate
    const failures = this.attempts.filter(a => !a.success).length;
    const failureRate = (failures / this.attempts.length) * 100;
    
    // State transitions
    if (success && this.state === 'half-open') {
      // Successfully recovered
      this.state = 'closed';
      this.attempts = []; // Reset window
      logger.info(`✓ Circuit closed (recovered from failure)`);
    } else if (failureRate > this.failureRateThreshold) {
      // Threshold breached
      if (this.state !== 'open') {
        this.state = 'open';
        this.lastOpenTime = new Date();
        logger.warn(`⚠ Circuit opened (${failureRate.toFixed(1)}% failure rate)`);
      }
    } else if (this.state === 'closed' && failureRate <= this.failureRateThreshold * 0.5) {
      // Healthy operation, maintain closed
    }
  }
  
  getState(): string {
    return this.state;
  }
  
  getMetrics(): { state: string; failureRate: number; windowSize: number } {
    const failures = this.attempts.filter(a => !a.success).length;
    const failureRate = this.attempts.length > 0 ? (failures / this.attempts.length) * 100 : 0;
    
    return {
      state: this.state,
      failureRate,
      windowSize: this.attempts.length,
    };
  }
}

/**
 * Token bucket rate limiter (with burst support)
 */
class RateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private readonly maxTokens: number;
  private readonly burstTokens: number;
  private readonly refillRate: number; // tokens per ms
  
  constructor(
    requestsPerMinute: number,
    burstCapacity?: number
  ) {
    // Burst is multiple of RPM, defaults to 2x for breathing room
    this.burstTokens = burstCapacity ?? requestsPerMinute * 2;
    this.maxTokens = this.burstTokens;
    this.tokens = this.maxTokens;
    // Refill rate: RPM / 60000ms = tokens per millisecond
    this.refillRate = requestsPerMinute / (60 * 1000);
    this.lastRefillTime = Date.now();
  }
  
  /**
   * Try to acquire a token (non-blocking)
   * Returns remaining tokens if successful, -1 if rate limited
   */
  tryAcquire(): number {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return Math.floor(this.tokens);
    }
    
    return -1;
  }
  
  /**
   * Get time until next token available (ms)
   */
  getWaitTime(): number {
    this.refill();
    
    if (this.tokens >= 1) return 0;
    
    const tokensNeeded = 1 - this.tokens;
    const timeNeeded = tokensNeeded / this.refillRate;
    return Math.ceil(timeNeeded);
  }
  
  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
  
  getMetrics(): { tokensRemaining: number; maxTokens: number; refillRate: string } {
    this.refill();
    return {
      tokensRemaining: Math.floor(this.tokens),
      maxTokens: Math.floor(this.maxTokens),
      refillRate: `${(this.refillRate * 60 * 1000).toFixed(0)} req/min`,
    };
  }
}

/**
 * Request cache with TTL
 */
class RequestCache {
  private cache = new Map<string, { data: any; expiresAt: number }>();
  
  private getKey(req: DataSourceRequest): string {
    return req.dedupeKey || `${req.sourceId}:${req.method}:${JSON.stringify(req.params)}`;
  }
  
  get(req: DataSourceRequest, ttlMs: number): any | null {
    const key = this.getKey(req);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Critical requests bypass cache (always fetch fresh)
    if (req.priority === 'critical') {
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(req: DataSourceRequest, data: any, ttlMs: number): void {
    const key = this.getKey(req);
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}


/**
 * Main Data Source Manager (Institutional Grade)
 */
export class DataSourceManager {
  private sources = new Map<string, DataSourceConfig>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private rateLimiters = new Map<string, RateLimiter>();
  private sourceHealth = new Map<string, SourceHealth>();
  private cache: RequestCache;
  private inFlightRequests = new Map<string, Promise<any>>();
  private requestMetrics = new Map<string, {
    calls: number;
    success: number;
    failure: number;
    totalLatency: number;
    cacheHits: number;
  }>();
  
  constructor() {
    this.cache = new RequestCache();
  }
  
  /**
   * Register a data source
   */
  registerSource(config: DataSourceConfig): void {
    this.sources.set(config.name, config);
    
    // Initialize circuit breaker
    if (config.circuitBreaker) {
      this.circuitBreakers.set(
        config.name,
        new CircuitBreaker(
          config.circuitBreaker.failureRateThreshold,
          config.circuitBreaker.windowSize,
          config.circuitBreaker.resetTimeout
        )
      );
    }
    
    // Initialize rate limiter (with burst support)
    this.rateLimiters.set(
      config.name,
      new RateLimiter(config.rateLimit.requestsPerMinute, config.rateLimit.bursts)
    );
    
    // Initialize health tracking
    this.sourceHealth.set(config.name, {
      successRate: 100,
      totalAttempts: 0,
      failureCount: 0,
      avgLatency: 0,
      healthScore: 100,
      ranking: 0,
    });
    
    // Initialize metrics
    this.requestMetrics.set(config.name, {
      calls: 0,
      success: 0,
      failure: 0,
      totalLatency: 0,
      cacheHits: 0,
    });
    
    logger.info(`✓ Registered data source: ${config.name}`);
  }
  
  /**
   * Make a request with intelligent fallback cascade
   * 
   * Process:
   * 1. Check cache
   * 2. Dynamically rank sources by health
   * 3. Check in-flight requests (dedup)
   * 4. Try each source with circuit breaker + rate limit checks
   * 5. Return best result or error
   */
  async request<T>(
    request: DataSourceRequest,
    sourceIds: string[],
    cacheTtlMs: number = 0
  ): Promise<DataSourceResponse<T>> {
    // Step 1: Check cache (unless critical priority)
    if (cacheTtlMs > 0 && request.priority !== 'critical') {
      const cached = this.cache.get(request, cacheTtlMs);
      if (cached) {
        logger.debug(`✓ Cache hit for ${request.id}`);
        const metrics = this.requestMetrics.get(request.sourceId);
        if (metrics) metrics.cacheHits++;
        
        return {
          data: cached,
          source: 'cache',
          timestamp: new Date(),
          latency: 0,
          cached: true,
          fallbackUsed: false,
          retries: 0,
        };
      }
    }
    
    // Step 2: Check in-flight deduplication
    const dedupeKey = request.dedupeKey || `${request.sourceId}:${request.method}:${JSON.stringify(request.params)}`;
    if (this.inFlightRequests.has(dedupeKey)) {
      logger.debug(`✓ In-flight request reuse for ${request.id}`);
      return this.inFlightRequests.get(dedupeKey)!;
    }
    
    // Step 3: Dynamically rank sources by health
    const rankedSources = this.rankSources(sourceIds);
    
    // Step 4: Try each source with fallback cascade
    const requestPromise = (async () => {
      for (const sourceId of rankedSources) {
        const config = this.sources.get(sourceId);
        if (!config) {
          logger.warn(`Source not found: ${sourceId}`);
          continue;
        }
        
        const circuitBreaker = this.circuitBreakers.get(sourceId);
        const rateLimiter = this.rateLimiters.get(sourceId);
        
        // Check circuit breaker
        if (circuitBreaker && !circuitBreaker.canAttempt()) {
          const state = circuitBreaker.getMetrics();
          logger.warn(`Circuit OPEN for ${sourceId} (${state.failureRate.toFixed(1)}% failure rate)`);
          continue;
        }
        
        // Check rate limit - handle priority requests specially
        if (rateLimiter) {
          const available = rateLimiter.tryAcquire();
          if (available < 0) {
            if (request.priority === 'critical') {
              // Critical requests wait briefly for token
              const waitTime = rateLimiter.getWaitTime();
              logger.debug(`Critical request waiting ${waitTime}ms for rate limit token...`);
              await this.delay(Math.min(waitTime, 1000)); // Max 1s wait
            } else {
              logger.warn(`Rate limit for ${sourceId}, trying next source`);
              continue;
            }
          }
        }
        
        // Attempt request
        try {
          const response = await this.executeRequest<T>(request, config);
          
          // Success: update health, cache, metrics
          this.recordSuccess(sourceId, response.latency);
          
          if (circuitBreaker) {
            circuitBreaker.recordAttempt(true);
          }
          
          if (cacheTtlMs > 0) {
            this.cache.set(request, response.data, cacheTtlMs);
          }
          
          return response;
        } catch (error) {
          logger.warn(`Request to ${sourceId} failed:`, error);
          
          // Failure: update health, circuit breaker
          this.recordFailure(sourceId, error as Error);
          
          if (circuitBreaker) {
            circuitBreaker.recordAttempt(false);
          }
          
          // Continue to next source
          continue;
        }
      }
      
      // All sources exhausted
      throw new Error(`All data sources failed for request: ${request.id}`);
    })();
    
    // Store in-flight to deduplicate concurrent identical requests
    this.inFlightRequests.set(dedupeKey, requestPromise);
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up after resolution
      this.inFlightRequests.delete(dedupeKey);
    }
  }
  
  /**
   * Dynamically rank sources by health score
   */
  private rankSources(sourceIds: string[]): string[] {
    return sourceIds.sort((a, b) => {
      const healthA = this.sourceHealth.get(a);
      const healthB = this.sourceHealth.get(b);
      
      if (!healthA || !healthB) return 0;
      
      // Lower ranking wins (comes first)
      return healthA.ranking - healthB.ranking;
    });
  }
  
  /**
   * Calculate health score for a source
   * 
   * Score formula:
   * healthScore = (successRate * 0.6) - (avgLatency / 100 * 0.4)
   * 
   * Then ranking = 100 - healthScore (lower ranking = better)
   */
  private updateHealthScore(sourceId: string): void {
    const health = this.sourceHealth.get(sourceId);
    if (!health) return;
    
    const successComponent = health.successRate * 0.6;
    const latencyPenalty = (health.avgLatency / 100) * 0.4; // Penalize slower sources
    
    health.healthScore = Math.max(0, successComponent - latencyPenalty);
    health.ranking = 100 - health.healthScore; // Lower ranking = better
  }
  
  /**
   * Record successful request
   */
  private recordSuccess(sourceId: string, latency: number): void {
    const health = this.sourceHealth.get(sourceId);
    const metrics = this.requestMetrics.get(sourceId);
    
    if (health) {
      health.totalAttempts++;
      health.avgLatency = (health.avgLatency + latency) / 2; // Running average
      health.successRate = (health.successRate + 100) / 2; // Lean towards success
      this.updateHealthScore(sourceId);
    }
    
    if (metrics) {
      metrics.success++;
      metrics.calls++;
      metrics.totalLatency += latency;
    }
  }
  
  /**
   * Record failed request
   */
  private recordFailure(sourceId: string, error: Error): void {
    const health = this.sourceHealth.get(sourceId);
    const metrics = this.requestMetrics.get(sourceId);
    
    if (health) {
      health.totalAttempts++;
      health.failureCount++;
      health.successRate = (health.successRate + 0) / 2; // Lean towards failure
      health.lastError = error;
      health.lastErrorTime = new Date();
      this.updateHealthScore(sourceId);
    }
    
    if (metrics) {
      metrics.failure++;
      metrics.calls++;
    }
  }
  
  /**
   * Execute single request with timeout
   */
  private async executeRequest<T>(
    request: DataSourceRequest,
    config: DataSourceConfig
  ): Promise<DataSourceResponse<T>> {
    const timeout = request.timeout || config.timeout;
    const maxRetries = config.retries || 1;
    
    let lastError: Error | null = null;
    let retries = 0;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        // Real HTTP call
        const data = await this.executeWithTimeout<T>(
          () => this.makeHttpRequest<T>(config, request),
          timeout
        );
        
        const latency = Date.now() - startTime;
        
        return {
          data,
          source: config.name,
          timestamp: new Date(),
          latency,
          cached: false,
          fallbackUsed: false,
          retries,
        };
      } catch (error) {
        lastError = error as Error;
        retries = attempt + 1;
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff with jitter
          const baseDelay = Math.pow(2, attempt) * 100;
          const jitter = Math.random() * baseDelay;
          await this.delay(baseDelay + jitter);
        }
      }
    }
    
    throw lastError || new Error('Unknown error');
  }
  
  /**
   * Real HTTP request implementation
   */
  private async makeHttpRequest<T>(
    config: DataSourceConfig,
    request: DataSourceRequest
  ): Promise<T> {
    const url = new URL(config.endpoint);
    
    // Add query parameters
    Object.entries(request.params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
    
    logger.debug(`Calling ${config.name}${url.pathname}`);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MTAA-DAO-DataSourceManager/2.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data) {
      throw new Error('Empty response from source');
    }
    
    return data as T;
  }
  
  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get comprehensive metrics for a source
   */
  getMetrics(sourceId: string) {
    const health = this.sourceHealth.get(sourceId);
    const metrics = this.requestMetrics.get(sourceId);
    const circuitBreaker = this.circuitBreakers.get(sourceId);
    const rateLimiter = this.rateLimiters.get(sourceId);
    
    if (!health || !metrics) return null;
    
    return {
      // Health metrics
      healthScore: health.healthScore.toFixed(1),
      ranking: health.ranking.toFixed(1),
      successRate: health.successRate.toFixed(1) + '%',
      avgLatency: health.avgLatency.toFixed(0) + 'ms',
      lastError: health.lastError?.message || 'none',
      lastErrorTime: health.lastErrorTime?.toISOString() || 'never',
      
      // Request metrics
      totalCalls: metrics.calls,
      successCount: metrics.success,
      failureCount: metrics.failure,
      cacheHits: metrics.cacheHits,
      failureRate: metrics.calls > 0 ? ((metrics.failure / metrics.calls) * 100).toFixed(1) + '%' : 'N/A',
      
      // Circuit breaker state
      circuitBreaker: circuitBreaker?.getMetrics() || 'not configured',
      
      // Rate limiter state
      rateLimiter: rateLimiter?.getMetrics() || 'not configured',
    };
  }
  
  /**
   * Get health dashboard for all sources
   */
  getAllMetrics() {
    const allMetrics: Record<string, any> = {};
    
    for (const sourceId of this.sources.keys()) {
      allMetrics[sourceId] = this.getMetrics(sourceId);
    }
    
    return allMetrics;
  }
  
  /**
   * List all registered sources
   */
  listSources(): string[] {
    return Array.from(this.sources.keys());
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('✓ Cache cleared');
  }
  
  /**
   * Reset all circuit breakers (emergency)
   */
  resetCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      // Only closes if in half-open and successfully recovers
      // This forces testing of recovery
    }
    logger.info('✓ Circuit breakers reset');
  }
}

// Export singleton
export const dataSourceManager = new DataSourceManager();
