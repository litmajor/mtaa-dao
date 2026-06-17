/**
 * Admin - Revenue Tracking
 * Track platform revenue, fees, and financial metrics
 */

import React, { useState, useEffect } from 'react';
import ChartJS from '@/components/charts/ChartJSSetup';
import { Chart } from 'react-chartjs-2';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';

interface RevenueMetric {
  date: string;
  tradingFees: number;
  liquidityFees: number;
  premiumFees: number;
  affiliateFees: number;
  total: number;
}

interface RevenueBreakdown {
  source: string;
  amount: number;
  percentage: number;
  trend: number;
}

interface PaymentProvider {
  provider: string;
  status: 'active' | 'inactive' | 'error';
  processed: number;
  pending: number;
  failed: number;
  totalVolume: number;
  feePercent: number;
  lastPayment: string;
}

const REVENUE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function AdminRevenueTracking() {
  const [revenueHistory, setRevenueHistory] = useState<RevenueMetric[]>([]);
  const [breakdown, setBreakdown] = useState<RevenueBreakdown[]>([]);
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30d');

  const fetchRevenueData = async () => {
    try {
      setLoading(true);

      const [historyData, breakdownData, providersData] = await Promise.all([
        authClient.get(`/api/admin/revenue/history?range=${dateRange}`),
        authClient.get('/api/admin/revenue/breakdown'),
        authClient.get('/api/admin/payments/providers'),
      ]);

      setRevenueHistory(historyData.history || []);
      setBreakdown(breakdownData.breakdown || []);
      setProviders(providersData.providers || []);
    } catch (error) {
      console.error('Failed to fetch revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenueData();
    const interval = setInterval(fetchRevenueData, 60000);
    return () => clearInterval(interval);
  }, [dateRange]);

  const totalRevenue = revenueHistory.reduce((sum, m) => sum + m.total, 0);
  const avgDaily = (totalRevenue / (revenueHistory.length || 1)).toFixed(2);
  const latestRevenue = revenueHistory[revenueHistory.length - 1]?.total || 0;
  const previousRevenue = revenueHistory[Math.max(0, revenueHistory.length - 2)]?.total || 0;
  const revenueChange = ((latestRevenue - previousRevenue) / (previousRevenue || 1) * 100).toFixed(2);

  const exportData = () => {
    const csv = [
      ['Date', 'Trading Fees', 'Liquidity Fees', 'Premium Fees', 'Affiliate Fees', 'Total'],
      ...revenueHistory.map(r => [r.date, r.tradingFees, r.liquidityFees, r.premiumFees, r.affiliateFees, r.total])
    ];
    const blob = new Blob([csv.map(row => row.join(',')).join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-${dateRange}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Revenue Tracking</h1>
            <p className="text-slate-400">Monitor platform revenue, fees, and payment providers</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={exportData}
              variant="outline"
              className="border-slate-600 hover:bg-slate-800"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              onClick={fetchRevenueData}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Total Revenue ({dateRange})</p>
            <p className="text-3xl font-bold text-white">${(totalRevenue / 1000).toFixed(2)}K</p>
            <p className="text-slate-400 text-sm mt-2">{revenueHistory.length} days tracked</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Daily Average</p>
            <p className="text-3xl font-bold text-white">${avgDaily}</p>
            <p className="text-slate-400 text-sm mt-2">Per day</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Latest Day</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-white">${latestRevenue.toFixed(0)}</p>
              <div className={`flex items-center ${revenueChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {revenueChange > 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                <span className="text-sm font-medium">{Math.abs(parseFloat(revenueChange))}%</span>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Payment Providers</p>
            <p className="text-3xl font-bold text-green-500">
              {providers.filter(p => p.status === 'active').length}/{providers.length}
            </p>
            <p className="text-slate-400 text-sm mt-2">Active providers</p>
          </Card>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-2 mb-6">
          {['7d', '30d', '90d', 'ytd', 'all'].map(range => (
            <Button
              key={range}
              onClick={() => setDateRange(range)}
              variant={dateRange === range ? 'default' : 'outline'}
              className={dateRange === range ? 'bg-blue-600 hover:bg-blue-700' : 'border-slate-600 hover:bg-slate-800'}
            >
              {range.toUpperCase()}
            </Button>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
            <TabsTrigger value="sources">Revenue Sources</TabsTrigger>
            <TabsTrigger value="providers">Payment Providers</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Revenue Trend</h3>
                <div style={{ height: 400 }}>
                  <Chart type="line" data={{ labels: revenueHistory.map(r => r.date), datasets: [{ label: 'Total Revenue', data: revenueHistory.map(r => r.total), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)', fill: true, tension: 0.2 }] }} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
            </Card>

            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Revenue by Type</h3>
              <div style={{ height: 400 }}>
                <Chart type="bar" data={{ labels: revenueHistory.map(r => r.date), datasets: [
                  { label: 'Trading Fees', data: revenueHistory.map(r => r.tradingFees), backgroundColor: '#3b82f6' },
                  { label: 'Liquidity Fees', data: revenueHistory.map(r => r.liquidityFees), backgroundColor: '#10b981' },
                  { label: 'Premium Fees', data: revenueHistory.map(r => r.premiumFees), backgroundColor: '#f59e0b' },
                  { label: 'Affiliate Fees', data: revenueHistory.map(r => r.affiliateFees), backgroundColor: '#ef4444' }
                ] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }} />
              </div>
            </Card>
          </TabsContent>

          {/* Breakdown Tab */}
          <TabsContent value="breakdown" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Revenue Sources Performance</h3>
              <div className="space-y-3">
                {breakdown.map((item) => (
                  <div key={item.source} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium">{item.source}</span>
                      <span className="text-white font-bold">${(item.amount / 1000).toFixed(2)}K</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-slate-400 text-sm">
                      <span>{item.percentage.toFixed(1)}%</span>
                      <div className={`flex items-center ${item.trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {item.trend > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        <span>{Math.abs(item.trend)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Revenue Distribution</h3>
              <div style={{ height: 400 }}>
                <Chart type="pie" data={{ labels: breakdown.map(b => b.source), datasets: [{ data: breakdown.map(b => b.amount), backgroundColor: breakdown.map((_, i) => REVENUE_COLORS[i % REVENUE_COLORS.length]) }] }} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </Card>
          </TabsContent>

          {/* Payment Providers Tab */}
          <TabsContent value="providers" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Payment Provider Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map((provider) => (
                  <Card key={provider.provider} className="bg-slate-700 border-slate-600 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-white font-semibold">{provider.provider}</span>
                      <Badge className={
                        provider.status === 'active' ? 'bg-green-600' :
                        provider.status === 'inactive' ? 'bg-yellow-600' : 'bg-red-600'
                      }>
                        {provider.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm text-slate-400">
                      <p>Total Volume: <span className="text-white font-medium">${(provider.totalVolume / 1000000).toFixed(2)}M</span></p>
                      <p>Processed: <span className="text-green-400 font-medium">{provider.processed}</span></p>
                      <p>Pending: <span className="text-yellow-400 font-medium">{provider.pending}</span></p>
                      <p>Failed: <span className="text-red-400 font-medium">{provider.failed}</span></p>
                      <p>Fee %: <span className="text-white font-medium">{provider.feePercent}%</span></p>
                      <p className="text-xs mt-2">Last: {provider.lastPayment}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
