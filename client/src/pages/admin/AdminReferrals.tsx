/**
 * Admin - Referral System Monitoring
 * Track referral programs, top referrers, user acquisition, and referral rewards
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Users, TrendingUp, Award, DollarSign, Share2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ReferralMetric {
  date: string;
  newReferrals: number;
  activeReferrers: number;
  rewardsDistributed: number;
  conversionRate: number;
}

interface TopReferrer {
  id: string;
  name: string;
  email: string;
  referralsCount: number;
  activeReferrals: number;
  rewardsEarned: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  joinDate: string;
  trend: number;
}

interface ReferralSource {
  source: string;
  referrals: number;
  conversions: number;
  revenue: number;
  percentage: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminReferrals() {
  const [metrics, setMetrics] = useState<ReferralMetric[]>([]);
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
  const [sources, setSources] = useState<ReferralSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const [metricsRes, referrersRes, sourcesRes] = await Promise.all([
        fetch('/api/admin/referrals/metrics', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/referrals/top-referrers', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/referrals/sources', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics || []);
      }

      if (referrersRes.ok) {
        const data = await referrersRes.json();
        setTopReferrers(data.topReferrers || []);
      }

      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.sources || []);
      }
    } catch (error) {
      console.error('Failed to fetch referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
    const interval = setInterval(fetchReferralData, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const latestMetric = metrics[metrics.length - 1] || {};
  const totalReferrers = topReferrers.length;
  const totalRewards = topReferrers.reduce((sum, r) => sum + r.rewardsEarned, 0);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Referral System</h1>
            <p className="text-slate-400">Monitor referrals, top referrers, and reward distribution</p>
          </div>
          <Button
            onClick={fetchReferralData}
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
            <p className="text-slate-400 text-sm mb-2">New Referrals (24h)</p>
            <p className="text-3xl font-bold text-blue-500">{latestMetric.newReferrals || 0}</p>
            <p className="text-slate-400 text-sm mt-2">Acquiring users</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Active Referrers</p>
            <p className="text-3xl font-bold text-green-500">{totalReferrers}</p>
            <p className="text-slate-400 text-sm mt-2">Total participants</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Conversion Rate</p>
            <p className="text-3xl font-bold text-purple-500">{(latestMetric.conversionRate || 0).toFixed(1)}%</p>
            <p className="text-slate-400 text-sm mt-2">Referral to customer</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Rewards Distributed</p>
            <p className="text-3xl font-bold text-yellow-500">${(totalRewards / 1000).toFixed(1)}K</p>
            <p className="text-slate-400 text-sm mt-2">This period</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="referrers">Top Referrers</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Referral Growth</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics}>
                    <defs>
                      <linearGradient id="colorReferrals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Area type="monotone" dataKey="newReferrals" stroke="#3b82f6" fillOpacity={1} fill="url(#colorReferrals)" name="New Referrals" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Conversion Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Line type="monotone" dataKey="conversionRate" stroke="#10b981" name="Conversion Rate (%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Top Referrers Tab */}
          <TabsContent value="referrers" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Top Referrers</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {topReferrers.slice(0, 10).map((referrer, idx) => {
                  const tierColors: Record<string, string> = {
                    bronze: 'bg-amber-600',
                    silver: 'bg-slate-400',
                    gold: 'bg-yellow-500',
                    platinum: 'bg-purple-600',
                  };
                  return (
                    <div key={referrer.id} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex gap-2 items-center">
                            <span className="font-bold text-white text-lg">#{idx + 1}</span>
                            <span className="text-white font-semibold">{referrer.name}</span>
                            <Badge className={tierColors[referrer.tier]}>
                              {referrer.tier.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-slate-400 text-sm">{referrer.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-green-500 font-bold">${referrer.rewardsEarned.toFixed(2)}</p>
                          <p className={`text-sm ${referrer.trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {referrer.trend > 0 ? '↑' : '↓'} {Math.abs(referrer.trend)}%
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm text-slate-400">
                        <p>Total Referrals: <span className="text-white font-semibold">{referrer.referralsCount}</span></p>
                        <p>Active: <span className="text-white font-semibold">{referrer.activeReferrals}</span></p>
                        <p>Joined: <span className="text-white font-semibold">{new Date(referrer.joinDate).toLocaleDateString()}</span></p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Referral Sources</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sources}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ source, percentage }) => `${source}: ${percentage.toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="percentage"
                    >
                      {sources.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Source Performance</h3>
                <div className="space-y-3">
                  {sources.map((source) => (
                    <div key={source.source} className="bg-slate-700 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-white font-semibold">{source.source}</span>
                        <span className="text-blue-400">{source.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-600 rounded-full h-2 mb-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${source.percentage}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                        <p>Referrals: <span className="text-white">{source.referrals}</span></p>
                        <p>Conversions: <span className="text-white">{source.conversions}</span></p>
                        <p>Revenue: <span className="text-white">${(source.revenue / 1000).toFixed(1)}K</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Rewards Distribution</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" angle={-45} height={80} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Bar dataKey="rewardsDistributed" fill="#f59e0b" name="Rewards ($)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Reward Tiers</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { tier: 'Bronze', minReferrals: 0, reward: '5%', color: 'bg-amber-600' },
                  { tier: 'Silver', minReferrals: 10, reward: '7%', color: 'bg-slate-400' },
                  { tier: 'Gold', minReferrals: 25, reward: '10%', color: 'bg-yellow-500' },
                  { tier: 'Platinum', minReferrals: 50, reward: '15%', color: 'bg-purple-600' },
                ].map((t) => (
                  <div key={t.tier} className="bg-slate-700 rounded-lg p-4 text-center">
                    <div className={`${t.color} text-white font-bold py-2 rounded mb-2`}>{t.tier}</div>
                    <p className="text-slate-400 text-sm mb-1">Min {t.minReferrals}+ referrals</p>
                    <p className="text-white text-lg font-bold">{t.reward} commission</p>
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
