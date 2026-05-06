/**
 * Admin - Platform Growth Analytics
 * Track user growth, vault creation, DAO formation, and platform expansion metrics
 */

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, Zap, RefreshCw, FileText, Grid3x3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';

interface GrowthMetric {
  date: string;
  newUsers: number;
  activeUsers: number;
  vaultsCreated: number;
  daosCreated: number;
  escrowsCreated: number;
  swapsExecuted: number;
  bridgesExecuted: number;
}

interface UserSegment {
  segment: string;
  count: number;
  percentage: number;
  trend: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function AdminPlatformGrowth() {
  const [growthData, setGrowthData] = useState<GrowthMetric[]>([]);
  const [segments, setSegments] = useState<UserSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30d');

  const fetchGrowthData = async () => {
    try {
      setLoading(true);

      const [growthData, segmentsData] = await Promise.all([
        authClient.get(`/api/admin/growth/metrics?range=${dateRange}`),
        authClient.get('/api/admin/growth/user-segments'),
      ]);

      setGrowthData(growthData.metrics || []);
      setSegments(segmentsData.segments || []);
    } catch (error) {
      console.error('Failed to fetch growth data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrowthData();
    const interval = setInterval(fetchGrowthData, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [dateRange]);

  const latestMetric = growthData[growthData.length - 1] || {};
  const previousMetric = growthData[Math.max(0, growthData.length - 2)] || {};

  const totalUsers = growthData.reduce((sum, m) => sum + m.activeUsers, 0) / (growthData.length || 1);
  const totalVaults = growthData.reduce((sum, m) => sum + m.vaultsCreated, 0);
  const totalDAOs = growthData.reduce((sum, m) => sum + m.daosCreated, 0);
  const totalEscrows = growthData.reduce((sum, m) => sum + m.escrowsCreated, 0);

  const newUsersTrend = ((latestMetric.newUsers || 0) - (previousMetric.newUsers || 0)) / (previousMetric.newUsers || 1) * 100;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Platform Growth Analytics</h1>
            <p className="text-slate-400">Track user expansion, product creation, and platform adoption</p>
          </div>
          <Button
            onClick={fetchGrowthData}
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
            <p className="text-slate-400 text-sm mb-2">New Users (Period)</p>
            <p className="text-3xl font-bold text-white">{latestMetric.newUsers || 0}</p>
            <div className={`text-sm mt-2 ${newUsersTrend > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {newUsersTrend > 0 ? '↑' : '↓'} {Math.abs(newUsersTrend).toFixed(1)}% vs previous
            </div>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Active Users</p>
            <p className="text-3xl font-bold text-blue-500">{Math.floor(totalUsers).toLocaleString()}</p>
            <p className="text-slate-400 text-sm mt-2">Average in period</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Vaults Created</p>
            <p className="text-3xl font-bold text-green-500">{totalVaults}</p>
            <p className="text-slate-400 text-sm mt-2">Total in period</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">DAOs Created</p>
            <p className="text-3xl font-bold text-purple-500">{totalDAOs}</p>
            <p className="text-slate-400 text-sm mt-2">Total in period</p>
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
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="segments">Segments</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">User Growth Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={growthData}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Area type="monotone" dataKey="activeUsers" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUsers)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Platform Creations</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={growthData.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" angle={-45} height={80} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Legend />
                    <Bar dataKey="vaultsCreated" fill="#10b981" name="Vaults" />
                    <Bar dataKey="daosCreated" fill="#8b5cf6" name="DAOs" />
                    <Bar dataKey="escrowsCreated" fill="#f59e0b" name="Escrows" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">New Users vs Active Users</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Line type="monotone" dataKey="newUsers" stroke="#ef4444" name="New Users" />
                  <Line type="monotone" dataKey="activeUsers" stroke="#3b82f6" name="Active Users" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Vaults Created Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" angle={-45} height={80} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Line type="monotone" dataKey="vaultsCreated" stroke="#10b981" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Transaction Activity</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" angle={-45} height={80} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Legend />
                    <Line type="monotone" dataKey="swapsExecuted" stroke="#f59e0b" name="Swaps" />
                    <Line type="monotone" dataKey="bridgesExecuted" stroke="#06b6d4" name="Bridges" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Product Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-400 mb-2">Total Vaults</p>
                  <p className="text-2xl font-bold text-green-500">{totalVaults}</p>
                </div>
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-400 mb-2">Total Escrows</p>
                  <p className="text-2xl font-bold text-yellow-500">{totalEscrows}</p>
                </div>
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-400 mb-2">Total DAOs</p>
                  <p className="text-2xl font-bold text-purple-500">{totalDAOs}</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Segments Tab */}
          <TabsContent value="segments" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">User Segments</h3>
              <div className="space-y-3">
                {segments.map((segment) => (
                  <div key={segment.segment} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium">{segment.segment}</span>
                      <div className="flex gap-4">
                        <span className="text-white font-bold">{segment.count}</span>
                        <span className="text-slate-400">{segment.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                        style={{ width: `${segment.percentage}%` }}
                      />
                    </div>
                    <div className={`text-sm ${segment.trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {segment.trend > 0 ? '↑' : '↓'} {Math.abs(segment.trend)}%
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
