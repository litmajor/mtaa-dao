/**
 * Admin - Payment Providers Monitoring
 * Track payment provider integrations, transaction status, and settlement
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CreditCard, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PaymentProvider {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  apiStatus: boolean;
  webhook: boolean;
  transactions24h: number;
  volume24h: number;
  successRate: number;
  avgProcessingTime: number;
  failedTransactions: number;
  pendingSettlement: number;
  settled: number;
  totalFees: number;
  feeRate: number;
  lastUpdated: string;
}

interface TransactionStat {
  status: 'success' | 'pending' | 'failed' | 'refunded';
  count: number;
  volume: number;
}

interface SettlementLog {
  provider: string;
  date: string;
  amount: number;
  fee: number;
  status: 'completed' | 'pending' | 'delayed';
  transactions: number;
}

const PROVIDER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdminPaymentProviders() {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [stats, setStats] = useState<TransactionStat[]>([]);
  const [settlements, setSettlements] = useState<SettlementLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchPaymentData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const [providersRes, statsRes, settlementsRes] = await Promise.all([
        fetch('/api/admin/payments/providers', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/payments/transaction-stats', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/admin/payments/settlements', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data.providers || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats || []);
      }

      if (settlementsRes.ok) {
        const data = await settlementsRes.json();
        setSettlements(data.settlements || []);
      }
    } catch (error) {
      console.error('Failed to fetch payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentData();
    const interval = setInterval(fetchPaymentData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-600';
      case 'error': return 'bg-red-600';
      case 'maintenance': return 'bg-yellow-600';
      default: return 'bg-slate-600';
    }
  };

  const totalTransactions = stats.reduce((sum, s) => sum + s.count, 0);
  const totalVolume = providers.reduce((sum, p) => sum + p.volume24h, 0);
  const activeProviders = providers.filter(p => p.status === 'active').length;
  const avgSuccessRate = (providers.reduce((sum, p) => sum + p.successRate, 0) / (providers.length || 1)).toFixed(2);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Payment Providers</h1>
            <p className="text-slate-400">Monitor payment integrations, transactions, and settlements</p>
          </div>
          <Button
            onClick={fetchPaymentData}
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
            <p className="text-slate-400 text-sm mb-2">Active Providers</p>
            <p className="text-3xl font-bold text-green-500">{activeProviders}/{providers.length}</p>
            <p className="text-slate-400 text-sm mt-2">Payment services</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Transactions (24h)</p>
            <p className="text-3xl font-bold text-white">{totalTransactions.toLocaleString()}</p>
            <p className="text-slate-400 text-sm mt-2">Total transactions</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Volume (24h)</p>
            <p className="text-3xl font-bold text-white">${(totalVolume / 1000000).toFixed(2)}M</p>
            <p className="text-slate-400 text-sm mt-2">Transaction volume</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Avg Success Rate</p>
            <p className="text-3xl font-bold text-blue-500">{avgSuccessRate}%</p>
            <p className="text-slate-400 text-sm mt-2">All providers</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
            <TabsTrigger value="settlements">Settlements</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Transaction Status Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ status, count }) => `${status}: ${count}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {stats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PROVIDER_COLORS[index % PROVIDER_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Provider Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={providers.slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" angle={-45} height={80} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Bar dataKey="volume24h" fill="#3b82f6" name="Volume" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Providers Tab */}
          <TabsContent value="providers" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Payment Provider Status</h3>
              <div className="space-y-3">
                {providers.map((provider) => (
                  <div key={provider.id} className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-blue-400" />
                          <h4 className="text-lg font-semibold text-white">{provider.name}</h4>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getStatusColor(provider.status)}>
                          {provider.status.toUpperCase()}
                        </Badge>
                        {provider.apiStatus ? (
                          <Badge className="bg-green-600">API ✓</Badge>
                        ) : (
                          <Badge className="bg-red-600">API ✗</Badge>
                        )}
                        {provider.webhook ? (
                          <Badge className="bg-green-600">Webhook ✓</Badge>
                        ) : (
                          <Badge className="bg-red-600">Webhook ✗</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-slate-400 mb-1">Transactions (24h)</p>
                        <p className="text-white font-semibold">{provider.transactions24h}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Volume (24h)</p>
                        <p className="text-white font-semibold">${(provider.volume24h / 1000000).toFixed(2)}M</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Success Rate</p>
                        <p className={`font-semibold ${provider.successRate >= 99 ? 'text-green-500' : 'text-yellow-500'}`}>
                          {provider.successRate}%
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Avg Process Time</p>
                        <p className="text-white font-semibold">{provider.avgProcessingTime}s</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-sm pt-3 border-t border-slate-600">
                      <div>
                        <p className="text-slate-400 mb-1">Failed</p>
                        <p className="text-red-400 font-semibold">{provider.failedTransactions}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Pending</p>
                        <p className="text-yellow-400 font-semibold">{provider.pendingSettlement}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Settled</p>
                        <p className="text-green-400 font-semibold">{provider.settled}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Fee Rate</p>
                        <p className="text-white font-semibold">{provider.feeRate}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Updated</p>
                        <p className="text-slate-300 text-xs">{provider.lastUpdated}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Transaction Breakdown</h3>
              <div className="space-y-3">
                {stats.map((stat) => {
                  const percentage = (stat.count / totalTransactions * 100).toFixed(1);
                  const statusColor = {
                    success: '#10b981',
                    pending: '#f59e0b',
                    failed: '#ef4444',
                    refunded: '#3b82f6'
                  }[stat.status];

                  return (
                    <div key={stat.status} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-white font-medium capitalize">{stat.status}</span>
                        <div className="flex gap-4">
                          <span className="text-slate-400">{stat.count.toLocaleString()} txns</span>
                          <span className="text-white font-semibold">${(stat.volume / 1000000).toFixed(2)}M</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3">
                        <div
                          className="h-3 rounded-full"
                          style={{ width: `${percentage}%`, backgroundColor: statusColor }}
                        />
                      </div>
                      <p className="text-slate-400 text-sm">{percentage}% of total</p>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Success Rate by Provider</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={providers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" angle={-45} height={80} />
                  <YAxis stroke="#94a3b8" domain={[95, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Bar dataKey="successRate" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* Settlements Tab */}
          <TabsContent value="settlements" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Settlement History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Provider</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Amount</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Fee</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Transactions</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((settlement, idx) => (
                      <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700 transition">
                        <td className="py-3 px-4 text-white font-semibold">{settlement.provider}</td>
                        <td className="py-3 px-4 text-white">{settlement.date}</td>
                        <td className="py-3 px-4 text-white">${(settlement.amount / 1000000).toFixed(2)}M</td>
                        <td className="py-3 px-4 text-white">${(settlement.fee / 1000).toFixed(2)}K</td>
                        <td className="py-3 px-4 text-white">{settlement.transactions}</td>
                        <td className="py-3 px-4">
                          <Badge className={
                            settlement.status === 'completed' ? 'bg-green-600' :
                            settlement.status === 'pending' ? 'bg-yellow-600' : 'bg-red-600'
                          }>
                            {settlement.status.toUpperCase()}
                          </Badge>
                        </td>
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
