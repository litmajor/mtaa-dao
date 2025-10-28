import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Wallet, PieChart, Plus, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface InvestmentPool {
  id: string;
  name: string;
  symbol: string;
  description: string;
  totalValueLocked: string;
  shareTokenSupply: string;
  sharePrice: string;
  performanceFee: number;
  minimumInvestment: string;
  createdAt: string;
}

export default function InvestmentPools() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/investment-pools'],
    queryFn: async () => {
      const res = await fetch('/api/investment-pools', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch pools');
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">💎 Investment Pools</h1>
          <p className="text-white/70 text-lg">
            Pool funds and invest in top cryptocurrencies together
          </p>
        </div>

        {/* Info Banner */}
        <Card className="mb-8 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-500/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <PieChart className="w-12 h-12 text-purple-400 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Crypto Chama - Group Investment Made Easy
                </h3>
                <p className="text-white/80 mb-4">
                  Invest together with friends or your DAO in Bitcoin, Ethereum, and other top cryptocurrencies.
                  Each investment gives you shares representing your portion of the pool.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-2xl font-bold text-white">50/50</div>
                    <div className="text-sm text-white/70">BTC/ETH Split</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-2xl font-bold text-white">$10</div>
                    <div className="text-sm text-white/70">Minimum Investment</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-2xl font-bold text-white">2%</div>
                    <div className="text-sm text-white/70">Performance Fee</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pools Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.pools?.map((pool: InvestmentPool) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!data?.pools || data.pools.length === 0) && (
          <Card className="bg-white/10 border-white/20">
            <CardContent className="py-12 text-center">
              <Wallet className="w-16 h-16 text-white/50 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Investment Pools Yet</h3>
              <p className="text-white/70 mb-4">
                Be the first to create a multi-asset investment pool
              </p>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Pool
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PoolCard({ pool }: { pool: InvestmentPool }) {
  const tvl = Number(pool.totalValueLocked);
  const sharePrice = Number(pool.sharePrice);
  const minInvestment = Number(pool.minimumInvestment);
  
  // Mock performance data - will be replaced with real data
  const performance24h = 3.2;
  const isPositive = performance24h >= 0;

  return (
    <Link to={`/investment-pools/${pool.id}`}>
      <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-all hover:scale-105 cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-white text-xl">{pool.name}</CardTitle>
              <CardDescription className="text-white/60">{pool.symbol}</CardDescription>
            </div>
            <Badge className="bg-purple-600">Active</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-white/70 text-sm mb-4 line-clamp-2">
            {pool.description}
          </p>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-white/70 text-sm">Total Value Locked</span>
              <span className="text-white font-bold">${tvl.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-white/70 text-sm">Share Price</span>
              <span className="text-white font-bold">${sharePrice.toFixed(4)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-white/70 text-sm">24h Performance</span>
              <span className={`flex items-center gap-1 font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {isPositive ? '+' : ''}{performance24h}%
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-white/70 text-sm">Min. Investment</span>
              <span className="text-white font-semibold">${minInvestment.toFixed(2)}</span>
            </div>
          </div>

          <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
            <ArrowUpRight className="w-4 h-4 mr-2" />
            View Pool
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

