/**
 * Admin - Tokenomics Management
 * Track token distribution, emissions, holdings, governance, and economic metrics
 */

import React, { useState, useEffect } from 'react';
import ChartJS from '@/components/charts/ChartJSSetup';
import { Chart } from 'react-chartjs-2';
import { Coins, TrendingUp, Users, Lock, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';

interface TokenMetric {
  timestamp: string;
  totalSupply: number;
  circulatingSupply: number;
  price: number;
  marketCap: number;
  emissions: number;
}

interface TokenDistribution {
  category: string;
  percentage: number;
  amount: number;
  vested: boolean;
  vestedPercent?: number;
}

interface HolderSegment {
  segment: string;
  holders: number;
  tokenAmount: number;
  percentage: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdminTokenomics() {
  const [metrics, setMetrics] = useState<TokenMetric[]>([]);
  const [distribution, setDistribution] = useState<TokenDistribution[]>([]);
  const [holders, setHolders] = useState<HolderSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchTokenomicsData = async () => {
    try {
      setLoading(true);

      const [metricsData, distData, holdersData] = await Promise.all([
        authClient.get('/api/admin/tokenomics/metrics'),
        authClient.get('/api/admin/tokenomics/distribution'),
        authClient.get('/api/admin/tokenomics/holders'),
      ]);

      setMetrics(metricsData.metrics || []);
      setDistribution(distData.distribution || []);
      setHolders(holdersData.holders || []);
    } catch (error) {
      console.error('Failed to fetch tokenomics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokenomicsData();
    const interval = setInterval(fetchTokenomicsData, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const latestMetric = metrics[metrics.length - 1] || {};
  const previousMetric = metrics[Math.max(0, metrics.length - 2)] || {};

  const priceChange = ((latestMetric.price || 0) - (previousMetric.price || 0)) / (previousMetric.price || 1) * 100;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Tokenomics Management</h1>
            <p className="text-slate-400">Monitor token distribution, emissions, and economic metrics</p>
          </div>
          <Button
            onClick={fetchTokenomicsData}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Token Price</p>
            <p className="text-3xl font-bold text-white">${latestMetric.price?.toFixed(4) || '0'}</p>
            <div className={`text-sm mt-2 ${priceChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {priceChange > 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
            </div>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Market Cap</p>
            <p className="text-3xl font-bold text-white">${(latestMetric.marketCap / 1000000).toFixed(2)}M</p>
            <p className="text-slate-400 text-sm mt-2">Current valuation</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Total Supply</p>
            <p className="text-3xl font-bold text-blue-500">{(latestMetric.totalSupply / 1000000).toFixed(1)}M</p>
            <p className="text-slate-400 text-sm mt-2">Tokens created</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Circulating Supply</p>
            <p className="text-3xl font-bold text-green-500">
              {((latestMetric.circulatingSupply / latestMetric.totalSupply) * 100 || 0).toFixed(1)}%
            </p>
            <p className="text-slate-400 text-sm mt-2">Of total supply</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="holders">Holders</TabsTrigger>
            <TabsTrigger value="emissions">Emissions</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Token Price & Market Cap</h3>
                <div style={{ height: 300 }}>
                  <Chart
                    type="line"
                    data={{ labels: metrics.map(m => m.timestamp), datasets: [
                      { label: 'Price ($)', data: metrics.map(m => m.price), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.06)', tension: 0.2 },
                      { label: 'Market Cap', data: metrics.map(m => m.marketCap), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)', tension: 0.2 }
                    ] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }}
                  />
                </div>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Supply Trend</h3>
                <div style={{ height: 300 }}>
                  <Chart
                    type="line"
                    data={{ labels: metrics.map(m => m.timestamp), datasets: [{ label: 'Total Supply', data: metrics.map(m => m.totalSupply), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.12)', fill: true, tension: 0.2 }] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                  />
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Distribution Tab */}
          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Token Distribution</h3>
                <div style={{ height: 300 }}>
                  <Chart
                    type="pie"
                    data={{ labels: distribution.map(d => d.category), datasets: [{ data: distribution.map(d => d.percentage), backgroundColor: distribution.map((_, i) => COLORS[i % COLORS.length]) }] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${ctx.raw.toFixed(1)}%` } } } }}
                  />
                </div>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Distribution Details</h3>
                <div className="space-y-3">
                  {distribution.map((dist) => (
                    <div key={dist.category} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">{dist.category}</span>
                        <div className="flex gap-4">
                          <span className="text-white">{dist.percentage.toFixed(1)}%</span>
                          {dist.vested && <Badge className="bg-green-600">Vested</Badge>}
                        </div>
                      </div>
                      {dist.vested && dist.vestedPercent && (
                        <div className="text-xs text-slate-400">
                          Vesting: {dist.vestedPercent.toFixed(1)}%
                          <div className="w-full bg-slate-700 rounded-full h-1 mt-1">
                            <div
                              className="bg-green-500 h-1 rounded-full"
                              style={{ width: `${dist.vestedPercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Holders Tab */}
          <TabsContent value="holders" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Holder Distribution</h3>
              <div style={{ height: 350 }}>
                <Chart
                  type="bar"
                  data={{ labels: holders.map(h => h.segment), datasets: [{ label: 'Holders', data: holders.map(h => h.holders), backgroundColor: '#3b82f6' }, { label: 'Token Amount', data: holders.map(h => h.tokenAmount), backgroundColor: '#10b981' }] }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }}
                />
              </div>
            </Card>

            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Holder Segments</h3>
              <div className="space-y-3">
                {holders.map((segment) => (
                  <div key={segment.segment} className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-white font-semibold">{segment.segment}</span>
                      <span className="text-blue-400 font-bold">{segment.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-600 rounded-full h-2 mb-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                        style={{ width: `${segment.percentage}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
                      <p>Holders: {segment.holders.toLocaleString()}</p>
                      <p>Amount: {(segment.tokenAmount / 1000000).toFixed(1)}M</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Emissions Tab */}
          <TabsContent value="emissions" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Token Emissions</h3>
              <div style={{ height: 350 }}>
                <Chart
                  type="bar"
                  data={{ labels: metrics.map(m => m.timestamp), datasets: [{ label: 'Emissions', data: metrics.map(m => m.emissions), backgroundColor: '#f59e0b' }] }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              </div>
            </Card>

            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Emissions Schedule</h3>
              <div className="space-y-3">
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-400 mb-2">Daily Emission Rate</p>
                  <p className="text-2xl font-bold text-white">{(latestMetric.emissions || 0).toLocaleString()}</p>
                  <p className="text-sm text-slate-400 mt-2">tokens/day</p>
                </div>

                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-400 mb-2">Annual Inflation Rate</p>
                  <p className="text-2xl font-bold text-green-500">
                    {((latestMetric.emissions * 365 / latestMetric.totalSupply) * 100 || 0).toFixed(2)}%
                  </p>
                  <p className="text-sm text-slate-400 mt-2">yearly increase</p>
                </div>

                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-400 mb-2">Burn Rate (if any)</p>
                  <p className="text-2xl font-bold text-red-500">0</p>
                  <p className="text-sm text-slate-400 mt-2">tokens/day burned</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
