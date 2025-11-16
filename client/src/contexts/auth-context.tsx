import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from './navigation-context';

/**
 * Authentication Context
 * Manages user login/logout and session state with localStorage persistence
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'mtaa_dao_auth_user';

/**
 * Mock users for demonstration
 */
const MOCK_USERS: Record<string, AuthUser & { password: string }> = {
  'admin@example.com': {
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin',
  },
  'manager@example.com': {
    id: '2',
    name: 'Manager User',
    email: 'manager@example.com',
    password: 'manager123',
    role: 'manager',
  },
  'user@example.com': {
    id: '3',
    name: 'Regular User',
    email: 'user@example.com',
    password: 'user123',
    role: 'user',
  },
  'viewer@example.com': {
    id: '4',
    name: 'Viewer User',
    email: 'viewer@example.com',
    password: 'viewer123',
    role: 'viewer',
  },
};

/**
 * Authentication Provider with localStorage persistence
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Failed to load user from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login with email and password
   */
  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const mockUser = MOCK_USERS[email];

    if (!mockUser || mockUser.password !== password) {
      setError('Invalid email or password');
      setIsLoading(false);
      return;
    }

    const { password: _, ...userWithoutPassword } = mockUser;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userWithoutPassword));
    setUser(userWithoutPassword);
    setIsLoading(false);
  };

  /**
   * Logout
   */
  const logout = (): void => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setError(null);
  };

  /**
   * Switch user role (for testing purposes)
   */
  const switchRole = (role: UserRole): void => {
    if (user) {
      const updatedUser = {
        ...user,
        role,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  /**
   * Clear error message
   */
  const clearError = (): void => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    error,
    login,
    logout,
    switchRole,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use authentication context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
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
