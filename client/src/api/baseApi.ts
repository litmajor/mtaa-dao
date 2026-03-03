/**
 * Base API Client
 * Handles all HTTP requests with:
 * - Automatic error handling and logging
 * - Token injection and auth header management
 * - Request/response interceptors
 * - Timeout management
 * - Network retry logic
 */

interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

interface ApiError extends Error {
  statusCode?: number;
  response?: {
    data?: any;
    status?: number;
    statusText?: string;
  };
}

export const api = {
  /**
   * Make a GET request
   * @param url - Endpoint URL
   * @param config - Optional request configuration
   */
  async get<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, 'GET', undefined, config);
  },

  /**
   * Make a POST request
   * @param url - Endpoint URL
   * @param data - Request body
   * @param config - Optional request configuration
   */
  async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, 'POST', data, config);
  },

  /**
   * Make a PUT request
   * @param url - Endpoint URL
   * @param data - Request body
   * @param config - Optional request configuration
   */
  async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, 'PUT', data, config);
  },

  /**
   * Make a DELETE request
   * @param url - Endpoint URL
   * @param config - Optional request configuration
   */
  async delete<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, 'DELETE', undefined, config);
  },

  /**
   * Core request handler with retry logic
   */
  async request<T = any>(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data?: any,
    config?: RequestConfig
  ): Promise<T> {
    const maxRetries = config?.retries ?? 1;
    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.performRequest<T>(url, method, data, config);
      } catch (error: any) {
        lastError = error;

        // Only retry on network errors or 5xx server errors
        const isRetryable =
          !error.statusCode || // Network error
          (error.statusCode >= 500 && error.statusCode < 600); // Server error

        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }

        // Exponential backoff: 100ms, 200ms, 400ms, etc.
        const delay = Math.pow(2, attempt) * 100;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Request failed');
  },

  /**
   * Perform actual HTTP request
   */
  async performRequest<T = any>(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data?: any,
    config?: RequestConfig
  ): Promise<T> {
    try {
      // Inject auth token if available
      const headers = this.buildHeaders(config?.headers);

      const options: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(config?.timeout ?? 30000), // 30s default timeout
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }

      // Make the request
      const response = await fetch(url, options);

      // Handle response
      if (!response.ok) {
        const errorBody = await response.text();
        const error: ApiError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.statusCode = response.status;
        error.response = {
          status: response.status,
          statusText: response.statusText,
          data: this.tryParseJson(errorBody),
        };

        // Log error with context
        console.error(`[API Error] ${method} ${url}`, {
          status: response.status,
          statusText: response.statusText,
          body: error.response.data,
        });

        throw error;
      }

      // Parse response
      const text = await response.text();
      const result: T = this.tryParseJson(text);

      // Log successful request in development
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[API Success] ${method} ${url}`, result);
      }

      return result;
    } catch (error: any) {
      // Handle specific error types
      if (error instanceof TypeError) {
        // Network error
        const networkError: ApiError = new Error('Network request failed');
        networkError.statusCode = 0;
        console.error(`[API Network Error] ${method} ${url}`, error.message);
        throw networkError;
      }

      if (error.name === 'AbortError') {
        const timeoutError: ApiError = new Error('Request timeout');
        timeoutError.statusCode = 408;
        console.error(`[API Timeout] ${method} ${url}`, error.message);
        throw timeoutError;
      }

      // Re-throw with context
      throw error;
    }
  },

  /**
   * Build request headers with auth token
   */
  buildHeaders(customHeaders?: Record<string, string>): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    // Inject auth token if available
    try {
      const token = this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      // Silently fail if token retrieval fails
      console.warn('Failed to retrieve auth token');
    }

    return headers;
  },

  /**
   * Get auth token from session storage
   */
  getAuthToken(): string | null {
    try {
      // Try next-auth session token
      if (typeof window !== 'undefined') {
        const token = sessionStorage.getItem('auth-token');
        return token || null;
      }
    } catch {
      return null;
    }
    return null;
  },

  /**
   * Safely parse JSON
   */
  tryParseJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  },
};

// Export error handler for components
export const handleApiError = (error: any): string => {
  if (!error) return 'Unknown error occurred';

  // Handle API errors
  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  // Handle standard errors
  if (error.message) {
    // Don't expose internal error details to user
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return 'Authentication required. Please log in.';
    }
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      return 'You do not have permission to perform this action.';
    }
    if (error.message.includes('404') || error.message.includes('not found')) {
      return 'The requested resource was not found.';
    }
    if (error.message.includes('Network')) {
      return 'Network connection failed. Please check your internet connection.';
    }
    if (error.message.includes('timeout')) {
      return 'Request took too long. Please try again.';
    }
    if (error.message.includes('500') || error.message.includes('Server')) {
      return 'Server error occurred. Please try again later.';
    }
  }

  return 'An error occurred. Please try again.';
};

export default api;
