/**
 * DeFi DEX Analytics Page
 * Comprehensive visibility into Decentralized Exchange (DEX) liquidity and swap opportunities
 * Supports: Uniswap V3, Sushiswap, Ubeswap, and other adapters
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DEXInfo {
  id: string;
  name: string;
  chain: string;
  type: 'uniswap-v2' | 'uniswap-v3' | 'stable-swap';
  tvl?: number;
  volume24h?: number;
  fees?: number;
}

interface LiquidityPool {
  id: string;
  dex: string;
  token0: string;
  token1: string;
  liquidity: number;
  volume24h: number;
  feeTier?: string;
  apy?: number;
}

interface SwapOpportunity {
  fromToken: string;
  toToken: string;
  dex: string;
  priceImpact: number;
  estimatedOutput: number;
  gasEstimate: number;
  profitPotential?: number;
}

const DeFiDEXAnalytics: React.FC = () => {
  const [selectedChain, setSelectedChain] = useState<string>('ethereum');
  const [selectedDEX, setSelectedDEX] = useState<string>('all');
  const [searchToken, setSearchToken] = useState<string>('');

  // Fetch available DEXes
  const { data: dexList } = useQuery({
    queryKey: ['dex-list'],
    queryFn: async () => {
      return await apiGet<DEXInfo[]>('/api/dex/supported');
    },
  });

  // Fetch liquidity pools for selected chain
  const { data: pools, isLoading: poolsLoading } = useQuery({
    queryKey: ['dex-pools', selectedChain, selectedDEX],
    queryFn: async () => {
      const params = new URLSearchParams({
        chain: selectedChain,
        ...(selectedDEX !== 'all' && { dex: selectedDEX }),
      });
      return await apiGet<LiquidityPool[]>(`/api/dex/pools?${params}`);
    },
  });

  // Fetch swap opportunities
  const { data: opportunities } = useQuery({
    queryKey: ['swap-opportunities', selectedChain],
    queryFn: async () => {
      return await apiGet<SwapOpportunity[]>(`/api/dex/opportunities?chain=${selectedChain}`);
    },
    gcTime: 60 * 1000, // 1 minute - opportunities change frequently
  });

  // Calculate chain TVL
  const totalTVL = pools?.reduce((sum, pool) => sum + (pool.liquidity || 0), 0) || 0;
  const total24hVolume = pools?.reduce((sum, pool) => sum + (pool.volume24h || 0), 0) || 0;

  // DEX breakdown
  const dexBreakdown = pools?.reduce((acc, pool) => {
    const existing = acc.find(d => d.name === pool.dex);
    if (existing) {
      existing.value += pool.liquidity;
    } else {
      acc.push({ name: pool.dex, value: pool.liquidity });
    }
    return acc;
  }, [] as Array<{ name: string; value: number }>) || [];

  // Top pools by volume
  const topPools = pools
    ?.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
    .slice(0, 10) || [];

  // Filter pools by search
  const filteredPools = pools?.filter(
    pool =>
      !searchToken ||
      pool.token0.toLowerCase().includes(searchToken.toLowerCase()) ||
      pool.token1.toLowerCase().includes(searchToken.toLowerCase())
  ) || [];

  const COLORS = [
    '#3b82f6',
    '#ef4444',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              DeFi DEX Analytics
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Real-time liquidity pools, swap opportunities, and DEX performance across multiple chains
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
              Select Chain
            </label>
            <Select value={selectedChain} onValueChange={setSelectedChain}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ethereum">Ethereum</SelectItem>
                <SelectItem value="polygon">Polygon</SelectItem>
                <SelectItem value="arbitrum">Arbitrum</SelectItem>
                <SelectItem value="optimism">Optimism</SelectItem>
                <SelectItem value="celo">Celo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
              Filter DEX
            </label>
            <Select value={selectedDEX} onValueChange={setSelectedDEX}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All DEXes</SelectItem>
                {dexList?.map(dex => (
                  <SelectItem key={dex.id} value={dex.id}>
                    {dex.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
              Search Tokens
            </label>
            <Input
              placeholder="Search token pair..."
              value={searchToken}
              onChange={e => setSearchToken(e.target.value)}
              className="w-full"
            />
          </div>

          <Button
            variant="outline"
            size="lg"
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <span>🔄</span>
            Refresh
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Total TVL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                ${(totalTVL / 1e9).toFixed(2)}B
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Total Value Locked
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                24h Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                ${(total24hVolume / 1e9).toFixed(2)}B
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Trading Volume
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Active Pools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {pools?.length || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Liquidity Pools
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pools" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pools">Pools</TabsTrigger>
            <TabsTrigger value="dex-breakdown">DEX Breakdown</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          </TabsList>

          {/* Liquidity Pools Tab */}
          <TabsContent value="pools" className="space-y-4">
            <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle>Top Liquidity Pools</CardTitle>
                <CardDescription>Highest volume pools for token swaps</CardDescription>
              </CardHeader>
              <CardContent>
                {poolsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-200 dark:border-slate-700">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                            Pair
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                            DEX
                          </th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-white">
                            Liquidity
                          </th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-white">
                            24h Volume
                          </th>
                          {topPools[0]?.feeTier && (
                            <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-white">
                              Fee Tier
                            </th>
                          )}
                          {topPools[0]?.apy !== undefined && (
                            <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-white">
                              APY
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPools.slice(0, 20).map((pool, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-gray-900 dark:text-white">
                                  {pool.token0}/{pool.token1}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {pool.dex}
                                </Badge>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                              {pool.dex}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                              ${(pool.liquidity / 1e6).toFixed(1)}M
                            </td>
                            <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                              ${(pool.volume24h / 1e6).toFixed(1)}M
                            </td>
                            {pool.feeTier && (
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                                {pool.feeTier}
                              </td>
                            )}
                            {pool.apy !== undefined && (
                              <td className="py-3 px-4 text-right font-semibold text-green-600 dark:text-green-400">
                                {pool.apy.toFixed(2)}%
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DEX Breakdown Tab */}
          <TabsContent value="dex-breakdown" className="space-y-4">
            <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle>DEX Market Share</CardTitle>
                <CardDescription>TVL distribution across DEXes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dexBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) =>
                          `${name}: $${(value / 1e6).toFixed(0)}M`
                        }
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {dexBreakdown.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) =>
                          `$${(value / 1e6).toFixed(2)}M`
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dexBreakdown.map((dex, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg border border-gray-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {/* stylelint-disable-next-line */}
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: COLORS[idx % COLORS.length],
                          }}
                        ></div>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {dex.name}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        ${(dex.value / 1e9).toFixed(2)}B
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {((dex.value / totalTVL) * 100).toFixed(1)}% of total TVL
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Swap Opportunities Tab */}
          <TabsContent value="opportunities" className="space-y-4">
            <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
              <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📈</span>
                Arbitrage Opportunities
              </CardTitle>
                <CardDescription>
                  Profitable swap routes with minimal slippage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!opportunities || opportunities.length === 0 ? (
                  <div className="flex items-center gap-3 py-8 text-gray-500 dark:text-gray-400">
                    <span className="text-xl">ℹ️</span>
                    <span>No significant opportunities currently available</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {opportunities.map((opp, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {opp.fromToken} → {opp.toToken}
                          </div>
                          <Badge className="bg-green-600 hover:bg-green-700">
                            {opp.dex}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600 dark:text-gray-400">
                              Price Impact
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {opp.priceImpact.toFixed(3)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 dark:text-gray-400">
                              Gas Estimate
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              ${opp.gasEstimate.toFixed(2)}
                            </div>
                          </div>
                          {opp.profitPotential !== undefined && (
                            <div>
                              <div className="text-gray-600 dark:text-gray-400">
                                Profit Potential
                              </div>
                              <div className="font-semibold text-green-600 dark:text-green-400">
                                ${opp.profitPotential.toFixed(2)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Supported DEXes Info */}
        <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle>Supported DEX Adapters</CardTitle>
            <CardDescription>
              Multi-chain DEX integration for optimal routing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dexList?.map(dex => (
                <div
                  key={dex.id}
                  className="p-4 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {dex.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {dex.chain.charAt(0).toUpperCase() + dex.chain.slice(1)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {dex.type.replace('-', ' ').toUpperCase()}
                    </Badge>
                  </div>

                  {dex.tvl && (
                    <div className="text-sm mt-3">
                      <div className="text-gray-600 dark:text-gray-400">TVL</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        ${(dex.tvl / 1e9).toFixed(2)}B
                      </div>
                    </div>
                  )}

                  {dex.volume24h && (
                    <div className="text-sm mt-2">
                      <div className="text-gray-600 dark:text-gray-400">24h Vol</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        ${(dex.volume24h / 1e9).toFixed(2)}B
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeFiDEXAnalytics;
