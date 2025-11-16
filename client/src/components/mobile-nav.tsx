import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Home, FileText, Vault, Building, Wallet, Users,
  Target, Gift, TrendingUp, Zap, Settings, Award, MoreHorizontal, Badge
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/pages/hooks/useAuth";

export function MobileNav() {
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { user } = useAuth();

  const isActive = (path: string) => location === path;

  // Updated primary navigation items based on user request
  const primaryNavItems = [
    { to: "/dashboard", label: "Home", icon: Home, badge: 0 },
    { to: "/wallet", label: "Wallet", icon: Wallet, badge: 0 },
    { to: "/groups", label: "Groups", icon: Building, badge: 0 }, // Renamed from DAOs to Groups, more universal
    { to: "/activity", label: "Activity", icon: Target, badge: 0 }, // Merged Proposals and Tasks into Activity
  ];

  // Updated secondary navigation items, organized into sections for the "More" menu
  const moreMenuSections = [
    {
      title: "DAO Features", // Nested DAO features
      items: [
        { to: "/dao/treasury", label: "Treasury", icon: Vault },
        { to: "/dao/governance", label: "Governance", icon: FileText },
        // Add other DAO specific features here
      ],
    },
    {
      title: "Your Services",
      items: [
        { to: "/vault-dashboard", label: "Vaults", icon: Vault },
        { to: "/maonovault", label: "MaonoVault", icon: Zap },
        { to: "/rewards", label: "Rewards", icon: Gift },
        { to: "/referrals", label: "Referrals", icon: Users },
        { to: "/analytics", label: "Analytics", icon: TrendingUp },
        { to: "/leaderboard", label: "Leaderboard", icon: Award },
      ],
    },
    {
      title: "General",
      items: [
        { to: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  return (
    <>
      {/* Primary Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50 z-50 lg:hidden shadow-lg">
        <div className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isItemActive = isActive(item.to);
            return (
              <Link key={item.to} to={item.to}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`relative flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 ${
                    isItemActive
                      ? "text-mtaa-orange bg-mtaa-orange/10"
                      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {item.badge && item.badge > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                      >
                        {item.badge > 9 ? '9+' : item.badge}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs font-medium">{item.label}</span>
                </Button>
              </Link>
            );
          })}

          {/* More Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 ${
              showMore
                ? "text-mtaa-orange bg-mtaa-orange/10"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </Button>
        </div>
      </nav>

      {/* More Menu Overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMore(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">More Options</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMore(false)}
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                ✕
              </Button>
            </div>

            {/* Organized Sections */}
            <div className="px-4 py-6 space-y-6">
              {moreMenuSections.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-2">
                    {section.title}
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.to} to={item.to}>
                          <Button
                            variant="ghost"
                            onClick={() => setShowMore(false)}
                            className={`flex flex-col items-center space-y-2 p-4 rounded-xl h-auto w-full transition-all duration-300 ${
                              isActive(item.to)
                                ? "text-mtaa-orange bg-mtaa-orange/10 border-2 border-mtaa-orange/20"
                                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-700/50"
                            }`}
                          >
                            <Icon className="w-6 h-6" />
                            <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                          </Button>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Safe Area */}
            <div className="h-20" />
          </div>
        </div>
      )}
    </>
  );
}