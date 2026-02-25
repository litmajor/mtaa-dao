/**
 * Admin - API Usage Analytics
 * Track API endpoint usage, performance, rate limits, and developer metrics
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Zap, AlertCircle, TrendingUp, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface APIEndpoint {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  calls: number;
  avgResponseTime: number;
  errorRate: number;
  status: 'healthy' | 'warning' | 'critical';
  rateLimit: number;
  remaining: number;
  lastHour: number;
}

interface APIUsageMetric {
  timestamp: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
}

interface DeveloperUsage {
  apiKey: string;
  calls: number;
  errorCount: number;
  lastUsed: string;
  status: 'active' | 'inactive' | 'suspended';
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function AdminAPIUsage() {
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [usage, setUsage] = useState<APIUsageMetric[]>([]);
  const [developers, setDevelopers] = useState<DeveloperUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchAPIData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const [endpointsRes, usageRes, devsRes] = await Promise.all([
        fetch('/api/admin/api-usage/endpoints', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/api-usage/metrics', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/api-usage/developers', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (endpointsRes.ok) {
        const data = await endpointsRes.json();
        setEndpoints(data.endpoints || []);
      }

      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data.metrics || []);
      }

      if (devsRes.ok) {
        const data = await devsRes.json();
        setDevelopers(data.developers || []);
      }
    } catch (error) {
      console.error('Failed to fetch API usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAPIData();
    const interval = setInterval(fetchAPIData, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-600';
      case 'warning': return 'bg-yellow-600';
      case 'critical': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const totalRequests = usage.reduce((sum, u) => sum + u.totalRequests, 0);
  const totalErrors = usage.reduce((sum, u) => sum + u.failedRequests, 0);
  const avgResponseTime = (usage.reduce((sum, u) => sum + u.avgResponseTime, 0) / (usage.length || 1)).toFixed(2);
  const overallErrorRate = ((totalErrors / (totalRequests || 1)) * 100).toFixed(2);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">API Usage Analytics</h1>
            <p className="text-slate-400">Monitor API endpoints, performance, and developer usage</p>
          </div>
          <Button
            onClick={fetchAPIData}
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
            <p className="text-slate-400 text-sm mb-2">Total Requests</p>
            <p className="text-3xl font-bold text-white">{totalRequests.toLocaleString()}</p>
            <p className="text-slate-400 text-sm mt-2">All time</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Error Rate</p>
            <p className={`text-3xl font-bold ${parseFloat(overallErrorRate) < 1 ? 'text-green-500' : 'text-red-500'}`}>
              {overallErrorRate}%
            </p>
            <p className="text-slate-400 text-sm mt-2">{totalErrors} errors</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Avg Response Time</p>
            <p className="text-3xl font-bold text-white">{avgResponseTime}ms</p>
            <p className="text-slate-400 text-sm mt-2">Average latency</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Active Developers</p>
            <p className="text-3xl font-bold text-blue-500">
              {developers.filter(d => d.status === 'active').length}/{developers.length}
            </p>
            <p className="text-slate-400 text-sm mt-2">Using API keys</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="developers">Developers</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Request Volume Trend</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={usage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="timestamp" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Line type="monotone" dataKey="totalRequests" stroke="#3b82f6" name="Total" />
                  <Line type="monotone" dataKey="successfulRequests" stroke="#10b981" name="Successful" />
                  <Line type="monotone" dataKey="failedRequests" stroke="#ef4444" name="Failed" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Request Status Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Successful', value: usage.reduce((s, u) => s + u.successfulRequests, 0) },
                        { name: 'Failed', value: usage.reduce((s, u) => s + u.failedRequests, 0) }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Response Time Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={usage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Legend />
                    <Line type="monotone" dataKey="avgResponseTime" stroke="#f59e0b" name="Avg" />
                    <Line type="monotone" dataKey="p95ResponseTime" stroke="#ef4444" name="P95" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Endpoints Tab */}
          <TabsContent value="endpoints" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Endpoint Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Endpoint</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Method</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Calls (24h)</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Avg Response</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Error Rate</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Rate Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoints.map((endpoint) => (
                      <tr key={endpoint.endpoint} className="border-b border-slate-700 hover:bg-slate-700 transition">
                        <td className="py-3 px-4 text-white font-mono text-xs">{endpoint.endpoint}</td>
                        <td className="py-3 px-4 text-white">
                          <Badge variant="outline" className="bg-blue-600/20">{endpoint.method}</Badge>
                        </td>
                        <td className="py-3 px-4 text-white">{endpoint.calls.toLocaleString()}</td>
                        <td className="py-3 px-4 text-white">{endpoint.avgResponseTime}ms</td>
                        <td className={`py-3 px-4 ${endpoint.errorRate > 1 ? 'text-red-400' : 'text-green-400'}`}>
                          {endpoint.errorRate.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={getStatusColor(endpoint.status)}>
                            {endpoint.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {endpoint.remaining}/{endpoint.rateLimit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Top Endpoints by Call Volume</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={endpoints.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="endpoint" stroke="#94a3b8" angle={-45} height={100} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Bar dataKey="calls" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Endpoint Error Rates</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={endpoints.filter(e => e.errorRate > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="endpoint" stroke="#94a3b8" angle={-45} height={100} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Bar dataKey="errorRate" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* Developers Tab */}
          <TabsContent value="developers" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Developer API Usage</h3>
              <div className="space-y-3">
                {developers.map((dev) => (
                  <div key={dev.apiKey} className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-white font-mono text-sm">{dev.apiKey}</p>
                        <p className="text-slate-400 text-xs">Last used: {dev.lastUsed}</p>
                      </div>
                      <Badge className={
                        dev.status === 'active' ? 'bg-green-600' :
                        dev.status === 'inactive' ? 'bg-yellow-600' : 'bg-red-600'
                      }>
                        {dev.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-slate-400 mb-1">Calls</p>
                        <p className="text-white font-semibold">{dev.calls.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Errors</p>
                        <p className={`font-semibold ${dev.errorCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {dev.errorCount}
                        </p>
                      </div>
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
