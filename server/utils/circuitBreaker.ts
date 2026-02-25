/**
 * ⚠️ DEPRECATED - Circuit Breaker Pattern Implementation
 * 
 * This old circuit breaker has been consolidated into CircuitBreakerConsolidation (Phase 4)
 * 
 * MIGRATION GUIDE:
 * Old pattern (standalone implementation):
 *   import { CircuitBreaker, CircuitBreakerRegistry } from './utils/circuitBreaker'
 *   const breaker = new CircuitBreaker(config)
 *   await breaker.execute(fn)
 * 
 * New pattern (unified registry):
 *   import { circuitBreakerRegistry } from '../core/consolidation/CircuitBreakerConsolidation'
 *   const breaker = circuitBreakerRegistry.getOrCreate(domain, config)
 *   await breaker.execute(fn)
 * 
 * Key differences:
 *   - Old: Per-instance circuit breakers with manual management
 *   - New: Domain-scoped registry with automatic failure tracking
 *   - Old: Manual state transitions
 *   - New: Automatic exponential backoff and event emission
 * 
 * Files to migrate:
 *   - [ ] systemState.ts: Import circuitBreakerRegistry from consolidation instead
 *   - [ ] Any services using new CircuitBreaker() → use registry instead
 * 
 * This file will be removed in v2.0. Please migrate to CircuitBreakerConsolidation.
 * For questions: See CONSOLIDATION_INTEGRATION_GUIDE.md
 */

/**
 * Circuit Breaker Pattern
 * Prevents cascading failures in aggregation jobs
 * States: CLOSED (working) -> OPEN (failing) -> HALF_OPEN (recovering)
 */

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // failures before opening
  resetTimeout: number; // ms before attempting recovery
  monitoringWindow: number; // ms for counting failures
  name: string;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  openedAt: Date | null;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private openedAt: Date | null = null;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private resetTimer: NodeJS.Timeout | null = null;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.isResetTimeoutExpired()) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error(
          `Circuit breaker is OPEN for ${this.config.name}. ` +
          `Too many failures detected. Retry in ${this.getResetTimeRemaining()}ms`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess() {
    this.successCount++;
    this.totalSuccesses++;
    this.lastSuccessTime = new Date();

    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= Math.ceil(this.config.failureThreshold / 2)) {
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure() {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = new Date();

      this.resetTimer = setTimeout(() => {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      }, this.config.resetTimeout);
    }
  }

  /**
   * Reset circuit breaker to closed state
   */
  private reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = null;
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Check if reset timeout has expired
   */
  private isResetTimeoutExpired(): boolean {
    if (!this.openedAt) return false;
    return Date.now() - this.openedAt.getTime() >= this.config.resetTimeout;
  }

  /**
   * Get remaining time until reset attempt
   */
  private getResetTimeRemaining(): number {
    if (!this.openedAt) return 0;
    const elapsed = Date.now() - this.openedAt.getTime();
    return Math.max(0, this.config.resetTimeout - elapsed);
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      ...this.getMetrics(),
      name: this.config.name,
      isHealthy: this.state === 'CLOSED',
      failureRate: this.totalFailures + this.totalSuccesses > 0
        ? (this.totalFailures / (this.totalFailures + this.totalSuccesses)) * 100
        : 0,
    };
  }
}

/**
 * Circuit breaker registry
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  getOrCreate(name: string, config: Partial<CircuitBreakerConfig> = {}): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const finalConfig: CircuitBreakerConfig = {
      failureThreshold: config.failureThreshold || 5,
      resetTimeout: config.resetTimeout || 30000, // 30s
      monitoringWindow: config.monitoringWindow || 60000, // 1min
      name,
    };

    const breaker = new CircuitBreaker(finalConfig);
    this.breakers.set(name, breaker);
    return breaker;
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllStatuses() {
    const statuses: Record<string, any> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      statuses[name] = breaker.getStatus();
    }
    return statuses;
  }

  /**
   * Check if any circuit breaker is open
   */
  hasOpenCircuits(): boolean {
    for (const breaker of this.breakers.values()) {
      if (breaker.getStatus().state === 'OPEN') {
        return true;
      }
    }
    return false;
  }
}

// Global registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();
