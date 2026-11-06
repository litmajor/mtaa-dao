/**
 * Centralized Auth Client
 *
 * Security Architecture:
 * - Prefer httpOnly cookies for tokens (no active storage usage)
 * - Tokens stored in httpOnly cookies (auto-included by fetch)
 * - Auto-refresh on 401 (token expiry)
 * - Single point of error handling
 *
 * Usage:
 *   const res = await authClient.get('/api/v1/yuki/staking/my-stakes')
 *   const res = await authClient.post('/api/v1/yuki/staking/stake', { amount: 100 })
 */

import authChannel from './authChannel';

// Use Vite-provided env variable in the browser. Falls back to localhost backend.
const API_BASE_INPUT = (typeof import.meta !== 'undefined' && (import.meta.env as any)?.VITE_API_URL) || '';
const API_BASE = API_BASE_INPUT.replace(/\/api\/?$/, '').replace(/\/$/, '');

function resolveApiUrl(url: string): string {
  if (url.startsWith('http')) return url;

  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  const hasApiPrefix = normalizedUrl === '/api' || normalizedUrl.startsWith('/api/');
  return `${API_BASE}${hasApiPrefix ? normalizedUrl : `/api${normalizedUrl}`}`;
}

interface AuthResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export class AuthApiError extends Error {
  constructor(message: string, readonly code?: string, readonly statusCode?: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

async function responseError(response: Response): Promise<AuthApiError> {
  const payload = await response.json().catch(() => undefined) as AuthResponse | undefined;
  return new AuthApiError(
    payload?.error?.message || `HTTP ${response.status}`,
    payload?.error?.code,
    response.status,
  );
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
let refreshBlockedCsrfToken: string | undefined;
let refreshBlockedUntil = 0;
let refreshFailureCount = 0;

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const REFRESH_BACKOFF_BASE_MS = 1000;
const REFRESH_BACKOFF_MAX_MS = 30000;
const AUTH_ENDPOINTS_WITHOUT_REFRESH = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh-token',
  '/api/auth/logout',
]);

type AuthRequestInit = RequestInit & { timeoutMs?: number };

async function refreshToken(): Promise<void> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const csrfToken = getCsrfToken();
  const csrfFingerprint = csrfToken ?? '';
  if (
    refreshBlockedCsrfToken === csrfFingerprint &&
    Date.now() < refreshBlockedUntil
  ) {
    throw new Error('Session refresh is temporarily paused after a failed attempt');
  }
  if (refreshBlockedCsrfToken !== csrfFingerprint) {
    refreshBlockedCsrfToken = undefined;
    refreshBlockedUntil = 0;
    refreshFailureCount = 0;
  }

  refreshPromise = (async () => {
    try {
      const refreshHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        refreshHeaders['X-CSRF-Token'] = csrfToken;
      }

      const res = await fetch(resolveApiUrl('/api/auth/refresh-token'), {
        method: 'POST',
        credentials: 'include',
        headers: refreshHeaders,
      });

      if (!res.ok) {
        throw new Error('Refresh failed');
      }

      refreshBlockedCsrfToken = undefined;
      refreshBlockedUntil = 0;
      refreshFailureCount = 0;
      console.log('[AUTH] Token refreshed successfully');
    } catch (error) {
      refreshFailureCount += 1;
      refreshBlockedCsrfToken = csrfFingerprint;
      refreshBlockedUntil =
        Date.now() +
        Math.min(
          REFRESH_BACKOFF_MAX_MS,
          REFRESH_BACKOFF_BASE_MS * 2 ** (refreshFailureCount - 1),
        );
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
  options: AuthRequestInit = {},
  retry = true
): Promise<Response> {
  // Ensure full URL
  const fullUrl = resolveApiUrl(url);
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const method = (fetchOptions.method || 'GET').toUpperCase();
  const csrfToken = getCsrfToken();

  // Respect explicit headers and avoid forcing Content-Type when sending FormData
  const explicitHeaders = (fetchOptions.headers as Record<string, string>) || {};
  const headers: Record<string, string> = {
    ...explicitHeaders,
  };

  // Set JSON content-type only when body is not FormData and Content-Type not already provided
  const bodyIsFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  if (!bodyIsFormData && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach CSRF token for state-changing requests
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  let response: Response;
  try {
    try {
      response = await fetch(fullUrl, {
        ...fetchOptions,
        credentials: 'include', // Auto-include httpOnly cookies
        signal: controller.signal,
        headers,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  } finally {
    clearTimeout(timeout);
  }

  // If token expired or user is unauthorized
  const requestPath = new URL(fullUrl, 'http://localhost').pathname;
  if (response.status === 401 && retry && !AUTH_ENDPOINTS_WITHOUT_REFRESH.has(requestPath)) {
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
 * - Notify the app that the current session is no longer valid
 * - Clear any remaining client-side storage
 */
function handleAuthFailure(): void {
  // Legacy cleanup for older auth systems (no active use of local/session storage)
  try {
    localStorage.removeItem('mtaa_dao_auth_session');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('mtaa_dao_auth_token');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('sessionToken');
  } catch (e) {
    // ignore (storage may be unavailable in some environments)
  }

  // Clear CSRF cookie as well
  if (typeof document !== 'undefined') {
    // Prefer server-side logout to ensure cookies (including Domain/Path/Secure flags) are cleared
    try {
      const csrfToken = getCsrfToken();
      const logoutHeaders: Record<string, string> | undefined = csrfToken
        ? { 'X-CSRF-Token': csrfToken }
        : undefined;

      void fetch(resolveApiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: logoutHeaders,
      });
    } catch (e) {
      // best-effort
    }
  }

  // Notify other tabs/windows via BroadcastChannel/localStorage fallback
  try {
    authChannel.postAuthMessage({ type: 'logout', payload: { reason: 'token_expired_or_invalid' } });
  } catch (e) {
    // ignore
  }

  // Let the auth provider and route guards decide where unauthenticated users go.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:session-invalid'));
  }
}

/**
 * Public API - use this instead of fetch() for authenticated endpoints
 */
export const authClient = {
  /**
   * GET request
   */
  async get<T = any>(url: string, options?: AuthRequestInit): Promise<T> {
    const response = await authFetch(url, {
      ...options,
      method: 'GET',
    });

    if (!response.ok) {
      throw await responseError(response);
    }

    const data = (await response.json()) as AuthResponse<T>;
    return data.data as T;
  },

  /**
   * POST request
   */
  async post<T = any>(url: string, body?: any, options?: RequestInit): Promise<T> {
    const payload =
      typeof FormData !== 'undefined' && body instanceof FormData ? body : body ? JSON.stringify(body) : undefined;

    const response = await authFetch(url, {
      ...options,
      method: 'POST',
      body: payload,
    });

    if (!response.ok) {
      throw await responseError(response);
    }

    const data = (await response.json()) as AuthResponse<T>;
    return data.data as T;
  },

  /**
   * PUT request
   */
  async put<T = any>(url: string, body?: any, options?: RequestInit): Promise<T> {
    const payload =
      typeof FormData !== 'undefined' && body instanceof FormData ? body : body ? JSON.stringify(body) : undefined;

    const response = await authFetch(url, {
      ...options,
      method: 'PUT',
      body: payload,
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
    const payload =
      typeof FormData !== 'undefined' && body instanceof FormData ? body : body ? JSON.stringify(body) : undefined;

    const response = await authFetch(url, {
      ...options,
      method: 'PATCH',
      body: payload,
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

  /**
   * Return headers required for authenticated requests (CSRF token if present).
   * Synchronous by design so callers may use it with or without `await`.
   */
  getAuthHeaders(): Record<string, string> {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {};
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    return headers;
  },
};

/**
 * Hook-friendly version for React components
 * Works like fetch but auto-includes auth
 */
export async function authFetchWrapper(url: string, options?: RequestInit): Promise<Response> {
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
