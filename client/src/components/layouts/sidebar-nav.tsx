import React, { useState } from 'react';
import { Icon } from '../ui/icon-design';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon?: string;
  path?: string;
  badge?: number;
  children?: SidebarNavItem[];
  visible?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface SidebarNavProps {
  items: SidebarNavItem[];
  activePath?: string;
  onNavigate?: (path: string) => void;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  userInfo?: {
    name: string;
    avatar?: string;
    role?: string;
  };
  logo?: React.ReactNode;
  className?: string;
}

export const SidebarNav = React.forwardRef<HTMLDivElement, SidebarNavProps>(
  (
    {
      items,
      activePath,
      onNavigate,
      collapsed = false,
      onCollapse,
      userInfo,
      logo,
      className,
    },
    ref
  ) => {
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const toggleExpand = (itemId: string) => {
      const newExpanded = new Set(expandedItems);
      if (newExpanded.has(itemId)) {
        newExpanded.delete(itemId);
      } else {
        newExpanded.add(itemId);
      }
      setExpandedItems(newExpanded);
    };

    const handleNavigate = (item: SidebarNavItem) => {
      if (item.path) {
        onNavigate?.(item.path);
      }
      if (item.onClick) {
        item.onClick();
      }
      if (item.children && item.children.length > 0) {
        toggleExpand(item.id);
      }
    };

    const renderItem = (item: SidebarNavItem, depth = 0): React.ReactNode => {
      if (item.visible === false) return null;

      const isActive = activePath === item.path;
      const isExpanded = expandedItems.has(item.id);
      const hasChildren = item.children && item.children.length > 0;

      return (
        <div key={item.id}>
          <button
            onClick={() => handleNavigate(item)}
            disabled={item.disabled}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-600'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
            } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ paddingLeft: `${12 + depth * 12}px` }}
          >
            {item.icon && !collapsed && (
              <Icon name={item.icon} size="sm" className="flex-shrink-0" />
            )}
            {item.icon && collapsed && (
              <Icon name={item.icon} size="sm" className="flex-shrink-0" />
            )}
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-600 rounded-full flex-shrink-0">
                    {item.badge}
                  </span>
                )}
                {hasChildren && (
                  <Icon
                    name="chevron-down"
                    size="sm"
                    className={`flex-shrink-0 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </>
            )}
            {collapsed && item.badge && (
              <span className="absolute left-10 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                {item.badge}
              </span>
            )}
          </button>

          {/* Children */}
          {hasChildren && isExpanded && !collapsed && (
            <div className="mt-1">
              {item.children!.map(child => renderItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div
        ref={ref}
        className={`h-full flex flex-col bg-white border-r border-neutral-200 transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        } ${className || ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          {!collapsed && (
            <div className="flex items-center gap-2">
              {logo || <div className="text-lg font-bold text-neutral-900">Logo</div>}
            </div>
          )}
          <button
            onClick={() => onCollapse?.(!collapsed)}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size="sm" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <div className="space-y-1">
            {items.map(item => renderItem(item))}
          </div>
        </nav>

        {/* User Info */}
        {userInfo && !collapsed && (
          <div className="p-4 border-t border-neutral-200">
            <div className="flex items-center gap-3">
              {userInfo.avatar && (
                <img
                  src={userInfo.avatar}
                  alt={userInfo.name}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{userInfo.name}</p>
                {userInfo.role && (
                  <p className="text-xs text-neutral-600 truncate">{userInfo.role}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

SidebarNav.displayName = 'SidebarNav';
