
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

        {/* Groups Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                👥 My Groups
              </h3>
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <div className="mb-2">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {groupCount} Active
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Total value: {formatMoney(groupValue)}
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Saving together with friends.
            </p>
            <Link href="/daos">
              <Button variant="outline" className="w-full" size="lg">
                View Groups
              </Button>
            </Link>
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
