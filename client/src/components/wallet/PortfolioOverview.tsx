import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, DollarSign, Wallet, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Asset {
  name: string;
  balance: number;
  value: number;
  percentage: number;
  color: string;
  icon?: string;
}

export function PortfolioOverview() {
  const [showValues, setShowValues] = useState(true);

  // Mock portfolio data - replace with real data from API
  const assets: Asset[] = [
    { name: 'CELO', balance: 25.5, value: 3825, percentage: 45, color: '#13C41E' },
    { name: 'cUSD', balance: 3200, value: 3200, percentage: 38, color: '#1890FF' },
    { name: 'Investment Pools', balance: 0, value: 1200, percentage: 14, color: '#722ED1' },
    { name: 'DAO Treasury', balance: 0, value: 295, percentage: 3, color: '#FA8C16' },
  ];

  const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
  
  const chartData = assets.map(asset => ({
    name: asset.name,
    value: asset.value,
    color: asset.color,
  }));

  const performanceData = [
    { month: 'Jan', value: 7200 },
    { month: 'Feb', value: 7500 },
    { month: 'Mar', value: 7800 },
    { month: 'Apr', value: 8200 },
    { month: 'May', value: 8500 },
    { month: 'Jun', value: 8520 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Portfolio Overview</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">All your assets in one place</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowValues(!showValues)}
          title={showValues ? 'Hide values' : 'Show values'}
        >
          {showValues ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </Button>
      </div>

      {/* Total Balance Card */}
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
        <CardContent className="p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Portfolio Value</p>
              <p className="text-4xl font-bold text-purple-600 dark:text-purple-300 mt-2">
                {showValues ? `$${totalValue.toLocaleString()}` : '••••••'}
              </p>
              <div className="flex items-center gap-2 mt-4">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-600 font-semibold">+3.2% this month</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-4">
              <Wallet className="w-8 h-8 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">6-Month Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Bar dataKey="value" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Assets List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assets.map((asset) => (
              <div key={asset.name} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: asset.color }}
                  />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{asset.name}</p>
                    {asset.balance > 0 && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {asset.balance.toLocaleString()} {asset.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {showValues ? `$${asset.value.toLocaleString()}` : '••••'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{asset.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
