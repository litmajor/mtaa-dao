/**
 * Vault Analytics Tab
 * 
 * Displays vault-specific financial metrics and performance data
 * - TVL trends
 * - APY performance
 * - Withdrawal analysis
 * - Asset distribution
 * - Risk metrics
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ChartJS from '@/components/charts/ChartJSSetup';
import { Chart } from 'react-chartjs-2';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Download,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import useRealtimeMetrics from '@/hooks/useRealtimeMetrics';
import { Logger } from '@/utils/logger';

const logger = new Logger('VaultAnalyticsTab');

// ============================================================================
// TYPES
// ============================================================================

interface VaultAnalyticsTabProps {
  daoId: string;
  vaultId: string;
  timeRange?: '7d' | '30d' | '90d' | '1y' | 'all';
  onTimeRangeChange?: (range: '7d' | '30d' | '90d' | '1y' | 'all') => void;
}

interface VaultAnalyticsData {
  vaultId: string;
  currentTVL: number;
  tvlHistory: Array<{ date: string; value: number }>;
  currentAPY: number;
  apyHistory: Array<{ date: string; apy: number; benchmark: number }>;
  
  assets: Array<{
    symbol: string;
    amount: number;
    value: number;
    percentage: number;
  }>;
  
  withdrawals: Array<{ date: string; amount: number }>;
  totalWithdrawn: number;
  withdrawalCount: number;
  
  performance: {
    dayChange: number;
    weekChange: number;
    monthChange: number;
    yearChange: number;
  };
  
  risk: {
    liquidityRatio: number;
    concentrationRisk: number;
    volatility: number;
    riskScore: number;  // 0-100
  };
}

// ============================================================================
// MOCK DATA
// ============================================================================

const generateMockVaultData = (): VaultAnalyticsData => {
  const now = new Date();
  const tvlHistory = Array.from({ length: 90 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (90 - i));
    const baseValue = 150000;
    const variance = Math.sin(i / 10) * 20000;
    const noise = Math.random() * 5000;
    return {
      date: date.toISOString().split('T')[0],
      value: baseValue + variance + noise,
    };
  });

  const apyHistory = Array.from({ length: 90 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (90 - i));
    return {
      date: date.toISOString().split('T')[0],
      apy: 7 + Math.sin(i / 15) * 2 + Math.random() * 0.5,
      benchmark: 6.5,
    };
  });

  const withdrawals = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (30 - i));
    return {
      date: date.toISOString().split('T')[0],
      amount: Math.random() * 10000 + 1000,
    };
  });

  return {
    vaultId: 'vault-001',
    currentTVL: tvlHistory[tvlHistory.length - 1].value,
    tvlHistory,
    currentAPY: 8.5,
    apyHistory,
    assets: [
      { symbol: 'cUSD', amount: 85000, value: 85000, percentage: 56.7 },
      { symbol: 'CELO', amount: 50000, value: 47500, percentage: 31.7 },
      { symbol: 'ETH', amount: 10, value: 17500, percentage: 11.7 },
    ],
    withdrawals,
    totalWithdrawn: withdrawals.reduce((sum, w) => sum + w.amount, 0),
    withdrawalCount: withdrawals.length,
    performance: {
      dayChange: 2.5,
      weekChange: 5.2,
      monthChange: 12.8,
      yearChange: 45.3,
    },
    risk: {
      liquidityRatio: 0.85,
      concentrationRisk: 0.42,
      volatility: 0.18,
      riskScore: 35,
    },
  };
};

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon?: React.ReactNode;
  color?: string;
  subtext?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  change,
  trend = 'stable',
  icon,
  color = 'blue',
  subtext,
}) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    orange: 'text-orange-600 bg-orange-50',
    red: 'text-red-600 bg-red-50',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600">{title}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{value}</span>
              {unit && <span className="text-sm text-gray-500">{unit}</span>}
            </div>
            {subtext && <p className="mt-1 text-xs text-gray-500">{subtext}</p>}
            {change !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-600" />}
                {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-600" />}
                <span
                  className={`text-sm font-medium ${
                    trend === 'up'
                      ? 'text-green-600'
                      : trend === 'down'
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {change > 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const VaultAnalyticsTab: React.FC<VaultAnalyticsTabProps> = ({
  daoId,
  vaultId,
  timeRange = '90d',
  onTimeRangeChange,
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const channel = `vault:${vaultId}:metrics`;

  // Use real-time metrics or fallback to mock data
  const { data, isLoading, error, isConnected, refresh } = useRealtimeMetrics<VaultAnalyticsData>(
    channel,
    {
      refreshInterval: 30000,
      staleTime: 10000,
    }
  );

  // Fallback to mock data for demonstration
  const analyticsData = data || generateMockVaultData();

  const handleTimeRangeChange = (range: '7d' | '30d' | '90d' | '1y' | 'all') => {
    setSelectedTimeRange(range);
    onTimeRangeChange?.(range);
  };

  // Calculate additional metrics
  const stats = useMemo(() => {
    const { currentTVL, tvlHistory, apyHistory, assets, performance } = analyticsData;

    const tvlChange = tvlHistory.length >= 2
      ? ((tvlHistory[tvlHistory.length - 1].value - tvlHistory[0].value) / tvlHistory[0].value) * 100
      : 0;

    const avgAPY = apyHistory.length > 0
      ? apyHistory.reduce((sum, item) => sum + item.apy, 0) / apyHistory.length
      : 0;

    const topAsset = assets.reduce((prev, current) =>
      current.value > prev.value ? current : prev
    );

    return {
      tvlChange,
      avgAPY,
      topAsset,
      performance,
    };
  }, [analyticsData]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load vault analytics: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vault Performance</h3>
          <p className="text-sm text-gray-600">
            {isConnected ? 'Real-time updates enabled' : 'Using cached data'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex gap-1">
            {(['7d', '30d', '90d', '1y', 'all'] as const).map((range) => (
              <Button
                key={range}
                variant={selectedTimeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimeRangeChange(range)}
              >
                {range === '7d' ? '7D' : ''}
                {range === '30d' ? '30D' : ''}
                {range === '90d' ? '90D' : ''}
                {range === '1y' ? '1Y' : ''}
                {range === 'all' ? 'All' : ''}
              </Button>
            ))}
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Export Button */}
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Value Locked"
          value={`$${(analyticsData.currentTVL / 1000).toFixed(1)}k`}
          change={stats.tvlChange}
          trend={stats.tvlChange > 0 ? 'up' : 'down'}
          icon={<DollarSign className="w-6 h-6" />}
          color="blue"
        />
        <MetricCard
          title="Average APY"
          value={`${stats.avgAPY.toFixed(2)}%`}
          change={stats.performance.monthChange}
          trend="up"
          icon={<Activity className="w-6 h-6" />}
          color="green"
        />
        <MetricCard
          title="Total Withdrawals"
          value={`$${(analyticsData.totalWithdrawn / 1000).toFixed(1)}k`}
          subtext={`${analyticsData.withdrawalCount} withdrawals`}
          icon={<TrendingDown className="w-6 h-6" />}
          color="orange"
        />
        <MetricCard
          title="Risk Score"
          value={analyticsData.risk.riskScore}
          unit="/100"
          subtext={analyticsData.risk.riskScore < 40 ? 'Low Risk' : 'Moderate Risk'}
          icon={<AlertTriangle className="w-6 h-6" />}
          color={analyticsData.risk.riskScore < 40 ? 'green' : 'orange'}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TVL Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total Value Locked Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 300 }}>
              <Chart
                type="line"
                data={{ labels: analyticsData.tvlHistory.map(d => d.date), datasets: [{ label: 'TVL', data: analyticsData.tvlHistory.map(d => d.value), borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', fill: false, tension: 0.2, pointRadius: 0 }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `$${(ctx.raw as number / 1000).toFixed(1)}k` } } } }}
              />
            </div>
          </CardContent>
        </Card>

        {/* APY Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">APY Performance vs Benchmark</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 300 }}>
              <Chart
                type="line"
                data={{ labels: analyticsData.apyHistory.map(d => d.date), datasets: [
                  { label: 'Current APY', data: analyticsData.apyHistory.map(d => d.apy), borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)', fill: true, tension: 0.2 },
                  { label: 'Benchmark', data: analyticsData.apyHistory.map(d => d.benchmark), borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.08)', fill: true, tension: 0.2 }
                ] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: (ctx: any) => `${(ctx.raw as number).toFixed(2)}%` } } } }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Asset Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div style={{ height: 300 }}>
              <Chart type="pie" data={{ labels: analyticsData.assets.map(a => a.symbol), datasets: [{ data: analyticsData.assets.map(a => a.value), backgroundColor: analyticsData.assets.map((_, i) => ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][i % 4]) }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `$${((ctx.raw as number)/1000).toFixed(1)}k` } } } }} />
            </div>
            {/* Asset List */}
            <div className="mt-4 w-full space-y-2">
              {analyticsData.assets.map((asset) => (
                <div key={asset.symbol} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{asset.symbol}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${asset.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-12 text-right">
                      {asset.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Withdrawal Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Withdrawal Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 300 }}>
              <Chart type="bar" data={{ labels: analyticsData.withdrawals.map(w => w.date), datasets: [{ label: 'Withdrawals', data: analyticsData.withdrawals.map(w => w.amount), backgroundColor: '#EF4444' }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `$${((ctx.raw as number)/1000).toFixed(1)}k` } } } }} />
            </div>
          </CardContent>
        </Card>

        {/* Risk Metrics Radar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 300 }}>
              <Chart type="radar" data={{ labels: ['Liquidity', 'Concentration', 'Volatility', 'Risk Score'], datasets: [{ label: 'Risk', data: [analyticsData.risk.liquidityRatio * 100, analyticsData.risk.concentrationRisk * 100, analyticsData.risk.volatility * 100, analyticsData.risk.riskScore], backgroundColor: 'rgba(245,158,11,0.15)', borderColor: '#F59E0B', fill: true }] }} options={{ responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100 } } }} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VaultAnalyticsTab;
