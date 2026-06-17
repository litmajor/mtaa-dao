/**
 * Admin - Rewards Management
 * Track weekly reward distribution, reward tiers, and user rewards
 */

import React, { useState, useEffect } from 'react';
import ChartJS from '@/components/charts/ChartJSSetup';
import { Chart } from 'react-chartjs-2';
import { Gift, TrendingUp, Users, DollarSign, Clock, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';

interface RewardMetric {
  week: string;
  distributed: number;
  claimedCount: number;
  totalEligible: number;
  avgReward: number;
}

interface RewardTier {
  tier: string;
  minPoints: number;
  maxPoints: number;
  rewardAmount: number;
  memberCount: number;
  percentage: number;
}

interface UserReward {
  id: string;
  userName: string;
  email: string;
  points: number;
  earnings: number;
  status: 'pending' | 'claimed' | 'locked';
  nextClaimDate?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdminRewards() {
  const [metrics, setMetrics] = useState<RewardMetric[]>([]);
  const [tiers, setTiers] = useState<RewardTier[]>([]);
  const [userRewards, setUserRewards] = useState<UserReward[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchRewardData = async () => {
    try {
      setLoading(true);

      const [metricsData, tiersData, userData] = await Promise.all([
        authClient.get('/api/admin/rewards/metrics'),
        authClient.get('/api/admin/rewards/tiers'),
        authClient.get('/api/admin/rewards/users'),
      ]);

      setMetrics(metricsData.metrics || []);
      setTiers(tiersData.tiers || []);
      setUserRewards(userData.users || []);
    } catch (error) {
      console.error('Failed to fetch reward data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewardData();
    const interval = setInterval(fetchRewardData, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const latestMetric = metrics[metrics.length - 1] || {};
  const totalDistributed = metrics.reduce((sum, m) => sum + m.distributed, 0);
  const pendingRewards = userRewards.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Rewards Management</h1>
            <p className="text-slate-400">Track reward distribution and user earnings</p>
          </div>
          <Button
            onClick={fetchRewardData}
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
            <p className="text-slate-400 text-sm mb-2">Total Distributed</p>
            <p className="text-3xl font-bold text-green-500">${(totalDistributed / 1000).toFixed(1)}K</p>
            <p className="text-slate-400 text-sm mt-2">All time</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">This Week</p>
            <p className="text-3xl font-bold text-blue-500">${(latestMetric.distributed || 0).toFixed(2)}</p>
            <p className="text-slate-400 text-sm mt-2">Claimed: {latestMetric.claimedCount || 0}</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Pending Rewards</p>
            <p className="text-3xl font-bold text-yellow-500">{pendingRewards}</p>
            <p className="text-slate-400 text-sm mt-2">Users awaiting claims</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Avg Reward</p>
            <p className="text-3xl font-bold text-purple-500">${(latestMetric.avgReward || 0).toFixed(2)}</p>
            <p className="text-slate-400 text-sm mt-2">Per user</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tiers">Reward Tiers</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="users">User Rewards</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Weekly Distribution</h3>
                <div style={{ height: 300 }}>
                  <Chart
                    type="bar"
                    data={{ labels: metrics.map(m => m.week), datasets: [{ label: 'Distributed ($)', data: metrics.map(m => m.distributed), backgroundColor: '#10b981' }, { label: 'Claims', data: metrics.map(m => m.claimedCount), backgroundColor: '#3b82f6' }] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }}
                  />
                </div>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Claim Rate Trend</h3>
                <div style={{ height: 300 }}>
                  <Chart
                    type="line"
                    data={{ labels: metrics.map(m => m.week), datasets: [{ label: 'Claims', data: metrics.map(m => m.claimedCount), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.06)', tension: 0.2 }] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                  />
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Reward Tiers Tab */}
          <TabsContent value="tiers" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Reward Tiers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tiers.map((tier) => (
                  <div key={tier.tier} className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-white font-bold">{tier.tier}</h4>
                      <Badge className="bg-blue-600">{tier.memberCount} members</Badge>
                    </div>
                    <p className="text-slate-400 text-sm mb-3">
                      {tier.minPoints.toLocaleString()} - {tier.maxPoints.toLocaleString()} points
                    </p>
                    <div className="bg-slate-600 rounded-lg p-3 mb-3">
                      <p className="text-slate-400 text-xs mb-1">Reward Amount</p>
                      <p className="text-green-500 font-bold text-lg">${tier.rewardAmount.toFixed(2)}</p>
                    </div>
                    <div className="w-full bg-slate-600 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${tier.percentage}%` }} />
                    </div>
                    <p className="text-slate-400 text-xs mt-2">{tier.percentage.toFixed(1)}% of total</p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Distribution Tab */}
          <TabsContent value="distribution" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Tier Distribution</h3>
              <div style={{ height: 350 }}>
                <Chart
                  type="pie"
                  data={{ labels: tiers.map(t => t.tier), datasets: [{ data: tiers.map(t => t.percentage), backgroundColor: tiers.map((_, i) => COLORS[i % COLORS.length]) }] }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${ctx.raw.toFixed(1)}%` } } } }}
                />
              </div>
            </Card>
          </TabsContent>

          {/* User Rewards Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">User Rewards Status</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {userRewards.map((reward) => {
                  const statusColors: Record<string, string> = {
                    pending: 'bg-yellow-600',
                    claimed: 'bg-green-600',
                    locked: 'bg-red-600',
                  };
                  return (
                    <div key={reward.id} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-white font-semibold">{reward.userName}</p>
                          <p className="text-slate-400 text-sm">{reward.email}</p>
                        </div>
                        <Badge className={statusColors[reward.status]}>
                          {reward.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-slate-400">Points</p>
                          <p className="text-white font-bold">{reward.points.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Earnings</p>
                          <p className="text-green-500 font-bold">${reward.earnings.toFixed(2)}</p>
                        </div>
                        {reward.nextClaimDate && (
                          <div>
                            <p className="text-slate-400">Next Claim</p>
                            <p className="text-white text-sm">{new Date(reward.nextClaimDate).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
