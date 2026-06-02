
/**
 * TopNavBar Component
 * Top navigation bar for MTAA Protocol
 * Shows user info, search, and quick actions
 */

import React, { useState } from 'react';
import { useTradingMetrics } from '../../src/hooks/useTrading';
import { Lucide } from '../../src/lib/icons';
const { Menu, Bell, Target, DollarSign, ChartBar, CheckCircle, User, Settings, CreditCard, LogOut } = (Lucide as any) || {};

interface TopNavBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function TopNavBar({
  sidebarOpen,
  onToggleSidebar,
}: TopNavBarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { metrics } = useTradingMetrics();

  const notifications = [
    { id: 1, icon: Target, message: 'High liquidation risk on BTC/USDT', time: '2m ago' },
    { id: 2, icon: CheckCircle, message: 'Order filled: 1 BTC at $45,320', time: '1h ago' },
    { id: 3, icon: ChartBar, message: 'Win rate reached 55%', time: '3h ago' },
  ];

  return (
    <header className="h-16 bg-slate-800 border-b border-slate-700 px-6 flex items-center justify-between shadow-lg">
      {/* Left Side: Menu & Title */}
      <div className="flex items-center gap-4">
        {/* Menu Toggle */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
          title="Toggle sidebar"
        >
          {Menu ? <Menu className="w-5 h-5" /> : '☰'}
        </button>

        {/* Page Title */}
        <div className="hidden sm:block">
          <h1 className="text-white font-bold text-lg">Trading Dashboard</h1>
          <p className="text-slate-400 text-xs">Real-time trading management</p>
        </div>
      </div>

      {/* Center: Quick Stats */}
      <div className="hidden md:flex items-center gap-6">
        <QuickStat
          label="Win Rate"
          value={`${(metrics?.winRate ? metrics.winRate * 100 : 0).toFixed(1)}%`}
          icon="🎯"
          color={metrics?.winRate && metrics.winRate > 0.5 ? 'text-green-400' : 'text-red-400'}
        />
        <QuickStat
          label="Total P&L"
          value={`$${metrics?.totalPnl ? metrics.totalPnl.toFixed(0) : '0'}`}
          icon="💰"
          color={metrics?.totalPnl && metrics.totalPnl > 0 ? 'text-green-400' : 'text-red-400'}
        />
        <QuickStat
          label="Orders"
          value={metrics?.trades24h ? metrics.trades24h.toString() : '0'}
          icon="📊"
          color="text-blue-400"
        />
      </div>

      {/* Right Side: Actions */}
      <div className="flex items-center gap-4">
        {/* Search (Hidden on mobile) */}
        <div className="hidden lg:block">
          <input
            type="text"
            placeholder="Search pairs, exchanges..."
            className="px-4 py-2 rounded-lg bg-slate-700 text-white placeholder-slate-500 focus:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
            title="Notifications"
          >
            {Bell ? <Bell className="w-5 h-5" /> : '🔔'}
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-white font-bold">Notifications</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="px-4 py-3 border-b border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{typeof notif.icon === 'function' || typeof notif.icon === 'object' ? React.createElement(notif.icon, { className: 'w-5 h-5' }) : notif.icon}</span>
                      <div className="flex-1">
                        <p className="text-slate-200 text-sm">{notif.message}</p>
                        <p className="text-slate-500 text-xs mt-1">{notif.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-slate-700 text-center">
                <button className="text-blue-400 hover:text-blue-300 text-sm font-semibold">
                  View all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              U
            </div>
            <span className="hidden sm:inline">User</span>
            <span>▼</span>
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
              <div className="p-4 border-b border-slate-700">
                <p className="text-white font-bold">user@example.com</p>
                <p className="text-slate-400 text-sm">Free Plan</p>
              </div>
              <div className="py-2">
                <a
                  href="/profile"
                  className="block px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  {User ? <User className="inline w-4 h-4 mr-2" /> : '👤'} Profile
                </a>
                <a
                  href="/settings"
                  className="block px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  {Settings ? <Settings className="inline w-4 h-4 mr-2" /> : '⚙️'} Settings
                </a>
                <a
                  href="/billing"
                  className="block px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  {CreditCard ? <CreditCard className="inline w-4 h-4 mr-2" /> : '💳'} Billing
                </a>
              </div>
              <div className="border-t border-slate-700 py-2">
                <button className="w-full text-left px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors font-semibold">
                  {LogOut ? <LogOut className="inline w-4 h-4 mr-2" /> : '🚪'} Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * QuickStat Component - Small stat display in top nav
 */
function QuickStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-slate-400 text-xs">{label}</p>
        <p className={`font-bold text-sm ${color}`}>{value}</p>
      </div>
    </div>
  );
}
