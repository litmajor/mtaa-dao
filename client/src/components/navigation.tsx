import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, Moon, Sun, Settings, LogOut, ChevronDown, Sparkles } from "lucide-react";
import { useAuth } from "@/pages/hooks/useAuth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/components/theme-provider";
import type { User } from "../../../shared/schema";

export default function Navigation() {
  const { user } = useAuth() as { user?: User };
  const [, setLocation] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [notifications, setNotifications] = useState(3);

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

  const navItems = [
    { href: "/", label: "Dashboard", icon: "📊" },
    { href: "/proposals", label: "Proposals", icon: "📋" },
    { href: "/vault", label: "Vault", icon: "🏦" },
    { href: "/daos", label: "DAOs", icon: "🏛️" },
    { href: "/wallet", label: "Wallet", icon: "💳" },
    { href: "/referrals", label: "Referrals", icon: "🤝" },
    { href: "/wallet/dashboard", label: "Wallet Dashboard", icon: "📋" },
    { href: "/wallet/batch-transfer", label: "Batch Transfer", icon: "📦" },
    { href: "/wallet/multisig", label: "Multisig", icon: "🔑" },
    { href: "/wallet/dao-treasury", label: "DAO Treasury", icon: "🏦" },
    // Only show Admin Panel for admin/elder users
    ...(user?.roles === "admin" || user?.roles === "elder"
      ? [
          { href: "/admin", label: "Admin Panel", icon: "🛠️" },
        ]
      : []),
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
                {navItems.map((item) => (
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
                      {isActive(item.href) && (
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-gradient-to-r from-mtaa-orange to-amber-500 rounded-full"></div>
                      )}
                    </Button>
                  </Link>
                ))}
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
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-2 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-all duration-300"
                  >
                    <Bell className="w-5 h-5 hover:animate-bounce" />
                    {notifications > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg animate-pulse">
                        {notifications}
                      </span>
                    )}
                  </Button>
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
          {isLoggedIn && navItems.map((item) => (
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