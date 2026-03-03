/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ERROR HANDLING UTILITIES - Phase 6: Error Classification & Graceful Degradation
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * **Classification System**:
 * • TIMEOUT: Request exceeded time limit (suggest job queue retry)
 * • CIRCUIT_BREAKER: External service unavailable (suggest retry after 30s)
 * • JOB_QUEUE_OVERFLOW: Too many queued jobs (suggest exponential backoff)
 * • VALIDATION: Input validation failed (client error)
 * • RESOURCE_NOT_FOUND: Resource doesn't exist (404)
 * • DATABASE: Database operation failed (retry with backoff)
 * • EXTERNAL_SERVICE: External API failed (graceful degradation)
 * • UNKNOWN: Unknown error type
 */

export type ErrorType = 
  | 'TIMEOUT' 
  | 'CIRCUIT_BREAKER' 
  | 'JOB_QUEUE_OVERFLOW' 
  | 'VALIDATION' 
  | 'RESOURCE_NOT_FOUND' 
  | 'DATABASE' 
  | 'EXTERNAL_SERVICE' 
  | 'UNKNOWN';

/**
 * Classified error with metadata
 */
export interface ClassifiedError {
  type: ErrorType;
  message: string;
  code?: string;
  retryable: boolean;
  retryAfter?: number; // seconds
  suggestedAction?: string;
  jobId?: string; // For timeout/queue errors
  httpStatus: number;
}

/**
 * Safely extract error message from any error object
 * Prevents malformed error serialization in logs
 */
export function getErrorMessage(error: unknown): string {
  // Handle Error instances
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle objects with message property
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return (error as any).message;
  }

  // Handle objects with error property (some DB drivers)
  if (error && typeof error === 'object' && 'error' in error && typeof (error as any).error === 'string') {
    return (error as any).error;
  }

  // Handle objects with msg or text property
  if (error && typeof error === 'object') {
    const anyError = error as any;
    if (typeof anyError.msg === 'string') return anyError.msg;
    if (typeof anyError.text === 'string') return anyError.text;
  }

  // Last resort - try to stringify safely
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error (serialization failed)';
  }
}

/**
 * Safely extract error details for logging
 * Returns only safe, serializable properties
 */
export function getErrorDetails(error: unknown): { message: string; code?: string; stack?: string } {
  const message = getErrorMessage(error);
  const details: { message: string; code?: string; stack?: string } = { message };

  // Try to extract code if available
  if (error && typeof error === 'object') {
    const anyError = error as any;
    if (typeof anyError.code === 'string') {
      details.code = anyError.code;
    }
    // Only include stack in development
    if (process.env.NODE_ENV !== 'production' && typeof anyError.stack === 'string') {
      details.stack = anyError.stack;
    }
  }

  return details;
}

/**
 * Create a safe error log object that won't cause serialization issues
 */
export function getSafeErrorLog(error: unknown): { errorMessage: string; errorCode?: string } {
  const details = getErrorDetails(error);
  return {
    errorMessage: details.message,
    ...(details.code && { errorCode: details.code }),
  };
}

/**
 * Classify error into specific types for targeted handling
 * 
 * Classification Rules:
 * • TIMEOUT: Contains 'timeout' or 'timed out'
 * • CIRCUIT_BREAKER: Contains 'circuit breaker' or 'Circuit breaker OPEN'
 * • JOB_QUEUE_OVERFLOW: Queue length >1000 or 'queue overflow'
 * • VALIDATION: Code 400 or contains 'validation' or 'invalid'
 * • RESOURCE_NOT_FOUND: Code 404 or 'not found'
 * • DATABASE: Code 500 or contains 'database' or 'db' or 'query'
 * • EXTERNAL_SERVICE: Code 503 or 'unavailable' or 'external'
 */
export function classifyError(
  error: unknown,
  context?: { queueLength?: number; jobId?: string }
): ClassifiedError {
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();
  const code = (error && typeof error === 'object' && (error as any).code) as string | undefined;

  // TIMEOUT: Request exceeded time limit
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('deadline') ||
    code === 'ETIMEDOUT'
  ) {
    return {
      type: 'TIMEOUT',
      message,
      code,
      retryable: true,
      retryAfter: 5, // retry after 5 seconds
      httpStatus: 504,
      suggestedAction: context?.jobId
        ? `Your request is taking longer. You can check progress with job ID: ${context.jobId}`
        : 'Request took too long. Consider using job queue for long operations.',
      jobId: context?.jobId,
    };
  }

  // CIRCUIT_BREAKER: External service unavailable
  if (
    lowerMessage.includes('circuit breaker') ||
    lowerMessage.includes('circuit open') ||
    lowerMessage.includes('service temporarily unavailable')
  ) {
    return {
      type: 'CIRCUIT_BREAKER',
      message,
      code,
      retryable: true,
      retryAfter: 30, // Try again after 30 seconds
      httpStatus: 503,
      suggestedAction: 'External service is temporarily unavailable. Retrying after 30 seconds.',
    };
  }

  // JOB_QUEUE_OVERFLOW: Too many pending jobs
  if (
    (context?.queueLength && context.queueLength > 1000) ||
    lowerMessage.includes('queue overflow') ||
    lowerMessage.includes('queue full') ||
    lowerMessage.includes('too many requests')
  ) {
    const backoffSeconds = Math.min(60, 2 ** Math.floor(Math.random() * 5)); // 1-32 seconds
    return {
      type: 'JOB_QUEUE_OVERFLOW',
      message,
      code,
      retryable: true,
      retryAfter: backoffSeconds,
      httpStatus: 429, // Too Many Requests
      suggestedAction: `Job queue is full (${context?.queueLength} pending). ${backoffSeconds}s backoff recommended.`,
    };
  }

  // VALIDATION: Input validation failed
  if (
    lowerMessage.includes('validation') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('required') ||
    code === '400'
  ) {
    return {
      type: 'VALIDATION',
      message,
      code,
      retryable: false,
      httpStatus: 400,
      suggestedAction: 'Please check your input and try again.',
    };
  }

  // RESOURCE_NOT_FOUND: Resource doesn't exist
  if (
    lowerMessage.includes('not found') ||
    lowerMessage.includes('does not exist') ||
    lowerMessage.includes('unknown') ||
    code === '404'
  ) {
    return {
      type: 'RESOURCE_NOT_FOUND',
      message,
      code,
      retryable: false,
      httpStatus: 404,
      suggestedAction: 'The requested resource does not exist.',
    };
  }

  // DATABASE: Database operation failed
  if (
    lowerMessage.includes('database') ||
    lowerMessage.includes('query failed') ||
    lowerMessage.includes('connection') ||
    code?.startsWith('ER_')
  ) {
    return {
      type: 'DATABASE',
      message,
      code,
      retryable: true,
      retryAfter: 5,
      httpStatus: 500,
      suggestedAction: 'Database operation failed. Retrying...',
    };
  }

  // EXTERNAL_SERVICE: External API failed
  if (
    lowerMessage.includes('external') ||
    lowerMessage.includes('api') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('network') ||
    code === '503'
  ) {
    return {
      type: 'EXTERNAL_SERVICE',
      message,
      code,
      retryable: true,
      retryAfter: 10,
      httpStatus: 502, // Bad Gateway
      suggestedAction: 'External service request failed. Please try again soon.',
    };
  }

  // UNKNOWN: Unable to classify
  return {
    type: 'UNKNOWN',
    message,
    code,
    retryable: true,
    retryAfter: 5,
    httpStatus: 500,
    suggestedAction: 'An unexpected error occurred. Please try again.',
  };
}

/**
 * Format error response for API responses
 * 
 * Example response:
 * {
 *   error: true,
 *   type: 'TIMEOUT',
 *   message: 'Request timeout after 10s',
 *   retryable: true,
 *   retryAfter: 5,
 *   suggestedAction: '...',
 *   jobId: 'job-123'
 * }
 */
export function formatErrorResponse(
  error: unknown,
  context?: { queueLength?: number; jobId?: string }
): Omit<ClassifiedError, 'httpStatus'> & { error: true } {
  const classified = classifyError(error, context);
  const { httpStatus, ...rest } = classified;
  return {
    error: true,
    ...rest,
  };
}

/**
 * Create retry delay in milliseconds based on error type
 * Uses exponential backoff with jitter
 * 
 * @param error Error to analyze
 * @param attemptNumber Current attempt (1, 2, 3...)
 * @returns Delay in milliseconds
 */
export function getRetryDelay(error: unknown, attemptNumber: number): number {
  const classified = classifyError(error);

  if (!classified.retryable) {
    return Infinity; // Don't retry
  }

  // Base delay from error classification
  const baseDelay = (classified.retryAfter || 5) * 1000;

  // Exponential backoff: baseDelay * 2^(attemptNumber-1)
  const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);

  // Cap at 60 seconds
  const cappedDelay = Math.min(exponentialDelay, 60000);

  // Add jitter: ±20%
  const jitter = cappedDelay * (0.8 + Math.random() * 0.4);

  return Math.floor(jitter);
}

/**
 * Should we retry this error?
 * Useful for conditional retry logic
 */
export function shouldRetry(error: unknown, maxRetries: number = 3, attemptNumber: number = 1): boolean {
  if (attemptNumber > maxRetries) {
    return false;
  }

  const classified = classifyError(error);
  return classified.retryable;
}
