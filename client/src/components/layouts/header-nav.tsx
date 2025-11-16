import React, { useState } from 'react';
import { Input } from '../ui/input-design';
import { Button } from '../ui/button-design';
import { Icon } from '../ui/icon-design';

export interface HeaderNavItem {
  id: string;
  label: string;
  path?: string;
  children?: HeaderNavItem[];
}

export interface HeaderNavProps {
  logo?: React.ReactNode;
  title?: string;
  items?: HeaderNavItem[];
  activePath?: string;
  onNavigate?: (path: string) => void;
  
  // Search
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  
  // Notifications
  notifications?: {
    count: number;
    items?: NotificationItem[];
    onViewAll?: () => void;
  };
  
  // User menu
  userInfo?: {
    name: string;
    avatar?: string;
    email?: string;
  };
  userMenuItems?: UserMenuItem[];
  onUserMenuClick?: (action: string) => void;
  
  // Styling
  className?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read?: boolean;
  icon?: string;
}

export interface UserMenuItem {
  id: string;
  label: string;
  icon?: string;
  divider?: boolean;
}

export const HeaderNav = React.forwardRef<HTMLDivElement, HeaderNavProps>(
  (
    {
      logo,
      title,
      items = [],
      activePath,
      onNavigate,
      showSearch = true,
      searchPlaceholder = 'Search...',
      onSearch,
      notifications,
      userInfo,
      userMenuItems = [],
      onUserMenuClick,
      className,
    },
    ref
  ) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    return (
      <header
        ref={ref}
        className={`sticky top-0 z-40 bg-white border-b border-neutral-200 ${className || ''}`}
      >
        <div className="px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {logo && <div className="text-xl font-bold">{logo}</div>}
              {title && <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>}
            </div>

            {/* Navigation */}
            {items.length > 0 && (
              <nav className="hidden lg:flex items-center gap-6">
                {items.map(item => (
                  <div key={item.id} className="relative group">
                    <button
                      onClick={() => item.path && onNavigate?.(item.path)}
                      className={`text-sm font-medium transition-colors ${
                        activePath === item.path
                          ? 'text-blue-600'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {item.label}
                    </button>

                    {/* Dropdown */}
                    {item.children && item.children.length > 0 && (
                      <div className="absolute left-0 mt-0 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                        <div className="bg-white border border-neutral-200 rounded-lg shadow-lg py-2">
                          {item.children.map(child => (
                            <button
                              key={child.id}
                              onClick={() => child.path && onNavigate?.(child.path)}
                              className="block w-full text-left px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                            >
                              {child.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            )}

            {/* Right Section */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Search */}
              {showSearch && (
                <div className="hidden md:block">
                  <Input
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      onSearch?.(e.target.value);
                    }}
                    icon="search"
                    className="w-48"
                  />
                </div>
              )}

              {/* Notifications */}
              {notifications && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
                  >
                    <Icon name="bell" size="md" />
                    {notifications.count > 0 && (
                      <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-red-500 rounded-full">
                        {notifications.count}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-lg shadow-xl">
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.items && notifications.items.length > 0 ? (
                          <>
                            {notifications.items.map(notif => (
                              <div
                                key={notif.id}
                                className={`px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer ${
                                  !notif.read ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex gap-3">
                                  {notif.icon && (
                                    <Icon name={notif.icon} size="md" className="flex-shrink-0 mt-1" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-neutral-900">{notif.title}</p>
                                    <p className="text-sm text-neutral-600 mt-1">{notif.message}</p>
                                    <p className="text-xs text-neutral-500 mt-1">{notif.timestamp}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {notifications.onViewAll && (
                              <button
                                onClick={notifications.onViewAll}
                                className="w-full px-4 py-2 text-center text-sm text-blue-600 hover:bg-neutral-50 border-t border-neutral-100 font-medium"
                              >
                                View All
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="px-4 py-8 text-center text-neutral-600">
                            No notifications
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User Menu */}
              {userInfo && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-100"
                  >
                    {userInfo.avatar && (
                      <img
                        src={userInfo.avatar}
                        alt={userInfo.name}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium text-neutral-900">{userInfo.name}</p>
                      {userInfo.email && (
                        <p className="text-xs text-neutral-600">{userInfo.email}</p>
                      )}
                    </div>
                    <Icon name="chevron-down" size="sm" />
                  </button>

                  {/* User Menu Dropdown */}
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-lg shadow-xl">
                      {/* User Info Header */}
                      {userInfo && (
                        <div className="px-4 py-3 border-b border-neutral-200">
                          <p className="text-sm font-medium text-neutral-900">{userInfo.name}</p>
                          {userInfo.email && (
                            <p className="text-xs text-neutral-600">{userInfo.email}</p>
                          )}
                        </div>
                      )}

                      {/* Menu Items */}
                      <div className="py-2">
                        {userMenuItems.map((item, idx) => (
                          <div key={item.id}>
                            {item.divider && <div className="border-t border-neutral-200 my-2" />}
                            <button
                              onClick={() => {
                                onUserMenuClick?.(item.id);
                                setShowUserMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                            >
                              {item.icon && <Icon name={item.icon} size="sm" />}
                              {item.label}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  }
);

HeaderNav.displayName = 'HeaderNav';
