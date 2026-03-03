/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CIRCUIT BREAKER SERVICE - Phase 6: Error Handling & Graceful Degradation
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * **Circuit Breaker Pattern Implementation**
 * Protects system from cascade failures of external services
 * 
 * **States**:
 * • CLOSED (Normal): Requests pass through, failures tracked
 * • OPEN (Tripped): Requests fail fast, no external calls
 * • HALF_OPEN (Recovery): Limited requests allowed to test service health
 *
 * **Configuration**:
 * • Failure threshold: 5 failures in 60 seconds
 * • Trip duration: 30 seconds before attempting recovery
 * • Half-open test requests: 1-3 requests to verify recovery
 *
 * **Usage**:
 * ```typescript
 * const result = await withCircuitBreaker(
 *   () => ccxtService.fetchPrice(symbol),
 *   'ccxt-fetch-price'
 * );
 * ```
 *
 * **Protected Services**:
 * • CCXT (CEX price feeding)
 * • DEX Integration (AMM quotes)
 * • Price Oracle (alternative pricing)
 * • OHLCV Service (candle data)
 */

import { logger } from '../utils/logger';
import NodeCache from 'node-cache';

/**
 * Circuit breaker state enum
 */
export enum CircuitState {
  CLOSED = 'CLOSED',          // Normal operation
  OPEN = 'OPEN',              // Tripped - fail fast
  HALF_OPEN = 'HALF_OPEN',    // Testing recovery
}

/**
 * Circuit breaker metrics
 */
export interface CircuitMetrics {
  state: CircuitState;
  failureCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  successCount: number;
  totalRequests: number;
  failureRate: number; // 0-100
  tripTime?: number;
  recoveryAttempts: number;
}

/**
 * Circuit breaker configuration
 */
interface CircuitConfig {
  failureThreshold: number;      // 5: Number of failures to trip
  failureWindow: number;         // 60000: Time window for counting failures (ms)
  tripDuration: number;          // 30000: How long to stay open before half-open (ms)
  halfOpenRequests: number;      // 2: Requests allowed during half-open
  requestTimeout: number;        // 10000: Timeout for individual requests (ms)
}

/**
 * Circuit breaker state machine
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime: number = 0;
  private lastSuccessTime: number = 0;
  private tripTime: number = 0;
  private halfOpenRequests: number = 0;
  private recoveryAttempts: number = 0;

  private config: CircuitConfig = {
    failureThreshold: 5,
    failureWindow: 60000,
    tripDuration: 30000,
    halfOpenRequests: 2,
    requestTimeout: 10000,
  };

  constructor(private label: string) {
    logger.info(`[CircuitBreaker:${label}] Initialized with state CLOSED`);
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<CircuitConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug(`[CircuitBreaker:${this.label}] Config updated:`, this.config);
  }

  /**
   * Execute request with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check state and decide if we should allow the request
    if (!this.shouldAllowRequest()) {
      this.recordFailure();
      throw new Error(
        `Circuit breaker OPEN for ${this.label}. ` +
        `Recovery in ${Math.ceil((this.tripTime + this.config.tripDuration - Date.now()) / 1000)}s`
      );
    }

    try {
      // Execute with timeout protection
      const result = await Promise.race([
        fn(),
        this.createTimeout(),
      ]);

      this.recordSuccess();
      return result as T;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Check if we should allow this request
   */
  private shouldAllowRequest(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        // In closed state, allow all requests
        // But check if we should trip based on recent failures
        this.evaluateHealth();
        return this.state === CircuitState.CLOSED;

      case CircuitState.OPEN:
        // In open state, check if recovery window has passed
        const now = Date.now();
        if (now - this.tripTime > this.config.tripDuration) {
          logger.info(`[CircuitBreaker:${this.label}] Attempting recovery (HALF_OPEN)`);
          this.state = CircuitState.HALF_OPEN;
          this.halfOpenRequests = 0;
          this.recoveryAttempts++;
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // In half-open state, allow limited requests
        if (this.halfOpenRequests < this.config.halfOpenRequests) {
          this.halfOpenRequests++;
          return true;
        }
        return false;
    }
  }

  /**
   * Evaluate health and determine if circuit should trip
   */
  private evaluateHealth(): void {
    const now = Date.now();

    // Clear old failures outside the window
    if (this.lastFailureTime > 0 && now - this.lastFailureTime > this.config.failureWindow) {
      this.failureCount = 0;
      logger.debug(`[CircuitBreaker:${this.label}] Failure window expired, reset count`);
    }

    // Trip if threshold exceeded
    if (
      this.failureCount >= this.config.failureThreshold &&
      this.state === CircuitState.CLOSED
    ) {
      this.state = CircuitState.OPEN;
      this.tripTime = now;
      logger.error(
        `[CircuitBreaker:${this.label}] TRIPPED! ${this.failureCount} failures in ${this.config.failureWindow}ms`
      );
    }
  }

  /**
   * Record successful call
   */
  private recordSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    // If we're in half-open state and get success, close the circuit
    if (this.state === CircuitState.HALF_OPEN) {
      logger.info(`[CircuitBreaker:${this.label}] Recovery successful! Closing circuit`);
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.halfOpenRequests = 0;
    }

    // In closed state, success resets failure count
    if (this.state === CircuitState.CLOSED) {
      // Gradually reduce failure count on success
      if (this.failureCount > 0) {
        this.failureCount = Math.max(0, this.failureCount - 1);
      }
    }
  }

  /**
   * Record failed call
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // If we're in half-open state and get failure, reopen the circuit
    if (this.state === CircuitState.HALF_OPEN) {
      logger.warn(
        `[CircuitBreaker:${this.label}] Recovery failed, reopening circuit for another ${this.config.tripDuration}ms`
      );
      this.state = CircuitState.OPEN;
      this.tripTime = Date.now();
      this.halfOpenRequests = 0;
    }

    logger.warn(
      `[CircuitBreaker:${this.label}] Failure recorded (${this.failureCount}/${this.config.failureThreshold})`
    );
  }

  /**
   * Create timeout promise
   */
  private createTimeout(): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Request timeout after ${this.config.requestTimeout}ms`)),
        this.config.requestTimeout
      )
    );
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime || undefined,
      lastSuccessTime: this.lastSuccessTime || undefined,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failureRate: this.totalRequests > 0 ? (this.failureCount / this.totalRequests) * 100 : 0,
      tripTime: this.tripTime || undefined,
      recoveryAttempts: this.recoveryAttempts,
    };
  }

  /**
   * Reset circuit (manual recovery)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.tripTime = 0;
    this.halfOpenRequests = 0;
    logger.info(`[CircuitBreaker:${this.label}] Manually reset to CLOSED`);
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple circuit breakers for different services
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker for a service
   */
  getBreaker(label: string): CircuitBreaker {
    if (!this.breakers.has(label)) {
      this.breakers.set(label, new CircuitBreaker(label));
    }
    return this.breakers.get(label)!;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, CircuitMetrics> {
    const metrics = new Map<string, CircuitMetrics>();
    for (const [label, breaker] of this.breakers) {
      metrics.set(label, breaker.getMetrics());
    }
    return metrics;
  }

  /**
   * Check if any circuit is open
   */
  isAnyOpen(): boolean {
    for (const breaker of this.breakers.values()) {
      if (breaker.getMetrics().state === CircuitState.OPEN) {
        return true;
      }
    }
    return false;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

/**
 * Global circuit breaker registry
 */
const registry = new CircuitBreakerRegistry();

/**
 * Main API: Execute with circuit breaker protection
 * 
 * @param fn - Async function to execute
 * @param label - Circuit breaker label (e.g., 'ccxt-fetch-price')
 * @returns Promise with result or circuit breaker error
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  const breaker = registry.getBreaker(label);
  return breaker.execute(fn);
}

/**
 * Configure a specific circuit breaker
 */
export function configureCircuitBreaker(label: string, config: Partial<CircuitConfig>): void {
  const breaker = registry.getBreaker(label);
  breaker.setConfig(config);
}

/**
 * Get metrics for a specific circuit breaker
 */
export function getCircuitMetrics(label: string): CircuitMetrics {
  const breaker = registry.getBreaker(label);
  return breaker.getMetrics();
}

/**
 * Get all circuit breaker metrics
 */
export function getAllCircuitMetrics(): Map<string, CircuitMetrics> {
  return registry.getAllMetrics();
}

/**
 * Check if any circuit is open
 */
export function isAnyCircuitOpen(): boolean {
  return registry.isAnyOpen();
}

/**
 * Manually reset a circuit breaker
 */
export function resetCircuit(label: string): void {
  const breaker = registry.getBreaker(label);
  breaker.reset();
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuits(): void {
  registry.resetAll();
}

/**
 * Express middleware for circuit breaker protection on specific routes
 * Usage: app.get('/api/prices', circuitBreakerMiddleware('price-oracle'), priceHandler)
 */
export function circuitBreakerMiddleware(label: string) {
  return async (req: any, res: any, next: any) => {
    const breaker = registry.getBreaker(label);
    const metrics = breaker.getMetrics();

    // Add circuit status to request for handler awareness
    req.circuit = {
      isOpen: metrics.state === CircuitState.OPEN,
      metrics,
    };

    // If circuit is open, return 503 Service Unavailable
    if (metrics.state === CircuitState.OPEN) {
      const recoverySeconds = Math.ceil(
        (metrics.tripTime! + 30000 - Date.now()) / 1000
      );
      return res.status(503).json({
        error: 'External service temporarily unavailable',
        label,
        retryAfter: Math.max(1, recoverySeconds),
        state: metrics.state,
      });
    }

    next();
  };
}

// Export singleton registry for advanced usage
export { registry };
