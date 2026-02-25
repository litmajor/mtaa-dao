/**
 * Standardized API Response Types
 * 
 * All API endpoints should use these types for consistent response format:
 * - Meta information (timestamps, cache status, rate limits)
 * - Data payload (actual response data)
 * - Pagination (for list endpoints)
 * - Error handling (standardized error codes and messages)
 */

/**
 * Rate limit information in response headers
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when limit resets
  retryAfter?: number; // Seconds to wait if rate limited
}

/**
 * Metadata included in every response
 */
export interface ResponseMeta {
  timestamp: number; // Unix milliseconds
  cached?: boolean; // Whether data came from cache
  cacheExpiry?: number; // Unix ms when cache expires
  dataSource?: string; // Which exchange/source provided data
  rateLimit?: RateLimitInfo;
}

/**
 * Pagination information for list responses
 */
export interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

/**
 * Standardized error response
 */
export interface ApiError {
  code: string; // Machine-readable error code (e.g., "INVALID_SYMBOL")
  message: string; // Human-readable message
  details?: Record<string, any>; // Additional error context
  suggestion?: string; // Helpful suggestion for recovery
  statusCode: number; // HTTP status code
}

/**
 * Main API response wrapper - use for success responses
 */
export interface ApiResponse<T = any> {
  success: true;
  meta: ResponseMeta;
  data: T;
  pagination?: PaginationInfo;
}

/**
 * Error response wrapper - use for error responses
 */
export interface ApiErrorResponse {
  success: false;
  meta: ResponseMeta;
  error: ApiError;
}

/**
 * Union type for all API responses
 */
export type ApiResponseType<T = any> = ApiResponse<T> | ApiErrorResponse;

/**
 * Helper function to create a successful response
 */
export function createApiResponse<T>(
  data: T,
  options?: {
    cached?: boolean;
    cacheExpiry?: number;
    dataSource?: string;
    rateLimit?: RateLimitInfo;
    pagination?: PaginationInfo;
  }
): ApiResponse<T> {
  return {
    success: true,
    meta: {
      timestamp: Date.now(),
      cached: options?.cached || false,
      cacheExpiry: options?.cacheExpiry,
      dataSource: options?.dataSource,
      rateLimit: options?.rateLimit,
    },
    data,
    pagination: options?.pagination,
  };
}

/**
 * Helper function to create an error response
 */
export function createApiError(
  code: string,
  message: string,
  statusCode: number = 400,
  options?: {
    details?: Record<string, any>;
    suggestion?: string;
  }
): ApiErrorResponse {
  return {
    success: false,
    meta: {
      timestamp: Date.now(),
    },
    error: {
      code,
      message,
      details: options?.details,
      suggestion: options?.suggestion,
      statusCode,
    },
  };
}

/**
 * Common API error codes
 */
export enum ApiErrorCode {
  INVALID_SYMBOL = 'INVALID_SYMBOL',
  INVALID_EXCHANGE = 'INVALID_EXCHANGE',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  EXCHANGE_UNAVAILABLE = 'EXCHANGE_UNAVAILABLE',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  ORDER_VALIDATION_FAILED = 'ORDER_VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
