import React, { useMemo } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  Users,
  Lock,
  Activity,
  Zap,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Check if user is super_admin
  const isSuperAdmin = useMemo(
    () => user?.role === 'super_admin',
    [user]
  );

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const navItems: NavItem[] = [
    {
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: 'Analytics',
      path: '/admin/analytics',
    },
    {
      icon: <Settings className="w-5 h-5" />,
      label: 'Settings',
      path: '/admin/settings',
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: 'Users',
      path: '/admin/users',
    },
    {
      icon: <Zap className="w-5 h-5" />,
      label: 'Beta Access',
      path: '/admin/beta-access',
    },
    {
      icon: <Lock className="w-5 h-5" />,
      label: 'DAOs',
      path: '/admin/daos',
    },
    {
      icon: <Activity className="w-5 h-5" />,
      label: 'Health Monitor',
      path: '/admin/health',
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-card border-r border-border transition-all duration-200 flex flex-col overflow-hidden`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          {sidebarOpen && <h1 className="text-lg font-bold">Admin</h1>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-muted rounded-lg"
          >
            {sidebarOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
              title={!sidebarOpen ? item.label : undefined}
            >
              {item.icon}
              {sidebarOpen && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-border space-y-2">
          {sidebarOpen && (
            <div className="text-xs">
              <p className="font-semibold truncate">{user?.email || 'Admin'}</p>
              <p className="text-muted-foreground text-xs">{user?.role || 'super_admin'}</p>
            </div>
          )}
          <button
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && 'Logout'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="border-b border-border bg-card px-6 py-4">
          <h2 className="text-2xl font-bold text-foreground">
            {navItems.find((item) => isActive(item.path))?.label || 'Admin Dashboard'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
