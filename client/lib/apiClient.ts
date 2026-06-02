/**
 * API Client Utilities
 * Centralized API communication with backend
 * Handles all HTTP requests, error handling, auth
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface ApiError {
  code: string;
  message: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set authentication token
   */
  setToken(token: string) {
    this.token = token;
  }

  /**
   * Clear authentication token
   */
  clearToken() {
    this.token = null;
  }

  /**
   * Make HTTP request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      const json = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: json.error || 'Request failed',
          message: json.message,
        };
      }

      return {
        success: true,
        data: json.data,
        message: json.message,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * GET request
   */
  get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * PUT request
   */
  put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

/**
 * Trading API Methods
 */
export const tradingApi = {
  /**
   * Get all orders
   */
  getOrders: (filters?: any) => {
    const queryString = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiClient.get(`/trading/orders${queryString}`);
  },

  /**
   * Get order by ID
   */
  getOrder: (orderId: string) => apiClient.get(`/trading/orders/${orderId}`),

  /**
   * Get all positions
   */
  getPositions: (filters?: any) => {
    const queryString = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiClient.get(`/trading/positions${queryString}`);
  },

  /**
   * Get position by ID
   */
  getPosition: (positionId: string) => apiClient.get(`/trading/positions/${positionId}`),

  /**
   * Place new order
   */
  placeOrder: (orderData: any) => apiClient.post('/trading/orders', orderData),

  /**
   * Cancel order
   */
  cancelOrder: (orderId: string) => apiClient.delete(`/trading/orders/${orderId}`),

  /**
   * Get order history
   */
  getOrderHistory: (filters?: any) => {
    const queryString = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiClient.get(`/trading/history${queryString}`);
  },

  /**
   * Get P&L metrics
   */
  getPnLMetrics: () => apiClient.get('/trading/pnl'),

  /**
   * Get portfolio metrics
   */
  getPortfolioMetrics: () => apiClient.get('/trading/portfolio'),

  /**
   * Get price data
   */
  getPriceData: (pair: string) => apiClient.get(`/trading/prices/${pair}`),
};

/**
 * Exchange API Methods
 */
export const exchangeApi = {
  /**
   * Add exchange connection
   */
  addExchange: (exchangeData: any) => apiClient.post('/exchanges', exchangeData),

  /**
   * Get all connected exchanges
   */
  getExchanges: () => apiClient.get('/exchanges'),

  /**
   * Get exchange by ID
   */
  getExchange: (exchangeId: string) => apiClient.get(`/exchanges/${exchangeId}`),

  /**
   * Update exchange connection
   */
  updateExchange: (exchangeId: string, data: any) =>
    apiClient.put(`/exchanges/${exchangeId}`, data),

  /**
   * Delete exchange connection
   */
  deleteExchange: (exchangeId: string) => apiClient.delete(`/exchanges/${exchangeId}`),

  /**
   * Test exchange connection
   */
  testExchange: (exchangeData: any) => apiClient.post('/exchanges/test', exchangeData),

  /**
   * Sync exchange data
   */
  syncExchange: (exchangeId: string) => apiClient.post(`/exchanges/${exchangeId}/sync`, {}),
};

/**
 * Settings API Methods
 */
export const settingsApi = {
  /**
   * Get user settings
   */
  getSettings: () => apiClient.get('/settings'),

  /**
   * Update user settings
   */
  updateSettings: (settings: any) => apiClient.put('/settings', settings),

  /**
   * Get trading preferences
   */
  getTradingPreferences: () => apiClient.get('/settings/trading'),

  /**
   * Update trading preferences
   */
  updateTradingPreferences: (preferences: any) =>
    apiClient.put('/settings/trading', preferences),

  /**
   * Get notification settings
   */
  getNotificationSettings: () => apiClient.get('/settings/notifications'),

  /**
   * Update notification settings
   */
  updateNotificationSettings: (settings: any) =>
    apiClient.put('/settings/notifications', settings),

  /**
   * Get display settings
   */
  getDisplaySettings: () => apiClient.get('/settings/display'),

  /**
   * Update display settings
   */
  updateDisplaySettings: (settings: any) => apiClient.put('/settings/display', settings),
};

/**
 * Analytics API Methods
 */
export const analyticsApi = {
  /**
   * Get portfolio analytics
   */
  getPortfolioAnalytics: () => apiClient.get('/analytics/portfolio'),

  /**
   * Get pair performance
   */
  getPairPerformance: (filters?: any) => {
    const queryString = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiClient.get(`/analytics/pairs${queryString}`);
  },

  /**
   * Get exchange comparison
   */
  getExchangeComparison: () => apiClient.get('/analytics/exchanges'),

  /**
   * Get risk metrics
   */
  getRiskMetrics: () => apiClient.get('/analytics/risk'),

  /**
   * Get P&L time series
   */
  getPnLTimeSeries: (timeframe: string = 'day') =>
    apiClient.get(`/analytics/pnl?timeframe=${timeframe}`),

  /**
   * Get fee analysis
   */
  getFeeAnalysis: () => apiClient.get('/analytics/fees'),

  /**
   * Get diversification metrics
   */
  getDiversification: () => apiClient.get('/analytics/diversification'),
};

/**
 * Auth API Methods
 */
export const authApi = {
  /**
   * Login user
   */
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),

  /**
   * Register user
   */
  register: (userData: any) => apiClient.post('/auth/register', userData),

  /**
   * Logout user
   */
  logout: () => {
    apiClient.clearToken();
    return Promise.resolve({ success: true });
  },

  /**
   * Get current user
   */
  getCurrentUser: () => apiClient.get('/auth/me'),

  /**
   * Refresh auth token
   */
  refreshToken: () => apiClient.post('/auth/refresh', {}),
};

export type { ApiResponse, ApiError };
