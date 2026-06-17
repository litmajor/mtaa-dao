/**
 * Admin - Deep DAO Analytics
 * Analyze DAOs by type, region, cause, and custom segments
 */

import React, { useState, useEffect } from 'react';
import ChartJS from '@/components/charts/ChartJSSetup';
import { Chart } from 'react-chartjs-2';
import { Building2, Globe, Target, TrendingUp, RefreshCw, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';

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

      const [typeData, regionData, causeData, metricsData] = await Promise.all([
        authClient.get('/api/admin/daos/analytics/by-type'),
        authClient.get(`/api/admin/daos/analytics/by-region?region=${filterRegion}`),
        authClient.get('/api/admin/daos/analytics/by-cause'),
        authClient.get('/api/admin/daos/analytics/metrics'),
      ]);

      setByType(typeData.segments || []);
      setByRegion(regionData.segments || []);
      setByCause(causeData.segments || []);
      setMetrics(metricsData.metrics || []);
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
                <div style={{ height: 300 }}>
                  <Chart
                    type="pie"
                    data={{ labels: byType.map(b => b.name), datasets: [{ data: byType.map(b => b.count), backgroundColor: byType.map((_, i) => COLORS[i % COLORS.length]) }] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${ctx.raw}` } } } }}
                  />
                </div>
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
              <div style={{ height: 350 }}>
                <Chart
                  type="bar"
                  data={{ labels: byType.map(b => b.name), datasets: [{ label: 'Count', data: byType.map(b => b.count), backgroundColor: '#3b82f6' }, { label: 'Health Score', data: byType.map(b => b.health), backgroundColor: '#10b981' }] }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }}
                />
              </div>
            </Card>
          </TabsContent>

          {/* By Region Tab */}
          <TabsContent value="region" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Regional Distribution</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div style={{ height: 350 }}>
                  <Chart
                    type="bar"
                    data={{ labels: byRegion.map(r => r.name), datasets: [{ label: 'DAOs', data: byRegion.map(r => r.count), backgroundColor: '#3b82f6' }] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                  />
                </div>

                <div className="space-y-2">
                  {byRegion.map((region) => (
                    <div key={region.name} className="bg-slate-700 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white font-semibold text-sm">{region.name}</span>
                        <span className="text-blue-400 font-bold">{region.count}</span>
                      </div>
                      <div className="w-full bg-slate-600 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(region.count / Math.max(...byRegion.map(r => r.count))) * 100}%` }} suppressHydrationWarning />
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
              <div style={{ height: 350 }}>
                <Chart
                  type="line"
                  data={{ labels: metrics.map(m => m.date), datasets: [{ label: 'Total DAOs', data: metrics.map(m => m.total), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.06)', tension: 0.2 }] }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              </div>
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
