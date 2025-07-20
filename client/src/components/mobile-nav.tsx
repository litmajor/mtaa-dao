import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, FileText, Wallet, User, Users2, DollarSign, Gift } from "lucide-react";

export default function MobileNav() {
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  // Show login/register if not authenticated
  // (Assume useAuth is available globally as in navigation)
  let isLoggedIn = false;
  try {
    // Dynamically require useAuth to avoid circular import
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    isLoggedIn = require("@/hooks/useAuth").useAuth().user != null;
  } catch {}
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 lg:hidden z-50">
      <div className="grid grid-cols-5 gap-1">
        {isLoggedIn ? (
          <>
            <Link href="/">
              <Button
                variant="ghost"
                className={`flex flex-col items-center justify-center py-3 h-auto ${
                  isActive("/") ? "text-mtaa-orange" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <Home className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">Home</span>
              </Button>
            </Link>
            <Link href="/daos">
              <Button
                variant="ghost"
                className={`flex flex-col items-center justify-center py-3 h-auto ${
                  isActive("/daos") ? "text-mtaa-orange" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <Users2 className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">DAOs</span>
              </Button>
            </Link>
            <Link href="/wallet">
              <Button
                variant="ghost"
                className={`flex flex-col items-center justify-center py-3 h-auto ${
                  isActive("/wallet") ? "text-mtaa-orange" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <DollarSign className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">Wallet</span>
              </Button>
            </Link>
            <Link href="/referrals">
              <Button
                variant="ghost"
                className={`flex flex-col items-center justify-center py-3 h-auto ${
                  isActive("/referrals") ? "text-mtaa-orange" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <Gift className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">Referrals</span>
              </Button>
            </Link>
            <Link href="/profile">
              <Button
                variant="ghost"
                className={`flex flex-col items-center justify-center py-3 h-auto ${
                  isActive("/profile") ? "text-mtaa-orange" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <User className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">Profile</span>
              </Button>
            </Link>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button
                variant="ghost"
                className={`flex flex-col items-center justify-center py-3 h-auto ${
                  isActive("/login") ? "text-mtaa-orange" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <User className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">Login</span>
              </Button>
            </Link>
            <Link href="/register">
              <Button
                variant="ghost"
                className={`flex flex-col items-center justify-center py-3 h-auto ${
                  isActive("/register") ? "text-mtaa-orange" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <User className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">Register</span>
              </Button>
            </Link>
            {/* Fill remaining grid slots for layout */}
            <div />
            <div />
            <div />
          </>
        )}
      </div>
    </div>
  );
}
