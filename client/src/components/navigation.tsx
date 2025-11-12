import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, Settings, LogOut, ChevronDown, Wallet } from "lucide-react";
import { useAuth } from "@/pages/hooks/useAuth";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/components/theme-provider";
import type { User } from "../../../shared/schema";
import NotificationCenter from "./NotificationCenter";
import { AnimatedLogo } from "@/components/ui/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function Navigation() {
  const { user } = useAuth() as { user?: User };
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowProfileDropdown(false);
    if (showProfileDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showProfileDropdown]);

  // Logout handler
  async function handleLogout() {
    try {
      await apiRequest("POST", "/api/auth/logout");
      navigate("/login");
      window.location.reload();
    } catch (e) {
      alert("Logout failed");
    }
  }

  const isActive = (path: string) => location.pathname === path;
  const isLoggedIn = !!user;
  const isInDao = user?.roles === "elder" || user?.roles === "proposer" || user?.roles === "admin";
  const isAdmin = user?.roles === "admin" || user?.roles === "elder";

  // Navigation items organized by category
  const quickAccessItems = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/profile", label: "Profile", icon: "👤" },
  ];

  const dashboardItems = [
    { href: "/dashboard", label: "Community Dashboard", icon: "🏛️", description: "DAO activities & proposals" },
    { href: "/vault-dashboard", label: "Vault Dashboard", icon: "🏦", description: "DeFi portfolio & governance" },
    { href: "/wallet", label: "Wallet Dashboard", icon: "💳", description: "Personal finance management" },
  ];

  const primaryNavItems = [
    ...(isInDao ? [{ href: "/proposals", label: "Proposals", icon: "📋" }] : []),
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
    { href: "/minipay", label: "MiniPay Demo", icon: "📱" },
  ];

  const daoItems = [
    { href: "/dao/treasury", label: "DAO Treasury", icon: "💰" },
    { href: "/dao/contributors", label: "Contributors", icon: "👥" },
    { href: "/dao/disbursements", label: "Disbursements", icon: "💸" },
    { href: "/dao/settings", label: "Settings", icon: "⚙️" },
  ];

  const adminItems = isAdmin ? [
    { href: "/superuser", label: "Super Dashboard", icon: "👑" },
    { href: "/admin/billing", label: "Billing", icon: "💳" },
    { href: "/admin/payments", label: "Payments", icon: "🔄" },
    { href: "/admin/users", label: "Manage Users", icon: "👥" },
  ] : [];

  const utilityItems = [
    { href: "/referrals", label: "Referrals", icon: "🤝" },
    { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
    { href: "/pricing", label: "Pricing", icon: "💰" },
    { href: "/success-stories", label: "Success Stories", icon: "⭐" },
  ];

  const resourceItems = [
    { href: "/blog", label: "Blog", icon: "📝" },
    { href: "/about", label: "About", icon: "ℹ️" },
    { href: "/help", label: "Help & Support", icon: "❓" },
    { href: "/faq", label: "FAQ", icon: "💡" },
    { href: "/contact", label: "Contact Us", icon: "📧" },
  ];

  return (
    <>
      {/* Main Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-lg'
          : 'bg-white dark:bg-gray-900 border-b border-gray-100/50 dark:border-gray-800/50'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-mtaa-orange/5 to-transparent opacity-50" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-between items-center h-16">
            {/* Logo Section */}
            <div className="flex items-center space-x-8">
              <Link to="/" className="group">
                <AnimatedLogo variant="full" size="md" className="hidden sm:flex" />
                <AnimatedLogo variant="icon" size="md" className="sm:hidden" />
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center space-x-1">
                {/* Quick Access */}
                {quickAccessItems.map((item) => (
                  <Link key={item.href} to={item.href}>
                    <Button
                      variant="ghost"
                      className={`font-medium px-4 py-2 rounded-lg transition-all ${
                        isActive(item.href)
                          ? "text-mtaa-orange bg-mtaa-orange/10"
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

                {/* Dashboards Dropdown */}
                <div className="relative group">
                  <Button variant="ghost" className="font-medium px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-800/50">
                    <span className="flex items-center space-x-2">
                      <span className="text-sm">📊</span>
                      <span>Dashboards</span>
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </Button>

                  <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 py-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Choose Your Dashboard</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Access different aspects of your account</p>
                    </div>
                    <div className="p-2">
                      {dashboardItems.map((item) => (
                        <Link key={item.href} to={item.href}>
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
                  <Link key={item.href} to={item.href}>
                    <Button
                      variant="ghost"
                      className={`font-medium px-4 py-2 rounded-lg transition-all ${
                        isActive(item.href)
                          ? "text-mtaa-orange bg-mtaa-orange/10"
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
                  <Button variant="ghost" className="font-medium px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-800/50">
                    <span className="flex items-center space-x-2">
                      <span className="text-sm">⚙️</span>
                      <span>More</span>
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </Button>

                  <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 py-4 max-h-[80vh] overflow-y-auto opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    {/* Vault Section */}
                    <div className="px-4 pb-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🏦 Vault Management</h4>
                      <div className="space-y-1">
                        {vaultItems.map((item) => (
                          <Link key={item.href} to={item.href}>
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
                          <Link key={item.href} to={item.href}>
                            <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                              <span className="mr-2">{item.icon}</span>
                              {item.label}
                            </Button>
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* DAO Section */}
                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🏛️ DAO Management</h4>
                      <div className="space-y-1">
                        {daoItems.map((item) => (
                          <Link key={item.href} to={item.href}>
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
                            <Link key={item.href} to={item.href}>
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
                          <Link key={item.href} to={item.href}>
                            <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                              <span className="mr-2">{item.icon}</span>
                              {item.label}
                            </Button>
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Resources Section */}
                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">📚 Resources</h4>
                      <div className="space-y-1">
                        {resourceItems.map((item) => (
                          <Link key={item.href} to={item.href}>
                            <Button variant="ghost" className="w-full justify-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                              <span className="mr-2">{item.icon}</span>
                              {item.label}
                            </Button>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </nav>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-3">
              {/* Wallet Address Display */}
              {user?.walletAddress && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigator.clipboard.writeText(user.walletAddress!)}
                      className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Wallet className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                        {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Click to copy address</TooltipContent>
                </Tooltip>
              )}

              {/* Theme Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleTheme}
                    className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Toggle theme"
                  >
                    {theme === "light" ? (
                      <Moon className="w-4 h-4 text-gray-600" />
                    ) : (
                      <Sun className="w-4 h-4 text-yellow-500" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Toggle {theme === "light" ? 'Dark' : 'Light'} Mode</TooltipContent>
              </Tooltip>

              {isLoggedIn ? (
                <>
                  {/* Notifications */}
                  <NotificationCenter />

                  {/* Profile Dropdown */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProfileDropdown(!showProfileDropdown);
                      }}
                      className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-all"
                    >
                      <Avatar className="w-8 h-8 ring-2 ring-mtaa-orange/20">
                        <AvatarImage src={user?.profileImageUrl ?? undefined} alt={user?.firstName || "User"} />
                        <AvatarFallback className="bg-gradient-to-br from-mtaa-orange to-amber-500 text-white text-sm font-bold">
                          {user?.firstName?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden md:flex flex-col items-start">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm">
                          {user?.firstName} {user?.lastName}
                        </span>
                        <Badge className="bg-gradient-to-r from-mtaa-emerald to-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {user?.roles === "elder" ? "Elder" : user?.roles === "proposer" ? "Proposer" : "Member"}
                        </Badge>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                    </Button>

                    {showProfileDropdown && (
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 py-2 z-50">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                          <div className="flex items-center space-x-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={user?.profileImageUrl ?? undefined} />
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

                        <Link to="/profile">
                          <Button variant="ghost" className="w-full justify-start px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <span className="mr-3">👤</span>
                            Profile
                          </Button>
                        </Link>

                        <Link to="/settings">
                          <Button variant="ghost" className="w-full justify-start px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <Settings className="w-4 h-4 mr-3" />
                            Settings
                          </Button>
                        </Link>

                        <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                          <Button
                            variant="ghost"
                            onClick={handleLogout}
                            className="w-full justify-start px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
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
                  <Link to="/login">
                    <Button variant="outline" className="font-medium px-6 py-2 rounded-lg border-2">
                      Login
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button className="font-medium px-6 py-2 rounded-lg bg-gradient-to-r from-mtaa-orange to-amber-500 text-white">
                      Register
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2"
              >
                {mobileMenuOpen ? "✖️" : "☰"}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-80 bg-white dark:bg-gray-900 shadow-xl overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <AnimatedLogo variant="icon" size="md" />
                <Button variant="ghost" onClick={() => setMobileMenuOpen(false)}>
                  ✖️
                </Button>
              </div>
              
              <div className="space-y-2">
                {[...quickAccessItems, ...dashboardItems, ...primaryNavItems, ...vaultItems, ...walletItems, ...daoItems, ...adminItems, ...utilityItems, ...resourceItems].map((item) => (
                  <Link key={item.href} to={item.href} onClick={() => setMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start ${isActive(item.href) ? "text-mtaa-orange bg-mtaa-orange/10" : ""}`}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 lg:hidden">
        <div className="flex justify-around items-center py-2">
          {[quickAccessItems[0], dashboardItems[0], primaryNavItems[0], primaryNavItems[1]].filter(Boolean).map((item) => (
            <Link key={item?.href} to={item?.href || '/'}>
              <Button variant="ghost" size="sm" className={`flex flex-col items-center ${isActive(item?.href || '') ? "text-mtaa-orange" : ""}`}>
                <span className="text-lg">{item?.icon}</span>
                <span className="text-xs">{item?.label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}