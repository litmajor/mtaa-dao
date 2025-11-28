import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  token: string;
  expiresAt: Date;
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
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    return response.json();
  },

  async logout(token: string): Promise<void> {
    // Clear session from backend (Redis + Database)
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout API error (continuing local logout):', err);
    }
  },

  async refreshSession(token: string): Promise<AuthSession> {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Session refresh failed');
    }

    return response.json();
  },

  async switchRole(token: string, role: UserRole): Promise<AuthUser> {
    const response = await fetch(`${API_BASE_URL}/auth/switch-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      throw new Error('Role switch failed');
    }

    return response.json();
  },

  async getCurrentUser(token: string): Promise<AuthUser> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch current user');
    }

    return response.json();
  },

  /**
   * Persist session to backend (Redis + Database)
   * Called after login/refresh to ensure session survives server restarts
   */
  async persistSession(token: string, session: AuthSession): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/session/persist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          user: session.user,
          expiresAt: session.expiresAt,
        }),
      });

      if (!response.ok) {
        console.warn('Failed to persist session to backend');
      }
    } catch (err) {
      console.error('Session persistence error:', err);
      // Don't throw - allow local session to continue even if persistence fails
    }
  },

  /**
   * Verify session exists in backend (Redis/Database)
   * Useful for cross-device/cross-tab validation
   */
  async verifySessionExists(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/session/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      return response.ok;
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
            const currentUser = await authApi.getCurrentUser(storedToken);
            setToken(storedToken);
            setUser(currentUser);
          } catch (err) {
            // Token invalid or expired - clear it
            localStorage.removeItem(AUTH_STORAGE_KEY);
            localStorage.removeItem(AUTH_TOKEN_KEY);
            setToken(null);
            setUser(null);
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

    // Periodic session sync with backend (every 5 minutes)
    // Ensures Redis/Database session stays fresh and in sync
    const syncInterval = setInterval(async () => {
      if (token && user) {
        try {
          const session: AuthSession = {
            user,
            token,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          };
          await authApi.persistSession(token, session);
        } catch (err) {
          console.error('Periodic session sync failed:', err);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(syncInterval);
    };
  }, [token, user]);

  /**
   * Login with email and password (persist to backend via Redis + Database)
   */
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await authApi.login(email, password);

      // Store in both localStorage (for immediate access) and backend manages Redis/Database
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem(AUTH_TOKEN_KEY, session.token);

      setUser(session.user);
      setToken(session.token);

      // Persist session to backend (Redis + Database) for multi-device support
      await authApi.persistSession(session.token, session);

      // Notify other tabs
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: AUTH_STORAGE_KEY,
          newValue: JSON.stringify(session),
        })
      );
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
      if (token) {
        await authApi.logout(token);
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setUser(null);
      setToken(null);
      setError(null);
      setIsLoading(false);

      // Notify other tabs
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: AUTH_STORAGE_KEY,
          newValue: null,
        })
      );
    }
  }, [token]);

  /**
   * Switch user role (persisted to backend)
   */
  const switchRole = useCallback(async (role: UserRole): Promise<void> => {
    if (!token) throw new Error('No active session');

    try {
      const updatedUser = await authApi.switchRole(token, role);
      setUser(updatedUser);

      // Update persisted session
      const session: AuthSession = {
        user: updatedUser,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
    if (!token) return;

    try {
      const session = await authApi.refreshSession(token);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem(AUTH_TOKEN_KEY, session.token);
      setUser(session.user);
      setToken(session.token);

      // Re-persist updated session to backend
      await authApi.persistSession(session.token, session);
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
