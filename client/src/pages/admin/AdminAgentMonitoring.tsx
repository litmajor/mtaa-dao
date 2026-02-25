/**
 * Admin - Agent Monitoring
 * Track AI agents, task execution, performance, and resource usage
 */

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter } from 'recharts';
import { Bot, Activity, Zap, AlertTriangle, CheckCircle, RefreshCw, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Agent {
  id: string;
  name: string;
  type: 'trading' | 'liquidity' | 'monitoring' | 'arbitrage' | 'rebalancing';
  status: 'active' | 'idle' | 'error' | 'offline';
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number;
  avgExecutionTime: number;
  lastTask: string;
  nextRun: string;
  lastUpdated: string;
}

interface TaskLog {
  timestamp: string;
  agent: string;
  task: string;
  status: 'success' | 'failed' | 'pending';
  duration: number;
  result: string;
}

interface PerformanceMetric {
  timestamp: string;
  agent: string;
  cpu: number;
  memory: number;
  tasks: number;
}

export default function AdminAgentMonitoring() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const fetchAgentData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const [agentsRes, logsRes, perfRes] = await Promise.all([
        fetch('/api/admin/agents', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/agents/task-logs', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/agents/performance', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
        if (!selectedAgent && data.agents.length > 0) {
          setSelectedAgent(data.agents[0].id);
        }
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setTaskLogs(data.logs || []);
      }

      if (perfRes.ok) {
        const data = await perfRes.json();
        setPerformance(data.metrics || []);
      }
    } catch (error) {
      console.error('Failed to fetch agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentData();
    const interval = setInterval(fetchAgentData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-600';
      case 'idle': return 'bg-blue-600';
      case 'error': return 'bg-red-600';
      case 'offline': return 'bg-slate-600';
      default: return 'bg-slate-600';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'trading': return 'text-blue-400';
      case 'liquidity': return 'text-green-400';
      case 'monitoring': return 'text-purple-400';
      case 'arbitrage': return 'text-yellow-400';
      case 'rebalancing': return 'text-pink-400';
      default: return 'text-slate-400';
    }
  };

  const activeAgents = agents.filter(a => a.status === 'active').length;
  const totalTasks = agents.reduce((sum, a) => sum + a.tasksCompleted, 0);
  const totalFailed = agents.reduce((sum, a) => sum + a.tasksFailed, 0);
  const avgSuccessRate = (agents.reduce((sum, a) => sum + a.successRate, 0) / (agents.length || 1)).toFixed(2);

  const currentAgent = agents.find(a => a.id === selectedAgent);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Agent Monitoring</h1>
            <p className="text-slate-400">Monitor AI agents, task execution, and performance metrics</p>
          </div>
          <Button
            onClick={fetchAgentData}
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
            <p className="text-slate-400 text-sm mb-2">Active Agents</p>
            <p className="text-3xl font-bold text-green-500">{activeAgents}/{agents.length}</p>
            <p className="text-slate-400 text-sm mt-2">Running agents</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Tasks Completed</p>
            <p className="text-3xl font-bold text-white">{totalTasks.toLocaleString()}</p>
            <p className="text-slate-400 text-sm mt-2">All time</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Failed Tasks</p>
            <p className={`text-3xl font-bold ${totalFailed === 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalFailed}
            </p>
            <p className="text-slate-400 text-sm mt-2">Error rate: {((totalFailed / (totalTasks + totalFailed) * 100) || 0).toFixed(2)}%</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Avg Success Rate</p>
            <p className="text-3xl font-bold text-blue-500">{avgSuccessRate}%</p>
            <p className="text-slate-400 text-sm mt-2">All agents</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="tasks">Task Logs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Agent Status Distribution</h3>
                <div className="space-y-3">
                  {[
                    { status: 'active', label: 'Active', color: 'bg-green-600' },
                    { status: 'idle', label: 'Idle', color: 'bg-blue-600' },
                    { status: 'error', label: 'Error', color: 'bg-red-600' },
                    { status: 'offline', label: 'Offline', color: 'bg-slate-600' },
                  ].map(({ status, label, color }) => {
                    const count = agents.filter(a => a.status === status).length;
                    const percentage = (count / agents.length * 100) || 0;
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">{label}</span>
                          <span className="text-white font-semibold">{count}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${color}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Task Status Summary</h3>
                <div className="space-y-3">
                  {[
                    { status: 'success', label: 'Successful', color: 'text-green-500' },
                    { status: 'failed', label: 'Failed', color: 'text-red-500' },
                    { status: 'pending', label: 'Pending', color: 'text-yellow-500' },
                  ].map(({ status, label, color }) => {
                    const count = taskLogs.filter(t => t.status === status).length;
                    const percentage = (count / taskLogs.length * 100) || 0;
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">{label}</span>
                          <span className={`font-semibold ${color}`}>{count}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${color.replace('text-', 'bg-')}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Agent Details</h3>
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    className={`bg-slate-700 rounded-lg p-4 cursor-pointer transition border-2 ${
                      selectedAgent === agent.id ? 'border-blue-500' : 'border-transparent hover:border-slate-600'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-blue-400" />
                        <div>
                          <h4 className="text-white font-semibold">{agent.name}</h4>
                          <p className={`text-xs ${getTypeColor(agent.type)}`}>{agent.type.toUpperCase()}</p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(agent.status)}>
                        {agent.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-sm mb-2">
                      <div>
                        <p className="text-slate-400 mb-1">Uptime</p>
                        <p className="text-green-400 font-semibold">{agent.uptime}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">CPU</p>
                        <p className="text-white font-semibold">{agent.cpuUsage}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Memory</p>
                        <p className="text-white font-semibold">{agent.memoryUsage}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Success</p>
                        <p className="text-green-400 font-semibold">{agent.successRate}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Tasks Done</p>
                        <p className="text-white font-semibold">{agent.tasksCompleted}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Failed</p>
                        <p className="text-red-400 font-semibold">{agent.tasksFailed}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-600">
                      <div>
                        <span>Avg Time: </span>
                        <span className="text-white">{agent.avgExecutionTime}s</span>
                      </div>
                      <div>
                        <span>Last Task: </span>
                        <span className="text-white">{agent.lastTask}</span>
                      </div>
                      <div>
                        <span>Next: </span>
                        <span className="text-white">{agent.nextRun}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">CPU Usage Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performance.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Line type="monotone" dataKey="cpu" stroke="#ef4444" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Memory Usage Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performance.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Line type="monotone" dataKey="memory" stroke="#3b82f6" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {currentAgent && (
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{currentAgent.name} - Task Execution Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={taskLogs.filter(t => t.agent === currentAgent.name).slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" angle={-45} height={80} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Bar dataKey="duration" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </TabsContent>

          {/* Task Logs Tab */}
          <TabsContent value="tasks" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Task Logs</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Timestamp</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Agent</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Task</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Duration</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskLogs.slice(0, 20).map((log, idx) => (
                      <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700 transition">
                        <td className="py-3 px-4 text-slate-300 text-xs">{log.timestamp}</td>
                        <td className="py-3 px-4 text-white">{log.agent}</td>
                        <td className="py-3 px-4 text-white">{log.task}</td>
                        <td className="py-3 px-4">
                          <Badge className={
                            log.status === 'success' ? 'bg-green-600' :
                            log.status === 'failed' ? 'bg-red-600' : 'bg-yellow-600'
                          }>
                            {log.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-white">{log.duration}ms</td>
                        <td className="py-3 px-4 text-slate-400 text-xs max-w-xs truncate">{log.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
