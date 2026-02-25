import { logger } from '../utils/logger';
import { PaymentError, PaymentErrorHandler, PaymentErrorCode } from './paymentErrorHandler';
import { circuitBreakerRegistry } from '../core/consolidation/CircuitBreakerConsolidation';

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableErrorCodes?: PaymentErrorCode[];
}

/**
 * Default retry policies for different scenarios
 */
export const DEFAULT_RETRY_POLICIES = {
  // API calls to payment providers
  provider: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.2
  } as RetryPolicy,

  // Network requests
  network: {
    maxRetries: 5,
    initialDelayMs: 500,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.2
  } as RetryPolicy,

  // Database operations
  database: {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.1
  } as RetryPolicy,

  // Webhook processing
  webhook: {
    maxRetries: 2,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.2
  } as RetryPolicy
};

/**
 * Retry result tracking
 */
export interface RetryAttempt {
  attempt: number;
  timestamp: Date;
  error?: PaymentError;
  nextRetryIn?: number;
}

/**
 * Service for handling retries with exponential backoff
 */
export class RetryService {
  /**
   * Execute function with retry logic
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    policy: RetryPolicy = DEFAULT_RETRY_POLICIES.provider,
    context?: Record<string, any>
  ): Promise<T> {
    let lastError: PaymentError | Error | null = null;
    const attempts: RetryAttempt[] = [];

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      try {
        logger.debug('Retry attempt', {
          attempt: attempt + 1,
          maxRetries: policy.maxRetries + 1,
          context
        });

        const result = await fn();
        
        if (attempts.length > 0) {
          logger.info('Retry succeeded', {
            attempt: attempt + 1,
            totalAttempts: attempts.length + 1,
            context
          });
        }

        return result;
      } catch (error: any) {
        lastError = error;

        const paymentError = error instanceof PaymentError ? error : null;
        attempts.push({
          attempt: attempt + 1,
          timestamp: new Date(),
          error: paymentError || undefined
        });

        // Check if we should retry
        if (attempt < policy.maxRetries) {
          const shouldRetry = paymentError
            ? PaymentErrorHandler.shouldRetry(paymentError, attempt, policy.maxRetries)
            : this.shouldRetryError(error, policy.retryableErrorCodes);

          if (!shouldRetry) {
            logger.warn('Not retrying error', {
              attempt: attempt + 1,
              errorCode: paymentError?.code,
              errorMessage: error.message,
              reason: 'error not retryable',
              context
            });
            throw error;
          }

          // Calculate delay
          const delayMs = this.calculateDelay(attempt, policy);
          attempts[attempts.length - 1].nextRetryIn = delayMs;

          logger.warn('Retrying after error', {
            attempt: attempt + 1,
            nextRetryIn: `${delayMs}ms`,
            errorCode: paymentError?.code,
            errorMessage: error.message,
            context
          });

          // Wait before retry
          await this.delay(delayMs);
        } else {
          logger.error('Max retries exceeded', {
            attempt: attempt + 1,
            totalAttempts: attempts.length,
            errorCode: paymentError?.code,
            errorMessage: error.message,
            retryHistory: attempts,
            context
          });
        }
      }
    }

    // All retries exhausted
    if (lastError instanceof PaymentError) {
      throw lastError;
    }

    throw PaymentErrorHandler.createError(
      PaymentErrorCode.UNKNOWN_ERROR,
      `Failed after ${policy.maxRetries + 1} attempts: ${lastError?.message}`,
      { retryHistory: attempts, context }
    );
  }

  /**
   * Execute function with timeout
   */
  static async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number = 30000,
    timeoutMessage: string = 'Operation timed out'
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          reject(
            PaymentErrorHandler.createError(
              PaymentErrorCode.PROVIDER_TIMEOUT,
              timeoutMessage
            )
          );
        }, timeoutMs)
      )
    ]);
  }

  /**
   * Execute function with both retry and timeout
   */
  static async executeWithRetryAndTimeout<T>(
    fn: () => Promise<T>,
    retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICIES.provider,
    timeoutMs: number = 30000,
    context?: Record<string, any>
  ): Promise<T> {
    return this.executeWithRetry(
      () => this.executeWithTimeout(fn, timeoutMs),
      retryPolicy,
      context
    );
  }

  /**
   * Execute multiple operations in parallel with retries
   */
  static async executeInParallel<T>(
    operations: Array<{
      fn: () => Promise<T>;
      name: string;
      policy?: RetryPolicy;
    }>,
    options: {
      failFast?: boolean;
      timeout?: number;
    } = {}
  ): Promise<Array<{ name: string; result?: T; error?: PaymentError }>> {
    const promises = operations.map(op =>
      this.executeWithRetry(op.fn, op.policy, { operation: op.name })
        .then(result => ({ name: op.name, result }))
        .catch((error: any) => {
          if (options.failFast) {
            throw error;
          }
          return { name: op.name, error };
        })
    );

    return Promise.all(promises);
  }

  /**
   * Circuit breaker pattern - use consolidated CircuitBreakerRegistry
   * Temporarily disable operation after repeated failures
   */
  static async executeWithCircuitBreaker<T>(
    fn: () => Promise<T>,
    options: {
      failureThreshold?: number;
      recoveryTimeMs?: number;
      context?: Record<string, any>;
      domain?: string;
    } = {}
  ): Promise<T> {
    const failureThreshold = options.failureThreshold || 5;
    const recoveryTimeMs = options.recoveryTimeMs || 60000;
    const domain = options.domain || 'payment'; // Default domain
    const breaker = circuitBreakerRegistry.getOrCreate(domain, {
      failureThreshold,
      resetTimeout: recoveryTimeMs,
    });

    try {
      return await breaker.execute(fn());
    } catch (error) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.PROVIDER_SERVICE_UNAVAILABLE,
        'Service temporarily unavailable due to repeated failures',
        {
          circuitBreakerOpen: breaker.getState() === 'OPEN',
          recoveryTimeMs,
          context: options.context
        }
      );
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private static calculateDelay(attemptCount: number, policy: RetryPolicy): number {
    const exponentialDelay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attemptCount);
    const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs);
    const jitter = cappedDelay * policy.jitterFactor * (Math.random() - 0.5) * 2;
    return Math.max(0, cappedDelay + jitter);
  }

  /**
   * Check if error is retryable (generic error handling)
   */
  private static shouldRetryError(error: any, retryableCodes?: PaymentErrorCode[]): boolean {
    // Network errors are always retryable
    if (error.code?.includes('ERR_') || error.code?.includes('E')) {
      return true;
    }

    // Check for specific HTTP status codes
    if (error.status) {
      // Retryable HTTP statuses: 408 (timeout), 429 (rate limit), 500-599 (server errors)
      return [408, 429, 500, 502, 503, 504].includes(error.status);
    }

    // Check retryable code list if provided
    if (retryableCodes && error.code) {
      return retryableCodes.includes(error.code);
    }

    return false;
  }

  /**
   * Sleep/delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Decorator for automatic retry
 */
export function Retryable(policy: RetryPolicy = DEFAULT_RETRY_POLICIES.provider) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return RetryService.executeWithRetry(
        () => originalMethod.apply(this, args),
        policy,
        { method: propertyKey }
      );
    };

    return descriptor;
  };
}
