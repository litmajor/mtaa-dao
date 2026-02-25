/**
 * Sidebar Component
 * Left navigation sidebar for MTAA Protocol
 * Shows main navigation items with active state
 */

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface NavItem {
  icon: string;
  label: string;
  href: string;
  badge?: number;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const router = useRouter();

  const navItems: NavItem[] = [
    { icon: '📊', label: 'Dashboard', href: '/dashboard' },
    { icon: '💹', label: 'Trading', href: '/dashboard/trading', badge: undefined },
    { icon: '🚀', label: 'Smart Routing', href: '/dashboard/trading?tab=smart-routing' },
    { icon: '📈', label: 'Analytics', href: '/dashboard/analytics' },
    { icon: '💱', label: 'Advanced Swap', href: '/dashboard/dex?tab=swap' },
    { icon: '🌉', label: 'Cross-Chain Bridge', href: '/dashboard/dex?tab=bridge' },
    { icon: '⚙️', label: 'Settings', href: '/dashboard/settings' },
    { icon: '🤖', label: 'Bots', href: '/dashboard/bots', badge: 3 },
    { icon: '📝', label: 'History', href: '/dashboard/trading?tab=history' },
  ];

  const isActive = (href: string): boolean => {
    // Handle both exact and prefix matches
    if (href.includes('?tab=')) {
      // For query parameters, check both path and query
      const [path, query] = href.split('?');
      return router.pathname === path && router.asPath.includes(query);
    }
    if (href === '/dashboard') {
      return router.pathname === '/dashboard' && !router.asPath.includes('?tab=');
    }
    return router.pathname.startsWith(href) && !router.asPath.includes('?tab=');
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-40"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-800 border-r border-slate-700 transition-transform duration-300 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm">MTAA</span>
              <span className="text-slate-400 text-xs">Protocol</span>
            </div>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={onToggle}
            className="lg:hidden text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                className={`flex items-center justify-between px-4 py-3 rounded-lg font-semibold transition-all group ${
                  isActive(item.href)
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl group-hover:scale-110 transition-transform">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
              </a>
            </Link>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-slate-700 p-4 space-y-2">
          {/* Help */}
          <Link href="/help">
            <a className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all">
              <span className="text-lg">❓</span>
              <span>Help & Support</span>
            </a>
          </Link>

          {/* Docs */}
          <a
            href="https://docs.mtaaprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
          >
            <span className="text-lg">📖</span>
            <span>Documentation</span>
          </a>

          {/* Logout */}
          <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all font-semibold">
            <span className="text-lg">🚪</span>
            <span>Logout</span>
          </button>
        </div>

        {/* Version Info */}
        <div className="px-4 py-3 border-t border-slate-700 text-center">
          <p className="text-slate-500 text-xs">MTAA Protocol</p>
          <p className="text-slate-600 text-xs">v1.0.0</p>
        </div>
      </aside>
    </>
  );
}
