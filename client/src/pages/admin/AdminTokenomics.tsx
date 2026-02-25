/**
 * Admin - Tokenomics Management
 * Track token distribution, emissions, holdings, governance, and economic metrics
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Coins, TrendingUp, Users, Lock, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
      const token = localStorage.getItem('accessToken');

      const [metricsRes, distRes, holdersRes] = await Promise.all([
        fetch('/api/admin/tokenomics/metrics', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/tokenomics/distribution', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/tokenomics/holders', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics || []);
      }

      if (distRes.ok) {
        const data = await distRes.json();
        setDistribution(data.distribution || []);
      }

      if (holdersRes.ok) {
        const data = await holdersRes.json();
        setHolders(data.holders || []);
      }
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
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" yAxisId="left" />
                    <YAxis stroke="#94a3b8" yAxisId="right" orientation="right" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="price" stroke="#3b82f6" name="Price ($)" />
                    <Line yAxisId="right" type="monotone" dataKey="marketCap" stroke="#10b981" name="Market Cap" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Supply Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics}>
                    <defs>
                      <linearGradient id="colorSupply" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Legend />
                    <Area type="monotone" dataKey="totalSupply" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorSupply)" name="Total Supply" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Distribution Tab */}
          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Token Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={distribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="percentage"
                    >
                      {distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  </PieChart>
                </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={holders}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="segment" stroke="#94a3b8" angle={-45} height={80} />
                  <YAxis stroke="#94a3b8" yAxisId="left" />
                  <YAxis stroke="#94a3b8" yAxisId="right" orientation="right" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="holders" fill="#3b82f6" name="Holders" />
                  <Bar yAxisId="right" dataKey="tokenAmount" fill="#10b981" name="Token Amount" />
                </BarChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="timestamp" stroke="#94a3b8" angle={-45} height={80} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Bar dataKey="emissions" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
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
