import React, { useState } from 'react';
import { useNavigation, NavigationItem, useIsAdmin } from '../contexts/navigation-context';
import { useUserRole } from '../contexts/auth-context';

/**
 * RBAC-Enhanced Sidebar Navigation Component
 * Filters menu items based on user role and permissions
 */

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  visible: boolean;
  requiredRole?: string | string[];
}

interface SidebarNavProps {
  items: SidebarNavItem[];
  activePath?: string;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  userInfo?: { name: string; role: string };
  logo?: React.ReactNode;
  onNavigate?: (path: string) => void;
}

/**
 * Enhanced SidebarNav with RBAC support
 */
export const SidebarNav: React.FC<SidebarNavProps> = ({
  items,
  activePath = '/',
  collapsed = false,
  onCollapse,
  userInfo,
  logo,
  onNavigate,
}) => {
  const { getFilteredNavItems, currentUser } = useNavigation();
  const userRole = useUserRole();
  const isAdmin = useIsAdmin();

  // Convert SidebarNavItem[] to NavigationItem[] for filtering
  const navigationItems: NavigationItem[] = items.map((item) => ({
    ...item,
    requiredRole: item.requiredRole ? (Array.isArray(item.requiredRole) ? item.requiredRole : [item.requiredRole] as any) : undefined,
  }));

  // Get filtered items based on current user role
  const filteredItems = getFilteredNavItems(navigationItems);

  const toggleCollapse = () => {
    if (onCollapse) {
      onCollapse(!collapsed);
    }
  };

  const handleNavigation = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
    // Typically would use React Router navigation here
    console.log(`Navigating to ${path}`);
  };

  // RBAC: Show admin badge for admin users
  const showAdminBadge = isAdmin && userInfo;

  return (
    <aside
      className={`bg-neutral-900 text-white transition-all duration-300 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo Section */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        {!collapsed && <div className="font-bold text-lg">{logo || 'Menu'}</div>}
        <button
          onClick={toggleCollapse}
          className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* User Info Section */}
      {userInfo && (
        <div className="p-4 border-b border-neutral-800">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
              {userInfo.name.charAt(0)}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{userInfo.name}</p>
                <p className={`text-xs text-neutral-400 truncate ${showAdminBadge ? 'text-orange-400' : ''}`}>
                  {showAdminBadge && '⭐ '}
                  {userInfo.role}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-4">
        {filteredItems.length === 0 ? (
          <div className={`px-4 py-2 text-xs text-neutral-500 ${collapsed ? 'hidden' : ''}`}>
            No menu items available for your role
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleNavigation(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    activePath === item.path
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-300 hover:bg-neutral-800'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="w-5 h-5 flex items-center justify-center text-sm">
                    {item.icon === 'home' && '🏠'}
                    {item.icon === 'users' && '👥'}
                    {item.icon === 'box' && '📦'}
                    {item.icon === 'shopping-cart' && '🛒'}
                    {item.icon === 'chart' && '📊'}
                    {item.icon === 'trending-up' && '📈'}
                    {item.icon === 'settings' && '⚙️'}
                    {item.icon === 'shield' && '🛡️'}
                    {item.icon === 'lock' && '🔒'}
                    {item.icon === 'bell' && '🔔'}
                    {item.icon === 'credit-card' && '💳'}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                      {/* RBAC Badge for admin-only items */}
                      {item.requiredRole && Array.isArray(item.requiredRole) && item.requiredRole.includes('admin') && (
                        <span className="text-xs bg-orange-600 px-2 py-0.5 rounded">Admin</span>
                      )}
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Footer Section - Role Indicator */}
      {!collapsed && (
        <div className="p-4 border-t border-neutral-800 text-xs text-neutral-500">
          <p className="mb-2">Current Role: <span className="font-semibold text-neutral-300">{currentUser?.role?.toUpperCase()}</span></p>
          {isAdmin && (
            <p className="text-orange-400 flex items-center gap-1">
              ⭐ Admin Access
            </p>
          )}
        </div>
      )}
    </aside>
  );
};

export default SidebarNav;
