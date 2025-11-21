import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Wallet, PieChart, Plus, ArrowUpRight, Crown, AlertTriangle, RefreshCw, Lock, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useWallet } from './hooks/useWallet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
  // Web3 fields
  poolAddress?: string;
  tokenAddress?: string;
  chainId?: number;
  members?: number;
  apy?: string;
}

export default function InvestmentPools() {
  const { address, isConnected, chainId } = useAccount();
  const { connectMetaMask, connectValora, connectMiniPay, isLoading: isConnecting } = useWallet();
  const [filter, setFilter] = useState<'all' | 'my' | 'joined'>('all');
  const [showWalletConnect, setShowWalletConnect] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/investment-pools', { chainId, userAddress: address }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (chainId) params.append('chainId', chainId.toString());
      if (address) params.append('userAddress', address);
      
      const res = await fetch(`/api/investment-pools?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch pools');
      return res.json();
    },
    enabled: isConnected, // Only fetch when wallet is connected
  });

  // Show wallet connection prompt if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
          <Crown className="w-16 h-16 mx-auto mb-4 text-purple-400" />
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">
            <strong>Web3 Required:</strong> Investment pools are secured on-chain. Choose your preferred wallet provider.
          </p>
          
          <div className="space-y-2 mb-6">
            <Button 
              onClick={connectMetaMask} 
              disabled={isConnecting}
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
            >
              {isConnecting ? 'Connecting...' : '🦊 MetaMask'}
            </Button>
            <Button 
              onClick={connectValora}
              disabled={isConnecting}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            >
              {isConnecting ? 'Connecting...' : '💳 Valora'}
            </Button>
            <Button 
              onClick={connectMiniPay}
              disabled={isConnecting}
              className="w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
            >
              {isConnecting ? 'Connecting...' : '💰 MiniPay'}
            </Button>
            <Button 
              disabled={isConnecting}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {isConnecting ? 'Connecting...' : '🔐 Internal Wallet'}
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            Your wallet will hold your pool shares and manage all transactions transparently on the blockchain.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Wallet Status */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">💰 Investment Pools</h1>
            <p className="text-white/70 text-lg">
              Pool assets with friends on-chain. Transparent, secure, and decentralized.
            </p>
          </div>
          <div className="text-right">
            <Badge className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white mb-2 flex items-center gap-2 w-fit ml-auto">
              <Lock className="w-3 h-3" />
              ✓ Web3 Connected
            </Badge>
            <p className="text-white/60 text-sm font-mono mb-1">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
            <Badge className="bg-blue-500/30 text-blue-200">Chain ID: {chainId}</Badge>
          </div>
        </div>

        {/* Info Banner - Web3 Features */}
        <Card className="mb-8 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-500/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Zap className="w-12 h-12 text-purple-400 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-bold text-white mb-3">
                  On-Chain Investment Pools
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white/10 rounded-lg p-3 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-sm text-white/70">Smart Contracts</div>
                      <div className="font-bold text-white">Self-Custody</div>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="text-sm text-white/70">Pooled Capital</div>
                      <div className="font-bold text-white">Group Investments</div>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-yellow-400" />
                    <div>
                      <div className="text-sm text-white/70">Share Tokens</div>
                      <div className="font-bold text-white">Transparent Returns</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8">
          {[
            { value: 'all' as const, label: 'All Pools', icon: PieChart },
            { value: 'joined' as const, label: 'Joined Pools', icon: Users },
            { value: 'my' as const, label: 'My Pools', icon: Lock },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                filter === value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Pools Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : error ? (
          <Card className="bg-red-500/20 border-red-500/50">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Error Loading Pools</h3>
              <p className="text-white/70 mb-6">{(error as Error).message}</p>
              <Button variant="outline" className="border-white/30">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
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
            <CardContent className="py-12 text-center max-w-2xl mx-auto">
              <Lock className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-3">No On-Chain Pools Yet</h3>
              <p className="text-white/70 mb-2">
                You haven't joined or created any investment pools yet. 
              </p>
              <p className="text-white/60 text-sm mb-6 font-mono">
                Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
              <div className="bg-white/5 rounded-lg p-6 mb-6 border border-white/10">
                <p className="text-white/80 mb-4">
                  Investment pools allow you and your friends to pool capital on-chain. Each participant receives share tokens representing their stake.
                </p>
                <ul className="text-white/70 text-sm space-y-2 text-left">
                  <li>✓ Pool assets are held in audited smart contracts</li>
                  <li>✓ You control your share tokens directly from your wallet</li>
                  <li>✓ Transparent, immutable transaction history on-chain</li>
                  <li>✓ Decentralized governance for pool management</li>
                </ul>
              </div>
              <div className="flex gap-3 justify-center">
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Pool
                </Button>
                <Button variant="outline" className="border-white/30">
                  Browse Pools
                </Button>
              </div>
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
  const apy = pool.apy ? parseFloat(pool.apy) : 8.5;
  const members = pool.members || 0;

  return (
    <Link to={`/investment-pools/${pool.id}`}>
      <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-all hover:scale-105 cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-white text-xl flex items-center gap-2">
                {pool.name}
                {pool.poolAddress && (
                  <Lock className="w-4 h-4 text-emerald-400" title="On-Chain Pool" />
                )}
              </CardTitle>
              <CardDescription className="text-white/60 font-mono text-xs">
                {pool.poolAddress ? `${pool.poolAddress.slice(0, 6)}...${pool.poolAddress.slice(-4)}` : pool.symbol}
              </CardDescription>
            </div>
            <Badge className="bg-gradient-to-r from-purple-600 to-blue-600">Active</Badge>
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
              <span className="text-white/70 text-sm">Annual Yield (APY)</span>
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <TrendingUp className="w-4 h-4" />
                {apy}%
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-white/70 text-sm">Pool Members</span>
              <span className="text-white font-semibold flex items-center gap-1">
                <Users className="w-3 h-3" />
                {members}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-white/70 text-sm">Min. Investment</span>
              <span className="text-purple-300 font-semibold">${minInvestment.toFixed(2)}</span>
            </div>
          </div>

          <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Participate in Pool
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

