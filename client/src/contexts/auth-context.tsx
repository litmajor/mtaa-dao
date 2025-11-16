import React, { createContext, useContext, useState } from 'react';
import { UserRole } from './navigation-context';

/**
 * Authentication Context
 * Manages user login/logout and session state
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
    avatar: '👨‍💼',
  },
  'manager@example.com': {
    id: '2',
    name: 'Manager User',
    email: 'manager@example.com',
    password: 'manager123',
    role: 'manager',
    avatar: '👨‍💼',
  },
  'user@example.com': {
    id: '3',
    name: 'Regular User',
    email: 'user@example.com',
    password: 'user123',
    role: 'user',
    avatar: '👤',
  },
  'viewer@example.com': {
    id: '4',
    name: 'Viewer User',
    email: 'viewer@example.com',
    password: 'viewer123',
    role: 'viewer',
    avatar: '👁️',
  },
};

/**
 * Authentication Provider
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>({
    id: '1',
    name: 'John Doe',
    email: 'admin@example.com',
    role: 'admin',
    avatar: '👨‍💼',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setUser(userWithoutPassword);
    setIsLoading(false);
  };

  /**
   * Logout
   */
  const logout = (): void => {
    setUser(null);
    setError(null);
  };

  /**
   * Switch user role (for testing purposes)
   */
  const switchRole = (role: UserRole): void => {
    if (user) {
      setUser({
        ...user,
        role,
      });
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
