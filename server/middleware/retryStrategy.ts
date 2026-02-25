/**
 * Retry Strategy with Exponential Backoff
 *
 * Provides utilities for retrying failed operations with exponential backoff
 * and optional circuit breaker patterns for resilience.
 *
 * Usage:
 * ```typescript
 * const result = await retryWithExponentialBackoff(
 *   () => someAsyncOperation(),
 *   {
 *     maxRetries: 3,
 *     initialDelayMs: 100,
 *     maxDelayMs: 2000,
 *     backoffMultiplier: 2
 *   }
 * );
 * ```
 */

import { AppError } from './errorHandler';
import { Logger } from '../utils/logger';

const logger = new Logger('retry-strategy');

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
};

/**
 * Retry an async operation with exponential backoff
 *
 * @param fn - The async function to retry
 * @param config - Retry configuration
 * @returns Promise resolving to the function result
 * @throws AppError if all retries are exhausted
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;
  let delayMs = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      logger.debug(`Attempt ${attempt}/${config.maxRetries}`, { delayMs });
      return await fn();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Attempt ${attempt} failed: ${lastError.message}`, {
        attempt,
        maxRetries: config.maxRetries,
        willRetry: attempt < config.maxRetries
      });

      // Don't retry on last attempt
      if (attempt === config.maxRetries) {
        logger.error(`All ${config.maxRetries} retry attempts exhausted`, {
          originalError: lastError.message
        });
        throw new AppError(
          `Operation failed after ${config.maxRetries} retries: ${lastError.message}`,
          500
        );
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Calculate next delay (exponential backoff)
      delayMs = Math.min(
        delayMs * config.backoffMultiplier,
        config.maxDelayMs
      );
    }
  }

  // Fallback (should not reach here)
  throw lastError || new AppError('Unknown error in retry logic', 500);
}

/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by temporarily stopping requests to a failing service.
 * States: closed (normal) → open (failing) → half-open (testing recovery)
 *
 * Usage:
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeoutMs: 30000,
 *   monitoringWindowMs: 60000
 * });
 *
 * const result = await breaker.execute(
 *   () => riskyOperation()
 * );
 * ```
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // # of failures before opening
  resetTimeoutMs: number; // How long to wait before trying again
  monitoringWindowMs: number; // Time window to count failures
}

export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private resetTimer: NodeJS.Timeout | null = null;
  private readonly name: string;

  constructor(
    private config: CircuitBreakerConfig,
    name: string = 'circuit-breaker'
  ) {
    this.name = name;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      logger.warn(`[${this.name}] Circuit breaker is OPEN`, {
        state: this.state,
        failureCount: this.failureCount
      });
      throw new AppError(
        'Service temporarily unavailable. Please try again in a moment.',
        503
      );
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
   * Called when operation succeeds
   */
  private onSuccess() {
    if (this.failureCount > 0) {
      logger.info(`[${this.name}] Operation succeeded, resetting failures`, {
        previousFailures: this.failureCount
      });
    }
    this.failureCount = 0;
    this.state = 'closed';
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  /**
   * Called when operation fails
   */
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.warn(`[${this.name}] Operation failed`, {
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold
    });

    // Open circuit if threshold exceeded
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      logger.error(`[${this.name}] Circuit breaker opened after ${this.failureCount} failures`, {
        willResetIn: this.config.resetTimeoutMs
      });

      // Schedule reset to half-open
      this.resetTimer = setTimeout(() => {
        this.state = 'half-open';
        this.failureCount = 0;
        logger.info(`[${this.name}] Circuit breaker half-opened, testing recovery`, {
          state: this.state
        });
      }, this.config.resetTimeoutMs);
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset() {
    logger.info(`[${this.name}] Circuit breaker manually reset`, {
      previousState: this.state,
      previousFailures: this.failureCount
    });
    this.state = 'closed';
    this.failureCount = 0;
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }
}
