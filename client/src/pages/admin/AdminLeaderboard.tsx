/**
 * Admin - Leaderboard & Top Members
 * Display top contributors, members, and achievement rankings
 */

import React, { useState, useEffect } from 'react';
import ChartJS from '@/components/charts/ChartJSSetup';
import { Chart } from 'react-chartjs-2';
import { Activity, TrendingUp, AlertCircle, RefreshCw, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';

interface LeaderboardMember {
  rank: number;
  id: string;
  name: string;
  avatar?: string;
  score: number;
  contributions: number;
  level: number;
  achievements: number;
  joinDate: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface AchievementRank {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

const MEDAL_COLORS: Record<number, string> = {
  1: 'bg-yellow-500',
  2: 'bg-slate-400',
  3: 'bg-orange-600',
};

export default function AdminLeaderboard() {
  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [achievements, setAchievements] = useState<AchievementRank[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('rankings');
  const [filterType, setFilterType] = useState('overall');

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);

      const [membersData, achievementsData] = await Promise.all([
        authClient.get(`/api/admin/leaderboard/members?type=${filterType}`),
        authClient.get('/api/admin/leaderboard/achievements'),
      ]);

      setMembers(membersData.members || []);
      setAchievements(achievementsData.achievements || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
    const interval = setInterval(fetchLeaderboardData, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, [filterType]);

  const topThree = members.slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Leaderboard & Rankings</h1>
            <p className="text-slate-400">Top contributors, members, and achievements</p>
          </div>
          <Button
            onClick={fetchLeaderboardData}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Top 3 Podium */}
        {topThree.length >= 1 && (
          <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700 p-8 mb-6">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">🏆 Top Champions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1st Place (Center) */}
              {topThree[0] && (
                <div className="md:col-span-1 md:order-2 flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-yellow-500 flex items-center justify-center text-4xl font-bold text-white mb-3">
                    👑
                  </div>
                  <div className="text-center">
                    <p className="text-yellow-400 font-bold text-2xl">1st Place</p>
                    <p className="text-white font-bold text-xl">{topThree[0].name}</p>
                    <p className="text-slate-400 text-sm">Score: {topThree[0].score.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* 2nd Place (Left) */}
              {topThree[1] && (
                <div className="md:col-span-1 md:order-1 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-slate-400 flex items-center justify-center text-3xl font-bold text-white mb-3">
                    🥈
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 font-bold text-lg">2nd Place</p>
                    <p className="text-white font-bold">{topThree[1].name}</p>
                    <p className="text-slate-500 text-sm">Score: {topThree[1].score.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* 3rd Place (Right) */}
              {topThree[2] && (
                <div className="md:col-span-1 md:order-3 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-orange-600 flex items-center justify-center text-3xl font-bold text-white mb-3">
                    🥉
                  </div>
                  <div className="text-center">
                    <p className="text-orange-400 font-bold text-lg">3rd Place</p>
                    <p className="text-white font-bold">{topThree[2].name}</p>
                    <p className="text-slate-500 text-sm">Score: {topThree[2].score.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded px-3 py-2"
          >
            <option value="overall">Overall</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="contributors">Contributors</option>
            <option value="builders">Builders</option>
          </select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="rankings">Rankings</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          {/* Rankings Tab */}
          <TabsContent value="rankings" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {members.map((member) => (
                  <div key={member.id} className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4 flex-1">
                        <div className="text-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${MEDAL_COLORS[member.rank] || 'bg-slate-600'}`}>
                            {member.rank}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex gap-2 items-center mb-1">
                            <p className="text-white font-bold">{member.name}</p>
                            <div className="flex gap-1">
                              {Array.from({ length: member.level }).map((_, i) => (
                                <Activity key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              ))}
                            </div>
                          </div>
                          <p className="text-slate-400 text-sm">
                            {member.contributions} contributions • {member.achievements} achievements
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold text-lg">{member.score.toLocaleString()} pts</p>
                        <p className={`text-sm ${member.trend === 'up' ? 'text-green-400' : member.trend === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
                          {member.trend === 'up' ? '↑' : member.trend === 'down' ? '↓' : '→'} {member.trendValue}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Achievement Distribution</h3>
              <div className="space-y-3">
                {achievements.map((achievement) => (
                  <div key={achievement.id} className="bg-slate-700 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-semibold">{achievement.name}</span>
                      <span className="text-blue-400 font-bold">{achievement.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-600 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${achievement.percentage}%` }} />
                    </div>
                    <p className="text-slate-400 text-xs mt-1">{achievement.count.toLocaleString()} members earned</p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Score Distribution</h3>
              <div style={{ height: 300 }}>
                <Chart type="bar" data={{ labels: members.slice(0,20).map(m => m.name), datasets: [{ label: 'Score', data: members.slice(0,20).map(m => m.score), backgroundColor: '#3b82f6' }] }} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
