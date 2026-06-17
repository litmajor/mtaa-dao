/**
 * Vault Analytics Tab - Connected to Real API
 * 
 * Displays vault-specific financial metrics and performance data
 * - TVL trends from /api/vault/performance
 * - APY performance from real-time WebSocket
 * - Withdrawal analysis from /api/vault/transactions
 * - Asset distribution
 * - Risk metrics
 */

import React, { useState, useMemo, useContext } from 'react';
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
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useVaultAnalytics } from '@/hooks/useVaultAnalytics';
import { RealtimeMetricsContext } from '@/components/analytics/RealtimeMetricsProvider';

// ============================================================================
// TYPES
// ============================================================================

interface VaultAnalyticsTabProps {
  daoId: string;
  vaultId: string;
  timeRange?: '7d' | '30d' | '90d' | '1y' | 'all';
  onTimeRangeChange?: (range: '7d' | '30d' | '90d' | '1y' | 'all') => void;
}

// ============================================================================
// COLORS AND UTILS
// ============================================================================

const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  secondary: '#8B5CF6',
  tertiary: '#14B8A6',
};

const TIER_COLORS = ['#3B82F6', '#8B5CF6', '#14B8A6', '#F59E0B', '#EF4444'];

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

// ============================================================================
// COMPONENT
// ============================================================================

export const VaultAnalyticsTab: React.FC<VaultAnalyticsTabProps> = ({
  daoId,
  vaultId,
  timeRange = '90d',
  onTimeRangeChange,
}) => {
  const context = useContext(RealtimeMetricsContext);
  const apiBaseUrl = context?.apiBaseUrl || process.env.VITE_API_URL || 'http://localhost:3001';

  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>(timeRange);

  const {
    data: vaultData,
    transactions,
    isLoading,
    isError,
    error,
    isConnected,
    refresh,
    lastUpdated,
  } = useVaultAnalytics({
    daoId,
    vaultId,
    timeframe: selectedTimeRange,
    apiBaseUrl,
  });

  const handleTimeRangeChange = (range: typeof selectedTimeRange) => {
    setSelectedTimeRange(range);
    onTimeRangeChange?.(range);
  };

  // Process TVL data for charts
  const tvlChartData = useMemo(() => {
    if (!vaultData?.tvlHistory) return [];
    return vaultData.tvlHistory.map((item) => ({
      date: item.date,
      tvl: item.tvl || 0,
    }));
  }, [vaultData?.tvlHistory]);

  // Process APY data for charts
  const apyChartData = useMemo(() => {
    if (!vaultData?.apyHistory) return [];
    return vaultData.apyHistory.map((item) => ({
      date: item.date,
      apy: (item.apy || 0) * 100,
      benchmark: (item.benchmark || 0) * 100,
    }));
  }, [vaultData?.apyHistory]);

  // Process withdrawal data
  const withdrawalChartData = useMemo(() => {
    if (!vaultData?.withdrawals) return [];
    return vaultData.withdrawals.map((item) => ({
      date: item.date,
      amount: item.amount || 0,
    }));
  }, [vaultData?.withdrawals]);

  // Process asset distribution
  const assetChartData = useMemo(() => {
    if (!vaultData?.assets) return [];
    return vaultData.assets.map((asset) => ({
      name: asset.name,
      value: asset.percentage || 0,
    }));
  }, [vaultData?.assets]);

  // Process risk metrics for radar chart
  const riskChartData = useMemo(() => {
    if (!vaultData?.riskMetrics) return [];
    return [
      {
        metric: 'Liquidity',
        value: (vaultData.riskMetrics.liquidityRatio || 0) * 100,
      },
      {
        metric: 'Concentration',
        value: 100 - (vaultData.riskMetrics.concentrationRisk || 0) * 100,
      },
      {
        metric: 'Volatility',
        value: 100 - (vaultData.riskMetrics.volatility || 0) * 100,
      },
      {
        metric: 'Overall Risk',
        value: 100 - (vaultData.riskMetrics.riskScore || 0),
      },
    ];
  }, [vaultData?.riskMetrics]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading vault analytics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load vault analytics: {error instanceof Error ? error.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!vaultData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>No vault data available</AlertDescription>
      </Alert>
    );
  }

  // Calculate TVL change
  const tvlChange = vaultData.tvlHistory && vaultData.tvlHistory.length > 1
    ? ((vaultData.tvlHistory[vaultData.tvlHistory.length - 1].tvl - vaultData.tvlHistory[0].tvl) / 
       vaultData.tvlHistory[0].tvl * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vault Analytics</h2>
          <p className="text-sm text-gray-600 mt-1">
            Real-time vault performance metrics
            <span className="ml-2">
              {isConnected ? (
                <Badge className="bg-green-100 text-green-800">
                  <Wifi className="w-3 h-3 mr-1 inline" />
                  Live
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800">
                  <WifiOff className="w-3 h-3 mr-1 inline" />
                  Polling
                </Badge>
              )}
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap">
            {(['7d', '30d', '90d', '1y', 'all'] as const).map((range) => (
              <Button
                key={range}
                variant={selectedTimeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimeRangeChange(range)}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : range === '1y' ? '1 Year' : 'All Time'}
              </Button>
            ))}
          </div>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-3">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TVL Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Value Locked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {formatCurrency(vaultData.currentTVL)}
            </div>
            <div className="flex items-center gap-1 mt-2">
              {tvlChange > 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className={tvlChange > 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(tvlChange).toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* APY Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Average APY</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatPercent(vaultData.currentAPY)}
            </div>
            <p className="text-xs text-gray-500 mt-2">Annual percentage yield</p>
          </CardContent>
        </Card>

        {/* Risk Score Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${
              vaultData.riskMetrics.riskScore < 30 ? 'text-green-600' :
              vaultData.riskMetrics.riskScore < 70 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {(vaultData.riskMetrics.riskScore || 0).toFixed(0)}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {vaultData.riskMetrics.riskScore < 30 ? 'Low Risk' :
               vaultData.riskMetrics.riskScore < 70 ? 'Medium Risk' :
               'High Risk'}
            </p>
          </CardContent>
        </Card>

        {/* Withdrawal Count Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Withdrawals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {vaultData.withdrawals?.length || 0}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {formatCurrency(vaultData.withdrawals?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TVL Trend */}
        <Card>
          <CardHeader>
            <CardTitle>TVL Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 300 }}>
              <Chart
                type="line"
                data={{ labels: tvlChartData.map(d => d.date), datasets: [{ label: 'TVL', data: tvlChartData.map(d => d.tvl), borderColor: COLORS.primary, backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.2 }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => formatCurrency(ctx.raw) } } }, scales: { x: { display: true }, y: { display: true } } }}
              />
            </div>
          </CardContent>
        </Card>

        {/* APY vs Benchmark */}
        <Card>
          <CardHeader>
            <CardTitle>APY Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 300 }}>
              <Chart
                type="line"
                data={{ labels: apyChartData.map(a => a.date), datasets: [{ label: 'Vault APY', data: apyChartData.map(a => a.apy), borderColor: COLORS.primary, backgroundColor: 'rgba(59,130,246,0.06)', tension: 0.2 }, { label: 'Benchmark', data: apyChartData.map(a => a.benchmark), borderColor: COLORS.secondary, backgroundColor: 'rgba(139,92,246,0.06)', tension: 0.2 }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => formatPercent(ctx.raw) } }, legend: { position: 'top' } } }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Asset Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 300 }}>
              <Chart
                type="pie"
                data={{ labels: assetChartData.map(a => a.name), datasets: [{ data: assetChartData.map(a => a.value), backgroundColor: assetChartData.map((_, i) => TIER_COLORS[i % TIER_COLORS.length]) }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `${ctx.label} ${ctx.raw.toFixed(1)}%` } } } }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Withdrawals */}
        <Card>
          <CardHeader>
            <CardTitle>Withdrawal Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 300 }}>
              <Chart
                type="bar"
                data={{ labels: withdrawalChartData.map(w => w.date), datasets: [{ label: 'Withdrawals', data: withdrawalChartData.map(w => w.amount), backgroundColor: COLORS.warning }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => formatCurrency(ctx.raw) } } } }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Risk Metrics Radar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Risk Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 300 }}>
              <Chart
                type="radar"
                data={{ labels: riskChartData.map(r => r.metric), datasets: [{ label: 'Risk Metrics', data: riskChartData.map(r => r.value), backgroundColor: 'rgba(59,130,246,0.3)', borderColor: COLORS.primary, fill: true }] }}
                options={{ responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { display: true }, suggestedMin: 0, suggestedMax: 100 } }, plugins: { tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%` } } } }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Details */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Metrics Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Liquidity Ratio</p>
              <p className="text-xl font-bold text-blue-600 mt-1">
                {formatPercent(vaultData.riskMetrics.liquidityRatio * 100)}
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-gray-600">Concentration Risk</p>
              <p className="text-xl font-bold text-yellow-600 mt-1">
                {formatPercent(vaultData.riskMetrics.concentrationRisk * 100)}
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Volatility</p>
              <p className="text-xl font-bold text-purple-600 mt-1">
                {formatPercent(vaultData.riskMetrics.volatility * 100)}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600">Overall Risk Score</p>
              <p className="text-xl font-bold text-red-600 mt-1">
                {formatPercent(vaultData.riskMetrics.riskScore)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VaultAnalyticsTab;
