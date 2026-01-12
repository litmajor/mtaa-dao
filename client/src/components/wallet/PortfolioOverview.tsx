import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { PriceBadge } from './PriceDisplay';

interface Asset {
  name: string;
  balance: number;
  value: number;
  percentage: number;
  color: string;
  icon?: string;
}

type TimePeriod = '1d' | '7d' | '30d' | '90d' | '6m' | '1y';

interface PerformancePoint {
  label: string;
  value: number;
  date: string;
}

export function PortfolioOverview() {
  const [showValues, setShowValues] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('6m');
  const [currencyPreferences, setCurrencyPreferences] = useState({
    primary: 'cUSD',
    secondary: 'KES'
  });

  // Fetch user currency preferences
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const response = await fetch('/api/user-preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      const data = await response.json();
      return data.data;
    },
    staleTime: Infinity,
    retry: 1
  });

  useEffect(() => {
    if (preferences) {
      setCurrencyPreferences({
        primary: preferences.primaryCurrency || 'cUSD',
        secondary: preferences.secondaryCurrency || 'KES'
      });
    }
  }, [preferences]);

  // Fetch exchange rates for conversions
  const { data: exchangeRates = {} } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      const response = await fetch('/api/wallet/exchange-rates');
      if (!response.ok) throw new Error('Failed to fetch rates');
      const data = await response.json();
      return data.rates || {};
    },
    staleTime: 30000, // 30 seconds
    retry: 1
  });

  // Convert amount between currencies
  const convertAmount = (amount: number, from: string, to: string): number => {
    if (from === to) return amount;
    if (!exchangeRates || Object.keys(exchangeRates).length === 0) return amount;

    const rateKey = `${from}-${to}`;
    if (exchangeRates[rateKey]) {
      return amount * exchangeRates[rateKey].rate;
    }

    const reverseKey = `${to}-${from}`;
    if (exchangeRates[reverseKey]) {
      return amount / exchangeRates[reverseKey].rate;
    }

    return amount;
  };

  // Mock portfolio data - replace with real data from API
  const assets: Asset[] = [
    { name: 'CELO', balance: 25.5, value: 3825, percentage: 45, color: '#13C41E' },
    { name: 'cUSD', balance: 3200, value: 3200, percentage: 38, color: '#1890FF' },
    { name: 'Investment Pools', balance: 0, value: 1200, percentage: 14, color: '#722ED1' },
    { name: 'DAO Treasury', balance: 0, value: 295, percentage: 3, color: '#FA8C16' },
  ];

  const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
  
  // Convert total value to both currencies
  const totalValuePrimary = convertAmount(totalValue, 'USD', currencyPreferences.primary);
  const totalValueSecondary = convertAmount(totalValue, 'USD', currencyPreferences.secondary);
  
  const chartData = assets.map(asset => ({
    name: asset.name,
    value: asset.value,
    color: asset.color,
  }));

  // Generate performance data based on selected time period
  const getPerformanceData = useMemo(() => {
    const generateRandomData = (points: number, startValue: number, volatility: number = 0.02) => {
      const data: PerformancePoint[] = [];
      let currentValue = startValue;
      
      for (let i = 0; i < points; i++) {
        const change = (Math.random() - 0.5) * volatility;
        currentValue = currentValue * (1 + change);
        data.push({
          value: Math.round(currentValue * 100) / 100,
          label: data.length.toString(),
          date: new Date().toISOString(),
        });
      }
      return data;
    };

    switch (timePeriod) {
      case '1d':
        return {
          data: generateRandomData(24, 8520, 0.01).map((d, i) => ({
            ...d,
            label: `${i}:00`,
          })),
          title: '24-Hour Performance',
          change: '+0.8%',
          xKey: 'label',
        };
      case '7d':
        return {
          data: generateRandomData(7, 8520, 0.015).map((d, i) => ({
            ...d,
            label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
          })),
          title: '7-Day Performance',
          change: '+2.1%',
          xKey: 'label',
        };
      case '30d':
        return {
          data: generateRandomData(30, 8520, 0.015).map((d, i) => ({
            ...d,
            label: `Day ${i + 1}`,
          })),
          title: '30-Day Performance',
          change: '+3.5%',
          xKey: 'label',
        };
      case '90d':
        return {
          data: generateRandomData(13, 8520, 0.02).map((d, i) => ({
            ...d,
            label: `W${i + 1}`,
          })),
          title: '90-Day Performance',
          change: '+5.2%',
          xKey: 'label',
        };
      case '6m':
        return {
          data: [
            { label: 'Jan', value: 7200 },
            { label: 'Feb', value: 7500 },
            { label: 'Mar', value: 7800 },
            { label: 'Apr', value: 8200 },
            { label: 'May', value: 8500 },
            { label: 'Jun', value: 8520 },
          ],
          title: '6-Month Performance',
          change: '+3.2%',
          xKey: 'label',
        };
      case '1y':
        return {
          data: [
            { label: 'Jan', value: 6800 },
            { label: 'Feb', value: 6900 },
            { label: 'Mar', value: 7100 },
            { label: 'Apr', value: 7300 },
            { label: 'May', value: 7500 },
            { label: 'Jun', value: 7800 },
            { label: 'Jul', value: 7950 },
            { label: 'Aug', value: 8100 },
            { label: 'Sep', value: 8200 },
            { label: 'Oct', value: 8400 },
            { label: 'Nov', value: 8500 },
            { label: 'Dec', value: 8520 },
          ],
          title: '1-Year Performance',
          change: '+25.3%',
          xKey: 'label',
        };
      default:
        return {
          data: [],
          title: 'Performance',
          change: '0%',
          xKey: 'label',
        };
    }
  }, [timePeriod]);

  const timePeriodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1d', label: '1D' },
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1Y' },
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
          data-testid="button-toggle-values"
        >
          {showValues ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </Button>
      </div>

      {/* Total Balance Card with Dual Currency */}
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
        <CardContent className="p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Portfolio Value</p>
              
              {/* Primary Currency Display */}
              <div className="mt-3">
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-300" data-testid="text-portfolio-value">
                  {showValues 
                    ? `${currencyPreferences.primary} ${totalValuePrimary.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                    : '••••••'
                  }
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Primary Display
                </p>
              </div>

              {/* Secondary Currency Display */}
              <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800">
                <p className="text-2xl font-semibold text-pink-600 dark:text-pink-300">
                  {showValues 
                    ? `${currencyPreferences.secondary} ${totalValueSecondary.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                    : '••••••'
                  }
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Real-time Conversion
                </p>
              </div>

              {/* Performance Indicator */}
              <div className="flex items-center gap-2 mt-4">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-600 font-semibold" data-testid="text-performance-change">{getPerformanceData.change} this period</p>
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
            <CardTitle className="text-lg" data-testid="title-asset-allocation">Asset Allocation</CardTitle>
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
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-lg" data-testid="title-performance-chart">{getPerformanceData.title}</CardTitle>
            </div>
            {/* Time Period Selector */}
            <div className="flex gap-2 flex-wrap" data-testid="group-time-period-buttons">
              {timePeriodOptions.map((option) => (
                <Button
                  key={option.value}
                  onClick={() => setTimePeriod(option.value)}
                  variant={timePeriod === option.value ? 'default' : 'outline'}
                  size="sm"
                  className={timePeriod === option.value ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
                  data-testid={`button-period-${option.value}`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              {timePeriod === '1d' || timePeriod === '7d' ? (
                <LineChart data={getPerformanceData.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey={getPerformanceData.xKey} 
                    stroke="#888888"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#888888"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    formatter={(value) => `$${typeof value === 'number' ? value.toLocaleString() : value}`}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={true}
                  />
                </LineChart>
              ) : (
                <BarChart data={getPerformanceData.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey={getPerformanceData.xKey}
                    stroke="#888888"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#888888"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip formatter={(value) => `$${typeof value === 'number' ? value.toLocaleString() : value}`} />
                  <Bar 
                    dataKey="value" 
                    fill="#8B5CF6" 
                    radius={[8, 8, 0, 0]}
                    isAnimationActive={true}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Assets List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg" data-testid="title-your-assets">Your Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assets.map((asset) => {
              // Get unit price for this asset
              const assetPricePair = `${asset.name}-USD`;
              const assetPriceData = exchangeRates[assetPricePair];
              const unitPrice = assetPriceData?.rate || 0;
              const changePercent = assetPriceData 
                ? ((assetPriceData.change24h || 0) / unitPrice) * 100 
                : 0;

              return (
                <div 
                  key={asset.name} 
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  data-testid={`card-asset-${asset.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: asset.color }}
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white" data-testid={`text-asset-name-${asset.name.toLowerCase()}`}>
                        {asset.name}
                      </p>
                      {asset.balance > 0 && (
                        <p className="text-xs text-gray-600 dark:text-gray-400" data-testid={`text-asset-balance-${asset.name.toLowerCase()}`}>
                          {asset.balance.toLocaleString()} {asset.name}
                        </p>
                      )}
                      {/* Unit Price with Change Indicator */}
                      {unitPrice > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Price: ${unitPrice.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 8
                            })}
                          </span>
                          <PriceBadge
                            price={unitPrice}
                            currency="USD"
                            changePercent={changePercent}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p 
                      className="font-bold text-gray-900 dark:text-white"
                      data-testid={`text-asset-value-${asset.name.toLowerCase()}`}
                    >
                      {showValues ? `$${asset.value.toLocaleString()}` : '••••'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400" data-testid={`text-asset-percentage-${asset.name.toLowerCase()}`}>
                      {asset.percentage}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
