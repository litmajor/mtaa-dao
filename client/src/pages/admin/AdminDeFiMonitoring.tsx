/**
 * Admin - DeFi Monitoring
 * Track DeFi integrations, yield farming, liquidity pools, and protocol performance
 */

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle, TrendingUp, Lock, Zap, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';

interface DeFiProtocol {
  name: string;
  status: 'active' | 'paused' | 'error';
  tvl: number;
  apy: number;
  userCount: number;
  totalDeposits: number;
  lastSync: string;
}

interface LiquidityPool {
  symbol: string;
  balance0: number;
  balance1: number;
  liquidity: number;
  volume24h: number;
  fees24h: number;
  status: 'healthy' | 'warning' | 'critical';
}

export default function AdminDeFiMonitoring() {
  const [protocols, setProtocols] = useState<DeFiProtocol[]>([]);
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('protocols');

  const fetchDeFiData = async () => {
    try {
      setLoading(true);

      const [protocolsData, poolsData] = await Promise.all([
        authClient.get('/api/admin/defi/protocols'),
        authClient.get('/api/admin/defi/liquidity-pools'),
      ]);

      setProtocols(protocolsData.protocols || []);
      setPools(poolsData.pools || []);
    } catch (error) {
      console.error('Failed to fetch DeFi data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeFiData();
    const interval = setInterval(fetchDeFiData, 60000); // Every minute
    return () => clearInterval(interval);
  }, []);

  const defiData = [
    { date: 'Mon', tvl: 2400, apy: 5.2 },
    { date: 'Tue', tvl: 2210, apy: 5.4 },
    { date: 'Wed', tvl: 2290, apy: 5.1 },
    { date: 'Thu', tvl: 2000, apy: 5.3 },
    { date: 'Fri', tvl: 2181, apy: 5.5 },
    { date: 'Sat', tvl: 2500, apy: 5.2 },
    { date: 'Sun', tvl: 2100, apy: 5.4 },
  ];

  const totalTVL = protocols.reduce((sum, p) => sum + p.tvl, 0);
  const averageAPY = protocols.length > 0 ? (protocols.reduce((sum, p) => sum + p.apy, 0) / protocols.length).toFixed(2) : '0';

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">DeFi Monitoring</h1>
            <p className="text-slate-400">Track protocol health, liquidity pools, and yield farming</p>
          </div>
          <Button
            onClick={fetchDeFiData}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Total TVL</p>
            <p className="text-3xl font-bold text-white">${(totalTVL / 1000000).toFixed(2)}M</p>
            <p className="text-green-500 text-sm mt-2">+12.5% vs last week</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Average APY</p>
            <p className="text-3xl font-bold text-white">{averageAPY}%</p>
            <p className="text-slate-400 text-sm mt-2">Across all protocols</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Active Protocols</p>
            <p className="text-3xl font-bold text-white">{protocols.filter(p => p.status === 'active').length}/{protocols.length}</p>
            <p className="text-slate-400 text-sm mt-2">Protocol integration status</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="protocols">Protocols</TabsTrigger>
            <TabsTrigger value="pools">Liquidity Pools</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Protocols Tab */}
          <TabsContent value="protocols" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">DeFi Protocol Integration Status</h3>
              <div className="space-y-4">
                {protocols.map((protocol) => (
                  <div key={protocol.name} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {protocol.status === 'active' && <CheckCircle className="h-5 w-5 text-green-500" />}
                          {protocol.status !== 'active' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                          <p className="font-semibold text-white">{protocol.name}</p>
                        </div>
                        <p className="text-xs text-slate-400">Last sync: {protocol.lastSync}</p>
                      </div>
                      <Badge className={protocol.status === 'active' ? 'bg-green-600' : protocol.status === 'paused' ? 'bg-yellow-600' : 'bg-red-600'}>
                        {protocol.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">TVL</p>
                        <p className="text-white font-semibold">${(protocol.tvl / 1000000).toFixed(2)}M</p>
                      </div>
                      <div>
                        <p className="text-slate-400">APY</p>
                        <p className="text-white font-semibold text-green-500">{protocol.apy}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Users</p>
                        <p className="text-white font-semibold">{protocol.userCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Deposits</p>
                        <p className="text-white font-semibold">${(protocol.totalDeposits / 1000000).toFixed(2)}M</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Pools Tab */}
          <TabsContent value="pools" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Liquidity Pool Health</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Pair</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Liquidity</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Volume (24h)</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Fees (24h)</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pools.map((pool) => (
                      <tr key={pool.symbol} className="border-b border-slate-700 hover:bg-slate-700 transition">
                        <td className="py-3 px-4 text-white font-semibold">{pool.symbol}</td>
                        <td className="py-3 px-4 text-white">${(pool.liquidity / 1000000).toFixed(2)}M</td>
                        <td className="py-3 px-4 text-white">${(pool.volume24h / 1000000).toFixed(2)}M</td>
                        <td className="py-3 px-4 text-green-500 font-semibold">${(pool.fees24h / 1000).toFixed(2)}K</td>
                        <td className="py-3 px-4">
                          <Badge className={
                            pool.status === 'healthy' ? 'bg-green-600' :
                            pool.status === 'warning' ? 'bg-yellow-600' : 'bg-red-600'
                          }>
                            {pool.status.toUpperCase()}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">TVL & APY Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={defiData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Line type="monotone" dataKey="tvl" stroke="#3b82f6" name="TVL (M)" />
                  <Line type="monotone" dataKey="apy" stroke="#10b981" name="Avg APY (%)" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
