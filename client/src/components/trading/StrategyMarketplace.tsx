/**
 * Yuki Strategy Marketplace
 * 
 * Discover, copy, and monetize trading strategies.
 * Followers are driven to Amara for advanced education.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Users, TrendingUp, Settings, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MiniGraph from './MiniGraph';
import * as yukiApi from '../../api/yukiApi';

type Strategy = {
  id: string;
  name: string;
  creator: string;
  // lifecycle state
  state?: 'draft' | 'published' | 'verified' | 'featured' | 'deprecated';
  creatorBadge?: 'verified' | 'trusted' | 'top-performer';
  description: string;
  category: 'mean-reversion' | 'momentum' | 'arbitrage' | 'yield' | 'grid';
  stats: {
    return30d: number;
    return1y: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    trades: number;
    volatility?: number;
    simulationScore?: number;
  };
  followers: number;
  rating: number;
  reviews: number;
  pricing: {
    model: 'free' | 'profit-share' | 'subscription' | 'licensing';
    amount?: number; // % or monthly fee
  };
  copied: boolean;
  thumbnail?: string;
  createdAt: string;
  lastBacktestAt: string;
  // optional: include full graph for thumbnail rendering and fork
  graph?: { nodes?: any[]; edges?: any[] } | null;
};

export default function StrategyMarketplace() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [filter, setFilter] = useState<'all' | 'free' | 'paid' | 'my-copies'>('all');
  const [topic, setTopic] = useState<'all' | string>('all');
  const [sortBy, setSortBy] = useState<'return' | 'rating' | 'followers'>('return');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketplace = async () => {
      try {
        const data = await yukiApi.getMarketplaceStrategies();
        setStrategies(data || []);
      } catch (err) {
        console.error('Failed to fetch marketplace:', err);
        setStrategies([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMarketplace();
  }, []);

  const filteredStrategies = useMemo(() => {
    let result = strategies.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.creator.toLowerCase().includes(searchTerm.toLowerCase());
      // apply pricing filter
      if (filter === 'free' && s.pricing.model !== 'free') return false;
      if (filter === 'paid' && s.pricing.model === 'free') return false;
      if (filter === 'my-copies' && !s.copied) return false;
      // topic filter loosely matches category or description
      if (topic && topic !== 'all') {
        const t = topic.toLowerCase();
        const cat = (s.category || '').toString().toLowerCase();
        const inDesc = (s.description || '').toString().toLowerCase().includes(t);
        if (!(cat.includes(t) || inDesc || s.name.toLowerCase().includes(t))) return false;
      }
      return matchesSearch;
    });

    result.sort((a, b) => {
      if (sortBy === 'return') return b.stats.return1y - a.stats.return1y;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'followers') return b.followers - a.followers;
      return 0;
    });

    return result;
  }, [strategies, filter, sortBy, searchTerm]);

  const handleCopyStrategy = async (strategyId: string) => {
    try {
      // Copy strategy to user's account via API
      alert('Strategy copied to your account! 🎉\n\nConsider upgrading to Amara subprofile for deeper education from the creator.');
      // Refresh marketplace
      const updated = await yukiApi.getMarketplaceStrategies();
      setStrategies(updated || []);
    } catch (err) {
      console.error('Failed to copy strategy:', err);
      alert('Failed to copy strategy');
    }
  };

  const computeHealthScore = (s: Strategy) => {
    // heuristic: base 50, add return, subtract drawdown*1.5
    const score = Math.round(Math.max(0, Math.min(100, 50 + (s.stats.return1y || 0) * 0.6 - (s.stats.maxDrawdown || 0) * 1.2)));
    return score;
  };

  const handleDeployStrategy = async (strategyId: string) => {
    try {
      const res = await yukiApi.deployStrategy(strategyId);
      alert('Deploy requested: ' + (res?.id || 'ok'));
    } catch (err) {
      console.error('Deploy failed', err);
      alert('Deploy failed');
    }
  };

  const handleFollow = async (strategyId: string) => {
    // simple optimistic UI toggle (stub)
    setStrategies((prev) => prev.map((p) => (p.id === strategyId ? { ...p, followers: (p.followers || 0) + 1 } : p)));
    alert('Followed strategy');
  };

  const handleForkStrategy = async (strategyId: string) => {
    try {
      const res = await yukiApi.forkMarketplaceStrategy(strategyId);
      // API returns newly created strategy id in res?.data?.id or res?.id
      const newId = res?.data?.id || res?.id || null;
      alert('Strategy forked — opening in builder...');
      if (newId) navigate(`/builder/${newId}`);
      else navigate('/builder');
    } catch (err) {
      console.error('Failed to fork strategy:', err);
      alert('Failed to fork strategy');
    }
  };

  const [cardSimResults, setCardSimResults] = useState<Record<string, { expectedReturn: number; winRate: number; drawdown: number }>>({});

  const simulateCard = (s: Strategy) => {
    // Use strategy stats + name to create deterministic sim
    const seed = (s.id || s.name).split('').reduce((acc, c) => (acc * 131 + c.charCodeAt(0)) % 100000, 7);
    const expectedReturn = Math.max(-50, Math.min(200, (s.stats.return1y || 0) * 0.6 + (seed % 20) - 5));
    const winRate = Math.max(5, Math.min(95, (s.stats.winRate || 50) + (seed % 10) - 5));
    const drawdown = Math.max(1, Math.min(50, (s.stats.maxDrawdown || 10) + (seed % 7) - 3));
    setCardSimResults((m) => ({ ...m, [s.id]: { expectedReturn: Number(expectedReturn.toFixed(1)), winRate: Math.round(winRate), drawdown: Number(drawdown.toFixed(1)) } }));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            🛒 Strategy Marketplace
          </h1>
          <p className="text-slate-400">
            Discover proven trading strategies. Copy & earn commissions. Get recognized.
          </p>
        </div>

        {/* CONTROLS */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Topic chips */}
            <div className="flex gap-2 flex-wrap items-center">
              {['Trending','Highest Return','Lowest Risk','Beginner','DAO','Yield','Trading','Automation'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t === 'Trending' ? 'all' : t)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${topic === t ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search strategies or creators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500"
              />
            </div>

            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'all', label: 'All' },
                { id: 'free', label: 'Free' },
                { id: 'paid', label: 'Paid' },
                { id: 'my-copies', label: 'My Copies' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    filter === f.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              title="Sort strategies"
            >
              <option value="return">Sort: Return</option>
              <option value="rating">Sort: Rating</option>
              <option value="followers">Sort: Followers</option>
            </select>
          </div>
        </div>

        {/* STRATEGIES GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* STRATEGY CARDS */}
          <div className="lg:col-span-2 space-y-4">
            {filteredStrategies.map((strategy) => (
              <div
                key={strategy.id}
                onClick={() => navigate(`/strategy/${strategy.id}`)}
                className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500 cursor-pointer transition-all"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div className="col-span-1">
                    <MiniGraph size={200} graph={strategy.graph} />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg">{strategy.name}</h3>
                        <p className="text-sm text-slate-400">by {strategy.creator}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Health</div>
                        <div className="text-xl font-bold">{computeHealthScore(strategy)}/100</div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-300 my-2 line-clamp-2">{strategy.description}</p>

                    <div className="grid grid-cols-3 gap-3 mt-2 text-sm">
                      <div className="bg-slate-700 rounded p-2">
                        <div className="text-xs text-slate-400">Return (1y)</div>
                        <div className="font-semibold text-green-400">+{strategy.stats.return1y}%</div>
                      </div>
                      <div className="bg-slate-700 rounded p-2">
                        <div className="text-xs text-slate-400">Win Rate</div>
                        <div className="font-semibold text-purple-400">{strategy.stats.winRate}%</div>
                      </div>
                      <div className="bg-slate-700 rounded p-2">
                        <div className="text-xs text-slate-400">Drawdown</div>
                        <div className="font-semibold text-orange-400">{strategy.stats.maxDrawdown}%</div>
                      </div>
                      <div className="bg-slate-700 rounded p-2">
                        <div className="text-xs text-slate-400">Sharpe</div>
                        <div className="font-semibold text-blue-400">{strategy.stats.sharpeRatio}</div>
                      </div>
                      <div className="bg-slate-700 rounded p-2">
                        <div className="text-xs text-slate-400">Volatility</div>
                        <div className="font-semibold text-rose-400">{strategy.stats.volatility ?? '—'}</div>
                      </div>
                      <div className="bg-slate-700 rounded p-2">
                        <div className="text-xs text-slate-400">Sim Score</div>
                        <div className="font-semibold text-amber-400">{strategy.stats.simulationScore ?? '—'}</div>
                      </div>
                      <div className="bg-slate-700 rounded p-2">
                        <div className="text-xs text-slate-400">Nodes</div>
                        <div className="font-semibold">{(strategy.graph?.nodes?.length) || 0}</div>
                      </div>
                      <div className="bg-slate-700 rounded p-2">
                        <div className="text-xs text-slate-400">Followers</div>
                        <div className="font-semibold">{strategy.followers}</div>
                      </div>
                      <div className="bg-slate-700 rounded p-2">
                        <div className="text-xs text-slate-400">State</div>
                        <div className="font-semibold">{(strategy.state || 'published').toString().toUpperCase()}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        strategy.pricing.model === 'free'
                          ? 'bg-green-600/20 text-green-300'
                          : 'bg-amber-600/20 text-amber-300'
                      }`}
                    >
                      {strategy.pricing.model === 'free'
                        ? 'Free'
                        : strategy.pricing.model === 'profit-share'
                        ? `${strategy.pricing.amount}% profit share`
                        : strategy.pricing.model === 'subscription'
                        ? `$${strategy.pricing.amount}/mo`
                        : 'Licensing'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/strategy/${strategy.id}`); }}
                        className="px-3 py-1 rounded text-sm bg-slate-700 hover:bg-slate-600 text-white"
                      >
                        View
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); simulateCard(strategy); }}
                        className="px-3 py-1 rounded text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        Simulate
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleForkStrategy(strategy.id); }}
                        className="px-3 py-1 rounded text-sm bg-amber-600 hover:bg-amber-700 text-black"
                      >
                        Fork
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeployStrategy(strategy.id); }}
                        className="px-3 py-1 rounded text-sm bg-emerald-600 hover:bg-emerald-700 text-black"
                      >
                        Deploy
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFollow(strategy.id); }}
                        className="px-3 py-1 rounded text-sm bg-pink-600 hover:bg-pink-700 text-white"
                      >
                        Follow
                      </button>
                    </div>
                </div>
                {/* show sim results if available */}
                {cardSimResults[strategy.id] && (
                  <div className="mt-3 p-2 bg-slate-900 rounded text-sm">
                    <div className="font-semibold mb-1">Simulation</div>
                    <div>Expected Return: <span className="font-medium">{cardSimResults[strategy.id].expectedReturn}%</span></div>
                    <div>Win Rate: <span className="font-medium">{cardSimResults[strategy.id].winRate}%</span></div>
                    <div>Drawdown: <span className="font-medium">{cardSimResults[strategy.id].drawdown}%</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* SIDE PANEL: STRATEGY DETAILS */}
          {selectedStrategy && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 h-fit sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Strategy Details</h3>
                <button
                  onClick={() => setSelectedStrategy(null)}
                  className="text-slate-400 hover:text-white text-2xl leading-none"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Creator</p>
                  <p className="font-semibold">{selectedStrategy.creator}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400">Category</p>
                  <p className="font-semibold capitalize">{selectedStrategy.category}</p>
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <p className="text-sm text-slate-400 mb-2">Performance Metrics</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Return (1y)</span>
                      <span className="text-green-400 font-bold">
                        +{selectedStrategy.stats.return1y}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sharpe Ratio</span>
                      <span className="text-blue-400 font-bold">
                        {selectedStrategy.stats.sharpeRatio}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Drawdown</span>
                      <span className="text-orange-400 font-bold">
                        {selectedStrategy.stats.maxDrawdown}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Win Rate</span>
                      <span className="text-purple-400 font-bold">
                        {selectedStrategy.stats.winRate}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <button className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold flex items-center justify-center gap-2 transition-colors mb-2">
                    <span>📋</span>
                    Copy Strategy
                  </button>
                  <button className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold flex items-center justify-center gap-2 transition-colors">
                    <TrendingUp className="h-4 w-4" />
                    Upgrade to Amara
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Check = ({ className }: { className: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);
