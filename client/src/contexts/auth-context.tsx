import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authClient } from '../utils/authClient';
import authChannel from '../utils/authChannel';
import type { UserRole } from './navigation-context';

/**
 * Authentication Context
 * Manages cookie-based authentication state and syncs login/logout across tabs.
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roles?: UserRole | string[];
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatar?: string;
  createdAt?: Date;
  lastLogin?: Date;
}

interface AuthSession {
  user: AuthUser;
  // Stored as ISO string when persisted to localStorage; may be Date in-memory
  expiresAt: string | Date;
}

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  clearError: () => void;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'mtaa_dao_auth_session';
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api');

/**
 * Backend API client for cookie-based authentication.
 */
const authApi = {
  async login(email: string, password: string): Promise<AuthSession> {
    const response = await authClient.post<{ user: AuthUser }>(`${API_BASE_URL}/auth/login`, { email, password });
    return {
      user: normalizeAuthUser(response.user),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  },

  async logout(): Promise<void> {
    try {
      await authClient.post<void>(`${API_BASE_URL}/auth/logout`);
    } catch (err) {
      console.error('Logout API error (continuing local logout):', err);
    }
  },

  async refreshSession(): Promise<AuthSession> {
    await authClient.post(`${API_BASE_URL}/auth/refresh-token`);
    return {
      user: await authApi.getCurrentUser(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  },

  async switchRole(role: UserRole): Promise<AuthUser> {
    return authClient.post<AuthUser>(`${API_BASE_URL}/auth/switch-role`, {
      role,
    });
  },

  async getCurrentUser(): Promise<AuthUser> {
    const response = await authClient.get<AuthUser | { user: AuthUser }>(`${API_BASE_URL}/auth/user`);
    return normalizeAuthUser('user' in response ? response.user : response);
  },
};

function normalizeAuthUser(user: AuthUser): AuthUser {
  const name = user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'User';
  return { ...user, name };
}

/**
 * Authentication Provider with Redis/Database persistence
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize authentication from localStorage and backend
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = await authApi.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        // authClient already attempts one refresh for an expired access cookie.
        console.warn('[AUTH] Unable to restore session; treating the visitor as signed out.', err);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    const clearSession = () => {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
    };
    const handleSessionInvalid = () => clearSession();
    const unsubscribeAuthChannel = authChannel.onAuthMessage((event) => {
      if (event.type === 'logout') {
        clearSession();
      } else if (event.type === 'login' && event.payload?.user) {
        setUser(event.payload.user as AuthUser);
      }
    });
    window.addEventListener('auth:session-invalid', handleSessionInvalid);

    initializeAuth();

    // Set up storage event listener for cross-tab sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY && e.newValue) {
        try {
          const session: AuthSession = JSON.parse(e.newValue);
          setUser(session.user);
        } catch (err) {
          console.error('Failed to sync auth from storage:', err);
        }
      } else if (e.key === AUTH_STORAGE_KEY && !e.newValue) {
        // User logged out in another tab
        setUser(null);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:session-invalid', handleSessionInvalid);
      unsubscribeAuthChannel();
    };
  }, []);

  /**
   * Login with email and password (persist to backend via Redis + Database)
   */
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await authApi.login(email, password);

      // Don't persist raw tokens to localStorage; backend should set httpOnly refresh cookie
      setUser(session.user);

      // Notify other tabs via BroadcastChannel/localStorage fallback
      authChannel.postAuthMessage({
        type: 'login',
        payload: { user: session.user },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout (clear from backend Redis and localStorage)
   */
  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);

    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
      setError(null);
      setIsLoading(false);

      // Notify other tabs
      authChannel.postAuthMessage({ type: 'logout', payload: {} });
    }
  }, []);

  /**
   * Switch user role (persisted to backend)
   */
  const switchRole = useCallback(async (role: UserRole): Promise<void> => {
    try {
      const updatedUser = await authApi.switchRole(role);
      setUser(updatedUser);

      // Persist only non-sensitive session metadata; authentication remains cookie-based.
      const session: AuthSession = {
        user: updatedUser,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Role switch failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Refresh session from backend (Redis/Database)
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const session = await authApi.refreshSession();
      setUser(session.user);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch (err) {
      // If refresh fails, logout
      await logout();
    }
  }, [logout]);

  /**
   * Clear error message
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    error,
    login,
    logout,
    switchRole,
    clearError,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use authentication context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    const hint = typeof window !== 'undefined' ? `location=${window.location.href}` : '';
    console.warn(`useAuth called outside AuthProvider. ${hint} Returning safe default.`);
    // Return a safe default to prevent crashes
    return {
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      login: async () => {
        throw new Error('AuthProvider not available');
      },
      logout: async () => {
        throw new Error('AuthProvider not available');
      },
      switchRole: async () => {
        throw new Error('AuthProvider not available');
      },
      clearError: () => {},
      refreshSession: async () => {
        throw new Error('AuthProvider not available');
      },
    };
  }
  return context;
};

/**
 * Hook to check if user is authenticated
 */
export const useIsAuthenticated = (): boolean => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
};

/**
 * Hook to get current user
 */
export const useAuthUser = (): AuthUser | null => {
  const { user } = useAuth();
  return user;
};

/**
 * Hook to get user role
 */
export const useUserRole = (): UserRole | null => {
  const { user } = useAuth();
  return user?.role || null;
};

export default AuthContext;
