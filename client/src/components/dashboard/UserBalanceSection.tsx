import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, Lock, Zap, ArrowUpRight } from 'lucide-react';

interface BalanceItem {
  daoId: string;
  daoName: string;
  amount: number;
  percentage: number;
  color: string;
}

interface UserBalanceSectionProps {
  balances: Record<string, number>;
  daoNames: Record<string, string>;
  totalNetWorth?: number;
  stakingAmount?: number;
  poolAmount?: number;
  loading?: boolean;
}

const COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
];

export function UserBalanceSection({
  balances,
  daoNames,
  totalNetWorth = 0,
  stakingAmount = 0,
  poolAmount = 0,
  loading = false,
}: UserBalanceSectionProps) {
  // Prepare pie chart data
  const balanceData: BalanceItem[] = Object.entries(balances)
    .map((entry, idx) => ({
      daoId: entry[0],
      daoName: daoNames[entry[0]] || `DAO ${idx + 1}`,
      amount: entry[1],
      percentage: 0, // Will calculate below
      color: COLORS[idx % COLORS.length],
    }))
    .filter(item => item.amount > 0);

  const totalBalance = balanceData.reduce((sum, item) => sum + item.amount, 0);

  // Calculate percentages
  balanceData.forEach(item => {
    item.percentage = totalBalance > 0 ? (item.amount / totalBalance) * 100 : 0;
  });

  if (loading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle>Wallet Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Total Balance Cards */}
      <div className="lg:col-span-1 space-y-3">
        {/* Total Net Worth */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-slate-400">Total Net Worth</span>
            </div>
            <p className="text-3xl font-bold text-white">${totalNetWorth.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <div className="mt-3 text-xs text-slate-400 space-y-1">
              <p>DAO Holdings: ${totalBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p>Staking: ${stakingAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p>Pools: ${poolAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
          </CardContent>
        </Card>

        {/* Allocation Breakdown */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Allocation Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {balanceData.map(item => (
              <div key={item.daoId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-slate-300 truncate">{item.daoName}</span>
                </div>
                <span className="font-semibold text-white">{item.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Balance Growth */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Growth (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-400">+12.5%</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-400 mt-2">+$1,250 this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Pie Chart */}
      <Card className="lg:col-span-2 bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle>Balance Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {balanceData.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-slate-400">No balances to display</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={balanceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} ${percentage.toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {balanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Balance Info */}
      <Card className="lg:col-span-3 bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">Assets & Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Staking Info */}
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-slate-400">Staking</span>
              </div>
              <p className="text-xl font-bold text-white">${stakingAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-emerald-400 mt-1">APY: 12.5%</p>
              <div className="text-xs text-slate-400 mt-2">
                <p>Rewards earned: $150</p>
                <p>Next unlock: 15 days</p>
              </div>
            </div>

            {/* Pools Info */}
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-slate-400">Liquidity Pools</span>
              </div>
              <p className="text-xl font-bold text-white">${poolAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-emerald-400 mt-1">APY: 8.2%</p>
              <div className="text-xs text-slate-400 mt-2">
                <p>2 active pools</p>
                <p>Fees earned: $85</p>
              </div>
            </div>

            {/* Wallet Info */}
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-green-400" />
                <span className="text-sm text-slate-400">Wallet</span>
              </div>
              <p className="text-xl font-bold text-white">${totalBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-slate-400 mt-1">Across all DAOs</p>
              <div className="text-xs text-slate-400 mt-2">
                <p>{balanceData.length} DAOs</p>
                <p>Last updated: now</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UserBalanceSection;
