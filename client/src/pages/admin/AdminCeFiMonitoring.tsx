/**
 * Admin - CeFi Monitoring
 * Track centralized exchange integrations, balances, and trading activity
 */

import React, { useState, useEffect } from 'react';
import ChartJS from '@/components/charts/ChartJSSetup';
import { Chart } from 'react-chartjs-2';
import { CheckCircle, TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {authClient} from '@/utils/authClient';

interface ExchangeStatus {
  exchange: string;
  status: 'connected' | 'disconnected' | 'error';
  totalBalance: number;
  tradingVolume24h: number;
  activeAccounts: number;
  feesCollected: number;
  lastSync: string;
}

interface TradingMetric {
  date: string;
  volume: number;
  trades: number;
  fees: number;
}

export default function AdminCeFiMonitoring() {
  const [exchanges, setExchanges] = useState<ExchangeStatus[]>([]);
  const [tradingData, setTradingData] = useState<TradingMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('exchanges');

  const fetchCeFiData = async () => {
    try {
      setLoading(true);

      const [exchangesData, tradingData] = await Promise.all([
        authClient.get('/api/admin/cefi/exchanges'),
        authClient.get('/api/admin/cefi/trading-metrics'),
      ]);

      setExchanges(exchangesData.exchanges || []);
      setTradingData(tradingData.metrics || []);
    } catch (error) {
      console.error('Failed to fetch CeFi data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCeFiData();
    const interval = setInterval(fetchCeFiData, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalBalance = exchanges.reduce((sum, e) => sum + e.totalBalance, 0);
  const totalVolume = exchanges.reduce((sum, e) => sum + e.tradingVolume24h, 0);
  const connectedExchanges = exchanges.filter(e => e.status === 'connected').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">CeFi Exchange Monitoring</h1>
            <p className="text-slate-400">Track connected exchanges, trading volume, and account activity</p>
          </div>
          <Button
            onClick={fetchCeFiData}
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
            <p className="text-slate-400 text-sm mb-2">Connected Exchanges</p>
            <p className="text-3xl font-bold text-white">{connectedExchanges}/{exchanges.length}</p>
            <p className="text-green-500 text-sm mt-2">All systems operational</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Total Exchange Balance</p>
            <p className="text-3xl font-bold text-white">${(totalBalance / 1000000).toFixed(2)}M</p>
            <p className="text-slate-400 text-sm mt-2">Across all accounts</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Trading Volume (24h)</p>
            <p className="text-3xl font-bold text-white">${(totalVolume / 1000000).toFixed(2)}M</p>
            <p className="text-green-500 text-sm mt-2">+8.2% vs yesterday</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800">
            <TabsTrigger value="exchanges">Exchange Status</TabsTrigger>
            <TabsTrigger value="analytics">Trading Analytics</TabsTrigger>
          </TabsList>

          {/* Exchanges Tab */}
          <TabsContent value="exchanges" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Connected Exchanges</h3>
              <div className="space-y-4">
                {exchanges.map((exchange) => (
                  <div key={exchange.exchange} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {exchange.status === 'connected' && <CheckCircle className="h-5 w-5 text-green-500" />}
                          {exchange.status !== 'connected' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                          <p className="font-semibold text-white capitalize">{exchange.exchange}</p>
                        </div>
                        <p className="text-xs text-slate-400">Last sync: {exchange.lastSync}</p>
                      </div>
                      <Badge className={exchange.status === 'connected' ? 'bg-green-600' : exchange.status === 'disconnected' ? 'bg-yellow-600' : 'bg-red-600'}>
                        {exchange.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">Balance</p>
                        <p className="text-white font-semibold">${(exchange.totalBalance / 1000000).toFixed(2)}M</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Volume (24h)</p>
                        <p className="text-white font-semibold">${(exchange.tradingVolume24h / 1000000).toFixed(2)}M</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Accounts</p>
                        <p className="text-white font-semibold">{exchange.activeAccounts}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Fees Collected</p>
                        <p className="text-green-500 font-semibold">${(exchange.feesCollected / 1000).toFixed(2)}K</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Trading Volume Trend</h3>
                <div style={{ height: 300 }}>
                  <Chart
                    type="line"
                    data={{ labels: tradingData.map(t => t.date), datasets: [{ label: 'Volume', data: tradingData.map(t => t.volume), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.06)', tension: 0.2, pointRadius: 2 }] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                  />
                </div>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Trades & Fees</h3>
                <div style={{ height: 300 }}>
                  <Chart
                    type="bar"
                    data={{ labels: tradingData.map(t => t.date), datasets: [{ label: 'Trades', data: tradingData.map(t => t.trades), backgroundColor: '#3b82f6' }, { label: 'Fees', data: tradingData.map(t => t.fees), backgroundColor: '#10b981' }] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }}
                  />
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
