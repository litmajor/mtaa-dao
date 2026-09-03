import { logger } from '../utils/logger';

// ===== STRUCTURED CONTEXT TYPES =====

export interface PaymentErrorContext {
  /** Unique trace ID for cross-service correlation */
  traceId: string;
  /** Which service created/forwarded this error */
  service: 'gateway' | 'recovery' | 'saga' | 'execution' | 'reversibility';
  /** Original operation that failed */
  operation: string;
  /** User-facing reference if available */
  reference?: string;
  /** Provider involved, if any */
  provider?: string;
  /** User ID, if known */
  userId?: string;
  /** Amount being processed */
  amount?: number;
  /** Currency code */
  currency?: string;
  /** HTTP status from provider, if applicable */
  httpStatus?: number;
  /** Retry attempt number */
  attemptCount?: number;
  /** Additional provider-specific data */
  [key: string]: any;
}

/**
 * Payment-specific error types for better error classification and handling
 * 
 * CHANGES:
 * - Added traceId for cross-service correlation
 * - context replaces untyped metadata with structured PaymentErrorContext
 * - Added recoveryStrategy hint so upstream knows which strategy to use
 */
export class PaymentError extends Error {
  constructor(
    public code: PaymentErrorCode,
    public message: string,
    public statusCode: number = 400,
    public retryable: boolean = false,
    public context: PaymentErrorContext,
    /** Hint for recovery workflow strategy selection */
    public recoveryStrategy?: 'automatic_retry' | 'provider_fallback' | 'circuit_breaker_wait' | 'partial_payment' | 'manual_payment'
  ) {
    super(message);
    this.name = 'PaymentError';
    // Preserve stack trace
    Error.captureStackTrace?.(this, PaymentError);
  }

  /** Serialize for logging/monitoring without circular references */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      retryable: this.retryable,
      context: this.context,
      recoveryStrategy: this.recoveryStrategy,
      stack: this.stack,
    };
  }
}

/**
 * Error codes used across payment system
 * 
 * CHANGES:
 * - Added TIMEOUT, RATE_LIMIT_EXCEEDED, SERVICE_UNAVAILABLE, INSUFFICIENT_FUNDS
 *   (these were referenced by gateway/recovery but missing from enum)
 * - Deprecated INSUFFICIENT_BALANCE in favor of INSUFFICIENT_FUNDS for consistency
 *   with provider error taxonomy
 */
export enum PaymentErrorCode {
  // Configuration errors
  PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',

  // Validation errors
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_CURRENCY = 'INVALID_CURRENCY',
  INVALID_PROVIDER = 'INVALID_PROVIDER',
  INVALID_USER = 'INVALID_USER',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_PHONE = 'INVALID_PHONE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Limit errors
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  DAILY_LIMIT_EXCEEDED = 'DAILY_LIMIT_EXCEEDED',
  HOURLY_LIMIT_EXCEEDED = 'HOURLY_LIMIT_EXCEEDED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  /** @deprecated Use INSUFFICIENT_FUNDS instead */
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',

  // Provider API errors
  PROVIDER_API_ERROR = 'PROVIDER_API_ERROR',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  PROVIDER_RATE_LIMITED = 'PROVIDER_RATE_LIMITED',
  PROVIDER_SERVICE_UNAVAILABLE = 'PROVIDER_SERVICE_UNAVAILABLE',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Transaction errors
  TRANSACTION_ALREADY_PROCESSED = 'TRANSACTION_ALREADY_PROCESSED',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  INVALID_TRANSACTION_STATE = 'INVALID_TRANSACTION_STATE',
  WEBHOOK_SIGNATURE_INVALID = 'WEBHOOK_SIGNATURE_INVALID',

  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_LOCK = 'TRANSACTION_LOCK',

  // Payment status errors
  PAYMENT_DECLINED = 'PAYMENT_DECLINED',
  PAYMENT_CANCELLED = 'PAYMENT_CANCELLED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  REFUND_FAILED = 'REFUND_FAILED',

  // Circuit breaker / recovery
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',

  // Generic error
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Error categorization for better handling
 */
export enum PaymentErrorCategory {
  VALIDATION = 'validation',
  PROVIDER = 'provider',
  NETWORK = 'network',
  DATABASE = 'database',
  AUTHORIZATION = 'authorization',
  UNKNOWN = 'unknown'
}

/**
 * Recovery strategy mapping — tells the recovery workflow which strategy to use
 */
const RECOVERY_STRATEGY_MAP: Record<string, PaymentError['recoveryStrategy']> = {
  [PaymentErrorCode.TIMEOUT]: 'automatic_retry',
  [PaymentErrorCode.CONNECTION_TIMEOUT]: 'automatic_retry',
  [PaymentErrorCode.PROVIDER_TIMEOUT]: 'automatic_retry',
  [PaymentErrorCode.RATE_LIMIT_EXCEEDED]: 'automatic_retry',
  [PaymentErrorCode.PROVIDER_RATE_LIMITED]: 'automatic_retry',
  [PaymentErrorCode.PROVIDER_API_ERROR]: 'provider_fallback',
  [PaymentErrorCode.SERVICE_UNAVAILABLE]: 'circuit_breaker_wait',
  [PaymentErrorCode.PROVIDER_SERVICE_UNAVAILABLE]: 'circuit_breaker_wait',
  [PaymentErrorCode.PROVIDER_NOT_CONFIGURED]: 'provider_fallback',
  [PaymentErrorCode.INSUFFICIENT_FUNDS]: 'partial_payment',
  [PaymentErrorCode.INSUFFICIENT_BALANCE]: 'partial_payment',
  [PaymentErrorCode.CIRCUIT_BREAKER_OPEN]: 'circuit_breaker_wait',
  [PaymentErrorCode.NETWORK_ERROR]: 'automatic_retry',
  [PaymentErrorCode.DNS_RESOLUTION_FAILED]: 'automatic_retry',
};

/**
 * Creates a PaymentError with proper categorization and retry logic
 * 
 * CHANGES:
 * - context is now required and typed as PaymentErrorContext
 * - recoveryStrategy is auto-derived from error code
 * - traceId is generated if not provided
 */
export class PaymentErrorHandler {
  /**
   * Generate a trace ID for cross-service correlation
   */
  static generateTraceId(): string {
    return `pay-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Create a payment error with structured context
   */
  static createError(
    code: PaymentErrorCode,
    message: string,
    context: Partial<PaymentErrorContext> & { operation: string; service: PaymentErrorContext['service'] },
    metadata?: Record<string, any>
  ): PaymentError {
    const fullContext: PaymentErrorContext = {
      traceId: context.traceId || this.generateTraceId(),
      service: context.service,
      operation: context.operation,
      reference: context.reference,
      provider: context.provider,
      userId: context.userId,
      amount: context.amount,
      currency: context.currency,
      httpStatus: context.httpStatus,
      attemptCount: context.attemptCount,
      ...metadata,
    };

    const { statusCode, retryable, category } = this.getErrorConfig(code);
    const recoveryStrategy = RECOVERY_STRATEGY_MAP[code];

    const error = new PaymentError(
      code,
      message,
      statusCode,
      retryable,
      fullContext,
      recoveryStrategy
    );

    logger.error('Payment error created', error.toJSON());

    return error;
  }

  /**
   * Handle and categorize API errors from payment providers
   * 
   * CHANGES:
   * - Now returns PaymentError (was returning via createError, same behavior but typed)
   * - Maps provider HTTP status to structured PaymentErrorCode
   * - Extracts provider error codes from response body when available
   */
  static handleProviderError(
    provider: string,
    error: any,
    context: { operation: string; service: PaymentErrorContext['service']; traceId?: string; reference?: string; userId?: string }
  ): PaymentError {
    const baseContext: Partial<PaymentErrorContext> = {
      ...context,
      provider,
    };

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.name === 'AbortError') {
      return this.createError(
        PaymentErrorCode.TIMEOUT,
        `${provider} request timed out`,
        { ...baseContext, operation: context.operation, service: context.service },
        { originalErrorCode: error.code, originalMessage: error.message }
      );
    }

    // Handle rate limiting (HTTP 429)
    if (error.status === 429 || error.response?.status === 429) {
      return this.createError(
        PaymentErrorCode.RATE_LIMIT_EXCEEDED,
        `${provider} rate limit exceeded. Please try again later.`,
        { ...baseContext, operation: context.operation, service: context.service, httpStatus: 429 }
      );
    }

    // Handle service unavailable (HTTP 503)
    if (error.status === 503 || error.response?.status === 503) {
      return this.createError(
        PaymentErrorCode.SERVICE_UNAVAILABLE,
        `${provider} is temporarily unavailable. Please try again later.`,
        { ...baseContext, operation: context.operation, service: context.service, httpStatus: 503 }
      );
    }

    // Handle authentication errors (HTTP 401/403)
    if (error.status === 401 || error.status === 403 || error.response?.status === 401 || error.response?.status === 403) {
      return this.createError(
        PaymentErrorCode.INVALID_CONFIGURATION,
        `Invalid credentials for ${provider}. Contact support.`,
        { ...baseContext, operation: context.operation, service: context.service, httpStatus: error.status || error.response?.status }
      );
    }

    // Handle provider-specific error codes from response body
    const providerCode = error.response?.data?.code || error.response?.data?.error?.code;
    const providerMessage = error.response?.data?.message || error.response?.data?.error?.message;

    if (providerCode || providerMessage) {
      // Try to map provider-specific codes to our taxonomy
      const mappedCode = this.mapProviderErrorCode(providerCode, providerMessage, error.status);
      return this.createError(
        mappedCode,
        providerMessage || `${provider} API error: ${error.message || 'Unknown error'}`,
        { ...baseContext, operation: context.operation, service: context.service, httpStatus: error.status || error.response?.status },
        { providerCode, providerMessage }
      );
    }

    // Generic provider error
    return this.createError(
      PaymentErrorCode.PROVIDER_API_ERROR,
      `${provider} API error: ${error.message || 'Unknown error'}`,
      { ...baseContext, operation: context.operation, service: context.service, httpStatus: error.status || error.response?.status },
      { originalError: error.message, stack: error.stack }
    );
  }

  /**
   * Map provider-specific error codes to our PaymentErrorCode taxonomy
   */
  private static mapProviderErrorCode(
    providerCode?: string,
    providerMessage?: string,
    httpStatus?: number
  ): PaymentErrorCode {
    const msg = (providerMessage || '').toLowerCase();
    const code = (providerCode || '').toLowerCase();

    if (code.includes('timeout') || msg.includes('timeout') || msg.includes('timed out')) {
      return PaymentErrorCode.TIMEOUT;
    }
    if (code.includes('rate') || msg.includes('rate limit') || msg.includes('too many requests')) {
      return PaymentErrorCode.RATE_LIMIT_EXCEEDED;
    }
    if (code.includes('insufficient') || msg.includes('insufficient') || msg.includes('not enough')) {
      return PaymentErrorCode.INSUFFICIENT_FUNDS;
    }
    if (code.includes('unavailable') || msg.includes('unavailable') || msg.includes('maintenance')) {
      return PaymentErrorCode.SERVICE_UNAVAILABLE;
    }
    if (httpStatus === 500 || httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
      return PaymentErrorCode.PROVIDER_API_ERROR;
    }

    return PaymentErrorCode.PROVIDER_API_ERROR;
  }

  /**
   * Handle network errors
   */
  static handleNetworkError(
    error: any,
    context: { operation: string; service: PaymentErrorContext['service']; traceId?: string }
  ): PaymentError {
    if (error.code === 'ENOTFOUND' || error.code === 'ENETUNREACH') {
      return this.createError(
        PaymentErrorCode.DNS_RESOLUTION_FAILED,
        'Network error: Unable to reach payment provider',
        { ...context, operation: context.operation, service: context.service },
        { originalErrorCode: error.code }
      );
    }

    if (error.code === 'ECONNREFUSED') {
      return this.createError(
        PaymentErrorCode.NETWORK_ERROR,
        'Connection refused by payment provider',
        { ...context, operation: context.operation, service: context.service },
        { originalErrorCode: error.code }
      );
    }

    return this.createError(
      PaymentErrorCode.NETWORK_ERROR,
      `Network error: ${error.message || 'Unknown error'}`,
      { ...context, operation: context.operation, service: context.service },
      { originalErrorCode: error.code, originalMessage: error.message }
    );
  }

  /**
   * Handle database errors
   */
  static handleDatabaseError(
    error: any,
    operation: string,
    context: { service: PaymentErrorContext['service']; traceId?: string; reference?: string; userId?: string }
  ): PaymentError {
    // Handle deadlock errors
    if (error.code === 'DEADLOCK_DETECTED' || error.message?.includes('deadlock') || error.code === '40P01') {
      return this.createError(
        PaymentErrorCode.TRANSACTION_LOCK,
        `Database lock on ${operation}. Please try again.`,
        { ...context, operation, service: context.service },
        { originalErrorCode: error.code, retryable: true }
      );
    }

    // Handle unique constraint violations
    if (error.code === '23505' || error.constraint?.includes('unique') || error.message?.includes('unique')) {
      return this.createError(
        PaymentErrorCode.TRANSACTION_ALREADY_PROCESSED,
        'Transaction already exists',
        { ...context, operation, service: context.service },
        { originalErrorCode: error.code, constraint: error.constraint }
      );
    }

    // Handle connection errors
    if (error.code === 'ECONNREFUSED' || error.code === '08006' || error.code === '08001') {
      return this.createError(
        PaymentErrorCode.DATABASE_ERROR,
        `Database connection lost during ${operation}`,
        { ...context, operation, service: context.service },
        { originalErrorCode: error.code, retryable: true }
      );
    }

    return this.createError(
      PaymentErrorCode.DATABASE_ERROR,
      `Database error during ${operation}: ${error.message}`,
      { ...context, operation, service: context.service },
      { originalErrorCode: error.code, originalMessage: error.message }
    );
  }

  /**
   * Classify a free-text provider failure message into a PaymentErrorCode.
   * Used by the gateway when provider adapters return { success: false, message: string }
   * rather than throwing structured errors.
   */
  static classifyProviderFailure(message?: string): PaymentErrorCode {
    const m = (message || '').toLowerCase();

    if (m.includes('timeout') || m.includes('timed out')) return PaymentErrorCode.TIMEOUT;
    if (m.includes('rate limit') || m.includes('too many requests')) return PaymentErrorCode.RATE_LIMIT_EXCEEDED;
    if (m.includes('insufficient') || m.includes('not enough funds')) return PaymentErrorCode.INSUFFICIENT_FUNDS;
    if (m.includes('circuit') || m.includes('unavailable') || m.includes('maintenance')) return PaymentErrorCode.SERVICE_UNAVAILABLE;
    if (m.includes('provider') || m.includes('gateway') || m.includes('api error')) return PaymentErrorCode.PROVIDER_API_ERROR;

    return PaymentErrorCode.PROVIDER_API_ERROR;
  }

  /**
   * Get error configuration (status code, retry policy, etc.)
   */
  private static getErrorConfig(code: PaymentErrorCode): {
    statusCode: number;
    retryable: boolean;
    category: PaymentErrorCategory;
  } {
    const configs: Record<PaymentErrorCode, { statusCode: number; retryable: boolean; category: PaymentErrorCategory }> = {
      [PaymentErrorCode.PROVIDER_NOT_CONFIGURED]: {
        statusCode: 503,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.INVALID_CONFIGURATION]: {
        statusCode: 500,
        retryable: false,
        category: PaymentErrorCategory.PROVIDER
      },
      [PaymentErrorCode.MISSING_CREDENTIALS]: {
        statusCode: 500,
        retryable: false,
        category: PaymentErrorCategory.PROVIDER
      },
      [PaymentErrorCode.INVALID_AMOUNT]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.INVALID_CURRENCY]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.INVALID_PROVIDER]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.INVALID_USER]: {
        statusCode: 404,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.INVALID_EMAIL]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.INVALID_PHONE]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.LIMIT_EXCEEDED]: {
        statusCode: 429,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.DAILY_LIMIT_EXCEEDED]: {
        statusCode: 429,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.HOURLY_LIMIT_EXCEEDED]: {
        statusCode: 429,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.INSUFFICIENT_FUNDS]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.INSUFFICIENT_BALANCE]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.PROVIDER_API_ERROR]: {
        statusCode: 502,
        retryable: true,
        category: PaymentErrorCategory.PROVIDER
      },
      [PaymentErrorCode.PROVIDER_TIMEOUT]: {
        statusCode: 504,
        retryable: true,
        category: PaymentErrorCategory.PROVIDER
      },
      [PaymentErrorCode.PROVIDER_RATE_LIMITED]: {
        statusCode: 429,
        retryable: true,
        category: PaymentErrorCategory.PROVIDER
      },
      [PaymentErrorCode.PROVIDER_SERVICE_UNAVAILABLE]: {
        statusCode: 503,
        retryable: true,
        category: PaymentErrorCategory.PROVIDER
      },
      [PaymentErrorCode.TIMEOUT]: {
        statusCode: 504,
        retryable: true,
        category: PaymentErrorCategory.NETWORK
      },
      [PaymentErrorCode.RATE_LIMIT_EXCEEDED]: {
        statusCode: 429,
        retryable: true,
        category: PaymentErrorCategory.PROVIDER
      },
      [PaymentErrorCode.SERVICE_UNAVAILABLE]: {
        statusCode: 503,
        retryable: true,
        category: PaymentErrorCategory.PROVIDER
      },
      [PaymentErrorCode.NETWORK_ERROR]: {
        statusCode: 503,
        retryable: true,
        category: PaymentErrorCategory.NETWORK
      },
      [PaymentErrorCode.CONNECTION_TIMEOUT]: {
        statusCode: 504,
        retryable: true,
        category: PaymentErrorCategory.NETWORK
      },
      [PaymentErrorCode.DNS_RESOLUTION_FAILED]: {
        statusCode: 503,
        retryable: true,
        category: PaymentErrorCategory.NETWORK
      },
      [PaymentErrorCode.TRANSACTION_ALREADY_PROCESSED]: {
        statusCode: 409,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.TRANSACTION_NOT_FOUND]: {
        statusCode: 404,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.INVALID_TRANSACTION_STATE]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.WEBHOOK_SIGNATURE_INVALID]: {
        statusCode: 401,
        retryable: false,
        category: PaymentErrorCategory.AUTHORIZATION
      },
      [PaymentErrorCode.DATABASE_ERROR]: {
        statusCode: 500,
        retryable: true,
        category: PaymentErrorCategory.DATABASE
      },
      [PaymentErrorCode.TRANSACTION_LOCK]: {
        statusCode: 503,
        retryable: true,
        category: PaymentErrorCategory.DATABASE
      },
      [PaymentErrorCode.PAYMENT_DECLINED]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.PAYMENT_CANCELLED]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.PAYMENT_PENDING]: {
        statusCode: 202,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },
      [PaymentErrorCode.REFUND_FAILED]: {
        statusCode: 500,
        retryable: true,
        category: PaymentErrorCategory.PROVIDER
      },
      [PaymentErrorCode.CIRCUIT_BREAKER_OPEN]: {
        statusCode: 503,
        retryable: true,
        category: PaymentErrorCategory.PROVIDER
      },
      [PaymentErrorCode.UNKNOWN_ERROR]: {
        statusCode: 500,
        retryable: true,
        category: PaymentErrorCategory.UNKNOWN
      },
      [PaymentErrorCode.VALIDATION_ERROR]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      }
      
    };

    return configs[code] || configs[PaymentErrorCode.UNKNOWN_ERROR];
  }

  /**
   * Convert error to API response format
   */
  static toResponse(error: PaymentError | Error | any) {
    const isPaymentError = error instanceof PaymentError;

    return {
      success: false,
      error: {
        code: isPaymentError ? error.code : PaymentErrorCode.UNKNOWN_ERROR,
        message: error.message || 'An unexpected error occurred',
        statusCode: isPaymentError ? error.statusCode : 500,
        retryable: isPaymentError ? error.retryable : false,
        traceId: isPaymentError ? error.context.traceId : undefined,
        recoveryStrategy: isPaymentError ? error.recoveryStrategy : undefined,
        context: isPaymentError
          ? {
              service: error.context.service,
              operation: error.context.operation,
              provider: error.context.provider,
              reference: error.context.reference,
            }
          : undefined,
      }
    };
  }

  /**
   * Determine if error should trigger retry
   * 
   * CHANGES:
   * - Now accepts PaymentError instead of any for type safety
   * - Respects recoveryStrategy: if it's 'manual_payment', never retry automatically
   */
  static shouldRetry(error: PaymentError, attemptCount: number = 0, maxRetries: number = 3): boolean {
    if (!error.retryable || attemptCount >= maxRetries) {
      return false;
    }

    if (error.recoveryStrategy === 'manual_payment') {
      return false;
    }

    // Don't retry rate limiting after 2 attempts — escalate to circuit breaker wait instead
    if ((error.code === PaymentErrorCode.RATE_LIMIT_EXCEEDED || error.code === PaymentErrorCode.PROVIDER_RATE_LIMITED) && attemptCount >= 1) {
      return false;
    }

    // Don't retry circuit breaker open — wait for reset
    if (error.code === PaymentErrorCode.CIRCUIT_BREAKER_OPEN) {
      return false;
    }

    return true;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  static getRetryDelay(attemptCount: number): number {
    // Start with 1 second, then 2s, 4s, 8s, etc. (max 30s)
    const delayMs = Math.min(1000 * Math.pow(2, attemptCount), 30000);
    // Add random jitter (±20%) to prevent thundering herd
    const jitter = delayMs * 0.2 * (Math.random() - 0.5);
    return Math.max(100, delayMs + jitter);
  }

  /**
   * Get the recovery strategy hint for a given error
   */
  static getRecoveryStrategy(error: PaymentError): PaymentError['recoveryStrategy'] {
    return error.recoveryStrategy || 'manual_payment';
  }
}

/**
 * Validation helper for payment inputs
 * 
 * CHANGES:
 * - All methods now accept context parameter for error traceability
 * - Fixed: validateEmail no longer throws INVALID_AMOUNT
 * - Fixed: validatePhoneNumber no longer throws INVALID_AMOUNT
 * - All errors include structured PaymentErrorContext
 */
export class PaymentValidator {
  static validateAmount(
    amount: string | number,
    context?: Partial<PaymentErrorContext>
  ): number {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount) || numAmount <= 0) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_AMOUNT,
        'Amount must be a positive number',
        { ...context, operation: 'validateAmount', service: context?.service || 'gateway' } as PaymentErrorContext
      );
    }

    if (numAmount > 1000000) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_AMOUNT,
        'Amount exceeds maximum transaction limit of 1,000,000',
        { ...context, operation: 'validateAmount', service: context?.service || 'gateway', amount: numAmount } as PaymentErrorContext
      );
    }

    return numAmount;
  }

  static validateCurrency(
    currency: string,
    context?: Partial<PaymentErrorContext>
  ): string {
    const validCurrencies = ['KES', 'GHS', 'ZAR', 'UGX', 'USD', 'EUR', 'GBP', 'NGN', 'USDC'];
    
    const upperCurrency = currency.toUpperCase();
    if (!validCurrencies.includes(upperCurrency)) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_CURRENCY,
        `Unsupported currency: ${currency}. Supported: ${validCurrencies.join(', ')}`,
        { ...context, operation: 'validateCurrency', service: context?.service || 'gateway', currency: upperCurrency } as PaymentErrorContext
      );
    }

    return upperCurrency;
  }

  static validateProvider(
    provider: string,
    context?: Partial<PaymentErrorContext>
  ): string {
    const validProviders = ['flutterwave', 'paystack', 'mpesa', 'mtn', 'airtel', 'stripe', 'kotanipay'];
    
    const lowerProvider = provider.toLowerCase();
    if (!validProviders.includes(lowerProvider)) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_PROVIDER,
        `Unsupported provider: ${provider}. Supported: ${validProviders.join(', ')}`,
        { ...context, operation: 'validateProvider', service: context?.service || 'gateway', provider: lowerProvider } as PaymentErrorContext
      );
    }

    return lowerProvider;
  }

  static validateUserId(
    userId: string,
    context?: Partial<PaymentErrorContext>
  ): string {
    if (!userId || userId.trim().length === 0) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_USER,
        'User ID is required',
        { ...context, operation: 'validateUserId', service: context?.service || 'gateway' } as PaymentErrorContext
      );
    }

    return userId.trim();
  }

  static validateEmail(
    email: string,
    context?: Partial<PaymentErrorContext>
  ): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_EMAIL,
        `Invalid email address: ${email}`,
        { ...context, operation: 'validateEmail', service: context?.service || 'gateway' } as PaymentErrorContext
      );
    }

    return email.toLowerCase();
  }

  static validatePhoneNumber(
    phoneNumber: string,
    context?: Partial<PaymentErrorContext>
  ): string {
    // Normalize: remove all non-digits except leading +
    const normalized = phoneNumber.replace(/[^\d+]/g, '');
    
    // Must be 10-15 digits including country code
    const digitsOnly = normalized.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_PHONE,
        `Invalid phone number: ${phoneNumber}. Must be 10-15 digits including country code.`,
        { ...context, operation: 'validatePhoneNumber', service: context?.service || 'gateway' } as PaymentErrorContext
      );
    }

    return normalized;
  }
}