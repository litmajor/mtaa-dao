import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Home, FileText, Vault, Building, Wallet, Users,
  Target, Gift, TrendingUp, Zap, Settings, Award, MoreHorizontal, Badge,
  Shuffle, Shield, Zap as ZapIcon, TrendingUp as TrendingUpIcon, BarChart3, Activity, Layers, Lock,
  Send, ArrowDownLeft, ArrowUpRight, Plus, Eye
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/pages/hooks/useAuth";

export function MobileNav() {
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { user } = useAuth();

  const isActive = (path: string) => location === path;

  // Updated primary navigation items 
  const primaryNavItems = [
    { to: "/dashboard", label: "Home", shortLabel: "H", icon: Home },
    { to: "/daos", label: "DAOs", shortLabel: "D", icon: Building },
    { to: "/defi-dex", label: "DeFi", shortLabel: "Dfi", icon: TrendingUp },
    { to: "/exchange-markets", label: "Exchange", shortLabel: "Ex", icon: Zap },
    { to: "/wallet", label: "Wallet", shortLabel: "W", icon: Wallet },

  ];

  // Top navigation items - Quick access to key pages
  const topNavItems = [
    { to: "/activity", label: "Activity", icon: Activity },
    { to: "/profile", label: "Profile", icon: Users },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  // Quick actions - useful inline actions for mobile users
  const quickActions = [
    { to: "/wallet", label: "Send", icon: Send, action: "send" },
    { to: "/wallet", label: "Receive", icon: ArrowDownLeft, action: "receive" },
    { to: "/vault-dashboard", label: "Deposit", icon: Plus, action: "deposit" },
    { to: "/my-rewards", label: "Rewards", icon: Gift, action: "rewards" },
  ];

  // Updated secondary navigation items, organized into sections for the "More" menu
  const moreMenuSections = [
    {
      title: "Trading",
      items: [
        { to: "/defi-dex", label: "DeFi DEX", icon: TrendingUp },
        { to: "/exchange-markets", label: "Exchange", icon: Zap },
      ],
    },

    {
      title: "Morio AI",
      items: [
        { to: "/morio-hub", label: "Morio AI", icon: Zap },
      ],
    },
    {
      title: "Cross-Chain",
      items: [
        { to: "/cross-chain-hub", label: "Cross-Chain Hub", icon: Shuffle },
        { to: "/cross-chain-bridge", label: "Bridge", icon: Shuffle },
        { to: "/cross-chain-swap", label: "Swap", icon: Shuffle },
      ],
    },
    {
      title: "Escrow & Security",
      items: [
        { to: "/escrow", label: "Escrow", icon: Lock },
        { to: "/escrow-analytics", label: "Analytics", icon: BarChart3 },
        { to: "/escrow-detail", label: "Details", icon: FileText },
      ],
    },
    {
      title: "Treasury & Governance",
      items: [
        { to: "/treasury-intelligence", label: "Treasury Intel", icon: BarChart3 },
        { to: "/proposals", label: "Proposals", icon: FileText },
      ],
    },
    {
      title: "Monitoring & Sync",
      items: [
        { to: "/synchronizer-monitor", label: "Synchronizer", icon: Shuffle },
        { to: "/defender-monitor", label: "Defender", icon: Shield },
        { to: "/analyzer-dashboard", label: "Analyzer", icon: BarChart3 },
      ],
    },
    {
      title: "Investment & Finance",
      items: [
        { to: "/vault-dashboard", label: "Vaults", icon: Vault },
        { to: "/maonovault-dashboard", label: "MaonoVault", icon: Zap },
        { to: "/investment-pools", label: "Pools", icon: TrendingUp },
      ],
    },
    {
      title: "Rewards & Social",
      items: [
        { to: "/my-rewards", label: "My Rewards", icon: Gift },
        { to: "/referrals", label: "Referrals", icon: Users },
        { to: "/leaderboard", label: "Leaderboard", icon: Award },
        { to: "/reputation-leaderboard", label: "Reputation", icon: Shield },
        { to: "/achievements", label: "Achievements", icon: Award },
      ],
    },
    {
      title: "Analytics & Insights",
      items: [
        { to: "/analytics-dashboard", label: "Analytics", icon: BarChart3 },
        { to: "/unified-dashboard", label: "Unified", icon: BarChart3 },
        { to: "/revenue-dashboard", label: "Revenue", icon: TrendingUp },
      ],
    },
    {
      title: "Community & Support",
      items: [
        { to: "/elders", label: "Elders", icon: Users },
        { to: "/events", label: "Events", icon: Layers },
        { to: "/faq-center", label: "FAQ", icon: FileText },
        { to: "/support", label: "Support", icon: Shield },
        { to: "/task-bounty-board", label: "Tasks", icon: Target },
      ],
    },
    {
      title: "Account",
      items: [
        { to: "/settings", label: "Settings", icon: Settings },
        { to: "/session-settings", label: "Sessions", icon: Activity },
        { to: "/profile", label: "Profile", icon: Users },
      ],
    },
  ];

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 z-50 lg:hidden shadow-sm">
        <div className="flex items-center justify-end px-3 py-3 safe-area-inset-top gap-2">
          {topNavItems.map((item) => {
            const Icon = item.icon;
            const isItemActive = isActive(item.to);
            return (
              <Link key={item.to} to={item.to}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ${
                    isItemActive
                      ? "text-mtaa-orange bg-mtaa-orange/10"
                      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>

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
                  <span className="text-xs font-medium hidden xs:inline">{item.label}</span>
                  <span className="text-xs font-medium xs:hidden">{item.shortLabel || item.label}</span>
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

            {/* Quick Actions */}
            <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-2">
                Quick Actions
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.action} to={action.to}>
                      <Button
                        variant="ghost"
                        onClick={() => setShowMore(false)}
                        className="flex flex-col items-center space-y-2 p-3 rounded-lg h-auto w-full transition-all duration-300 text-gray-600 hover:text-mtaa-orange dark:text-gray-300 dark:hover:text-mtaa-orange hover:bg-orange-50/50 dark:hover:bg-gray-700/50"
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
                      </Button>
                    </Link>
                  );
                })}
              </div>
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