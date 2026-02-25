/**
 * Admin - Achievements & Tasks Management
 * Create and manage achievements, tasks, and gamification elements
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge, Target, Trophy, Plus, RefreshCw, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  points: number;
  earnedCount: number;
  earnedPercentage: number;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'oneshot';
  reward: number;
  completionCount: number;
  activeUsers: number;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'active' | 'completed' | 'archived';
  endsAt?: string;
}

interface AchievementMetric {
  date: string;
  totalEarned: number;
  uniqueUsers: number;
  avgPoints: number;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-600',
  medium: 'bg-yellow-600',
  hard: 'bg-orange-600',
  expert: 'bg-red-600',
};

export default function AdminAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [metrics, setMetrics] = useState<AchievementMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('achievements');
  const [showForm, setShowForm] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const [achievementsRes, tasksRes, metricsRes] = await Promise.all([
        fetch('/api/admin/achievements', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/tasks', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/achievements/metrics', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (achievementsRes.ok) {
        const data = await achievementsRes.json();
        setAchievements(data.achievements || []);
      }

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const totalPoints = achievements.reduce((sum, a) => sum + (a.points * a.earnedCount), 0);
  const activeAchievements = achievements.filter(a => a.earnedCount > 0).length;
  const activeTasks = tasks.filter(t => t.status === 'active').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Achievements & Tasks</h1>
            <p className="text-slate-400">Create and manage gamification elements</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={fetchData}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Total Achievements</p>
            <p className="text-3xl font-bold text-blue-500">{achievements.length}</p>
            <p className="text-slate-400 text-sm mt-2">{activeAchievements} earned</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Active Tasks</p>
            <p className="text-3xl font-bold text-green-500">{activeTasks}</p>
            <p className="text-slate-400 text-sm mt-2">Running now</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Total Points</p>
            <p className="text-3xl font-bold text-purple-500">{(totalPoints / 1000).toFixed(1)}K</p>
            <p className="text-slate-400 text-sm mt-2">Distributed</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Engagement</p>
            <p className="text-3xl font-bold text-yellow-500">
              {achievements.length > 0 ? ((activeAchievements / achievements.length) * 100).toFixed(0) : 0}%
            </p>
            <p className="text-slate-400 text-sm mt-2">Participation rate</p>
          </Card>
        </div>

        {/* Creation Form */}
        {showForm && (
          <Card className="bg-slate-800 border-slate-700 p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Achievement/Task</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-sm block mb-2">Type</label>
                <select className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2">
                  <option>Achievement</option>
                  <option>Task</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-2">Name/Title</label>
                <input type="text" placeholder="Enter name" className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2" />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-2">Description</label>
                <input type="text" placeholder="Enter description" className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2" />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-2">Points/Reward</label>
                <input type="number" placeholder="0" className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2" />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button className="bg-green-600 hover:bg-green-700 flex-1">Create</Button>
                <Button onClick={() => setShowForm(false)} className="bg-slate-600 hover:bg-slate-700 flex-1">Cancel</Button>
              </div>
            </div>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {achievements.map((achievement) => (
                  <div key={achievement.id} className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex gap-2 items-center mb-1">
                          <span className="text-2xl">{achievement.icon}</span>
                          <div>
                            <p className="text-white font-bold">{achievement.name}</p>
                            <p className="text-slate-400 text-sm">{achievement.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={DIFFICULTY_COLORS[achievement.difficulty]}>
                          {achievement.difficulty}
                        </Badge>
                        <Badge className="bg-purple-600">{achievement.points} pts</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                      <div>
                        <p className="text-slate-400">Earned By</p>
                        <p className="text-white font-semibold">{achievement.earnedCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Percentage</p>
                        <p className="text-white font-semibold">{achievement.earnedPercentage.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Category</p>
                        <p className="text-white font-semibold">{achievement.category}</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-600 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(achievement.earnedPercentage, 100)}%` }} />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button className="flex-1 bg-slate-600 hover:bg-slate-500 h-8 text-sm">
                        <Edit2 className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button className="flex-1 bg-red-600 hover:bg-red-700 h-8 text-sm">
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {tasks.map((task) => (
                  <div key={task.id} className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex gap-2 items-center mb-1">
                          <Target className="h-5 w-5 text-blue-400" />
                          <div>
                            <p className="text-white font-bold">{task.title}</p>
                            <p className="text-slate-400 text-sm">{task.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={task.status === 'active' ? 'bg-green-600' : task.status === 'completed' ? 'bg-blue-600' : 'bg-slate-600'}>
                          {task.status}
                        </Badge>
                        <Badge className={DIFFICULTY_COLORS[task.difficulty]}>
                          {task.difficulty}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div>
                        <p className="text-slate-400">Reward</p>
                        <p className="text-yellow-500 font-semibold">${task.reward}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Completions</p>
                        <p className="text-white font-semibold">{task.completionCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Active Users</p>
                        <p className="text-white font-semibold">{task.activeUsers}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Type</p>
                        <p className="text-white font-semibold">{task.type}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Achievement Metrics</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" yAxisId="left" />
                  <YAxis stroke="#94a3b8" yAxisId="right" orientation="right" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="totalEarned" stroke="#3b82f6" name="Total Earned" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="uniqueUsers" stroke="#10b981" name="Unique Users" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
