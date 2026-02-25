/**
 * Admin Dashboard - Platform Overview
 * Central hub for monitoring platform health, metrics, and performance
 * Shows: Active users, total volume, chain health, payment status, agent health
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  AlertTriangle, CheckCircle, Activity, DollarSign, Users, Wallet, 
  TrendingUp, Server, Radio, ArrowUpRight, ArrowDownLeft, Eye, RefreshCw 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PlatformMetrics {
  activeWallets: number;
  totalVolume: number;
  totalFees: number;
  activeUsers: number;
  totalDAOs: number;
  averageTransactionValue: number;
  platformHealth: number;
  paymentProvidersHealthy: number;
  totalPaymentProviders: number;
}

interface ChainHealth {
  chain: string;
  status: 'healthy' | 'degraded' | 'down';
  lastBlock: number;
  blockTime: number;
  networkLatency: number;
  txSuccess: number;
  txFailure: number;
}

interface AgentStatus {
  agentId: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  tasksCompleted: number;
  tasksError: number;
  lastActivity: string;
  uptime: number;
  memory: number;
  cpu: number;
}

export default function AdminDashboardOverview() {
  const [metrics, setMetrics] = useState<PlatformMetrics>({
    activeWallets: 0,
    totalVolume: 0,
    totalFees: 0,
    activeUsers: 0,
    totalDAOs: 0,
    averageTransactionValue: 0,
    platformHealth: 0,
    paymentProvidersHealthy: 0,
    totalPaymentProviders: 0,
  });

  const [chainHealth, setChainHealth] = useState<ChainHealth[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const [metricsRes, chainsRes, agentsRes] = await Promise.all([
        fetch('/api/admin/platform-metrics', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/chain-health', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/agent-status', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data);
      }

      if (chainsRes.ok) {
        const data = await chainsRes.json();
        setChainHealth(data.chains || []);
      }

      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgentStatus(data.agents || []);
      }
    } catch (error) {
      console.error('Failed to fetch admin metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Key metrics cards
  const keyMetrics = [
    {
      label: 'Active Wallets',
      value: metrics.activeWallets.toLocaleString(),
      icon: Wallet,
      color: 'text-blue-600',
      trend: '+12%',
    },
    {
      label: 'Total Volume (24h)',
      value: `$${(metrics.totalVolume / 1000000).toFixed(2)}M`,
      icon: TrendingUp,
      color: 'text-green-600',
      trend: '+8.2%',
    },
    {
      label: 'Total Fees Collected',
      value: `$${(metrics.totalFees / 1000).toFixed(2)}K`,
      icon: DollarSign,
      color: 'text-emerald-600',
      trend: '+5.1%',
    },
    {
      label: 'Active DAOs',
      value: metrics.totalDAOs.toLocaleString(),
      icon: Users,
      color: 'text-purple-600',
      trend: '+3.2%',
    },
  ];

  // Volume chart data
  const volumeData = [
    { time: '12 AM', volume: 2400 },
    { time: '4 AM', volume: 1398 },
    { time: '8 AM', volume: 9800 },
    { time: '12 PM', volume: 3908 },
    { time: '4 PM', volume: 4800 },
    { time: '8 PM', volume: 3800 },
    { time: '12 AM', volume: 4300 },
  ];

  // Transaction distribution
  const txDistribution = [
    { name: 'Swaps', value: 35 },
    { name: 'Transfers', value: 25 },
    { name: 'Vault Deposits', value: 20 },
    { name: 'Governance', value: 12 },
    { name: 'Other', value: 8 },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
            <p className="text-slate-400">Platform monitoring and performance metrics</p>
          </div>
          <Button
            onClick={fetchMetrics}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Platform Health Status */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg border border-slate-700 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-2">Platform Health</p>
              <p className="text-5xl font-bold text-green-500">{metrics.platformHealth}%</p>
              <p className="text-slate-400 mt-2">
                {metrics.paymentProvidersHealthy}/{metrics.totalPaymentProviders} payment providers active
              </p>
            </div>
            <div className="text-right">
              <Activity className="h-16 w-16 text-green-500 mb-2" />
              <p className="text-sm text-green-500 font-semibold">All Systems Operational</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="chains">Chains</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {keyMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <Card key={metric.label} className="bg-slate-800 border-slate-700 p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-slate-400 text-sm mb-2">{metric.label}</p>
                        <p className="text-3xl font-bold text-white">{metric.value}</p>
                        <p className="text-green-500 text-sm mt-2">{metric.trend}</p>
                      </div>
                      <Icon className={`h-8 w-8 ${metric.color}`} />
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Volume Chart */}
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Trading Volume (24h)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Line type="monotone" dataKey="volume" stroke="#3b82f6" dot={{ fill: '#3b82f6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Transaction Distribution */}
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Transaction Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={txDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {txDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Chains Tab */}
          <TabsContent value="chains" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Blockchain Network Health</h3>
              <div className="space-y-4">
                {chainHealth.map((chain) => (
                  <div key={chain.chain} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Radio className="h-5 w-5 text-green-500" />
                        <span className="font-semibold text-white">{chain.chain}</span>
                      </div>
                      <Badge className={chain.status === 'healthy' ? 'bg-green-600' : chain.status === 'degraded' ? 'bg-yellow-600' : 'bg-red-600'}>
                        {chain.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">Block Time</p>
                        <p className="text-white font-semibold">{chain.blockTime}s</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Network Latency</p>
                        <p className="text-white font-semibold">{chain.networkLatency}ms</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Success Rate</p>
                        <p className="text-white font-semibold">
                          {((chain.txSuccess / (chain.txSuccess + chain.txFailure)) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Agent Status & Performance</h3>
              <div className="space-y-4">
                {agentStatus.map((agent) => (
                  <div key={agent.agentId} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {agent.status === 'online' && <CheckCircle className="h-5 w-5 text-green-500" />}
                        {agent.status === 'offline' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                        {agent.status === 'error' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                        <div>
                          <p className="font-semibold text-white">{agent.name}</p>
                          <p className="text-xs text-slate-400">Last active: {agent.lastActivity}</p>
                        </div>
                      </div>
                      <Badge className={agent.status === 'online' ? 'bg-green-600' : agent.status === 'offline' ? 'bg-yellow-600' : 'bg-red-600'}>
                        {agent.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">Tasks Done</p>
                        <p className="text-white font-semibold flex items-center">
                          <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                          {agent.tasksCompleted}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Errors</p>
                        <p className="text-white font-semibold flex items-center">
                          <ArrowDownLeft className="h-3 w-3 text-red-500 mr-1" />
                          {agent.tasksError}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Memory</p>
                        <p className="text-white font-semibold">{agent.memory}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400">CPU</p>
                        <p className="text-white font-semibold">{agent.cpu}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Payment Providers Status</h3>
              <p className="text-slate-400">Payment provider monitoring and integration status</p>
              {/* Content will be populated from data */}
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Platform Analytics</h3>
              <p className="text-slate-400">Detailed analytics and trend analysis</p>
              {/* Content will be populated from data */}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
