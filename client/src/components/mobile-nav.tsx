import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Home, FileText, Vault, Building, Wallet, Users,
  Target, Gift, TrendingUp, Zap, Settings, Award
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/pages/hooks/useAuth";

export function MobileNav() {
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { user } = useAuth();

  const isActive = (path: string) => location === path;

  const primaryNavItems = [
    { href: "/dashboard", label: "Community", icon: Home },
    { href: "/vault-dashboard", label: "DeFi", icon: TrendingUp },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/proposals", label: "Proposals", icon: FileText },
    { href: "/tasks", label: "Tasks", icon: Target },
  ];

  const secondaryNavItems = [
    { href: "/daos", label: "DAOs", icon: Building },
    { href: "/maonovault", label: "MaonoVault", icon: Zap },
    { href: "/rewards", label: "Rewards", icon: Gift },
    { href: "/referrals", label: "Referrals", icon: Users },
    { href: "/analytics", label: "Analytics", icon: TrendingUp },
    { href: "/leaderboard", label: "Leaderboard", icon: Award },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* Primary Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-700/50 z-50 lg:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-xl transition-all duration-300 ${
                    isActive(item.href)
                      ? "text-mtaa-orange bg-mtaa-orange/10 shadow-lg shadow-mtaa-orange/20"
                      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </Button>
              </Link>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMore(!showMore)}
            className="flex flex-col items-center space-y-1 px-2 py-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <div className={`w-5 h-5 flex items-center justify-center transition-transform duration-300 ${showMore ? 'rotate-45' : ''}`}>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full ml-1"></div>
              <div className="w-1 h-1 bg-current rounded-full ml-1"></div>
            </div>
            <span className="text-xs font-medium">More</span>
          </Button>
        </div>
      </nav>

      {/* Secondary Navigation Overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMore(false)}
          />
          <div className="absolute bottom-20 left-4 right-4 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-2xl">
            <div className="grid grid-cols-3 gap-3">
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      onClick={() => setShowMore(false)}
                      className={`flex flex-col items-center space-y-2 p-4 rounded-xl h-auto transition-all duration-300 ${
                        isActive(item.href)
                          ? "text-mtaa-orange bg-mtaa-orange/10"
                          : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-xs font-medium text-center">{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}