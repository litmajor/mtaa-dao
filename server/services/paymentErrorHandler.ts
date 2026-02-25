import { logger } from '../utils/logger';

/**
 * Payment-specific error types for better error classification and handling
 */
export class PaymentError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public retryable: boolean = false,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/**
 * Error codes used across payment system
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

  // Limit errors
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  DAILY_LIMIT_EXCEEDED = 'DAILY_LIMIT_EXCEEDED',
  HOURLY_LIMIT_EXCEEDED = 'HOURLY_LIMIT_EXCEEDED',
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
 * Creates a PaymentError with proper categorization and retry logic
 */
export class PaymentErrorHandler {
  /**
   * Create a payment error with context
   */
  static createError(
    code: PaymentErrorCode,
    message: string,
    metadata?: Record<string, any>
  ): PaymentError {
    const { statusCode, retryable, category } = this.getErrorConfig(code);
    
    logger.error('Payment error created', {
      code,
      message,
      category,
      retryable,
      statusCode,
      metadata
    });

    return new PaymentError(code, message, statusCode, retryable, {
      category,
      ...metadata
    });
  }

  /**
   * Handle and categorize API errors from payment providers
   */
  static handleProviderError(
    provider: string,
    error: any,
    context?: Record<string, any>
  ): PaymentError {
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return this.createError(
        PaymentErrorCode.PROVIDER_TIMEOUT,
        `${provider} request timed out`,
        { provider, originalError: error.message, context }
      );
    }

    // Handle rate limiting (HTTP 429)
    if (error.status === 429) {
      return this.createError(
        PaymentErrorCode.PROVIDER_RATE_LIMITED,
        `${provider} rate limit exceeded. Please try again later.`,
        { provider, context }
      );
    }

    // Handle service unavailable (HTTP 503)
    if (error.status === 503) {
      return this.createError(
        PaymentErrorCode.PROVIDER_SERVICE_UNAVAILABLE,
        `${provider} is temporarily unavailable. Please try again later.`,
        { provider, context }
      );
    }

    // Handle authentication errors (HTTP 401/403)
    if (error.status === 401 || error.status === 403) {
      return this.createError(
        PaymentErrorCode.INVALID_CONFIGURATION,
        `Invalid credentials for ${provider}. Contact support.`,
        { provider, context }
      );
    }

    // Handle provider-specific errors
    if (error.response?.data?.message) {
      return this.createError(
        PaymentErrorCode.PROVIDER_API_ERROR,
        error.response.data.message,
        { provider, statusCode: error.status, context }
      );
    }

    // Generic provider error
    return this.createError(
      PaymentErrorCode.PROVIDER_API_ERROR,
      `${provider} API error: ${error.message || 'Unknown error'}`,
      { provider, originalError: error.message, context }
    );
  }

  /**
   * Handle network errors
   */
  static handleNetworkError(error: any, context?: Record<string, any>): PaymentError {
    if (error.code === 'ENOTFOUND' || error.code === 'ENETUNREACH') {
      return this.createError(
        PaymentErrorCode.DNS_RESOLUTION_FAILED,
        'Network error: Unable to reach payment provider',
        { originalError: error.message, context }
      );
    }

    if (error.code === 'ECONNREFUSED') {
      return this.createError(
        PaymentErrorCode.NETWORK_ERROR,
        'Connection refused by payment provider',
        { originalError: error.message, context }
      );
    }

    return this.createError(
      PaymentErrorCode.NETWORK_ERROR,
      `Network error: ${error.message || 'Unknown error'}`,
      { originalError: error.message, context }
    );
  }

  /**
   * Handle database errors
   */
  static handleDatabaseError(error: any, operation: string, context?: Record<string, any>): PaymentError {
    // Handle deadlock errors
    if (error.code === 'DEADLOCK_DETECTED' || error.message?.includes('deadlock')) {
      return this.createError(
        PaymentErrorCode.TRANSACTION_LOCK,
        `Database lock on ${operation}. Please try again.`,
        { operation, retryable: true, context }
      );
    }

    // Handle unique constraint violations
    if (error.code === '23505' || error.message?.includes('unique')) {
      return this.createError(
        PaymentErrorCode.TRANSACTION_ALREADY_PROCESSED,
        'Transaction already exists',
        { operation, context }
      );
    }

    return this.createError(
      PaymentErrorCode.DATABASE_ERROR,
      `Database error during ${operation}: ${error.message}`,
      { operation, originalError: error.message, context }
    );
  }

  /**
   * Get error configuration (status code, retry policy, etc.)
   */
  private static getErrorConfig(code: PaymentErrorCode): {
    statusCode: number;
    retryable: boolean;
    category: PaymentErrorCategory;
  } {
    const configs: Record<PaymentErrorCode, any> = {
      // Configuration errors - should not retry
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

      // Validation errors - should not retry
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

      // Limit errors - should not retry
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
      [PaymentErrorCode.INSUFFICIENT_BALANCE]: {
        statusCode: 400,
        retryable: false,
        category: PaymentErrorCategory.VALIDATION
      },

      // Provider errors - some retryable
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

      // Network errors - retryable
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

      // Transaction errors - usually not retryable
      [PaymentErrorCode.TRANSACTION_ALREADY_PROCESSED]: {
        statusCode: 400,
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

      // Database errors - some retryable
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

      // Payment status errors - not retryable
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

      // Generic error
      [PaymentErrorCode.UNKNOWN_ERROR]: {
        statusCode: 500,
        retryable: true,
        category: PaymentErrorCategory.UNKNOWN
      }
    };

    return configs[code] || configs[PaymentErrorCode.UNKNOWN_ERROR];
  }

  /**
   * Convert error to API response format
   */
  static toResponse(error: any) {
    const isPaymentError = error instanceof PaymentError;

    return {
      success: false,
      error: {
        code: isPaymentError ? error.code : PaymentErrorCode.UNKNOWN_ERROR,
        message: error.message || 'An unexpected error occurred',
        statusCode: isPaymentError ? error.statusCode : 500,
        retryable: isPaymentError ? error.retryable : false,
        metadata: isPaymentError ? error.metadata : undefined
      }
    };
  }

  /**
   * Determine if error should trigger retry
   */
  static shouldRetry(error: PaymentError, attemptCount: number = 0, maxRetries: number = 3): boolean {
    if (!error.retryable || attemptCount >= maxRetries) {
      return false;
    }

    // Don't retry rate limiting after 2 attempts
    if (error.code === PaymentErrorCode.PROVIDER_RATE_LIMITED && attemptCount >= 1) {
      return false;
    }

    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  static getRetryDelay(attemptCount: number): number {
    // Start with 1 second, then 2s, 4s, 8s, etc. (max 30s)
    const delayMs = Math.min(1000 * Math.pow(2, attemptCount), 30000);
    // Add random jitter (±20%)
    const jitter = delayMs * 0.2 * (Math.random() - 0.5);
    return delayMs + jitter;
  }
}

/**
 * Validation helper for payment inputs
 */
export class PaymentValidator {
  static validateAmount(amount: string | number): number {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount) || numAmount <= 0) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_AMOUNT,
        'Amount must be a positive number'
      );
    }

    if (numAmount > 1000000) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_AMOUNT,
        'Amount exceeds maximum transaction limit'
      );
    }

    return numAmount;
  }

  static validateCurrency(currency: string): string {
    const validCurrencies = ['KES', 'GHS', 'ZAR', 'UGX', 'USD', 'EUR', 'GBP', 'NGN'];
    
    const upperCurrency = currency.toUpperCase();
    if (!validCurrencies.includes(upperCurrency)) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_CURRENCY,
        `Unsupported currency: ${currency}`
      );
    }

    return upperCurrency;
  }

  static validateProvider(provider: string): string {
    const validProviders = ['flutterwave', 'paystack', 'mpesa', 'mtn', 'airtel', 'stripe', 'paychant'];
    
    const lowerProvider = provider.toLowerCase();
    if (!validProviders.includes(lowerProvider)) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_PROVIDER,
        `Unsupported provider: ${provider}`
      );
    }

    return lowerProvider;
  }

  static validateUserId(userId: string): string {
    if (!userId || userId.trim().length === 0) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_USER,
        'User ID is required'
      );
    }

    return userId;
  }

  static validateEmail(email: string): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_AMOUNT,
        'Invalid email address'
      );
    }

    return email;
  }

  static validatePhoneNumber(phoneNumber: string): string {
    // Basic phone validation - must be 10-15 digits including country code
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\D/g, ''))) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_AMOUNT,
        'Invalid phone number'
      );
    }

    return phoneNumber;
  }
}
