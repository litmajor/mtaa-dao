/**
 * Circuit Breaker Implementation for Gateway Adapters
 * Prevents cascading failures and enables graceful degradation
 */

import { CircuitBreakerConfig, CircuitBreakerState, CircuitBreakerMetrics } from "./types";

export class CircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private transitionTime = new Date();
  private halfOpenTimeout?: NodeJS.Timeout;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000, // 30 seconds
    }
  ) {}

  /**
   * Record a successful call
   */
  recordSuccess(): void {
    this.lastSuccessTime = new Date();

    if (this.state === "closed") {
      this.failureCount = 0;
      return;
    }

    if (this.state === "half-open") {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo("closed");
        this.successCount = 0;
      }
    }
  }

  /**
   * Record a failed call
   */
  recordFailure(error: Error): void {
    this.lastFailureTime = new Date();
    this.failureCount++;

    if (this.state === "closed" && this.failureCount >= this.config.failureThreshold) {
      this.transitionTo("open");
    }

    if (this.state === "half-open") {
      this.transitionTo("open");
    }
  }

  /**
   * Check if request can be attempted
   */
  canAttempt(): boolean {
    if (this.state === "closed") return true;

    if (this.state === "open") {
      const timeSinceOpen = Date.now() - this.transitionTime.getTime();
      if (timeSinceOpen >= this.config.timeout) {
        this.transitionTo("half-open");
        return true;
      }
      return false;
    }

    if (this.state === "half-open") return true;

    return false;
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      transitionTime: this.transitionTime,
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.transitionTo("closed");
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitBreakerState): void {
    const previousState = this.state;
    this.state = newState;
    this.transitionTime = new Date();

    // Clear half-open timeout if transitioning away from half-open
    if (this.halfOpenTimeout) {
      clearTimeout(this.halfOpenTimeout);
      this.halfOpenTimeout = undefined;
    }

    // Schedule transition from open to half-open
    if (newState === "open") {
      this.halfOpenTimeout = setTimeout(() => {
        if (this.state === "open") {
          this.transitionTo("half-open");
        }
      }, this.config.timeout);
    }

    console.log(
      `[CircuitBreaker] ${this.name}: ${previousState} → ${newState}`
    );
  }
}

/**
 * Circuit Breaker Manager for multiple adapters
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Create or get circuit breaker for adapter
   */
  getBreaker(adapterName: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(adapterName)) {
      this.breakers.set(adapterName, new CircuitBreaker(adapterName, config));
    }
    return this.breakers.get(adapterName)!;
  }

  /**
   * Get all breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get health of all breakers
   */
  getHealth(): Record<string, CircuitBreakerMetrics> {
    const health: Record<string, CircuitBreakerMetrics> = {};

    for (const [name, breaker] of this.breakers) {
      health[name] = breaker.getMetrics();
    }

    return health;
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Check if any breakers are open
   */
  hasOpenBreaker(): boolean {
    for (const breaker of this.breakers.values()) {
      if (breaker.getState() === "open") {
        return true;
      }
    }
    return false;
  }
}
