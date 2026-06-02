import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Moon, Sun, Settings, LogOut, Home, Wallet, Building2, User } from "lucide-react";
import { useAuth } from "@/pages/hooks/useAuth";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/components/theme-provider";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DaoContextSelector } from "./DaoContextSelector";
import DaoSwitcher from "./DaoSwitcher";
import NotificationCenter from "./NotificationCenter";
import { AnimatedLogo } from "@/components/ui/logo";
import MorioHeaderButton from "./MorioHeaderButton";
import { useActiveSubprofile, useSubprofileDetails, usePersona } from "@/contexts/persona-context";

/**
 * NEW GlobalNav Component (Week 1, Task 1.1)
 * Simplified navigation: 4 items instead of 8
 * - Home (Dashboard)
 * - Finance (Wallet, Vaults, Trading, Escrow)
 * - DAO (Governance, Proposals)
 * - Account (Settings, Profile)
 * 
 * ENHANCEMENT: Added Profile Switcher buttons for instant profile switching
 */
export default function GlobalNav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const activeSubprofile = useActiveSubprofile();
  const subprofileDetails = useSubprofileDetails();
  const { switchSubprofile, isLoading: profileSwitching } = usePersona();

  // Profile definitions for switching
  const profileOptions = [
    { id: 'okedi', name: 'OKEDI', icon: '🎤', color: '#8B5CF6' },
    { id: 'yuki', name: 'YUKI', icon: '🛠️', color: '#06B6D4' },
    { id: 'amara', name: 'AMARA', icon: '💰', color: '#EC4899' },
  ];

  // Scroll effect for sticky header
  useEffect(() => {
    const handleClickOutside = () => setShowProfileDropdown(false);
    if (showProfileDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showProfileDropdown]);

  // Logout handler
  async function handleLogout() {
    try {
      await apiRequest("POST", "/api/auth/logout");
      localStorage.removeItem("mtaa_dao_auth_session");
      localStorage.removeItem("mtaa_remembered_email");
      try { (await import('../utils/authChannel')).default.postAuthMessage({ type: 'logout', payload: {} }); } catch (e) {}
      navigate("/login", { replace: true });
    } catch (e) {
      console.error("Logout failed:", e);
      navigate("/login", { replace: true });
    }
  }

  const isActive = (path: string) => {
    if (path === "finance") {
      return ["/wallet", "/vault", "/trading", "/escrow"].some(p => location.pathname.startsWith(p));
    }
    if (path === "dao") {
      return ["/daos", "/proposals", "/governance"].some(p => location.pathname.startsWith(p));
    }
    if (path === "account") {
      return ["/settings", "/profile"].some(p => location.pathname.startsWith(p));
    }
    return location.pathname === path;
  };

  // Determine Morio context based on current page
  const getMorioContext = (): 'account' | 'finance' | 'daos' | 'dashboard' | 'settings' => {
    if (location.pathname.startsWith('/wallet') || location.pathname.startsWith('/vault') || location.pathname.startsWith('/trading')) {
      return 'finance';
    }
    if (location.pathname.startsWith('/daos') || location.pathname.startsWith('/proposals')) {
      return 'daos';
    }
    if (location.pathname.startsWith('/settings')) {
      return 'settings';
    }
    if (location.pathname.startsWith('/profile')) {
      return 'account';
    }
    return 'dashboard';
  };

  // NEW: 4-item navigation structure
  const mainNavItems = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      href: "/dashboard",
      description: "Dashboard & overview",
    },
    {
      id: "finance",
      label: "Finance",
      icon: Wallet,
      href: "/wallet",
      description: "Wallets, vaults, trading",
      subItems: [
        { label: "Wallet", href: "/wallet" },
        { label: "Vaults", href: "/vaults" },
        { label: "My Vaults", href: "/my-vaults" },
        { label: "Staking", href: "/staking" },
        { label: "Trading Hub", href: "/trading" },
      ]
    },
    {
      id: "dao",
      label: "DAO",
      icon: Building2,
      href: "/daos",
      description: "Governance & proposals",
    },
    {
      id: "account",
      label: "Account",
      icon: User,
      href: "/settings",
      description: "Settings & profile",
    },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/dashboard" className="flex items-center gap-2">
              <AnimatedLogo className="h-8 w-8" />
              <span className="text-lg font-bold text-white hidden sm:inline">MTAA</span>
            </Link>
          </div>

          {/* Main Navigation (4 items - Desktop only, hidden on mobile) */}
          <div className="hidden md:flex md:gap-1">
            {mainNavItems.map((item) => {
              const IconComponent = item.icon;
              const active = isActive(item.href);

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Link to={item.href}>
                      <Button
                        variant={active ? "primary" : "ghost"}
                        size="sm"
                        className="gap-2"
                      >
                        <IconComponent className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {item.description}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Right side: Morio + Theme + Notifications + DAO Selector + Subprofile + Profile */}
          <div className="flex items-center gap-4">
            {/* Morio Header Button */}
            <MorioHeaderButton context={getMorioContext()} />
            
            {/* Theme toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="text-slate-300"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Toggle theme
              </TooltipContent>
            </Tooltip>

            {/* Notifications */}
            <NotificationCenter />

            {/* DAO Context Selector (NEW - Week 1) */}
            {user && <DaoContextSelector />}

            {/* Profile Switcher Buttons (ENHANCED - Visible quick access) */}
            <div className="hidden sm:flex gap-1 items-center px-2 py-1 bg-slate-800/50 rounded-lg border border-slate-700">
              {profileOptions.map((profile) => (
                <Tooltip key={profile.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeSubprofile === profile.id ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => switchSubprofile(profile.id as 'okedi' | 'yuki' | 'amara')}
                      disabled={profileSwitching}
                      className="gap-1 text-xs"
                      style={
                        activeSubprofile === profile.id
                          ? {
                              backgroundColor: `${profile.color}20`,
                              borderColor: profile.color,
                              color: profile.color,
                            }
                          : {}
                      }
                    >
                      <span className="text-sm">{profile.icon}</span>
                      <span className="hidden md:inline font-medium">{profile.name}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Switch to {profile.name}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Subprofile Indicator Badge */}
            {activeSubprofile && subprofileDetails && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/settings">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 hidden sm:flex text-xs"
                      style={{
                        backgroundColor: `${subprofileDetails.color}15`,
                        borderColor: subprofileDetails.color,
                        color: subprofileDetails.color,
                      }}
                    >
                      <span>{subprofileDetails.icon}</span>
                      <span className="font-medium">{subprofileDetails.name}</span>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Click to change subprofile
                </TooltipContent>
              </Tooltip>
            )}

            {/* Profile Dropdown */}
            {user && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowProfileDropdown(!showProfileDropdown);
                  }}
                  className="flex items-center gap-2 rounded-lg p-1"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={(user as any)?.profilePicture || (user as any)?.profileImageUrl || (user as any)?.avatar || undefined}
                      alt={(user as any)?.username || (user as any)?.firstName || (user as any)?.email || "User"}
                    />
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      {((user as any)?.username || (user as any)?.firstName || "U").toString().substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium text-slate-200 max-w-[100px] truncate">
                    {(user as any)?.username || `${(user as any)?.firstName || ''} ${(user as any)?.lastName || ''}`.trim() || (user as any)?.email || "User"}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 z-50">
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                      onClick={() => setShowProfileDropdown(false)}
                    >
                      My Profile
                    </Link>
                    <Link
                      to="/settings"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                      onClick={() => setShowProfileDropdown(false)}
                    >
                      <Settings className="inline mr-2 h-4 w-4" />
                      Settings
                    </Link>
                    <hr className="my-1 border-slate-700" />
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700"
                    >
                      <LogOut className="inline mr-2 h-4 w-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation - Simplified bottom nav */}
        <div className="md:hidden flex gap-1 pb-2 overflow-x-auto">
          {mainNavItems.map((item) => {
            const IconComponent = item.icon;
            const active = isActive(item.href);

            return (
              <Link key={item.id} to={item.href} className="flex-shrink-0">
                <Button
                  variant={active ? "primary" : "ghost"}
                  size="sm"
                >
                  <IconComponent className="h-4 w-4" />
                  <span className="text-xs ml-1">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
