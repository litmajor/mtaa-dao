
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Plus, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "wouter";

interface SimplifiedDashboardProps {
  userSavings?: number;
  savingsGrowth?: number;
  investments?: number;
  investmentGrowth?: number;
  groupCount?: number;
  groupValue?: number;
  pendingDecisions?: number;
  currency?: "KES" | "USD";
}

export default function SimplifiedDashboard({
  userSavings = 124700,
  savingsGrowth = 2.3,
  investments = 85000,
  investmentGrowth = 8.1,
  groupCount = 3,
  groupValue = 34000,
  pendingDecisions = 1,
  currency = "KES"
}: SimplifiedDashboardProps) {
  
  const formatMoney = (amount: number) => {
    if (currency === "KES") {
      return `KES ${amount.toLocaleString()}`;
    }
    return `$${amount.toLocaleString()}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Your Money
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Here's how your money is growing
        </p>
      </div>

      {/* Main Money Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Savings Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                💰 My Savings
              </h3>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="mb-2">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatMoney(userSavings)}
              </div>
              <div className="text-sm text-green-600 font-medium mt-1">
                +{savingsGrowth}% this month 🎉
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Growing automatically. Earning 8-12% yearly.
            </p>
            <Link href="/vault">
              <Button className="w-full" size="lg">
                Add Money
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Investments Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                📈 My Investments
              </h3>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <div className="mb-2">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatMoney(investments)}
              </div>
              <div className="text-sm text-blue-600 font-medium mt-1">
                +{investmentGrowth}% this month 📊
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Higher returns, monitored daily.
            </p>
            <Link href="/investment-pools">
              <Button variant="outline" className="w-full" size="lg">
                See Details
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Groups Card - Enhanced */}
        <Card className="hover:shadow-xl transition-all duration-300 overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 group-hover:from-purple-500/20 group-hover:via-pink-500/20 group-hover:to-orange-500/20 transition-all duration-300" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  👥 My Groups
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Save together, grow together</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-3 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">{groupCount}</div>
                <div className="text-xs text-purple-700 dark:text-purple-400 font-medium">Active Groups</div>
              </div>
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/30 dark:to-pink-800/30 rounded-lg p-4 border border-pink-200 dark:border-pink-700">
                <div className="text-2xl font-bold text-pink-900 dark:text-pink-300">
                  {groupValue > 0 ? `${(groupValue / 1000).toFixed(0)}K` : '0'}
                </div>
                <div className="text-xs text-pink-700 dark:text-pink-400 font-medium">Total Value</div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <Link href="/daos" className="flex-1">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300 group/btn" size="lg">
                  View Groups
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/create-dao" className="flex-1">
                <Button variant="outline" className="w-full hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors" size="lg">
                  <Plus className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Decisions Alert */}
      {pendingDecisions > 0 && (
        <Card className="bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20 border-orange-200 dark:border-orange-800 mb-8">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  🗳️ {pendingDecisions} Decision{pendingDecisions > 1 ? 's' : ''} Waiting
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Your groups need you to vote on important decisions
                </p>
                <Link href="/proposals">
                  <Button className="bg-gradient-to-r from-orange-500 to-pink-600" size="lg">
                    Vote Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/create-dao">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-3">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">Start a New Group</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Invite friends to save together</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/referrals">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full p-3">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">Invite Friends</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Earn rewards for referrals</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Trust Signal */}
      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span>Your money is protected by smart contracts</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span>2,000+ people trust Mtaa with their savings</span>
        </div>
      </div>
    </div>
  );
}
