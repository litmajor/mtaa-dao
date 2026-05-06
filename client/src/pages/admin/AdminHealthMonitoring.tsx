/**
 * Admin - Health Monitoring
 * Monitor blockchain networks, node health, and system performance
 */

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';

interface ChainHealth {
  chain: string;
  status: 'online' | 'offline' | 'warning';
  latency: number;
  blockTime: number;
  gasPrice: number;
  txSuccess: number;
  nodeCount: number;
  lastBlock: number;
  peers: number;
  syncStatus: number;
  uptime: number;
}

interface NodeMetric {
  timestamp: string;
  chain: string;
  cpu: number;
  memory: number;
  disk: number;
  latency: number;
}

interface SystemAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  chain?: string;
  timestamp: string;
  resolved?: boolean;
}

export default function AdminHealthMonitoring() {
  const [chains, setChains] = useState<ChainHealth[]>([]);
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetric[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chains');

  const fetchHealthData = async () => {
    try {
      setLoading(true);

      const [chainsData, metricsData, alertsData] = await Promise.all([
        authClient.get('/api/admin/health/chains'),
        authClient.get('/api/admin/health/node-metrics'),
        authClient.get('/api/admin/health/alerts'),
      ]);

      setChains(chainsData.chains || []);
      setNodeMetrics(metricsData.metrics || []);
      setAlerts(alertsData.alerts || []);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-600';
      case 'warning': return 'bg-yellow-600';
      case 'offline': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'warning': return 'bg-yellow-600';
      case 'info': return 'bg-blue-600';
      default: return 'bg-slate-600';
    }
  };

  const onlineChains = chains.filter(c => c.status === 'online').length;
  const avgLatency = (chains.reduce((sum, c) => sum + c.latency, 0) / (chains.length || 1)).toFixed(2);
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Health Monitoring</h1>
            <p className="text-slate-400">Monitor blockchain networks, nodes, and system health</p>
          </div>
          <Button
            onClick={fetchHealthData}
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
            <p className="text-slate-400 text-sm mb-2">Chains Online</p>
            <p className="text-3xl font-bold text-green-500">{onlineChains}/{chains.length}</p>
            <p className="text-slate-400 text-sm mt-2">Operational networks</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Avg Latency</p>
            <p className="text-3xl font-bold text-white">{avgLatency}ms</p>
            <p className="text-slate-400 text-sm mt-2">Network latency</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Critical Alerts</p>
            <p className={`text-3xl font-bold ${criticalAlerts > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {criticalAlerts}
            </p>
            <p className="text-slate-400 text-sm mt-2">Unresolved issues</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">System Status</p>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${criticalAlerts === 0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <p className={`text-lg font-bold ${criticalAlerts === 0 ? 'text-green-500' : 'text-red-500'}`}>
                {criticalAlerts === 0 ? 'HEALTHY' : 'DEGRADED'}
              </p>
            </div>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="chains">Chains</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="nodes">Nodes</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          {/* Chains Tab */}
          <TabsContent value="chains" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Chain Status</h3>
              <div className="space-y-3">
                {chains.map((chain) => (
                  <div key={chain.chain} className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-white font-semibold">{chain.chain}</h4>
                        <p className="text-slate-400 text-sm">Block: #{chain.lastBlock.toLocaleString()}</p>
                      </div>
                      <Badge className={getStatusColor(chain.status)}>
                        {chain.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-slate-400 mb-1">Latency</p>
                        <p className="text-white font-semibold">{chain.latency}ms</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Block Time</p>
                        <p className="text-white font-semibold">{chain.blockTime}s</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Gas Price</p>
                        <p className="text-white font-semibold">{chain.gasPrice} Gwei</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Tx Success</p>
                        <p className="text-green-500 font-semibold">{chain.txSuccess}%</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm mt-3 pt-3 border-t border-slate-600">
                      <div>
                        <p className="text-slate-400 mb-1">Nodes</p>
                        <p className="text-white font-semibold">{chain.nodeCount}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Peers</p>
                        <p className="text-white font-semibold">{chain.peers}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Uptime</p>
                        <p className="text-green-500 font-semibold">{chain.uptime}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Latency Over Time</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={nodeMetrics.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="timestamp" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  {Array.from(new Set(nodeMetrics.map(m => m.chain))).slice(0, 3).map((chain, idx) => (
                    <Line
                      key={chain}
                      type="monotone"
                      dataKey="latency"
                      stroke={['#3b82f6', '#10b981', '#f59e0b'][idx]}
                      connectNulls
                      name={chain}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* Nodes Tab */}
          <TabsContent value="nodes" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">CPU Usage</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={nodeMetrics.slice(-15)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" angle={-45} height={80} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Bar dataKey="cpu" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Memory Usage</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={nodeMetrics.slice(-15)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" angle={-45} height={80} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Bar dataKey="memory" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">System Alerts</h3>
              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="text-slate-400">All systems operational</p>
                    </div>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="bg-slate-700 rounded-lg p-4 border-l-4" style={{
                      borderLeftColor: alert.severity === 'critical' ? '#ef4444' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6'
                    }}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-white font-semibold mb-1">{alert.title}</h4>
                          <p className="text-slate-400 text-sm mb-2">{alert.description}</p>
                          <div className="flex gap-2">
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            {alert.chain && <Badge variant="outline">{alert.chain}</Badge>}
                            <span className="text-slate-500 text-xs">{alert.timestamp}</span>
                          </div>
                        </div>
                        {alert.resolved && <CheckCircle className="text-green-500 h-5 w-5 ml-2 flex-shrink-0" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
