/**
 * Centralized Auth Client
 * 
 * 🔐 Security Architecture:
 * - NO localStorage/sessionStorage usage
 * - Tokens stored in httpOnly cookies (auto-included by fetch)
 * - Auto-refresh on 401 (token expiry)
 * - Single point of error handling
 * 
 * Usage:
 *   const res = await authClient.get('/api/v1/yuki/staking/my-stakes')
 *   const res = await authClient.post('/api/v1/yuki/staking/stake', { amount: 100 })
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

interface AuthResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
  };
}

/**
 * Cookie helper (read csrf token from cookie)
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function getCsrfToken(): string | null {
  return getCookie('csrf_token');
}

let refreshPromise: Promise<void> | null = null;

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

async function refreshToken(): Promise<void> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const csrfToken = getCsrfToken();
      const refreshHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        refreshHeaders['X-CSRF-Token'] = csrfToken;
      }

      const res = await fetch(`${API_BASE}/api/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
        headers: refreshHeaders,
      });

      if (!res.ok) {
        throw new Error('Refresh failed');
      }

      console.log('[AUTH] Token refreshed successfully');
    } catch (error) {
      console.error('[AUTH] Token refresh failed', error);
      handleAuthFailure();
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Core authFetch function - used by all auth methods
 * Automatically includes credentials and handles 401 refresh.
 */
async function authFetch(
  url: string,
  options: RequestInit = {},
  retry = true
): Promise<Response> {
  // Ensure full URL
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  const method = (options.method || 'GET').toUpperCase();
  const csrfToken = getCsrfToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // Attach CSRF token for state-changing requests
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(fullUrl, {
    ...options,
    credentials: 'include', // 🍪 Auto-include httpOnly cookies
    signal: controller.signal,
    headers,
  });

  clearTimeout(timeout);

  // If token expired or user is unauthorized
  if (response.status === 401 && retry) {
    console.warn('[AUTH] Access token expired, attempting refresh...');

    try {
      await refreshToken();
      return authFetch(url, options, false);
    } catch (error) {
      // If refresh fails, auth failure handler already invoked
      return response;
    }
  }

  return response;
}

/**
 * Handle authentication failure
 * - Notify app to show login page
 * - Clear any remaining client-side storage
 */
function handleAuthFailure(): void {
  // Clear any old localStorage/sessionStorage tokens
  localStorage.removeItem('accessToken');
  localStorage.removeItem('token');
  localStorage.removeItem('authToken');
  localStorage.removeItem('mtaa_dao_auth_token');
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('sessionToken');

  // Clear CSRF cookie as well
  if (typeof document !== 'undefined') {
    document.cookie = 'csrf_token=; Max-Age=0; path=/;';
  }

  // Dispatch event for app to listen to and redirect to login
  window.dispatchEvent(
    new CustomEvent('auth:logout', {
      detail: { reason: 'token_expired_or_invalid' },
    })
  );

  // Redirect to login after short delay
  setTimeout(() => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, 500);
}

/**
 * Public API - use this instead of fetch() for authenticated endpoints
 */
export const authClient = {
  /**
   * GET request
   */
  async get<T = any>(url: string, options?: RequestInit): Promise<T> {
    const response = await authFetch(url, {
      ...options,
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error?.error?.message || `HTTP ${response.status}`);
    }

    const data = (await response.json()) as AuthResponse<T>;
    return data.data as T;
  },

  /**
   * POST request
   */
  async post<T = any>(url: string, body?: any, options?: RequestInit): Promise<T> {
    const response = await authFetch(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error?.error?.message || `HTTP ${response.status}`);
    }

    const data = (await response.json()) as AuthResponse<T>;
    return data.data as T;
  },

  /**
   * PUT request
   */
  async put<T = any>(url: string, body?: any, options?: RequestInit): Promise<T> {
    const response = await authFetch(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error?.error?.message || `HTTP ${response.status}`);
    }

    const data = (await response.json()) as AuthResponse<T>;
    return data.data as T;
  },

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, body?: any, options?: RequestInit): Promise<T> {
    const response = await authFetch(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error?.error?.message || `HTTP ${response.status}`);
    }

    const data = (await response.json()) as AuthResponse<T>;
    return data.data as T;
  },

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, options?: RequestInit): Promise<T> {
    const response = await authFetch(url, {
      ...options,
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error?.error?.message || `HTTP ${response.status}`);
    }

    const data = (await response.json()) as AuthResponse<T>;
    return data.data as T;
  },

  /**
   * RAW fetch for advanced use cases (file uploads, streams, etc.)
   * Still handles 401 refresh automatically
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    return authFetch(url, options);
  },
};

/**
 * Hook-friendly version for React components
 * Works like fetch but auto-includes auth
 */
export async function authFetchWrapper(
  url: string,
  options?: RequestInit
): Promise<Response> {
  return authFetch(url, options);
}

/**
 * Utility to parse auth response
 */
export async function parseAuthResponse<T = any>(response: Response): Promise<T> {
  const data = (await response.json()) as AuthResponse<T>;
  if (!data.success) {
    throw new Error(data.error?.message || 'Request failed');
  }
  return data.data as T;
}
