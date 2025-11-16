import { useAuth } from '../contexts/auth-context';
import { useNavigation, useIsAdmin, useCanAccess } from '../contexts/navigation-context';
import { UserRole } from '../contexts/navigation-context';

/**
 * Combined hook for accessing both auth and navigation context
 * Simplifies using both contexts together in components
 */
export const useAppContext = () => {
  const auth = useAuth();
  const navigation = useNavigation();
  const isAdmin = useIsAdmin();
  const canAccess = (permission: any) => useCanAccess(permission);

  return {
    // Auth context
    auth,
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    login: auth.login,
    logout: auth.logout,
    switchRole: auth.switchRole,
    clearError: auth.clearError,

    // Navigation context
    navigation,
    currentUser: navigation.currentUser,
    getFilteredNavItems: navigation.getFilteredNavItems,
    checkPermission: navigation.checkPermission,
    hasRole: navigation.hasRole,
    isAdminUser: navigation.isAdminUser,

    // Combined helpers
    isAdmin,
    canAccess,
  };
};

/**
 * Hook to check if user has access to a specific feature
 */
export const useFeatureAccess = (requiredRole?: UserRole | UserRole[], requiredPermission?: string) => {
  const { hasRole, checkPermission } = useNavigation();

  const hasAccess = () => {
    if (requiredRole && !hasRole(requiredRole)) {
      return false;
    }
    if (requiredPermission) {
      return checkPermission(requiredPermission as any);
    }
    return true;
  };

  return hasAccess();
};

/**
 * Hook to get filtered navigation items for current user
 */
export const useFilteredNav = (items: any[]) => {
  const { getFilteredNavItems } = useNavigation();
  return getFilteredNavItems(items);
};

/**
 * Hook to check if current user is authorized
 */
export const useIsAuthorized = () => {
  const { isAuthenticated } = useAuth();
  const { currentUser } = useNavigation();

  return {
    isLoggedIn: isAuthenticated,
    hasRole: currentUser !== null,
    user: currentUser,
  };
};
