/**
 * Admin - Deep DAO Analytics
 * Analyze DAOs by type, region, cause, and custom segments
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { Building2, Globe, Target, TrendingUp, RefreshCw, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DAOSegment {
  name: string;
  count: number;
  members: number;
  treasury: number;
  avgProposals: number;
  health: number;
  growth: number;
}

interface DAOMetric {
  date: string;
  total: number;
  byType: Record<string, number>;
  byRegion: Record<string, number>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function AdminDAOAnalytics() {
  const [byType, setByType] = useState<DAOSegment[]>([]);
  const [byRegion, setByRegion] = useState<DAOSegment[]>([]);
  const [byCause, setByCause] = useState<DAOSegment[]>([]);
  const [metrics, setMetrics] = useState<DAOMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('type');
  const [filterRegion, setFilterRegion] = useState('all');

  const fetchDAOAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const [typeRes, regionRes, causeRes, metricsRes] = await Promise.all([
        fetch('/api/admin/daos/analytics/by-type', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/admin/daos/analytics/by-region?region=${filterRegion}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/daos/analytics/by-cause', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/daos/analytics/metrics', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (typeRes.ok) {
        const data = await typeRes.json();
        setByType(data.segments || []);
      }

      if (regionRes.ok) {
        const data = await regionRes.json();
        setByRegion(data.segments || []);
      }

      if (causeRes.ok) {
        const data = await causeRes.json();
        setByCause(data.segments || []);
      }

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics || []);
      }
    } catch (error) {
      console.error('Failed to fetch DAO analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDAOAnalytics();
    const interval = setInterval(fetchDAOAnalytics, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, [filterRegion]);

  const totalDAOs = byType.reduce((sum, t) => sum + t.count, 0);
  const totalMembers = byType.reduce((sum, t) => sum + t.members, 0);
  const totalTreasury = byType.reduce((sum, t) => sum + t.treasury, 0);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">DAO Analytics</h1>
            <p className="text-slate-400">Deep analysis by type, region, cause, and segments</p>
          </div>
          <Button
            onClick={fetchDAOAnalytics}
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
            <p className="text-slate-400 text-sm mb-2">Total DAOs</p>
            <p className="text-3xl font-bold text-blue-500">{totalDAOs}</p>
            <p className="text-slate-400 text-sm mt-2">Active organizations</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Total Members</p>
            <p className="text-3xl font-bold text-green-500">{(totalMembers / 1000).toFixed(1)}K</p>
            <p className="text-slate-400 text-sm mt-2">Across all DAOs</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Total Treasury</p>
            <p className="text-3xl font-bold text-yellow-500">${(totalTreasury / 1000000).toFixed(1)}M</p>
            <p className="text-slate-400 text-sm mt-2">Combined assets</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Avg Members</p>
            <p className="text-3xl font-bold text-purple-500">{(totalMembers / totalDAOs).toFixed(0)}</p>
            <p className="text-slate-400 text-sm mt-2">Per DAO</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded px-3 py-2"
          >
            <option value="all">All Regions</option>
            <option value="north-america">North America</option>
            <option value="south-america">South America</option>
            <option value="europe">Europe</option>
            <option value="africa">Africa</option>
            <option value="asia">Asia</option>
            <option value="oceania">Oceania</option>
          </select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="type">By Type</TabsTrigger>
            <TabsTrigger value="region">By Region</TabsTrigger>
            <TabsTrigger value="cause">By Cause</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          {/* By Type Tab */}
          <TabsContent value="type" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">DAO Types Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={byType}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, count }) => `${name}: ${count}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {byType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Type Comparison</h3>
                <div className="space-y-3">
                  {byType.map((type, idx) => (
                    <div key={type.name} className="bg-slate-700 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white font-semibold">{type.name}</span>
                        <Badge style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                          {type.count} DAOs
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                        <p>Members: <span className="text-white">{(type.members / 1000).toFixed(1)}K</span></p>
                        <p>Treasury: <span className="text-white">${(type.treasury / 1000000).toFixed(1)}M</span></p>
                        <p>Health: <span className="text-green-400">{type.health.toFixed(0)}%</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Type Performance Metrics</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={byType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" angle={-45} height={80} />
                  <YAxis stroke="#94a3b8" yAxisId="left" />
                  <YAxis stroke="#94a3b8" yAxisId="right" orientation="right" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Count" />
                  <Bar yAxisId="right" dataKey="health" fill="#10b981" name="Health Score" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* By Region Tab */}
          <TabsContent value="region" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Regional Distribution</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={byRegion}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" angle={-45} height={80} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Bar dataKey="count" fill="#3b82f6" name="DAOs" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="space-y-2">
                  {byRegion.map((region) => (
                    <div key={region.name} className="bg-slate-700 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white font-semibold text-sm">{region.name}</span>
                        <span className="text-blue-400 font-bold">{region.count}</span>
                      </div>
                      <div className="w-full bg-slate-600 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(region.count / Math.max(...byRegion.map(r => r.count))) * 100}%` }} />
                      </div>
                      <p className="text-slate-400 text-xs mt-1">
                        {(region.members / 1000).toFixed(1)}K members • {region.growth > 0 ? '+' : ''}{region.growth.toFixed(1)}% growth
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* By Cause Tab */}
          <TabsContent value="cause" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">DAOs by Cause/Mission</h3>
              <div className="space-y-3">
                {byCause.map((cause, idx) => (
                  <div key={cause.name} className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-white font-bold">{cause.name}</h4>
                        <Badge style={{ backgroundColor: COLORS[idx % COLORS.length] }} className="mt-1">
                          {cause.count} DAOs
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-green-500 font-bold">{cause.growth > 0 ? '+' : ''}{cause.growth.toFixed(1)}%</p>
                        <p className="text-slate-400 text-sm">Growth</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm text-slate-400 mt-3 pt-3 border-t border-slate-600">
                      <div>
                        <p className="text-xs">DAOs</p>
                        <p className="text-white font-semibold">{cause.count}</p>
                      </div>
                      <div>
                        <p className="text-xs">Members</p>
                        <p className="text-white font-semibold">{(cause.members / 1000).toFixed(1)}K</p>
                      </div>
                      <div>
                        <p className="text-xs">Treasury</p>
                        <p className="text-white font-semibold">${(cause.treasury / 1000000).toFixed(1)}M</p>
                      </div>
                      <div>
                        <p className="text-xs">Avg Health</p>
                        <p className="text-green-400 font-semibold">{cause.health.toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">DAO Growth Trends</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total DAOs" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Key Insights</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-2">Fastest Growing Type</p>
                  <p className="text-white font-bold">
                    {byType.reduce((max, t) => t.growth > max.growth ? t : max, byType[0])?.name || 'N/A'}
                  </p>
                  <p className="text-green-400 text-sm">
                    +{(byType.reduce((max, t) => t.growth > max.growth ? t : max, byType[0])?.growth || 0).toFixed(1)}% growth
                  </p>
                </div>

                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-2">Most Active Region</p>
                  <p className="text-white font-bold">
                    {byRegion.reduce((max, r) => r.count > max.count ? r : max, byRegion[0])?.name || 'N/A'}
                  </p>
                  <p className="text-blue-400 text-sm">
                    {(byRegion.reduce((max, r) => r.count > max.count ? r : max, byRegion[0])?.count || 0)} DAOs
                  </p>
                </div>

                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-2">Strongest Cause</p>
                  <p className="text-white font-bold">
                    {byCause.reduce((max, c) => c.health > max.health ? c : max, byCause[0])?.name || 'N/A'}
                  </p>
                  <p className="text-green-400 text-sm">
                    {(byCause.reduce((max, c) => c.health > max.health ? c : max, byCause[0])?.health || 0).toFixed(0)}% health
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
