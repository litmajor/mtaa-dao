import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authClient } from '../utils/authClient';
import authChannel from '../utils/authChannel';
import { UserRole } from './navigation-context';

/**
 * Authentication Context
 * Manages user login/logout and session state with:
 * - localStorage for immediate availability
 * - Backend API for persistent Redis/database storage
 * - Automatic session sync across tabs/windows
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt?: Date;
  lastLogin?: Date;
}

interface AuthSession {
  user: AuthUser;
  token?: string;
  // Stored as ISO string when persisted to localStorage; may be Date in-memory
  expiresAt: string | Date;
}

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'mtaa_dao_auth_session';
const AUTH_TOKEN_KEY = 'mtaa_dao_auth_token';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const WS_PORT = import.meta.env.VITE_API_PORT || '5000';
const WS_HOST = import.meta.env.VITE_API_HOST || 'localhost';

/**
 * Backend API client for authentication with Redis/Database persistence
 */
const authApi = {
  async login(email: string, password: string): Promise<AuthSession> {
    return authClient.post<AuthSession>(`${API_BASE_URL}/auth/login`, { email, password });
  },

  async logout(): Promise<void> {
    try {
      await authClient.post<void>(`${API_BASE_URL}/auth/logout`);
    } catch (err) {
      console.error('Logout API error (continuing local logout):', err);
    }
  },

  async refreshSession(): Promise<AuthSession> {
    return authClient.post<AuthSession>(`${API_BASE_URL}/auth/refresh`);
  },

  async switchRole(role: UserRole): Promise<AuthUser> {
    return authClient.post<AuthUser>(`${API_BASE_URL}/auth/switch-role`, { role });
  },

  async getCurrentUser(): Promise<AuthUser> {
    return authClient.get<AuthUser>(`${API_BASE_URL}/auth/me`);
  },

  async persistSession(session: AuthSession): Promise<void> {
    try {
      await authClient.post<void>(`${API_BASE_URL}/auth/session/persist`, {
        user: session.user,
        expiresAt: session.expiresAt,
      });
    } catch (err) {
      console.error('Session persistence error:', err);
    }
  },

  async verifySessionExists(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/session/verify`, {
        method: 'GET',
        credentials: 'include',
      });
      return res.ok;
    } catch (err) {
      console.error('Session verification error:', err);
      return false;
    }
  },
};

/**
 * Authentication Provider with Redis/Database persistence
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  /**
   * Initialize authentication from localStorage and backend
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedSession = localStorage.getItem(AUTH_STORAGE_KEY);
        const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);

        if (storedToken) {
          try {
            // Verify session with backend (will check Redis/Database)
            const currentUser = await authApi.getCurrentUser();
            setToken(storedToken);
            setUser(currentUser);
          } catch (err) {
            // Token invalid or expired - try refresh before clearing
            try {
              const refreshed = await authApi.refreshSession();
              // store refreshed session
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshed));
              localStorage.setItem(AUTH_TOKEN_KEY, refreshed.token);
              setToken(refreshed.token);
              setUser(refreshed.user);
            } catch (refreshErr) {
              // Refresh failed - clear it
              localStorage.removeItem(AUTH_STORAGE_KEY);
              localStorage.removeItem(AUTH_TOKEN_KEY);
              setToken(null);
              setUser(null);
            }
          }
        } else if (storedSession) {
          // Fallback: restore from localStorage if no token yet
          const session: AuthSession = JSON.parse(storedSession);
          if (new Date(session.expiresAt) > new Date()) {
            setUser(session.user);
            setToken(session.token);
          } else {
            // Session expired
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Set up storage event listener for cross-tab sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY && e.newValue) {
        try {
          const session: AuthSession = JSON.parse(e.newValue);
          setUser(session.user);
          setToken(session.token);
        } catch (err) {
          console.error('Failed to sync auth from storage:', err);
        }
      } else if (e.key === AUTH_STORAGE_KEY && !e.newValue) {
        // User logged out in another tab
        setUser(null);
        setToken(null);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Periodic session sync with backend (every 5 minutes)
  // Separate effect so it starts/stops with token/user changes and avoids multiple intervals
  useEffect(() => {
    if (!token || !user) return;

    const syncInterval = setInterval(async () => {
      try {
        const session: AuthSession = {
          user,
          // do not include token when persisting from frontend; backend uses cookie
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
        await authApi.persistSession(session);
      } catch (err) {
        console.error('Periodic session sync failed:', err);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(syncInterval);
  }, [token, user]);

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
      if ((session as any).token) setToken((session as any).token);

      // Persist minimal session info to backend
      await authApi.persistSession({ user: session.user, token: (session as any).token, expiresAt: session.expiresAt });

      // Notify other tabs via BroadcastChannel/localStorage fallback
      authChannel.postAuthMessage({ type: 'login', payload: { user: session.user } });
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
      setToken(null);
      setError(null);
      setIsLoading(false);

      // Notify other tabs
      authChannel.postAuthMessage({ type: 'logout', payload: {} });
    }
  }, [token]);

  /**
   * Switch user role (persisted to backend)
   */
  const switchRole = useCallback(async (role: UserRole): Promise<void> => {
    try {
      const updatedUser = await authApi.switchRole(role);
      setUser(updatedUser);

      // Update persisted session (no token stored client-side)
      const session: AuthSession = {
        user: updatedUser,
        token: (token as any) || '',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Role switch failed';
      setError(errorMessage);
      throw err;
    }
  }, [token]);

  /**
   * Refresh session from backend (Redis/Database)
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const session = await authApi.refreshSession();
      // don't store raw token client-side; backend may set cookie
      setUser(session.user);
      if ((session as any).token) setToken((session as any).token);

      // Re-persist updated session to backend (minimal)
      await authApi.persistSession({ user: session.user, token: (session as any).token, expiresAt: session.expiresAt });
    } catch (err) {
      // If refresh fails, logout
      await logout();
    }
  }, [token, logout]);

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
      login: async () => { throw new Error('AuthProvider not available'); },
      logout: async () => { throw new Error('AuthProvider not available'); },
      switchRole: async () => { throw new Error('AuthProvider not available'); },
      clearError: () => {},
      refreshSession: async () => { throw new Error('AuthProvider not available'); },
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
