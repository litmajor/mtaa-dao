import React, { createContext, useContext } from 'react';

/**
 * Navigation Context for RBAC (Role-Based Access Control)
 * Defines role-based visibility of pages and features
 */

export type UserRole = 'admin' | 'manager' | 'user' | 'viewer';

export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  visible: boolean;
  requiredRole?: UserRole | UserRole[];
  children?: NavigationItem[];
}

export interface PermissionSet {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  canExport: boolean;
  canManageUsers: boolean;
  canAccessAdmin: boolean;
  canAccessAnalytics: boolean;
  canAccessSettings: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: PermissionSet;
}

interface NavigationContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  getFilteredNavItems: (items: NavigationItem[]) => NavigationItem[];
  checkPermission: (permission: keyof PermissionSet) => boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isAdminUser: () => boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

/**
 * Default permission sets for each role
 */
const DEFAULT_PERMISSIONS: Record<UserRole, PermissionSet> = {
  admin: {
    canView: true,
    canEdit: true,
    canDelete: true,
    canCreate: true,
    canExport: true,
    canManageUsers: true,
    canAccessAdmin: true,
    canAccessAnalytics: true,
    canAccessSettings: true,
  },
  manager: {
    canView: true,
    canEdit: true,
    canDelete: false,
    canCreate: true,
    canExport: true,
    canManageUsers: false,
    canAccessAdmin: false,
    canAccessAnalytics: true,
    canAccessSettings: true,
  },
  user: {
    canView: true,
    canEdit: true,
    canDelete: false,
    canCreate: false,
    canExport: false,
    canManageUsers: false,
    canAccessAdmin: false,
    canAccessAnalytics: false,
    canAccessSettings: true,
  },
  viewer: {
    canView: true,
    canEdit: false,
    canDelete: false,
    canCreate: false,
    canExport: false,
    canManageUsers: false,
    canAccessAdmin: false,
    canAccessAnalytics: false,
    canAccessSettings: false,
  },
};

/**
 * Navigation visibility rules by role
 */
const NAVIGATION_RULES: Record<UserRole, string[]> = {
  admin: ['dashboard', 'users', 'products', 'orders', 'reports', 'analytics', 'settings'],
  manager: ['dashboard', 'users', 'products', 'orders', 'reports', 'analytics', 'settings'],
  user: ['dashboard', 'products', 'orders', 'settings'],
  viewer: ['dashboard', 'products'],
};

/**
 * Navigation Context Provider
 */
export const NavigationProvider: React.FC<{ children: React.ReactNode; initialUser?: User }> = ({
  children,
  initialUser,
}) => {
  const [currentUser, setCurrentUser] = React.useState<User | null>(
    initialUser || {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
      permissions: DEFAULT_PERMISSIONS.admin,
    }
  );

  /**
   * Filter navigation items based on user role
   */
  const getFilteredNavItems = (items: NavigationItem[]): NavigationItem[] => {
    if (!currentUser) return [];

    const visibleItems = NAVIGATION_RULES[currentUser.role] || [];

    return items
      .filter((item) => {
        // Check if item ID is in visible items for this role
        const isVisibleForRole = visibleItems.includes(item.id);

        // Check explicit requiredRole if specified
        if (item.requiredRole) {
          const requiredRoles = Array.isArray(item.requiredRole)
            ? item.requiredRole
            : [item.requiredRole];
          const hasRequiredRole = requiredRoles.includes(currentUser.role);
          return isVisibleForRole && hasRequiredRole;
        }

        return isVisibleForRole;
      })
      .map((item) => ({
        ...item,
        visible: true,
        children: item.children ? getFilteredNavItems(item.children) : undefined,
      }));
  };

  /**
   * Check if user has specific permission
   */
  const checkPermission = (permission: keyof PermissionSet): boolean => {
    if (!currentUser) return false;
    const userPermissions = currentUser.permissions || DEFAULT_PERMISSIONS[currentUser.role];
    return userPermissions[permission] === true;
  };

  /**
   * Check if user has specific role(s)
   */
  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!currentUser) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(currentUser.role);
  };

  /**
   * Check if user is admin
   */
  const isAdminUser = (): boolean => {
    return hasRole('admin');
  };

  const value: NavigationContextType = {
    currentUser,
    setCurrentUser,
    getFilteredNavItems,
    checkPermission,
    hasRole,
    isAdminUser,
  };

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

/**
 * Hook to use navigation context
 */
export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

/**
 * Hook to check if user has admin access
 */
export const useIsAdmin = (): boolean => {
  const { isAdminUser } = useNavigation();
  return isAdminUser();
};

/**
 * Hook to check specific permission
 */
export const useCanAccess = (permission: keyof PermissionSet): boolean => {
  const { checkPermission } = useNavigation();
  return checkPermission(permission);
};

/**
 * Hook to get current user
 */
export const useCurrentUser = (): User | null => {
  const { currentUser } = useNavigation();
  return currentUser;
};

/**
 * Protected route component - only renders if user has permission
 */
export const ProtectedPage: React.FC<{
  requiredRole?: UserRole | UserRole[];
  requiredPermission?: keyof PermissionSet;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ requiredRole, requiredPermission, children, fallback }) => {
  const { hasRole, checkPermission } = useNavigation();

  const hasAccess = () => {
    if (requiredRole && !hasRole(requiredRole)) {
      return false;
    }
    if (requiredPermission && !checkPermission(requiredPermission)) {
      return false;
    }
    return true;
  };

  if (!hasAccess()) {
    return <>{fallback || <div>Access Denied</div>}</>;
  }

  return <>{children}</>;
};

/**
 * Menu item wrapper - hides menu items based on permissions
 */
export const MenuItemWrapper: React.FC<{
  item: NavigationItem;
  children: React.ReactNode;
}> = ({ item, children }) => {
  const { getFilteredNavItems } = useNavigation();
  const filteredItems = getFilteredNavItems([item]);

  if (filteredItems.length === 0) {
    return null;
  }

  return <>{children}</>;
};

export default NavigationContext;
