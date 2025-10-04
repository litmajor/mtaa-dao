import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, Moon, Sun, Settings, LogOut, ChevronDown, Sparkles } from "lucide-react";
import { useAuth } from "@/pages/hooks/useAuth";
import { useEffect, useState } from "react";
import { useLocation as useWouterLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/components/theme-provider";
import type { User } from "../../../shared/schema";
import NotificationCenter from "./NotificationCenter";

export default function Navigation() {
  const { user } = useAuth() as { user?: User };
  const [, setLocation] = useWouterLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0); // Changed from 'notifications' to 'notificationCount' for clarity

  // Fetch notification count
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Assuming you have an endpoint to fetch unread notification count
        const response = await apiRequest("GET", "/api/notifications/count");
        setNotificationCount(response?.count || 0);
      } catch (error) {
        console.error("Failed to fetch notification count:", error);
        // Optionally handle error state, e.g., set a default value or show an error message
      }
    };

    fetchNotifications();
    // Refetch notifications periodically or when relevant events occur
    const intervalId = setInterval(fetchNotifications, 60000); // Refetch every minute
    return () => clearInterval(intervalId);
  }, []);


  // Scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Logout handler
  async function handleLogout() {
    try {
      await apiRequest("POST", "/api/auth/logout");
      setLocation("/login");
      window.location.reload();
    } catch (e) {
      alert("Logout failed");
    }
  }

  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  const isActive = (path: string) => location === path;
  const isLoggedIn = !!user;

  // Organized navigation with dashboard categories
  const dashboardItems = [
    { href: "/dashboard", label: "Community Dashboard", icon: "🏛️", description: "DAO activities & proposals" },
    { href: "/vault-dashboard", label: "Vault Dashboard", icon: "🏦", description: "DeFi portfolio & governance" },
    { href: "/wallet", label: "Wallet Dashboard", icon: "💳", description: "Personal finance management" },
  ];

  const primaryNavItems = [
    { href: "/proposals", label: "Proposals", icon: "📋" },
    { href: "/tasks", label: "Tasks", icon: "🎯" },
    { href: "/daos", label: "DAOs", icon: "🏛️" },
    { href: "/rewards", label: "Rewards", icon: "🎁" },
  ];

  const vaultItems = [
    { href: "/vault", label: "Personal Vault", icon: "⚡" },
    { href: "/maonovault", label: "MaonoVault", icon: "💎" },
  ];

  const walletItems = [
    { href: "/wallet-setup", label: "Wallet Setup", icon: "⚙️" },
    { href: "/wallet/batch-transfer", label: "Batch Transfer", icon: "📦" },
    { href: "/wallet/multisig", label: "Multisig", icon: "🔑" },
  ];

  const daoItems = [
    { href: "/dao/treasury", label: "DAO Treasury", icon: "💰" },
    { href: "/dao/contributors", label: "Contributors", icon: "👥" },
    { href: "/dao/disbursements", label: "Disbursements", icon: "💸" },
    { href: "/dao/settings", label: "Settings", icon: "⚙️" },
  ];

  const adminItems = user?.roles === "admin" || user?.roles === "elder" ? [
    { href: "/superuser", label: "Super Dashboard", icon: "👑" },
    { href: "/admin/billing", label: "Billing", icon: "💳" },
    { href: "/admin/payments", label: "Payments", icon: "🔄" },
  ] : [];

  const utilityItems = [
    { href: "/referrals", label: "Referrals", icon: "🤝" },
    { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
    { href: "/pricing", label: "Pricing", icon: "💰" },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      isScrolled
        ? 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-lg shadow-black/5'
        : 'bg-gradient-to-r from-white via-gray-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-b border-gray-100/50 dark:border-gray-800/50'
    }`}>
      {/* Premium glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-mtaa-orange/5 to-transparent opacity-50"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex justify-between items-center h-16">
          {/* Logo Section */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-mtaa-orange via-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-mtaa-orange/30 group-hover:shadow-mtaa-orange/50 transition-all duration-300 group-hover:scale-105">
                  <span className="text-white font-bold text-lg">M</span>
                  <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 animate-pulse" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-xl bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent">
                  Mtaa DAO
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 -mt-1">Community Powered</span>
              </div>
            </Link>

            {/* Navigation Items */}
            {isLoggedIn && (
              <div className="hidden lg:flex items-center space-x-1">
                {/* Dashboard Dropdown */}
                <div className="relative group">
                  <Button
                    variant="ghost"
                    className="font-medium px-4 py-2 rounded-lg transition-all duration-300 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                  >
                    <span className="flex items-center space-x-2">
                      <span className="text-sm">📊</span>
                      <span>Dashboards</span>
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </Button>
                  
                  {/* Dashboard Dropdown Menu */}
                  <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 py-4 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 backdrop-blur-xl">
                    <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Choose Your Dashboard</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Access different aspects of your account</p>
                    </div>
                    <div className="p-2">
                      {dashboardItems.map((item) => (
                        <Link key={item.href} href={item.href}>
                          <Button
                            variant="ghost"
                            className={`w-full justify-start px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg mb-1 ${
                              isActive(item.href) ? "bg-mtaa-orange/10 text-mtaa-orange" : ""
                            }`}
                          >
                            <span className="flex items-center space-x-3">
                              <span className="text-lg">{item.icon}</span>
                              <div>
                                <span className="font-medium block">{item.label}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{item.description}</span>
                              </div>
                            </span>
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Primary Navigation */}
                {primaryNavItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      className={`relative font-medium px-4 py-2 rounded-lg transition-all duration-300 group ${
                        isActive(item.href)
                          ? "text-mtaa-orange bg-mtaa-orange/10 shadow-md shadow-mtaa-orange/20"
                          : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <span className="text-sm">{item.icon}</span>
                        <span>{item.label}</span>
                      </span>
                    </Button>
                  </Link>
                ))}

                {/* More Dropdown */}
                <div className="relative group">
                  <Button
                    variant="ghost"
                    className="font-medium px-4 py-2 rounded-lg transition-all duration-300 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                  >
                    <span className="flex items-center space-x-2">
                      <span className="text-sm">⚙️</span>
                      <span>More</span>
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </Button>
                  
                  {/* More Dropdown Menu */}
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 py-4 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 backdrop-blur-xl max-h-[80vh] overflow-y-auto">
                    {/* Analytics Section */}
                    <div className="px-4 pb-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">📊 Analytics & Reports</h4>
                      <div className="space-y-1">
                        <Link href="/analytics">
                          <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                            <span className="mr-2">📈</span>
                            Analytics Dashboard
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Vault Section */}
                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🏦 Vault Management</h4>
                      <div className="space-y-1">
                        {vaultItems.map((item) => (
                          <Link key={item.href} href={item.href}>
                            <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                              <span className="mr-2">{item.icon}</span>
                              {item.label}
                            </Button>
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Wallet Section */}
                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">💳 Wallet Tools</h4>
                      <div className="space-y-1">
                        {walletItems.map((item) => (
                          <Link key={item.href} href={item.href}>
                            <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                              <span className="mr-2">{item.icon}</span>
                              {item.label}
                            </Button>
                          </Link>
                        ))}
                        <Link href="/minipay">
                          <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                            <span className="mr-2">📱</span>
                            MiniPay Demo
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* DAO Section */}
                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🏛️ DAO Management</h4>
                      <div className="space-y-1">
                        {daoItems.map((item) => (
                          <Link key={item.href} href={item.href}>
                            <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                              <span className="mr-2">{item.icon}</span>
                              {item.label}
                            </Button>
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Admin Section */}
                    {adminItems.length > 0 && (
                      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">👑 Administration</h4>
                        <div className="space-y-1">
                          {adminItems.map((item) => (
                            <Link key={item.href} href={item.href}>
                              <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                                <span className="mr-2">{item.icon}</span>
                                {item.label}
                              </Button>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Community Section */}
                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🤝 Community & Growth</h4>
                      <div className="space-y-1">
                        {utilityItems.map((item) => (
                          <Link key={item.href} href={item.href}>
                            <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                              <span className="mr-2">{item.icon}</span>
                              {item.label}
                            </Button>
                          </Link>
                        ))}
                        <Link href="/success-stories">
                          <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                            <span className="mr-2">⭐</span>
                            Success Stories
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Resources Section */}
                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">📚 Resources</h4>
                      <div className="space-y-1">
                        <Link href="/about">
                          <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                            <span className="mr-2">ℹ️</span>
                            About
                          </Button>
                        </Link>
                        <Link href="/help">
                          <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                            <span className="mr-2">❓</span>
                            Help & Support
                          </Button>
                        </Link>
                        <Link href="/faq">
                          <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                            <span className="mr-2">💡</span>
                            FAQ
                          </Button>
                        </Link>
                        <Link href="/contact">
                          <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                            <span className="mr-2">📧</span>
                            Contact Us
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-3">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-all duration-300"
            >
              {theme === "light" ? (
                <Moon className="w-5 h-5 hover:rotate-12 transition-transform duration-300" />
              ) : (
                <Sun className="w-5 h-5 hover:rotate-12 transition-transform duration-300" />
              )}
            </Button>

            {isLoggedIn ? (
              <>
                {/* Notifications */}
                <div className="relative">
                  <NotificationCenter />
                </div>

                {/* Profile Dropdown */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-all duration-300 group"
                  >
                    <Avatar className="w-8 h-8 ring-2 ring-mtaa-orange/20 group-hover:ring-mtaa-orange/40 transition-all duration-300">
                      <AvatarImage src={user?.profileImageUrl ?? undefined} alt={user?.firstName || "User"} />
                      <AvatarFallback className="bg-gradient-to-br from-mtaa-orange to-amber-500 text-white text-sm font-bold">
                        {user?.firstName?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">
                        {user?.firstName} {user?.lastName}
                      </span>
                      <Badge className="bg-gradient-to-r from-mtaa-emerald to-green-500 text-white text-xs px-2 py-0.5 rounded-full shadow-md">
                        {user?.roles === "elder" ? "Elder" : user?.roles === "proposer" ? "Proposer" : "Member"}
                      </Badge>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${showProfileDropdown ? 'rotate-180' : ''}`} />
                  </Button>

                  {/* Dropdown Menu */}
                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 py-2 z-50 backdrop-blur-xl">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={user?.profileImageUrl ?? undefined} alt={user?.firstName || "User"} />
                            <AvatarFallback className="bg-gradient-to-br from-mtaa-orange to-amber-500 text-white">
                              {user?.firstName?.[0] || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{user?.firstName} {user?.lastName}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                          </div>
                        </div>
                      </div>

                      <Link href="/profile">
                        <Button variant="ghost" className="w-full justify-start px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-none">
                          <span className="mr-3">👤</span>
                          Profile
                        </Button>
                      </Link>

                      <Link href="/settings">
                        <Button variant="ghost" className="w-full justify-start px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-none">
                          <Settings className="w-4 h-4 mr-3" />
                          Settings
                        </Button>
                      </Link>

                      <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                        <Button
                          variant="ghost"
                          onClick={handleLogout}
                          className="w-full justify-start px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-none"
                        >
                          <LogOut className="w-4 h-4 mr-3" />
                          Logout
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Link href="/login">
                  <Button
                    variant="outline"
                    className={`font-medium px-6 py-2 rounded-lg border-2 transition-all duration-300 ${
                      isActive("/login")
                        ? "border-mtaa-orange text-mtaa-orange bg-mtaa-orange/10 shadow-lg shadow-mtaa-orange/20"
                        : "border-gray-300 text-gray-700 hover:border-mtaa-orange hover:text-mtaa-orange"
                    }`}
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    variant="default"
                    className="font-medium px-6 py-2 rounded-lg bg-gradient-to-r from-mtaa-orange to-amber-500 text-white shadow-lg shadow-mtaa-orange/30 hover:shadow-mtaa-orange/50 hover:scale-105 transition-all duration-300"
                  >
                    Register
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Toggle - Hidden for now but can be expanded */}
      <div className="lg:hidden px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          {isLoggedIn && [...dashboardItems, ...primaryNavItems].map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs px-3 py-1 rounded-full ${
                  isActive(item.href)
                    ? "text-mtaa-orange bg-mtaa-orange/10"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300"
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}