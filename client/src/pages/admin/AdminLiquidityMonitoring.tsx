/**
 * Admin - Liquidity Monitoring
 * Track liquidity pools, spreads, slippage, and health metrics
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Droplet, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LiquidityMetric {
  pair: string;
  liquidity: number;
  spread: number;
  slippage100k: number;
  health: 'optimal' | 'good' | 'warning' | 'critical';
  depth: number;
  lastUpdate: string;
}

interface LiquidityTrend {
  date: string;
  spread: number;
  depth: number;
  slippage: number;
}

export default function AdminLiquidityMonitoring() {
  const [metrics, setMetrics] = useState<LiquidityMetric[]>([]);
  const [trends, setTrends] = useState<LiquidityTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchLiquidityData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const [metricsRes, trendsRes] = await Promise.all([
        fetch('/api/admin/liquidity/metrics', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/liquidity/trends', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics || []);
      }

      if (trendsRes.ok) {
        const data = await trendsRes.json();
        setTrends(data.trends || []);
      }
    } catch (error) {
      console.error('Failed to fetch liquidity data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiquidityData();
    const interval = setInterval(fetchLiquidityData, 30000);
    return () => clearInterval(interval);
  }, []);

  const avgSpread = (metrics.reduce((sum, m) => sum + m.spread, 0) / (metrics.length || 1)).toFixed(3);
  const avgSlippage = (metrics.reduce((sum, m) => sum + m.slippage100k, 0) / (metrics.length || 1)).toFixed(2);
  const totalLiquidity = metrics.reduce((sum, m) => sum + m.liquidity, 0);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'optimal': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Liquidity Monitoring</h1>
            <p className="text-slate-400">Monitor liquidity pools, spreads, depth, and slippage</p>
          </div>
          <Button
            onClick={fetchLiquidityData}
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
            <p className="text-slate-400 text-sm mb-2">Total Liquidity</p>
            <p className="text-3xl font-bold text-white">${(totalLiquidity / 1000000).toFixed(2)}M</p>
            <p className="text-slate-400 text-sm mt-2">{metrics.length} pairs</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Avg Spread</p>
            <p className="text-3xl font-bold text-white">{avgSpread}%</p>
            <p className="text-slate-400 text-sm mt-2">All trading pairs</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Avg Slippage (100K)</p>
            <p className="text-3xl font-bold text-white">{avgSlippage}%</p>
            <p className="text-slate-400 text-sm mt-2">Per $100K trade</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Pool Health</p>
            <p className="text-3xl font-bold text-green-500">
              {metrics.filter(m => m.health === 'optimal' || m.health === 'good').length}/{metrics.length}
            </p>
            <p className="text-slate-400 text-sm mt-2">Healthy pools</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Pool Details</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Spread Analysis</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="pair" stroke="#94a3b8" angle={-45} height={80} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Bar dataKey="spread" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Slippage Impact</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="pair" stroke="#94a3b8" angle={-45} height={80} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Bar dataKey="slippage100k" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Liquidity Pool Details</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Pair</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Liquidity</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Spread</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Slippage (100K)</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Depth</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Health</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((metric) => (
                      <tr key={metric.pair} className="border-b border-slate-700 hover:bg-slate-700 transition">
                        <td className="py-3 px-4 text-white font-semibold">{metric.pair}</td>
                        <td className="py-3 px-4 text-white">${(metric.liquidity / 1000000).toFixed(2)}M</td>
                        <td className="py-3 px-4 text-white">{metric.spread.toFixed(3)}%</td>
                        <td className="py-3 px-4 text-white">{metric.slippage100k.toFixed(2)}%</td>
                        <td className="py-3 px-4 text-white">{metric.depth}</td>
                        <td className="py-3 px-4">
                          <Badge className={
                            metric.health === 'optimal' ? 'bg-green-600' :
                            metric.health === 'good' ? 'bg-blue-600' :
                            metric.health === 'warning' ? 'bg-yellow-600' : 'bg-red-600'
                          }>
                            {metric.health.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-xs">{metric.lastUpdate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Spread Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Line type="monotone" dataKey="spread" stroke="#3b82f6" dot={{ fill: '#3b82f6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Depth & Slippage</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Legend />
                    <Line type="monotone" dataKey="depth" stroke="#10b981" name="Depth" />
                    <Line type="monotone" dataKey="slippage" stroke="#ef4444" name="Slippage" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
