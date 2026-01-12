/**
 * Historical Data Chart Component
 * Displays historical price data with multiple period comparison
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { useHistoricalData } from '@/hooks/useHistoricalData';
import { getChangeColor, getVolatilityColor, getPerformanceRating, formatNumber } from '@/hooks/useHistoricalData';

interface HistoricalChartProps {
  symbol: string;
  exchange?: string;
}

type Period = '1m' | '3m' | '6m' | '1y';

export const HistoricalChart: React.FC<HistoricalChartProps> = ({
  symbol,
  exchange = 'binance'
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('1y');
  const [chartType, setChartType] = useState<'candle' | 'area'>('candle');

  const { data: historicalData, isLoading, error } = useHistoricalData(
    symbol,
    exchange,
    selectedPeriod
  );

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-96 bg-gray-200 dark:bg-slate-700 rounded-lg"></div>
      </Card>
    );
  }

  if (error || !historicalData) {
    return (
      <Card className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <p className="text-sm text-yellow-900 dark:text-yellow-200">
          <span className="font-semibold">⚠️</span> Unable to load historical data for {symbol}
        </p>
      </Card>
    );
  }

  const { analysis } = historicalData;
  const { data, stats } = analysis;

  // Prepare chart data - sample every nth point to avoid clutter
  const sampleSize = Math.ceil(data.length / 200); // Max 200 points on chart
  const chartData = data.filter((_, i) => i % sampleSize === 0).map((d) => ({
    date: d.date,
    price: d.close,
    open: d.open,
    high: d.high,
    low: d.low,
    volume: d.volume,
    change: d.changePercent
  }));

  const changeColor = getChangeColor(stats.changePercent);
  const volatilityColor = getVolatilityColor(stats.volatility);
  const perfRating = getPerformanceRating(stats.changePercent);

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {(['1m', '3m', '6m', '1y'] as Period[]).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
              className="uppercase text-xs"
            >
              {period}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant={chartType === 'candle' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('candle')}
          >
            📊 Candle
          </Button>
          <Button
            variant={chartType === 'area' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('area')}
          >
            📈 Area
          </Button>
        </div>
      </div>

      {/* Chart */}
      <Card className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'candle' ? (
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0'
                  }}
                  formatter={(value: any) => {
                    if (typeof value === 'number') {
                      return value > 1000 ? `$${(value / 1e6).toFixed(2)}M` : `$${value.toFixed(2)}`;
                    }
                    return value;
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="right"
                  dataKey="volume"
                  fill="url(#volumeGradient)"
                  opacity={0.6}
                  name="Volume"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="price"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Close Price"
                />
              </ComposedChart>
            ) : (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={stats.changePercent > 0 ? '#22c55e' : '#ef4444'}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={stats.changePercent > 0 ? '#22c55e' : '#ef4444'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0'
                  }}
                  formatter={(value: any) => `$${value.toFixed(2)}`}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={stats.changePercent > 0 ? '#22c55e' : '#ef4444'}
                  fill="url(#areaGradient)"
                  strokeWidth={2}
                  name="Price"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Statistics Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-3">
          {/* Performance */}
          <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Performance</p>
                <p className={`text-2xl font-bold ${changeColor}`}>
                  {stats.changePercent > 0 ? '+' : ''}{stats.changePercent.toFixed(2)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">{perfRating}</p>
              </div>
              <div className="text-3xl">{stats.changePercent > 0 ? '📈' : '📉'}</div>
            </div>
          </Card>

          {/* Price Range */}
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-2">Price Range</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">High:</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  ${stats.highPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Low:</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  ${stats.lowPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{stats.highDate}</span>
                <span>{stats.lowDate}</span>
              </div>
            </div>
          </Card>

          {/* Win Rate */}
          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-2">Win Rate</p>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {stats.winRate.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500">
                    {stats.daysUp} Up • {stats.daysDown} Down
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${stats.winRate}%` } as React.CSSProperties}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          {/* Volatility */}
          <Card className={`p-4 border-2 ${volatilityColor}`}>
            <div className="space-y-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Volatility</p>
              <div className="flex justify-between items-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.volatility.toFixed(2)}%
                </p>
                <span className="text-2xl">
                  {stats.volatility > 10 ? '⚡' : stats.volatility > 5 ? '⚠️' : '✅'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {stats.volatility > 10
                  ? 'High volatility - expect larger swings'
                  : stats.volatility > 5
                  ? 'Moderate volatility - normal trading'
                  : 'Low volatility - stable movement'}
              </p>
            </div>
          </Card>

          {/* Risk Metrics */}
          <Card className="p-4 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-orange-200 dark:border-orange-800">
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-2">Risk Metrics</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Max Drawdown:</span>
                <span className={`text-sm font-bold ${getChangeColor(-Math.abs(stats.maxDrawdownPercent))}`}>
                  -{stats.maxDrawdownPercent.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sharpe Ratio:</span>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {stats.sharpeRatio.toFixed(2)}
                </span>
              </div>
            </div>
          </Card>

          {/* Volume */}
          <Card className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-indigo-200 dark:border-indigo-800">
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-2">Average Volume</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${formatNumber(stats.averageVolume)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{stats.dataPoints} trading days analyzed</p>
          </Card>
        </div>
      </div>

      {/* Period Summary */}
      <Card className="p-4 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Period</p>
            <p className="font-bold text-gray-900 dark:text-white">{stats.startDate}</p>
            <p className="text-xs text-gray-500">to {stats.endDate}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Open → Close</p>
            <p className="font-bold text-gray-900 dark:text-white">
              ${stats.openPrice.toFixed(2)} → ${stats.closePrice.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Candles</p>
            <p className="font-bold text-gray-900 dark:text-white">{stats.dataPoints}</p>
            <p className="text-xs text-gray-500">data points</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
            <Badge className={stats.changePercent > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {stats.changePercent > 0 ? '📈 Bullish' : '📉 Bearish'}
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
};
